// Ported from: src/hooks/useVitaminSchedules.ts (models + "taken today"), src/components/tools/VitaminTracker.tsx
// (progress, day toggles, time display), scripts/notification-jobs/vitamin-zones.mjs (reminder slice per zone)
//
// "Taken today" uses the phone's local day (vitamin_intake_logs.log_date). Reminders are sent by the server job;
// [vitaminSlicesForZone] is its slicing logic with the zone offset injected (Dart has no IANA zone database).

import '../js_compat.dart';

/// public.user_vitamin_schedules row.
class VitaminSchedule {
  const VitaminSchedule({
    required this.id,
    required this.userId,
    required this.vitaminName,
    required this.iconEmoji,
    required this.scheduledTime,
    required this.daysOfWeek,
    required this.isActive,
    required this.notificationEnabled,
    this.createdAt = '',
    this.updatedAt = '',
  });
  final String id;
  final String userId;
  final String vitaminName;
  final String iconEmoji;

  /// HH:MM:SS
  final String scheduledTime;
  final List<int> daysOfWeek;
  final bool isActive;
  final bool notificationEnabled;
  final String createdAt;
  final String updatedAt;

  factory VitaminSchedule.fromJson(Map<String, Object?> j) => VitaminSchedule(
        id: j['id']! as String,
        userId: j['user_id']! as String,
        vitaminName: j['vitamin_name']! as String,
        iconEmoji: (j['icon_emoji'] ?? '') as String,
        scheduledTime: j['scheduled_time']! as String,
        daysOfWeek: [for (final d in (j['days_of_week'] as List? ?? const [])) (d as num).toInt()],
        isActive: j['is_active'] == true,
        notificationEnabled: j['notification_enabled'] == true,
        createdAt: (j['created_at'] ?? '') as String,
        updatedAt: (j['updated_at'] ?? '') as String,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'user_id': userId,
        'vitamin_name': vitaminName,
        'icon_emoji': iconEmoji,
        'scheduled_time': scheduledTime,
        'days_of_week': daysOfWeek,
        'is_active': isActive,
        'notification_enabled': notificationEnabled,
        'created_at': createdAt,
        'updated_at': updatedAt,
      };
}

/// public.vitamin_intake_logs row.
class VitaminIntakeLog {
  const VitaminIntakeLog({
    required this.id,
    required this.userId,
    required this.scheduleId,
    required this.vitaminName,
    required this.takenAt,
    required this.logDate,
    this.createdAt = '',
  });
  final String id;
  final String userId;
  final String scheduleId;
  final String vitaminName;
  final String takenAt;
  final String logDate;
  final String createdAt;

  factory VitaminIntakeLog.fromJson(Map<String, Object?> j) => VitaminIntakeLog(
        id: j['id']! as String,
        userId: j['user_id']! as String,
        scheduleId: j['schedule_id']! as String,
        vitaminName: j['vitamin_name']! as String,
        takenAt: j['taken_at']! as String,
        logDate: j['log_date']! as String,
        createdAt: (j['created_at'] ?? '') as String,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'user_id': userId,
        'schedule_id': scheduleId,
        'vitamin_name': vitaminName,
        'taken_at': takenAt,
        'log_date': logDate,
        'created_at': createdAt,
      };
}

bool isVitaminTakenToday(List<VitaminIntakeLog> todayLogs, String scheduleId) => todayLogs.any((l) => l.scheduleId == scheduleId);

VitaminIntakeLog? intakeLogFor(List<VitaminIntakeLog> todayLogs, String scheduleId) {
  for (final l in todayLogs) {
    if (l.scheduleId == scheduleId) return l;
  }
  return null;
}

/// Taken / total over active schedules, and the progress percentage (0 when nothing is active).
({int taken, int total, double progress}) vitaminProgress(List<VitaminSchedule> schedules, List<VitaminIntakeLog> todayLogs) {
  final active = schedules.where((s) => s.isActive).toList();
  final taken = active.where((s) => isVitaminTakenToday(todayLogs, s.id)).length;
  return (taken: taken, total: active.length, progress: active.isNotEmpty ? taken / active.length * 100 : 0);
}

/// Day picker toggle: removes the day, or adds it and sorts. JS `.sort()` without a comparator compares the
/// numbers as strings; for the weekdays 0-6 that is numeric order.
List<int> toggleVitaminDay(List<int> days, int day) => days.contains(day)
    ? days.where((d) => d != day).toList()
    : jsSorted([...days, day], (int a, int b) => a.toString().compareTo(b.toString()));

/// "08:00:00" → "08:00".
String formatVitaminTime(String time) {
  final parts = time.split(':');
  return '${parts[0]}:${parts.length > 1 ? parts[1] : 'undefined'}';
}

// ── Server reminder slices (scripts/notification-jobs/vitamin-zones.mjs) ──────────────────────────────

const int vitaminStepMinutes = 5;
const int vitaminLeadMinutes = 5;
const String defaultVitaminTimeZone = 'Asia/Baku';

/// Offset of a zone (minutes east of UTC) at an instant; Asia/Baku is a fixed +240.
typedef ZoneOffsetAt = int Function(DateTime utcInstant);

int bakuOffset(DateTime _) => 240;

class VitaminSlice {
  const VitaminSlice({required this.from, required this.to, required this.date, required this.dow});
  final String from;
  final String to;
  final String date;
  final int dow;

  Map<String, Object?> toJson() => {'from': from, 'to': to, 'date': date, 'dow': dow};
}

String _hhmm(int minutes) => '${pad2(minutes ~/ 60)}:${pad2(minutes % 60)}:00';

/// Half-open local time ranges of this 5-minute run (`to` '24:00:00' = end of day), split at local midnight,
/// each with its local date and weekday (0 = Sunday).
List<VitaminSlice> vitaminSlicesForZone(DateTime now, [ZoneOffsetAt offsetAt = bakuOffset]) {
  const stepMs = vitaminStepMinutes * 60000;
  final tickMs = (now.millisecondsSinceEpoch / stepMs).floor() * stepMs;
  final tick = DateTime.fromMillisecondsSinceEpoch(tickMs, isUtc: true);
  final local = tick.add(Duration(minutes: offsetAt(tick)));
  final dayStart = DateTime.utc(local.year, local.month, local.day).millisecondsSinceEpoch;
  final start = local.hour * 60 + local.minute + vitaminLeadMinutes - 2;
  final end = start + vitaminStepMinutes;
  final slices = <VitaminSlice>[];
  for (var day = (start / 1440).floor(); day * 1440 < end; day++) {
    final from = (start > day * 1440 ? start : day * 1440) - day * 1440;
    final to = (end < (day + 1) * 1440 ? end : (day + 1) * 1440) - day * 1440;
    final date = DateTime.fromMillisecondsSinceEpoch(dayStart + day * 86400000, isUtc: true);
    slices.add(VitaminSlice(
      from: _hhmm(from),
      to: to == 1440 ? '24:00:00' : _hhmm(to),
      date: jsToIsoString(date).substring(0, 10),
      dow: date.weekday % 7,
    ));
  }
  return slices;
}
