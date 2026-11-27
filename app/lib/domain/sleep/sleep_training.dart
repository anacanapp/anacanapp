// Ported from: src/lib/sleep-training.ts
//
// Sleep training (babies 1-12 months): age norms, a daily nap schedule built from the wake-up time, live status,
// 7-day summaries with insights and the on-device plan state (JSON shape kept byte-compatible).

import 'dart:math' as math;

import '../baby/baby_logs_range.dart' show BabyLogRow;
import '../js_compat.dart';

/// '1-3' | '4-6' | '7-9' | '10-12'
typedef AgeBand = String;

class BandNorms {
  const BandNorms({
    required this.totalSleepHours,
    required this.naps,
    required this.wakeWindowMinutes,
    required this.napMinutes,
    required this.longestNightHours,
  });
  final List<int> totalSleepHours;
  final List<int> naps;
  final List<int> wakeWindowMinutes;
  final List<int> napMinutes;
  final List<int> longestNightHours;
}

const Map<AgeBand, BandNorms> bandNorms = {
  '1-3': BandNorms(totalSleepHours: [14, 17], naps: [4, 5], wakeWindowMinutes: [45, 90], napMinutes: [30, 90], longestNightHours: [4, 6]),
  '4-6': BandNorms(totalSleepHours: [12, 16], naps: [3, 4], wakeWindowMinutes: [90, 150], napMinutes: [45, 120], longestNightHours: [6, 8]),
  '7-9': BandNorms(totalSleepHours: [12, 16], naps: [2, 3], wakeWindowMinutes: [120, 180], napMinutes: [45, 120], longestNightHours: [8, 10]),
  '10-12': BandNorms(totalSleepHours: [12, 16], naps: [2, 2], wakeWindowMinutes: [150, 240], napMinutes: [60, 120], longestNightHours: [10, 12]),
};

const int minSleepMinutes = 5;
const int maxSleepMinutes = 16 * 60;
const int planDays = 14;
const int _minDaysForReview = 3;
const int _dayMs = 24 * 60 * 60 * 1000;

/// Whole months between birth and now (0 when invalid or in the future).
int monthsOld(DateTime? birth, DateTime now) {
  if (birth == null || birth.isAfter(now)) return 0;
  var months = (now.year - birth.year) * 12 + (now.month - birth.month);
  if (now.day < birth.day) months -= 1;
  return math.max(0, months);
}

bool _inRange(num months) => jsIsInteger(months) && months >= 1 && months <= 12;

AgeBand? ageBand(num months) {
  if (!_inRange(months)) return null;
  return months <= 3 ? '1-3' : months <= 6 ? '4-6' : months <= 9 ? '7-9' : '10-12';
}

/// Offered to mommy-stage users whose baby is 1-12 months old.
bool sleepTrainingEligible({String? lifeStage, required DateTime? birthDate, required DateTime now}) =>
    lifeStage == 'mommy' && birthDate != null && _inRange(monthsOld(birthDate, now));

/// "07:30" → 450, or null.
int? parseClock(String value) {
  final m = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(value);
  return m == null ? null : int.parse(m[1]!) * 60 + int.parse(m[2]!);
}

String formatClock(int minutes) {
  final t = (minutes % 1440 + 1440) % 1440;
  return '${pad2(t ~/ 60)}:${pad2(t % 60)}';
}

int minutesOfDay(DateTime d) => d.hour * 60 + d.minute;
int _mid(List<int> r) => jsRoundInt((r[0] + r[1]) / 2);

class ScheduleBlock {
  const ScheduleBlock({required this.type, required this.start, required this.end});

  /// 'wake' | 'nap' | 'bedtime'
  final String type;
  final String start;
  final String end;

  Map<String, Object?> toJson() => {'type': type, 'start': start, 'end': end};
}

int blockMinutes(ScheduleBlock b) {
  final s = parseClock(b.start), e = parseClock(b.end);
  return s == null || e == null ? 0 : (e - s + 1440) % 1440;
}

const int _bedtimeEarliest = 19 * 60;
const int _bedtimeLatest = 20 * 60 + 30;
const int _dayLength = 13 * 60;

