// Ported from: packages/tiktok-events/index.d.ts, packages/customerio-data-in/index.d.ts (plugin surfaces),
//              node_modules/capacitor-plugin-app-tracking-transparency (status strings),
//              node_modules/@capacitor-firebase/analytics (parameter bundle, setUserId, setCurrentScreen)
import 'package:anacan/core/data/privacy_consent.dart';
import 'package:anacan/services/ads/admob_adapter.dart' show admobSdkProvider;
import 'package:anacan/services/ads/ads_providers.dart' show compiledAdmobAppIdProvider;
import 'package:anacan/services/analytics/analytics.dart';
import 'package:anacan/services/analytics/analytics_providers.dart' show firebaseAnalyticsPlatformProvider;
import 'package:anacan/services/analytics/att_tracking_transparency.dart';
import 'package:anacan/services/analytics/customerio.dart';
import 'package:anacan/services/analytics/customerio_channel.dart';
import 'package:anacan/services/analytics/firebase_analytics_platform.dart';
import 'package:anacan/services/analytics/sdk_wiring.dart';
import 'package:anacan/services/analytics/tiktok_events.dart';
import 'package:anacan/services/analytics/tiktok_events_channel.dart';
import 'package:anacan/services/analytics/tracking_transparency.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart' as att;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  List<MethodCall> mock(String name, [Object? Function(MethodCall call)? answer]) {
    final calls = <MethodCall>[];
    messenger.setMockMethodCallHandler(MethodChannel(name), (call) async {
      calls.add(call);
      return answer?.call(call);
    });
    addTearDown(() => messenger.setMockMethodCallHandler(MethodChannel(name), null));
    return calls;
  }

  group('TikTok channel', () {
    test('start maps {started, reason}; calls carry the plugin arguments', () async {
      final calls = mock(MethodChannelTikTokEvents.channelName,
          (call) => call.method == 'start' ? {'started': false, 'reason': 'not_configured'} : null);
      const plugin = MethodChannelTikTokEvents();
      expect(await plugin.start(tracking: true), (started: false, reason: 'not_configured'));
      await plugin.track(event: 'Registration', properties: {'content_type': 'subscription', 'value': 4.99});
      await plugin.identify('user-1');
      await plugin.setEnabled(false);
      await plugin.logout();
      expect(calls.map((c) => c.method), ['start', 'track', 'identify', 'setEnabled', 'logout']);
      expect(calls[0].arguments, {'tracking': true, 'debug': false});
      expect(calls[1].arguments, {
        'event': 'Registration',
        'properties': {'content_type': 'subscription', 'value': 4.99},
      });
      expect(calls[2].arguments, {'externalId': 'user-1'});
      expect(calls[3].arguments, {'enabled': false});
    });

    test('a started SDK and the TikTokEvents consent flow', () async {
      final calls = mock(MethodChannelTikTokEvents.channelName, (call) => call.method == 'start' ? {'started': true} : null);
      var allowed = true;
      final events = TikTokEvents(plugin: const MethodChannelTikTokEvents(), attributionAllowed: () => allowed, platform: 'android');
      await events.logEvent('sign_up');
      expect(calls.map((c) => c.method), ['start', 'track']);
      expect(calls.last.arguments, {'event': 'Registration', 'properties': <String, Object>{}});
      allowed = false;
      await events.applyConsent(false);
      expect(calls.map((c) => c.method).skip(2), ['logout', 'setEnabled']);
    });
  });

  group('Customer.io channel', () {
    test('initialize sends only region and environment, never a key', () async {
      final calls = mock(MethodChannelCustomerIo.channelName);
      const plugin = MethodChannelCustomerIo();
      await plugin.initialize(const CustomerIoConfig(environment: 'production'));
      await plugin.identify(userId: 'u', traits: {'language': 'az', 'environment': 'production'});
      await plugin.track(name: 'community_post_created', properties: {'entry_point': 'community'});
      await plugin.screen(title: 'Home', properties: {'environment': 'production'});
      await plugin.reset();
      expect(calls.map((c) => c.method), ['initialize', 'identify', 'track', 'screen', 'reset']);
      expect(calls[0].arguments, {'region': 'EU', 'environment': 'production'});
      expect(calls[1].arguments, {'userId': 'u', 'traits': {'language': 'az', 'environment': 'production'}});
      expect(calls[2].arguments, {'name': 'community_post_created', 'properties': {'entry_point': 'community'}});
      expect(calls[3].arguments, {'title': 'Home', 'properties': {'environment': 'production'}});
    });

    test('a native rejection makes Customer.io unavailable (nothing identified)', () async {
      final calls = mock(MethodChannelCustomerIo.channelName,
          (call) => call.method == 'initialize' ? throw PlatformException(code: 'CUSTOMERIO_NATIVE_PLUGIN_REQUIRED') : null);
      final tracking = CustomerIoTracking(const CustomerIoConfig(environment: 'sandbox'), () async => const MethodChannelCustomerIo());
      await tracking.setIdentity(const CustomerIoIdentity(userId: 'u', backend: 'google', language: 'az', consent: true));
      expect(calls.map((c) => c.method), ['initialize']);
    });
  });

  test('ATT status strings (pre-iOS 14 answers authorized, as the Capacitor plugin)', () {
    expect(trackingStatusName(att.TrackingStatus.notDetermined), 'notDetermined');
    expect(trackingStatusName(att.TrackingStatus.restricted), 'restricted');
    expect(trackingStatusName(att.TrackingStatus.denied), 'denied');
    expect(trackingStatusName(att.TrackingStatus.authorized), 'authorized');
    expect(trackingStatusName(att.TrackingStatus.notSupported), 'authorized');
  });

  group('Firebase Analytics', () {
    test('event parameters: strings and numbers kept, booleans 1/0', () {
      expect(firebaseEventParameters({'a': 'x', 'b': 2, 'c': 1.5, 'd': true, 'e': false}), {'a': 'x', 'b': 2, 'c': 1.5, 'd': 1, 'e': 0});
    });

    test('no native Firebase config: calls throw and the service stays silent', () async {
      final firebase = FlutterFireAnalytics(ensureInitialized: () async => throw StateError('no config'));
      await expectLater(firebase.logEvent('login', const {}), throwsStateError);
      final service = AnalyticsService(
        consent: () => const PrivacyConsent(analytics: true, decidedAt: '2026-01-01T00:00:00Z'),
        firebase: firebase,
      );
      await service.logEvent('login', {'method': 'email'});
      await service.setUserId('u');
      await service.logScreenView('Home');
    });
  });

  group('wiring', () {
    test('off the mobile host every seam keeps its default', () {
      expect(adsAnalyticsSdkWiringOverrides(mobile: false), isEmpty);
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(admobSdkProvider), isNull);
      expect(container.read(firebaseAnalyticsPlatformProvider), isA<NoFirebaseAnalytics>());
      expect(container.read(tiktokEventsPluginProvider), isNull);
      expect(container.read(trackingTransparencyProvider), isA<UnavailableTrackingTransparency>());
    });

    test('on the iOS app the SDK implementations are wired', () async {
      mock('anacan/admob', (call) => call.method == 'appId' ? 'ca-app-pub-1234567890123456~1234567890' : null);
      final container = ProviderContainer(overrides: adsAnalyticsSdkWiringOverrides(mobile: true, ios: true));
      addTearDown(container.dispose);
      expect(container.read(admobSdkProvider), isNotNull);
      expect(container.read(firebaseAnalyticsPlatformProvider), isA<FlutterFireAnalytics>());
      expect(container.read(tiktokEventsPluginProvider), isA<MethodChannelTikTokEvents>());
      expect(container.read(trackingTransparencyProvider), isA<AppTrackingTransparencyPlugin>());
      expect(await container.read(customerIoPluginLoaderProvider)(), isA<MethodChannelCustomerIo>());
      final appId = container.read(compiledAdmobAppIdProvider);
      await pumpEventQueue();
      expect(appId('ios'), 'ca-app-pub-1234567890123456~1234567890');
    });

    test('on Android ATT stays unavailable (the Capacitor plugin is iOS-only)', () {
      final container = ProviderContainer(overrides: adsAnalyticsSdkWiringOverrides(mobile: true, ios: false));
      addTearDown(container.dispose);
      expect(container.read(trackingTransparencyProvider), isA<UnavailableTrackingTransparency>());
    });
  });
}
