// Ported from: src/hooks/useDeviceToken.ts (showPermissionToast, unregisterDeviceForLogout, saveTokenToDatabase,
//              registerDevice with the Firebase Messaging path and the Capacitor push fallback, unregisterDevice, the
//              PUSH_GRANTED_EVENT listener and the user-change effect)
//
// Registers this device's FCM token in `device_tokens` for the signed-in account. It never shows the OS prompt at
// app start: new accounts (< 24 h) are asked by onboarding / the tour; older accounts that never allowed get one
// explaining toast a day ("Allow" opens the OS prompt). Logout removes this device's row while the session still
// exists and drops the token. React kept the committed token in module state; [DeviceTokenService] is the one
// process instance (deviceTokenServiceProvider). Toasts go to [PushToastSink] (set by the host widget).
import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../../core/data/db.dart';
import '../../core/i18n/tr.dart';
import '../../domain/js_compat.dart' show jsToIsoString;
import '../../features/onboarding/onboarding_tour.dart' show isNewAccount;
import '../../state/local_store.dart';
import 'push_platform.dart';

/// localStorage key of the daily permission toast.
const String lastPushPromptDateKey = 'last_push_prompt_date';

/// The signed-in user as the hook reads it (`useAuth().user`).
@immutable
class DeviceTokenUser {
  const DeviceTokenUser({required this.id, this.createdAt});
  final String id;

  /// `user.created_at` (ISO).
  final String? createdAt;
}

/// The `device_tokens` writes. Each returns the PostgREST error (null on success) like `{ error }`.
abstract interface class DeviceTokenRepository {
  /// `upsert(row, { onConflict: 'token' })`.
  Future<Object?> upsert(Map<String, Object?> row);

  /// `delete().eq('user_id').eq('platform').neq('token', keep)`.
  Future<Object?> deleteStale({required String userId, required String platform, required String keepToken});

  /// `delete().eq('user_id').eq('token')`.
  Future<Object?> deleteDevice({required String userId, required String token});
}

class SupabaseDeviceTokenRepository implements DeviceTokenRepository {
  SupabaseDeviceTokenRepository(this.db);
  final Db db;

  @override
  Future<Object?> upsert(Map<String, Object?> row) async =>
      (await db.query(() => db.from('device_tokens').upsert(row, onConflict: 'token'))).error;

  @override
  Future<Object?> deleteStale({required String userId, required String platform, required String keepToken}) async =>
      (await db.query(() => db.from('device_tokens').delete().eq('user_id', userId).eq('platform', platform).neq('token', keepToken))).error;

  @override
  Future<Object?> deleteDevice({required String userId, required String token}) async =>
      (await db.query(() => db.from('device_tokens').delete().eq('user_id', userId).eq('token', token))).error;
}

/// sonner `toast(title, { description, duration, action })`.
abstract interface class PushToastSink {
  void show(String title, {String? description, Duration? duration, String? actionLabel, VoidCallback? onAction});
}

class NoPushToasts implements PushToastSink {
  const NoPushToasts();
  @override
  void show(String title, {String? description, Duration? duration, String? actionLabel, VoidCallback? onAction}) {}
}

const List<String> _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const List<String> _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// `new Date().toDateString()` ("Wed Nov 25 2026").
String jsDateString(DateTime d) =>
    '${_weekdays[d.weekday - 1]} ${_months[d.month - 1]} ${d.day.toString().padLeft(2, '0')} ${d.year.toString().padLeft(4, '0')}';

/// `navigator.userAgent` stand-in for `device_name`.
String defaultDeviceDescription() {
  try {
    return 'Anacan-Flutter (${Platform.operatingSystem} ${Platform.operatingSystemVersion})';
  } catch (_) {
    return 'Anacan-Flutter';
  }
}

