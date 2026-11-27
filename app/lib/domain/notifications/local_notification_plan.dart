// Ported from: src/lib/local-notification-scheduler.ts (pure planning: nextFireAt, planLocalNotifications,
// fingerprint, the stored desired-set shape and the reconcile choices; no plugin calls)
//
// iOS keeps at most 64 pending local notifications. Every feature registers its desired reminders under a
// namespace; the nearest PENDING_BUDGET (60) by fire time are pending (a daily reminder counts as its next
// occurrence) and the rest is scheduled on a later re-plan.

import 'dart:convert';
import 'dart:math' as math;

import '../js_compat.dart';

const int pendingBudget = 60;
const String localNotificationsStoreKey = 'anacan.localNotifications.v1';

/// Device-level reminders that do not belong to an account (kept when another account is bound).
const Set<String> deviceNamespaces = {'water'};

/// A one-shot reminder this close to now (or past) is treated as already delivered.
const int expiryMarginMs = 5000;

/// A reminder as stored in the desired set (`at` is epoch ms; for `repeat: 'day'` only its local hour/minute).
class StoredNotification {
  const StoredNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.at,
    this.repeat,
    this.extra,
    this.smallIcon,
    this.channelId,
  });
  final int id;
  final String title;
  final String body;
  final int at;

  /// 'day' or null.
  final String? repeat;
  final Map<String, Object?>? extra;
  final String? smallIcon;
  final String? channelId;

  /// `toStored`: optional fields are present only when set (truthy).
  Map<String, Object?> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'at': at,
        if (repeat != null && repeat!.isNotEmpty) 'repeat': repeat,
        if (extra != null) 'extra': extra,
        if (smallIcon != null && smallIcon!.isNotEmpty) 'smallIcon': smallIcon,
        if (channelId != null && channelId!.isNotEmpty) 'channelId': channelId,
      };

  static StoredNotification? tryParse(Object? n) {
    if (n is! Map) return null;
    final id = n['id'], title = n['title'], body = n['body'], at = n['at'];
    if (!jsIsInteger(id) || title is! String || body is! String || at is! num || !at.isFinite) return null;
    return StoredNotification(
      id: (id as num).toInt(),
      title: title,
      body: body,
      at: at.toInt(),
      repeat: n['repeat'] as String?,
      extra: (n['extra'] as Map?)?.cast<String, Object?>(),
      smallIcon: n['smallIcon'] as String?,
      channelId: n['channelId'] as String?,
    );
  }
}

class PlannedNotification {
  const PlannedNotification(this.item, {required this.namespace, required this.next});
  final StoredNotification item;
  final String namespace;

  /// Next fire time (epoch ms).
  final int next;
  int get id => item.id;
}

/// The next time a reminder fires after [now], or null when a one-shot is already past.
int? nextFireAt({required int at, String? repeat, required int now}) {
  if (repeat == 'day') {
    final base = DateTime.fromMillisecondsSinceEpoch(at);
    final today = DateTime.fromMillisecondsSinceEpoch(now);
    var candidate = DateTime(today.year, today.month, today.day, base.hour, base.minute);
    if (candidate.millisecondsSinceEpoch <= now) {
      candidate = DateTime(candidate.year, candidate.month, candidate.day + 1, candidate.hour, candidate.minute);
    }
    return candidate.millisecondsSinceEpoch;
  }
  return at > now + expiryMarginMs ? at : null;
}

/// Which reminders should be pending now: the nearest [budget], ordered by next fire time, then id. Namespaces
/// are visited in sorted order and an id belongs to the first namespace that has it.
List<PlannedNotification> planLocalNotifications(Map<String, List<StoredNotification>> namespaces, int now, [int budget = pendingBudget]) {
  final seen = <int>{};
  final all = <PlannedNotification>[];
  for (final ns in namespaces.keys.toList()..sort()) {
    for (final item in namespaces[ns] ?? const <StoredNotification>[]) {
      if (seen.contains(item.id)) continue;
      final next = nextFireAt(at: item.at, repeat: item.repeat, now: now);
      if (next == null) continue;
      seen.add(item.id);
      all.add(PlannedNotification(item, namespace: ns, next: next));
    }
  }
  jsSortInPlace(all, (a, b) {
    final d = a.next - b.next;
    return d != 0 ? d : a.id - b.id;
  });
  return all.take(math.max(0, budget)).toList();
}

/// Stable description of what is handed to the OS: unchanged reminders are not rescheduled. Note: `extra` is
/// serialized in insertion order like `JSON.stringify`, except that JS puts integer-like keys first.
String fingerprint(StoredNotification item) {
  final d = DateTime.fromMillisecondsSinceEpoch(item.at);
  final when = item.repeat == 'day' ? 'd${d.hour}:${d.minute}' : 'a${item.at}';
  return jsonEncode([item.title, item.body, when, item.extra, item.smallIcon, item.channelId]);
}

/// The durable desired set (`anacan.localNotifications.v1`).
class SchedulerStore {
  SchedulerStore({this.owner, Map<String, List<StoredNotification>>? namespaces, Map<String, String>? scheduled})
      : namespaces = namespaces ?? {},
        scheduled = scheduled ?? {};
  String? owner;
  final Map<String, List<StoredNotification>> namespaces;

