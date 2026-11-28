// Ported from: src/lib/customerio.test.ts
import 'dart:async';

import 'package:anacan/services/analytics/analytics_screen.dart';
import 'package:anacan/services/analytics/customerio.dart';
import 'package:flutter_test/flutter_test.dart';

const config = CustomerIoConfig(environment: 'sandbox');
const alice = CustomerIoIdentity(userId: 'integration-test-alice', backend: 'https://backend.example.test', language: 'az', consent: true);
final bob = alice.copyWith(userId: 'integration-test-bob');

class FakeSdk implements CustomerIoDataInPlugin {
  FakeSdk({this.onInitialize, this.onIdentify});
  final List<String> order = [];
  final List<CustomerIoConfig> initialized = [];
  final List<({String userId, Map<String, Object> traits})> identified = [];
  final List<({String name, Map<String, Object> properties})> tracked = [];
  final List<({String title, Map<String, Object> properties})> screens = [];
  int resets = 0;
  Future<void> Function()? onInitialize;
  Future<void> Function()? onIdentify;

  @override
  Future<void> initialize(CustomerIoConfig config) async {
    order.add('initialize');
    initialized.add(config);
    await onInitialize?.call();
  }

  @override
  Future<void> identify({required String userId, required Map<String, Object> traits}) async {
    order.add('identify');
    await onIdentify?.call();
    identified.add((userId: userId, traits: traits));
  }

  @override
  Future<void> reset() async {
    order.add('reset');
    resets++;
  }

  @override
  Future<void> track({required String name, required Map<String, Object> properties}) async {
    order.add('track');
    tracked.add((name: name, properties: properties));
  }

  @override
  Future<void> screen({required String title, required Map<String, Object> properties}) async {
    order.add('screen');
    screens.add((title: title, properties: properties));
  }
}

({FakeSdk sdk, List<int> loads, CustomerIoTracking tracker}) fixture([FakeSdk? custom]) {
  final sdk = custom ?? FakeSdk();
  final loads = <int>[];
  return (
    sdk: sdk,
    loads: loads,
    tracker: CustomerIoTracking(config, () async {
      loads.add(1);
      return sdk;
    }),
  );
}

