// Ported from: src/lib/vaccine-reminders.ts
//
// Vaccine reminders (this phone only, no server job): local notifications for every child of the signed-in user.
//  - each upcoming dose due within the next 60 days: 10:00 three days before and 10:00 on the due day;
//  - each overdue dose (up to 3, due within the last year): one gentle reminder at 10:00 on the next weekday of its
//    due date, so it never comes more than once a week however often the calendar is opened;
//  - done / skipped, conditional / seasonal doses and interval doses whose earlier dose is not logged get nothing.
// Ids: each child gets its own block of [vaccineChildStride] ids (slot stored per device). The on/off switch is
// stored per device (default on); off cancels every block. The plugin side is [VaccineNotificationScheduler]
// (central local-notification scheduler, phase 9: default "not native / unavailable").
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/js_compat.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../domain/vaccines/vaccine_schedule.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;

const int vaccineReminderBaseId = 883300;
const int maxUpcoming = 20;
const int maxOverdue = 3;
const int upcomingDays = 60;
const int overdueLookbackDays = 365;
const int reminderHour = 10;
const String vaccineDeeplink = 'anacan://tool/vaccine-calendar';

/// Ids per child block; the first [maxUpcoming] + [maxOverdue] are used, the rest is headroom.
const int vaccineChildStride = 30;

/// Per-child blocks start after the legacy single-child range (883_300..883_322, still cancelled for old installs).
const int vaccineChildBaseId = 883400;
const int maxReminderChildren = 10;
const int _perChild = maxUpcoming + maxOverdue;
List<int> _rangeIds(int base) => [for (var i = 0; i < _perChild; i++) base + i];
final List<int> _legacyIds = _rangeIds(vaccineReminderBaseId);
final List<int> _allChildIds = [for (var slot = 0; slot < maxReminderChildren; slot++) ..._rangeIds(vaccineChildBlockBase(slot))];
int vaccineChildBlockBase(int slot) => vaccineChildBaseId + slot * vaccineChildStride;

/// Scheduler namespace prefix; one namespace per child block.
const String _vaccineNamespace = 'vaccine:';

const String vaccineChildSlotsKey = 'anacan.vaccineReminders.childSlots.v1';
const String vaccineRemindersKey = 'anacan.vaccineReminders.v1';
const String vaccineRefreshKey = 'anacan.vaccineReminders.refreshedOn.v1';

/// 'scheduled' | 'cleared' | 'denied' | 'unavailable'
typedef VaccineReminderResult = String;

/// The central local-notification scheduler as the vaccine reminders use it (`setLocalNotifications`,
/// `clearLocalNotificationNamespaces`, `Capacitor.isNativePlatform()`).
abstract interface class VaccineNotificationScheduler {
  bool get isNativePlatform;
  Future<VaccineReminderResult> setLocalNotifications(String namespace, List<StoredNotification> items,
      {bool ask = true, List<int> cancelIds = const []});
  Future<void> clearLocalNotificationNamespaces(String prefix, List<int> ids);
}

/// Web behaviour until the native scheduler exists (phase 9): no switch, nothing scheduled.
class UnavailableVaccineScheduler implements VaccineNotificationScheduler {
  const UnavailableVaccineScheduler();
  @override
  bool get isNativePlatform => false;
  @override
  Future<VaccineReminderResult> setLocalNotifications(String namespace, List<StoredNotification> items,
          {bool ask = true, List<int> cancelIds = const []}) async =>
      'unavailable';
  @override
  Future<void> clearLocalNotificationNamespaces(String prefix, List<int> ids) async {}
}

final vaccineNotificationSchedulerProvider =
    Provider<VaccineNotificationScheduler>((ref) => const UnavailableVaccineScheduler(), name: 'vaccineNotificationSchedulerProvider');

/// Per-device reminder bookkeeping (localStorage in React).
class VaccineReminders {
  VaccineReminders(this.store, this.scheduler);
  final LocalStore store;
  final VaccineNotificationScheduler scheduler;

