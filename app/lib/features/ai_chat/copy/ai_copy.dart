// Ported from: src/lib/feature37-i18n.ts (feature37Text) — AI chat subset (ai_copy.g.dart).
import '../../../core/i18n/i18n.dart';
import 'ai_copy.g.dart';

/// `feature37Text(key, language)`: own language, else English, else the key.
String aiFeature37Text(String key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kAiFeature37Copy[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return kAiFeature37Copy['en']?[key] ?? key;
}
