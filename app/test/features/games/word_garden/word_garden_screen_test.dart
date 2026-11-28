// Ported from: src/components/games/word-garden/WordGarden.test.tsx
import 'dart:convert';
import 'dart:io';

import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/domain/ads/ads_policy.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/ui_common/game_ads.dart';
import 'package:anacan/features/games/word_garden/data/messages.dart';
import 'package:anacan/features/games/word_garden/engine/generator.dart';
import 'package:anacan/features/games/word_garden/engine/library.dart';
import 'package:anacan/features/games/word_garden/engine/model.dart';
import 'package:anacan/features/games/word_garden/engine/state.dart';
import 'package:anacan/features/games/word_garden/engine/wheel.dart';
import 'package:anacan/features/games/word_garden/persistence/storage.dart';
import 'package:anacan/features/games/word_garden/ui/crossword_board.dart';
import 'package:anacan/features/games/word_garden/ui/garden_game.dart';
import 'package:anacan/features/games/word_garden/ui/garden_theme.dart';
import 'package:anacan/features/games/word_garden/ui/letter_wheel.dart';
import 'package:anacan/features/games/word_garden/ui/word_garden_screen.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../ui_support.dart';

/// `vi.mock('@/hooks/useGameAds')`: counts transitions out of a finished round and grants the reward only when
/// the fixture says it was earned.
class _Ads implements GameAdsPlatform {
  bool earned = false;
  int transitions = 0;
  @override
  AdsConfiguration? get configuration => defaultAdsConfiguration();
  @override
  bool get premium => false;
  @override
  bool get busy => false;
  @override
  VoidCallback registerSurface(String placement) => () {};
  @override
  bool opportunity(String placement, String key) {
    transitions++;
    return false;
  }

  @override
  Future<bool> showInterstitial(String placement) async => false;
  @override
  Future<bool> showRewarded(String placement) async => earned;
  @override
  AdDecision decisionFor(String placement) => const AdDecision(allowed: true, reason: 'ready', waitSeconds: 0, mode: 'demo', adUnitId: null);
}

final String current = wordGardenLibraries['az']!.revision;

