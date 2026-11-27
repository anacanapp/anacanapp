// Ported from: src/lib/baby-logs-range.ts
//
// Pure statistics over baby_logs rows (feeding / sleep / diaper) for the Baby tracker and Sleep training tools.

import 'dart:math' as math;

import '../js_compat.dart';

/// public.baby_logs row (DB field names).
class BabyLogRow {
  const BabyLogRow({
    required this.id,
    required this.logType,
    required this.startTime,
    this.endTime,
    this.feedType,
    this.diaperType,
    this.notes,
  });
  final String id;
  final String logType;
  final String startTime;
  final String? endTime;
  final String? feedType;
  final String? diaperType;
  final String? notes;

  factory BabyLogRow.fromJson(Map<String, Object?> j) => BabyLogRow(
        id: (j['id'] ?? '') as String,
        logType: j['log_type'] as String,
        startTime: j['start_time'] as String,
        endTime: j['end_time'] as String?,
        feedType: j['feed_type'] as String?,
        diaperType: j['diaper_type'] as String?,
        notes: j['notes'] as String?,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'log_type': logType,
        'start_time': startTime,
        'end_time': endTime,
        'feed_type': feedType,
        'diaper_type': diaperType,
        'notes': notes,
      };
}

/// 'left' | 'right' | 'formula' | 'solid'
typedef FeedKind = String;

/// 'wet' | 'dirty' | 'mixed'
typedef DiaperKind = String;

const int _minute = 60000;

/// `new Date(iso)` (null for an Invalid Date).
DateTime? _d(String iso) => jsParseDate(iso);
double _t(String iso) => _d(iso)?.millisecondsSinceEpoch.toDouble() ?? double.nan;

/// Local calendar day key, e.g. 2026-10-26 (Invalid Date: "NaN-NaN-NaN" like JS).
String dayKey(DateTime? d) => d == null ? 'NaN-NaN-NaN' : '${d.year}-${pad2(d.month)}-${pad2(d.day)}';

DateTime startOfDayOffset(DateTime d, [int offset = 0]) => DateTime(d.year, d.month, d.day + offset);

FeedKind? feedKind(String? feedType) => switch (feedType) {
      'breast_left' || 'left' => 'left',
      'breast_right' || 'right' => 'right',
      'formula' => 'formula',
      'solid' => 'solid',
      _ => null,
    };

DiaperKind? diaperKind(String? t) => t == 'wet' || t == 'dirty' || t == 'mixed' ? t : null;

/// "120 ml" in a formula log's notes → 120.
double? mlFromNotes(String? notes) {
  final m = notes == null || notes.isEmpty
      ? null
      : RegExp(r'(\d+(?:[.,]\d+)?)\s*ml', caseSensitive: false).firstMatch(notes);
  if (m == null) return null;
  final n = jsNumber(m[1]!.replaceFirst(',', '.'));
  return n.isFinite && n > 0 ? n : null;
}

/// Logs that started on the given local day, oldest first.
List<BabyLogRow> logsOfDay(List<BabyLogRow> logs, DateTime day) {
  final key = dayKey(day);
  return jsSorted(logs.where((l) => dayKey(_d(l.startTime)) == key), (BabyLogRow a, BabyLogRow b) => _t(a.startTime) - _t(b.startTime));
}

/// Logs from the last [days] local days (today included).
List<BabyLogRow> logsInWindow(List<BabyLogRow> logs, DateTime now, int days) {
  final from = startOfDayOffset(now, -(days - 1)).millisecondsSinceEpoch;
  return logs.where((l) => _t(l.startTime) >= from).toList();
}

double? _averageGapMinutes(List<double> times) {
  if (times.length < 2) return null;
  double sum = 0;
  for (var i = 1; i < times.length; i++) {
    sum += times[i] - times[i - 1];
  }
  return sum / (times.length - 1) / _minute;
}

class FeedingStats {
  FeedingStats({
    required this.total,
    required this.averageGapMinutes,
    required this.last,
  });
  final int total;
  int left = 0;
  int right = 0;
  double breastMinutes = 0;
  int formulaCount = 0;
  double formulaMl = 0;
  int solidCount = 0;
  final double? averageGapMinutes;
  final ({DateTime at, FeedKind kind})? last;
}

