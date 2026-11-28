// Ported from: node_modules/@capacitor-firebase/messaging (FirebaseMessagingPlugin: checkPermissions /
//              requestPermissions "receive" — always 'granted' below Android 13 —, getToken, deleteToken,
//              removeAllDeliveredNotifications, tokenReceived, notificationReceived, notificationActionPerformed),
//              capacitor.config.json (`FirebaseMessaging.presentationOptions: ['badge', 'sound', 'alert']`)
//
// [PushPlatform] on firebase_core + firebase_messaging. Firebase reads the committed native config
// (android/app/google-services.json through the Google services Gradle plugin, ios/Runner/GoogleService-Info.plist).
// [FirebaseRuntime] is started from `main()`: it initialises Firebase, sets the iOS foreground presentation and
// collects the tap that launched the app.
import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../native/mobile_host.dart';
// FCM has no "remove delivered" call: the local-notification plugin clears the notification centre.
import '../notifications/flutter_local_notification_backend.dart'
    show FlutterLocalNotificationBackend, androidNotificationPermissionState;
import 'push_platform.dart';

/// Firebase for this process.
class FirebaseRuntime {
  FirebaseRuntime._();
  static final FirebaseRuntime instance = FirebaseRuntime._();

  Future<void>? _ready;

  // Single-subscription so the tap that opened the app waits for the listener installed in main().
  final StreamController<Object?> _taps = StreamController<Object?>();
  bool _tapsListened = false;

  /// `notificationActionPerformed` → `notification.data`.
  Stream<Object?> get taps {
    if (_tapsListened) return const Stream.empty();
    _tapsListened = true;
    return _taps.stream;
  }

  /// `Firebase.initializeApp()` once; throws when the native config is missing (push then counts as unavailable).
  Future<void> ensureInitialized() => _ready ??= _init().catchError((Object e) {
        _ready = null;
        throw e;
      });

  Future<void> _init() async {
    await Firebase.initializeApp();
    final messaging = FirebaseMessaging.instance;
    // presentationOptions: badge, sound, alert while the app is in the foreground (iOS; Android ignores it).
    await messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _taps.add(m.data));
    final initial = await messaging.getInitialMessage();
    if (initial != null) _taps.add(initial.data);
  }
}

String _receive(AuthorizationStatus status) => switch (status) {
      AuthorizationStatus.authorized || AuthorizationStatus.provisional => 'granted',
      AuthorizationStatus.denied || AuthorizationStatus.deniedPermanently => 'denied',
      AuthorizationStatus.notDetermined => 'prompt',
    };

/// [PushMessagingPort] over firebase_messaging.
class FirebasePushMessaging implements PushMessagingPort {
  FirebasePushMessaging([FirebaseRuntime? runtime]) : _runtime = runtime ?? FirebaseRuntime.instance;
  final FirebaseRuntime _runtime;

  Future<FirebaseMessaging> _messaging() async {
    await _runtime.ensureInitialized();
    return FirebaseMessaging.instance;
  }

  @override
  Future<PushReceive> checkPermissions() async {
    final m = await _messaging();
    if (isAndroidHost) {
      if (await androidSdkInt() < 33) return 'granted';
      return androidNotificationPermissionState();
    }
    return _receive((await m.getNotificationSettings()).authorizationStatus);
  }

  @override
  Future<PushReceive> requestPermissions() async {
    final m = await _messaging();
    if (isAndroidHost) {
      if (await androidSdkInt() < 33) return 'granted';
      if (await androidNotificationPermissionState() != 'granted') await m.requestPermission();
      return androidNotificationPermissionState();
    }
    final settings = await m.requestPermission(alert: true, badge: true, sound: true);
    return _receive(settings.authorizationStatus);
  }

  @override
  Future<String?> getToken() async {
    final m = await _messaging();
    if (isIOSHost) {
      // The FCM token needs the APNs token; the plugin registers for remote notifications at launch.
      for (var i = 0; i < 20 && await m.getAPNSToken() == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
      }
    }
    // The FCM registration token, as Capacitor's getToken(): the backend sends to `device_tokens.token` with FCM v1
    // `message.token` (the FID of the new register() API is not a registration token).
    // ignore: deprecated_member_use
    return m.getToken();
  }

  @override
  // ignore: deprecated_member_use
  Future<void> deleteToken() async => (await _messaging()).deleteToken();

  /// Delivered pushes leave the notification centre (logout); local reminders were reset before.
  @override
  Future<void> removeAllDeliveredNotifications() async {
    await _runtime.ensureInitialized();
    await FlutterLocalNotificationBackend().removeAllDelivered();
  }

  @override
  Stream<String> get tokenRefreshes async* {
    await _runtime.ensureInitialized();
    // ignore: deprecated_member_use
    yield* FirebaseMessaging.instance.onTokenRefresh;
  }

  @override
  Stream<ForegroundPush> get foregroundMessages async* {
    await _runtime.ensureInitialized();
    yield* FirebaseMessaging.onMessage.map((m) => ForegroundPush(
          title: m.notification?.title,
          body: m.notification?.body,
          data: Map<String, Object?>.from(m.data),
        ));
  }
}

/// The app build on iOS / Android.
class FirebasePushPlatform implements PushPlatform {
  FirebasePushPlatform({required this.platform});
  @override
  final String platform;
  @override
  bool get isNative => true;
  @override
  final PushMessagingPort messaging = FirebasePushMessaging();

  /// No APNs-only fallback in this build (the fallback branch fails like a failed import).
  @override
  PushFallbackPort? get fallback => null;
}

@visibleForTesting
String receiveFromAuthorization(AuthorizationStatus status) => _receive(status);
