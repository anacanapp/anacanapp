// Ported from: src/components/games/color-sort/ColorSortGame.test.tsx
import 'dart:io';

import 'package:anacan/features/games/color_sort/data/messages.dart';
import 'package:anacan/features/games/color_sort/engine/difficulty.dart';
import 'package:anacan/features/games/color_sort/engine/engine.dart';
import 'package:anacan/features/games/color_sort/engine/levels.dart';
import 'package:anacan/features/games/color_sort/engine/session.dart';
import 'package:anacan/features/games/color_sort/persistence/storage.dart';
import 'package:anacan/features/games/color_sort/ui/color_sort_game.dart';
import 'package:anacan/features/games/color_sort/ui/color_sort_levels.dart';
import 'package:anacan/features/games/color_sort/ui/color_sort_worker.dart';
import 'package:anacan/features/games/color_sort/ui/color_tube.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/hub/persistence/local_game_progress.dart';
import 'package:anacan/features/games/ui_common/game_data.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../batch_b_support.dart';

/// `vi.mock('./workerClient')`: the offline fallback level and the authored-solution hint.
class _FallbackWorker implements ColorSortWorker {
  _FallbackWorker(this.catalog);
  final ColorSortCatalog catalog;
  @override
  Future<ColorSortLevel> loadLevel(int level, {ColorSortAbort? signal}) async => catalog.fallbackLevel(level);
  @override
  Future<Move?> requestHint(ColorSortLevel definition, Board board, {ColorSortAbort? signal}) async => knownSolutionMove(definition, board);
}

late ColorSortCatalog catalog;
late ColorSortMessages messages;
late GameData data;

Finder _tube(int index) => find.byKey(ValueKey('colorsort-tube-$index'));
ColorTube _tubeWidget(WidgetTester tester, int index) => tester.widget<ColorTube>(find.byWidgetPredicate((w) => w is ColorTube && w.index == index));
ColorSortGameState _root(WidgetTester tester) => tester.state<ColorSortGameState>(find.byType(ColorSortGame));
Finder _button(String label) => find.byWidgetPredicate((w) => w is GameButton && w.label == label);

Future<void> _pumpGame(WidgetTester tester, MemoryGameStore store, Widget game, {String language = 'az', FakeGameAdsPlatform? ads}) async {
  await pumpGame(tester, game, overrides: [
    ...gameOverrides(store: store, data: data, language: language, ads: ads),
    colorSortWorkerProvider.overrideWithValue(_FallbackWorker(catalog)),
  ]);
  await tester.pump();
  await tester.pump();
}

Future<void> _ready(WidgetTester tester) async {
  expect(find.text('Başla'), findsOneWidget);
  await tester.tap(find.text('Başla'));
  await tester.pump();
}

Future<void> _makeMove(WidgetTester tester, int from, int to) async {
  await tester.tap(_tube(from));
  await tester.pump();
  await tester.tap(_tube(to));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 40));
  expect(_root(tester).phase == 'won' || !_tubeWidget(tester, 0).disabled, isTrue);
}

ColorSortGame _game({int level = 1, ValueChanged<GameLevelResult>? complete, VoidCallback? next, VoidCallback? exit}) =>
    ColorSortGame(level: level, levelCount: 30, onExit: exit ?? () {}, onLevelComplete: complete ?? (_) {}, onNextLevel: next ?? () {});

