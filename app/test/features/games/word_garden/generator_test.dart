// Ported from: src/components/games/word-garden/generator.test.ts (+ cross-language fixtures from
// app/tool/games/entries/word-garden.ts)
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/word_garden/engine/generator.dart';
import 'package:anacan/features/games/word_garden/engine/lexicon.dart';
import 'package:anacan/features/games/word_garden/engine/library.dart';
import 'package:anacan/features/games/word_garden/engine/model.dart';
import 'package:anacan/features/games/word_garden/engine/wheel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

final lexicon = compileLexicon(parseWordLexicon(loadAssetText('assets/games/word_garden/az.json')), 'az');
final lexiconV2 = compileLexicon(parseWordLexicon(loadAssetText('assets/games/word_garden/az-v2.json')), 'az');
final lexiconV1 = compileLexicon(parseWordLexicon(loadAssetText('assets/games/word_garden/az-v1.json')), 'az');

List<String> answers(WordGardenLevel level) => [for (final word in level.words) word.word];
List<WordGardenLevel> sequence(int seed, int count, [WordGardenMode mode = WordGardenMode.calm, int from = 1]) =>
    [for (var index = 0; index < count; index++) generateGardenLevel(lexicon, from + index, mode, seed)];
String sortedJoin(List<String> words, [String separator = ',']) => (List.of(words)..sort()).join(separator);

