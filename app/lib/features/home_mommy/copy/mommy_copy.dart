// Ported from: src/lib/feature37-i18n.ts (feature37Text), src/lib/followup-i18n.ts (followupText)
//
// Lookups over the generated tables (app/tool/mommy/gen_mommy_data.mjs): own language, else English.
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import 'mommy_copy.g.dart';

String _lookup(Map<String, Map<String, String>> table, String key, String? language) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = table[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return table['en']?[key] ?? key;
}

/// `feature37Text(key, language)` for the keys the mommy home uses.
String feature37Text(String key, [String? language]) => _lookup(kMommyFeature37Copy, key, language);

/// `followupText(key, language)` for `ai_sleep` / `ai_feeding` / `ai_diaper`.
String followupText(String key, [String? language]) => _lookup(kMommyFollowupCopy, key, language);