/// Wake → (awake, nap)×n → awake → bedtime, choosing the nap count whose awake windows fit the age best.
List<ScheduleBlock> buildSchedule({required String wakeTime, required AgeBand band}) {
  final wake = parseClock(wakeTime);
  if (wake == null) return [];
  final norms = bandNorms[band]!;
  final bedtime = math.min(_bedtimeLatest, math.max(_bedtimeEarliest, wake + _dayLength));
  final awakeSpan = bedtime - wake;
  final napLen = _mid(norms.napMinutes), window = _mid(norms.wakeWindowMinutes);
  var naps = norms.naps[0];
  var best = double.infinity;
  for (var n = norms.naps[0]; n <= norms.naps[1]; n++) {
    final diff = ((awakeSpan - n * napLen) / (n + 1) - window).abs();
    if (diff < best) {
      best = diff;
      naps = n;
    }
  }
  final gap = jsRoundInt((awakeSpan - naps * napLen) / (naps + 1));
  final blocks = <ScheduleBlock>[];
  var t = wake;
  for (var i = 0; i < naps; i++) {
    blocks.add(ScheduleBlock(type: 'wake', start: formatClock(t), end: formatClock(t + gap)));
    t += gap;
    blocks.add(ScheduleBlock(type: 'nap', start: formatClock(t), end: formatClock(t + napLen)));
    t += napLen;
  }
  blocks.add(ScheduleBlock(type: 'wake', start: formatClock(t), end: formatClock(bedtime)));
  blocks.add(ScheduleBlock(type: 'bedtime', start: formatClock(bedtime), end: formatClock(bedtime)));
  return blocks;
}

class ScheduleStatus {
  const ScheduleStatus({this.currentIndex, this.nextIndex, this.minutesToNext, this.minutesLeft});
  final int? currentIndex;
  final int? nextIndex;
  final int? minutesToNext;
  final int? minutesLeft;
}

ScheduleStatus scheduleStatus(List<ScheduleBlock> schedule, DateTime now) {
  if (schedule.isEmpty) return const ScheduleStatus();
  final n = minutesOfDay(now);
  int? current, left;
  for (var i = 0; i < schedule.length; i++) {
    final b = schedule[i];
    if (b.type == 'bedtime') continue;
    final s = parseClock(b.start), len = blockMinutes(b);
    if (s == null || len == 0) continue;
    final into = (n - s + 1440) % 1440;
    if (into < len) {
      current = i;
      left = len - into;
    }
  }
  int? next, toNext;
  for (var i = 0; i < schedule.length; i++) {
    final b = schedule[i];
    final s = parseClock(b.start);
    if (s == null || i == current) continue;
    final d = (s - n + 1440) % 1440;
    if (d == 0 && b.type != 'bedtime') continue;
    if (toNext == null || d < toNext) {
      toNext = d;
      next = i;
    }
  }
  return ScheduleStatus(currentIndex: current, nextIndex: next, minutesToNext: toNext, minutesLeft: left);
}

class TimelineSegment {
  const TimelineSegment({required this.kind, required this.blockIndex, required this.startPct, required this.widthPct});

  /// 'wake' | 'nap' | 'night'
  final String kind;
  final int blockIndex;
  final double startPct;
  final double widthPct;
}

double _pct(num m) => m / 1440 * 100;

void _pushSegment(List<TimelineSegment> out, String kind, int blockIndex, int start, int len) {
  if (len <= 0) return;
  final first = math.min(len, 1440 - start);
  out.add(TimelineSegment(kind: kind, blockIndex: blockIndex, startPct: _pct(start), widthPct: _pct(first)));
  if (len > first) out.add(TimelineSegment(kind: kind, blockIndex: blockIndex, startPct: 0, widthPct: _pct(len - first)));
}

