// Ported from: src/lib/health-report-data.ts
//
// Source data of the doctor report: the period range, the tracker rows (kept as `Map` rows with the column names
// of the select), averages over recorded values only, baby care summary and coverage, and the paged reader.
import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart';

/// '1week' | '1month' | '3months' | 'all'.
typedef ReportPeriod = String;
typedef ReportRowMap = Map<String, dynamic>;

@immutable
class ReportRange {
  const ReportRange({required this.start, required this.end, required this.startDay, required this.endDay});
  final DateTime? start;
  final DateTime end;
  final String? startDay;
  final String endDay;

  Map<String, Object?> toJson() => {
        'start': start == null ? null : jsToIsoString(start!),
        'end': jsToIsoString(end),
        'startDay': startDay,
        'endDay': endDay,
      };
}

/// `{ range, weights, daily, exercises, bloodPressure, fetal, periodDays, baby }`.
@immutable
class HealthReportSnapshot {
  const HealthReportSnapshot({
    required this.range,
    this.weights = const [],
    this.daily = const [],
    this.exercises = const [],
    this.bloodPressure = const [],
    this.fetal = const [],
    this.periodDays = const [],
    this.baby = const [],
  });
  final ReportRange range;
  final List<ReportRowMap> weights;
  final List<ReportRowMap> daily;
  final List<ReportRowMap> exercises;
  final List<ReportRowMap> bloodPressure;
  final List<ReportRowMap> fetal;
  final List<ReportRowMap> periodDays;
  final List<ReportRowMap> baby;

  /// The persisted (JSON) form: dates become ISO strings, like `JSON.stringify`.
  Map<String, Object?> toJson() => {
        'range': range.toJson(),
        'weights': weights,
        'daily': daily,
        'exercises': exercises,
        'bloodPressure': bloodPressure,
        'fetal': fetal,
        'periodDays': periodDays,
        'baby': baby,
      };
}

List<ReportRowMap> _list(Object? v) => v is List ? [for (final r in v) if (r is Map) Map<String, dynamic>.from(r)] : const [];

/// `rehydrateReportSnapshot`: a persisted snapshot gets its range dates back before any age / duration math.
HealthReportSnapshot rehydrateReportSnapshot(Object? json) {
  if (json is HealthReportSnapshot) return json;
  final m = (json as Map).cast<String, Object?>();
  final r = (m['range']! as Map).cast<String, Object?>();
  DateTime? date(Object? v) => v is DateTime ? v : (v is String ? jsParseDate(v)?.toLocal() : null);
  return HealthReportSnapshot(
    range: ReportRange(start: date(r['start']), end: date(r['end'])!, startDay: r['startDay'] as String?, endDay: r['endDay']! as String),
    weights: _list(m['weights']),
    daily: _list(m['daily']),
    exercises: _list(m['exercises']),
    bloodPressure: _list(m['bloodPressure']),
    fetal: _list(m['fetal']),
    periodDays: _list(m['periodDays']),
    baby: _list(m['baby']),
  );
}

/// `getReportRange(period, now)`: seven calendar days, calendar months, or everything (no start).
ReportRange getReportRange(ReportPeriod period, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  final start = period == 'all' ? null : startOfDay(period == '1week' ? subDays(n, 6) : subMonths(n, period == '3months' ? 3 : 1));
  return ReportRange(start: start, end: n, startDay: start == null ? null : formatYmd(start), endDay: formatYmd(n));
}

/// `finiteMeasurement(value)`: null / undefined / '' / non-numbers → null.
double? finiteMeasurement(Object? value) {
  if (value == null || value == '') return null;
  final n = jsNumber(value);
  return n.isFinite ? n : null;
}

/// Mean over the recorded values only (missing days are not zeros).
({double? value, int count}) meanRecorded(Iterable<Object?> values) {
  final measured = [for (final v in values) ?finiteMeasurement(v)];
  return (value: measured.isEmpty ? null : measured.reduce((a, b) => a + b) / measured.length, count: measured.length);
}

