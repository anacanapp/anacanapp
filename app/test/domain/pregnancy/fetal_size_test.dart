// Ported from: src/lib/fetal-size.test.ts

import 'package:anacan/domain/common/app_languages.dart';
import 'package:anacan/domain/models/anacan.dart';
import 'package:anacan/domain/pregnancy/fetal_growth.dart';
import 'package:anacan/domain/pregnancy/fetal_size.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final weeks = fetalSizeByWeek.keys.toList();

  group('fetal size reference', () {
    test('covers weeks 4-42 with growing weight and length within each measurement', () {
      expect(weeks, List.generate(39, (i) => i + 4));
      for (var w = 5; w <= 42; w++) {
        final a = fetalSizeByWeek[w - 1]!, b = fetalSizeByWeek[w]!;
        expect(b.weightG, greaterThanOrEqualTo(a.weightG), reason: 'weight $w');
        if (a.measure == b.measure) expect(b.lengthCm, greaterThan(a.lengthCm - 0.31), reason: 'length $w');
        expect(b.measure, w < 20 ? 'crl' : 'crown-heel');
      }
    });

    test('uses the Hadlock 1991 median from 20 weeks; the printed table matches the equation', () {
      for (var w = 20; w <= 40; w++) {
        expect(fetalSizeByWeek[w]!.weightG, jsRound(hadlockMedianG(w)));
      }
      for (final e in hadlockEfw.entries) {
        expect((e.value[2] - hadlockMedianG(e.key)).abs(), lessThanOrEqualTo(1.5));
      }
      expect([fetalSizeByWeek[40]!.lengthCm, fetalSizeByWeek[40]!.weightG], [51.2, 3619]);
    });

    test('matches the database values written by 20261112140000_hero_growth_data_fix (first day of the week)', () {
      expect([fetalSizeByWeek[20]!.lengthCm, fetalSizeByWeek[20]!.weightG, fetalSizeByWeek[20]!.fruit], [25.6, 331, 'Banan']);
      expect([fetalSizeByWeek[26]!.lengthCm, fetalSizeByWeek[26]!.weightG, fetalSizeByWeek[26]!.fruit], [35.6, 913, 'Kabaçok']);
      expect([fetalSizeByWeek[9]!.lengthCm, fetalSizeByWeek[9]!.weightG, fetalSizeByWeek[9]!.fruit], [2.4, 2, 'Gilas']);
    });

    test('keeps the app fallback table and the ultrasound tool on the same source', () {
      expect(fruitSizesMatchFetalSizes(), true);
      final fruits = fruitSizes();
      for (final w in weeks) {
        expect([fruits[w]!.lengthCm, fruits[w]!.weightG], [fetalSizeByWeek[w]!.lengthCm, fetalSizeByWeek[w]!.weightG]);
      }
      for (var w = 20; w <= 40; w++) {
        expect(getFetalWeightBand(w).p50, hadlockEfw[w]![2]);
        expect(estimatePercentileForWeight(w, hadlockEfw[w]![2]), 50);
      }
    });

    test('has the length note in every app language and formats tiny weights', () {
      for (final code in appLanguageCodes) {
        expect(fetalLengthNoteLanguages, contains(code), reason: code);
      }
      expect(formatFetalWeight(0.01), '<0.1');
      expect(formatFetalWeight(331), '331');
    });
  });

  group('fetalGrowth helpers (no vitest suite; values from the TypeScript formulas)', () {
    test('clamps and rounds the week, tones and discordance', () {
      expect(getFetalWeightBand(12).week, 20);
      expect(getFetalWeightBand(44).week, 40);
      expect(getFetalWeightBand(30.5).week, 31);
      expect(buildFetalGrowthChartData().length, 21);
      expect(estimatePercentileForWeight(30, 1000), 3);
      expect(estimatePercentileForWeight(30, 5000), 97);
      expect(percentileTone(9), 'watch-low');
      expect(percentileTone(91), 'watch-high');
      expect(percentileTone(50), 'ok');
      expect(calculateDiscordance([2000]), isNull);
      expect(calculateDiscordance([2000, 1500]), (percent: 25, level: 'high'));
      expect(calculateDiscordance([2000, 1800, 0]), (percent: 10, level: 'watch'));
    });
  });
}