/// 24-hour bar segments; the night wraps past midnight back to the wake-up time.
List<TimelineSegment> timelineSegments(List<ScheduleBlock> schedule) {
  final out = <TimelineSegment>[];
  for (var i = 0; i < schedule.length; i++) {
    final b = schedule[i];
    if (b.type == 'bedtime') continue;
    final s = parseClock(b.start);
    if (s != null) _pushSegment(out, b.type, i, s, blockMinutes(b));
  }
  final bedIndex = schedule.indexWhere((b) => b.type == 'bedtime');
  final bed = bedIndex >= 0 ? parseClock(schedule[bedIndex].start) : null;
  final wake = schedule.isNotEmpty ? parseClock(schedule[0].start) : null;
  if (bed != null && wake != null) _pushSegment(out, 'night', bedIndex, bed, (wake - bed + 1440) % 1440);
  return out;
}

const String defaultWake = '07:00';
const List<String> wakePresets = ['06:30', '07:00', '07:30', '08:00'];
const int wakeMin = 5 * 60;
const int wakeMax = 10 * 60 + 30;
int _clampWake(int m) => math.min(wakeMax, math.max(wakeMin, m));

String normalizeWake(Object? value) {
  final m = value is String ? parseClock(value) : null;
  return m == null ? defaultWake : formatClock(_clampWake(m));
}

String shiftWake(String value, int delta) {
  final m = parseClock(normalizeWake(value)) ?? parseClock(defaultWake)!;
  return formatClock(_clampWake(m + delta));
}

class SleepEntry {
  const SleepEntry({required this.id, required this.start, required this.end, required this.minutes, required this.kind});
  final String id;
  final DateTime start;
  final DateTime end;
  final int minutes;

  /// 'night' | 'nap'
  final String kind;
}

String _entryKind(DateTime start, int minutes) {
  final h = start.hour;
  return h >= 19 || h < 6 || minutes >= 240 ? 'night' : 'nap';
}

List<SleepEntry> sleepEntries(List<BabyLogRow> logs) {
  final out = <SleepEntry>[];
  for (var i = 0; i < logs.length; i++) {
    final l = logs[i];
    if (l.logType != 'sleep' || l.endTime == null || l.endTime!.isEmpty) continue;
    final start = jsParseDate(l.startTime), end = jsParseDate(l.endTime!);
    if (start == null || end == null) continue;
    final minutes = jsRoundInt((end.millisecondsSinceEpoch - start.millisecondsSinceEpoch) / 60000);
    if (minutes > 0) out.add(SleepEntry(id: l.id, start: start, end: end, minutes: minutes, kind: _entryKind(start, minutes)));
  }
  return jsSortInPlace(out, (a, b) => a.start.millisecondsSinceEpoch - b.start.millisecondsSinceEpoch);
}

/// `dayOffset` in the TypeScript: local midnight [n] days from [d].
DateTime dayOffset(DateTime d, [int n = 0]) => DateTime(d.year, d.month, d.day + n);

String localDateKey(DateTime d) => '${d.year}-${pad2(d.month)}-${pad2(d.day)}';

int? _keyToUtc(String key) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(key);
  return m == null ? null : jsDateUtc(int.parse(m[1]!), int.parse(m[2]!) - 1, int.parse(m[3]!));
}

String _utcToKey(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  return '${d.year}-${pad2(d.month)}-${pad2(d.day)}';
}

String shiftKey(String key, int days) {
  final ms = _keyToUtc(key);
  return ms == null ? key : _utcToKey(ms + days * _dayMs);
}

class SleepDay {
  const SleepDay({
    required this.key,
    required this.date,
    required this.totalMinutes,
    required this.napCount,
    required this.nightMinutes,
    required this.sessions,
  });
  final String key;
  final DateTime date;
  final int totalMinutes;
  final int napCount;
  final int nightMinutes;
  final List<SleepEntry> sessions;
}

/// Sleeps grouped by the day on which they ended, oldest day first.
List<SleepDay> sleepDays(List<SleepEntry> entries, DateTime now, [int days = 7]) {
  final out = <SleepDay>[];
  for (var i = days - 1; i >= 0; i--) {
    final from = dayOffset(now, -i), to = dayOffset(now, -i + 1);
    final sessions = entries.where((e) => e.end.isAfter(from) && !e.end.isAfter(to)).toList();
    out.add(SleepDay(
      key: localDateKey(from),
      date: from,
      totalMinutes: sessions.fold(0, (s, e) => s + e.minutes),
      napCount: sessions.where((e) => e.kind == 'nap').length,
      nightMinutes: sessions.where((e) => e.kind == 'night').fold(0, (s, e) => s + e.minutes),
      sessions: sessions,
    ));
  }
  return out;
}

