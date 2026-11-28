// Ported from: src/hooks/useScreenAnalytics.ts, src/components/TikTokSession.tsx, the `initFacebookEvents()` /
//              `loadPrivacyConsent()` calls of src/bootstrap-app.tsx (consent applied to the SDKs at start and on
//              every change), the analytics calls of src/contexts/AuthContext.tsx (setUserId, setUserProperties,
//              logLogin, logSignUp), the Index.tsx `analytics.logScreenView` effect (via ShellPlatform)
//
// Riverpod wiring of the analytics service and the small hosts App.tsx mounts. The app root overrides:
//   analyticsSinkProvider       → ServiceAnalyticsSink (paywalls, purchases, tools, books, recap, games…)
//   shellPlatformProvider       → AnalyticsShellPlatform (Index's screen views)
//   authSideEffectsProvider     → analyticsAuthSideEffects (login / sign-up / user id / user properties)
//   storyEventLoggerProvider    → not used by React analytics (StoryViewer logs nothing to analytics.ts)
// and mounts [AnalyticsSessionHosts] once the backend is open.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/data/privacy_consent.dart';
import '../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../native/purchases/purchase_analytics.dart';
import '../../native/purchases/purchases_providers.dart' show currentStorePlatform;
import '../../shell/shell_inputs.dart';
import 'analytics.dart';
import 'analytics_screen.dart';
import 'customerio.dart';
import 'facebook_events.dart';
import 'tiktok_events.dart';
import 'tracking_transparency.dart';

/// Firebase Analytics SDK (`firebase_analytics` in the native step). Default: not configured.
final firebaseAnalyticsPlatformProvider = Provider<FirebaseAnalyticsPlatform>((ref) => const NoFirebaseAnalytics());

/// The internal `analytics_events` writer.
final internalAnalyticsTrackerProvider = Provider<InternalAnalyticsTracker>(
    (ref) => SupabaseInternalAnalytics(client: () => ref.read(supabaseClientProvider), platform: currentStorePlatform()));

/// `facebook-events.ts` module state (activation flag is per launch).
final facebookEventsProvider = Provider<FacebookEvents>((ref) => FacebookEvents(
      plugin: ref.watch(facebookEventsPluginProvider),
      attributionAllowed: () => ref.read(privacyConsentProvider).attribution,
      platform: currentStorePlatform(),
      trackingTransparency: ref.watch(trackingTransparencyProvider),
    ));

/// `tiktok-events.ts` module state.
final tiktokEventsProvider = Provider<TikTokEvents>((ref) => TikTokEvents(
      plugin: ref.watch(tiktokEventsPluginProvider),
      attributionAllowed: () => ref.read(privacyConsentProvider).attribution,
      platform: currentStorePlatform(),
      trackingTransparency: ref.watch(trackingTransparencyProvider),
    ));

/// `analytics` (src/lib/analytics.ts).
final analyticsServiceProvider = Provider<AnalyticsService>((ref) => AnalyticsService(
      consent: () => ref.read(privacyConsentProvider),
      firebase: ref.watch(firebaseAnalyticsPlatformProvider),
      internal: ref.watch(internalAnalyticsTrackerProvider),
      facebook: ref.watch(facebookEventsProvider),
      tiktok: ref.watch(tiktokEventsProvider),
      customerIo: ref.watch(customerIoProvider),
    ));

/// [AnalyticsSink] (native/purchases) over the analytics service. App root:
/// `analyticsSinkProvider.overrideWith((ref) => ServiceAnalyticsSink(ref.watch(analyticsServiceProvider)))`.
class ServiceAnalyticsSink implements AnalyticsSink {
  const ServiceAnalyticsSink(this.analytics);
  final AnalyticsService analytics;

  @override
  void logPaywallShown(String source) => unawaited(analytics.logPaywallShown(source));
  @override
  void logPaywallClicked(String source, String plan) => unawaited(analytics.logPaywallClicked(source, plan));
  @override
  void logPremiumSubscribed(String packageId, double price, String currency) => analytics.logPremiumSubscribed(packageId, price, currency);
  @override
  void logTrialStarted(String packageId, double price, String currency) => unawaited(analytics.logTrialStarted(packageId, price, currency));
  @override
  void logEvent(String name, [Map<String, Object?> params = const {}]) => unawaited(analytics.logEvent(name, params));
}

/// [ShellPlatform] whose `logScreenView` is `analytics.logScreenView` (Index's tab/screen/tool effect and the
/// games' `useScreenAnalytics`). App root: `shellPlatformProvider.overrideWith(AnalyticsShellPlatform.new)`.
class AnalyticsShellPlatform extends DefaultShellPlatform {
  AnalyticsShellPlatform(super.ref);

  @override
  void logScreenView(String name, String screenClass) => unawaited(ref.read(analyticsServiceProvider).logScreenView(name, screenClass));
}

