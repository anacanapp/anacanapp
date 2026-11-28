// Ported from: (no vitest file for src/lib/analytics.ts / facebook-events.ts) — the consent gates, internal
// tracking, screen views and Meta/TikTok forwarding of the analytics service.
import 'package:anacan/core/data/privacy_consent.dart';
import 'package:anacan/services/analytics/analytics.dart';
import 'package:anacan/services/analytics/analytics_providers.dart';
import 'package:anacan/services/analytics/facebook_events.dart';
import 'package:anacan/services/analytics/tiktok_events.dart';
import 'package:flutter_test/flutter_test.dart';

class RecordingFirebase implements FirebaseAnalyticsPlatform {
  final List<String> calls = [];
  @override
  Future<void> logEvent(String name, Map<String, Object> params) async => calls.add('event:$name:$params');
  @override
  Future<void> setUserId(String? userId) async => calls.add('user:$userId');
  @override
  Future<void> setUserProperty(String key, String value) async => calls.add('prop:$key=$value');
  @override
  Future<void> setCurrentScreen(String screenName, String screenClass) async => calls.add('screen:$screenName/$screenClass');
  @override
  Future<void> setConsent({required bool analyticsStorage, required bool adStorage, required bool adUserData, required bool adPersonalization}) async =>
      calls.add('consent:$analyticsStorage,$adStorage,$adUserData,$adPersonalization');
  @override
  Future<void> setEnabled(bool enabled) async => calls.add('enabled:$enabled');
}

class RecordingInternal implements InternalAnalyticsTracker {
  final List<String> rows = [];
  @override
  Future<void> track(String eventName, String category, Map<String, Object> params) async => rows.add('$eventName|$category|$params');
}

class RecordingFb implements FacebookEventsPlugin {
  final List<String> events = [];
  @override
  Future<void> logEvent({required String event, required Map<String, Object> params}) async => events.add('$event:$params');
  @override
  Future<void> setAdvertiserTrackingEnabled(bool enabled) async => events.add('att:$enabled');
  @override
  Future<void> setConsent(bool enabled) async => events.add('consent:$enabled');
}

class RecordingTikTok implements TikTokEventsPlugin {
  final List<String> calls = [];
  @override
  Future<({bool started, String? reason})> start({required bool tracking, bool debug = false}) async {
    calls.add('start:$tracking');
    return (started: true, reason: null);
  }

  @override
  Future<void> setEnabled(bool enabled) async => calls.add('enabled:$enabled');
  @override
  Future<void> track({required String event, Map<String, Object>? properties}) async => calls.add('track:$event:$properties');
  @override
  Future<void> identify(String externalId) async => calls.add('identify:$externalId');
  @override
  Future<void> logout() async => calls.add('logout');
}

Future<void> flush() => Future<void>.delayed(Duration.zero);

void main() {
  late PrivacyConsent consent;
  late RecordingFirebase firebase;
  late RecordingInternal internal;
  late RecordingFb fb;
  late RecordingTikTok tiktok;
  late AnalyticsService analytics;

  setUp(() {
    consent = PrivacyConsent.undecided;
    firebase = RecordingFirebase();
    internal = RecordingInternal();
    fb = RecordingFb();
    tiktok = RecordingTikTok();
    analytics = AnalyticsService(
      consent: () => consent,
      firebase: firebase,
      internal: internal,
      facebook: FacebookEvents(plugin: fb, attributionAllowed: () => consent.attribution, platform: 'android'),
      tiktok: TikTokEvents(plugin: tiktok, attributionAllowed: () => consent.attribution, platform: 'android'),
      now: () => 1000,
    );
  });

  test('nothing is recorded before an opt-in decision', () async {
    await analytics.logEvent('sign_up', {'method': 'email'});
    await analytics.logScreenView('Dashboard', 'Tab');
    await analytics.setUserProperties({'life_stage': 'bump'});
    await flush();
    expect(firebase.calls, isEmpty);
    expect(internal.rows, isEmpty);
    expect(fb.events, isEmpty);
    expect(tiktok.calls, isEmpty);
  });

  test('analytics consent feeds Firebase and the internal table; undefined params are dropped', () async {
    consent = const PrivacyConsent(analytics: true, decidedAt: '2026-01-01T00:00:00Z');
    await analytics.logPostCreated();
    await flush();
    expect(internal.rows, ['community_post_created|community|{}']);
    expect(firebase.calls, ['event:community_post_created:{}']);
    expect(fb.events, isEmpty);
  });

  test('screen views set the GA4 screen and log screen_view', () async {
    consent = const PrivacyConsent(analytics: true, decidedAt: '2026-01-01T00:00:00Z');
    await analytics.logScreenView('ToolsHub', 'Tools');
    await flush();
    expect(firebase.calls.first, 'screen:ToolsHub/Tools');
    expect(internal.rows.single, 'screen_view|navigation|{screen_name: ToolsHub, screen_class: Tools}');
  });

  test('attribution consent forwards only mapped conversion events with value', () async {
    consent = const PrivacyConsent(attribution: true, decidedAt: '2026-01-01T00:00:00Z');
    analytics.logPremiumSubscribed('yearly', 29.99, 'AZN');
    await analytics.logWeight(70);
    await flush();
    await flush();
    expect(fb.events, [
      'Subscribe:{plan: yearly, price: 29.99, currency: AZN, _valueToSum: 29.99, fb_currency: AZN}',
      'fb_mobile_purchase:{value: 29.99, currency: AZN, item_id: yearly, transaction_id: sub_1000, _valueToSum: 29.99, fb_currency: AZN}',
    ]);
    expect(tiktok.calls, ['start:false', 'track:Subscribe:{value: 29.99, currency: AZN, content_id: yearly, content_type: subscription}']);
    expect(internal.rows, isEmpty);
  });

  test('a privacy decision is applied to Firebase consent mode, Meta and TikTok', () async {
    consent = const PrivacyConsent(analytics: true, attribution: true, decidedAt: '2026-01-01T00:00:00Z');
    await analytics.applyPrivacyConsent(consent);
    expect(firebase.calls, ['consent:true,false,false,false', 'enabled:true']);
    expect(fb.events, ['consent:true', 'fb_mobile_activate_app:{}']);
    expect(tiktok.calls, ['start:false']);
    consent = const PrivacyConsent(decidedAt: '2026-01-02T00:00:00Z');
    await analytics.applyPrivacyConsent(consent, fromUser: true);
    expect(tiktok.calls, ['start:false', 'logout', 'enabled:false']);
  });

  test('the purchases sink routes paywall and subscription events', () async {
    consent = const PrivacyConsent(analytics: true, decidedAt: '2026-01-01T00:00:00Z');
    final sink = ServiceAnalyticsSink(analytics);
    sink.logPaywallShown('tool');
    sink.logPaywallClicked('tool', 'monthly');
    sink.logEvent('recap_opened', {'year': 2026});
    await flush();
    expect(internal.rows, [
      'premium_paywall_shown|premium|{source: tool}',
      'premium_paywall_clicked|premium|{source: tool, plan: monthly}',
      'recap_opened|recap|{year: 2026}',
    ]);
  });
}
