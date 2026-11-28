// Ported from: src/components/games/color-sort/useColorSortText.ts, src/components/games/color-sort/useColorSortLibrary.ts
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/language_controller.dart' show i18nRuntimeProvider;
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../data/messages.dart';
import '../engine/difficulty.dart';
import '../persistence/storage.dart';

/// Numbers in `{name}` parameters are formatted with [gameNumber] first, like the React text hooks do.
Map<String, Object?> formatGameValues(String language, Map<String, Object?> values) =>
    {for (final entry in values.entries) entry.key: entry.value is num ? gameNumber(language, entry.value as num) : entry.value};

TextDirection gameDirection(String language) => language == 'ar' ? TextDirection.rtl : TextDirection.ltr;

/// `useColorSortText()`: `{t, number, language, dir}`. The exact app language (no normalisation, `az` when
/// missing); admin translations (`colorsort_<key>`, then `color_sort.<key>`) win over the bundled copy.
class ColorSortText {
  ColorSortText(this.messages, this.language, {this.cachedTranslation});
  final ColorSortMessages messages;
  final String language;
  final String? Function(String key, String language)? cachedTranslation;

  String number(num value) => gameNumber(language, value);
  String t(String key, [Map<String, Object?> parameters = const {}]) =>
      messages.text(language, key, parameters: formatGameValues(language, parameters), cachedTranslation: cachedTranslation);
  TextDirection get dir => gameDirection(language);
}

/// Null while the bundled copy loads.
final colorSortTextProvider = Provider<ColorSortText?>((ref) {
  final data = ref.watch(gameDataProvider).value;
  if (data == null) return null;
  final runtime = ref.watch(i18nRuntimeProvider);
  return ColorSortText(data.colorSort, ref.watch(gameLanguageProvider), cachedTranslation: runtime.store.lookup);
});

/// `useColorSortLibrary()`: the level library size (`anacan_colorsort_level_count_v1`), +10 per pack, max 300.
class ColorSortLibrary extends Notifier<int> {
  @override
  int build() {
    final store = ref.read(gameStoreProvider);
    final count = readLevelCount(store);
    writeLevelCount(store, count); // the hook's effect writes the normalised count on mount
    return count;
  }

  void addLevels() {
    state = math.min(maxLevelCount, state + levelPackSize);
    writeLevelCount(ref.read(gameStoreProvider), state);
  }

  bool get canAddLevels => state < maxLevelCount;
}

final colorSortLibraryProvider = NotifierProvider<ColorSortLibrary, int>(ColorSortLibrary.new);
