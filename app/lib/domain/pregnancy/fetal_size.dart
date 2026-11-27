// Ported from: src/lib/fetal-size.ts, src/lib/fetal-size-copy.ts
//
// Fetal size by completed pregnancy week (Hadlock 1991 from 20 weeks, embryology table / CRL before), the single
// source for the hero fallback, the week pages and the ultrasound weight tool. Data: data/fetal_size_data.g.dart.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/fetal_size_data.g.dart';

export 'data/fetal_size_data.g.dart' show hadlockEfw;

/// 'crl' | 'crown-heel'
typedef FetalMeasure = String;

class FetalSizeRow {
  const FetalSizeRow({
    required this.fruit,
    required this.emoji,
    required this.lengthCm,
    required this.weightG,
    required this.measure,
  });
  final String fruit;
  final String emoji;
  final double lengthCm;
  final double weightG;
  final FetalMeasure measure;
}

/// FETAL_SIZE_BY_WEEK (weeks 4-42).
final Map<int, FetalSizeRow> fetalSizeByWeek = {
  for (final e in fetalSizeByWeekData.entries)
    e.key: FetalSizeRow(
      fruit: e.value['fruit']! as String,
      emoji: e.value['emoji']! as String,
      lengthCm: (e.value['lengthCm']! as num).toDouble(),
      weightG: (e.value['weightG']! as num).toDouble(),
      measure: e.value['measure']! as String,
    ),
};

/// Hadlock 1991 median estimated fetal weight (g) at an exact gestational age in weeks.
double hadlockMedianG(num gaWeeks) => math.exp(0.578 + 0.332 * gaWeeks - 0.00354 * gaWeeks * gaWeeks);

/// Hero note under the size tags; unknown languages fall back to English.
String fetalLengthNote(String? language) => fetalLengthNotes[language ?? ''] ?? fetalLengthNotes['en']!;

final List<String> fetalLengthNoteLanguages = fetalLengthNotes.keys.toList();

/// Very small weights (first weeks) read better as "<0.1" than "0.01".
String formatFetalWeight(num grams) => grams > 0 && grams < 0.1 ? '<0.1' : jsNumberToString(grams);
