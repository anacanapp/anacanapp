// Ported from: src/lib/mommy-period.test.ts
import 'package:anacan/features/home_flow/logic/mommy_period.dart';
import 'package:flutter_test/flutter_test.dart';

const t = '2026-10-29';

void main() {
  group('mommyPeriodStatus', () {
    test('is none without recorded days', () {
      final s = mommyPeriodStatus([], t, null);
      expect((s.state, s.dayNumber), ('none', 0));
    });

    test('counts the current period from its first day when today is recorded', () {
      expect(mommyPeriodStatus(['2026-10-27', '2026-10-28', '2026-10-29'], t, null),
          const MommyPeriodStatus(state: 'today', start: '2026-10-27', lastDay: t, dayNumber: 3));
    });

    test('keeps one missed log inside the same period', () {
      final a = mommyPeriodStatus(['2026-10-26', '2026-10-28', '2026-10-29'], t, null);
      expect((a.start, a.dayNumber), ('2026-10-26', 4));
      final b = mommyPeriodStatus(['2026-10-20', '2026-10-29'], t, null);
      expect((b.start, b.dayNumber), (t, 1));
    });

    test('asks about today when the period was recorded until yesterday', () {
      final s = mommyPeriodStatus(['2026-10-27', '2026-10-28'], t, null);
      expect((s.state, s.dayNumber), ('askToday', 3));
    });

    test('is idle once ended or when the last day is older', () {
      final a = mommyPeriodStatus(['2026-10-28', t], t, t);
      expect((a.state, a.lastDay), ('idle', t));
      expect(mommyPeriodStatus(['2026-10-27', '2026-10-28'], t, '2026-10-28').state, 'idle');
      final c = mommyPeriodStatus(['2026-10-01', '2026-10-02'], t, null);
      expect((c.state, c.start), ('idle', '2026-10-01'));
    });

    test('starts again after an ended period when a new day is recorded', () {
      final s = mommyPeriodStatus(['2026-10-01', t], t, '2026-10-05');
      expect((s.state, s.start, s.dayNumber), ('today', t, 1));
    });

    test('ignores future dates', () {
      expect(mommyPeriodStatus(['2026-10-30'], t, null).state, 'none');
    });
  });

  group('recentDays', () {
    test('returns the last 14 days ending today, across months', () {
      final days = recentDays('2026-11-03');
      expect(days, hasLength(14));
      expect(days.first, '2026-10-21');
      expect(days.last, '2026-11-03');
    });
  });

  group('mommyCycleInsights', () {
    test('is null without recorded days', () {
      expect(mommyCycleInsights([], t), isNull);
    });

    test('forecasts from 28 days until two normal cycles are recorded', () {
      final i = mommyCycleInsights(['2026-10-20', '2026-10-21', '2026-10-22'], t)!;
      expect((i.cycleDay, i.cycleLength, i.periodLength, i.nextPeriod, i.daysUntilNext, i.learned), (10, 28, 3, '2026-11-17', 19, false));
      expect(i.cycles, isEmpty);
    });

    test('learns normal cycles and flags a 53-day delay as an anomaly', () {
      final i = mommyCycleInsights(['2026-06-01', '2026-06-02', '2026-07-01', '2026-07-30', '2026-09-21', '2026-10-20'], t)!;
      expect(i.cycles, const [
        MommyCycle(start: '2026-09-21', length: 29, anomalous: false),
        MommyCycle(start: '2026-07-30', length: 53, anomalous: true),
        MommyCycle(start: '2026-07-01', length: 29, anomalous: false),
        MommyCycle(start: '2026-06-01', length: 30, anomalous: false),
      ]);
      expect((i.learned, i.cycleLength, i.nextPeriod), (true, 29, '2026-11-18'));
    });
  });

  group('phaseForCycleDay', () {
    test('maps cycle days to phases for a 28-day cycle with 5 period days', () {
      expect(phaseForCycleDay(3, 28, 5), 'menstrual');
      expect(phaseForCycleDay(9, 28, 5), 'follicular');
      expect(phaseForCycleDay(14, 28, 5), 'ovulation');
      expect(phaseForCycleDay(20, 28, 5), 'luteal');
    });
  });
}
