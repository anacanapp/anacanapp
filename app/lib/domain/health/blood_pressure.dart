// Ported from: src/lib/bloodPressure.ts
//
// Blood pressure ranges: AHA for adults, separate thresholds in pregnancy (≥140/90 hypertension → doctor,
// ≥160/110 severe → urgent). A range label never diagnoses hypertension from one reading.

import 'data/health_data.g.dart';
import '../js_compat.dart';

/// 'low' | 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'
typedef BpCategory = String;

class BpAssessment {
  const BpAssessment({
    required this.category,
    required this.label,
    required this.emoji,
    required this.bg,
    required this.ink,
    required this.guidance,
    required this.pregnancyAlert,
  });
  final BpCategory category;
  final String label;
  final String emoji;

  /// CSS palette references from the React app (`var(--a-…)`); the UI maps them to design tokens.
  final String bg;
  final String ink;

  /// May contain the `{emergency}` placeholder (see emergency.dart).
  final String guidance;

  /// 'none' | 'warning' | 'urgent'
  final String pregnancyAlert;
}

BpCategory classifyBpCategory(num systolic, num diastolic, bool isPregnant) {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (isPregnant && (systolic >= 130 || diastolic >= 85)) return 'elevated';
  if (!isPregnant && (systolic >= 130 || diastolic >= 80)) return 'stage1';
  if (!isPregnant && systolic >= 120) return 'elevated';
  if (systolic < 90 || diastolic < 60) return 'low';
  return 'normal';
}

BpAssessment classifyBp(num systolic, num diastolic, bool isPregnant, {Tr tr = azTr}) {
  final category = classifyBpCategory(systolic, diastolic, isPregnant);
  var alert = 'none';
  if (isPregnant) {
    if (systolic >= 160 || diastolic >= 110) {
      alert = 'urgent';
    } else if (systolic >= 140 || diastolic >= 90) {
      alert = 'warning';
    }
  }
  final meta = bpCategoryMeta[category]!;
  String text(Object v) {
    final m = v as Map;
    return tr(m['key'] as String, m['az'] as String);
  }

  return BpAssessment(
    category: category,
    label: text(meta['label']!),
    emoji: meta['emoji']! as String,
    bg: meta['bg']! as String,
    ink: meta['ink']! as String,
    guidance: text(meta['guidance']!),
    pregnancyAlert: alert,
  );
}
