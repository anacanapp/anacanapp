// Ported from: src/lib/bloodSugar.test.ts
import 'package:anacan/features/tools/blood_sugar/blood_sugar.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('gestational diabetes targets', () {
    test('uses fasting <95, 1 h <140 and 2 h <120 mg/dL', () {
      expect(targetFor('fasting'), 95);
      expect(targetFor(afterMeal1h), 140);
      expect(targetFor('after_meal'), 120);
      expect(glucoseStatus(94, 'fasting'), 'normal');
      expect(glucoseStatus(95, 'fasting'), 'high');
      expect(glucoseStatus(139, afterMeal1h), 'normal');
      expect(glucoseStatus(140, afterMeal1h), 'high');
      expect(glucoseStatus(119, 'after_meal'), 'normal');
      expect(glucoseStatus(125, 'after_meal'), 'high');
    });

    test('flags hypoglycaemia below 70 mg/dL for any reading type', () {
      expect(glucoseStatus(69, 'fasting'), 'low');
      expect(glucoseStatus(65, 'random'), 'low');
      expect(glucoseStatus(70, 'random'), 'normal');
    });
  });

  group('units', () {
    test('converts 1 mmol/L = 18 mg/dL and shows the published thresholds', () {
      expect(mmolToMgdl(5.3), 95.4);
      expect(mgdlToMmol(95), 5.3);
      expect(thresholdText(140, 'mmol'), '7.8 mmol/L');
      expect(thresholdText(120, 'mmol'), '6.7 mmol/L');
      expect(thresholdText(70, 'mmol'), '3.9 mmol/L');
      expect(thresholdText(95, 'mgdl'), '95 mg/dL');
    });

    test('parses input in either unit and stores mg/dL', () {
      expect(parseGlucoseInput('5,5', 'mmol'), 99);
      expect(parseGlucoseInput('92', 'mgdl'), 92);
      expect(parseGlucoseInput('', 'mgdl'), isNull);
      expect(parseGlucoseInput('abc', 'mmol'), isNull);
      expect(parseGlucoseInput('2000', 'mgdl'), isNull);
      expect(formatGlucose(99, 'mmol'), '5.5');
      expect(formatGlucose(99.4, 'mgdl'), '99');
    });
  });

  group('repeated readings above target', () {
    final now = DateTime.parse('2026-11-08T12:00:00Z');
    String at(int h) => now.subtract(Duration(hours: h)).toIso8601String();

    test('needs two highs within 7 days', () {
      expect(hasRepeatedHighs([{'reading_value': 100, 'reading_type': 'fasting', 'logged_at': at(1)}], now), isFalse);
      expect(
          hasRepeatedHighs([
            {'reading_value': 100, 'reading_type': 'fasting', 'logged_at': at(1)},
            {'reading_value': 130, 'reading_type': 'after_meal', 'logged_at': at(30)},
          ], now),
          isTrue);
      expect(
          hasRepeatedHighs([
            {'reading_value': 100, 'reading_type': 'fasting', 'logged_at': at(1)},
            {'reading_value': 130, 'reading_type': 'after_meal', 'logged_at': at(24 * 8)},
          ], now),
          isFalse);
    });
  });
}