/// AuthContext's analytics calls as [AuthSideEffects]. App root:
/// `authSideEffectsProvider.overrideWith((ref) => analyticsAuthSideEffects(ref, reportAuthError: …))`.
AuthSideEffects analyticsAuthSideEffects(Ref ref, {void Function(String provider, Object error)? reportAuthError, void Function(String userId)? onSignedIn, void Function()? onLoggedOut}) {
  AnalyticsService analytics() => ref.read(analyticsServiceProvider);
  return AuthSideEffects(
    reportAuthError: reportAuthError,
    onLoggedOut: onLoggedOut,
    onSignedIn: (userId) {
      onSignedIn?.call(userId);
      unawaited(analytics().setUserId(userId));
      unawaited(analytics().setUserProperties(const {'life_stage': ''}));
    },
    onLogin: (method) => unawaited(analytics().logLogin(method)),
    onSignUp: (method) => unawaited(analytics().logSignUp(method)),
    onProfileSynced: (userId, profile) {
      if (userId.isEmpty) return;
      final stage = profile.lifeStage;
      unawaited(analytics().setUserId(userId));
      unawaited(analytics().setUserProperties({
        'life_stage': stage == null || stage.isEmpty ? 'unknown' : stage,
        'is_premium': '${profile.row['is_premium'] == true}',
        'role': stage == 'partner' ? 'partner' : 'woman',
      }));
    },
  );
}

/// `trackEvent(name, params)` (fire and forget).
void trackEvent(WidgetRef ref, String eventName, [Map<String, Object?>? params]) =>
    unawaited(ref.read(analyticsServiceProvider).logEvent(eventName, params).catchError((Object _) {}));

/// `useScreenAnalytics(screenName, screenClass)`: registers the mounted screen and logs its view on mount (and
/// when the name/class changes); the registration ends with the widget.
class ScreenAnalytics extends ConsumerStatefulWidget {
  const ScreenAnalytics({super.key, required this.screenName, this.screenClass, required this.child});
  final String screenName;
  final String? screenClass;
  final Widget child;

  @override
  ConsumerState<ScreenAnalytics> createState() => _ScreenAnalyticsState();
}

class _ScreenAnalyticsState extends ConsumerState<ScreenAnalytics> {
  VoidCallback? _release;

  void _start() {
    final screenClass = widget.screenClass ?? widget.screenName;
    _release = ref.read(analyticsScreenRegistryProvider).register(widget.screenName, screenClass);
    unawaited(ref.read(analyticsServiceProvider).logScreenView(widget.screenName, screenClass).catchError((Object _) {}));
  }

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(ScreenAnalytics oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.screenName != widget.screenName || oldWidget.screenClass != widget.screenClass) {
      _release?.call();
      _start();
    }
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// `<TikTokSession/>`: TikTok's external id follows the signed-in account (native + attribution consent only).
class TikTokSessionHost extends ConsumerStatefulWidget {
  const TikTokSessionHost({super.key});
  @override
  ConsumerState<TikTokSessionHost> createState() => _TikTokSessionHostState();
}

class _TikTokSessionHostState extends ConsumerState<TikTokSessionHost> {
  String? _applied;
  bool _first = true;

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider.select((u) => u?.id));
    final attribution = ref.watch(privacyConsentProvider.select((c) => c.attribution));
    final externalId = userId != null && attribution ? userId : null;
    if (_first || externalId != _applied) {
      _first = false;
      _applied = externalId;
      unawaited(ref.read(tiktokEventsProvider).setIdentity(externalId).catchError((Object _) {}));
    }
    return const SizedBox.shrink();
  }
}

/// `loadPrivacyConsent()` + `setPrivacyConsent()`'s SDK step: applies the stored decision to Firebase / Meta /
/// TikTok at start and again whenever it changes (a change after start counts as the person's own choice, so
/// the iOS ATT prompt may be asked then).
class PrivacyConsentApplier extends ConsumerStatefulWidget {
  const PrivacyConsentApplier({super.key});
  @override
  ConsumerState<PrivacyConsentApplier> createState() => _PrivacyConsentApplierState();
}

class _PrivacyConsentApplierState extends ConsumerState<PrivacyConsentApplier> {
  @override
  void initState() {
    super.initState();
    unawaited(ref.read(analyticsServiceProvider).applyPrivacyConsent(ref.read(privacyConsentProvider)).catchError((Object _) {}));
    ref.listenManual<PrivacyConsent>(privacyConsentProvider, (previous, next) {
      if (previous != null && previous.decidedAt == next.decidedAt && previous.analytics == next.analytics && previous.ads == next.ads &&
          previous.attribution == next.attribution) {
        return;
      }
      unawaited(ref.read(analyticsServiceProvider).applyPrivacyConsent(next, fromUser: true).catchError((Object _) {}));
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
