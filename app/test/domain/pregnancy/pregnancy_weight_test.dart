// Ported from: src/lib/pregnancyWeightGain.test.ts, src/lib/pregnancyWeightBmi.test.ts

import 'package:anacan/domain/pregnancy/pregnancy_weight.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('interpolateGain — singleton anchors', () {
    test('returns [0,0] at or before week 0', () {
      expect(interpolateGain(0, singleGainAnchors), [0, 0]);
      expect(interpolateGain(-5, singleGainAnchors), [0, 0]);
    });
    test('matches the exact anchor values at week 13, 26, 40', () {
      expect(interpolateGain(13, singleGainAnchors), [0.5, 2]);
      expect(interpolateGain(26, singleGainAnchors), [4, 8]);
      expect(interpolateGain(40, singleGainAnchors), [8, 14]);
    });
    test('linearly interpolates midway between two anchors', () {
      final r = interpolateGain(33, singleGainAnchors);
      expect(r[0], closeTo(6, 1e-5));
      expect(r[1], closeTo(11, 1e-5));
    });
    test('holds steady at the last anchor value beyond week 40 (no extrapolation)', () {
      expect(interpolateGain(42, singleGainAnchors), [8, 14]);
      expect(interpolateGain(45, singleGainAnchors), [8, 14]);
    });
    test('is monotonically non-decreasing across the full pregnancy', () {
      var prevMin = double.negativeInfinity, prevMax = double.negativeInfinity;
      for (var week = 0; week <= 42; week++) {
        final r = interpolateGain(week, singleGainAnchors);
        expect(r[0], greaterThanOrEqualTo(prevMin));
        expect(r[1], greaterThanOrEqualTo(prevMax));
        prevMin = r[0];
        prevMax = r[1];
      }
    });
  });

  group('interpolateGain — multiples (twin/triplet) anchors', () {
    test('matches the exact anchor values at week 13, 26, 37', () {
      expect(interpolateGain(13, multipleGainAnchors), [0.5, 2]);
      expect(interpolateGain(26, multipleGainAnchors), [6, 10]);
      expect(interpolateGain(37, multipleGainAnchors), [16.8, 24.5]);
    });
    test('holds steady at the last anchor from week 37 onward (twins\' "full-term" is earlier than 40wk)', () {
      expect(interpolateGain(37, multipleGainAnchors), [16.8, 24.5]);
      expect(interpolateGain(40, multipleGainAnchors), [16.8, 24.5]);
    });
    test('CRITICAL: gives a HIGHER recommended range than singleton at every week from 26 onward', () {
      for (final week in [26, 28, 30, 32, 34, 36, 37]) {
        final s = interpolateGain(week, singleGainAnchors), m = interpolateGain(week, multipleGainAnchors);
        expect(m[0], greaterThanOrEqualTo(s[0]));
        expect(m[1], greaterThan(s[1]));
      }
    });
  });

  group('pregnancyWeightBmi', () {
    test('classifies pre-pregnancy BMI with the WHO/IOM cut-offs', () {
      expect(bmiCategory(computeBmi(50, 170)), 'under');
      expect(bmiCategory(computeBmi(60, 165)), 'normal');
      expect(bmiCategory(computeBmi(75, 165)), 'over');
      expect(bmiCategory(computeBmi(90, 165)), 'obese');
      expect(bmiCategory(18.5), 'normal');
      expect(bmiCategory(25), 'over');
      expect(bmiCategory(30), 'obese');
      expect(computeBmi(60, null), isNull);
      expect(computeBmi(60, 80), isNull);
    });
    test('ends at the IOM 2009 single-pregnancy totals at 40 weeks', () {
      expect(interpolateGain(40, singleGainAnchorsFor('under')), [12.5, 18]);
      expect(interpolateGain(40, singleGainAnchorsFor('normal')), [11.5, 16]);
      expect(interpolateGain(40, singleGainAnchorsFor('over')), [7, 11.5]);
      expect(interpolateGain(40, singleGainAnchorsFor('obese')), [5, 9]);
      expect(interpolateGain(13, singleGainAnchorsFor('obese')), [0.5, 2]);
    });
    test('accepts comma and dot decimals only', () {
      expect(parseDecimal('65,5'), 65.5);
      expect(parseDecimal(' 65.5 '), 65.5);
      expect(parseDecimal('70'), 70);
      expect(parseDecimal('6a').isNaN, true);
      expect(parseDecimal('').isNaN, true);
    });
  });
}
