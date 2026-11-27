// Ported from: src/lib/sleep-predict.ts
//
// "Next nap" prediction: the age wake window learned from the family's logged sleeps of the last 7 days, the rest
// of today's naps and bedtime, and upcoming sleep regressions. Times are local.

import 'dart:math' as math;

import '../js_compat.dart';
import 'sleep_training.dart';

const int _min = 60000;
const int _dayMs = 24 * 60 * _min;

num _clamp(num v, num lo, num hi) => math.min(hi, math.max(lo, v));

num _median(List<num> xs) {
  final s = jsSorted(xs, (num a, num b) => a - b);
  if (s.isEmpty) return 0;
  return s.length.isOdd ? s[(s.length - 1) ~/ 2] : (s[s.length ~/ 2 - 1] + s[s.length ~/ 2]) / 2;
}

const List<double> _windowFactor = [0.85, 1, 1.1, 1.15, 1.2];

/// Each nap of the day allows a slightly longer awake time.
double windowFactor(int napIndex) => _windowFactor[math.min(_windowFactor.length - 1, math.max(0, napIndex))];

int _t(DateTime d) => d.millisecondsSinceEpoch;

/// Daytime awake gaps between logged sleeps (ignores overnight gaps and gaps beyond 6 h).
List<double> awakeGaps(List<SleepEntry> entries, DateTime now, [int days = 7]) {
  final since = _t(now) - days * _dayMs;
  final sorted = jsSorted(entries.where((e) => _t(e.end) >= since), (SleepEntry a, SleepEntry b) => _t(a.start) - _t(b.start));
  final gaps = <double>[];
  for (var i = 1; i < sorted.length; i++) {
    final prevEnd = sorted[i - 1].end, start = sorted[i].start;
    final gap = (_t(start) - _t(prevEnd)) / _min;
    final hour = prevEnd.hour;
    if (gap >= 20 && gap <= 360 && hour >= 6 && hour < 19) gaps.add(gap);
  }
  return gaps;
}

class WakeWindow {
  const WakeWindow({required this.minutes, required this.range, required this.personal, required this.samples});
  final num minutes;
  final List<int> range;
  final double personal;
  final int samples;
}

/// Age norm blended with the family's own median gap (more samples, more weight; capped at 70 %).
WakeWindow personalWakeWindow(List<SleepEntry> entries, AgeBand band, DateTime now) {
  final range = bandNorms[band]!.wakeWindowMinutes;
  final norm = (range[0] + range[1]) / 2;
  final gaps = awakeGaps(entries, now).map((g) => _clamp(g, range[0] * 0.75, range[1] * 1.25)).toList();
  final personal = math.min(0.7, gaps.length / 15);
  final minutes = jsRound(norm * (1 - personal) + (gaps.isNotEmpty ? _median(gaps) : norm) * personal);
  return WakeWindow(minutes: _clamp(minutes, range[0] * 0.75, range[1] * 1.25), range: range, personal: personal, samples: gaps.length);
}

/// 'yawn' | 'stare' | 'rub_eyes' | 'fussy' | 'ears'
typedef SleepyCue = String;
const List<SleepyCue> sleepyCues = ['yawn', 'stare', 'rub_eyes', 'fussy', 'ears'];

/// 'sleeping' | 'early' | 'soon' | 'window' | 'overtired' | 'unknown'
typedef NapState = String;

class NextNap {
  const NextNap({
    required this.state,
    this.lastWake,
    this.awakeMinutes,
    this.windowStart,
    this.windowEnd,
    this.minutesToStart,
    this.progress = 0,
    this.napIndex = 0,
    this.isBedtime = false,
  });
  final NapState state;
  final DateTime? lastWake;
  final int? awakeMinutes;
  final DateTime? windowStart;
  final DateTime? windowEnd;
  final int? minutesToStart;
  final num progress;
  final int napIndex;
  final bool isBedtime;