FeedingStats feedingStats(List<BabyLogRow> logs) {
  final feeds = jsSorted(
    [
      for (final log in logs)
        if (log.logType == 'feeding' && feedKind(log.feedType) != null)
          (log: log, kind: feedKind(log.feedType)!, at: _t(log.startTime)),
    ],
    (a, b) => a.at - b.at,
  );
  final s = FeedingStats(
    total: feeds.length,
    averageGapMinutes: _averageGapMinutes(feeds.map((f) => f.at).toList()),
    last: feeds.isEmpty ? null : (at: jsDateFromMs(feeds.last.at), kind: feeds.last.kind),
  );
  for (final f in feeds) {
    if (f.kind == 'left' || f.kind == 'right') {
      if (f.kind == 'left') {
        s.left++;
      } else {
        s.right++;
      }
      final end = f.log.endTime;
      if (end != null && end.isNotEmpty) {
        final m = (_t(end) - _t(f.log.startTime)) / _minute;
        if (m > 0) s.breastMinutes += m;
      }
    } else if (f.kind == 'formula') {
      s.formulaCount++;
      s.formulaMl += mlFromNotes(f.log.notes) ?? 0;
    } else {
      s.solidCount++;
    }
  }
  return s;
}

class SleepSession {
  const SleepSession({required this.id, required this.start, required this.end, required this.minutes});
  final String id;
  final DateTime start;
  final DateTime end;
  final double minutes;
}

class SleepStats {
  const SleepStats({
    required this.sessions,
    required this.totalMinutes,
    required this.averageMinutes,
    required this.longestMinutes,
    required this.lastEnd,
  });
  final List<SleepSession> sessions;
  final double totalMinutes;
  final double? averageMinutes;
  final double? longestMinutes;
  final DateTime? lastEnd;
}

SleepStats sleepStats(List<BabyLogRow> logs) {
  final sessions = jsSorted(
    [
      for (final l in logs)
        if (l.logType == 'sleep' && l.endTime != null && l.endTime!.isNotEmpty && _d(l.startTime) != null && _d(l.endTime!) != null)
          SleepSession(
            id: l.id,
            start: _d(l.startTime)!,
            end: _d(l.endTime!)!,
            minutes: (_t(l.endTime!) - _t(l.startTime)) / _minute,
          ),
    ].where((s) => s.minutes > 0),
    (SleepSession a, SleepSession b) => a.start.millisecondsSinceEpoch - b.start.millisecondsSinceEpoch,
  );
  if (sessions.isEmpty) {
    return SleepStats(sessions: sessions, totalMinutes: 0, averageMinutes: null, longestMinutes: null, lastEnd: null);
  }
  final total = sessions.fold<double>(0, (s, x) => s + x.minutes);
  var lastEnd = sessions[0].end;
  for (final s in sessions) {
    if (s.end.isAfter(lastEnd)) lastEnd = s.end;
  }
  return SleepStats(
    sessions: sessions,
    totalMinutes: total,
    averageMinutes: total / sessions.length,
    longestMinutes: sessions.map((s) => s.minutes).reduce(math.max),
    lastEnd: lastEnd,
  );
}

class DiaperStats {
  DiaperStats({required this.total, required this.averageGapMinutes, required this.last});
  final int total;
  int wet = 0;
  int dirty = 0;
  int mixed = 0;
  final double? averageGapMinutes;
  final DateTime? last;
}

DiaperStats diaperStats(List<BabyLogRow> logs) {
  final items = jsSorted(
    [for (final l in logs) if (l.logType == 'diaper') (kind: diaperKind(l.diaperType), at: _t(l.startTime))],
    (a, b) => a.at - b.at,
  );
  final s = DiaperStats(
    total: items.length,
    averageGapMinutes: _averageGapMinutes(items.map((i) => i.at).toList()),
    last: items.isEmpty || items.last.at.isNaN ? null : jsDateFromMs(items.last.at),
  );
  for (final i in items) {
    switch (i.kind) {
      case 'wet':
        s.wet++;
      case 'dirty':
        s.dirty++;
      case 'mixed':
        s.mixed++;
    }
  }
  return s;
}

