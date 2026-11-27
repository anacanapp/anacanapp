// Ported from: src/lib/cycle-utils.ts

import 'dart:math' as math;

import '../js_compat.dart';

class CyclePhaseInfo {
  const CyclePhaseInfo({
    required this.phase,
    required this.dayInCycle,
    required this.dayInPhase,
    required this.phaseDaysTotal,
    required this.isPeriodDay,
    required this.isFertileDay,
    required this.isOvulationDay,
  });

  /// 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
  final String phase;
  final int dayInCycle;
  final int dayInPhase;
  final int phaseDaysTotal;
  final bool isPeriodDay;
  final bool isFertileDay;
  final bool isOvulationDay;

  Map<String, Object?> toJson() => {
        'phase': phase,
        'dayInCycle': dayInCycle,
        'dayInPhase': dayInPhase,
        'phaseDaysTotal': phaseDaysTotal,
        'isPeriodDay': isPeriodDay,
        'isFertileDay': isFertileDay,
        'isOvulationDay': isOvulationDay,
      };
}

/// Cycle day (1-based) of [date] for a cycle that started on [lastPeriodDate]; handles dates before it.
int getCycleDayForDate(DateTime date, DateTime lastPeriodDate, int cycleLength) {
  final dateOnly = DateTime(date.year, date.month, date.day);
  final lastOnly = DateTime(lastPeriodDate.year, lastPeriodDate.month, lastPeriodDate.day);
  // Round, not floor: a DST day is 23/25 h.
  final daysDiff =
      jsRoundInt((dateOnly.millisecondsSinceEpoch - lastOnly.millisecondsSinceEpoch) / (1000 * 60 * 60 * 24));
  if (daysDiff < 0) {
    final cyclesBack = (daysDiff.abs() / cycleLength).ceil();
    return daysDiff + cyclesBack * cycleLength + 1;
  }
  return daysDiff % cycleLength + 1;
}

CyclePhaseInfo getPhaseInfoForDate(DateTime date, DateTime lastPeriodDate, int cycleLength, int periodLength) {
  final cycleDay = getCycleDayForDate(date, lastPeriodDate, cycleLength);
  final ovulationDay = cycleLength - 14;
  final fertileStart = ovulationDay - 5;
  final fertileEnd = ovulationDay + 1;
  final menstrualEnd = periodLength;
  final follicularEnd = ovulationDay - 1;
  final ovulationEnd = ovulationDay + 1;

  String phase;
  int dayInPhase;
  int phaseDaysTotal;
  if (cycleDay <= menstrualEnd) {
    phase = 'menstrual';
    dayInPhase = cycleDay;
    phaseDaysTotal = periodLength;
  } else if (cycleDay <= follicularEnd) {
    phase = 'follicular';
    dayInPhase = cycleDay - menstrualEnd;
    phaseDaysTotal = follicularEnd - menstrualEnd;
  } else if (cycleDay <= ovulationEnd) {
    phase = 'ovulation';
    dayInPhase = cycleDay - follicularEnd;
    phaseDaysTotal = 3;
  } else {
    phase = 'luteal';
    dayInPhase = cycleDay - ovulationEnd;
    phaseDaysTotal = cycleLength - ovulationEnd;
  }
  return CyclePhaseInfo(
    phase: phase,
    dayInCycle: cycleDay,
    dayInPhase: dayInPhase,
    phaseDaysTotal: phaseDaysTotal,
    isPeriodDay: cycleDay <= periodLength,
    isFertileDay: cycleDay >= fertileStart && cycleDay <= fertileEnd,
    isOvulationDay: cycleDay == ovulationDay || cycleDay == ovulationDay + 1,
  );
}

/// Start of the next period after today (calendar days, DST-safe).
DateTime getNextPeriodDate(DateTime lastPeriodDate, int cycleLength) {
  final today = DomainClock.now();
  final lastPeriod = startOfDay(lastPeriodDate);
  final daysSincePeriod = differenceInCalendarDays(today, lastPeriod);
  final cyclesPassed = (daysSincePeriod / cycleLength).floor();
  return DateTime(lastPeriod.year, lastPeriod.month, lastPeriod.day + (cyclesPassed + 1) * cycleLength);
}

class FertileWindow {
  const FertileWindow({required this.start, required this.end, required this.ovulationDate});
  final DateTime start;
  final DateTime end;
  final DateTime ovulationDate;
}

FertileWindow getFertileWindow(DateTime lastPeriodDate, int cycleLength) {
  final next = getNextPeriodDate(lastPeriodDate, cycleLength);
  final ovulation = addDays(next, -14);
  return FertileWindow(start: addDays(ovulation, -5), end: addDays(ovulation, 1), ovulationDate: ovulation);
}

class CycleStats {
  const CycleStats({
    required this.averageCycleLength,
    required this.averagePeriodLength,
    required this.cycleVariation,
    required this.shortestCycle,
    required this.longestCycle,
    required this.cycleCount,
  });
  final int averageCycleLength;
  final int averagePeriodLength;
  final num cycleVariation;
  final num shortestCycle;
  final num longestCycle;
  final int cycleCount;

  Map<String, Object?> toJson() => {
        'averageCycleLength': averageCycleLength,
        'averagePeriodLength': averagePeriodLength,
        'cycleVariation': cycleVariation,
        'shortestCycle': shortestCycle,
        'longestCycle': longestCycle,
        'cycleCount': cycleCount,
      };
}

/// Statistics over cycle history rows (`cycle_length`, `period_length`; null or 0 is ignored).
CycleStats calculateCycleStats(List<({num? cycleLength, num? periodLength})> cycles) {
  final lengths = [
    for (final c in cycles)
      if (c.cycleLength != null && c.cycleLength != 0 && c.cycleLength! >= 10 && c.cycleLength! <= 50) c.cycleLength!
  ];
  final periods = [
    for (final c in cycles)
      if (c.periodLength != null && c.periodLength != 0 && c.periodLength! >= 2 && c.periodLength! <= 10)
        c.periodLength!
  ];
  final avgCycle = lengths.isNotEmpty ? jsRoundInt(lengths.reduce((a, b) => a + b) / lengths.length) : 28;
  final avgPeriod = periods.isNotEmpty ? jsRoundInt(periods.reduce((a, b) => a + b) / periods.length) : 5;
  final maxL = lengths.isEmpty ? 28 : lengths.reduce(math.max);
  final minL = lengths.isEmpty ? 28 : lengths.reduce(math.min);
  return CycleStats(
    averageCycleLength: avgCycle,
    averagePeriodLength: avgPeriod,
    cycleVariation: lengths.length > 1 ? maxL - minL : 0,
    shortestCycle: minL,
    longestCycle: maxL,
    cycleCount: lengths.length,
  );
}
