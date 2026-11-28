// Ported from: the `@capacitor-firebase/messaging` and `@capacitor/push-notifications` calls of
//              src/hooks/useDeviceToken.ts and src/lib/native.ts (pushNotifications.register)
//
// The remote-push plugins, kept narrow. [PushMessagingPort] is Firebase Messaging (FCM token on iOS and Android);
// [PushFallbackPort] is the Capacitor push plugin the React code fell back to when Firebase Messaging failed. The
// default [WebPushPlatform] is the web build (`isNative` false: nothing is registered, nothing prompts). The native
// step implements [PushMessagingPort] with `firebase_messaging` (+ `firebase_core`); the fallback has no Flutter
// counterpart that is needed (leave it null) unless an APNs-only path is wanted.

/// Push permission as Capacitor reports `receive`: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'.
typedef PushReceive = String;

/// A push received while the app is in the foreground (`notificationReceived`).
class ForegroundPush {
  const ForegroundPush({this.title, this.body, this.data = const {}});
  final String? title;
  final String? body;
  final Map<String, Object?> data;
}

/// `FirebaseMessaging` (every call may throw: plugin missing, bridge failure).
abstract interface class PushMessagingPort {
  Future<PushReceive> checkPermissions();
  Future<PushReceive> requestPermissions();

  /// `getToken().token` (may be empty).
  Future<String?> getToken();
  Future<void> deleteToken();
  Future<void> removeAllDeliveredNotifications();

  /// `tokenReceived`.
  Stream<String> get tokenRefreshes;

  /// `notificationReceived`.
  Stream<ForegroundPush> get foregroundMessages;
}

/// `PushNotifications` (the Capacitor fallback).
abstract interface class PushFallbackPort {
  Future<PushReceive> checkPermissions();
  Future<PushReceive> requestPermissions();

  /// `register()` + the `registration` / `registrationError` listeners: completes with the token, or with an error
  /// carrying the registration error text.
  Future<String> register();
  Future<void> unregister();
  Future<void> removeAllDeliveredNotifications();
}

/// The push plugins of this build.
abstract interface class PushPlatform {
  /// `isNative` of lib/native.ts as the push code sees it.
  bool get isNative;

  /// 'ios' | 'android' | 'web' (`Capacitor.getPlatform()`).
  String get platform;

  /// Firebase Messaging; a [StateError] from its calls means "plugin unavailable" (React's failed import).
  PushMessagingPort get messaging;

  /// The Capacitor push fallback; null = not in this build (the fallback branch fails like a failed import).
  PushFallbackPort? get fallback;
}

class _UnavailableMessaging implements PushMessagingPort {
  const _UnavailableMessaging();
  static Never _fail() => throw StateError('push messaging is not available');
  @override
  Future<PushReceive> checkPermissions() async => _fail();
  @override
  Future<PushReceive> requestPermissions() async => _fail();
  @override
  Future<String?> getToken() async => _fail();
  @override
  Future<void> deleteToken() async => _fail();
  @override
  Future<void> removeAllDeliveredNotifications() async => _fail();
  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
  @override
  Stream<ForegroundPush> get foregroundMessages => const Stream.empty();
}

/// The web build: no push plugins.
class WebPushPlatform implements PushPlatform {
  const WebPushPlatform();
  @override
  bool get isNative => false;
  @override
  String get platform => 'web';
  @override
  PushMessagingPort get messaging => const _UnavailableMessaging();
  @override
  PushFallbackPort? get fallback => null;
}