  NextNap copyWith({NapState? state, Object? windowStart = _keep}) => NextNap(
        state: state ?? this.state,
        lastWake: lastWake,
        awakeMinutes: awakeMinutes,
        windowStart: identical(windowStart, _keep) ? this.windowStart : windowStart as DateTime?,
        windowEnd: windowEnd,
        minutesToStart: minutesToStart,
        progress: progress,
        napIndex: napIndex,
        isBedtime: isBedtime,
      );
}

const Object _keep = Object();

/// Naps that ended today (night sleep excluded).
int napsToday(List<SleepEntry> entries, DateTime now) =>
    entries.where((e) => e.kind == 'nap' && isSameLocalDay(e.end, now) && !e.end.isAfter(now)).length;

DateTime bedtimeFor(AgeBand band, DateTime now) {
  final h = band == '1-3' ? 20 * 60 + 30 : band == '4-6' ? 19 * 60 + 45 : 19 * 60 + 30;
  return DateTime(now.year, now.month, now.day, h ~/ 60, h % 60);
}

/// When the baby will be ready to sleep again; each sleepy cue pulls the window 5 min earlier (at most 15).
NextNap predictNextNap({
  required List<SleepEntry> entries,
  required AgeBand band,
  required DateTime now,
  DateTime? sleepingSince,
  DateTime? morningWake,
  List<SleepyCue>? cues,
}) {
  const empty = NextNap(state: 'unknown');
  if (sleepingSince != null) return empty.copyWith(state: 'sleeping');
  final past = entries.where((e) => !e.end.isAfter(now)).toList();
  final latest = past.isEmpty ? null : past.last;
  DateTime? lastWake = latest != null && _t(now) - _t(latest.end) < 10 * 60 * _min ? latest.end : null;
  if (lastWake == null && morningWake != null && !morningWake.isAfter(now) && isSameLocalDay(morningWake, now)) {
    lastWake = morningWake;
  }
  if (lastWake == null) return empty;

  final ww = personalWakeWindow(entries, band, now);
  final napIndex = napsToday(entries, now);
  final length = ww.minutes * windowFactor(napIndex);
  final shift = math.min(15, (cues?.length ?? 0) * 5);
  var start = jsDateFromMs(_t(lastWake) + (length * 0.92 - shift) * _min);
  var end = jsDateFromMs(_t(lastWake) + (length * 1.08 - shift) * _min);
  final bedtime = bedtimeFor(band, now);
  final isBedtime = _t(start) >= _t(bedtime) - 45 * _min;
  if (isBedtime) {
    start = jsDateFromMs(math.max(_t(bedtime) - 15 * _min, _t(lastWake) + 30 * _min));
    end = jsDateFromMs(_t(start) + 30 * _min);
  }
  final awakeMinutes = jsRoundInt((_t(now) - _t(lastWake)) / _min);
  final minutesToStart = jsRoundInt((_t(start) - _t(now)) / _min);
  final total = (_t(end) - _t(lastWake)) / _min;
  final state = _t(now) > _t(end) + 20 * _min
      ? 'overtired'
      : _t(now) >= _t(start)
          ? 'window'
          : minutesToStart <= 20
              ? 'soon'
              : 'early';
  return NextNap(
    state: state,
    lastWake: lastWake,
    awakeMinutes: awakeMinutes,
    windowStart: start,
    windowEnd: end,
    minutesToStart: minutesToStart,
    progress: _clamp(awakeMinutes / total, 0, 1.3),
    napIndex: napIndex,
    isBedtime: isBedtime,
  );
}

class PlanItem {
  const PlanItem({required this.kind, required this.start, required this.end, required this.status, required this.minutes});

  /// 'nap' | 'bedtime'
  final String kind;
  final DateTime start;
  final DateTime end;

  /// 'done' | 'now' | 'predicted'
  final String status;
  final int minutes;
}

