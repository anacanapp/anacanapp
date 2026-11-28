// Ported from: node_modules/@capacitor/local-notifications 8.0.0 as the app configured it (capacitor.config.json
//              `LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#FF5A5F' }`): LocalNotificationManager
//              (channel "default" / "Default", IMPORTANCE_DEFAULT, PRIORITY_DEFAULT, VISIBILITY_PRIVATE,
//              onlyAlertOnce, autoCancel default true, small-icon fallback android.R.drawable.ic_dialog_info,
//              setExactIfPossible), LocalNotificationsPlugin (checkPermissions / requestPermissions "display"), the
//              iOS plugin (alert + sound + badge, foreground presentation)
//
// [LocalNotificationBackend] on flutter_local_notifications + timezone. One process-wide plugin
// ([LocalNotificationsRuntime]) is initialised from `main()` so a tap that launched the app is not lost; its taps
// feed [LocalNotificationsRuntime.taps] (the `localNotificationActionPerformed` stream, payload = `extra`).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../native/mobile_host.dart';
import 'local_notification_backend.dart';

/// Capacitor's `DEFAULT_NOTIFICATION_CHANNEL_ID` and its name / description: the channel the WebView build created
/// on first launch, so a user's channel settings carry over.
const String kDefaultLocalChannelId = 'default';
const String _defaultChannelName = 'Default';

/// The small icon Capacitor really used: `ic_stat_icon` was never shipped as a drawable, so the plugin fell back to
/// `android.R.drawable.ic_dialog_info`. `res/drawable/anacan_ln_fallback_icon.xml` wraps that framework icon.
const String kLocalFallbackSmallIcon = 'anacan_ln_fallback_icon';

/// `iconColor` of capacitor.config.json.
const Color _iconColor = Color(0xFFFF5A5F);

/// Capacitor permission states of POST_NOTIFICATIONS on Android 13+ (`getPermissionState`): granted, prompt (never
/// asked), prompt-with-rationale (denied once), denied (denied for good).
Future<String> androidNotificationPermissionState() async {
  final status = await Permission.notification.status;
  if (status.isGranted || status.isLimited || status.isProvisional) return 'granted';
  if (status.isPermanentlyDenied || status.isRestricted) return 'denied';
  return await Permission.notification.shouldShowRequestRationale ? 'prompt-with-rationale' : 'prompt';
}

/// UNUserNotificationCenter authorization as Capacitor reports it on iOS: notDetermined → prompt, denied → denied,
/// authorized / provisional / ephemeral → granted (permission_handler: notDetermined = denied, denied =
/// permanentlyDenied).
Future<String> iosNotificationPermissionState() async {
  final status = await Permission.notification.status;
  if (status.isGranted || status.isLimited || status.isProvisional) return 'granted';
  if (status.isPermanentlyDenied || status.isRestricted) return 'denied';
  return 'prompt';
}

/// The plugin, its initialisation and the tap stream, once per process.
class LocalNotificationsRuntime {
  LocalNotificationsRuntime._();
  static final LocalNotificationsRuntime instance = LocalNotificationsRuntime._();

  final FlutterLocalNotificationsPlugin plugin = FlutterLocalNotificationsPlugin();

  // Single-subscription: a tap delivered before the listener is attached (cold start) waits in the buffer.
  final StreamController<Object?> _taps = StreamController<Object?>();
  bool _tapsListened = false;

  /// `localNotificationActionPerformed` → `notification.extra` (null when the notification had none).
  Stream<Object?> get taps {
    if (_tapsListened) return const Stream.empty();
    _tapsListened = true;
    return _taps.stream;
  }

  Future<void>? _ready;

  /// Initialises timezone data and the plugin (idempotent). Never prompts: permissions are asked by the scheduler.
  Future<void> ensureInitialized() => _ready ??= _init();

