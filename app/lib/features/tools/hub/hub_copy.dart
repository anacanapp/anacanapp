// Ported from: src/lib/feature37-i18n.ts (feature37Text), src/lib/followup-i18n.ts (followupText),
//              src/data/play-together/tile.ts (hasPlayContent, playTileText), src/data/kid-exercises/tile.ts
//              (hasKidExContent, kidExTileText), src/lib/weaning-copy.ts (wt: tile keys),
//              src/lib/parenting-copy.ts (pt: tile keys), src/lib/babycare-i18n.ts (bc)
//
// Only the copy the Tools hub tiles need. The tables are generated (hub_copy.g.dart); the full copy modules are
// ported with their tools.
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import 'hub_copy.g.dart';

String _lookup(Map<String, Map<String, String>> table, String key, String? language) {
  final own = table[normalizeAppLanguage(language ?? currentLanguage())]?[key];
  if (own != null && own.isNotEmpty) return own;
  return table['en']?[key] ?? key;
}

/// `feature37Text(key, language)` for `sfg_home_title` / `sfg_tool_desc`.
String hubFeature37Text(String key, [String? language]) => _lookup(kHubFeature37Copy, key, language);

/// `followupText(key, language, values)` for `names_country`: `{name}` tokens without a value stay.
String hubFollowupText(String key, [String? language, Map<String, Object?> values = const {}]) =>
    _lookup(kHubFollowupCopy, key, language).replaceAllMapped(
      RegExp(r'\{([a-zA-Z0-9_]+)\}'),
      (m) => values.containsKey(m.group(1)) && values[m.group(1)] != null ? '${values[m.group(1)]}' : m.group(0)!,
    );

/// `hasPlayContent(language)`.
bool hasPlayContent(String? language) => kPlayContentLanguages.contains(language ?? '');

/// `playTileText(language)`.
({String name, String description}) playTileText(String language) =>
    kPlayTileText[language] ?? kPlayTileText['en'] ?? kPlayTileText['az']!;

/// `hasKidExContent(language)`.
bool hasKidExContent(String? language) => kKidExContentLanguages.contains(language ?? '');

/// `kidExTileText(language)`.
({String name, String description}) kidExTileText(String language) =>
    kKidExTileText[language] ?? kKidExTileText['en'] ?? kKidExTileText['az']!;

/// `wt(key)` for the tile keys (`tr(key, WEANING_COPY[key])`).
String weaningTileText(String key) => switch (key) {
      'weaning_tool_name' => tr('weaning_tool_name', 'Süddən ayırma'),
      'weaning_tool_desc' => tr('weaning_tool_desc', 'Tədricən, uşağa zərərsiz ayırma planı, gündəlik check-in və bələdçi'),
      _ => key,
    };

/// `pt(key)` for the tile keys (`tr(key, PARENTING_COPY[key])`).
String parentingTileText(String key) => switch (key) {
      'par_tool_name' => tr('par_tool_name', 'Tərbiyə'),
      'par_tool_desc' => tr('par_tool_desc', 'Elmə əsaslanan, sevgi dolu tərbiyə: yaşa görə bələdçi, çətin anlar üçün SOS və proqramlar'),
      _ => key,
    };

/// `bc(key)`: babycare section copy.
String babycareText(String key) => copyText('babycare', key);
