// Ported from: src/lib/local-notification-scheduler.ts (setLocalNotifications, clearLocalNotificationNamespaces,
//              replanLocalNotifications, cancelLocalNotificationIds, notifyNow, resetLocalNotifications,
//              bindLocalNotificationOwner, installLocalNotificationReplanner, desiredLocalNotifications, the serial
//              queue and reconcile), src/lib/native.ts (clearLegacyAppointmentNotifications)
//
// One scheduler for every on-device reminder (vaccines, Tərbiyə, weaning, nap alerts, baby messages, illness doses,
// water, vitamin, exercise, pill). iOS keeps at most 64 pending local notifications, so features register their
// desired reminders under a namespace; the scheduler keeps the desired set durably (LocalStore
// `anacan.localNotifications.v1`, same JSON as the WebView's localStorage), cancels what is no longer wanted and
// keeps only the nearest [pendingBudget] (60) pending. The pure planning lives in
// domain/notifications/local_notification_plan.dart; the OS is [LocalNotificationBackend].
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';

import '../../domain/notifications/local_notification_plan.dart' hide bindOwner;
import '../../domain/notifications/local_notification_plan.dart' as plan show bindOwner;
import '../../state/local_store.dart';
import 'local_notification_backend.dart';

export '../../domain/notifications/local_notification_plan.dart' show StoredNotification, pendingBudget;

/// 'scheduled' | 'cleared' | 'denied' | 'unavailable'
typedef ScheduleResult = String;

/// Ids of the legacy local appointment reminders (random ids 400..1499).
const String legacyAppointmentClearedKey = 'anacan.appointmentLocalReminders.cleared.v1';

/// Subscribes to "the app returned to the foreground" (`App.addListener('appStateChange', isActive)`); returns
/// the unsubscribe function.
typedef AppResumeListen = VoidCallback Function(VoidCallback onResume);

/// Default resume source: Flutter's lifecycle (no plugin).
VoidCallback listenAppResume(VoidCallback onResume) {
  final listener = AppLifecycleListener(onResume: onResume);
  return listener.dispose;
}

class LocalNotificationScheduler {
  LocalNotificationScheduler({
    required this.store,
    required this.backend,
    DateTime Function()? clock,
    this.stepTimeout = const Duration(seconds: 10),
  }) : _clock = clock ?? DateTime.now;

  final LocalStore store;
  final LocalNotificationBackend backend;
  final DateTime Function() _clock;

  /// A stuck native bridge holds the queue for at most this long (`SERIAL_STEP_TIMEOUT_MS`).
  final Duration stepTimeout;

  int get _now => _clock().millisecondsSinceEpoch;

  // ── serial queue: a feature update never races the resume re-plan ──

  Future<void> _chain = Future<void>.value();

  Future<T> _serial<T>(Future<T> Function() work) {
    final run = _chain.then((_) => work());
    final next = Completer<void>();
    final timer = Timer(stepTimeout, () {
      if (!next.isCompleted) next.complete();
    });
    run.then((_) {}, onError: (Object _) {}).whenComplete(() {
      timer.cancel();
      if (!next.isCompleted) next.complete();
    });
    _chain = next.future;
    return run;
  }

  // ── durable desired set ──

  SchedulerStore _read() {
    try {
      return parseSchedulerStore(store.getItem(localNotificationsStoreKey));
    } catch (_) {
      return SchedulerStore();
    }
  }

  void _write(SchedulerStore s) {
    try {
      store.setItem(localNotificationsStoreKey, jsonEncode(s.toJson()));
    } catch (_) {
      // the next re-plan rebuilds from callers
    }
  }

  /// `desiredLocalNotifications(namespace?)`: the desired reminders as stored (tests, diagnostics).
  List<StoredNotification> desired([String? namespace]) {
    final s = _read();
    if (namespace != null) return s.namespaces[namespace] ?? const [];
    return [for (final list in s.namespaces.values) ...list];
  }

  // ── native bridge ──

