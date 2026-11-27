// Ported from: src/lib/followup-i18n.ts (followupText for the fairytale_* keys), src/lib/fiction-names.ts
//              (exampleChildName)
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import 'media_copy.g.dart';

/// `followupText(key, language, values)`: own text, else English; `{name}` tokens without a value stay.
String mediaFollowupText(String key, [String? language, Map<String, Object?> values = const {}]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kMediaFollowupCopy[lang]?[key];
  final text = (own != null && own.isNotEmpty) ? own : (kMediaFollowupCopy['en']?[key] ?? key);
  return text.replaceAllMapped(RegExp(r'\{([a-zA-Z0-9_]+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);
}

/// `exampleChildName(language)`: a fictional example, never a real profile name.
String exampleChildName(String language) => kFictionNames[normalizeAppLanguage(language)] ?? kFictionNames['az']!;
