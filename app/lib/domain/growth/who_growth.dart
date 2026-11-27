// Ported from: src/lib/whoGrowth.ts (tables: src/lib/whoGrowth.ts + src/lib/whoGrowthData.ts, generated into
// data/who_growth_data.g.dart)
//
// WHO Child Growth Standards (0-60 months), LMS method: z = ((X/M)^L − 1) / (L·S), percentile = Φ(z) × 100.
// Length is recumbent before 24 months and standing height from 24 months.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/who_growth_data.g.dart';

/// 'boy' | 'girl'
typedef Sex = String;

/// 'weight' (kg) | 'height' (cm) | 'head' (cm)
typedef Measure = String;

const int maxAgeMonths = 60;

class _Lms {
  const _Lms(this.l, this.m, this.s);
  final double l;
  final double m;
  final double s;
}

_Lms _rowLms(Measure measure, Sex sex, int m, bool standing) {
  final boy = sex == 'boy';
  if (measure == 'weight') {
    final row = m <= 24 ? (boy ? wfaBoys : wfaGirls)[m] : (boy ? wfaBoys25to60 : wfaGirls25to60)[m - 25];
    return _Lms(row[0], row[1], row[2]);
  }
  if (measure == 'head') {
    final row = (boy ? hcfaBoys : hcfaGirls)[m];
    return _Lms(1, row[0], row[1]);
  }
  final row = standing ? (boy ? hfaBoys24to60 : hfaGirls24to60)[m - 24] : (boy ? lfaBoys : lfaGirls)[m];
  return _Lms(1, row[0], row[1]);
}

_Lms? _getLms(Measure measure, Sex sex, num ageMonths) {
  if (!ageMonths.isFinite || ageMonths < 0 || ageMonths > maxAgeMonths) return null;
  final lo = ageMonths.floor();
  final hi = math.min(maxAgeMonths, ageMonths.ceil());
  final t = ageMonths - lo;
  final standing = measure == 'height' && ageMonths >= 24;
  final a = _rowLms(measure, sex, lo, standing);
  if (lo == hi) return a;
  final b = _rowLms(measure, sex, hi, standing);
  return _Lms(a.l + t * (b.l - a.l), a.m + t * (b.m - a.m), a.s + t * (b.s - a.s));
}

/// Normal CDF (Abramowitz-Stegun approximation, as in the TypeScript).
double _normCdf(double z) {
  final t = 1 / (1 + 0.2316419 * z.abs());
  final d = 0.3989422804014327 * math.exp(-z * z / 2);
  var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (z > 0) p = 1 - p;
  return p;
}

/// Fractional age in months (30.4375-day months). Arguments are DateTimes or date strings (`new Date(x)`).
double ageInMonths(Object birthDate, Object atDate) {
  final b = jsDate(birthDate), a = jsDate(atDate);
  if (a == null || b == null) return double.nan;
  return (a.millisecondsSinceEpoch - b.millisecondsSinceEpoch) / (30.4375 * 24 * 3600 * 1000);
}

/// z-score, or null outside 0-60 months or for a non-positive value.
double? zScore(Measure measure, Sex sex, num ageMonths, num value) {
  final lms = _getLms(measure, sex, ageMonths);
  if (lms == null || value <= 0) return null;
  if (lms.l.abs() < 1e-6) return math.log(value / lms.m) / lms.s;
  return (math.pow(value / lms.m, lms.l) - 1) / (lms.l * lms.s);
}

/// Percentile (0-100) or null.
int? percentile(Measure measure, Sex sex, num ageMonths, num value) {
  final z = zScore(measure, sex, ageMonths, value);
  if (z == null) return null;
  return jsRoundInt(_normCdf(z) * 100);
}

const Map<int, double> _fixedZ = {3: -1.8808, 15: -1.0364, 50: 0, 85: 1.0364, 97: 1.8808};

/// Expected value at percentile 3/15/50/85/97 (2 decimals), or null.
double? valueAtPercentile(Measure measure, Sex sex, num ageMonths, int p) {
  final lms = _getLms(measure, sex, ageMonths);
  if (lms == null) return null;
  final z = _fixedZ[p];
  if (z == null) return null;
  final val = lms.l.abs() < 1e-6
      ? lms.m * math.exp(lms.s * z)
      : lms.m * math.pow(1 + lms.l * lms.s * z, 1 / lms.l);
  return jsRound(val * 100) / 100;
}

const List<int> curvePercentiles = [3, 15, 50, 85, 97];

class GrowthCurvePoint {
  const GrowthCurvePoint({required this.month, this.p3, this.p15, this.p50, this.p85, this.p97, this.child});
  final int month;
  final double? p3;
  final double? p15;
  final double? p50;
  final double? p85;
  final double? p97;
  final double? child;

  Map<String, Object?> toJson() => {'month': month, 'p3': p3, 'p15': p15, 'p50': p50, 'p85': p85, 'p97': p97};
}

/// Curve data (0-24 months by default, up to 60).
List<GrowthCurvePoint> buildCurveData(Measure measure, Sex sex, [num maxMonth = 24]) {
  final last = math.max(0, math.min(maxAgeMonths, maxMonth.floor()));
  return [
    for (var m = 0; m <= last; m++)
      GrowthCurvePoint(
        month: m,
        p3: valueAtPercentile(measure, sex, m, 3),
        p15: valueAtPercentile(measure, sex, m, 15),
        p50: valueAtPercentile(measure, sex, m, 50),
        p85: valueAtPercentile(measure, sex, m, 85),
        p97: valueAtPercentile(measure, sex, m, 97),
      ),
  ];
}

double? headCircumferenceZScore(Sex sex, num ageMonths, num cm) => zScore('head', sex, ageMonths, cm);
int? headCircumferencePercentile(Sex sex, num ageMonths, num cm) => percentile('head', sex, ageMonths, cm);

/// Chip tone: 'ok' (15-85), 'watch' (3-97), else 'alert'.
String percentileLabelTone(num p) {
  if (p >= 15 && p <= 85) return 'ok';
  if (p >= 3 && p <= 97) return 'watch';
  return 'alert';
}
