// Ported from: src/lib/weightTrackerStage.ts
//
// Which kind of weight tracking a user gets. Only a pregnancy shows week-based gain ranges, the IOM chart and the
// pre-eclampsia danger strip; cycle tracking is plain weight/BMI, after birth it is postpartum tracking. The
// pregnancy week is never invented: an unknown week hides every week-dependent range.
import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart';

/// 'pregnancy' | 'cycle' | 'postpartum'
typedef WeightTrackerMode = String;

@immutable
class WeightTrackerStage {
  const WeightTrackerStage({required this.mode, required this.week, required this.trimester, required this.showGainRange, required this.showPregnancySafety});
  final WeightTrackerMode mode;

  /// Current pregnancy week, only in pregnancy mode and only when known (> 0).
  final int? week;
  final int? trimester;

  /// IOM gain range, its progress bar and the week chart are shown only for a known pregnancy week.
  final bool showGainRange;

  /// "Call now: sudden swelling, severe headache, vision changes" (pre-eclampsia) belongs to pregnancy only.
  final bool showPregnancySafety;

  @override
  bool operator ==(Object other) =>
      other is WeightTrackerStage &&
      other.mode == mode &&
      other.week == week &&
      other.trimester == trimester &&
      other.showGainRange == showGainRange &&
      other.showPregnancySafety == showPregnancySafety;
  @override
  int get hashCode => Object.hash(mode, week, trimester, showGainRange, showPregnancySafety);
  @override
  String toString() => 'WeightTrackerStage($mode, week: $week, trimester: $trimester, range: $showGainRange, safety: $showPregnancySafety)';
}

WeightTrackerStage resolveWeightTrackerStage(String? lifeStage, num? pregnancyWeek) {
  if (lifeStage == 'bump') {
    final week = pregnancyWeek != null && pregnancyWeek.isFinite && pregnancyWeek > 0 ? (pregnancyWeek.floor() > 42 ? 42 : pregnancyWeek.floor()) : null;
    final trimester = week == null ? null : (week <= 12 ? 1 : (week <= 26 ? 2 : 3));
    return WeightTrackerStage(mode: 'pregnancy', week: week, trimester: trimester, showGainRange: week != null, showPregnancySafety: true);
  }
  return WeightTrackerStage(
    mode: lifeStage == 'mommy' ? 'postpartum' : 'cycle',
    week: null,
    trimester: null,
    showGainRange: false,
    showPregnancySafety: false,
  );
}

/// 'up' | 'down' | 'stable'
typedef WeightTrend = String;

/// Direction of the latest change against the start weight; within ±0.5 kg counts as stable.
WeightTrend weightTrend(num totalChange) {
  if (!totalChange.isFinite || totalChange.abs() < 0.5) return 'stable';
  return totalChange > 0 ? 'up' : 'down';
}

@immutable
class WeightPromptInput {
  const WeightPromptInput({
    required this.stage,
    required this.startWeight,
    required this.currentWeight,
    required this.change,
    required this.statusText,
    this.recommended,
    this.bmi,
  });
  final WeightTrackerStage stage;
  final num startWeight;
  final num currentWeight;
  final num change;
  final String statusText;
  final ({num min, num max})? recommended;
  final num? bmi;
}

/// Translated prompt words, passed in so this stays a pure function.
@immutable
class WeightPromptCopy {
  const WeightPromptCopy({
    required this.prefix,
    required this.week,
    required this.start,
    required this.now,
    required this.gain,
    required this.change,
    required this.rec,
    required this.status,
    required this.rules,
    required this.contextPregnancyUnknownWeek,
    required this.contextCycle,
    required this.contextPostpartum,
  });
  final String prefix;
  final String week;
  final String start;
  final String now;
  final String gain;
  final String change;
  final String rec;
  final String status;
  final String rules;
  final String contextPregnancyUnknownWeek;
  final String contextCycle;
  final String contextPostpartum;
}

String _kg(num value) => '${jsNumberToString(jsRound(value * 10) / 10)}kg';

/// The AI weight analysis prompt for the user's real stage: no pregnancy week or gain range outside pregnancy.
String buildWeightAiPrompt(WeightPromptInput input, WeightPromptCopy copy) {
  final stage = input.stage;
  final parts = <String>[copy.prefix];
  if (stage.mode == 'pregnancy' && stage.week != null) {
    parts.add('${stage.week} ${copy.week},');
  } else if (stage.mode == 'pregnancy') {
    parts.add(copy.contextPregnancyUnknownWeek);
  } else {
    parts.add(stage.mode == 'postpartum' ? copy.contextPostpartum : copy.contextCycle);
  }
  parts.add('${copy.start} ${_kg(input.startWeight)}, ${copy.now} ${_kg(input.currentWeight)},');
  final rec = input.recommended;
  if (stage.showGainRange && rec != null) {
    parts.add('${copy.gain} ${_kg(input.change)} (${copy.rec} ${jsNumberToString(rec.min)}-${jsNumberToString(rec.max)}kg).');
  } else {
    parts.add('${copy.change} ${input.change >= 0 ? '+' : ''}${_kg(input.change)}.');
  }
  if (stage.mode != 'pregnancy' && input.bmi != null) parts.add('BMI: ${jsNumberToString(input.bmi!)}.');
  parts.addAll(['${copy.status} ${input.statusText}.', copy.rules]);
  return parts.join(' ');
}
