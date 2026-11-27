// Ported from: src/lib/maternity-i18n.ts (maternityText), src/lib/followup-i18n.ts (followupText for the names_* and
//              maternity_* keys the pregnancy tools read)
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import 'maternity_copy.g.dart';

export 'maternity_copy.g.dart' show kMaternityReviewedAt, kMaternityCountryInput, kMaternityCountrySources;

String _fill(String text, Map<String, Object?> values) => text.replaceAllMapped(
      RegExp(r'\{([a-zA-Z0-9_]+)\}'),
      (m) => values.containsKey(m.group(1)) && values[m.group(1)] != null ? '${values[m.group(1)]}' : m.group(0)!,
    );

/// `maternityText(key, language, values)`: own text, else English, else ''.
String maternityText(String key, [String? language, Map<String, Object?> values = const {}]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kMaternityCopy[lang]?[key];
  final text = (own != null && own.isNotEmpty) ? own : (kMaternityCopy['en']?[key] ?? '');
  return _fill(text, values);
}

/// `followupText(key, language, values)` for `names_*` / `maternity_*`: own text, else English.
String pregnancyFollowupText(String key, [String? language, Map<String, Object?> values = const {}]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kPregnancyFollowupCopy[lang]?[key];
  final text = (own != null && own.isNotEmpty) ? own : (kPregnancyFollowupCopy['en']?[key] ?? key);
  return _fill(text, values);
}