double? _mean(List<num> xs) => xs.isEmpty ? null : xs.fold<num>(0, (s, x) => s + x) / xs.length;

num? _median(List<num> xs) {
  if (xs.isEmpty) return null;
  final s = jsSorted(xs, (num a, num b) => a - b);
  final m = s.length ~/ 2;
  return s.length.isOdd ? s[m] : jsRound((s[m - 1] + s[m]) / 2);
}

/// 'no_data' | 'need_more_data' | 'naps_below_range' | 'nap_short' | 'night_short' | 'wake_window_long' |
/// 'wake_window_short' | 'total_below_range' | 'all_good'
typedef Insight = String;

class SleepSummary {
  const SleepSummary({
    required this.daysWithData,
    this.avgDailyMinutes,
    this.avgNapsPerDay,
    this.avgNapMinutes,
    this.avgLongestNightMinutes,
    this.avgWakeWindowMinutes,
    this.medianBedtime,
    this.medianWakeTime,
    required this.insights,
  });
  final int daysWithData;
  final double? avgDailyMinutes;
  final double? avgNapsPerDay;
  final double? avgNapMinutes;
  final double? avgLongestNightMinutes;
  final double? avgWakeWindowMinutes;
  final String? medianBedtime;
  final String? medianWakeTime;
  final List<Insight> insights;

  SleepSummary withInsights(List<Insight> v) => SleepSummary(
        daysWithData: daysWithData,
        avgDailyMinutes: avgDailyMinutes,
        avgNapsPerDay: avgNapsPerDay,
        avgNapMinutes: avgNapMinutes,
        avgLongestNightMinutes: avgLongestNightMinutes,
        avgWakeWindowMinutes: avgWakeWindowMinutes,
        medianBedtime: medianBedtime,
        medianWakeTime: medianWakeTime,
        insights: v,
      );
}

/// Averages over the 7 days before today (today excluded) and what stands out for the age band.
SleepSummary sleepSummary({required List<SleepEntry> sessions, required AgeBand band, required DateTime now}) {
  final norms = bandNorms[band]!;
  final days = sleepDays(sessions, now, 8).take(7).where((d) => d.totalMinutes > 0).toList();
  if (days.isEmpty) return const SleepSummary(daysWithData: 0, insights: ['no_data']);
  final all = days.expand((d) => d.sessions).toList();
  final naps = all.where((e) => e.kind == 'nap').toList(), nights = all.where((e) => e.kind == 'night').toList();
  final longestNights = days
      .map((d) => d.sessions.where((e) => e.kind == 'night').fold<int>(0, (m, e) => math.max(m, e.minutes)))
      .where((m) => m > 0)
      .toList();
  final windows = <double>[];
  for (final d in days) {
    final dn = d.sessions.where((e) => e.kind == 'nap').toList();
    for (var i = 1; i < dn.length; i++) {
      final gap = (dn[i].start.millisecondsSinceEpoch - dn[i - 1].end.millisecondsSinceEpoch) / 60000;
      if (gap > 0 && gap < 12 * 60) windows.add(gap);
    }
  }
  final bedtimes = nights.map((e) {
    final m = minutesOfDay(e.start);
    return m < 12 * 60 ? m + 1440 : m;
  }).toList();
  final s = SleepSummary(
    daysWithData: days.length,
    avgDailyMinutes: _mean(days.map((d) => d.totalMinutes).toList()),
    avgNapsPerDay: naps.isNotEmpty ? _mean(days.map((d) => d.napCount).toList()) : null,
    avgNapMinutes: _mean(naps.map((e) => e.minutes).toList()),
    avgLongestNightMinutes: _mean(longestNights),
    avgWakeWindowMinutes: _mean(windows),
    medianBedtime: bedtimes.isNotEmpty ? formatClock(_median(bedtimes)!.toInt()) : null,
    medianWakeTime: nights.isNotEmpty ? formatClock(_median(nights.map((e) => minutesOfDay(e.end)).toList())!.toInt()) : null,
    insights: const [],
  );
  if (days.length < _minDaysForReview) return s.withInsights(const ['need_more_data']);
  final found = <Insight>[];
  if (s.avgNapsPerDay != null && s.avgNapsPerDay! < norms.naps[0]) found.add('naps_below_range');
  if (s.avgLongestNightMinutes != null && s.avgLongestNightMinutes! < norms.longestNightHours[0] * 60) found.add('night_short');
  if (s.avgNapMinutes != null && s.avgNapMinutes! < norms.napMinutes[0]) found.add('nap_short');
  if (s.avgWakeWindowMinutes != null && s.avgWakeWindowMinutes! > norms.wakeWindowMinutes[1]) found.add('wake_window_long');
  if (s.avgWakeWindowMinutes != null && s.avgWakeWindowMinutes! < norms.wakeWindowMinutes[0]) found.add('wake_window_short');
  if (s.avgDailyMinutes != null && s.avgDailyMinutes! < norms.totalSleepHours[0] * 60) found.add('total_below_range');
  return s.withInsights(found.isNotEmpty ? found : const ['all_good']);
}

