// Ported from: src/lib/bloodSugar.ts
//
// Blood sugar in pregnancy (gestational diabetes self-monitoring). Targets (ACOG / ADA / NICE style): fasting
// < 95 mg/dL (5.3 mmol/L), 1 h after a meal < 140 (7.8), 2 h after a meal < 120 (6.7); below 70 (3.9) is low.
// Values are always stored in mg/dL; mmol/L is a per-device display / input preference (1 mmol/L = 18 mg/dL).
import '../../../state/local_store.dart';

/// 'mgdl' | 'mmol'
typedef GlucoseUnit = String;

/// 'low' | 'normal' | 'high'
typedef GlucoseStatus = String;

/// reading_type values. `after_meal` keeps its original meaning (2 hours after a meal).
const String afterMeal1h = 'after_meal_1h';
const String afterMeal2h = 'after_meal';

const int mgdlPerMmol = 18;
const int hypoMgdl = 70;
const ({int fasting, int after1h, int after2h}) targetsMgdl = (fasting: 95, after1h: 140, after2h: 120);

/// Upper target (exclusive) for a reading type, or null when no pregnancy target applies.
int? targetFor(String readingType) {
  if (readingType == 'fasting') return targetsMgdl.fasting;
  if (readingType == afterMeal1h) return targetsMgdl.after1h;
  if (readingType == afterMeal2h) return targetsMgdl.after2h;
  return null;
}

/// low: below 70. high: at or above the target; before-meal and bedtime use the fasting target, random the 1 h one.
GlucoseStatus glucoseStatus(num mgdl, String readingType) {
  if (!mgdl.isFinite) return 'normal';
  if (mgdl < hypoMgdl) return 'low';
  final target = targetFor(readingType) ?? (readingType == 'before_meal' || readingType == 'bedtime' ? targetsMgdl.fasting : targetsMgdl.after1h);
  return mgdl >= target ? 'high' : 'normal';
}

/// `Math.round` (halves toward +∞).
num _jsRound(num v) => (v + 0.5).floorToDouble();

num _tidy(num v) => v == v.roundToDouble() ? v.toInt() : v;

num mmolToMgdl(num mmol) => _tidy(_jsRound(mmol * mgdlPerMmol * 10) / 10);
num mgdlToMmol(num mgdl) => _tidy(_jsRound((mgdl / mgdlPerMmol) * 10) / 10);

/// Input text in the chosen unit → mg/dL to store (null when not a plausible reading).
num? parseGlucoseInput(String text, GlucoseUnit unit) {
  final trimmed = text.trim().replaceFirst(',', '.');
  final value = trimmed.isEmpty ? 0 : num.tryParse(trimmed);
  if (value == null || !value.isFinite || value <= 0) return null;
  final mgdl = unit == 'mmol' ? mmolToMgdl(value) : _tidy(_jsRound(value * 10) / 10);
  return mgdl >= 10 && mgdl <= 900 ? mgdl : null;
}

/// Stored mg/dL in the chosen unit (mg/dL whole number, mmol/L one decimal).
String formatGlucose(num mgdl, GlucoseUnit unit) {
  if (unit == 'mmol') return mgdlToMmol(mgdl).toStringAsFixed(1);
  return '${_jsRound(mgdl).toInt()}';
}

String unitLabel(GlucoseUnit unit) => unit == 'mmol' ? 'mmol/L' : 'mg/dL';

/// Threshold text in the chosen unit, e.g. "95 mg/dL" or "5.3 mmol/L".
String thresholdText(num mgdl, GlucoseUnit unit) => '${formatGlucose(mgdl, unit)} ${unitLabel(unit)}';

/// "Repeated" highs: at least 2 readings of the last 7 days at or above their target.
bool hasRepeatedHighs(List<Map<String, dynamic>> logs, [DateTime? now]) {
  final since = (now ?? DateTime.now()).millisecondsSinceEpoch - 7 * 86400000;
  var highs = 0;
  for (final log in logs) {
    final at = DateTime.tryParse('${log['logged_at']}')?.millisecondsSinceEpoch;
    if (at == null || !(at >= since)) continue;
    final raw = log['reading_value'];
    final value = raw is num ? raw : num.tryParse('$raw') ?? double.nan;
    if (glucoseStatus(value, '${log['reading_type']}') == 'high' && ++highs >= 2) return true;
  }
  return false;
}

const String glucoseUnitKey = 'anacan_glucose_unit';

/// Per-device unit preference (mg/dL by default).
GlucoseUnit loadGlucoseUnit(LocalStore store) {
  try {
    return store.getItem(glucoseUnitKey) == 'mmol' ? 'mmol' : 'mgdl';
  } catch (_) {
    return 'mgdl';
  }
}

void saveGlucoseUnit(LocalStore store, GlucoseUnit unit) {
  try {
    store.setItem(glucoseUnitKey, unit);
  } catch (_) {
    // storage unavailable: keep the in-memory choice
  }
}
