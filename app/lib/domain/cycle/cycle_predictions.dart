// Ported from: src/lib/cycle-predictions.ts (CycleHistory row shape from src/hooks/useCycleHistory.ts)
//
// Adaptive cycle prediction: learns from cycle_history (weighted mean of the last 6 completed normal cycles,
// newest heaviest) instead of a static cycle_length; standard deviation drives the confidence.

import 'dart:math' as math;

import '../dates/local_date.dart';
import '../js_compat.dart';

/// public.cycle_history row (DB field names).
class CycleHistory {
  const CycleHistory({
    required this.id,
    required this.userId,
    required this.cycleNumber,
    required this.startDate,
    this.endDate,
    this.cycleLength,
    this.periodLength,
    this.ovulationDate,
    this.notes,
    this.createdAt = '',
  });
  final String id;
  final String userId;
  final num cycleNumber;
  final String startDate;
  final String? endDate;
  final num? cycleLength;
  final num? periodLength;
  final String? ovulationDate;
  final String? notes;
  final String createdAt;

  factory CycleHistory.fromJson(Map<String, Object?> j) => CycleHistory(
        id: (j['id'] ?? '') as String,
        userId: (j['user_id'] ?? '') as String,
        cycleNumber: (j['cycle_number'] ?? 0) as num,
        startDate: (j['start_date'] ?? '') as String,
        endDate: j['end_date'] as String?,
        cycleLength: j['cycle_length'] as num?,
        periodLength: j['period_length'] as num?,
        ovulationDate: j['ovulation_date'] as String?,
        notes: j['notes'] as String?,
        createdAt: (j['created_at'] ?? '') as String,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'user_id': userId,
        'cycle_number': cycleNumber,
        'start_date': startDate,
        'end_date': endDate,
        'cycle_length': cycleLength,
        'period_length': periodLength,
        'ovulation_date': ovulationDate,
        'notes': notes,
        'created_at': createdAt,
      };
}

/// 'high' | 'medium' | 'low' | 'none'
typedef PredictionConfidence = String;

class AdaptiveCycleStats {
  const AdaptiveCycleStats({
    required this.predictedCycleLength,
    required this.predictedPeriodLength,
    required this.stdDev,
    required this.basedOnCycles,
    required this.confidence,
  });
  final num predictedCycleLength;
  final num predictedPeriodLength;
  final double stdDev;
  final int basedOnCycles;
  final PredictionConfidence confidence;

  Map<String, Object?> toJson() => {
        'predictedCycleLength': predictedCycleLength,
        'predictedPeriodLength': predictedPeriodLength,
        'stdDev': stdDev,
        'basedOnCycles': basedOnCycles,
        'confidence': confidence,
      };
}

class CyclePredictions extends AdaptiveCycleStats {
  const CyclePredictions({
    required super.predictedCycleLength,
    required super.predictedPeriodLength,
    required super.stdDev,
    required super.basedOnCycles,
    required super.confidence,
    required this.nextPeriodDate,
    required this.daysUntilNextPeriod,
    required this.ovulationDate,
    required this.fertileWindowStart,
    required this.fertileWindowEnd,
    required this.pmsStart,
    required this.isLate,
    required this.lateDays,
  });

  /// Null when the last period date is invalid (JS: Invalid Date).
  final DateTime? nextPeriodDate;
  final num daysUntilNextPeriod;
  final DateTime? ovulationDate;
  final DateTime? fertileWindowStart;
  final DateTime? fertileWindowEnd;
  final DateTime? pmsStart;
  final bool isLate;
  final num lateDays;
}

const int _maxCycles = 6;
const int normalCycleMin = 21;
const int normalCycleMax = 35;
const int _defaultCycleLength = 28;

bool isAnomalousCycleLength(num? length) => length != null && (length < normalCycleMin || length > normalCycleMax);

/// Cycle length used for predictions: weighted mean of ≥2 normal cycles, else the stored normal value, else 28.
num effectiveCycleLength(List<CycleHistory> cycles, [num? storedCycleLength]) {
  final stats = computeAdaptiveCycleStats(cycles, _defaultCycleLength);
  if (stats.basedOnCycles >= 2) return stats.predictedCycleLength;
  if (storedCycleLength != null && storedCycleLength != 0 && !isAnomalousCycleLength(storedCycleLength)) {
    return storedCycleLength;
  }
  return _defaultCycleLength;
}

