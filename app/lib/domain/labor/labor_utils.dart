// Ported from: src/lib/laborUtils.ts
//
// Contraction maths from timestamps (start_time + duration), never timer ticks: the 5-1-1 "go to the hospital"
// rule, averages, the offline queue and the lock-screen live phase.

import 'dart:convert';

import '../js_compat.dart';

class TimedContraction {
  const TimedContraction({required this.startTime, required this.durationSeconds, this.id});
  final String startTime;
  final num durationSeconds;
  final String? id;
}

/// 5-1-1 thresholds (with tap-timing slack).
abstract final class Rule511 {
  static const int maxGapSeconds = 330;
  static const int minAvgDurationSeconds = 50;
  static const int minSpanSeconds = 55 * 60;
  static const int maxSinceLastStartSeconds = 15 * 60;
}

/// Start-to-start gaps longer than this are a pause, not labour frequency.
const int maxIntervalSeconds = 60 * 60;

double _startMs(String startTime) => jsDateParseMs(startTime)?.toDouble() ?? double.nan;

/// Valid entries, newest first (stable sort).
List<T> sortNewestFirst<T extends TimedContraction>(List<T> list) => jsSorted(
      list.where((c) => _startMs(c.startTime).isFinite && c.durationSeconds.isFinite && c.durationSeconds >= 0),
      (T a, T b) => _startMs(b.startTime) - _startMs(a.startTime),
    );

/// Start-to-start interval in whole seconds, or null without a recent previous contraction.
int? startToStartSeconds(num? previousStartMs, num currentStartMs) {
  if (previousStartMs == null || !previousStartMs.isFinite) return null;
  final diff = (currentStartMs - previousStartMs) / 1000;
  if (diff <= 0 || diff > maxIntervalSeconds) return null;
  return jsRoundInt(diff);
}

/// True when the recent contractions meet the 5-1-1 rule.
bool evaluate511(List<TimedContraction> list, [int? now]) {
  final n = now ?? DomainClock.nowMs();
  final sorted = sortNewestFirst(list);
  if (sorted.length < 2) return false;
  final newest = sorted[0];
  if ((n - _startMs(newest.startTime)) / 1000 > Rule511.maxSinceLastStartSeconds) return false;
  final run = <TimedContraction>[newest];
  for (var i = 1; i < sorted.length; i++) {
    final gap = (_startMs(run.last.startTime) - _startMs(sorted[i].startTime)) / 1000;
    if (gap <= 0) continue;
    if (gap > Rule511.maxGapSeconds) break;
    run.add(sorted[i]);
  }
  final span = (_startMs(run.first.startTime) - _startMs(run.last.startTime)) / 1000;
  if (span < Rule511.minSpanSeconds) return false;
  final avg = run.fold<num>(0, (s, c) => s + c.durationSeconds) / run.length;
  return avg >= Rule511.minAvgDurationSeconds;
}

class ContractionStats {
  const ContractionStats({required this.avgDuration, required this.avgInterval, required this.is511, required this.count});
  final int avgDuration;
  final int avgInterval;
  final bool is511;
  final int count;

  Map<String, Object?> toJson() => {'avgDuration': avgDuration, 'avgInterval': avgInterval, 'is511': is511, 'count': count};
}

/// Averages over the 5 newest contractions; gaps over an hour are left out of the interval.
ContractionStats computeContractionStats(List<TimedContraction> list, [int? now]) {
  final n = now ?? DomainClock.nowMs();
  final sorted = sortNewestFirst(list);
  final recent = sorted.take(5).toList();
  if (recent.isEmpty) return const ContractionStats(avgDuration: 0, avgInterval: 0, is511: false, count: 0);
  final avgDuration = jsRoundInt(recent.fold<num>(0, (s, c) => s + c.durationSeconds) / recent.length);
  final gaps = <int>[];
  for (var i = 0; i < recent.length - 1; i++) {
    final gap = startToStartSeconds(_startMs(recent[i + 1].startTime), _startMs(recent[i].startTime));
    if (gap != null) gaps.add(gap);
  }
  final avgInterval = gaps.isNotEmpty ? jsRoundInt(gaps.reduce((a, b) => a + b) / gaps.length) : 0;
  return ContractionStats(avgDuration: avgDuration, avgInterval: avgInterval, is511: evaluate511(sorted, n), count: sorted.length);
}

