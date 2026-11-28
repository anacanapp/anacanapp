// Ported from: (no React UI suite for SaglamSebetGame.tsx — widget checks of the port: countdown, Ticker loop,
//              catches, lives, pause, time-up evaluation, one-shot onLevelComplete, levels screen)
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/hub/persistence/local_game_progress.dart';
import 'package:anacan/features/games/saglam_sebet/engine/engine.dart';
import 'package:anacan/features/games/saglam_sebet/ui/saglam_sebet_game.dart';
import 'package:anacan/features/games/saglam_sebet/ui/saglam_sebet_levels.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../batch_b_support.dart';

SebetLevelConfig Function(int) _config({double badChance = 0, int target = 10, int duration = 2, int lives = 3}) => (level) {
      final o = getSebetLevelConfig(level);
      return SebetLevelConfig(
        level: o.level,
        spawnInterval: 150,
        fallSpeed: 600,
        speedVariance: 0,
        badChance: badChance,
        lives: lives,
        targetScore: target,
        duration: duration,
        tierName: o.tierName,
        tierIndex: o.tierIndex,
      );
    };

/// `Math.random()` always 0.5: items spawn in the middle of the play area, above the starting basket.
double _middle() => 0.5;

Future<SaglamSebetGameState> _start(WidgetTester tester, SaglamSebetGame game, {HapticLog? haptics}) async {
  await pumpGame(tester, game, overrides: gameOverrides(store: MemoryGameStore(), haptics: haptics));
  await tapText(tester, 'Başla');
  final state = tester.state<SaglamSebetGameState>(find.byType(SaglamSebetGame));
  expect(state.phase, 'countdown');
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 700));
  }
  await tester.pump(const Duration(milliseconds: 500));
  await tester.pump();
  expect(state.phase, 'playing');
  return state;
}

void main() {
  group('Sağlam Səbət player', () {
    testWidgets('catches healthy food over the basket and reports one win at time-up', (tester) async {
      final results = <GameLevelResult>[];
      final haptics = HapticLog();
      final state = await _start(
          tester, SaglamSebetGame(level: 1, onExit: () {}, onLevelComplete: results.add, levelConfig: _config(), random: _middle),
          haptics: haptics);
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(state.score, greaterThan(0));
      expect(haptics.calls, contains('light'));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(state.phase, 'won');
      expect(results, hasLength(1));
      expect(results.single.passed, isTrue);
      expect(results.single.stars, getSebetStarsForScore(state.score, 10));
      expect(find.text('Səviyyə tamamlandı!'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      expect(results, hasLength(1));
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('loses lives on bad catches and ends the round when they run out', (tester) async {
      final results = <GameLevelResult>[];
      final haptics = HapticLog();
      final state = await _start(
          tester,
          SaglamSebetGame(level: 1, onExit: () {}, onLevelComplete: results.add, levelConfig: _config(badChance: 1, duration: 30, lives: 2), random: _middle),
          haptics: haptics);
      for (var i = 0; i < 60 && state.phase == 'playing'; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(state.phase, 'lost');
      expect(state.lives, 0);
      expect(haptics.calls, contains('heavy'));
      expect(find.text('Canlar bitdi!'), findsOneWidget);
      expect(results, hasLength(1));
      expect(results.single.passed, isFalse);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('pauses from the HUD, resumes and moves the basket with a drag', (tester) async {
      var exits = 0;
      final state = await _start(tester, SaglamSebetGame(level: 1, onExit: () => exits++, onLevelComplete: (_) {}, levelConfig: _config(duration: 30)));
      await tester.tap(find.byKey(const ValueKey('arcade-hud-button')));
      await tester.pump();
      expect(state.phase, 'paused');
      final time = state.timeLeft;
      await tester.pump(const Duration(seconds: 3));
      expect(state.timeLeft, time);
      await tester.tap(find.text('Davam et'));
      await tester.pump();
      expect(state.phase, 'playing');
      final area = tester.getRect(find.byType(SaglamSebetGame));
      await tester.dragFrom(Offset(area.center.dx, area.bottom - 60), const Offset(-1000, 0));
      await tester.pump();
      expect(state.basketX, basketWidth / 2);
      await tester.tap(find.byKey(const ValueKey('arcade-hud-button')));
      await tester.pump();
      await tester.tap(find.text('Menyu'));
      await tester.pump();
      expect(exits, 1);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('lists the six tiers and opens unlocked levels only', (tester) async {
      final selected = <int>[];
      await pumpGame(
        tester,
        SingleChildScrollView(
          child: SaglamSebetLevels(
            args: GameLevelsArgs(
              progress: GameProgress({'unlockedLevel': 3, 'levels': <String, Object?>{}, 'bestScoreOverall': 0}),
              isLevelUnlocked: (level) => level <= 3,
              onSelectLevel: selected.add,
              onBack: () {},
            ),
          ),
        ),
        overrides: gameOverrides(store: MemoryGameStore()),
      );
      expect(find.text('Sağlam Səbət'), findsOneWidget);
      expect(find.byKey(const ValueKey('game-level-60')), findsOneWidget);
      expect(tester.widget<GameButton>(find.byKey(const ValueKey('game-level-4'))).enabled, isFalse);
      await tester.tap(find.byKey(const ValueKey('game-level-3')));
      await tester.pump();
      expect(selected, [3]);
    });
  });
}
