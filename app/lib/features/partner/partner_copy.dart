// Ported from: src/lib/feature37-i18n.ts (feature37Text) — partner subset (generated/partner_copy.g.dart)
import '../../core/i18n/app_languages.dart';
import '../../core/i18n/tr.dart';
import 'generated/partner_copy.g.dart';

/// `feature37Text(key, language)`: the app language's text, else English (React: `[lang]?.[key] || en[key]`).
String feature37Text(String key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kPartnerFeature37Copy[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return kPartnerFeature37Copy['en']?[key] ?? key;
}