void main() {
  group('cross-language fixtures (TypeScript → Dart)', () {
    final fixture = asMap(loadFixture('word_garden_primitives'));
    final primitives = asMap(fixture['primitives']);

    test('FNV seed, mulberry stream and shuffle match JS bit-for-bit', () {
      for (final item in asList(primitives['seeds'])) {
        final map = asMap(item);
        expect(gardenSeed(map['value'] as String), map['seed'], reason: map['value'] as String);
      }
      final random = gardenRandom(gardenSeed('fixture'));
      expect([for (var i = 0; i < 20; i++) random()], primitives['random']);
      final big = gardenRandom(0xFFFFFFFF);
      expect([for (var i = 0; i < 20; i++) big()], primitives['randomBig']);
      expect(shuffleLetters(List.generate(20, (i) => i), gardenRandom(42)), primitives['shuffled']);
    });

    test('level profiles, time limits, case mapping and wheel geometry', () {
      for (final item in asList(primitives['profiles'])) {
        final map = asMap(item), profile = getGardenLevelProfile(map['level'] as int);
        expect([profile.rackLength, profile.targetWords, profile.difficulty], [map['rackLength'], map['targetWords'], map['difficulty']]);
      }
      for (final item in asList(primitives['timeLimits'])) {
        final map = asMap(item);
        final words = [for (final length in asList(map['lengths'])) List.filled(length as int, 'a')];
        expect(gardenTimeLimit(words, map['rack'] as int, map['difficulty'] as int), map['value']);
      }
      for (final item in asList(primitives['display'])) {
        expect(displayGardenWord(asMap(item)['word'] as String, 'az-AZ'), asMap(item)['upper']);
      }
      for (final item in asList(primitives['normalize'])) {
        expect(normalizeGardenWord(asMap(item)['word'] as String, lexicon.data), asMap(item)['normalized']);
      }
      final wheel = asMap(primitives['wheel']);
      for (final item in asList(wheel['select'])) {
        final map = asMap(item);
        expect(selectWheelLetter(asList(map['selected']).cast<int>(), map['index'] as int), map['result']);
      }
      final counts = [4, 5, 7];
      for (var i = 0; i < counts.length; i++) {
        expect([for (final p in wheelPoints(counts[i])) p.toJson()], asList(wheel['points'])[i]);
      }
      for (final item in asList(wheel['crossed'])) {
        final map = asMap(item);
        WheelPoint point(Object? raw) => WheelPoint((asMap(raw)['x'] as num).toDouble(), (asMap(raw)['y'] as num).toDouble());
        expect(crossedLetters(point(map['from']), point(map['to']), wheelPoints(map['count'] as int)), map['result']);
      }
    });

    test('compiled lexicon statistics', () {
      final stats = asMap(fixture['lexicons']);
      for (final (name, value) in [('v3', lexicon), ('v2', lexiconV2), ('v1', lexiconV1)]) {
        final expected = asMap(stats[name]);
        expect(value.data.revision, expected['revision']);
        expect(value.words.length, expected['words']);
        expect(value.targets.length, expected['targets']);
        expect(value.bySignature.length, expected['signatures']);
        expect([for (final w in wordsFromRack(value, ['a', 'l', 'm', 'a', 'r', 'ı'])) w.word], expected['rack']);
      }
    });

    for (final (name, lex) in [('v3', () => lexicon), ('v2', () => lexiconV2), ('v1', () => lexiconV1)]) {
      test('generated $name levels equal the TypeScript generator', () {
        final cases = asList(loadFixture('word_garden_levels_$name'));
        var matched = 0;
        for (final item in cases) {
          final map = asMap(item);
          final mode = WordGardenMode.parse(map['mode'])!;
          final level = generateGardenLevel(lex(), map['level'] as int, mode, map['seed'] as int);
          final json = level.toJson();
          expect(jsonEquals(json, map['puzzle']), isTrue, reason: '$name ${map['mode']} ${map['level']} seed ${map['seed']}\n$json\n${map['puzzle']}');
          expect(validateGardenLevel(level, lex()), map['valid']);
          matched++;
        }
        expect(matched, cases.length);
      }, timeout: const Timeout(Duration(minutes: 5)));
    }

    test('worker job entry point returns the level or a WORD_GARDEN_ error', () {
      final text = loadAssetText('assets/games/word_garden/az-v2.json');
      final ok = generateGardenLevelJob((lexiconJson: text, language: 'az', level: 7, mode: 'calm', seed: 99));
      expect(jsonEquals(ok['level'], generateGardenLevel(lexiconV2, 7).toJson()), isTrue);
      expect(generateGardenLevelJob((lexiconJson: text, language: 'az', level: 0, mode: 'calm', seed: null))['error'], 'WORD_GARDEN_LEVEL_INVALID');
      expect(generateGardenLevelJob((lexiconJson: text, language: 'en', level: 1, mode: 'calm', seed: null))['error'], 'WORD_GARDEN_LEXICON_INVALID');
    });
  });

  group('dictionary-driven Word Garden', () {
    test('preserves Azerbaijani letters and repeated-letter counts', () {
      expect(displayGardenWord('işıq', 'az-AZ'), 'İŞIQ');
      expect(normalizeGardenWord('İŞIQ', lexicon.data), 'işıq');
      expect(normalizeGardenWord('ALMA!', lexicon.data), isNull);
      expect([for (final w in wordsFromRack(lexicon, ['a', 'l', 'm', 'a'])) w.word], contains('alma'));
      expect([for (final w in wordsFromRack(lexicon, ['a', 'l', 'm'])) w.word], isNot(contains('alma')));
      expect(() => compileLexicon(lexicon.data, 'en'), throwsA(predicate((e) => '$e' == 'WORD_GARDEN_LEXICON_INVALID')));
    });

    test('generates connected, dictionary-valid and reproducible puzzles beyond a fixed catalog', () {
      const samples = [1, 2, 3, 10, 11, 20, 40, 41, 100, 101, 220, 221, 1000, 10000, 1000000, 2147483647];
      for (final mode in WordGardenMode.values) {
        for (final level in samples) {
          final puzzle = generateGardenLevel(lexicon, level, mode, 4242);
          expect(validateGardenLevel(puzzle, lexicon), isTrue, reason: '$mode $level');
          expect(jsonEquals(generateGardenLevel(lexicon, level, mode, 4242).toJson(), puzzle.toJson()), isTrue);
          expect(puzzle.timeLimit == null, mode == WordGardenMode.calm);
        }
      }
      final variants = sequence(4242, 60, WordGardenMode.calm, 221);
      expect({for (final puzzle in variants) sortedJoin(answers(puzzle))}.length, 60);
    }, timeout: const Timeout(Duration(minutes: 2)));

    test('ships a larger reviewed Azerbaijani v3 library without dropping any published word', () {
      expect(lexicon.data.revision, wordGardenLibraries['az']!.revision);
      expect(lexicon.words.length, wordGardenLibraries['az']!.words);
      expect(lexicon.targets.length, wordGardenLibraries['az']!.targets);
      expect(lexicon.targets.length, greaterThan(lexiconV2.targets.length * 1.9));
      for (final word in lexiconV2.words.keys) {
        expect(lexicon.words.containsKey(word), isTrue, reason: word);
      }
      Map<int, int> byLength(CompiledLexicon value) {
        final counts = <int, int>{};
        for (final word in value.targets) {
          counts[word.letters.length] = (counts[word.letters.length] ?? 0) + 1;
        }
        return counts;
      }

      final now = byLength(lexicon), before = byLength(lexiconV2);
      for (var length = 3; length <= 8; length++) {
        expect(now[length], greaterThan(before[length]!), reason: 'length $length');
      }
      for (var length = 5; length <= 8; length++) {
        expect(now[length], greaterThan(before[length]! * 1.7), reason: 'length $length');
      }
      // The editorial-list assertions of the TS test read scripts/word-garden/az-editorial-v3.json, which is
      // not shipped with the app; the shipped lexicon bytes are pinned by assets/games/manifest.json instead.
    });

    test('deals each player a reproducible sequence that differs from other players', () {
      final first = sequence(1, 40), again = sequence(1, 40), other = sequence(2, 40), third = sequence(0xFFFFFFFF, 40);
      for (var i = 0; i < 40; i++) {
        expect(jsonEquals(again[i].toJson(), first[i].toJson()), isTrue);
      }
      int differing(List<WordGardenLevel> a, List<WordGardenLevel> b) =>
          [for (var i = 0; i < a.length; i++) if (sortedJoin(answers(a[i])) != sortedJoin(answers(b[i]))) i].length;
      expect(differing(first, other), greaterThan(30));
      expect(differing(first, third), greaterThan(30));
      expect(first[0].id, isNot(other[0].id));
      for (final level in [first[0], other[0], third[0]]) {
        expect(validateGardenLevel(level, lexicon), isTrue);
      }
      expect(jsonEquals(generateGardenLevel(lexicon, 5000, WordGardenMode.timed, 2).toJson(),
          generateGardenLevel(lexicon, 5000, WordGardenMode.timed, 2).toJson()), isTrue);
      expect(() => generateGardenLevel(lexicon, 1, WordGardenMode.calm, -1), throwsA(predicate((e) => '$e' == 'WORD_GARDEN_PLAYER_SEED_INVALID')));
      expect(jsonEquals(generateGardenLevel(lexiconV2, 7, WordGardenMode.calm, 99).toJson(), generateGardenLevel(lexiconV2, 7).toJson()), isTrue);
    }, timeout: const Timeout(Duration(minutes: 2)));

    test('does not repeat a rack or recent answer and spreads words across a long run', () {
      for (final mode in WordGardenMode.values) {
        final levels = sequence(31337, 400, mode);
        final racks = [for (final level in levels) (List.of(level.letters)..sort()).join()];
        expect(racks.sublist(0, 220).toSet().length, 220, reason: '$mode');
        expect(racks.sublist(220).toSet().length, 180, reason: '$mode');
        final last = <String, int>{};
        var repeated = 0;
        for (var index = 0; index < levels.length; index++) {
          final level = levels[index];
          expect(validateGardenLevel(level, lexicon), isTrue, reason: '$mode ${index + 1}');
          for (final word in answers(level)) {
            if (last.containsKey(word)) {
              repeated++;
              expect(index - last[word]!, greaterThan(2), reason: '$mode $word@${index + 1}');
            }
            last[word] = index;
          }
        }
        final total = levels.fold<int>(0, (sum, level) => sum + level.words.length);
        expect(last.length / total, greaterThan(0.6), reason: '$mode');
        expect(repeated, total - last.length);
      }
    }, timeout: const Timeout(Duration(minutes: 3)));

    test('keeps other languages unavailable instead of substituting Azerbaijani puzzles', () {
      expect(hasWordGardenLibrary('az-AZ'), isTrue);
      expect(hasWordGardenLibrary('en'), isFalse);
      expect(() => gardenLexiconAsset('en'), throwsA(predicate((e) => '$e' == 'WORD_GARDEN_LANGUAGE_NOT_AVAILABLE')));
    });

    test('keeps the published v2 curriculum: distinct beginner puzzles, no adjacent repeated answers', () {
      for (final mode in WordGardenMode.values) {
        final levels = [for (var index = 0; index < 240; index++) generateGardenLevel(lexiconV2, index + 1, mode)];
        expect({for (final level in levels.sublist(0, 20)) sortedJoin(answers(level), '|')}.length, 20);
        for (var index = 1; index < levels.length; index++) {
          final previous = answers(levels[index - 1]).toSet();
          expect(levels[index].words.any((word) => previous.contains(word.word)), isFalse, reason: '$mode ${index + 1}');
        }
        expect(levels[0].words[0].word, 'alma');
        expect(levels[1].words[0].word, 'işıq');
        expect(lexiconV2.targets.length, 2921);
      }
    }, timeout: const Timeout(Duration(minutes: 2)));

    test('budgets a short timed challenge for the actual word load instead of several minutes', () {
      final samples = [for (final level in [1, 2, 11, 41, 101, 221]) generateGardenLevel(lexicon, level, WordGardenMode.timed, 77)];
      expect(samples[0].timeLimit, inInclusiveRange(25, 35));
      for (final sample in samples) {
        expect(sample.timeLimit, inInclusiveRange(25, 100));
      }
      expect(samples[2].timeLimit, greaterThan(samples[0].timeLimit!));
      expect(samples[3].timeLimit, greaterThan(samples[2].timeLimit!));
      expect(samples[4].timeLimit, greaterThan(samples[3].timeLimit!));
      expect(samples[5].timeLimit, greaterThan(samples[4].timeLimit!));
    });
  });
}
