// Ported from: src/lib/vaccine-schedule.ts
//
// Regional vaccination schedules: calendar-month offsets (date-fns addMonths clamps month ends; addDays keeps
// civil days across DST), reviewed timing metadata, cohort/gender rules and the dose status.

import '../common/app_languages.dart';
import '../js_compat.dart';

class CalendarOffset {
  const CalendarOffset({required this.months, required this.days});
  final int months;
  final int days;

  static CalendarOffset? fromJson(Object? v) {
    if (v is! Map) return null;
    final m = v['months'], d = v['days'];
    if (!jsIsInteger(m) || !jsIsInteger(d)) return null;
    return CalendarOffset(months: (m as num).toInt(), days: (d as num).toInt());
  }
}

bool _offsetValid(Object? value) {
  if (value is! Map) return false;
  final m = value['months'], d = value['days'];
  return jsIsInteger(m) && (m as num) >= 0 && m <= 240 && jsIsInteger(d) && (d as num) >= -1 && d <= 7300;
}

/// schedule_meta (protocol anacan-vaccine-schedule-v1), validated against its schedule row.
class VaccineTiming {
  const VaccineTiming(this.raw);
  final Map<String, Object?> raw;

  /// 'routine' | 'conditional' | 'seasonal'
  String get kind => raw['kind']! as String;
  CalendarOffset get age => CalendarOffset.fromJson(raw['age'])!;
  CalendarOffset? get endAge => CalendarOffset.fromJson(raw['end_age']);
  String? get gender => raw['gender'] as String?;
  String? get bornFrom => raw['born_from'] as String?;
  Map<String, Object?>? get relative => (raw['relative'] as Map?)?.cast<String, Object?>();
  String? get relativeScheduleId => relative?['schedule_id'] as String?;
  CalendarOffset? get relativeMin => CalendarOffset.fromJson(relative?['min']);
  CalendarOffset? get relativeMax => CalendarOffset.fromJson(relative?['max']);
}

/// vaccine_schedule row (DB field names).
class ScheduleLike {
  const ScheduleLike({
    required this.id,
    required this.doseNumber,
    required this.recommendedAgeDays,
    this.minAgeDays,
    this.maxAgeDays,
    this.scheduleMeta,
  });
  final String id;
  final num doseNumber;
  final num recommendedAgeDays;
  final num? minAgeDays;
  final num? maxAgeDays;
  final Object? scheduleMeta;

  factory ScheduleLike.fromJson(Map<String, Object?> j) => ScheduleLike(
        id: j['id']! as String,
        doseNumber: j['dose_number']! as num,
        recommendedAgeDays: j['recommended_age_days']! as num,
        minAgeDays: j['min_age_days'] as num?,
        maxAgeDays: j['max_age_days'] as num?,
        scheduleMeta: j['schedule_meta'],
      );
}

class VaccinationLike {
  const VaccinationLike({this.administeredAt, this.isSkipped = false});
  final String? administeredAt;
  final bool isSkipped;
}

/// 'done' | 'skipped' | 'overdue' | 'pending' | 'future' | 'conditional' | 'seasonal' | 'interval'
typedef VaccineStatus = String;

VaccineTiming? vaccineTiming(ScheduleLike row) {
  final meta = row.scheduleMeta;
  if (meta is! Map) return null;
  if (meta['protocol'] != 'anacan-vaccine-schedule-v1' || !const ['routine', 'conditional', 'seasonal'].contains(meta['kind'])) {
    return null;
  }
  if (meta['expected_age_days'] != row.recommendedAgeDays || meta['expected_dose_number'] != row.doseNumber) return null;
  if (!_offsetValid(meta['age']) || (meta['end_age'] != null && !_offsetValid(meta['end_age']))) return null;
  final rel = meta['relative'];
  if (rel != null && rel != false && rel != 0 && rel != '') {
    if (rel is! Map) return null;
    final sid = rel['schedule_id'];
    if (sid == null || sid == '' || sid == row.id || !_offsetValid(rel['min'])) return null;
    final max = rel['max'];
    if (max != null && max != false && max != 0 && max != '' && !_offsetValid(max)) return null;
  }
  return VaccineTiming(meta.cast<String, Object?>());
}

/// Explicit child/account/stored country first (first 2-letter value), else the app language's country.
String regionalCountry(String language, [List<String?> selected = const []]) {
  for (final v in selected) {
    if (v != null && RegExp(r'^[a-z]{2}$', caseSensitive: false).hasMatch(v)) return v.toUpperCase();
  }
  return appLanguageFlag(language).toUpperCase();
}

/// Calendar offset from a date-only (or ISO) string; null when [iso] is invalid (JS: Invalid Date).
DateTime? calendarOffsetDate(String iso, CalendarOffset offset) {
  final d = parseIsoDateFns(iso);
  if (d == null) return null;
  return addDays(addMonths(d, offset.months), offset.days);
}

bool vaccineEligible(ScheduleLike row, String birthDate, String gender, [VaccinationLike? log]) {
  if ((log?.administeredAt?.isNotEmpty ?? false) || (log?.isSkipped ?? false)) return true;
  final timing = vaccineTiming(row);
  if (timing == null) return true;
  final g = timing.gender;
  if (g != null && g.isNotEmpty && gender != g) return false;
  final from = timing.bornFrom;
  return from == null || from.isEmpty || birthDate.compareTo(from) >= 0;
}

VaccineStatus vaccineStatus(ScheduleLike row, String birthDate, Map<String, VaccinationLike> logs, [DateTime? today]) {
  final now = today ?? DomainClock.now();
  final log = logs[row.id];
  if (log?.administeredAt?.isNotEmpty ?? false) return 'done';
  if (log?.isSkipped ?? false) return 'skipped';
  final birth = parseIsoDateFns(birthDate);
  if (birth == null || differenceInCalendarDays(now, birth) < 0) return 'future';
  final timing = vaccineTiming(row);
  if (timing == null) {
    final age = differenceInCalendarDays(now, birth);
    if (age > (row.maxAgeDays ?? row.recommendedAgeDays + 60)) return 'overdue';
    return age >= (row.minAgeDays ?? row.recommendedAgeDays) ? 'pending' : 'future';
  }
  if (timing.kind != 'routine') return timing.kind;
  var start = calendarOffsetDate(birthDate, timing.age)!;
  var end = timing.endAge != null ? calendarOffsetDate(birthDate, timing.endAge!) : null;
  if (timing.relative != null && timing.relativeScheduleId != null) {
    final earlier = logs[timing.relativeScheduleId!]?.administeredAt;
    if (earlier == null || earlier.isEmpty || parseIsoDateFns(earlier) == null) return 'interval';
    final intervalStart = calendarOffsetDate(earlier, timing.relativeMin!)!;
    if (intervalStart.isAfter(start)) start = intervalStart;
    end = timing.relativeMax != null ? calendarOffsetDate(earlier, timing.relativeMax!) : null;
  }
  if (differenceInCalendarDays(now, start) < 0) return 'future';
  if (end != null && differenceInCalendarDays(now, end) > 0) return 'overdue';
  return 'pending';
}