  Future<void> _init() async {
    tzdata.initializeTimeZones();
    try {
      final name = (await FlutterTimezone.getLocalTimezone()).identifier;
      tz.setLocalLocation(tz.getLocation(name));
    } catch (e) {
      debugPrint('Local notifications: time zone unavailable ($e), using UTC');
    }
    const settings = InitializationSettings(
      android: AndroidInitializationSettings(kLocalFallbackSmallIcon),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await plugin.initialize(settings: settings, onDidReceiveNotificationResponse: _onResponse);
    try {
      final launch = await plugin.getNotificationAppLaunchDetails();
      final response = launch?.notificationResponse;
      if (launch?.didNotificationLaunchApp == true && response != null) _onResponse(response);
    } catch (_) {
      // no launch details on this platform
    }
  }

  void _onResponse(NotificationResponse response) {
    if (response.notificationResponseType != NotificationResponseType.selectedNotification) return;
    _taps.add(decodeLocalExtra(response.payload));
  }
}

/// The `extra` object carried in the plugin payload (JSON text).
String? encodeLocalExtra(Map<String, Object?>? extra) => extra == null ? null : jsonEncode(extra);

Object? decodeLocalExtra(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  try {
    return jsonDecode(payload);
  } catch (_) {
    return null;
  }
}

/// [LocalNotificationBackend] over flutter_local_notifications.
class FlutterLocalNotificationBackend implements LocalNotificationBackend {
  FlutterLocalNotificationBackend([LocalNotificationsRuntime? runtime]) : _runtime = runtime ?? LocalNotificationsRuntime.instance;
  final LocalNotificationsRuntime _runtime;

  FlutterLocalNotificationsPlugin get _plugin => _runtime.plugin;
  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  IOSFlutterLocalNotificationsPlugin? get _ios => _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();

  @override
  bool get isAvailable => true;

  /// Android below 13: `areNotificationsEnabled()`; 13+: the POST_NOTIFICATIONS permission state.
  @override
  Future<NotificationDisplay> checkDisplay() async {
    await _runtime.ensureInitialized();
    if (isIOSHost) return iosNotificationPermissionState();
    if (await androidSdkInt() < 33) return await _enabledText();
    return androidNotificationPermissionState();
  }

  @override
  Future<NotificationDisplay> requestDisplay() async {
    await _runtime.ensureInitialized();
    if (isIOSHost) {
      await _ios?.requestPermissions(alert: true, badge: true, sound: true);
      return iosNotificationPermissionState();
    }
    if (await androidSdkInt() >= 33 && await androidNotificationPermissionState() != 'granted') {
      await Permission.notification.request();
    }
    // permissionsCallback: the result is areNotificationsEnabled().
    return _enabledText();
  }

  Future<String> _enabledText() async => await _android?.areNotificationsEnabled() == true ? 'granted' : 'denied';

  /// iOS: requests left by the WebView build carry no plugin id and cannot be listed; they are removed once (the
  /// scheduler then re-schedules every desired reminder under the same ids).
  Future<List<int>> _iosPendingIds() async {
    const channel = MethodChannel('dexterous.com/flutter/local_notifications');
    final raw = await channel.invokeListMethod<Object?>('pendingNotificationRequests') ?? const [];
    final ids = <int>[];
    var legacy = false;
    for (final r in raw) {
      final id = r is Map ? r['id'] : null;
      if (id is int) {
        ids.add(id);
      } else {
        legacy = true;
      }
    }
    if (legacy) {
      await _plugin.cancelAllPendingNotifications();
      return const [];
    }
    return ids;
  }

  @override
  Future<List<int>> pendingIds() async {
    await _runtime.ensureInitialized();
    if (isIOSHost) return _iosPendingIds();
    return [for (final p in await _plugin.pendingNotificationRequests()) p.id];
  }

