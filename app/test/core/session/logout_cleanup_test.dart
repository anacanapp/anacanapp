// Ported from: src/lib/logout-cleanup.test.ts
//
// The vitest mocks of LocalNotifications/useDeviceToken become injected steps.

import 'dart:async';

import 'package:anacan/core/session/logout_cleanup.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late List<int> pending;
  late List<List<int>> cancelled;
  late int removedDelivered;
  late List<(String, Duration)> unregistered;
  late Future<List<int>> Function() getPending;
  late Future<void> Function(String, Duration) unregister;

  LogoutCleanupSteps steps() => LogoutCleanupSteps(
        cancelAllLocalNotifications: () async {
          final ids = await getPending();
          cancelled.add(ids);
          removedDelivered++;
        },
        unregisterDeviceForLogout: (userId, timeout) {
          unregistered.add((userId, timeout));
          return unregister(userId, timeout);
        },
      );

  setUp(() {
    pending = [11, 42];
    cancelled = [];
    removedDelivered = 0;
    unregistered = [];
    getPending = () async => pending;
    unregister = (_, _) async {};
  });

  test('cancels every pending reminder and unregisters this device for the signed-out account', () async {
    await runLogoutCleanup('user-a', steps());
    expect(cancelled, [
      [11, 42]
    ]);
    expect(removedDelivered, 1);
    expect(unregistered.single.$1, 'user-a');
  });

  test('never throws when a step fails', () async {
    getPending = () async => throw Exception('bridge');
    unregister = (_, _) async => throw Exception('network');
    await expectLater(runLogoutCleanup('user-a', steps()), completes);
  });

  test('is bounded when a native bridge or request hangs', () async {
    getPending = () => Completer<List<int>>().future;
    unregister = (_, _) => Completer<void>().future;
    var done = false;
    unawaited(runLogoutCleanup('user-a', steps(), timeout: const Duration(milliseconds: 10))
        .then((_) => done = true));
    // 10 ms step bound + 1.5 s outer margin.
    await Future<void>.delayed(const Duration(milliseconds: 1600));
    expect(done, isTrue);
  });

  test('does nothing to local notifications on the web', () async {
    var asked = false;
    getPending = () async {
      asked = true;
      return pending;
    };
    await runLogoutCleanup(null, steps(), isNativePlatform: false);
    expect(asked, isFalse);
    expect(unregistered, isEmpty);
  });
}
