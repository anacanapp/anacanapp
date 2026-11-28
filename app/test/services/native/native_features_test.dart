// Covers src/lib/native.ts initializeNativeFeatures / pushNotifications.register and the platform checks (no vitest
// file in React).
import 'package:anacan/services/native/native_features.dart';
import 'package:anacan/services/native/native_platform.dart';
import 'package:anacan/services/notifications/local_notification_scheduler.dart';
import 'package:anacan/services/notifications/local_reminders.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../notifications/fake_local_notifications.dart';
import '../push/fake_push.dart';

void main() {
  late FakeLocalNotificationBackend os;
  late LocalStore store;
  late LocalNotificationScheduler scheduler;
  late FakePushPlatform push;
  final now = DateTime(2026, 11, 25, 9, 0);

  setUp(() {
    os = FakeLocalNotificationBackend();
    store = LocalStore.memory();
    scheduler = LocalNotificationScheduler(store: store, backend: os, clock: () => now);
    push = FakePushPlatform(fallback: FakeFallback());
  });

  Future<void> init({bool native = true, bool autoAndroid = false, VoidCallback Function(VoidCallback)? listen}) => initializeNativeFeatures(
        isNative: native,
        push: push,
        store: store,
        reminders: LocalReminders(scheduler, isNative: native, clock: () => now),
        scheduler: scheduler,
        listenResume: listen ?? (cb) => () {},
        autoRegisterOnAndroid: autoAndroid,
      );

  test('platform checks follow the app platform', () {
    expect(const NativePlatform(platform: 'ios').isNative, isTrue);
    expect(const NativePlatform(platform: 'android').isAndroid, isTrue);
    expect(const NativePlatform(platform: 'web').isNative, isFalse);
  });

  test('schedules the daily water reminder unless switched off, and installs the re-planner', () async {
    var listened = false;
    await init(listen: (cb) {
      listened = true;
      return () {};
    });
    expect(os.pendingKeys, [waterNotificationId]);
    expect(listened, isTrue);
    expect(push.messaging.getTokenCalls, 1); // iOS: token read silently when allowed
    expect(push.messaging.requestCalls, 0);
  });

  test('respects the persisted water switch', () async {
    store.setItem(waterReminderEnabledKey, 'false');
    await init();
    expect(os.pending, isEmpty);
  });

  test('does nothing on the web', () async {
    await init(native: false);
    expect(os.scheduleCalls, isEmpty);
    expect(push.messaging.checkCalls, 0);
  });

  test('never prompts for push at start; Android registers only when enabled at build time', () async {
    push.messaging.receive = 'prompt';
    await registerPushAtStart(push);
    expect(push.messaging.requestCalls, 0);
    expect(push.messaging.getTokenCalls, 0);

    push
      ..platform = 'android'
      ..messaging.receive = 'granted';
    await registerPushAtStart(push, autoRegisterOnAndroid: false);
    expect(push.messaging.checkCalls, 1);
    await registerPushAtStart(push, autoRegisterOnAndroid: true);
    expect(push.messaging.getTokenCalls, 1);
  });

  test('falls back to the push plugin when Firebase Messaging fails', () async {
    var registered = 0;
    push.messaging.failWith = StateError('no firebase');
    push.fallback!.onRegister = () async {
      registered++;
      return 't';
    };
    await registerPushAtStart(push);
    expect(registered, 1);
  });
}
