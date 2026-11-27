// Ported from: src/hooks/usePhaseTips.ts (PHASE_INFO, CATEGORY_INFO), src/hooks/useFlowReminders.ts (REMINDER_TYPE_INFO),
//              src/lib/tip-translations.ts (getTranslatedTip, bundled part)
import 'dart:ui' show Color;

import '../../../core/i18n/i18n.dart';

/// 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
typedef MenstrualPhase = String;

class PhaseInfo {
  const PhaseInfo(this.label, this._labelKey, this._labelAz, this.emoji, this.color, this.days);
  final String label;
  final String _labelKey;
  final String _labelAz;
  final String emoji;

  /// One-off literal from usePhaseTips.ts PHASE_INFO (Tailwind red-600 / green-600 / pink-500 / violet-500).
  final Color color;
  final String days;
  String get labelAz => tr(_labelKey, _labelAz);
}

const Map<String, PhaseInfo> kPhaseInfo = {
  'menstrual': PhaseInfo('Menstrual', 'usephasetips_menstrual_faza', 'Menstrual Faza', '🩸', Color(0xFFDC2626), '1-5'),
  'follicular': PhaseInfo('Follicular', 'usephasetips_follikulyar_faza', 'Follikulyar Faza', '🌱', Color(0xFF16A34A), '6-13'),
  'ovulation': PhaseInfo('Ovulation', 'usephasetips_ovulyasiya_fazasi_6f38a1', 'Ovulyasiya Fazası', '🌸', Color(0xFFEC4899), '14-16'),
  'luteal': PhaseInfo('Luteal', 'usephasetips_luteal_faza', 'Luteal Faza', '🌙', Color(0xFF8B5CF6), '17-28'),
};

class CategoryInfo {
  const CategoryInfo(this.label, this._key, this._az, this.emoji);
  final String label;
  final String _key;
  final String _az;
  final String emoji;
  String get labelAz => tr(_key, _az);
}

const Map<String, CategoryInfo> kCategoryInfo = {
  'general': CategoryInfo('General', 'usephasetips_umumi_1b5521', 'Ümumi', '💡'),
  'nutrition': CategoryInfo('Nutrition', 'usephasetips_qidalanma', 'Qidalanma', '🥗'),
  'exercise': CategoryInfo('Exercise', 'usephasetips_mesq_046a80', 'Məşq', '🏃'),
  'selfcare': CategoryInfo('Self-care', 'usephasetips_ozune_qulluq_8253b4', 'Özünə Qulluq', '💆'),
  'mood': CategoryInfo('Mood', 'usephasetips_ehval_0457f9', 'Əhval', '😊'),
  'intimacy': CategoryInfo('Intimacy', 'usephasetips_yaxinliq_5a99bb', 'Yaxınlıq', '💕'),
};

class ReminderTypeInfo {
  const ReminderTypeInfo(this.label, this.emoji);
  final String label;
  final String emoji;
}

/// REMINDER_TYPE_INFO (only `emoji` is read by the flow home; labels are kept for parity).
const Map<String, ReminderTypeInfo> kReminderTypeInfo = {
  'period_start': ReminderTypeInfo('Period Start', '🔴'),
  'period_end': ReminderTypeInfo('Period End', '✅'),
  'ovulation': ReminderTypeInfo('Ovulation', '🌸'),
  'fertile_start': ReminderTypeInfo('Fertile Window Start', '💕'),
  'fertile_end': ReminderTypeInfo('Fertile Window End', '📅'),
  'pms': ReminderTypeInfo('PMS', '⚡'),
  'pill': ReminderTypeInfo('Pill Reminder', '💊'),
  'custom': ReminderTypeInfo('Custom', '🔔'),
};

/// `getTranslatedTip(text, lang)`: az → text; else the bundled `tip.<text>` entry of the dictionary.
/// The legacy TIP_TRANSLATIONS table of tip-translations.ts is not ported (README: gaps).
String getTranslatedTip(String text, String lang) {
  if (text.isEmpty) return '';
  if (lang == 'az') return text;
  return I18nRuntime.instance.store.lookup('tip.$text', lang) ?? text;
}