  Future<String> _permission(bool ask) async {
    try {
      var status = await backend.checkDisplay();
      if (ask && (status == 'prompt' || status == 'prompt-with-rationale')) status = await backend.requestDisplay();
      if (status == 'granted') return 'granted';
      return status == 'prompt' || status == 'prompt-with-rationale' ? 'prompt' : 'denied';
    } catch (_) {
      return 'unavailable';
    }
  }

  static NativeLocalNotification toNative(StoredNotification item) {
    final at = DateTime.fromMillisecondsSinceEpoch(item.at);
    return NativeLocalNotification(
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: item.repeat == 'day' ? NativeScheduleDaily(hour: at.hour, minute: at.minute) : NativeScheduleAt(at),
      extra: item.extra,
      smallIcon: item.smallIcon == null || item.smallIcon!.isEmpty ? null : item.smallIcon,
      channelId: item.channelId == null || item.channelId!.isEmpty ? null : item.channelId,
    );
  }

  /// Reconciles the OS with the desired set. [extraCancel] are ids a feature retired in this change. Returns the
  /// permission state used. Never throws.
  Future<String> _reconcile(SchedulerStore s, List<int> extraCancel, {required bool ask, bool needPermission = false}) async {
    final now = _now;
    Set<int>? pending;
    try {
      pending = (await backend.pendingIds()).toSet();
    } catch (_) {
      pending = null;
    }
    final plan = planReconcile(s, extraCancel: extraCancel, pending: pending, now: now);
    if (plan.cancel.isNotEmpty) {
      try {
        await backend.cancel(plan.cancel);
      } catch (_) {
        // retried on the next re-plan
      }
      for (final id in plan.cancel) {
        s.scheduled.remove('$id');
      }
    }
    final display = plan.chosen.isNotEmpty || needPermission ? await _permission(ask) : 'granted';
    if (display != 'granted') {
      _write(s);
      return display;
    }
    if (plan.toSchedule.isNotEmpty) {
      try {
        await backend.schedule([for (final n in plan.toSchedule) toNative(n.item)]);
        for (final n in plan.toSchedule) {
          s.scheduled['${n.id}'] = fingerprint(n.item);
        }
      } catch (_) {
        // retried on the next re-plan
      }
    }
    _write(s);
    return display;
  }

  // ── public API ──

  /// `setLocalNotifications(namespace, items, { ask, cancelIds })`: replaces one feature's desired reminders (empty =
  /// remove them) and re-plans. Never throws. 'scheduled' = permission granted and something is desired; 'cleared' =
  /// nothing desired.
  Future<ScheduleResult> setLocalNotifications(String namespace, List<StoredNotification> items,
      {bool ask = false, List<int> cancelIds = const []}) {
    return _serial(() async {
      if (!backend.isAvailable) return 'unavailable';
      final s = _read();
      final previous = replaceNamespace(s, namespace, [...items]);
      final display = await _reconcile(s, [...previous, ...cancelIds], ask: ask && items.isNotEmpty, needPermission: items.isNotEmpty);
      if (items.isEmpty) return 'cleared';
      if (display == 'granted') return 'scheduled';
      return display == 'unavailable' ? 'unavailable' : 'denied';
    });
  }

  /// `clearLocalNotificationNamespaces(prefix, cancelIds)`: removes every namespace starting with [prefix].
  Future<void> clearNamespaces(String prefix, [List<int> cancelIds = const []]) {
    return _serial(() async {
      if (!backend.isAvailable) return;
      final s = _read();
      final removed = <int>[];
      for (final ns in s.namespaces.keys.toList()) {
        if (!ns.startsWith(prefix)) continue;
        removed.addAll(s.namespaces[ns]!.map((n) => n.id));
        s.namespaces.remove(ns);
      }
      await _reconcile(s, [...removed, ...cancelIds], ask: false);
    });
  }