class TrendPoint {
  TrendPoint({required this.key, required this.day, this.count = 0, this.minutes = 0});
  final String key;
  final DateTime day;
  int count;
  double minutes;
}

/// Per-day counts (and sleep minutes) for one log type; weekly buckets beyond 30 days.
List<TrendPoint> trendPoints(List<BabyLogRow> logs, String type, DateTime now, int days) {
  final points = <TrendPoint>[];
  for (var i = days - 1; i >= 0; i--) {
    final day = startOfDayOffset(now, -i);
    points.add(TrendPoint(key: dayKey(day), day: day));
  }
  final index = <String, int>{};
  for (var i = 0; i < points.length; i++) {
    index[points[i].key] = i;
  }
  for (final l in logs) {
    if (l.logType != type) continue;
    final i = index[dayKey(_d(l.startTime))];
    if (i == null) continue;
    points[i].count++;
    if (type == 'sleep' && l.endTime != null && l.endTime!.isNotEmpty) {
      final m = (_t(l.endTime!) - _t(l.startTime)) / _minute;
      if (m > 0) points[i].minutes += m;
    }
  }
  if (days <= 30) return points;
  final weeks = <TrendPoint>[];
  for (var i = 0; i < points.length; i += 7) {
    final chunk = points.sublist(i, math.min(i + 7, points.length));
    weeks.add(TrendPoint(
      key: chunk[0].key,
      day: chunk[0].day,
      count: chunk.fold(0, (s, p) => s + p.count),
      minutes: chunk.fold(0.0, (s, p) => s + p.minutes),
    ));
  }
  return weeks;
}

class HistoryRow {
  HistoryRow({required this.key, required this.day});
  final String key;
  final DateTime day;
  int feedings = 0;
  double formulaMl = 0;
  double sleepMinutes = 0;
  int diapers = 0;
}

/// Newest-first daily summary rows for the last [days] days.
List<HistoryRow> dailyHistory(List<BabyLogRow> logs, DateTime now, int days) {
  final rows = <HistoryRow>[];
  for (var i = 0; i < days; i++) {
    final day = startOfDayOffset(now, -i);
    rows.add(HistoryRow(key: dayKey(day), day: day));
  }
  final index = <String, int>{};
  for (var i = 0; i < rows.length; i++) {
    index[rows[i].key] = i;
  }
  for (final l in logs) {
    final i = index[dayKey(_d(l.startTime))];
    if (i == null) continue;
    final row = rows[i], kind = feedKind(l.feedType);
    if (l.logType == 'feeding' && kind != null) {
      row.feedings++;
      if (kind == 'formula') row.formulaMl += mlFromNotes(l.notes) ?? 0;
    } else if (l.logType == 'sleep' && l.endTime != null && l.endTime!.isNotEmpty) {
      final m = (_t(l.endTime!) - _t(l.startTime)) / _minute;
      if (m > 0) row.sleepMinutes += m;
    } else if (l.logType == 'diaper') {
      row.diapers++;
    }
  }
  return rows;
}

/// "1 h 30 min" with localized unit abbreviations.
String formatMinutes(num minutes, {required String hour, required String minute}) {
  final total = math.max(0, jsRoundInt(minutes)), h = total ~/ 60, m = total % 60;
  if (h == 0) return '$m $minute';
  return m == 0 ? '$h $hour' : '$h $hour $m $minute';
}

/// Timer display: 1:05:09 or 5:09.
String formatClockSeconds(num seconds) {
  final s = math.max(0, seconds.floor()), h = s ~/ 3600, m = (s % 3600) ~/ 60, r = s % 60;
  return h > 0 ? '$h:${pad2(m)}:${pad2(r)}' : '$m:${pad2(r)}';
}

String timeOfDay(DateTime d) => '${pad2(d.hour)}:${pad2(d.minute)}';

int minutesBetween(DateTime from, DateTime to) =>
    math.max(0, jsRoundInt((to.millisecondsSinceEpoch - from.millisecondsSinceEpoch) / _minute));