// ── Plan state (on device) ─────────────────────────────────────────────────────────────────────
const List<String> routineSteps = ['bath', 'pajamas', 'feed', 'story', 'dim_lights', 'crib_drowsy'];
const List<String> methods = ['gentle_pickup', 'chair', 'fading', 'timed_checks'];
const Map<String, List<String>> methodSteps = {
  'gentle_pickup': ['gp_step_1', 'gp_step_2', 'gp_step_3', 'gp_step_4'],
  'chair': ['chair_step_1', 'chair_step_2', 'chair_step_3'],
  'fading': ['fade_step_1', 'fade_step_2', 'fade_step_3', 'fade_step_4', 'fade_step_5'],
  'timed_checks': ['tc_step_1', 'tc_step_2', 'tc_step_3'],
};
const List<String> ratings = ['easy', 'medium', 'hard'];
const List<String> safetyItems = ['back', 'firm', 'empty', 'share', 'sofa', 'temp', 'smoke'];

/// Plan state; JSON keys are the TypeScript field names (stored on the device and in sleep_training_plans).
class PlanState {
  const PlanState({
    this.wakeTime = defaultWake,
    this.method,
    this.planStartDate,
    this.planDone = const {},
    this.stepsDone = const [],
    this.routineDone = const {},
    this.nightWakes = const {},
    this.safetyDone = const [],
    this.pendingSleepStart,
  });
  final String wakeTime;
  final String? method;
  final String? planStartDate;

  /// Plan day ("1".."14") → rating or null.
  final Map<String, String?> planDone;
  final List<String> stepsDone;
  final Map<String, List<String>> routineDone;
  final Map<String, num> nightWakes;
  final List<String> safetyDone;
  final String? pendingSleepStart;

  PlanState copyWith({
    String? wakeTime,
    Object? method = _keep,
    Object? planStartDate = _keep,
    Map<String, String?>? planDone,
    List<String>? stepsDone,
    Map<String, List<String>>? routineDone,
    Map<String, num>? nightWakes,
    List<String>? safetyDone,
    Object? pendingSleepStart = _keep,
  }) =>
      PlanState(
        wakeTime: wakeTime ?? this.wakeTime,
        method: identical(method, _keep) ? this.method : method as String?,
        planStartDate: identical(planStartDate, _keep) ? this.planStartDate : planStartDate as String?,
        planDone: planDone ?? this.planDone,
        stepsDone: stepsDone ?? this.stepsDone,
        routineDone: routineDone ?? this.routineDone,
        nightWakes: nightWakes ?? this.nightWakes,
        safetyDone: safetyDone ?? this.safetyDone,
        pendingSleepStart: identical(pendingSleepStart, _keep) ? this.pendingSleepStart : pendingSleepStart as String?,
      );