/// Today's naps that already happened plus the predicted rest of the day until bedtime.
List<PlanItem> predictDay({
  required List<SleepEntry> entries,
  required AgeBand band,
  required DateTime now,
  required NextNap next,
  DateTime? sleepingSince,
}) {
  final items = <PlanItem>[
    for (final e in entries)
      if (e.kind == 'nap' && isSameLocalDay(e.start, now))
        PlanItem(kind: 'nap', start: e.start, end: e.end, status: 'done', minutes: e.minutes),
  ];
  final norms = bandNorms[band]!;
  final napLen = jsRoundInt((norms.napMinutes[0] + norms.napMinutes[1]) / 2);
  final bedtime = bedtimeFor(band, now);
  final ww = personalWakeWindow(entries, band, now);
  DateTime? cursor;
  var index = items.length;
  if (sleepingSince != null) {
    final end = jsDateFromMs(math.max(_t(now) + 10 * _min, _t(sleepingSince) + napLen * _min));
    items.add(PlanItem(kind: 'nap', start: sleepingSince, end: end, status: 'now', minutes: jsRoundInt((_t(end) - _t(sleepingSince)) / _min)));
    cursor = end;
    index++;
  } else if (next.windowStart != null && !next.isBedtime) {
    final end = jsDateFromMs(_t(next.windowStart!) + napLen * _min);
    items.add(PlanItem(kind: 'nap', start: next.windowStart!, end: end, status: 'predicted', minutes: napLen));
    cursor = end;
    index++;
  }
  for (var guard = 0; cursor != null && guard < 4; guard++) {
    final start = jsDateFromMs(_t(cursor) + ww.minutes * windowFactor(index) * _min);
    if (_t(start) >= _t(bedtime) - 60 * _min) break;
    final len = math.min(napLen, math.max(30, (_t(bedtime) - _t(start)) / _min - ww.minutes));
    final end = jsDateFromMs(_t(start) + len * _min);
    items.add(PlanItem(kind: 'nap', start: start, end: end, status: 'predicted', minutes: jsRoundInt(len)));
    cursor = end;
    index++;
  }
  final bedStart = next.isBedtime && next.windowStart != null ? next.windowStart! : bedtime;
  items.add(PlanItem(kind: 'bedtime', start: bedStart, end: bedStart, status: 'predicted', minutes: 0));
  return jsSortInPlace(items, (a, b) => _t(a.start) - _t(b.start));
}

/// 'm4' | 'm8' | 'm12' | 'm18' | 'm24'
typedef RegressionKey = String;

class Regression {
  const Regression({required this.key, required this.start, required this.end, required this.daysUntil, required this.active});
  final RegressionKey key;
  final DateTime start;
  final DateTime end;
  final int daysUntil;
  final bool active;
}

const List<({String key, int fromWeek, int toWeek})> _regressions = [
  (key: 'm4', fromWeek: 15, toWeek: 19),
  (key: 'm8', fromWeek: 34, toWeek: 44),
  (key: 'm12', fromWeek: 50, toWeek: 55),
  (key: 'm18', fromWeek: 76, toWeek: 82),
  (key: 'm24', fromWeek: 102, toWeek: 108),
];

/// The current regression (if any) and the next ones, from the (corrected) birth date. Note: as in the
/// TypeScript, start/end are birth midnight + whole 24 h days (not calendar days), so across a DST change they
/// land at 23:00 or 01:00 local time.
List<Regression> upcomingRegressions(DateTime birth, DateTime now) {
  final base = DateTime(birth.year, birth.month, birth.day).millisecondsSinceEpoch;
  final today = DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;
  return [
    for (final r in _regressions)
      (() {
        final start = jsDateFromMs(base + r.fromWeek * 7 * _dayMs), end = jsDateFromMs(base + r.toWeek * 7 * _dayMs);
        return Regression(
          key: r.key,
          start: start,
          end: end,
          daysUntil: jsRoundInt((_t(start) - today) / _dayMs),
          active: _t(start) <= today && today <= _t(end),
        );
      })(),
  ].where((r) => _t(r.end) >= today).toList();
}
