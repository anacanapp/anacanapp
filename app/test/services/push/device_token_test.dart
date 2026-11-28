// Ported from: src/hooks/useDeviceToken.logout.test.ts (group 'logout'); the 'registration' group covers the rest
// of useDeviceToken.ts (no vitest file in React).
import 'dart:async';

import 'package:anacan/domain/js_compat.dart' show jsToIsoString;
import 'package:anacan/services/push/device_token.dart';
import 'package:anacan/services/push/push_platform.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_push.dart';

void main() {
  late FakePushPlatform platform;
  late FakeDeviceTokenRepository repo;
  late LocalStore store;
  late RecordingToasts toasts;
  late List<String> bound;
  late DateTime now;
  late DeviceTokenService service;

  DeviceTokenService build() => DeviceTokenService(
        platform: platform,
        repository: repo,
        store: store,
        toasts: toasts,
        bindLocalNotificationOwner: (id) async => bound.add(id),
        deviceDescription: 'Anacan-Flutter (ios 18.1) and a very long tail that is cut at fifty chars',
        clock: () => now,
      );

  setUp(() {
    platform = FakePushPlatform(fallback: FakeFallback());
    repo = FakeDeviceTokenRepository();
    store = LocalStore.memory();
    toasts = RecordingToasts();
    bound = [];
    now = DateTime(2026, 11, 25, 9, 0);
    service = build();
  });

  group('logout', () {
    test('deletes only this device row for this account, then drops the FCM token', () async {
      await service.unregisterDeviceForLogout('user-a');
      expect(repo.deviceDeletes, [
        {'user_id': 'user-a', 'token': 'fcm-token-fixture'}
      ]);
      expect(platform.messaging.deleteTokenCalls, 1);
    });

    test('never prompts for push permission during logout', () async {
      platform.messaging.receive = 'prompt';
      await service.unregisterDeviceForLogout('user-a');
      expect(platform.messaging.getTokenCalls, 0);
      expect(platform.messaging.requestCalls, 0);
      expect(repo.deviceDeletes, isEmpty);
    });

    test('falls back to the push plugin unregister when Firebase Messaging is unavailable', () async {
      platform.messaging.deleteTokenError = StateError('unavailable');
      await service.unregisterDeviceForLogout('user-a');
      expect(platform.fallback!.unregisterCalls, 1);
    });

    test('uses the token committed for this account without asking the plugin', () async {
      service.committedDeviceToken = (token: 'committed', userId: 'user-a');
      await service.unregisterDeviceForLogout('user-a');
      expect(platform.messaging.checkCalls, 0);
      expect(repo.deviceDeletes.single['token'], 'committed');
      expect(service.committedDeviceToken, isNull);
      expect(platform.messaging.removeDeliveredCalls, 1);
    });

    test('is bounded when the bridge hangs', () async {
      platform.messaging.failWith = null;
      final hang = Completer<String>();
      final slow = _HangingMessaging(hang.future);
      final s = DeviceTokenService(
          platform: _Platform(slow), repository: repo, store: store, deviceDescription: 'x', clock: () => now);
      await s.unregisterDeviceForLogout('user-a', const Duration(milliseconds: 10)).timeout(const Duration(seconds: 2));
      expect(repo.deviceDeletes, isEmpty);
    });

    test('does nothing native on the web', () async {
      platform.isNative = false;
      await service.unregisterDeviceForLogout('user-a');
      expect(platform.messaging.checkCalls, 0);
      expect(platform.messaging.deleteTokenCalls, 0);
    });
  });

  group('registration', () {
    const oldUser = DeviceTokenUser(id: 'user-a', createdAt: '2026-01-01T00:00:00Z');

    test('saves the FCM token with a safe upsert and removes stale tokens of this platform afterwards', () async {
      expect(await service.registerDevice(oldUser), 'fcm-token-fixture');
      expect(repo.upserts.single, {
        'user_id': 'user-a',
        'token': 'fcm-token-fixture',
        'platform': 'ios',
        'device_name': 'ios - Anacan-Flutter (ios 18.1) and a very long tail tha',
        'updated_at': jsToIsoString(now),
      });
      expect(repo.staleDeletes.single, {'user_id': 'user-a', 'platform': 'ios', 'keep': 'fcm-token-fixture'});
      expect(service.committedDeviceToken, (token: 'fcm-token-fixture', userId: 'user-a'));
      expect(service.token, 'fcm-token-fixture');
      expect(service.loading, isFalse);
      // A second call in the same session does not register again.
      expect(await service.registerDevice(oldUser), 'fcm-token-fixture');
      expect(repo.upserts, hasLength(1));
      expect(toasts.shown, isEmpty);
    });

    test('re-saves a refreshed token and shows foreground pushes as a toast', () async {
      await service.registerDevice(oldUser);
      platform.messaging.refresh.add('fresh');
      await Future<void>.delayed(Duration.zero);
      expect(repo.upserts.last['token'], 'fresh');
      platform.messaging.foreground.add(const ForegroundPush(title: '', body: 'Salam'));
      expect(toasts.shown.single.title, 'Yeni bildiriş');
      expect(toasts.shown.single.description, 'Salam');
    });

    test('never prompts at start: an older account that never allowed gets one explaining toast a day', () async {
      platform.messaging.receive = 'prompt';
      expect(await service.registerDevice(oldUser), isNull);
      expect(service.error, 'Push notification permission denied');
      expect(platform.messaging.requestCalls, 0);
      final toast = toasts.shown.single;
      expect(toast.title, 'Bildirişlərə icazə verin');
      expect(toast.actionLabel, 'İcazə ver');
      expect(toast.duration, const Duration(milliseconds: 12000));
      expect(store.getItem(lastPushPromptDateKey), 'Wed Nov 25 2026');

      // "Allow" opens the OS prompt; a grant registers the device at once.
      service.userChanged(oldUser);
      toast.onAction!();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(platform.messaging.requestCalls, 1);
      expect(repo.upserts, isNotEmpty);

      // The same day: no second toast.
      final again = build();
      platform.messaging.receive = 'prompt';
      await again.registerDevice(oldUser);
      expect(toasts.shown, hasLength(1));
    });

    test('points to the device settings after a denial and stays silent for new accounts', () async {
      platform.messaging.receive = 'denied';
      await service.registerDevice(oldUser);
      expect(toasts.shown.single.actionLabel, isNull);
      expect(toasts.shown.single.duration, const Duration(milliseconds: 8000));

      store.removeItem(lastPushPromptDateKey);
      final fresh = build();
      await fresh.registerDevice(DeviceTokenUser(id: 'user-b', createdAt: now.subtract(const Duration(hours: 2)).toUtc().toIso8601String()));
      expect(toasts.shown, hasLength(1));
    });

    test('falls back to the push plugin when Firebase Messaging fails', () async {
      platform.messaging.failWith = StateError('no firebase');
      expect(await service.registerDevice(oldUser), 'apns-fallback-token');
      expect(repo.upserts.single['token'], 'apns-fallback-token');
    });

    test('a fallback registration error or timeout leaves no token', () async {
      platform.messaging.failWith = StateError('no firebase');
      platform.fallback!.onRegister = () async => throw StateError('Registration failed hard');
      expect(await service.registerDevice(oldUser), isNull);
      expect(service.error, 'Registration failed hard');

      final slow = DeviceTokenService(
          platform: platform, repository: repo, store: store, deviceDescription: 'x', clock: () => now, fallbackTimeout: const Duration(milliseconds: 5));
      platform.fallback!.onRegister = () => Completer<String>().future;
      expect(await slow.registerDevice(oldUser), isNull);
      expect(repo.upserts, isEmpty);
    });

    test('without any push plugin the error is the original one', () async {
      platform.messaging.failWith = StateError('no firebase');
      platform.fallback = null;
      expect(await service.registerDevice(oldUser), isNull);
      expect(service.error, 'no firebase');
    });

    test('a user change binds the reminders and registers; another account registers again', () async {
      service.userChanged(oldUser);
      await Future<void>.delayed(Duration.zero);
      expect(bound, ['user-a']);
      expect(repo.upserts, hasLength(1));
      service.userChanged(const DeviceTokenUser(id: 'user-b', createdAt: '2026-01-01T00:00:00Z'));
      await Future<void>.delayed(Duration.zero);
      expect(bound, ['user-a', 'user-b']);
      expect(repo.upserts.last['user_id'], 'user-b');
      service.userChanged(null);
      expect(service.token, isNull);
    });

    test('the tour grant registers this device now', () async {
      platform.messaging.receive = 'denied';
      service.userChanged(oldUser);
      await Future<void>.delayed(Duration.zero);
      expect(repo.upserts, isEmpty);
      platform.messaging.receive = 'granted';
      service.pushGranted();
      await Future<void>.delayed(Duration.zero);
      expect(repo.upserts, hasLength(1));
    });

    test('does nothing on the web', () async {
      platform.isNative = false;
      service.userChanged(oldUser);
      expect(await service.registerDevice(oldUser), isNull);
      expect(bound, isEmpty);
      expect(platform.messaging.checkCalls, 0);
    });

    test('unregisterDevice forgets the token and allows a new registration', () async {
      service.userChanged(oldUser);
      await Future<void>.delayed(Duration.zero);
      await service.unregisterDevice();
      expect(repo.deviceDeletes.single, {'user_id': 'user-a', 'token': 'fcm-token-fixture'});
      expect(service.token, isNull);
      expect(await service.registerDevice(oldUser), 'fcm-token-fixture');
    });

    test('formats the daily prompt date like Date.toDateString', () {
      expect(jsDateString(DateTime(2026, 1, 4)), 'Sun Jan 04 2026');
    });
  });
}

class _HangingMessaging implements PushMessagingPort {
  _HangingMessaging(this._never);
  final Future<String> _never;
  @override
  Future<String> checkPermissions() => _never;
  @override
  Future<String> requestPermissions() => _never;
  @override
  Future<String?> getToken() => _never;
  @override
  Future<void> deleteToken() => _never;
  @override
  Future<void> removeAllDeliveredNotifications() => _never;
  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
  @override
  Stream<ForegroundPush> get foregroundMessages => const Stream.empty();
}

class _Platform implements PushPlatform {
  _Platform(this.messaging);
  @override
  final PushMessagingPort messaging;
  @override
  bool get isNative => true;
  @override
  String get platform => 'android';
  @override
  PushFallbackPort? get fallback => null;
}
