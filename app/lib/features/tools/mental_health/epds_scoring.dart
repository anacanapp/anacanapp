// Ported from: src/lib/epdsScoring.ts
//
// Pure EPDS (Edinburgh Postnatal Depression Scale) scoring. Question 10 asks about thoughts of self-harm: any answer
// above 0 is a safety signal on its own and always leads to the urgent help result, whatever the total.
import 'package:flutter/foundation.dart';

/// 'low' | 'moderate' | 'high'
typedef EpdsRiskLevel = String;

/// EPDS item number of the self-harm question.
const int epdsSelfHarmQuestion = 10;

@immutable
class EpdsScore {
  const EpdsScore({required this.totalScore, required this.riskLevel, required this.selfHarm});
  final num totalScore;
  final EpdsRiskLevel riskLevel;

  /// Question 10 answered above 0. Always forces riskLevel 'high'.
  final bool selfHarm;

  @override
  bool operator ==(Object other) => other is EpdsScore && other.totalScore == totalScore && other.riskLevel == riskLevel && other.selfHarm == selfHarm;
  @override
  int get hashCode => Object.hash(totalScore, riskLevel, selfHarm);
  @override
  String toString() => 'EpdsScore($totalScore, $riskLevel, selfHarm: $selfHarm)';
}

num _toScore(Object? value) {
  final n = value is num ? value : (value is String ? num.tryParse(value.trim().isEmpty ? '0' : value.trim()) : null);
  return n != null && n.isFinite && n > 0 ? n : 0;
}

/// Score of the self-harm item (0 when unanswered). Answers are keyed by question number (string or int keys).
num epdsSelfHarmScore(Map<Object, Object?>? answers) {
  if (answers == null) return 0;
  final byString = answers['$epdsSelfHarmQuestion'];
  return _toScore(byString ?? answers[epdsSelfHarmQuestion]);
}

/// True when the self-harm item (question 10) was answered above 0.
bool hasEpdsSelfHarm(Map<Object, Object?>? answers) => epdsSelfHarmScore(answers) > 0;

/// Total + risk band (13+ high, 10-12 moderate) plus the separate self-harm flag, which lifts the band to 'high'.
EpdsScore scoreEpds(Map<Object, Object?>? answers) {
  final values = answers?.values ?? const <Object?>[];
  final total = values.fold<num>(0, (sum, v) => sum + _toScore(v));
  final selfHarm = hasEpdsSelfHarm(answers);
  var risk = 'low';
  if (selfHarm || total >= 13) {
    risk = 'high';
  } else if (total >= 10) {
    risk = 'moderate';
  }
  return EpdsScore(totalScore: total, riskLevel: risk, selfHarm: selfHarm);
}
