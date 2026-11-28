// Ported from: src/components/CustomerIoSession.test.tsx
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/services/analytics/customerio.dart';
import 'package:anacan/services/analytics/customerio_session.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const backend = 'https://backend.example.test';

class RecordingTracker extends CustomerIoTracking {
  RecordingTracker() : super(const CustomerIoConfig(environment: 'sandbox'), () async => throw StateError('unused'));
  final List<CustomerIoIdentity?> calls = [];
  @override
  Future<void> setIdentity(CustomerIoIdentity? identity) async => calls.add(identity);
}

class UserState extends Notifier<String?> {
  @override
  String? build() => null;
  void set(String? id) => state = id;
}

final userState = NotifierProvider<UserState, String?>(UserState.new);

class Harness {
  final tracker = RecordingTracker();
  final preferenceCalls = <String>[];
  Future<bool> Function(String actor) preference = (_) async => true;
  bool enabled = true;
  late ProviderContainer container;

  Future<void> mount(WidgetTester tester, {String? user}) async {
    final client = QueryClient();
    container = ProviderContainer(overrides: [
      queryClientProvider.overrideWithValue(client),
      customerIoProvider.overrideWithValue(tracker),
      customerIoConfigProvider.overrideWithValue(enabled ? const CustomerIoConfig(environment: 'sandbox') : null),
      customerIoPreferenceReaderProvider.overrideWithValue((actor) {
        preferenceCalls.add(actor);
        return preference(actor);
      }),
      customerIoSessionInputsProvider.overrideWith((ref) => (userId: ref.watch(userState), backend: backend, language: 'az')),
    ]);
    container.read(userState.notifier).set(user);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const CustomerIoSessionHost()));
    await tester.pump();
  }

  Future<void> setUser(WidgetTester tester, String? id) async {
    container.read(userState.notifier).set(id);
    await tester.pump();
    await tester.pump();
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    container.dispose();
    await tester.pump(const Duration(days: 8));
  }
}

void sessionTest(String description, Future<void> Function(WidgetTester tester, Harness h) body) {
  testWidgets(description, (tester) async {
    final h = Harness();
    await body(tester, h);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(days: 8));
  });
}

void main() {
  group('Customer.io existing auth lifecycle', () {
    sessionTest('identifies a restored session only after its analytics preference is loaded', (tester, h) async {
      await h.mount(tester, user: 'integration-test-restored');
      expect(h.tracker.calls.first, isNull);
      await tester.pump();
      expect(h.tracker.calls.last, const CustomerIoIdentity(userId: 'integration-test-restored', backend: backend, language: 'az', consent: true));
      await h.unmount(tester);
      expect(h.tracker.calls.last, isNull);
    });

    sessionTest('identifies after login and clears identity on logout', (tester, h) async {
      await h.mount(tester);
      expect(h.preferenceCalls, isEmpty);
      await h.setUser(tester, 'integration-test-login');
      expect(h.tracker.calls.last?.userId, 'integration-test-login');
      await h.setUser(tester, null);
      expect(h.tracker.calls.last, isNull);
      await h.unmount(tester);
    });

    sessionTest('does not apply a delayed preference result to another account', (tester, h) async {
      final alice = Completer<bool>();
      h.preference = (actor) => actor == 'integration-test-alice' ? alice.future : Future.value(false);
      await h.mount(tester, user: 'integration-test-alice');
      expect(h.preferenceCalls, contains('integration-test-alice'));
      await h.setUser(tester, 'integration-test-bob');
      alice.complete(true);
      await tester.pump();
      await tester.pump();
      expect(h.tracker.calls.every((identity) => identity == null), isTrue);
      await h.unmount(tester);
    });

    sessionTest('honors live opt-out and ignores events for other accounts', (tester, h) async {
      await h.mount(tester, user: 'integration-test-consent');
      await tester.pump();
      expect(h.tracker.calls.last?.consent, isTrue);
      final events = h.container.read(customerIoConsentEventsProvider);
      events.dispatch((userId: 'different-user', backend: backend, allowed: false));
      await tester.pump();
      expect(h.tracker.calls.last?.consent, isTrue);
      events.dispatch((userId: 'integration-test-consent', backend: backend, allowed: false));
      await tester.pump();
      await tester.pump();
      expect(h.tracker.calls.last, isNull);
      await h.unmount(tester);
    });

    sessionTest('does not fetch preferences or identify on unconfigured/web builds', (tester, h) async {
      h.enabled = false;
      await h.mount(tester, user: 'integration-test-web');
      expect(h.preferenceCalls, isEmpty);
      expect(h.tracker.calls.last, isNull);
      await h.unmount(tester);
    });
  });
}