  Map<String, Object?> toJson() => {
        'wakeTime': wakeTime,
        'method': method,
        'planStartDate': planStartDate,
        'planDone': planDone,
        'stepsDone': stepsDone,
        'routineDone': routineDone,
        'nightWakes': nightWakes,
        'safetyDone': safetyDone,
        'pendingSleepStart': pendingSleepStart,
      };
}

const Object _keep = Object();

const PlanState defaultPlanState = PlanState();

String planStorageKey(String userId) => 'anacan.sleepTraining.v1.$userId';

List<String> _toggle(List<String> xs, String x) => xs.contains(x) ? xs.where((y) => y != x).toList() : [...xs, x];

bool _isPlanDay(String k) => RegExp(r'^\d+$').hasMatch(k) && int.parse(k) >= 1 && int.parse(k) <= planDays;

bool _isIso(Object? v) => v is String && jsParseDate(v) != null;

List<String> _allSteps() => [for (final m in methods) ...methodSteps[m]!];

/// Plan day number (1 = start day) for today.
int planDayNumber(String startKey, String todayKey) {
  final a = _keyToUtc(startKey), b = _keyToUtc(todayKey);
  return a == null || b == null ? 0 : jsRoundInt((b - a) / _dayMs) + 1;
}

({int completed, int total, int percent}) planProgress(PlanState s) {
  final completed = s.planDone.keys.where(_isPlanDay).length;
  return (completed: completed, total: planDays, percent: jsRoundInt(completed / planDays * 100));
}

bool _routineComplete(List<String>? xs) => xs != null && routineSteps.every(xs.contains);

/// Consecutive complete evenings ending today (or yesterday while today is still open).
int routineStreak(Map<String, List<String>> done, String todayKey) {
  var key = _routineComplete(done[todayKey]) ? todayKey : shiftKey(todayKey, -1);
  var n = 0;
  while (n < 365 && _routineComplete(done[key])) {
    n++;
    key = shiftKey(key, -1);
  }
  return n;
}

/// Night wake-ups belong to the night that started the previous evening before noon.
String nightKey(DateTime d) => localDateKey(d.hour < 12 ? dayOffset(d, -1) : d);

double? averageNightWakes(Map<String, num> wakes, String todayKey) {
  final xs = <num>[];
  for (var i = 0; i < 7; i++) {
    final v = wakes[shiftKey(todayKey, -i)];
    if (v != null) xs.add(v);
  }
  return xs.isEmpty ? null : xs.fold<num>(0, (s, x) => s + x) / xs.length;
}

PlanState toggleRoutine(PlanState s, String key, String step) =>
    s.copyWith(routineDone: {...s.routineDone, key: _toggle(s.routineDone[key] ?? const [], step)});
PlanState setWake(PlanState s, String wake) => s.copyWith(wakeTime: normalizeWake(wake));
PlanState pickMethod(PlanState s, String method, String todayKey) =>
    s.copyWith(method: method, planStartDate: s.planStartDate ?? todayKey);
PlanState resetPlan(PlanState s) => s.copyWith(method: null, planStartDate: null, planDone: const {}, stepsDone: const []);

PlanState ratePlanDay(PlanState s, num day, String? rating, [bool clear = false]) {
  if (s.method == null || !jsIsInteger(day) || day < 1 || day > planDays) return s;
  final planDone = {...s.planDone};
  final k = jsNumberToString(day);
  if (clear) {
    planDone.remove(k);
  } else {
    planDone[k] = rating;
  }
  return s.copyWith(planDone: planDone);
}

PlanState toggleStep(PlanState s, String step) => _allSteps().contains(step) ? s.copyWith(stepsDone: _toggle(s.stepsDone, step)) : s;
PlanState toggleSafety(PlanState s, String item) =>
    safetyItems.contains(item) ? s.copyWith(safetyDone: _toggle(s.safetyDone, item)) : s;

PlanState adjustNightWakes(PlanState s, String key, int delta) {
  final v = math.min(20, math.max(0, (s.nightWakes[key] ?? 0) + delta));
  return s.copyWith(nightWakes: {...s.nightWakes, key: v});
}

