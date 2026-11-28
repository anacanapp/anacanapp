// Ported from: src/App.tsx (<Routes>: the native-relevant routes), src/pages/BlogLink.tsx (native: remember the
//              article, go to `/`), src/pages/AppPathLink.tsx (catch-all: known app path → pending app link + `/`,
//              else 404; PendingAppLink hands it to the in-app router after sign-in), src/lib/app-path-links.ts
//
// Web-only routes are omitted (see docs/flutter/SHELL.md): /blog (public blog), /admin, /admin/:section,
// /admin/ads, /moderator, /partner, /p/v/:token, /h/:code, /debug/revenuecat, /revenuecat-debug.
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'feature_registry.dart';
import 'gates/gate_host.dart';
import 'links/app_path_links.dart';
import 'links/blog_links.dart';
import 'links/js_url.dart';
import 'nav/shell_controller.dart';
import 'shell_inputs.dart';
import 'widgets/android_back_scope.dart';

/// Where an outer URL goes.
@immutable
sealed class OuterRoute {
  const OuterRoute();
}

/// `/` → Index (gates + shell).
class OuterIndex extends OuterRoute {
  const OuterIndex();
  @override
  bool operator ==(Object other) => other is OuterIndex;
  @override
  int get hashCode => 0;
  @override
  String toString() => 'OuterIndex';
}

/// `/blog/:slug`, `/blog/:language/:slug`: remember [slug] (when valid) and replace with `/`.
class OuterBlogLink extends OuterRoute {
  const OuterBlogLink(this.slug);
  final String slug;
  @override
  bool operator ==(Object other) => other is OuterBlogLink && other.slug == slug;
  @override
  int get hashCode => slug.hashCode;
  @override
  String toString() => 'OuterBlogLink($slug)';
}

/// A page outside Index.
class OuterPage extends OuterRoute {
  const OuterPage(this.id, [this.params = const {}]);
  final OuterRouteId id;
  final Map<String, String> params;
  @override
  bool operator ==(Object other) => other is OuterPage && other.id == id && mapEquals(other.params, params);
  @override
  int get hashCode => Object.hash(id, Object.hashAllUnordered(params.entries.map((e) => '${e.key}=${e.value}')));
  @override
  String toString() => 'OuterPage(${id.name}, $params)';
}

/// AppPathLink: a known app path; [href] is kept until sign-in, the location becomes `/`.
class OuterAppLink extends OuterRoute {
  const OuterAppLink(this.href);
  final String href;
  @override
  bool operator ==(Object other) => other is OuterAppLink && other.href == href;
  @override
  int get hashCode => href.hashCode;
  @override
  String toString() => 'OuterAppLink($href)';
}

String? _decodeSegment(String s) {
  try {
    return decodeUriComponent(s);
  } on FormatException {
    return null;
  }
}

/// Matches [path] (+ [search]) against the native routes, react-router style (a trailing slash is ignored,
/// `:params` are single non-empty decoded segments).
OuterRoute resolveOuterRoute(String path, [String search = '']) {
  final segs = path.split('/').where((s) => s.isNotEmpty).toList();
  final n = segs.length;
  if (n == 0) return const OuterIndex();
  final first = segs[0];
  if (first == 'blog' && (n == 2 || n == 3)) {
    final slug = _decodeSegment(segs[n - 1]);
    if (slug != null) return OuterBlogLink(slug);
  }
  if (n == 1 && first == 'reset-password') return const OuterPage(OuterRouteId.resetPassword);
  if (n == 2 && first == 'legal') {
    final doc = _decodeSegment(segs[1]);
    if (doc != null) return OuterPage(OuterRouteId.legal, {'docType': doc});
  }
  if (n == 2 && first == 'payment' && segs[1] == 'success') return const OuterPage(OuterRouteId.paymentSuccess);
  if (n == 2 && first == 'payment' && segs[1] == 'error') return const OuterPage(OuterRouteId.paymentError);
  if (n == 1 && first == 'mini-games') return const OuterPage(OuterRouteId.miniGames);
  final href = appLinkForPath(path, search);
  if (href != null) return OuterAppLink(href);
  return const OuterPage(OuterRouteId.notFound);
}

