// Ported from: src/components/games/MiniGamesHub.tsx (Color Sort levels → game views, `handleNextColorSortLevel`,
//              the library's level count on the card)
library;

import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../ui_common/game_registry.dart';
import 'engine/difficulty.dart';
import 'ui/color_sort_game.dart';
import 'ui/color_sort_levels.dart';
import 'ui/color_sort_text.dart';

void registerColorSort(GameRegistry registry) {
  registry.register(LevelGameEntry(
    id: MiniGameIds.colorSort,
    levelCount: (ref) => ref.watch(colorSortLibraryProvider),
    // `if (selectedLevel >= levelCount) addLevels(); setSelectedLevel(min(selectedLevel + 1, MAX_LEVEL_COUNT))`.
    nextLevel: (ref, current) {
      if (current >= ref.read(colorSortLibraryProvider)) ref.read(colorSortLibraryProvider.notifier).addLevels();
      return math.min(current + 1, maxLevelCount);
    },
    levels: (context, args) => ColorSortLevels(args: args),
    game: (context, args) => Consumer(
      builder: (context, ref, _) => ColorSortGame(
        level: args.level,
        levelCount: ref.watch(colorSortLibraryProvider),
        onExit: args.onExit,
        onLevelComplete: args.onLevelComplete,
        onNextLevel: args.onNextLevel,
      ),
    ),
  ));
}