void main() {
  late GameTestEnv env;
  late _Ads ads;
  setUpAll(() => gardenLexicon());
  setUp(() {
    ads = _Ads();
    env = GameTestEnv(ads: ads);
  });

  Map<String, dynamic> stored([WordGardenMode mode = WordGardenMode.calm, String? revision]) =>
      jsonDecode(env.item(gardenStorageKey('az', revision ?? current, mode))!) as Map<String, dynamic>;
  int storedSeed([WordGardenMode mode = WordGardenMode.calm]) => (stored(mode)['seed'] as num).toInt();
  String phase(WidgetTester tester) => tester.state<GardenGameState>(find.byType(GardenGame)).phase;

  Future<void> render(WidgetTester tester) => pumpGame(tester, env, WordGarden(onBack: () {}));

  Future<void> start(WidgetTester tester) async {
    await tapKey(tester, 'wg-play');
    await settle(tester);
    expect(find.byKey(const ValueKey('wordgarden-wheel')), findsOneWidget);
    if (find.byKey(const ValueKey('wg-start-timed')).evaluate().isNotEmpty) await tapKey(tester, 'wg-start-timed');
    await settle(tester);
    expect(phase(tester), 'playing');
  }

  Future<void> word(WidgetTester tester, String value) async {
    final letters = tester.state<LetterWheelState>(find.byType(LetterWheel)).widget.letters;
    final used = <int>{};
    for (final letter in value.split('')) {
      final index = [for (var i = 0; i < letters.length; i++) i].firstWhere((i) => letters[i] == letter && !used.contains(i));
      used.add(index);
      await tester.tap(find.byKey(ValueKey('wg-letter-$index')));
      await tester.pump();
    }
    await tapKey(tester, 'wg-submit');
    await settle(tester);
  }

  Future<void> remount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    await render(tester);
  }

  void setLifecycle(WidgetTester tester, List<AppLifecycleState> states) {
    for (final state in states) {
      tester.binding.handleAppLifecycleStateChanged(state);
    }
  }

  group('Word Garden player', () {
    gameTest('plays the real first crossword, commits one win and unlocks the next level', (tester) async {
      await render(tester);
      await start(tester);
      final definition = generateGardenLevel(gardenLexicon(), 1, WordGardenMode.calm, storedSeed());
      for (final entry in definition.words) {
        await word(tester, entry.word);
      }
      expect(find.text('Bağın çiçəkləndi!'), findsOneWidget);
      final saved = stored(WordGardenMode.calm, definition.revision);
      expect(saved['progress']['unlockedLevel'], 2);
      expect(saved['progress']['coins'], 125);
      expect(saved['progress']['totalWords'], definition.words.length);
      await tapKey(tester, 'wg-next-level');
      await settle(tester);
      expect(find.text('Səviyyə 2'), findsOneWidget);
      expect(ads.transitions, 1);
    });

    gameTest('keeps a half-played board on exit/reopen and spends the free and paid hints correctly', (tester) async {
      await render(tester);
      await start(tester);
      final definition = generateGardenLevel(gardenLexicon(), 1, WordGardenMode.calm, storedSeed());
      await word(tester, definition.words[0].word);
      Future<void> hintHiddenCell() async {
        await tapKey(tester, 'wg-hint');
        final round = GardenRound(Map<String, Object?>.from(stored()['round'] as Map));
        final visible = visibleGardenCells(definition, round);
        final hidden = definition.cells.map((c) => cellKey(c.row, c.column)).firstWhere((key) => !visible.contains(key));
        await tapKey(tester, 'wg-cell-$hidden');
        await settle(tester);
      }

      await hintHiddenCell();
      await hintHiddenCell();
      expect(stored()['progress']['coins'], 50);
      await remount(tester);
      await tapText(tester, 'Oyuna davam et');
      await settle(tester);
      expect(find.byKey(const ValueKey('wordgarden-wheel')), findsOneWidget);
      expect(stored()['round']['found'], contains(definition.words[0].word));
      expect(stored()['round']['hintsUsed'], 2);
    });

    gameTest('persists visual/sound settings and does not unlock future chapter levels', (tester) async {
      await render(tester);
      expect(tester.widget<GameButton>(find.byKey(const ValueKey('wg-level-2'))).enabled, isFalse);
      await tapKey(tester, 'wg-settings');
      await tapKey(tester, 'wg-switch-sound');
      await tapKey(tester, 'wg-switch-highContrast');
      await tapKey(tester, 'wg-theme-night');
      final journey = tester.state<GardenJourneyState>(find.byType(GardenJourney));
      expect(journey.profile.language, 'az');
      final prefs = jsonDecode(env.item('anacan_word_garden_preferences_v1')!) as Map<String, dynamic>;
      expect(prefs['sound'], true);
      expect(prefs['highContrast'], true);
      expect(prefs['theme'], 'night');
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pump();
      expect(find.byKey(const ValueKey('wg-dialog')), findsNothing);
      await tapKey(tester, 'wg-next-page');
      expect(tester.widget<GameButton>(find.byKey(const ValueKey('wg-level-21'))).enabled, isFalse);
      expect(env.item(gardenStorageKey('az', current, WordGardenMode.calm)), isNull);
    });

    gameTest('grants time only on an earned reward and blocks taps when the round is lost', (tester) async {
      final definition = generateGardenLevel(gardenLexicon(), 1, WordGardenMode.timed, 7);
      final profile = {
        ...createGardenProfile('az', definition.revision, WordGardenMode.timed).json,
        'seed': 7,
        'round': {...createGardenRound(definition).json, 'started': true, 'remainingSeconds': 0},
      };
      env.store.setItem(gardenStorageKey('az', definition.revision, WordGardenMode.timed), jsonStringify(profile));
      await render(tester);
      await tapKey(tester, 'wg-mode-timed');
      await tapText(tester, 'Oyuna davam et');
      await settle(tester);
      expect(find.text('Bu dəfə vaxt bitdi'), findsOneWidget);
      expect(tester.widget<LetterWheel>(find.byType(LetterWheel)).disabled, isTrue);
      final revive = find.descendant(of: find.byKey(const ValueKey('game-revive-offer')), matching: find.byType(GameButton)).first;
      await tapFinder(tester, revive);
      await settle(tester);
      expect(phase(tester), 'lost');
      ads.earned = true;
      await tapFinder(tester, revive);
      await settle(tester);
      expect(phase(tester), 'playing');
      expect(stored(WordGardenMode.timed, definition.revision)['round']['remainingSeconds'], 15);
    });

    gameTest('does not load or show Azerbaijani puzzles for another app language', (tester) async {
      env.language = 'en';
      await render(tester);
      expect(find.byKey(const ValueKey('wordgarden-screen')), findsNothing);
      expect(find.byKey(const ValueKey('wordgarden-wheel')), findsNothing);
    });

    gameTest('debits elapsed time only while playing, pauses for settings and latches a background pause', (tester) async {
      await render(tester);
      await tapKey(tester, 'wg-mode-timed');
      await start(tester);
      num remaining() => stored(WordGardenMode.timed)['round']['remainingSeconds'] as num;
      await tapKey(tester, 'wg-game-settings');
      await tapKey(tester, 'wg-dialog-close');
      await settle(tester);
      final first = remaining();
      await advance(tester, env, const Duration(milliseconds: 2000));
      expect(remaining(), first - 2);
      await tapKey(tester, 'wg-game-settings');
      await settle(tester);
      final paused = remaining();
      await advance(tester, env, const Duration(seconds: 60), step: const Duration(seconds: 1));
      expect(remaining(), paused);
      await tapKey(tester, 'wg-dialog-close');
      await settle(tester);
      setLifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.hidden]);
      await tester.pump();
      expect(phase(tester), 'paused');
      await advance(tester, env, const Duration(seconds: 10), step: const Duration(seconds: 1));
      expect(remaining(), paused);
      setLifecycle(tester, [AppLifecycleState.inactive, AppLifecycleState.resumed]);
    });

    gameTest('recovers from a malformed saved round without resetting valid aggregate progress', (tester) async {
      final definition = generateGardenLevel(gardenLexicon(), 1, WordGardenMode.calm, 11);
      final profile = {...createGardenProfile('az', definition.revision, WordGardenMode.calm).json, 'seed': 11, 'round': {'found': []}};
      env.store.setItem(gardenStorageKey('az', definition.revision, WordGardenMode.calm), jsonStringify(profile));
      await render(tester);
      await start(tester);
      expect((tester.widget<Text>(find.byKey(const ValueKey('wg-coins')))).data, '75');
      final cells = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('wg-cell-'));
      expect(cells, findsNWidgets(definition.cells.length));
    });

    gameTest('waits for the player to start the short timer and makes expiry block input', (tester) async {
      await render(tester);
      await tapKey(tester, 'wg-mode-timed');
      await tapKey(tester, 'wg-play');
      await settle(tester);
      expect(find.byKey(const ValueKey('wordgarden-wheel')), findsOneWidget);
      num remaining() => stored(WordGardenMode.timed)['round']['remainingSeconds'] as num;
      expect(remaining(), greaterThanOrEqualTo(25));
      expect(remaining(), lessThanOrEqualTo(35));
      final initial = remaining();
      await advance(tester, env, const Duration(seconds: 30), step: const Duration(seconds: 1));
      expect(remaining(), initial);
      await tapKey(tester, 'wg-start-timed');
      await settle(tester);
      await advance(tester, env, Duration(milliseconds: (initial * 1000).round()));
      await settle(tester);
      expect(phase(tester), 'lost');
      expect(tester.widget<LetterWheel>(find.byType(LetterWheel)).disabled, isTrue);
    });

    for (final revision in ['az-202610-v1', 'az-202610-v2']) {
      gameTest('finishes an old $revision saved puzzle against its original library and then deals a new-revision level', (tester) async {
        final legacy = generateGardenLevel(gardenLexicon(revision), 1);
        final base = createGardenProfile('az', legacy.revision, WordGardenMode.calm);
        final profile = {
          ...base.json,
          'progress': {...base.progress.json, 'coins': 140},
          'round': createGardenRound(legacy).json,
        };
        final raw = jsonStringify(profile);
        env.store.setItem(gardenStorageKey('az', legacy.revision, WordGardenMode.calm), raw);
        await render(tester);
        await tapText(tester, 'Oyuna davam et');
        await settle(tester);
        expect(find.byKey(const ValueKey('wordgarden-wheel')), findsOneWidget);
        expect(stored()['round']['levelId'], legacy.id);
        for (final entry in legacy.words) {
          await word(tester, entry.word);
        }
        expect(find.text('Bağın çiçəkləndi!'), findsOneWidget);
        await tapKey(tester, 'wg-next-level');
        await settle(tester);
        expect(find.text('Səviyyə 2'), findsOneWidget);
        expect(stored()['round']['levelId'], contains('az:$current:calm:2:'));
        final next = generateGardenLevel(gardenLexicon(), 2, WordGardenMode.calm, storedSeed());
        expect(stored()['round']['levelId'], next.id);
        expect(stored()['progress']['coins'], 190);
        expect(env.item(gardenStorageKey('az', legacy.revision, WordGardenMode.calm)), raw);
      });
    }

    gameTest('highlights a selected answer without revealing letters or spending a hint', (tester) async {
      await render(tester);
      await start(tester);
      final before = stored()['round']['revealed'] as List;
      await tapKey(tester, 'wg-word-1');
      expect(tester.state<CrosswordBoardState>(find.byType(CrosswordBoard)).focusedWord, isNotNull);
      expect(stored()['round']['revealed'], before);
      expect(tester.widget<Text>(find.byKey(const ValueKey('wg-coins'))).data, '75');
    });
  });

  group('Word Garden letter input', () {
    gameTest('supports duplicate letters, backtracking, keyboard entry and avoids duplicate submits', (tester) async {
      expect(selectWheelLetter([0, 1, 2], 1), [0, 1]);
      expect(selectWheelLetter([0, 1, 2], 0), [0, 1, 2]);
      final submitted = <String>[];
      final t = GardenText(GardenMessages.parse(File('assets/games/word_garden/messages.json').readAsStringSync()), 'az');
      await pumpGame(
        tester,
        env,
        LetterWheel(
          palette: GardenPalette.of(theme: 'garden', highContrast: false, dark: false),
          letters: const ['a', 'l', 'm', 'a'],
          locale: 'az-AZ',
          t: t,
          resetKey: 'first',
          disabled: false,
          onPick: () {},
          onSubmit: submitted.add,
          onShuffle: () {},
        ),
      );
      for (final key in [LogicalKeyboardKey.keyA, LogicalKeyboardKey.keyL, LogicalKeyboardKey.keyM, LogicalKeyboardKey.keyA]) {
        await tester.sendKeyEvent(key);
      }
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(submitted, ['alma']);
    });
  });
}
