// Fakes of the push plugins and the device_tokens table (the vitest mocks of @capacitor-firebase/messaging,
// @capacitor/push-notifications and the supabase `from('device_tokens')` chain).
import 'dart:async';

import 'package:anacan/services/push/device_token.dart';
import 'package:anacan/services/push/push_platform.dart';

class FakeMessaging implements PushMessagingPort {
  String receive = 'granted';
  String? token = 'fcm-token-fixture';
  Object? failWith;
  Object? deleteTokenError;
  int checkCalls = 0, requestCalls = 0, getTokenCalls = 0, deleteTokenCalls = 0, removeDeliveredCalls = 0;
  final refresh = StreamController<String>.broadcast(sync: true);
  final foreground = StreamController<ForegroundPush>.broadcast(sync: true);

  void _maybeFail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<String> checkPermissions() async {
    checkCalls++;
    _maybeFail();
    return receive;
  }

  @override
  Future<String> requestPermissions() async {
    requestCalls++;
    _maybeFail();
    receive = 'granted';
    return receive;
  }

  @override
  Future<String?> getToken() async {
    getTokenCalls++;
    _maybeFail();
    return token;
  }

  @override
  Future<void> deleteToken() async {
    deleteTokenCalls++;
    if (deleteTokenError != null) throw deleteTokenError!;
  }

  @override
  Future<void> removeAllDeliveredNotifications() async => removeDeliveredCalls++;

  @override
  Stream<String> get tokenRefreshes => refresh.stream;

  @override
  Stream<ForegroundPush> get foregroundMessages => foreground.stream;
}

class FakeFallback implements PushFallbackPort {
  String receive = 'granted';
  Future<String> Function() onRegister = () async => 'apns-fallback-token';
  int unregisterCalls = 0, requestCalls = 0, removeDeliveredCalls = 0;

  @override
  Future<String> checkPermissions() async => receive;
  @override
  Future<String> requestPermissions() async {
    requestCalls++;
    return receive = 'granted';
  }

  @override
  Future<String> register() => onRegister();
  @override
  Future<void> unregister() async => unregisterCalls++;
  @override
  Future<void> removeAllDeliveredNotifications() async => removeDeliveredCalls++;
}

class FakePushPlatform implements PushPlatform {
  FakePushPlatform({this.isNative = true, this.platform = 'ios', this.fallback});
  @override
  bool isNative;
  @override
  String platform;
  @override
  final FakeMessaging messaging = FakeMessaging();
  @override
  FakeFallback? fallback;
}

class FakeDeviceTokenRepository implements DeviceTokenRepository {
  final List<Map<String, Object?>> upserts = [];
  final List<Map<String, String>> staleDeletes = [];
  final List<Map<String, String>> deviceDeletes = [];
  Object? upsertError;

  @override
  Future<Object?> upsert(Map<String, Object?> row) async {
    upserts.add(row);
    return upsertError;
  }

  @override
  Future<Object?> deleteStale({required String userId, required String platform, required String keepToken}) async {
    staleDeletes.add({'user_id': userId, 'platform': platform, 'keep': keepToken});
    return null;
  }

  @override
  Future<Object?> deleteDevice({required String userId, required String token}) async {
    deviceDeletes.add({'user_id': userId, 'token': token});
    return null;
  }
}

class RecordedToast {
  RecordedToast(this.title, this.description, this.duration, this.actionLabel, this.onAction);
  final String title;
  final String? description;
  final Duration? duration;
  final String? actionLabel;
  final void Function()? onAction;
}

class RecordingToasts implements PushToastSink {
  final List<RecordedToast> shown = [];
  @override
  void show(String title, {String? description, Duration? duration, String? actionLabel, void Function()? onAction}) =>
      shown.add(RecordedToast(title, description, duration, actionLabel, onAction));
}
