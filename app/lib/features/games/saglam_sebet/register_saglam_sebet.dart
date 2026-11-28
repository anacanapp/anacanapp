// Ported from: src/components/games/MiniGamesHub.tsx (the Sağlam Səbət levels → game views)
library;

import '../ui_common/game_registry.dart';
import 'engine/engine.dart';
import 'ui/saglam_sebet_game.dart';
import 'ui/saglam_sebet_levels.dart';

void registerSaglamSebet(GameRegistry registry) {
  registry.register(LevelGameEntry(
    id: MiniGameIds.saglamSebet,
    levelCount: (ref) => saglamTotalLevels,
    levels: (context, args) => SaglamSebetLevels(args: args),
    game: (context, args) => SaglamSebetGame(
      level: args.level,
      onExit: args.onExit,
      onLevelComplete: args.onLevelComplete,
      onNextLevel: args.onNextLevel,
    ),
  ));
}