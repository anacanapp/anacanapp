// Ported from: src/components/games/MiniGamesHub.word-garden.test.tsx, src/components/games/MiniGamesHub.two-friends.test.tsx
import 'package:anacan/features/games/hub/ui/mini_games_hub.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../ui_support.dart';

Finder _cards() => find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('game-card-'));

GameRegistry _registry(String gameId, String backLabel) => GameRegistry()
  ..register(ScreenGameEntry(
    id: gameId,
    builder: (context, a) => GameButton(onTap: a.onBack, child: Text(backLabel)),
  ));

void main() {
  gameTest('opens the Azerbaijani game through its own lazy screen and returns to the existing hub', (tester) async {
    final env = GameTestEnv(registry: _registry(MiniGameIds.wordGarden, 'Bağa qayıt'));
    await pumpGame(tester, env, MiniGamesHub(onBack: () {}));
    expect(_cards(), findsNWidgets(8));
    await tapText(tester, 'Söz bağı');
    await tapText(tester, 'Bağa qayıt');
    expect(find.text('Söz bağı'), findsOneWidget);
    await tapText(tester, 'Söz bağı');
    expect(find.text('Bağa qayıt'), findsOneWidget);
  });

  for (final language in ['en', 'tr', 'ar']) {
    gameTest('preserves the other games and hides the unavailable word library in $language', (tester) async {
      final env = GameTestEnv(language: language);
      await pumpGame(tester, env, MiniGamesHub(onBack: () {}));
      expect(find.byKey(const ValueKey('game-card-word-garden')), findsNothing);
      expect(find.text('Söz bağı'), findsNothing);
      expect(_cards(), findsNWidgets(7));
    });
  }

  gameTest('opens the localized Two Friends lazy game and returns to the existing hub', (tester) async {
    final env = GameTestEnv(language: 'en', registry: _registry(MiniGameIds.twoFriends, 'Friends return'));
    await pumpGame(tester, env, MiniGamesHub(onBack: () {}));
    expect(_cards(), findsNWidgets(7));
    await tapText(tester, 'Two Friends');
    await tapText(tester, 'Friends return');
    expect(find.text('Two Friends'), findsOneWidget);
    expect(find.text('Söz bağı'), findsNothing);
  });

  gameTest('opens a registered level game through levels and game, recording the result locally', (tester) async {
    late GamePlayArgs play;
    final registry = GameRegistry()
      ..register(LevelGameEntry(
        id: MiniGameIds.birlesdir,
        levelCount: (_) => 40,
        levels: (context, a) => GameButton(onTap: () => a.onSelectLevel(1), child: Text('levels ${a.progress.unlockedLevel}')),
        game: (context, a) {
          play = a;
          return Text('game ${a.level}');
        },
      ));
    final env = GameTestEnv(registry: registry);
    await pumpGame(tester, env, MiniGamesHub(onBack: () {}));
    await tapKey(tester, 'game-card-birlesdir');
    await settle(tester);
    await tapText(tester, 'levels 1');
    expect(find.text('game 1'), findsOneWidget);
    play.onLevelComplete(const GameLevelResult(level: 1, score: 900, stars: 3, passed: true));
    play.onNextLevel();
    await settle(tester);
    expect(find.text('game 2'), findsOneWidget);
    expect(env.item('anacan_minigame_progress_birlesdir'), '{"unlockedLevel":2,"levels":{"1":{"stars":3,"bestScore":900}},"bestScoreOverall":900}');
    play.onExit();
    await settle(tester);
    expect(find.text('levels 2'), findsOneWidget);
  });

  gameTest('reads the progress the Capacitor app saved for a level game card', (tester) async {
    final env = GameTestEnv(storage: {
      'anacan_minigame_progress_saglam-sebet': '{"unlockedLevel":7,"levels":{"6":{"stars":2,"bestScore":1500}},"bestScoreOverall":1500}',
    });
    await pumpGame(tester, env, MiniGamesHub(onBack: () {}));
    expect(find.text('7/60 açıq'), findsOneWidget);
    expect(find.text('1500'), findsOneWidget);
  });
}
