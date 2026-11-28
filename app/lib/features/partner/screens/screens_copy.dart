// Ported from: src/lib/feature37-i18n.ts (feature37Text) — the keys of the partner screens
// (generated/partner_screens_copy.g.dart; the partner core keys stay in ../partner_copy.dart)
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import '../partner_copy.dart' as core;
import 'generated/partner_screens_copy.g.dart';

/// `feature37Text(key, language)` for the partner screens: the app language's text, else English; keys of the
/// partner core (pm_*, pn_*, …) come from the core table.
String feature37Text(String key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kPartnerScreensFeature37Copy[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  final en = kPartnerScreensFeature37Copy['en']?[key];
  if (en != null) return en;
  return core.feature37Text(key, language);
}