Future<T?> _settleWithin<T>(Future<T> Function() work, Duration limit) {
  final done = Completer<T?>();
  final timer = Timer(limit, () {
    if (!done.isCompleted) done.complete(null);
  });
  Future<T>.sync(work).then((v) {
    if (!done.isCompleted) done.complete(v);
  }, onError: (Object _) {
    if (!done.isCompleted) done.complete(null);
  });
  return done.future.whenComplete(timer.cancel);
}

String _messageOf(Object err, String fallback) {
  try {
    final dynamic d = err;
    final m = d.message;
    if (m is String && m.isNotEmpty) return m;
  } catch (_) {}
  return fallback;
}

class DeviceTokenService extends ChangeNotifier {
  DeviceTokenService({
    required this.platform,
    required this.repository,
    required this.store,
    this.toasts = const NoPushToasts(),
    this.bindLocalNotificationOwner,
    String? deviceDescription,
    DateTime Function()? clock,
    this.fallbackTimeout = const Duration(seconds: 15),
  })  : deviceDescription = deviceDescription ?? defaultDeviceDescription(),
        _clock = clock ?? DateTime.now;

  final PushPlatform platform;
  final DeviceTokenRepository repository;
  final LocalStore store;

  /// Where the permission / foreground toasts go (the host widget sets the root toaster).
  PushToastSink toasts;

  /// `bindLocalNotificationOwner(user.id)` of the local-notification scheduler.
  final Future<void> Function(String userId)? bindLocalNotificationOwner;
  final String deviceDescription;
  final Duration fallbackTimeout;
  final DateTime Function() _clock;

  String? _token;
  bool _loading = false;
  String? _error;
  bool _registrationAttempted = false;
  String? _registeredUserId;
  DeviceTokenUser? _user;

  /// The token this device last committed for an account (module state in React).
  ({String token, String userId})? committedDeviceToken;

  List<StreamSubscription<Object?>> _listeners = [];

  String? get token => _token;
  bool get loading => _loading;
  String? get error => _error;
  bool get isNative => platform.isNative;
  bool get isIOS => platform.platform == 'ios';
  bool get isAndroid => platform.platform == 'android';

  void _set({Object? token = _keep, bool? loading, Object? error = _keep}) {
    if (!identical(token, _keep)) _token = token as String?;
    if (loading != null) _loading = loading;
    if (!identical(error, _keep)) _error = error as String?;
    notifyListeners();
  }

  void _replaceListeners(List<StreamSubscription<Object?>> next) {
    final previous = _listeners;
    _listeners = next;
    for (final s in previous) {
      unawaited(s.cancel().catchError((Object _) {}));
    }
  }

  /// Explains why before the OS prompt. 'prompt' (never asked): "Allow" opens the OS prompt. 'denied': the OS no
  /// longer prompts, so it points to the device settings.
  void _showPermissionToast(String receive, Future<void> Function() ask) {
    final title = tr('usedevicetoken_bildirislere_icaze_verin', 'Bildirişlərə icazə verin');
    if (receive == 'denied') {
      toasts.show(title,
          description: tr('usedevicetoken_bildiris_izah',
              'Vacib məlumatları və xatırlatmaları almaq üçün cihaz ayarlarından tətbiqə bildiriş göndərməyə icazə verin.'),
          duration: const Duration(milliseconds: 8000));
      return;
    }
    if (receive != 'prompt' && receive != 'prompt-with-rationale') return;
    toasts.show(
      title,
      description: tr('pushperm_reason', 'Peyvənd və digər xatırlatmaları, yeni mesajları vaxtında almaq üçün bildirişlərə icazə verin.'),
      duration: const Duration(milliseconds: 12000),
      actionLabel: tr('pushperm_allow', 'İcazə ver'),
      onAction: () => unawaited(ask().catchError((Object _) {})),
    );
  }

