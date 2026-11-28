// Ported from: src/components/games/MiniGamesHub.tsx (the lazy BubblePop view)
library;

import '../ui_common/game_registry.dart';
import 'ui/bubble_pop.dart';

void registerQabarciq(GameRegistry registry) {
  registry.register(ScreenGameEntry(id: MiniGameIds.qabarciq, builder: (context, args) => BubblePop(onBack: args.onBack)));
}