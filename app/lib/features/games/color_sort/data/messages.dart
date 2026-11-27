// Ported from: src/components/games/color-sort/messages.ts, src/components/games/color-sort/useColorSortText.ts
library;

import '../../common/data/game_messages.dart';

/// `colorSortText`: the exact language pack or `az` (no normalisation), overlaid by an admin
/// translation (`colorsort_<key>`, then `color_sort.<key>`) from the app translation cache.
class ColorSortMessages {
  ColorSortMessages(this.catalog);
  final GameMessageCatalog catalog;
  static ColorSortMessages parse(String assetText) => ColorSortMessages(GameMessageCatalog.parse(assetText));

  String text(String language, String key,
      {Map<String, Object?> parameters = const {}, String? Function(String key, String language)? cachedTranslation}) {
    final seed = catalog.languages[language] ?? catalog.languages['az']!;
    String? nonEmpty(String? value) => value == null || value.isEmpty ? null : value;
    final value = nonEmpty(cachedTranslation?.call('colorsort_$key', language)) ??
        nonEmpty(cachedTranslation?.call('color_sort.$key', language)) ??
        seed[key];
    if (value == null) throw ArgumentError.value(key, 'key');
    return fillPlaceholders(value, parameters);
  }
}