DateTime? _local(Object? iso) => iso is String ? jsParseDate(iso)?.toLocal() : null;

/// `summarizeBabyCare(logs, range)`.
@immutable
class BabyCareSummary {
  const BabyCareSummary({
    required this.sleepMinutes,
    required this.sleepDays,
    required this.sleepAverage,
    required this.completedSleep,
    required this.ongoingSleep,
    required this.feeding,
    required this.feedingDays,
    required this.feedingAverage,
    required this.breast,
    required this.formula,
    required this.solid,
    required this.unknownFeeding,
    required this.formulaMl,
    required this.formulaAmounts,
    required this.diapers,
    required this.diaperDays,
    required this.diaperAverage,
    required this.wet,
    required this.dirty,
    required this.mixed,
    required this.unknownDiapers,
  });
  final double sleepMinutes;
  final int sleepDays;
  final double? sleepAverage;
  final int completedSleep;
  final int ongoingSleep;
  final int feeding;
  final int feedingDays;
  final double? feedingAverage;
  final int breast;
  final int formula;
  final int solid;
  final int unknownFeeding;
  final double formulaMl;
  final int formulaAmounts;
  final int diapers;
  final int diaperDays;
  final double? diaperAverage;
  final int wet;
  final int dirty;
  final int mixed;
  final int unknownDiapers;
}

const List<String> _breastTypes = ['breast', 'breastfeeding', 'breast_left', 'breast_right', 'left', 'right'];

BabyCareSummary summarizeBabyCare(List<ReportRowMap> logs, ReportRange range) {
  final sleepByDay = <String, double>{};
  final feedingDays = <String>{}, diaperDays = <String>{};
  var feeding = 0, breast = 0, formula = 0, solid = 0, unknownFeeding = 0, diapers = 0, wet = 0, dirty = 0, mixed = 0, unknownDiapers = 0;
  var formulaMl = 0.0, formulaAmounts = 0, completedSleep = 0, ongoingSleep = 0;
  // `-Infinity` without a start: the earliest JS date.
  final from = range.start?.millisecondsSinceEpoch ?? -8640000000000000;
  final to = range.end.millisecondsSinceEpoch;
  for (final log in logs) {
    final startDate = _local(log['start_time']);
    if (startDate == null) continue;
    final start = startDate.millisecondsSinceEpoch;
    if (start > to) continue;
    if (log['log_type'] == 'sleep') {
      final endTime = log['end_time'];
      if (endTime == null || endTime == '') {
        ongoingSleep++;
        continue;
      }
      final endDate = _local(endTime);
      if (endDate == null) continue;
      final end = endDate.millisecondsSinceEpoch;
      if (end <= start || end <= from) continue;
      final clippedEnd = end < to ? end : to;
      var cursor = start > from ? start : from;
      if (cursor >= clippedEnd) continue;
      completedSleep++;
      while (cursor < clippedEnd) {
        final at = DateTime.fromMillisecondsSinceEpoch(cursor);
        final day = formatYmd(at);
        final boundary = startOfDay(addDays(at, 1)).millisecondsSinceEpoch;
        final stop = boundary < clippedEnd ? boundary : clippedEnd;
        sleepByDay[day] = (sleepByDay[day] ?? 0) + (stop - cursor) / 60000;
        cursor = stop;
      }
      continue;
    }
    if (start < from) continue;
    final day = formatYmd(startDate);
    final feedType = log['feed_type'] is String ? log['feed_type'] as String : '';
    final diaperType = log['diaper_type'] is String ? log['diaper_type'] as String : '';
    if (log['log_type'] == 'feeding') {
      feeding++;
      feedingDays.add(day);
      if (_breastTypes.contains(feedType)) {
        breast++;
      } else if (feedType == 'formula') {
        formula++;
        final notes = log['notes'] is String ? log['notes'] as String : null;
        final legacyAmount = notes == null ? null : RegExp(r'(\d+(?:[.,]\d+)?)\s*ml\b', caseSensitive: false).firstMatch(notes)?[1]?.replaceFirst(',', '.');
        final amount = finiteMeasurement(log['amount_ml'] ?? legacyAmount);
        if (amount != null && amount >= 0) {
          formulaMl += amount;
          formulaAmounts++;
        }
      } else if (feedType == 'solid') {
        solid++;
      } else {
        unknownFeeding++;
      }
    } else if (log['log_type'] == 'diaper') {
      diapers++;
      diaperDays.add(day);
      if (diaperType == 'wet') {
        wet++;
      } else if (diaperType == 'dirty') {
        dirty++;
      } else if (diaperType == 'mixed' || diaperType == 'both') {
        mixed++;
      } else {
        unknownDiapers++;
      }
    }
  }
  final sleepMinutes = sleepByDay.values.fold<double>(0, (a, b) => a + b);
  return BabyCareSummary(
    sleepMinutes: sleepMinutes,
    sleepDays: sleepByDay.length,
    sleepAverage: sleepByDay.isEmpty ? null : sleepMinutes / sleepByDay.length,
    completedSleep: completedSleep,
    ongoingSleep: ongoingSleep,
    feeding: feeding,
    feedingDays: feedingDays.length,
    feedingAverage: feedingDays.isEmpty ? null : feeding / feedingDays.length,
    breast: breast,
    formula: formula,
    solid: solid,
    unknownFeeding: unknownFeeding,
    formulaMl: formulaMl,
    formulaAmounts: formulaAmounts,
    diapers: diapers,
    diaperDays: diaperDays.length,
    diaperAverage: diaperDays.isEmpty ? null : diapers / diaperDays.length,
    wet: wet,
    dirty: dirty,
    mixed: mixed,
    unknownDiapers: unknownDiapers,
  );
}