  void _maybeAskDaily(DeviceTokenUser user, String receive, Future<String> Function() request) {
    final now = _clock();
    final today = jsDateString(now);
    final lastPrompt = store.getItem(lastPushPromptDateKey);
    if (receive != 'granted' && !isNewAccount(user.createdAt, now.millisecondsSinceEpoch) && lastPrompt != today) {
      store.setItem(lastPushPromptDateKey, today);
      _showPermissionToast(receive, () async {
        final result = await request();
        if (result == 'granted') pushGranted();
      });
    }
  }

  /// `saveTokenToDatabase`: safe upsert; other tokens are deleted only after the new one is committed.
  Future<bool> saveTokenToDatabase(String deviceToken, String userId) async {
    try {
      final platformValue = platform.platform == 'ios' ? 'ios' : 'android';
      final deviceName = '${platform.platform} - ${deviceDescription.substring(0, math.min(50, deviceDescription.length))}';
      // Upsert on `token` (unique): a device previously bound to another profile moves to this user.
      final upsertError = await repository.upsert({
        'user_id': userId,
        'token': deviceToken,
        'platform': platformValue,
        'device_name': deviceName,
        'updated_at': jsToIsoString(_clock()),
      });
      if (upsertError != null) {
        debugPrint('[DeviceToken] Upsert error: $upsertError');
        return false;
      }
      // Clean up stale tokens for this user on this platform (different token strings).
      final cleanupError = await repository.deleteStale(userId: userId, platform: platformValue, keepToken: deviceToken);
      if (cleanupError != null) debugPrint('[DeviceToken] Stale-token cleanup warning: $cleanupError');
      committedDeviceToken = (token: deviceToken, userId: userId);
      return true;
    } catch (err) {
      debugPrint('[DeviceToken] Exception saving token: $err');
      return false;
    }
  }

  /// `registerDevice()`: the FCM token through Firebase Messaging, else the push fallback.
  Future<String?> registerDevice(DeviceTokenUser? user) async {
    if (user == null) return null;
    if (!platform.isNative) return null;
    if (_registrationAttempted) return _token;
    _registrationAttempted = true;
    _set(loading: true, error: null);

    try {
      final fm = platform.messaging;
      final receive = await fm.checkPermissions();
      _maybeAskDaily(user, receive, fm.requestPermissions);
      if (receive != 'granted') {
        _set(loading: false, error: 'Push notification permission denied');
        return null;
      }
      final deviceToken = await fm.getToken();
      if (deviceToken == null || deviceToken.isEmpty) {
        _set(loading: false, error: tr('usedevicetoken_fcm_token_alina_bilmedi_10d88a', 'FCM token alına bilmədi'));
        return null;
      }
      _set(token: deviceToken);
      final saved = await saveTokenToDatabase(deviceToken, user.id);
      if (!saved) _set(error: tr('usedevicetoken_token_alindi_amma_saxlanmadi_98a023', 'Token alındı amma saxlanmadı'));

      _replaceListeners([
        fm.tokenRefreshes.listen((newToken) async {
          _set(token: newToken);
          await saveTokenToDatabase(newToken, user.id);
        }),
        fm.foregroundMessages.listen((n) {
          // In-app toast so the user is not blind to incoming notifications.
          final title = n.title != null && n.title!.isNotEmpty ? n.title! : tr('usedevicetoken_yeni_bildiris_c68787', 'Yeni bildiriş');
          toasts.show(title, description: n.body ?? '');
        }),
        // Taps are handled from app start by the notification tap listeners.
      ]);
      _set(loading: false);
      return deviceToken;
    } catch (err) {
      debugPrint('[DeviceToken] Registration exception: $err');
      try {
        final fb = platform.fallback;
        if (fb == null) throw StateError('push fallback is not available');
        final receive = await fb.checkPermissions();
        _maybeAskDaily(user, receive, fb.requestPermissions);
        if (receive != 'granted') {
          _set(loading: false, error: 'Push notification permission denied');
          return null;
        }
        try {
          final fallbackToken = await fb.register().timeout(fallbackTimeout);
          _set(token: fallbackToken);
          await saveTokenToDatabase(fallbackToken, user.id);
          _set(loading: false);
          return fallbackToken;
        } on TimeoutException {
          debugPrint('[DeviceToken] Fallback registration timeout');
          _set(loading: false);
          return null;
        } catch (regErr) {
          _set(loading: false, error: _messageOf(regErr, 'Registration failed'));
          return null;
        }
      } catch (fallbackErr) {
        debugPrint('[DeviceToken] Fallback also failed: $fallbackErr');
        _set(loading: false, error: _messageOf(err, 'Unknown error'));
        return null;
      }
    }
  }