AdaptiveCycleStats computeAdaptiveCycleStats(List<CycleHistory> cycles,
    [num fallbackCycleLength = 28, num fallbackPeriodLength = 5]) {
  final completed = jsSorted(
    cycles.where((c) => c.cycleLength != null && !isAnomalousCycleLength(c.cycleLength)),
    (CycleHistory a, CycleHistory b) => b.cycleNumber - a.cycleNumber,
  ).take(_maxCycles).toList();

  if (completed.isEmpty) {
    return AdaptiveCycleStats(
      predictedCycleLength: fallbackCycleLength,
      predictedPeriodLength: fallbackPeriodLength,
      stdDev: 0,
      basedOnCycles: 0,
      confidence: 'none',
    );
  }
  final lengths = completed.map((c) => c.cycleLength!).toList();
  num weightedSum = 0;
  num weightTotal = 0;
  for (var i = 0; i < lengths.length; i++) {
    final w = lengths.length - i;
    weightedSum += lengths[i] * w;
    weightTotal += w;
  }
  final predictedCycleLength = jsRoundInt(weightedSum / weightTotal);
  final mean = lengths.fold<num>(0, (a, b) => a + b) / lengths.length;
  final variance = lengths.fold<num>(0, (s, l) => s + math.pow(l - mean, 2)) / lengths.length;
  final stdDev = jsRound(math.sqrt(variance) * 10) / 10;

  final periods = [
    for (final c in completed)
      if (c.periodLength != null && c.periodLength! > 0 && c.periodLength! <= 12) c.periodLength!
  ];
  final num predictedPeriodLength = periods.isNotEmpty
      ? jsRoundInt(periods.fold<num>(0, (a, b) => a + b) / periods.length)
      : fallbackPeriodLength;

  var confidence = 'low';
  if (completed.length >= 3 && stdDev <= 2) {
    confidence = 'high';
  } else if (completed.length >= 2 && stdDev <= 4) {
    confidence = 'medium';
  }
  return AdaptiveCycleStats(
    predictedCycleLength: predictedCycleLength,
    predictedPeriodLength: predictedPeriodLength,
    stdDev: stdDev,
    basedOnCycles: completed.length,
    confidence: confidence,
  );
}

DateTime? _atMidnight(Object d) => storedCalendarDate(d);

DateTime _addDaysTo(DateTime base, num d) =>
    DateTime(base.year, base.month, base.day + d.toInt(), base.hour, base.minute, base.second, base.millisecond);

/// Full prediction set (dashboard / calendar / notifications). [lastPeriodDate] is a DateTime or YYYY-MM-DD.
CyclePredictions getCyclePredictions(Object lastPeriodDate, List<CycleHistory> cycles,
    [num fallbackCycleLength = 28, num fallbackPeriodLength = 5]) {
  final stats = computeAdaptiveCycleStats(cycles, fallbackCycleLength, fallbackPeriodLength);
  final l = stats.predictedCycleLength;
  final lpd = _atMidnight(lastPeriodDate);
  final today = startOfDay(DomainClock.now());

  if (lpd == null) {
    return CyclePredictions(
      predictedCycleLength: stats.predictedCycleLength,
      predictedPeriodLength: stats.predictedPeriodLength,
      stdDev: stats.stdDev,
      basedOnCycles: stats.basedOnCycles,
      confidence: stats.confidence,
      nextPeriodDate: null,
      daysUntilNextPeriod: double.nan,
      ovulationDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      pmsStart: null,
      isLate: false,
      lateDays: 0,
    );
  }
  final next = _addDaysTo(lpd, l);
  final daysUntil = jsRoundInt((next.millisecondsSinceEpoch - today.millisecondsSinceEpoch) / 86400000);
  final ovulation = _addDaysTo(next, -14);
  final isLate = daysUntil < 0;
  return CyclePredictions(
    predictedCycleLength: stats.predictedCycleLength,
    predictedPeriodLength: stats.predictedPeriodLength,
    stdDev: stats.stdDev,
    basedOnCycles: stats.basedOnCycles,
    confidence: stats.confidence,
    nextPeriodDate: next,
    daysUntilNextPeriod: daysUntil,
    ovulationDate: ovulation,
    fertileWindowStart: _addDaysTo(ovulation, -5),
    fertileWindowEnd: _addDaysTo(ovulation, 1),
    pmsStart: _addDaysTo(next, -5),
    isLate: isLate,
    lateDays: isLate ? daysUntil.abs() : 0,
  );
}

