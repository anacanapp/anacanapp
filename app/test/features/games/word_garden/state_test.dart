// Ported from: src/components/games/word-garden/state.test.ts (+ play/storage fixtures from
// app/tool/games/entries/word-garden.ts)
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/word_garden/data/messages.dart';
import 'package:anacan/features/games/word_garden/engine/generator.dart';
import 'package:anacan/features/games/word_garden/engine/lexicon.dart';
import 'package:anacan/features/games/word_garden/engine/library.dart';
import 'package:anacan/features/games/word_garden/engine/model.dart';
import 'package:anacan/features/games/word_garden/engine/state.dart';
import 'package:anacan/features/games/word_garden/persistence/storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

final lexicon = compileLexicon(parseWordLexicon(loadAssetText('assets/games/word_garden/az.json')), 'az');
final current = wordGardenLibraries['az']!.revision;
final level = [for (var seed = 0; seed < 64; seed++) generateGardenLevel(lexicon, 25, WordGardenMode.calm, seed)]
    .firstWhere((item) => item.bonusWords.isNotEmpty);

GardenProfile start() {
  final base = createGardenProfile('az', lexicon.data.revision, WordGardenMode.calm);
  return GardenProfile({
    ...base.json,
    'round': createGardenRound(level).json,
    'progress': {...base.progress.json, 'unlockedLevel': 25, 'bonusClaims': {'level': 25, 'words': <Object?>[]}},
  });
}

