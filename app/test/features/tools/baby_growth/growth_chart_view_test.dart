// Ported from: src/lib/growthChartView.test.ts
import 'package:anacan/domain/growth/data/who_growth_data.g.dart';
import 'package:anacan/domain/growth/who_growth.dart';
import 'package:anacan/features/tools/baby_growth/growth_chart_view.dart';
import 'package:flutter_test/flutter_test.dart';

GrowthEntryLike entry(String date, {num? weight, num? height, num? head}) =>
    GrowthEntryLike(entryDate: date, weightKg: weight, heightCm: height, headCm: head);

void main() {
  group('growth chart range', () {
    test('keeps 0-24 months while the child is younger than two', () {
      for (final age in [0, 3.5, 12, 23.9, 24, double.nan, -1]) {
        expect(chartMaxMonth(age), 24);
      }
    });

    test('extends to the child age in 6-month steps, capped at 60', () {
      expect(chartMaxMonth(24.1), 30);
      expect(chartMaxMonth(30), 30);
      expect(chartMaxMonth(37.2), 42);
      expect(chartMaxMonth(59), 60);
      expect(chartMaxMonth(80), 60);
    });

    test('has readable ticks that always end at the last month', () {
      expect(chartTicks(24), [0, 6, 12, 18, 24]);
      expect(chartTicks(30), [0, 6, 12, 18, 24, 30]);
      expect(chartTicks(42), [0, 12, 24, 36, 42]);
      expect(chartTicks(60), [0, 12, 24, 36, 48, 60]);
    });
  });

  group('growth measures', () {
    test('offers weight, height and head circumference with their labels', () {
      expect(growthMeasures, ['weight', 'height', 'head']);
      expect(measureLabel('weight'), (key: 'who_weight', fallback: 'Çəki (kq)'));
      expect(measureLabel('height'), (key: 'who_height', fallback: 'Boy (sm)'));
      expect(measureLabel('head'), (key: 'growthtz_who_head', fallback: 'Baş çevrəsi (sm)'));
    });

    test('reads only positive recorded values of the selected measure', () {
      final e = entry('2024-01-01', weight: 4, height: 0, head: 36);
      expect(measureValue(e, 'weight'), 4);
      expect(measureValue(e, 'height'), isNull);
      expect(measureValue(e, 'head'), 36);
    });

    test('places points by age from the reference date, sorted and limited to the range', () {
      final entries = [
        entry('2027-01-01', head: 50),
        entry('2024-07-01', head: 43),
        entry('2023-12-01', head: 33),
        entry('2024-01-01', head: 34.5),
        entry('2024-03-01', weight: 5),
      ];
      final pts = childPoints(entries, 'head', '2024-01-01', 24);
      expect(pts.map((p) => p.value).toList(), [34.5, 43]);
      expect(pts[0].month, 0);
      expect(childPoints(entries, 'head', '2024-01-01', 60).map((p) => p.value).toList(), [34.5, 43, 50]);
    });
  });

  group('latest percentile', () {
    test('uses the WHO head circumference table for head (median = P50) per sex', () {
      expect(latestPercentile([entry('2024-01-01', head: hcfaBoys[0][0])], 'head', 'boy', '2024-01-01'), 50);
      expect(latestPercentile([entry('2024-01-01', head: hcfaGirls[0][0])], 'head', 'girl', '2024-01-01'), 50);
      expect(measurePercentile('weight', 'boy', 6, 8), percentile('weight', 'boy', 6, 8));
    });

    test('takes the most recent measurement, not the first row', () {
      final entries = [entry('2024-01-01', head: hcfaBoys[0][0]), entry('2024-07-01', head: 50)];
      expect(latestPercentile(entries, 'head', 'boy', '2024-01-01'), greaterThan(97));
      expect(latestPercentile(entries.reversed.toList(), 'head', 'boy', '2024-01-01'), greaterThan(97));
    });

    test('works up to 60 months (standing height after 24 months) and stops after', () {
      expect(latestPercentile([entry('2027-01-01', height: 96)], 'height', 'girl', '2024-01-01'), isNotNull);
      expect(latestPercentile([entry('2029-06-01', weight: 20)], 'weight', 'boy', '2024-01-01'), isNull);
      expect(latestPercentile([], 'head', 'boy', '2024-01-01'), isNull);
    });

    test('uses the given reference date (corrected age for preterm babies)', () {
      final entries = [entry('2024-04-01', head: 38)];
      final chrono = latestPercentile(entries, 'head', 'boy', '2024-01-01')!;
      final corrected = latestPercentile(entries, 'head', 'boy', '2024-02-15')!;
      expect(corrected, greaterThan(chrono));
    });
  });

  group('percentile chip', () {
    test('maps percentiles to tone and label', () {
      expect(percentileChip(50), (tone: 'ok', key: 'who_normal', fallback: 'normal'));
      expect(percentileChip(15).tone, 'ok');
      expect(percentileChip(85).tone, 'ok');
      expect(percentileChip(10), (tone: 'watch', key: 'who_watch', fallback: 'izləyin'));
      expect(percentileChip(97).tone, 'watch');
      expect(percentileChip(2), (tone: 'alert', key: 'who_alert', fallback: 'həkimlə danışın'));
      expect(percentileChip(99).tone, 'alert');
    });
  });
}
