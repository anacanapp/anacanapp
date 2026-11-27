// Ported from: src/lib/fetalGrowth.ts
//
// Fetal Growth Tracker: Hadlock 1991 percentile reference (3/10/50/90/97) and helpers. General education and
// trend tracking only; never replaces the doctor's ultrasound report.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/fetal_size_data.g.dart';

class FetalWeightBand {
  const FetalWeightBand({
    required this.week,
    required this.p3,
    required this.p10,
    required this.p50,
    required this.p90,
    required this.p97,
  });
  final int week;
  final int p3;
  final int p10;
  final int p50;
  final int p90;
  final int p97;

  Map<String, Object?> toJson() => {'week': week, 'p3': p3, 'p10': p10, 'p50': p50, 'p90': p90, 'p97': p97};
}

const int fetalGrowthMinWeek = 20;
const int fetalGrowthMaxWeek = 40;

/// Full band for a week (clamped to 20-40, `Math.round` on fractional weeks).
FetalWeightBand getFetalWeightBand(num week) {
  final w = math.max(fetalGrowthMinWeek, math.min(fetalGrowthMaxWeek, jsRoundInt(week)));
  final r = hadlockEfw[w]!;
  return FetalWeightBand(week: w, p3: r[0], p10: r[1], p50: r[2], p90: r[3], p97: r[4]);
}

List<FetalWeightBand> buildFetalGrowthChartData() =>
    [for (var w = fetalGrowthMinWeek; w <= fetalGrowthMaxWeek; w++) getFetalWeightBand(w)];

/// Approximate percentile (0-100), linear between the 5 reference points.
int estimatePercentileForWeight(num week, num grams) {
  final b = getFetalWeightBand(week);
  final points = [
    [3, b.p3],
    [10, b.p10],
    [50, b.p50],
    [90, b.p90],
    [97, b.p97],
  ];
  if (grams <= points[0][1]) return 3;
  if (grams >= points[points.length - 1][1]) return 97;
  for (var i = 1; i < points.length; i++) {
    final prev = points[i - 1], cur = points[i];
    if (grams <= cur[1]) {
      final t = (grams - prev[1]) / (cur[1] - prev[1]);
      return jsRoundInt(prev[0] + t * (cur[0] - prev[0]));
    }
  }
  return 50;
}

/// 'watch-low' | 'ok' | 'watch-high'
String percentileTone(num percentile) {
  if (percentile < 10) return 'watch-low';
  if (percentile > 90) return 'watch-high';
  return 'ok';
}

/// Weight discordance between multiples: (max − min) / max × 100; ≥20 % is 'high', ≥10 % 'watch'.
({int percent, String level})? calculateDiscordance(List<num> efwGramsList) {
  final valid = efwGramsList.where((v) => v > 0).toList();
  if (valid.length < 2) return null;
  final max = valid.reduce(math.max);
  final min = valid.reduce(math.min);
  final percent = jsRoundInt(max > 0 ? (max - min) / max * 100 : 0);
  final level = percent >= 20 ? 'high' : (percent >= 10 ? 'watch' : 'normal');
  return (percent: percent, level: level);
}

const List<String> babyLabels = ['A', 'B', 'C', 'D'];