// ── Symptom-based ovulation refinement: peak OPK > positive OPK > egg-white mucus > calendar ──

class OvulationSignalLog {
  const OvulationSignalLog({required this.logDate, this.ovulationTest, this.cervicalMucus});
  final String logDate;

  /// 'negative' | 'positive' | 'peak' | null
  final String? ovulationTest;

  /// 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' | null
  final String? cervicalMucus;

  factory OvulationSignalLog.fromJson(Map<String, Object?> j) => OvulationSignalLog(
        logDate: j['log_date'] as String,
        ovulationTest: j['ovulation_test'] as String?,
        cervicalMucus: j['cervical_mucus'] as String?,
      );
}

/// 'opk_peak' | 'opk_positive' | 'mucus' | 'calendar'
typedef OvulationSource = String;

class RefinedOvulation {
  const RefinedOvulation({
    required this.ovulationDate,
    required this.fertileWindowStart,
    required this.fertileWindowEnd,
    required this.source,
    required this.confirmed,
  });
  final DateTime? ovulationDate;
  final DateTime? fertileWindowStart;
  final DateTime? fertileWindowEnd;
  final OvulationSource source;
  final bool confirmed;
}

const int _dayMs = 86400000;

// Only called with valid dates: logs with an invalid date never pass the filter below.
int _ms(DateTime? d) => d!.millisecondsSinceEpoch;

RefinedOvulation refineOvulation(List<OvulationSignalLog> logs, Object lastPeriodDate, DateTime calendarOvulation) {
  final cycleStart = _atMidnight(lastPeriodDate);
  final today = _atMidnight(DomainClock.now());

  // JS compares NaN timestamps as false, so with an invalid cycle start every log is filtered out.
  final cycleLogs = jsSorted(
    logs.where((l) {
      final d = _atMidnight(l.logDate);
      if (d == null || cycleStart == null || today == null) return false;
      return _ms(d) >= _ms(cycleStart) && _ms(d) <= _ms(today);
    }),
    (OvulationSignalLog a, OvulationSignalLog b) => _ms(_atMidnight(a.logDate)) - _ms(_atMidnight(b.logDate)),
  );

  RefinedOvulation build(DateTime? ovulation, String source, bool confirmed) => RefinedOvulation(
        ovulationDate: ovulation,
        fertileWindowStart: ovulation == null ? null : _addDaysTo(ovulation, -5),
        fertileWindowEnd: ovulation == null ? null : _addDaysTo(ovulation, 1),
        source: source,
        confirmed: confirmed,
      );

  bool plausible(OvulationSignalLog l) =>
      jsRound((_ms(_atMidnight(l.logDate)) - _ms(cycleStart)) / _dayMs) >= 6;

  for (final l in cycleLogs) {
    if (l.ovulationTest == 'peak' && plausible(l)) return build(_addDaysTo(_atMidnight(l.logDate)!, 1), 'opk_peak', true);
  }
  for (final l in cycleLogs) {
    if (l.ovulationTest == 'positive' && plausible(l)) {
      return build(_addDaysTo(_atMidnight(l.logDate)!, 1), 'opk_positive', true);
    }
  }
  final eggwhites = cycleLogs.where((l) => l.cervicalMucus == 'eggwhite' && plausible(l)).toList();
  if (eggwhites.isNotEmpty) return build(_addDaysTo(_atMidnight(eggwhites.last.logDate)!, 1), 'mucus', true);
  return build(_atMidnight(calendarOvulation), 'calendar', false);
}
