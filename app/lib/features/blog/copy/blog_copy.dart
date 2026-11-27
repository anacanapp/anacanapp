// Ported from: src/lib/blog-i18n.ts (blogText), src/lib/followup-i18n.ts (followupText),
//              src/lib/feature37-i18n.ts (feature37Text)
//
// Lookups over the generated tables (app/test/features/blog/tool/gen_content_copy.mjs), only the keys the blog uses.
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import 'blog_copy.g.dart';

String _lang(String? language) => normalizeAppLanguage(language ?? currentLanguage());

/// `blogText(key, language)`: own language, else Azerbaijani.
String blogText(String key, [String? language]) {
  final own = kBlogEditorialCopy[_lang(language)]?[key];
  return own != null && own.isNotEmpty ? own : kBlogEditorialCopy['az']?[key] ?? key;
}

/// `followupText(key, language, values)`: own language, else English; `{name}` placeholders.
String blogFollowupText(String key, [String? language, Map<String, Object?> values = const {}]) {
  final own = kBlogFollowupCopy[_lang(language)]?[key];
  final text = own != null && own.isNotEmpty ? own : kBlogFollowupCopy['en']?[key] ?? key;
  return text.replaceAllMapped(RegExp(r'\{([a-zA-Z0-9_]+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);
}

/// `feature37Text(key, language)`: own language, else English.
String blogFeature37Text(String key, [String? language]) {
  final own = kBlogFeature37Copy[_lang(language)]?[key];
  return own != null && own.isNotEmpty ? own : kBlogFeature37Copy['en']?[key] ?? key;
}
