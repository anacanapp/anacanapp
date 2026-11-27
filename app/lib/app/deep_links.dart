// Ported from: src/lib/deeplink.ts (initDeeplinkListener: `appUrlOpen` + `App.getLaunchUrl()`, promo `/h/<code>`
//              first), src/lib/promo.ts (promoCodeFromUrl), src/lib/native-auth.ts (ensureNativeOAuthCallbackListener:
//              `com.atlasoon.anacan://auth-callback…` → completeNativeOAuthCallback), src/pages/Index.tsx
//              (handleDeeplink)
//
// Incoming app links (custom schemes `anacan://`, `com.atlasoon.anacan://`; cold-start launch URL and links while
// running) come from app_links. [IncomingLinks] subscribes in `main()` — before the first frame, so the launch link
// is not missed — and keeps every URL until the routed app attaches a handler ([IncomingLinkHost], mounted once the
// backend is open); links that arrive during a restart wait for the next handler. Routing ([routeIncomingLink]):
//   1. the browser OAuth callback → AuthController.completeNativeOAuthCallback (Capacitor's second listener);
//   2. a promo gift link `/h/<CODE>` → pending promo (LocalStore `anacan:promo-code`; the redeemer grants it);
//   3. anything else → the shell's `openUrl` (parseDeeplink; non-app links are ignored, like React).
import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/auth.dart' show authControllerProvider, isNativeOAuthCallback;
import '../features/entry/auth/promo.dart' show normalizePromoCode, savePendingPromo;
import '../shell/links/js_url.dart';
import '../shell/nav/shell_controller.dart' show shellProvider;
import '../state/persisted_store.dart' show localStoreProvider;

/// `promoCodeFromUrl(url)`: `/h/<code>` on any app origin, or `anacan://h/<code>`.
String? promoCodeFromUrl(String url) {
  final parsed = JsUrl.parse(url, base: 'https://app.anacan.az');
  if (parsed == null) return null;
  final host = parsed.port.isEmpty ? parsed.hostname : '${parsed.hostname}:${parsed.port}';
  final path = parsed.protocol == 'anacan:' ? '/$host${parsed.pathname}' : parsed.pathname;
  final match = RegExp(r'^/h/([^/?#]+)/?$', caseSensitive: false).firstMatch(path);
  if (match == null) return null;
  try {
    return normalizePromoCode(Uri.decodeComponent(match.group(1)!));
  } catch (_) {
    return null;
  }
}

/// What a link turned into (tests, logs).
enum IncomingLinkKind { oauthCallback, promo, appLink, ignored }

/// Routes one incoming URL. [completeOAuth], [savePromo], [openUrl] are the app's actions.
IncomingLinkKind routeIncomingLink(
  String url, {
  required Future<bool> Function(String url) completeOAuth,
  required void Function(String code) savePromo,
  required bool Function(String url) openUrl,
}) {
  if (isNativeOAuthCallback(url)) {
    unawaited(completeOAuth(url).catchError((Object _) => false));
    return IncomingLinkKind.oauthCallback;
  }
  final promo = promoCodeFromUrl(url);
  if (promo != null) {
    savePromo(promo);
    return IncomingLinkKind.promo;
  }
  return openUrl(url) ? IncomingLinkKind.appLink : IncomingLinkKind.ignored;
}

/// Process-wide buffer between the platform link stream and the app (one per process, like the WebView's
/// `appUrlOpen` listener queue).
class IncomingLinks {
  IncomingLinks();

  static final IncomingLinks instance = IncomingLinks();

  /// Links kept while no handler is attached (oldest dropped beyond this).
  static const int maxPending = 8;

  final List<String> _pending = [];
  void Function(String url)? _handler;
  StreamSubscription<String>? _subscription;

  List<String> get pending => List.unmodifiable(_pending);

  /// Starts listening to [source] (idempotent). Errors of the platform stream are ignored.
  void start(Stream<String> source) {
    _subscription ??= source.listen(deliver, onError: (Object _) {});
  }

  /// A link from the platform (or a test).
  void deliver(String url) {
    if (url.isEmpty) return;
    final handler = _handler;
    if (handler == null) {
      _pending.add(url);
      if (_pending.length > maxPending) _pending.removeAt(0);
      return;
    }
    handler(url);
  }

  /// The app is ready to route links: queued ones are delivered in order.
  void attach(void Function(String url) handler) {
    _handler = handler;
    while (_pending.isNotEmpty && _handler == handler) {
      handler(_pending.removeAt(0));
    }
  }

  void detach(void Function(String url) handler) {
    if (_handler == handler) _handler = null;
  }

  @visibleForTesting
  Future<void> reset() async {
    await _subscription?.cancel();
    _subscription = null;
    _handler = null;
    _pending.clear();
  }
}

/// The platform link stream (launch link first, then every `appUrlOpen`). Null where the plugin is unavailable.
Stream<String>? platformLinkStream() {
  if (kIsWeb) return null;
  try {
    return AppLinks().stringLinkStream;
  } catch (_) {
    return null;
  }
}

/// Starts [IncomingLinks.instance] on the platform stream (called from `main()`).
void startIncomingLinks() {
  final stream = platformLinkStream();
  if (stream != null) IncomingLinks.instance.start(stream);
}

/// The process queue the root host attaches to (tests override it).
final incomingLinksProvider = Provider<IncomingLinks>((ref) => IncomingLinks.instance);

/// Attaches the link handler while mounted. Mount once inside the provider scope after the backend opened.
class IncomingLinkHost extends ConsumerStatefulWidget {
  const IncomingLinkHost({super.key});

  @override
  ConsumerState<IncomingLinkHost> createState() => _IncomingLinkHostState();
}

class _IncomingLinkHostState extends ConsumerState<IncomingLinkHost> {
  late final IncomingLinks _links = ref.read(incomingLinksProvider);

  void _handle(String url) {
    if (!mounted) return;
    routeIncomingLink(
      url,
      completeOAuth: (u) => ref.read(authControllerProvider.notifier).completeNativeOAuthCallback(u),
      savePromo: (code) => savePendingPromo(ref.read(localStoreProvider), code),
      openUrl: (u) => ref.read(shellProvider.notifier).openUrl(u),
    );
  }

  @override
  void initState() {
    super.initState();
    // After the first frame: the shell controller and the auth controller exist by then.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _links.attach(_handle);
    });
  }

  @override
  void dispose() {
    _links.detach(_handle);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