  /// id → fingerprint of what this scheduler last handed to the OS.
  final Map<String, String> scheduled;

  Map<String, Object?> toJson() => {
        'v': 1,
        'owner': owner,
        'namespaces': {for (final e in namespaces.entries) e.key: [for (final n in e.value) n.toJson()]},
        'scheduled': scheduled,
      };
}

/// readStore on the stored text: anything malformed is dropped (a bad store is an empty store).
SchedulerStore parseSchedulerStore(String? raw) {
  try {
    final v = jsonDecode(raw == null || raw.isEmpty ? 'null' : raw);
    if (v is! Map || v['v'] != 1) return SchedulerStore();
    final namespaces = <String, List<StoredNotification>>{};
    final rawNs = v['namespaces'];
    if (rawNs is Map) {
      for (final e in rawNs.entries) {
        if (e.value is! List) continue;
        namespaces[e.key as String] = [for (final n in e.value as List) ?StoredNotification.tryParse(n)];
      }
    }
    final scheduled = <String, String>{};
    final rawSch = v['scheduled'];
    if (rawSch is Map) {
      for (final e in rawSch.entries) {
        if (e.value is String) scheduled[e.key as String] = e.value as String;
      }
    }
    return SchedulerStore(owner: v['owner'] is String ? v['owner'] as String : null, namespaces: namespaces, scheduled: scheduled);
  } catch (_) {
    return SchedulerStore();
  }
}

/// What one reconcile pass does: the reminders to keep pending, the ids to cancel and the ones to (re)schedule.
class ReconcilePlan {
  const ReconcilePlan({required this.chosen, required this.cancel, required this.toSchedule});
  final List<PlannedNotification> chosen;
  final List<int> cancel;
  final List<PlannedNotification> toSchedule;
}

/// The pure part of `reconcile`: prunes fired one-shots from [store] (mutates it like the TypeScript), counts
/// pending ids it does not own against the budget, and decides cancels and schedules. [pending] is the OS
/// pending id set (null when unknown). The caller cancels, asks for permission, schedules and then records
/// `store.scheduled[id] = fingerprint(...)` for what was handed to the OS.
ReconcilePlan planReconcile(SchedulerStore store, {required List<int> extraCancel, required Set<int>? pending, required int now}) {
  for (final ns in store.namespaces.keys.toList()) {
    store.namespaces[ns] = store.namespaces[ns]!.where((i) => nextFireAt(at: i.at, repeat: i.repeat, now: now) != null).toList();
  }
  final desiredIds = {for (final list in store.namespaces.values) for (final n in list) n.id};
  final retired = {for (final id in extraCancel) if (!desiredIds.contains(id)) id};
  final unmanaged = pending == null
      ? 0
      : pending.where((id) => !store.scheduled.containsKey('$id') && !desiredIds.contains(id) && !retired.contains(id)).length;
  final chosen = planLocalNotifications(store.namespaces, now, pendingBudget - unmanaged);
  final chosenIds = {for (final n in chosen) n.id};
  final cancel = <int>{};
  for (final id in store.scheduled.keys) {
    final n = int.parse(id);
    if (!chosenIds.contains(n)) cancel.add(n);
  }
  for (final id in extraCancel) {
    if (!chosenIds.contains(id)) cancel.add(id);
  }
  final toSchedule = chosen
      .where((n) => store.scheduled['${n.id}'] != fingerprint(n.item) || (pending != null && !pending.contains(n.id)))
      .toList();
  return ReconcilePlan(chosen: chosen, cancel: cancel.toList(), toSchedule: toSchedule);
}

/// `setLocalNotifications` store update: an id belongs to one namespace (taking it over removes it elsewhere);
/// an empty list removes the namespace. Returns the ids previously in [namespace] (cancelled if not re-added).
List<int> replaceNamespace(SchedulerStore store, String namespace, List<StoredNotification> items) {
  final ids = {for (final n in items) n.id};
  for (final ns in store.namespaces.keys.toList()) {
    if (ns != namespace) store.namespaces[ns] = store.namespaces[ns]!.where((n) => !ids.contains(n.id)).toList();
  }
  final previous = [for (final n in store.namespaces[namespace] ?? const <StoredNotification>[]) n.id];
  if (items.isNotEmpty) {
    store.namespaces[namespace] = items;
  } else {
    store.namespaces.remove(namespace);
  }
  return previous;
}

/// `bindLocalNotificationOwner` store update: returns the ids of the previous account's reminders to cancel
/// (device-level namespaces stay), or null when nothing changes.
List<int>? bindOwner(SchedulerStore store, String userId) {
  if (userId.isEmpty || store.owner == userId) return null;
  final previous = store.owner;
  store.owner = userId;
  if (previous == null) return const [];
  final removed = <int>[];
  for (final ns in store.namespaces.keys.toList()) {
    if (deviceNamespaces.contains(ns)) continue;
    removed.addAll(store.namespaces[ns]!.map((n) => n.id));
    store.namespaces.remove(ns);
  }
  return removed;
}
