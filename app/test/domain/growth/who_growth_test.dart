// Ported from: src/lib/whoGrowth.test.ts

import 'package:anacan/domain/growth/who_growth.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('whoGrowth.percentile / zScore', () {
    test('returns exactly the 50th percentile when the value equals the median (z=0)', () {
      expect(percentile('weight', 'boy', 0, 3.3464), 50);
    });
    test('is monotonically increasing: a heavier baby at the same age/sex has a higher percentile', () {
      final low = percentile('weight', 'boy', 6, 6.0), mid = percentile('weight', 'boy', 6, 7.9340), high = percentile('weight', 'boy', 6, 10.5);
      expect([low, mid, high].every((p) => p != null), true);
      expect(low! < mid!, true);
      expect(mid < high!, true);
    });
    test('flags a significantly underweight value with a low percentile (<15, "watch/alert" territory)', () {
      expect(percentile('weight', 'boy', 6, 5.0)! < 15, true);
    });
    test('flags a significantly overweight value with a high percentile (>85)', () {
      expect(percentile('weight', 'boy', 6, 11.5)! > 85, true);
    });
    test('returns null for an age outside the supported 0-60 month range', () {
      expect(percentile('weight', 'boy', -1, 5), isNull);
      expect(percentile('weight', 'boy', 61, 15), isNull);
      expect(zScore('height', 'girl', 72, 110), isNull);
      expect(zScore('head', 'boy', double.nan, 45), isNull);
    });
    test('returns null for a non-positive measured value (invalid input, not a real measurement)', () {
      expect(percentile('weight', 'girl', 3, 0), isNull);
      expect(percentile('weight', 'girl', 3, -2), isNull);
    });
    test('boy and girl medians differ (uses sex-specific WHO tables, not a shared curve)', () {
      expect(percentile('weight', 'girl', 0, 3.3464)! >= 50, true);
    });
  });

  group('whoGrowth.percentileLabel', () {
    test('labels the healthy "ok" range as 15-85 inclusive', () {
      for (final p in [50, 15, 85]) {
        expect(percentileLabelTone(p), 'ok');
      }
    });
    test('labels the "watch" range as 3-14 and 86-97', () {
      for (final p in [10, 3, 97, 90]) {
        expect(percentileLabelTone(p), 'watch');
      }
    });
    test('labels extreme percentiles (<3 or >97) as "alert"', () {
      for (final p in [2, 0, 98, 100]) {
        expect(percentileLabelTone(p), 'alert');
      }
    });
  });

  group('whoGrowth.ageInMonths', () {
    test('computes ~1 month for a 30.4375-day gap (WHO average month length)', () {
      expect(ageInMonths(DateTime.parse('2026-01-01T00:00:00Z'), DateTime.parse('2026-01-31T10:30:00Z')), closeTo(1, 0.05));
    });
    test('returns 0 for the same date', () {
      expect(ageInMonths('2026-06-15T00:00:00Z', '2026-06-15T00:00:00Z'), 0);
    });
  });

  group('whoGrowth 2-5 years and head circumference (WHO reference points)', () {
    double sdValue(String measure, String sex, int age, double z) {
      var lo = 1.0, hi = 200.0;
      for (var i = 0; i < 60; i++) {
        final mid = (lo + hi) / 2;
        if (zScore(measure, sex, age, mid)! < z) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return jsRound(lo * 10) / 10;
    }

    for (final (measure, sex, age, minus2, median, plus2) in [
      ('weight', 'boy', 36, 11.3, 14.3, 18.3),
      ('weight', 'boy', 60, 14.1, 18.3, 24.2),
      ('weight', 'girl', 60, 13.7, 18.2, 24.9),
      ('height', 'boy', 24, 81.0, 87.1, 93.2),
      ('height', 'boy', 60, 100.7, 110.0, 119.2),
      ('height', 'girl', 60, 99.9, 109.4, 118.9),
      ('head', 'boy', 0, 31.9, 34.5, 37.0),
      ('head', 'boy', 12, 43.5, 46.1, 48.6),
      ('head', 'girl', 24, 44.4, 47.2, 50.0),
      ('head', 'boy', 60, 47.7, 50.7, 53.7),
      ('head', 'girl', 60, 47.1, 49.9, 52.8),
    ]) {
      test('$measure $sex $age months matches WHO -2SD/median/+2SD', () {
        expect(jsRound(valueAtPercentile(measure, sex, age, 50)! * 10) / 10, median);
        expect(sdValue(measure, sex, age, -2), minus2);
        expect(sdValue(measure, sex, age, 2), plus2);
      });
    }

    test('uses recumbent length before 24 months and standing height from 24 months', () {
      expect(jsRound(valueAtPercentile('height', 'boy', 23.999, 50)! * 10) / 10, 87.8);
      expect(valueAtPercentile('height', 'boy', 24, 50), 87.12);
    });
    test('keeps the 0-24 month values unchanged', () {
      expect(percentile('weight', 'boy', 0, 3.3464), 50);
      expect(percentile('height', 'girl', 12, 74.015), 50);
      expect(buildCurveData('weight', 'boy'), hasLength(25));
      expect(buildCurveData('head', 'girl', 60), hasLength(61));
    });
    test('head circumference helpers', () {
      expect(headCircumferencePercentile('boy', 0, 34.46), 50);
      expect(headCircumferencePercentile('girl', 0, 33.88), 50);
      expect(headCircumferenceZScore('boy', 12, 46.07), closeTo(0, 0.005));
      expect(headCircumferencePercentile('boy', 6, 40)! < 3, true);
      expect(headCircumferencePercentile('boy', 6, 0), isNull);
    });
  });
}
