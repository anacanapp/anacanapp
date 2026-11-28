// Ported from: src/components/games/MiniGamesHub.tsx (the Birləşdir levels → game views)
library;

import '../ui_common/game_registry.dart';
import 'engine/level_config.dart';
import 'ui/birlesdir_game.dart';
import 'ui/birlesdir_levels.dart';

void registerBirlesdir(GameRegistry registry) {
  registry.register(LevelGameEntry(
    id: MiniGameIds.birlesdir,
    levelCount: (ref) => birlesdirTotalLevels,
    levels: (context, args) => BirlesdirLevels(args: args),
    game: (context, args) => BirlesdirGame(
      level: args.level,
      onExit: args.onExit,
      onLevelComplete: args.onLevelComplete,
      onNextLevel: args.onNextLevel,
    ),
  ));
}