// ── Offline queue ───────────────────────────────────────────────────────────────────────────────

class QueuedContraction extends TimedContraction {
  const QueuedContraction({
    required String super.id,
    required super.startTime,
    required super.durationSeconds,
    required this.intervalSeconds,
  });
  final num? intervalSeconds;

  @override
  String get id => super.id!;

  Map<String, Object?> toJson() =>
      {'id': id, 'start_time': startTime, 'duration_seconds': durationSeconds, 'interval_seconds': intervalSeconds};
}

/// Same contraction when the ids match or the start times are within a second.
bool isSameContraction({String? aId, required String aStart, String? bId, required String bStart}) {
  if (aId != null && aId.isNotEmpty && bId != null && bId.isNotEmpty && aId == bId) return true;
  return (_startMs(aStart) - _startMs(bStart)).abs() < 1000;
}

/// Queue entries not yet on the server (and not duplicated within the queue).
List<QueuedContraction> pruneQueue(List<QueuedContraction> queue, List<({String id, String startTime})> server) {
  final out = <QueuedContraction>[];
  for (final q in queue) {
    if (server.any((s) => isSameContraction(aId: s.id, aStart: s.startTime, bId: q.id, bStart: q.startTime))) continue;
    if (out.any((o) => isSameContraction(aId: o.id, aStart: o.startTime, bId: q.id, bStart: q.startTime))) continue;
    out.add(q);
  }
  return out;
}

/// A server row or a still-pending local row (`pending: true`).
class MergedContraction {
  const MergedContraction({required this.id, required this.startTime, required this.durationSeconds, this.pending = false, this.row});
  final String id;
  final String startTime;
  final num durationSeconds;
  final bool pending;

  /// The original server row or queue entry.
  final Object? row;
}

/// Server rows plus still-pending local rows, newest first (stable).
List<MergedContraction> mergeWithQueue(List<MergedContraction> server, List<QueuedContraction> queue) {
  final pending = pruneQueue(queue, [for (final s in server) (id: s.id, startTime: s.startTime)])
      .map((q) => MergedContraction(id: q.id, startTime: q.startTime, durationSeconds: q.durationSeconds, pending: true, row: q));
  return jsSorted([...server, ...pending], (MergedContraction a, MergedContraction b) => _startMs(b.startTime) - _startMs(a.startTime));
}

/// Defensive parse of a stored queue.
List<QueuedContraction> parseQueue(String? raw) {
  if (raw == null || raw.isEmpty) return [];
  Object? v;
  try {
    v = jsonDecode(raw);
  } catch (_) {
    return [];
  }
  if (v is! List) return [];
  final out = <QueuedContraction>[];
  for (final q in v) {
    if (q is! Map) continue;
    final id = q['id'], start = q['start_time'], dur = q['duration_seconds'], interval = q['interval_seconds'];
    if (id is! String || start is! String || !_startMs(start).isFinite) continue;
    if (dur is! num || !dur.isFinite) continue;
    if (!(interval == null && q.containsKey('interval_seconds')) && interval is! num) continue;
    out.add(QueuedContraction(id: id, startTime: start, durationSeconds: dur, intervalSeconds: interval as num?));
  }
  return out;
}

// ── Lock-screen live timer phase ─────────────────────────────────────────────────────────────────

class ContractionLivePhase {
  const ContractionLivePhase.active(this.startTime)
      : phase = 'active',
        until = null;
  const ContractionLivePhase.rest(this.startTime, int this.until) : phase = 'rest';

  /// 'active' | 'rest'
  final String phase;
  final int startTime;
  final int? until;
}

/// The running contraction, or the rest since the last one ended (nothing after an hour's pause).
ContractionLivePhase? contractionLivePhase({int? activeStart, int? lastEnd, int? now}) {
  final n = now ?? DomainClock.nowMs();
  if (activeStart != null) return ContractionLivePhase.active(activeStart);
  if (lastEnd != null) {
    final until = lastEnd + maxIntervalSeconds * 1000;
    if (lastEnd <= n + 60000 && n < until) return ContractionLivePhase.rest(lastEnd, until);
  }
  return null;
}