void main() {
  setUpAll(() async {
    catalog = ColorSortCatalog.parse(await File('assets/games/color_sort/catalog.json').readAsString());
    messages = ColorSortMessages.parse(await File('assets/games/color_sort/messages.json').readAsString());
    data = await loadTestGameData();
  });

  group('Color Sort player', () {
    for (final language in ['az', 'en', 'tr', 'ru', 'de', 'ar', 'kk', 'uz', 'ka']) {
      testWidgets('renders the first game screen offline in $language', (tester) async {
        await _pumpGame(tester, MemoryGameStore(), _game(), language: language);
        final copy = messages.catalog.languages[language]!;
        expect(find.text(copy['start']!), findsOneWidget);
        expect(find.text(copy['goal']!), findsOneWidget);
        expect(Directionality.of(tester.element(find.byKey(const ValueKey('colorsort-game')))), language == 'ar' ? TextDirection.rtl : TextDirection.ltr);
        await tester.pumpWidget(const SizedBox());
      });
    }

    testWidgets('plays a real level through the tube controls and reports a win only once', (tester) async {
      final results = <GameLevelResult>[];
      var next = 0;
      final store = MemoryGameStore();
      await _pumpGame(tester, store, _game(complete: results.add, next: () => next++));
      await _ready(tester);
      for (final move in catalog.bundled[0].solution) {
        await _makeMove(tester, move.from, move.to);
      }
      expect(find.text('Rənglər yerini tapdı!'), findsOneWidget);
      expect(results, hasLength(1));
      expect(results.single.level, 1);
      expect(results.single.passed, isTrue);
      expect(results.single.stars, 3);
      await _pumpGame(tester, store, _game(complete: results.add, next: () => next++));
      expect(results, hasLength(1));
      await tester.tap(find.text('Növbəti səviyyə'));
      await tester.pump();
      expect(next, 1);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('supports undo, one extra tube, pausing and resuming a saved local round', (tester) async {
      final store = MemoryGameStore();
      await _pumpGame(tester, store, _game());
      await _ready(tester);
      await _makeMove(tester, 0, 2);
      expect(_root(tester).moves, 1);
      await tester.tap(_button('Geri al'));
      await tester.pump();
      expect(_root(tester).moves, 0);
      await _makeMove(tester, 0, 2);
      await tester.tap(find.text('Əlavə qab'));
      await tester.pump();
      expect(find.byType(ColorTube), findsNWidgets(6));
      expect(tester.widget<GameButton>(_button('Əlavə qab 0')).enabled, isFalse);
      await tester.tap(_button('Fasilə'));
      await tester.pump();
      expect(_root(tester).phase, 'paused');
      expect(_tubeWidget(tester, 0).disabled, isTrue);
      await tester.pumpWidget(const SizedBox());
      await _pumpGame(tester, store, _game());
      expect(find.text('Saxlanmış oyuna davam et'), findsOneWidget);
      await tester.tap(find.text('Saxlanmış oyuna davam et'));
      await tester.pump();
      expect(_root(tester).phase, 'playing');
      expect(_root(tester).moves, 1);
      expect(find.byType(ColorTube), findsNWidgets(6));
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('grants extra moves only when the reward callback restores the current lost round', (tester) async {
      final definition = catalog.bundled[6];
      final store = MemoryGameStore();
      saveSession(store, createSession(definition).copyWith({'moves': definition.moveLimit}), definition);
      final results = <GameLevelResult>[];
      final ads = FakeGameAdsPlatform();
      await _pumpGame(tester, store, _game(level: 7, complete: results.add), ads: ads);
      await tester.tap(find.text('Saxlanmış oyuna davam et'));
      await tester.pump();
      expect(find.text('Gedişlər bitdi'), findsOneWidget);
      await tester.tap(find.textContaining('Videoya bax'));
      await tester.pump();
      await tester.pump();
      expect(_root(tester).phase, 'lost');
      ads.rewards.add(true);
      await tester.tap(find.textContaining('Videoya bax'));
      await tester.pump();
      await tester.pump();
      expect(_root(tester).phase, 'playing');
      expect(_root(tester).moves, definition.moveLimit);
      expect(results, isEmpty);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('adds another ten levels without unlocking them or resetting existing progress', (tester) async {
      final selected = <int>[];
      final store = MemoryGameStore();
      final progress = GameProgress({'unlockedLevel': 1, 'levels': <String, Object?>{}, 'bestScoreOverall': 99});
      await pumpGame(
        tester,
        SingleChildScrollView(
          child: ColorSortLevels(
            args: GameLevelsArgs(progress: progress, isLevelUnlocked: (level) => level == 1, onSelectLevel: selected.add, onBack: () {}),
          ),
        ),
        overrides: gameOverrides(store: store, data: data),
      );
      await tester.pump();
      GameButton level(int n) => tester.widget<GameButton>(find.byKey(ValueKey('game-level-$n')));
      expect(level(30).enabled, isFalse);
      expect(find.byKey(const ValueKey('game-level-31')), findsNothing);
      await tester.ensureVisible(find.byKey(const ValueKey('colorsort-add-levels')));
      await tester.tap(find.byKey(const ValueKey('colorsort-add-levels')));
      await tester.pump();
      expect(level(40).enabled, isFalse);
      expect(store.getItem(colorSortLevelCountKey), '40');
      expect(selected, isEmpty);
      await tester.ensureVisible(find.byKey(const ValueKey('game-level-1')));
      await tester.tap(find.byKey(const ValueKey('game-level-1')));
      await tester.pump();
      expect(selected, [1]);
    });
  });
}