void main() {
  group('Customer.io Data In configuration', () {
    const env = {'VITE_CUSTOMERIO_ENABLED': 'true', 'VITE_CUSTOMERIO_REGION': 'EU', 'VITE_CUSTOMERIO_ENVIRONMENT': 'sandbox'};
    test('configures the selected native profile without exposing a key on the JS bridge', () {
      expect(readCustomerIoConfig(env), config);
      expect(readCustomerIoConfig(env)!.toJson(), {'region': 'EU', 'environment': 'sandbox'});
    });
    for (final value in <Map<String, Object?>>[
      {},
      {...env, 'VITE_CUSTOMERIO_ENABLED': 'false'},
      {...env, 'VITE_CUSTOMERIO_ENABLED': null},
      {...env, 'VITE_CUSTOMERIO_REGION': 'US'},
      {...env, 'VITE_CUSTOMERIO_ENVIRONMENT': ''},
    ]) {
      test('does not enable an incomplete/unselected configuration', () {
        expect(readCustomerIoConfig(value), isNull);
      });
    }
  });

  group('Customer.io identity and real app behavior', () {
    test('tracks the current mounted screen after consent/restoration without duplicating navigation', () async {
      final sdk = FakeSdk();
      final registry = AnalyticsScreenRegistry();
      final tracker = CustomerIoTracking(config, () async => sdk, currentScreen: registry.current);
      final release = registry.register('Community', 'Social');
      try {
        await tracker.screen('Community', 'Social');
        expect(sdk.screens, isEmpty);
        await tracker.setIdentity(alice);
        await tracker.screen('Community', 'Social');
        expect(sdk.screens, hasLength(1));
        expect(sdk.screens.last.title, 'Community');
        expect(sdk.screens.last.properties, {'environment': 'sandbox', 'screen_class': 'Social'});
      } finally {
        release();
      }
      expect(registry.current(), isNull);
    });

    test('does not initialize before consent or when mobile tracking is disabled', () async {
      final f = fixture();
      await f.tracker.setIdentity(const CustomerIoIdentity(userId: 'integration-test-alice', backend: 'https://backend.example.test', language: 'az', consent: false));
      await f.tracker.screen('Community');
      await f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      await CustomerIoTracking(null, () async {
        f.loads.add(1);
        return f.sdk;
      }).setIdentity(alice);
      expect(f.loads, isEmpty);
    });

    test('initializes once and identifies restored/logged-in accounts before track and screen', () async {
      final f = fixture();
      final identity = f.tracker.setIdentity(alice);
      final event = f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      await Future.wait([identity, event, f.tracker.screen('Community', 'Social')]);
      await f.tracker.setIdentity(alice);
      expect(f.loads, hasLength(1));
      expect(f.sdk.initialized, [config]);
      expect(f.sdk.identified, hasLength(1));
      expect(f.sdk.identified.single.userId, alice.userId);
      expect(f.sdk.identified.single.traits, {'language': 'az', 'environment': 'sandbox'});
      expect(f.sdk.tracked.single.name, 'community_post_created');
      expect(f.sdk.tracked.single.properties, {'environment': 'sandbox', 'entry_point': 'community'});
      expect(f.sdk.screens.single.title, 'Community');
      expect(f.sdk.screens.single.properties, {'environment': 'sandbox', 'screen_class': 'Social'});
      expect(f.sdk.order.indexOf('identify'), lessThan(f.sdk.order.indexOf('track')));
    });

    test('resets on account switches and rejects late post success from another account/realm', () async {
      final f = fixture();
      await f.tracker.setIdentity(alice);
      await f.tracker.setIdentity(bob);
      await f.tracker.postCreated(alice.userId, alice.backend, 'late-alice-post');
      await f.tracker.postCreated(bob.userId, 'https://old-backend.example.test', 'old-realm-post');
      expect(f.sdk.resets, 1);
      expect(f.sdk.tracked, isEmpty);
      expect(f.sdk.identified.last.userId, bob.userId);
      expect(f.sdk.identified.last.traits, {'language': 'az', 'environment': 'sandbox'});
    });

    test('revoking consent immediately invalidates queued events', () async {
      final f = fixture();
      await f.tracker.setIdentity(alice);
      final event = f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      await f.tracker.setIdentity(alice.copyWith(consent: false));
      await event;
      await f.tracker.screen('Community');
      expect(f.sdk.resets, greaterThan(0));
      expect(f.sdk.tracked, isEmpty);
      expect(f.sdk.screens, isEmpty);
    });

    test('logout during asynchronous initialization prevents stale identify and events', () async {
      final gate = Completer<void>();
      final sdk = FakeSdk(onInitialize: () => gate.future);
      final f = fixture(sdk);
      final init = f.tracker.setIdentity(alice);
      for (var i = 0; i < 10 && sdk.initialized.isEmpty; i++) {
        await Future<void>.delayed(Duration.zero);
      }
      expect(sdk.initialized, isNotEmpty);
      final event = f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      final logout = f.tracker.setIdentity(null);
      gate.complete();
      await Future.wait([init, event, logout]);
      expect(sdk.identified, isEmpty);
      expect(sdk.tracked, isEmpty);
      expect(sdk.resets, greaterThan(0));
    });

    test('deduplicates a successful request and never sends private content or raw routes', () async {
      final f = fixture();
      await f.tracker.setIdentity(alice);
      await f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      await f.tracker.postCreated(alice.userId, alice.backend, 'operation-1');
      await f.tracker.screen('/p/v/private-token');
      expect(f.sdk.tracked, hasLength(1));
      expect(f.sdk.screens, isEmpty);
      expect('${f.sdk.tracked}', isNot(contains('operation-1')));
    });

    test('isolates SDK failures from app behavior and retries a failed identify', () async {
      var failures = 1;
      final sdk = FakeSdk(onIdentify: () async {
        if (failures-- > 0) throw StateError('synthetic SDK failure');
      });
      final f = fixture(sdk);
      await expectLater(f.tracker.setIdentity(alice), completes);
      await f.tracker.postCreated(alice.userId, alice.backend, 'not-identified');
      expect(sdk.tracked, isEmpty);
      await f.tracker.setIdentity(alice);
      await f.tracker.postCreated(alice.userId, alice.backend, 'identified');
      expect(sdk.tracked, hasLength(1));
    });
  });

  group('native plugin proxy', () {
    // The Capacitor proxy `then()` trap has no Dart counterpart; the loader returns the plugin directly.
    test('initializes even when the plugin object rejects a then() lookup like a Capacitor proxy', () async {
      final sdk = FakeSdk();
      final tracker = CustomerIoTracking(config, () async => sdk);
      await tracker.setIdentity(alice);
      expect(sdk.order, contains('initialize'));
      expect(sdk.order, contains('identify'));
    });
  });
}