  /// `replanLocalNotifications()`: re-plan from the durable set (app open / resume). Never prompts, never throws.
  Future<void> replan() {
    return _serial(() async {
      if (!backend.isAvailable) return;
      await _reconcile(_read(), const [], ask: false);
    });
  }

  /// `cancelLocalNotificationIds(ids)`: ids outside any namespace (timer / chat notifications).
  Future<void> cancelIds(List<int> ids) {
    return _serial(() async {
      if (ids.isEmpty || !backend.isAvailable) return;
      try {
        await backend.cancel(ids);
      } catch (_) {
        // best effort
      }
    });
  }

  /// `notifyNow(item, { ask })`: shows a notification at once (a running timer, an incoming chat message). It never
  /// occupies a pending slot and is not part of the desired set.
  Future<bool> notifyNow({
    required int id,
    required String title,
    required String body,
    Map<String, Object?>? extra,
    bool? ongoing,
    bool? autoCancel,
    String? smallIcon,
    bool ask = false,
  }) {
    return _serial(() async {
      if (!backend.isAvailable) return false;
      if (await _permission(ask) != 'granted') return false;
      try {
        await backend.schedule([
          NativeLocalNotification(
              id: id, title: title, body: body, extra: extra, ongoing: ongoing, autoCancel: autoCancel, smallIcon: smallIcon),
        ]);
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  /// `resetLocalNotifications()` (logout / "all notifications off"): forgets every desired reminder of this device
  /// and cancels everything pending and delivered.
  Future<void> reset() {
    return _serial(() async {
      _write(SchedulerStore());
      if (!backend.isAvailable) return;
      final ids = await backend.pendingIds();
      if (ids.isNotEmpty) await backend.cancel(ids);
      try {
        await backend.removeAllDelivered();
      } catch (_) {
        // optional on older plugins
      }
    });
  }

  /// `bindLocalNotificationOwner(userId)`: binds the desired set to the signed-in account; another account's
  /// leftovers are cancelled, device-level ones (water) stay.
  Future<void> bindOwner(String userId) {
    return _serial(() async {
      if (userId.isEmpty) return;
      final s = _read();
      final hadOwner = s.owner != null;
      final removed = plan.bindOwner(s, userId);
      if (removed == null) return;
      // A first owner is only recorded; another account's reminders are cancelled.
      if (!hadOwner || !backend.isAvailable) {
        _write(s);
        return;
      }
      await _reconcile(s, removed, ask: false);
    });
  }

  bool _replannerInstalled = false;
  VoidCallback? _removeResume;

  /// `installLocalNotificationReplanner(minIntervalMs)`: re-plan now and whenever the app returns to the foreground
  /// (throttled). The resume listener is registered only on a native platform ([isNative]).
  void installReplanner({Duration minInterval = const Duration(seconds: 30), bool isNative = true, AppResumeListen? listen}) {
    if (_replannerInstalled) return;
    _replannerInstalled = true;
    var last = -1 << 52;
    void run() {
      final now = _now;
      if (now - last < minInterval.inMilliseconds) return;
      last = now;
      unawaited(replan());
    }

    run();
    if (!isNative) return;
    try {
      _removeResume = (listen ?? listenAppResume)(run);
    } catch (_) {
      // re-plans still happen whenever a feature changes its reminders
    }
  }

  /// `clearLegacyAppointmentNotifications()`: appointment reminders now come from the server; pending local ones
  /// (ids 400..1499) are cancelled once per device.
  Future<void> clearLegacyAppointmentNotifications() async {
    if (!backend.isAvailable) return;
    try {
      if ((store.getItem(legacyAppointmentClearedKey) ?? '').isNotEmpty) return;
      final stale = (await backend.pendingIds()).where((id) => id >= 400 && id < 1500).toList();
      if (stale.isNotEmpty) await backend.cancel(stale);
      store.setItem(legacyAppointmentClearedKey, '1');
    } catch (e) {
      debugPrint('clearLegacyAppointmentNotifications failed: $e');
    }
  }

  void dispose() {
    _removeResume?.call();
    _removeResume = null;
  }
}