String _localDay(Object? iso) {
  final d = iso is String ? parseIsoDateFns(iso) : null;
  return d == null ? '' : formatYmd(d.toLocal());
}

/// `reportCoverage(snapshot)`.
({int total, int recordedDays, int? calendarDays}) reportCoverage(HealthReportSnapshot s) {
  final days = <String>{};
  for (final r in s.weights) {
    days.add('${r['entry_date']}');
  }
  for (final r in s.daily) {
    days.add('${r['log_date']}');
  }
  for (final r in s.exercises) {
    days.add(_localDay(r['completed_at']));
  }
  for (final r in s.bloodPressure) {
    days.add(_localDay(r['measured_at']));
  }
  for (final r in s.fetal) {
    days.add('${r['scan_date']}');
  }
  for (final r in s.periodDays) {
    days.add('${r['log_date']}');
  }
  for (final r in s.baby) {
    final day = _localDay(r['start_time']);
    final startDay = s.range.startDay;
    if ((startDay == null || day.compareTo(startDay) >= 0) && day.compareTo(s.range.endDay) <= 0) days.add(day);
  }
  final total = s.weights.length + s.daily.length + s.exercises.length + s.bloodPressure.length + s.fetal.length + s.periodDays.length + s.baby.length;
  return (
    total: total,
    recordedDays: days.length,
    calendarDays: s.range.start == null ? null : differenceInCalendarDays(s.range.end, s.range.start!) + 1,
  );
}

/// PostgREST returns at most one page. Reports must not silently omit older records.
Future<List<T>> fetchAllReportRows<T>(Future<List<T>> Function(int from, int to) fetchPage, [int pageSize = 1000]) async {
  final rows = <T>[];
  for (var from = 0;; from += pageSize) {
    final page = await fetchPage(from, from + pageSize - 1);
    rows.addAll(page);
    if (page.length < pageSize) return rows;
  }
}
