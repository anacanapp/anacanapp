// Ported from: src/lib/pregnancyWeightGain.ts, src/lib/pregnancyWeightBmi.ts
//
// IOM (2009) cumulative gestational weight-gain anchors with linear interpolation, plus pre-pregnancy BMI.
// The twin/multiple anchor ends at week 37 (earlier "full term"), never mix it up with the singleton one.

import '../js_compat.dart';

/// [week, min_kg, max_kg].
typedef WeightGainAnchor = List<double>;

const List<WeightGainAnchor> singleGainAnchors = [
  [0, 0, 0],
  [13, 0.5, 2],
  [26, 4, 8],
  [40, 8, 14],
];
const List<WeightGainAnchor> multipleGainAnchors = [
  [0, 0, 0],
  [13, 0.5, 2],
  [26, 6, 10],
  [37, 16.8, 24.5],
];

/// [min, max] cumulative gain (kg) for [week]; flat after the last anchor (no extrapolation).
List<double> interpolateGain(num week, List<WeightGainAnchor> anchors) {
  final last = anchors[anchors.length - 1];
  final lastWeek = last[0];
  if (week <= 0) return [0, 0];
  if (week >= lastWeek) return [last[1], last[2]];
  for (var i = 1; i < anchors.length; i++) {
    if (week <= anchors[i][0]) {
      final a = anchors[i - 1], b = anchors[i];
      final t = (week - a[0]) / (b[0] - a[0]);
      return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
    }
  }
  return [last[1], last[2]];
}

/// 'under' | 'normal' | 'over' | 'obese'
typedef PregnancyBmiCategory = String;

const Map<PregnancyBmiCategory, List<double>> iomTotalGain = {
  'under': [12.5, 18],
  'normal': [11.5, 16],
  'over': [7, 11.5],
  'obese': [5, 9],
};

/// Singleton anchors by BMI: 0.5-2 kg in the first trimester, then a straight line to the IOM total at week 40.
List<WeightGainAnchor> singleGainAnchorsFor(PregnancyBmiCategory category) {
  final t = iomTotalGain[category]!;
  return [
    [0, 0, 0],
    [13, 0.5, 2],
    [40, t[0], t[1]],
  ];
}

bool isValidHeightCm(num h) => h.isFinite && h >= 120 && h <= 220;
bool isValidWeightKg(num w) => w.isFinite && w >= 30 && w <= 250;

/// BMI rounded to one decimal, or null when either value is missing/implausible.
double? computeBmi(num? weightKg, num? heightCm) {
  if (weightKg == null || heightCm == null || !isValidWeightKg(weightKg) || !isValidHeightCm(heightCm)) return null;
  final m = heightCm / 100;
  return jsRound(weightKg / (m * m) * 10) / 10;
}

PregnancyBmiCategory? bmiCategory(num? bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'under';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'over';
  return 'obese';
}

/// Accepts "65.5", "65,5" and surrounding spaces; NaN for anything else.
double parseDecimal(String input) {
  final s = input.trim().replaceFirst(',', '.');
  return RegExp(r'^\d+(\.\d+)?$').hasMatch(s) ? double.parse(s) : double.nan;
}