  NotificationDetails _details(NativeLocalNotification n) {
    final icon = n.smallIcon == null || n.smallIcon == 'ic_stat_icon' ? kLocalFallbackSmallIcon : n.smallIcon!;
    final channel = n.channelId ?? kDefaultLocalChannelId;
    return NotificationDetails(
      android: AndroidNotificationDetails(
        channel,
        channel == kDefaultLocalChannelId ? _defaultChannelName : channel,
        channelDescription: channel == kDefaultLocalChannelId ? _defaultChannelName : null,
        icon: icon,
        color: _iconColor,
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
        visibility: NotificationVisibility.private,
        onlyAlertOnce: true,
        autoCancel: n.autoCancel ?? true,
        ongoing: n.ongoing ?? false,
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBanner: true,
        presentList: true,
        presentSound: true,
        presentBadge: true,
      ),
    );
  }

  /// `setExactIfPossible` with `allowWhileIdle: true`: the app never declared SCHEDULE_EXACT_ALARM, so Android 12+
  /// gets inexact alarms (`setAndAllowWhileIdle`) and older versions exact ones.
  Future<AndroidScheduleMode> _scheduleMode() async {
    if (!isAndroidHost) return AndroidScheduleMode.inexactAllowWhileIdle;
    final sdk = await androidSdkInt();
    if (sdk < 31) return AndroidScheduleMode.exactAllowWhileIdle;
    final exact = await _android?.canScheduleExactNotifications() ?? false;
    return exact ? AndroidScheduleMode.exactAllowWhileIdle : AndroidScheduleMode.inexactAllowWhileIdle;
  }

  @override
  Future<void> schedule(List<NativeLocalNotification> notifications) async {
    await _runtime.ensureInitialized();
    final mode = await _scheduleMode();
    final now = DateTime.now();
    for (final n in notifications) {
      final details = _details(n);
      final payload = encodeLocalExtra(n.extra);
      // schedule() replaces an existing id (dismissVisibleNotification + cancelTimerForNotification).
      await _plugin.cancel(id: n.id);
      switch (n.schedule) {
        case null:
          await _plugin.show(id: n.id, title: n.title, body: n.body, notificationDetails: details, payload: payload);
        case NativeScheduleAt(:final at):
          // "Scheduled time must be *after* current time": the WebView plugin logged and skipped it.
          if (!at.isAfter(now)) continue;
          await _plugin.zonedSchedule(
            id: n.id,
            scheduledDate: tz.TZDateTime.from(at, tz.local),
            notificationDetails: details,
            androidScheduleMode: mode,
            title: n.title,
            body: n.body,
            payload: payload,
          );
        case NativeScheduleDaily(:final hour, :final minute):
          final local = tz.TZDateTime.now(tz.local);
          var next = tz.TZDateTime(tz.local, local.year, local.month, local.day, hour, minute);
          if (!next.isAfter(local)) next = next.add(const Duration(days: 1));
          await _plugin.zonedSchedule(
            id: n.id,
            scheduledDate: next,
            notificationDetails: details,
            androidScheduleMode: mode,
            title: n.title,
            body: n.body,
            payload: payload,
            matchDateTimeComponents: DateTimeComponents.time,
          );
      }
    }
  }

  @override
  Future<void> cancel(List<int> ids) async {
    await _runtime.ensureInitialized();
    for (final id in ids) {
      await _plugin.cancel(id: id);
    }
  }

  /// `removeAllDeliveredNotifications()`. Android: every shown notification (the plugin's `notificationManager
  /// .cancelAll()` would also drop pending alarms, so each active one is cancelled). iOS: the plugin has no
  /// delivered-only call; this runs only on reset / logout, after every pending reminder was cancelled.
  @override
  Future<void> removeAllDelivered() async {
    await _runtime.ensureInitialized();
    if (isIOSHost) {
      await _plugin.cancelAll();
      return;
    }
    for (final a in await _plugin.getActiveNotifications()) {
      final id = a.id;
      if (id == null) continue;
      await _android?.cancel(id: id, tag: a.tag);
    }
  }
}