PlanState setPendingSleep(PlanState s, String? iso) => s.copyWith(pendingSleepStart: iso);

/// Drops entries older than 30 days and anything malformed.
PlanState prunePlanState(PlanState s, String todayKey) {
  final today = _keyToUtc(todayKey);
  bool recent(String k) {
    final t = _keyToUtc(k);
    return t != null && today != null && today - t >= 0 && today - t <= 29 * _dayMs;
  }

  final routineDone = <String, List<String>>{
    for (final e in s.routineDone.entries)
      if (recent(e.key)) e.key: e.value.where(routineSteps.contains).toList(),
  };
  final nightWakes = <String, num>{
    for (final e in s.nightWakes.entries)
      if (recent(e.key) && e.value.isFinite) e.key: math.min(20, math.max(0, jsRoundInt(e.value))),
  };
  final planDone = <String, String?>{
    for (final e in s.planDone.entries)
      if (_isPlanDay(e.key)) e.key: e.value != null && e.value!.isNotEmpty && ratings.contains(e.value) ? e.value : null,
  };
  final steps = _allSteps();
  return s.copyWith(
    wakeTime: normalizeWake(s.wakeTime),
    planDone: planDone,
    stepsDone: s.stepsDone.toSet().where(steps.contains).toList(),
    safetyDone: s.safetyDone.toSet().where(safetyItems.contains).toList(),
    routineDone: routineDone,
    nightWakes: nightWakes,
    pendingSleepStart: _isIso(s.pendingSleepStart) ? s.pendingSleepStart : null,
  );
}

/// Reads whatever was stored (including the older planDays format) into a valid state. Returns
/// [defaultPlanState] itself for a non-object (the TypeScript returns the same constant).
PlanState parsePlanState(Object? raw) {
  if (raw is! Map) return defaultPlanState;
  final planDone = <String, String?>{};
  final rawDone = raw['planDone'];
  if (rawDone is Map) {
    for (final e in rawDone.entries) {
      final k = e.key.toString();
      if (_isPlanDay(k)) planDone[k] = ratings.contains(e.value) ? e.value as String : null;
    }
  }
  final planDaysRaw = raw['planDays'];
  if (planDaysRaw is List) {
    for (final d in planDaysRaw) {
      if (jsIsInteger(d) && (d as num) >= 1 && d <= planDays && !planDone.containsKey(jsNumberToString(d))) {
        planDone[jsNumberToString(d)] = null;
      }
    }
  }
  final routineDone = <String, List<String>>{};
  final rawRoutine = raw['routineDone'];
  if (rawRoutine is Map) {
    for (final e in rawRoutine.entries) {
      final k = e.key.toString();
      if (_keyToUtc(k) != null && e.value is List) {
        routineDone[k] = (e.value as List).whereType<String>().where(routineSteps.contains).toList();
      }
    }
  }
  final nightWakes = <String, num>{};
  final rawWakes = raw['nightWakes'];
  if (rawWakes is Map) {
    for (final e in rawWakes.entries) {
      final k = e.key.toString();
      final v = e.value;
      if (_keyToUtc(k) != null && v is num && v.isFinite) nightWakes[k] = math.min(20, math.max(0, jsRoundInt(v)));
    }
  }
  final steps = _allSteps();
  final planStart = raw['planStartDate'];
  return PlanState(
    wakeTime: normalizeWake(raw['wakeTime']),
    method: methods.contains(raw['method']) ? raw['method'] as String : null,
    planStartDate: planStart is String && _keyToUtc(planStart) != null ? planStart : null,
    planDone: planDone,
    stepsDone: raw['stepsDone'] is List ? (raw['stepsDone'] as List).whereType<String>().where(steps.contains).toSet().toList() : const [],
    routineDone: routineDone,
    nightWakes: nightWakes,
    safetyDone: raw['safetyDone'] is List
        ? (raw['safetyDone'] as List).whereType<String>().where(safetyItems.contains).toSet().toList()
        : const [],
    pendingSleepStart: _isIso(raw['pendingSleepStart']) ? raw['pendingSleepStart'] as String : null,
  );
}
