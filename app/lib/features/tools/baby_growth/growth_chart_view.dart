// Ported from: src/lib/growthChartView.ts
//
// Pure helpers of the growth tracker's WHO chart: weight, height and head circumference; the chart spans the child's
// age (0-60 months), at least 0-24 months so it stays readable.
import 'dart:math' as math;

import '../../../domain/growth/who_growth.dart';
import '../../../domain/js_compat.dart';

/// `GrowthEntryLike` (a `baby_growth` row).
class GrowthEntryLike {
  const GrowthEntryLike({required this.entryDate, this.weightKg, this.heightCm, this.headCm});
  factory GrowthEntryLike.fromRow(Map<String, dynamic> r) => GrowthEntryLike(
        entryDate: '${r['entry_date'] ?? ''}',
        weightKg: r['weight_kg'] as num?,
        heightCm: r['height_cm'] as num?,
        headCm: r['head_cm'] as num?,
      );
  final String entryDate;
  final num? weightKg;
  final num? heightCm;
  final num? headCm;
}

class ChildPoint {
  const ChildPoint({required this.month, required this.value});
  final double month;
  final num value;
}

/// Smallest chart range (months).
const int minChartMonths = 24;

const List<Measure> growthMeasures = ['weight', 'height', 'head'];

/// Measure button label (tr key + az fallback).
({String key, String fallback}) measureLabel(Measure measure) {
  if (measure == 'weight') return (key: 'who_weight', fallback: 'Çəki (kq)');
  if (measure == 'height') return (key: 'who_height', fallback: 'Boy (sm)');
  return (key: 'growthtz_who_head', fallback: 'Baş çevrəsi (sm)');
}

num? measureValue(GrowthEntryLike entry, Measure measure) {
  final v = measure == 'weight' ? entry.weightKg : measure == 'height' ? entry.heightCm : entry.headCm;
  return v != null && v.isFinite && v > 0 ? v : null;
}

/// Last chart month: 24 while the child is younger than two, then the age rounded up to a multiple of 6, max 60.
int chartMaxMonth(num ageMonths) {
  if (!ageMonths.isFinite || ageMonths <= minChartMonths) return minChartMonths;
  return math.min(maxAgeMonths, (ageMonths / 6).ceil() * 6);
}

/// X axis ticks: every 6 months up to 36, then every 12; the last month is always included.
List<int> chartTicks(int maxMonth) {
  final step = maxMonth <= 36 ? 6 : 12;
  final ticks = <int>[];
  for (var m = 0; m <= maxMonth; m += step) {
    ticks.add(m);
  }
  if (ticks.last != maxMonth) ticks.add(maxMonth);
  return ticks;
}

/// The child's measurements placed at months (from the reference date; EDD for preterm babies), ascending.
List<ChildPoint> childPoints(List<GrowthEntryLike> entries, Measure measure, String ageReferenceDate, num maxMonth) {
  final points = <ChildPoint>[];
  for (final e in entries) {
    final value = measureValue(e, measure);
    if (value == null) continue;
    final m = ageInMonths(ageReferenceDate, e.entryDate);
    if (!m.isFinite || m < 0 || m > maxMonth) continue;
    points.add(ChildPoint(month: jsRound(m * 10) / 10, value: value));
  }
  return jsSorted(points, (ChildPoint a, ChildPoint b) => a.month - b.month);
}

/// The measure's percentile (head circumference through headCircumferencePercentile).
int? measurePercentile(Measure measure, Sex sex, num ageMonths, num value) =>
    measure == 'head' ? headCircumferencePercentile(sex, ageMonths, value) : percentile(measure, sex, ageMonths, value);

/// Percentile of the most recent (by date) measurement with a value; null outside 0-60 months.
int? latestPercentile(List<GrowthEntryLike> entries, Measure measure, Sex sex, String ageReferenceDate) {
  final points = childPoints(entries, measure, ageReferenceDate, maxAgeMonths);
  if (points.isEmpty) return null;
  final last = points.last;
  return measurePercentile(measure, sex, last.month, last.value);
}

/// 'ok' | 'watch' | 'alert'
typedef PercentileTone = String;

/// Tone and label (tr key + az fallback) of the percentile chip.
({PercentileTone tone, String key, String fallback}) percentileChip(num p) {
  final tone = percentileLabelTone(p);
  if (tone == 'ok') return (tone: tone, key: 'who_normal', fallback: 'normal');
  if (tone == 'watch') return (tone: tone, key: 'who_watch', fallback: 'izləyin');
  return (tone: tone, key: 'who_alert', fallback: 'həkimlə danışın');
}
