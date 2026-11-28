// Ported from: src/components/games/GameRewardIntegration.test.tsx
import 'package:anacan/features/games/birlesdir/engine/level_config.dart';
import 'package:anacan/features/games/birlesdir/ui/birlesdir_game.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/saglam_sebet/engine/engine.dart';
import 'package:anacan/features/games/saglam_sebet/ui/saglam_sebet_game.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'batch_b_support.dart';

BirlesdirLevelConfig _matchConfig(int level) {
  final original = getBirlesdirLevelConfig(level);
  return BirlesdirLevelConfig(original.level, 0, 99999, original.tileTypesCount, original.tierName, original.scoreMultiplier);
}

SebetLevelConfig _basketConfig(int level) {
  final o = getSebetLevelConfig(level);
  return SebetLevelConfig(
    level: o.level,
    spawnInterval: 999999,
    fallSpeed: o.fallSpeed,
    speedVariance: o.speedVariance,
    badChance: o.badChance,
    lives: o.lives,
    targetScore: 99999,
    duration: 1,
    tierName: o.tierName,
    tierIndex: o.tierIndex,
  );
}

void main() {
  group('reward callbacks restore actual game state', () {
    testWidgets('restores match-game moves without resetting the score; closing an ad grants nothing', (tester) async {
      final ads = FakeGameAdsPlatform();
      await pumpGame(
        tester,
        BirlesdirGame(level: 1, onExit: () {}, onLevelComplete: (_) {}, levelConfig: _matchConfig),
        overrides: gameOverrides(store: MemoryGameStore(), ads: ads),
      );
      await tapText(tester, 'Başla');
      final game = tester.state<BirlesdirGameState>(find.byType(BirlesdirGame));
      expect(game.phase, 'lost');
      expect(game.movesLeft, 0);
      ads.rewards.add(false);
      await tapText(tester, 'Videoya bax');
      await tester.pump();
      expect(game.movesLeft, 0);
      ads.rewards.add(true);
      await tapText(tester, 'Videoya bax');
      await tester.pump();
      expect(game.phase, 'playing');
      expect(game.movesLeft, 5);
      expect(game.score, 0);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('restores basket-game lives and usable time after losing', (tester) async {
      final ads = FakeGameAdsPlatform();
      await pumpGame(
        tester,
        SaglamSebetGame(level: 1, onExit: () {}, onLevelComplete: (_) {}, levelConfig: _basketConfig),
        overrides: gameOverrides(store: MemoryGameStore(), ads: ads),
      );
      await tapText(tester, 'Başla');
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 800));
      }
      await tester.pump(const Duration(milliseconds: 1100));
      final game = tester.state<SaglamSebetGameState>(find.byType(SaglamSebetGame));
      expect(game.phase, 'lost');
      ads.rewards.add(true);
      await tapText(tester, 'Videoya bax');
      await tester.pump();
      expect(game.phase, 'playing');
      expect(game.lives, greaterThan(0));
      expect(game.score, 0);
      await tester.pumpWidget(const SizedBox());
    });
  });
}