  Map<String, int> _readSlots() {
    try {
      final parsed = jsonDecode(store.getItem(vaccineChildSlotsKey) ?? '{}');
      if (parsed is! Map) return {};
      final out = <String, int>{};
      for (final e in parsed.entries) {
        final slot = e.value;
        if (jsIsInteger(slot) && (slot as num) >= 0 && slot < maxReminderChildren && !out.values.contains(slot.toInt())) {
          out['${e.key}'] = slot.toInt();
        }
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  void _writeSlots(Map<String, int> slots) {
    try {
      store.setItem(vaccineChildSlotsKey, jsonEncode(slots));
    } catch (_) {}
  }

  /// The child's id block on this phone (stable once assigned; the lowest free slot otherwise). [keep] lists the
  /// children that must keep their slots. Null when every block belongs to a child in [keep].
  int? vaccineChildBase(String childId, [List<String> keep = const []]) {
    final slots = _readSlots();
    if (slots.containsKey(childId)) return vaccineChildBlockBase(slots[childId]!);
    final used = slots.values.toSet();
    int? free;
    for (var i = 0; i < maxReminderChildren; i++) {
      if (!used.contains(i)) {
        free = i;
        break;
      }
    }
    if (free == null) {
      String? stale;
      for (final id in slots.keys) {
        if (id != childId && !keep.contains(id)) {
          stale = id;
          break;
        }
      }
      if (stale == null) return null;
      free = slots.remove(stale);
    }
    slots[childId] = free!;
    _writeSlots(slots);
    return vaccineChildBlockBase(free);
  }

  /// Forget every child not in [childIds]; returns the id blocks they held (to cancel).
  List<int> _releaseOtherChildren(List<String> childIds) {
    final slots = _readSlots();
    final released = <int>[];
    for (final e in [...slots.entries]) {
      if (childIds.contains(e.key)) continue;
      released.addAll(_rangeIds(vaccineChildBlockBase(e.value)));
      slots.remove(e.key);
    }
    _writeSlots(slots);
    return released;
  }

  bool get enabled {
    try {
      return store.getItem(vaccineRemindersKey) != '0';
    } catch (_) {
      return true;
    }
  }

  set enabled(bool on) {
    try {
      store.setItem(vaccineRemindersKey, on ? '1' : '0');
    } catch (_) {}
  }

  /// Replace this phone's vaccine reminders for one id block with [slots] (empty = cancel that block). Never throws.
  Future<VaccineReminderResult> sync(
    List<VaccineReminderSlot> slots,
    ({String title, String body}) Function(VaccineReminderSlot slot) text, {
    bool ask = true,
    int? baseId,
    bool cancelAll = false,
  }) async {
    try {
      if (cancelAll) {
        await scheduler.clearLocalNotificationNamespaces(_vaccineNamespace, [..._legacyIds, ..._allChildIds]);
        return scheduler.isNativePlatform ? 'cleared' : 'unavailable';
      }
      final block = baseId != null ? _rangeIds(baseId) : const <int>[];
      final namespace = '$_vaccineNamespace${baseId ?? vaccineReminderBaseId}';
      return await scheduler.setLocalNotifications(
        namespace,
        [
          for (final s in slots)
            () {
              final t = text(s);
              return StoredNotification(
                id: s.id,
                title: t.title,
                body: t.body,
                at: s.at.millisecondsSinceEpoch,
                extra: {'type': 'vaccine_reminder', 'deeplink': vaccineDeeplink, 'dose': s.doseId},
              );
            }(),
        ],
        ask: ask,
        cancelIds: [..._legacyIds, ...block],
      );
    } catch (_) {
      return 'unavailable';
    }
  }

  /// Cancel every vaccine reminder on this phone, for every child (switch turned off).
  Future<VaccineReminderResult> cancelAll() => sync(const [], (_) => (title: '', body: ''), cancelAll: true);

  /// App-start refresh for all children: never prompts, respects the switch, one block per child, cancels blocks
  /// of children that are gone.
  Future<VaccineReminderResult> refreshAll(List<ChildReminderPlan> plans, [DateTime? now]) async {
    if (!enabled) return cancelAll();
    final at = now ?? DomainClock.now();
    final ids = [for (final p in plans) p.childId];
    final released = _releaseOtherChildren(ids);
    if (released.isNotEmpty) {
      try {
        final bases = {for (final id in released) id - ((id - vaccineChildBaseId) % vaccineChildStride)};
        for (final base in bases) {
          await scheduler.clearLocalNotificationNamespaces('$_vaccineNamespace$base', _rangeIds(base));
        }
      } catch (_) {}
    }
    final results = <VaccineReminderResult>[];
    for (final plan in plans) {
      final baseId = vaccineChildBase(plan.childId, ids);
      if (baseId == null) continue;
      final slots = vaccineReminderSlots(plan.doses, at, baseId);
      results.add(await sync(slots, plan.text, ask: false, baseId: baseId));
    }
    if (results.contains('scheduled')) return 'scheduled';
    if (results.contains('denied')) return 'denied';
    if (results.contains('unavailable')) return 'unavailable';
    return 'cleared';
  }

  /// False when the app-start refresh already ran with this stamp (account + day + language).
  bool refreshDue(String stamp) {
    try {
      return store.getItem(vaccineRefreshKey) != stamp;
    } catch (_) {
      return true;
    }
  }

  void markRefresh(String stamp) {
    try {
      store.setItem(vaccineRefreshKey, stamp);
    } catch (_) {}
  }
}

/// One child's input for the app-start refresh.
class ChildReminderPlan {
  const ChildReminderPlan({required this.childId, required this.doses, required this.text});
  final String childId;
  final List<ReminderDose> doses;
  final ({String title, String body}) Function(VaccineReminderSlot slot) text;
}

/// The day a dose is due (local midnight), mirroring vaccineStatus' start of the window; null when unknown.
DateTime? vaccineDueDate(ScheduleLike row, String birthDate, Map<String, VaccinationLike> logs) {
  final birth = parseIsoDateFns(birthDate);
  if (birth == null) return null;
  final timing = vaccineTiming(row);
  if (timing == null) return startOfDay(addDays(birth, row.recommendedAgeDays.toInt()));
  if (timing.kind != 'routine') return null;
  var start = calendarOffsetDate(birthDate, timing.age)!;
  if (timing.relative != null && timing.relativeScheduleId != null) {
    final earlier = logs[timing.relativeScheduleId!]?.administeredAt;
    if (earlier == null || earlier.isEmpty || parseIsoDateFns(earlier) == null) return null;
    final intervalStart = calendarOffsetDate(earlier, timing.relativeMin!)!;
    if (intervalStart.isAfter(start)) start = intervalStart;
  }
  return startOfDay(start);
}

class ReminderDose {
  const ReminderDose({required this.id, required this.status, required this.due});
  final String id;
  final VaccineStatus status;
  final DateTime? due;
}

/// 'soon' | 'today' | 'overdue'
typedef VaccineReminderKind = String;

class VaccineReminderSlot {
  const VaccineReminderSlot({required this.id, required this.at, required this.doseId, required this.kind});
  final int id;
  final DateTime at;
  final String doseId;
  final VaccineReminderKind kind;
}

DateTime _at10(DateTime day) => DateTime(day.year, day.month, day.day, reminderHour);

/// Which reminders should exist now (pure; local time).
List<VaccineReminderSlot> vaccineReminderSlots(List<ReminderDose> doses, [DateTime? now, int baseId = vaccineReminderBaseId]) {
  final at = now ?? DomainClock.now();
  final today = startOfDay(at);
  final upcoming = <({DateTime at, String doseId, String kind})>[];
  for (final d in doses) {
    if ((d.status != 'pending' && d.status != 'future') || d.due == null) continue;
    final inDays = differenceInCalendarDays(d.due!, today);
    if (inDays < 0 || inDays > upcomingDays) continue;
    final soon = _at10(addDays(d.due!, -3)), onDay = _at10(d.due!);
    if (soon.isAfter(at)) upcoming.add((at: soon, doseId: d.id, kind: 'soon'));
    if (onDay.isAfter(at)) upcoming.add((at: onDay, doseId: d.id, kind: 'today'));
  }
  final sortedUpcoming = jsSorted(upcoming, (a, b) {
    final t = a.at.millisecondsSinceEpoch - b.at.millisecondsSinceEpoch;
    return t != 0 ? t : a.doseId.compareTo(b.doseId);
  });

  final overdue = <({DateTime at, String doseId, String kind})>[];
  final usedDays = <String>{};
  final late = jsSorted(
    doses.where((d) => d.status == 'overdue' && d.due != null && differenceInCalendarDays(today, d.due!) <= overdueLookbackDays),
    (a, b) {
      final t = a.due!.millisecondsSinceEpoch - b.due!.millisecondsSinceEpoch;
      return t != 0 ? t : a.id.compareTo(b.id);
    },
  );
  for (final d in late) {
    if (overdue.length >= maxOverdue) break;
    // Next occurrence of the due date's weekday at 10:00: stable across reschedules, so at most once a week.
    var next = _at10(addDays(today, ((d.due!.weekday % 7) - (today.weekday % 7) + 7) % 7));
    if (!next.isAfter(at)) next = addDays(next, 7);
    final key = formatYmd(next);
    if (usedDays.contains(key)) continue;
    usedDays.add(key);
    overdue.add((at: next, doseId: d.id, kind: 'overdue'));
  }
  final all = [...sortedUpcoming.take(maxUpcoming), ...overdue];
  return [for (var i = 0; i < all.length; i++) VaccineReminderSlot(id: baseId + i, at: all[i].at, doseId: all[i].doseId, kind: all[i].kind)];
}

/// Stable key: reschedule only when the planned reminders (or their language) change.
String vaccineSlotsKey(List<VaccineReminderSlot> slots, [String extra = '']) {
  final body = slots.map((s) => '${s.doseId}:${s.kind}@${s.at.millisecondsSinceEpoch}').join('|');
  return '$extra|${body.isEmpty ? 'none' : body}';
}

final vaccineRemindersProvider = Provider<VaccineReminders>(
  (ref) => VaccineReminders(ref.watch(localStoreProvider), ref.watch(vaccineNotificationSchedulerProvider)),
  name: 'vaccineRemindersProvider',
);