void main() {
  final store = MemoryGameStore();
  setUp(store.clear);

  group('cross-language fixtures (TypeScript → Dart)', () {
    test('scripted play-throughs produce the same profiles, decisions and rewards', () {
      for (final raw in asList(loadFixture('word_garden_play'))) {
        final scenario = asMap(raw);
        final level = WordGardenLevel.fromJson(asMap(scenario['level']));
        final base = createGardenProfile('az', level.revision, level.mode);
        var profile = GardenProfile({
          ...base.json,
          'round': createGardenRound(level).json,
          'progress': {...base.progress.json, 'unlockedLevel': level.level, 'bonusClaims': {'level': level.level, 'words': <Object?>[]}},
        });
        for (final rawStep in asList(scenario['steps'])) {
          final step = asMap(rawStep);
          final name = '${scenario['name']} ${step['op']}';
          switch (step['op']) {
            case 'submit':
              final result = submitGardenWord(profile, level, step['word'] as String);
              profile = result.profile;
              expect(result.decision.name, step['decision'], reason: name);
              expect(result.reward, step['reward'], reason: name);
              expect(jsonStringify(profile.json), jsonStringify(step['profile']), reason: name);
            case 'hint':
              final result = revealGardenHint(profile, level, step['key'] as String);
              profile = result.profile;
              expect(result.used, step['used'], reason: name);
              expect(jsonStringify(profile.json), jsonStringify(step['profile']), reason: name);
            case 'visible':
              expect(visibleGardenCells(level, profile.round!).toList(), step['cells'], reason: name);
            case 'complete-early':
              expect(completeGardenLevel(profile, level), isNull);
              expect(step['result'], isNull);
            case 'complete':
              final done = completeGardenLevel(profile, level)!;
              expect(jsonEquals(done.result.toJson(), step['result']), isTrue, reason: name);
              expect(done.reward, step['reward'], reason: name);
              expect(jsonStringify(done.profile.json), jsonStringify(step['profile']), reason: name);
              profile = done.profile;
            case 'complete-again':
              expect(completeGardenLevel(profile, level)!.reward, step['reward'], reason: name);
          }
        }
        final timed = profile.round!.copyWith({'remainingSeconds': level.mode == WordGardenMode.timed ? 45.7 : null});
        expect(jsonEquals(gardenResult(level, timed).toJson(), scenario['resultTimed']), isTrue);
        expect(validGardenRound(profile.round!.json, level), scenario['validRound']);
        expect(validGardenRound({...profile.round!.json, 'found': ['made-up']}, level), scenario['validBad']);
        expect(validGardenRound(createGardenRound(level).json, level), scenario['validFresh']);
      }
    });

    test('saved profiles from the React app parse, adopt and re-serialise byte-for-byte', () {
      final fixture = asMap(loadFixture('word_garden_storage'));
      for (final raw in asList(fixture['cases'])) {
        final item = asMap(raw), read = asMap(item['read']);
        store.clear();
        if (item['raw'] != null) store.setItem(item['key'] as String, item['raw'] as String);
        final profile = readGardenProfile(store, read['language'] as String, read['revision'] as String,
            WordGardenMode.parse(read['mode'])!, newSeed: () => 123456789);
        expect(jsonStringify(profile.json), jsonStringify(item['profile']), reason: item['name'] as String);
        expect(writeGardenProfile(store, profile), isTrue);
        expect(store.getItem(gardenStorageKey(profile.language, profile.revision, profile.mode)), item['rewritten'], reason: item['name'] as String);
      }
      for (final raw in asList(fixture['preferences'])) {
        final item = asMap(raw);
        store.clear();
        if (item['raw'] != null) store.setItem(gardenPreferencesKey, item['raw'] as String);
        expect(readGardenPreferences(store).toJson(), item['value'], reason: '${item['raw']}');
      }
    });

    test('offline copy and placeholder replacement', () {
      final messages = GardenMessages.parse(loadAssetText('assets/games/word_garden/messages.json'));
      for (final raw in asList(asMap(loadFixture('word_garden_primitives'))['text'])) {
        final item = asMap(raw);
        expect(messages.text('az', item['key'] as String, asMap(item['values'])), item['text']);
      }
      expect(() => messages.text('en', 'title'), throwsA(predicate((e) => '$e' == 'WORD_GARDEN_MESSAGES_NOT_AVAILABLE')));
    });
  });

  group('Word Garden local progression', () {
    test('reveals crossing cells, accepts a dictionary bonus and awards it only once across restarts', () {
      var profile = start();
      final word = level.words[0];
      profile = submitGardenWord(profile, level, word.word).profile;
      expect(visibleGardenCells(level, profile.round!), contains(cellKey(word.row, word.column)));
      expect(submitGardenWord(profile, level, word.word).decision, WordDecision.already);
      expect(submitGardenWord(profile, level, 'not-a-word').decision, WordDecision.invalid);
      expect(level.bonusWords.length, greaterThan(0));
      final bonus = level.bonusWords[0], first = submitGardenWord(profile, level, bonus);
      expect(first.decision, WordDecision.bonus);
      expect(first.reward, 5);
      profile = first.profile.copyWith(round: createGardenRound(level));
      expect(submitGardenWord(profile, level, bonus).reward, 0);
    });

    test('charges a paid hint only after the free first hint and never charges an already visible cell', () {
      var profile = start();
      final firstKey = cellKey(level.cells[0].row, level.cells[0].column);
      var hint = revealGardenHint(profile, level, firstKey);
      expect(hint.used, isTrue);
      expect(hint.profile.progress.coins, 75);
      profile = hint.profile;
      final again = revealGardenHint(profile, level, firstKey);
      expect(identical(again.profile, profile) || again.profile.json == profile.json, isTrue);
      expect(again.used, isFalse);
      hint = revealGardenHint(profile, level, cellKey(level.cells[1].row, level.cells[1].column));
      expect(hint.used, isTrue);
      expect(hint.profile.progress.coins, 50);
      expect(hint.profile.round!.hintsUsed, 2);
    });

    test('commits a completion once, unlocks the next level and prevents replay reward farming', () {
      var profile = start();
      expect(completeGardenLevel(profile, level), isNull);
      for (final word in level.words) {
        profile = submitGardenWord(profile, level, word.word).profile;
      }
      final completed = completeGardenLevel(profile, level)!;
      expect(completed.result.stars, 3);
      expect(completed.profile.progress.unlockedLevel, 26);
      expect(completed.reward, 50);
      expect(completeGardenLevel(completed.profile, level)!.reward, 0);
      profile = completed.profile.copyWith(round: createGardenRound(level));
      for (final word in level.words) {
        profile = submitGardenWord(profile, level, word.word).profile;
      }
      expect(completeGardenLevel(profile, level)!.reward, 0);
      expect(completeGardenLevel(profile, level)!.profile.progress.totalWords, level.words.length);
    });

    test('validates a restored round and keeps mode/language/revision storage separate', () {
      final profile = start();
      expect(validGardenRound(profile.round!.json, level), isTrue);
      expect(validGardenRound({...profile.round!.json, 'found': ['made-up']}, level), isFalse);
      expect(validGardenRound({...profile.round!.json, 'awarded': true}, level), isFalse);
      expect(writeGardenProfile(store, profile), isTrue);
      expect(readGardenProfile(store, 'az', lexicon.data.revision, WordGardenMode.calm).progress.unlockedLevel, 25);
      expect(readGardenProfile(store, 'az', lexicon.data.revision, WordGardenMode.timed).progress.unlockedLevel, 1);
      expect(readGardenProfile(store, 'tr', lexicon.data.revision, WordGardenMode.calm).progress.unlockedLevel, 1);
    });

    test('blocks submissions after time expires without changing saved words or hint currency', () {
      final timed = generateGardenLevel(lexicon, 1, WordGardenMode.timed);
      final profile = createGardenProfile('az', lexicon.data.revision, WordGardenMode.timed)
          .copyWith(round: createGardenRound(timed).copyWith({'remainingSeconds': 0}));
      expect(identical(submitGardenWord(profile, timed, timed.words[0].word).profile, profile), isTrue);
      expect(revealGardenHint(profile, timed, cellKey(timed.cells[0].row, timed.cells[0].column)).used, isFalse);
      expect(gardenResult(timed, profile.round!.copyWith({'remainingSeconds': 45.7})).score, isA<int>());
    });

    test('carries legacy aggregates and an unfinished round into a new revision without deleting the original save', () {
      for (final legacy in ['az-202610-v1', 'az-202610-v2']) {
        store.clear();
        final old = createGardenProfile('az', legacy, WordGardenMode.calm).copyWith(
          round: createGardenRound(level).copyWith({'levelId': 'az:$legacy:calm:25:123', 'found': ['alma']}),
          progress: GardenProgress({...start().progress.json, 'coins': 183, 'totalWords': 67, 'totalBonusWords': 4, 'bestScore': 1050}),
        );
        expect(writeGardenProfile(store, old), isTrue);
        final next = readGardenProfile(store, 'az', current, WordGardenMode.calm);
        expect(next.revision, current);
        expect(jsonEquals(next.progress.json, old.progress.json), isTrue);
        expect(jsonEquals(next.round!.json, old.round!.json), isTrue);
        expect(isGardenPlayerSeed(next.seed), isTrue);
        expect(writeGardenProfile(store, next), isTrue);
        final reread = readGardenProfile(store, 'az', current, WordGardenMode.calm);
        expect(jsonEquals(reread.round!.json, old.round!.json), isTrue);
        expect(reread.seed, next.seed);
        expect(jsonEquals(readGardenProfile(store, 'az', legacy, WordGardenMode.calm).json, old.json), isTrue);
      }
    });

    test('creates one bounded per-player seed for the seeded revision and keeps it across reloads', () {
      final fresh = readGardenProfile(store, 'az', current, WordGardenMode.timed);
      expect(isGardenPlayerSeed(fresh.seed), isTrue);
      expect(store.getItem(gardenStorageKey('az', current, WordGardenMode.timed)), isNull);
      expect(writeGardenProfile(store, fresh.copyWith(round: createGardenRound(generateGardenLevel(lexicon, 1, WordGardenMode.timed, fresh.seed!)))), isTrue);
      final reread = readGardenProfile(store, 'az', current, WordGardenMode.timed);
      expect(reread.seed, fresh.seed);
      expect(validGardenRound(reread.round!.json, generateGardenLevel(lexicon, 1, WordGardenMode.timed, reread.seed!)), isTrue);
      expect(jsonStringify(reread.json).length, lessThan(2000));
      expect(readGardenProfile(store, 'az', 'az-202610-v2', WordGardenMode.timed).seed, isNull);
      store.setItem(gardenStorageKey('az', current, WordGardenMode.calm),
          jsonStringify({...createGardenProfile('az', current, WordGardenMode.calm).json, 'seed': -5}));
      expect(isGardenPlayerSeed(readGardenProfile(store, 'az', current, WordGardenMode.calm).seed), isTrue);
    });
  });

  group('GardenGame round lifecycle', () {
    final v1 = compileLexicon(parseWordLexicon(loadAssetText('assets/games/word_garden/az-v1.json')), 'az');
    test('a legacy unfinished timed round reopens on its own revision with the current short budget', () {
      final legacy = generateGardenLevel(v1, 3, WordGardenMode.timed);
      final profile = createGardenProfile('az', current, WordGardenMode.timed)
          .copyWith(round: createGardenRound(legacy).copyWith({'remainingSeconds': legacy.timeLimit! + 30, 'found': [legacy.words[0].id]}));
      expect(gardenLevelRevision(profile, 3), 'az-202610-v1');
      expect(gardenLevelRevision(profile, 4), current);
      final adopted = adoptGardenLevel(legacy, current);
      expect(adopted.timeLimit, lessThan(legacy.timeLimit!));
      final resumed = resumeGardenRound(profile, legacy, adopted);
      expect(resumed.round!.found, [legacy.words[0].id]);
      expect(resumed.round!.remainingSeconds, lessThanOrEqualTo(adopted.timeLimit!));
    });

    test('the clock spends time only on the active round and a confirmed reward adds capped seconds', () {
      final timed = generateGardenLevel(lexicon, 1, WordGardenMode.timed, 4242);
      var profile = createGardenProfile('az', current, WordGardenMode.timed).copyWith(round: createGardenRound(timed));
      profile = tickGardenRound(profile, timed, 2.5);
      expect(profile.round!.elapsedSeconds, 2.5);
      expect(profile.round!.remainingSeconds, timed.timeLimit! - 2.5);
      profile = tickGardenRound(profile, timed, 1000);
      expect(profile.round!.remainingSeconds, 0);
      profile = reviveGardenRound(profile, timed, 30.9);
      expect(profile.round!.remainingSeconds, 30);
      expect(profile.round!.started, isTrue);
      expect(reviveGardenRound(profile, timed, 9999).round!.remainingSeconds, 600);
      expect(identical(reviveGardenRound(profile, timed, double.nan), profile), isTrue);
    });
  });
}
