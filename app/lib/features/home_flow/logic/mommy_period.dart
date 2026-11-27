// Ported from: src/lib/mommy-period.ts
import '../../../domain/js_compat.dart' show differenceInCalendarDays, jsRoundInt, parseIsoDateFns, formatYmd, addDays;

/// Days apart that still count as the same period (one missed log in between).
const int _samePeriodGap = 2;

/// 'none' | 'today' | 'askToday' | 'idle'
typedef MommyPeriodState = String;

class MommyPeriodStatus {
  const MommyPeriodStatus({required this.state, required this.start, required this.lastDay, required this.dayNumber});
  final MommyPeriodState state;
  final String? start;
  final String? lastDay;
  final int dayNumber;

  @override
  bool operator ==(Object other) =>
      other is MommyPeriodStatus && other.state == state && other.start == start && other.lastDay == lastDay && other.dayNumber == dayNumber;
  @override
  int get hashCode => Object.hash(state, start, lastDay, dayNumber);
  @override
  String toString() => 'MommyPeriodStatus($state, $start, $lastDay, $dayNumber)';
}

DateTime _p(String s) => parseIsoDateFns(s)!;
int _diff(String a, String b) => differenceInCalendarDays(_p(a), _p(b));

List<String> _sortedPast(Iterable<String> days, String today) => ({...days}.where((d) => d.compareTo(today) <= 0).toList()..sort());

MommyPeriodStatus mommyPeriodStatus(List<String> flowDays, String today, String? endedOn) {
  final days = _sortedPast(flowDays, today);
  if (days.isEmpty) return const MommyPeriodStatus(state: 'none', start: null, lastDay: null, dayNumber: 0);
  final lastDay = days.last;
  var start = lastDay;
  for (var i = days.length - 2; i >= 0; i--) {
    if (_diff(start, days[i]) > _samePeriodGap) break;
    start = days[i];
  }
  final dayNumber = _diff(today, start) + 1;
  final yesterday = formatYmd(addDays(_p(today), -1));
  if (endedOn != null && endedOn.isNotEmpty && endedOn.compareTo(lastDay) >= 0) {
    return MommyPeriodStatus(state: 'idle', start: start, lastDay: lastDay, dayNumber: 0);
  }
  if (lastDay == today) return MommyPeriodStatus(state: 'today', start: start, lastDay: lastDay, dayNumber: dayNumber);
  if (lastDay == yesterday) return MommyPeriodStatus(state: 'askToday', start: start, lastDay: lastDay, dayNumber: dayNumber);
  return MommyPeriodStatus(state: 'idle', start: start, lastDay: lastDay, dayNumber: 0);
}

/// The last [count] calendar days ending [today], oldest first.
List<String> recentDays(String today, [int count = 14]) {
  final end = _p(today);
  return [for (var i = 0; i < count; i++) formatYmd(addDays(end, -(count - 1 - i)))];
}

class MommyCycle {
  const MommyCycle({required this.start, required this.length, required this.anomalous});
  final String start;
  final int length;
  final bool anomalous;
  @override
  bool operator ==(Object other) => other is MommyCycle && other.start == start && other.length == length && other.anomalous == anomalous;
  @override
  int get hashCode => Object.hash(start, length, anomalous);
  @override
  String toString() => 'MommyCycle($start, $length, $anomalous)';
}

class MommyCycleInsights {
  const MommyCycleInsights({
    required this.cycleDay,
    required this.cycleLength,
    required this.periodLength,
    required this.nextPeriod,
    required this.daysUntilNext,
    required this.cycles,
    required this.learned,
  });
  final int cycleDay;
  final int cycleLength;
  final int periodLength;
  final String nextPeriod;
  final int daysUntilNext;
  final List<MommyCycle> cycles;
  final bool learned;
}

MommyCycleInsights? mommyCycleInsights(List<String> flowDays, String today, [int fallbackCycleLength = 28]) {
  final days = _sortedPast(flowDays, today);
  if (days.isEmpty) return null;
  final periods = <List<String>>[];
  for (final day in days) {
    if (periods.isNotEmpty && _diff(day, periods.last.last) <= _samePeriodGap) {
      periods.last.add(day);
    } else {
      periods.add([day]);
    }
  }
  final starts = [for (final run in periods) run.first];
  final cycles = <MommyCycle>[
    for (var i = 1; i < starts.length; i++)
      () {
        final length = _diff(starts[i], starts[i - 1]);
        return MommyCycle(start: starts[i - 1], length: length, anomalous: length < 21 || length > 35);
      }(),
  ].reversed.toList();
  final normal = cycles.where((c) => !c.anomalous).take(6).map((c) => c.length).toList();
  final learned = normal.length >= 2;
  final cycleLength = learned ? jsRoundInt(normal.reduce((a, b) => a + b) / normal.length) : fallbackCycleLength;
  final lengths = [for (final run in periods) _diff(run.last, run.first) + 1];
  final periodLength = jsRoundInt(lengths.reduce((a, b) => a + b) / lengths.length);
  final latest = starts.last;
  final cycleDay = _diff(today, latest) + 1;
  final next = formatYmd(addDays(_p(latest), cycleLength));
  return MommyCycleInsights(
    cycleDay: cycleDay,
    cycleLength: cycleLength,
    periodLength: periodLength,
    nextPeriod: next,
    daysUntilNext: _diff(next, today),
    cycles: cycles,
    learned: learned,
  );
}

/// 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
String phaseForCycleDay(int cycleDay, int cycleLength, int periodLength) {
  final ovulation = cycleLength - 14;
  if (cycleDay <= periodLength) return 'menstrual';
  if ((cycleDay - ovulation).abs() <= 1) return 'ovulation';
  return cycleDay < ovulation ? 'follicular' : 'luteal';
}