/// Canonical go_router location of an [OuterPage].
String _locationOf(OuterPage p) => switch (p.id) {
      OuterRouteId.resetPassword => '/reset-password',
      OuterRouteId.legal => '/legal/${encodeUriComponent(p.params['docType']!)}',
      OuterRouteId.paymentSuccess => '/payment/success',
      OuterRouteId.paymentError => '/payment/error',
      OuterRouteId.miniGames => '/mini-games',
      OuterRouteId.notFound => '/404',
    };

/// The outer router. `/` hosts the Index gates and shell inside [AndroidBackScope].
GoRouter buildShellRouter({
  String initialLocation = '/',
  DateTime Function()? clock,
  List<NavigatorObserver> observers = const [],
}) {
  final now = clock ?? DateTime.now;
  return GoRouter(
    initialLocation: initialLocation,
    observers: observers,
    redirect: (context, state) {
      final uri = state.uri;
      final route = resolveOuterRoute(uri.path, uri.hasQuery ? '?${uri.query}' : '');
      final container = ProviderScope.containerOf(context, listen: false);
      switch (route) {
        case OuterIndex():
          return uri.path == '/' ? null : '/';
        case OuterBlogLink(:final slug):
          if (validBlogSlug(slug)) container.read(pendingBlogStoreProvider).remember(slug);
          return '/';
        case OuterAppLink(:final href):
          container.read(appLinkStoreProvider).remember(href, nowMs: now().millisecondsSinceEpoch);
          return '/';
        case OuterPage():
          final target = _locationOf(route);
          if (route.id == OuterRouteId.notFound) return uri.path == '/404' ? null : '/404?from=${Uri.encodeQueryComponent(uri.path)}';
          return uri.path == target ? null : target;
      }
    },
    routes: [
      ShellRoute(
        builder: (context, state, child) => PendingAppLink(location: state.uri.toString(), child: child),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const AndroidBackScope(child: GateHost())),
          GoRoute(path: '/reset-password', builder: (c, s) => _page(c, OuterRouteId.resetPassword, s)),
          GoRoute(path: '/legal/:docType', builder: (c, s) => _page(c, OuterRouteId.legal, s)),
          GoRoute(path: '/payment/success', builder: (c, s) => _page(c, OuterRouteId.paymentSuccess, s)),
          GoRoute(path: '/payment/error', builder: (c, s) => _page(c, OuterRouteId.paymentError, s)),
          GoRoute(path: '/mini-games', builder: (c, s) => _page(c, OuterRouteId.miniGames, s)),
          GoRoute(path: '/404', builder: (c, s) => _page(c, OuterRouteId.notFound, s)),
        ],
      ),
    ],
    errorBuilder: (c, s) => _page(c, OuterRouteId.notFound, s),
  );
}

Widget _page(BuildContext context, OuterRouteId id, GoRouterState state) {
  final container = ProviderScope.containerOf(context, listen: false);
  final b = container.read(featureRegistryProvider).routePage(id);
  final args = OuterRouteArgs(uri: state.uri, params: state.pathParameters);
  return b != null ? b(context, args) : ShellPlaceholder(kind: 'route', id: id.name);
}

/// `PendingAppLink`: once signed in (and on every location change), a remembered app link is routed
/// through `navigateFromPush({deeplink})`.
class PendingAppLink extends ConsumerStatefulWidget {
  const PendingAppLink({super.key, required this.location, required this.child, this.clock});
  final String location;
  final Widget child;
  final DateTime Function()? clock;

  @override
  ConsumerState<PendingAppLink> createState() => _PendingAppLinkState();
}

class _PendingAppLinkState extends ConsumerState<PendingAppLink> {
  void _check() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final user = ref.read(shellUserProvider);
      if (!user.isAuthenticated) return;
      final href = ref.read(appLinkStoreProvider).take(nowMs: (widget.clock ?? DateTime.now)().millisecondsSinceEpoch);
      if (href != null) ref.read(shellProvider.notifier).navigateFromPush({'deeplink': href});
    });
  }

  @override
  void initState() {
    super.initState();
    _check();
  }

  @override
  void didUpdateWidget(PendingAppLink oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.location != widget.location) _check();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(shellUserProvider.select((u) => u.isAuthenticated), (prev, next) {
      if (next) _check();
    });
    return widget.child;
  }
}