  /// `unregisterDeviceForLogout(userId, timeoutMs)`: runs before the session is cleared (RLS). Removes this
  /// device's row for this account, drops the token and the listeners. Every step is bounded; never throws.
  Future<void> unregisterDeviceForLogout(String userId, [Duration timeout = const Duration(milliseconds: 2500)]) async {
    if (userId.isEmpty) return;
    // Stop tokenReceived from re-saving a refreshed token for the old account.
    _replaceListeners([]);
    final committed = committedDeviceToken;
    final known = committed?.userId == userId ? committed!.token : null;
    committedDeviceToken = null;
    if (!platform.isNative) return;
    // Registered in an earlier app run: read the current token only when push is already allowed (never prompts
    // during logout).
    final token = known ??
        await _settleWithin<String?>(() async {
          final fm = platform.messaging;
          if (await fm.checkPermissions() != 'granted') return null;
          final t = await fm.getToken();
          return t == null || t.isEmpty ? null : t;
        }, timeout);
    if (token != null) {
      await _settleWithin(() async {
        final error = await repository.deleteDevice(userId: userId, token: token);
        if (error != null) debugPrint('[DeviceToken] Logout unregister failed');
      }, timeout);
    }
    await _settleWithin(() async {
      try {
        await platform.messaging.deleteToken();
      } catch (_) {
        final fb = platform.fallback;
        if (fb == null) rethrow;
        await fb.unregister();
      }
    }, timeout);
    // Delivered pushes of the signed-out account leave the notification centre too.
    await _settleWithin(() async {
      try {
        await platform.messaging.removeAllDeliveredNotifications();
      } catch (_) {
        final fb = platform.fallback;
        if (fb == null) rethrow;
        await fb.removeAllDeliveredNotifications();
      }
    }, timeout);
  }

  /// `unregisterDevice()` of the hook.
  Future<void> unregisterDevice() async {
    final user = _user;
    if (user == null) return;
    final token = _token;
    if (token != null && committedDeviceToken?.token != token) committedDeviceToken = (token: token, userId: user.id);
    await unregisterDeviceForLogout(user.id);
    _registrationAttempted = false;
    _set(token: null);
  }

  /// `PUSH_GRANTED_EVENT`: the tour (or the toast) got the permission: register this device now.
  void pushGranted() {
    final user = _user;
    if (!platform.isNative || user == null) return;
    _registrationAttempted = false;
    unawaited(registerDevice(user));
  }

  /// The hook's user effect: reset on sign-out, re-register for another account, bind the on-device reminders.
  void userChanged(DeviceTokenUser? user) {
    if (user == null) {
      _user = null;
      _registrationAttempted = false;
      _registeredUserId = null;
      _set(token: null);
      return;
    }
    _user = user;
    if (_registeredUserId != null && _registeredUserId != user.id) _registrationAttempted = false;
    // On-device reminders belong to this account; another account's leftovers are cancelled.
    if (platform.isNative) {
      final bind = bindLocalNotificationOwner;
      if (bind != null) unawaited(bind(user.id).catchError((Object _) {}));
    }
    if (platform.isNative && !_registrationAttempted) {
      _registeredUserId = user.id;
      unawaited(registerDevice(user));
    }
  }

  @override
  void dispose() {
    _replaceListeners([]);
    super.dispose();
  }
}

const Object _keep = Object();
