// Ported from: src/components/games/color-sort/engine.test.ts, src/components/games/color-sort/messages.test.ts
// (+ fixtures from app/tool/games/entries/color-sort.ts)
import 'package:anacan/features/games/color_sort/data/messages.dart';
import 'package:anacan/features/games/color_sort/engine/difficulty.dart';
import 'package:anacan/features/games/color_sort/engine/engine.dart';
import 'package:anacan/features/games/color_sort/engine/generator.dart';
import 'package:anacan/features/games/color_sort/engine/levels.dart';
import 'package:anacan/features/games/color_sort/engine/session.dart';
import 'package:anacan/features/games/color_sort/persistence/storage.dart';
import 'package:anacan/features/games/common/engine/js.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

final catalog = ColorSortCatalog.parse(loadAssetText('assets/games/color_sort/catalog.json'));
final bundledLevels = catalog.bundled;
Board board(Object? raw) => [for (final tube in raw as List) [for (final color in tube as List) (color as num).toInt()]];
const noLocks = Rules(4, []);

void main() {
  final store = MemoryGameStore();
  setUp(store.clear);

  group('cross-language fixtures (TypeScript → Dart)', () {
    final fixture = asMap(loadFixture('color_sort'));

    test('PRNG, seeds, profiles and board keys', () {
      final p = asMap(fixture['primitives']);
      final random = seededRandom(0xDEADBEEF);
      expect([for (var i = 0; i < 12; i++) random()], p['random']);
      for (final raw in asList(p['imulSeeds'])) {
        final item = asMap(raw), level = item['level'] as int;
        expect(imul(level, 0x27D4EB2D), item['permuteSeed']);
        expect([for (final attempt in [0, 1, 23]) toUint32(imul(level, 0x45D9F3B) + imul(attempt + 1, 0x9E3779B9))], item['genSeeds']);
      }
      expect(shuffled(List.generate(16, (i) => i), seededRandom(7)), p['shuffled']);
      for (final raw in asList(p['profiles'])) {
        final item = asMap(raw), input = item['input'] as num;
        expect(getLevelProfile(input).toJson(), item['profile'], reason: '$input');
        expect(rulesForProfile(getLevelProfile(input)).toJson(), item['rules']);
        expect(normalizeLevel(input), item['normalized']);
      }
      for (final raw in asList(p['keys'])) {
        final item = asMap(raw);
        expect(boardKey(board(item['board']), const Rules(4, [TubeLock(1, 1)])), item['key']);
        expect(segmentCount(board(item['board'])), item['segments']);
      }
      for (final raw in asList(fixture['pours'])) {
        final item = asMap(raw);
        expect(inspectPour(board(item['board']), noLocks, item['from'] as int, item['to'] as int).toJson(), item['value']);
      }
    });

    test('bundled levels, solver results and legal move enumeration', () {
      final items = asList(fixture['bundled']);
      expect(items.length, bundledLevels.length);
      for (var i = 0; i < items.length; i++) {
        final item = asMap(items[i]), level = bundledLevels[i];
        expect(jsonEquals(level.toJson(), item['level']), isTrue, reason: 'level ${i + 1}');
        expect(validateLevel(level, level.level), item['valid']);
        expect(solve(level.board, level.rules).toJson(), item['solve'], reason: 'solve ${i + 1}');
        expect(solve(level.board, level.rules, maxNodes: 45000).toJson(), item['hint'], reason: 'hint ${i + 1}');
        expect([for (final m in legalMoves(level.board, level.rules)) m.toJson()], item['legal']);
        expect([for (final m in legalMoves(level.board, level.rules, true)) m.toJson()], item['legalPruned']);
      }
      expect(solve([[0, 1, 0, 1], [1, 0, 1, 0], []], const Rules(4, [TubeLock(2, 1)])).toJson(), fixture['blocked']);
      expect(solve(bundledLevels[0].board, bundledLevels[0].rules, maxDepth: 0).toJson(), fixture['depthLimit']);
    });

    test('generated, fallback and permuted levels', () {
      for (final raw in asList(fixture['generated'])) {
        final item = asMap(raw);
        final level = generateLevel(item['level'] as int, maxAttempts: 24, maxNodes: 30000);
        expect(jsonEquals(level?.toJson(), item['value']), isTrue, reason: 'generated ${item['level']}');
      }
      expect(jsonEquals(generateLevel(31, maxAttempts: 40, maxNodes: 20000)?.toJson(), fixture['generatedTest']), isTrue);
      for (final raw in asList(fixture['fallback'])) {
        final item = asMap(raw);
        final level = catalog.fallbackLevel(item['level'] as int);
        expect(jsonEquals(level.toJson(), item['value']), isTrue, reason: 'fallback ${item['level']}');
        expect(validateLevel(level, item['level'] as int), item['valid']);
      }
      expect(jsonEquals(permuteLevel(bundledLevels[29], 1234).toJson(), fixture['permuted']), isTrue);
    });

    test('scripted rounds: sessions, undo, extra tube, saves and results', () {
      for (final raw in asList(fixture['sessions'])) {
        final item = asMap(raw), number = item['number'] as int, level = bundledLevels[number - 1];
        var session = createSession(level);
        expect(jsonStringify(session.json), jsonStringify(item['created']), reason: 'created $number');
        final steps = asList(item['steps']);
        var s = 0;
        for (var index = 0; index < level.solution.length; index++) {
          final move = level.solution[index];
          final result = pourSession(session, level, move)!;
          session = result.session;
          final step = asMap(steps[s++]);
          expect([result.amount, result.color, session.moves, session.revealed, remainingMoves(session, level)],
              [step['amount'], step['color'], step['moves'], step['revealed'], step['left']], reason: '$number #$index');
          if (index == 1) {
            session = undoSession(session)!;
            final undo = asMap(steps[s++]);
            expect(session.revealed, undo['revealed']);
            expect(boardOf(session), undo['board']);
            session = pourSession(session, level, move)!.session;
          }
          if (index == 2 && number == 4) {
            session = addTube(session)!;
            expect(session.tubes.length, asMap(steps[s++])['tubes']);
          }
        }
        expect(jsonStringify(session.json), jsonStringify(item['final']), reason: 'final $number');
        store.clear();
        saveSession(store, session, level);
        expect(store.getItem(colorSortSaveKey), item['raw'], reason: 'raw $number');
        expect(jsonStringify(readSavedSession(store, level)?.json), jsonStringify(item['read']), reason: 'read $number');
        clearSavedSession(store, level);
        expect(store.getItem(colorSortSaveKey), item['cleared']);
        expect(resultForLevel(level, session.moves, session.hints, session.extraTubes, session.undos).toJson(), item['result']);
        expect(pourSession(createSession(level), level, const Move(0, 0)), isNull);
      }
      for (final raw in asList(fixture['midSaves'])) {
        final item = asMap(raw), level = bundledLevels[(item['number'] as int) - 1];
        store.setItem(colorSortSaveKey, item['tampered'] as String);
        expect(readSavedSession(store, level), item['readTampered']);
        store.setItem(colorSortSaveKey, item['raw'] as String);
        final session = readSavedSession(store, level)!;
        expect(knownSolutionMove(level, boardOf(session))?.toJson(), item['known']);
        expect(knownSolutionMove(level, level.board)?.toJson(), item['knownStart']);
        expect(knownSolutionMove(level, [[9]])?.toJson(), item['unknown']);
      }
      for (final raw in asList(fixture['results'])) {
        final item = asMap(raw);
        expect(resultForLevel(bundledLevels[(item['n'] as int) - 1], item['moves'] as int, item['hints'] as int, item['extra'] as int, item['undos'] as int).toJson(),
            item['value']);
      }
    });

    test('level count, level cache eviction and cached reads', () {
      for (final raw in asList(fixture['counts'])) {
        final item = asMap(raw);
        store.clear();
        if (item['raw'] != null) store.setItem(colorSortLevelCountKey, item['raw'] as String);
        expect(readLevelCount(store), item['value'], reason: '${item['raw']}');
      }
      store.clear();
      store.setItem('${colorSortCachePrefix}55', jsonStringify(catalog.fallbackLevel(55).toJson()));
      store.setItem('${colorSortCachePrefix}33', jsonStringify(catalog.fallbackLevel(33).toJson()));
      for (final raw in asList(fixture['cacheTrace'])) {
        final item = asMap(raw);
        cacheLevel(store, catalog.fallbackLevel(item['n'] as int));
        expect(store.getItem(colorSortCacheIndexKey), item['index'], reason: 'index after ${item['n']}');
        expect(store.keys.toList()..sort(), item['keys'], reason: 'keys after ${item['n']}');
      }
      for (final raw in asList(fixture['cachedRead'])) {
        final item = asMap(raw);
        expect(jsonEquals(getCachedLevel(store, catalog, item['n'] as int)?.toJson(), item['value']), isTrue, reason: '${item['n']}');
      }
    });

    test('worker job: deterministic level generation, fallback and hint', () {
      final catalogText = loadAssetText('assets/games/color_sort/catalog.json');
      final level = colorSortWorkerJob({'kind': 'level', 'level': 31, 'catalog': catalogText}, timeBudget: false);
      expect(jsonEquals(level['level'], generateLevel(31, maxAttempts: 24, maxNodes: 30000)!.toJson()), isTrue);
      final first = bundledLevels[5];
      final hint = colorSortWorkerJob({'kind': 'hint', 'board': first.board, 'rules': first.rules.toJson()}, timeBudget: false);
      expect(hint['move'], solve(first.board, first.rules, maxNodes: 45000).moves.first.toJson());
      expect(immediateColorSortHint(first, first.board), first.solution.first);
      expect(acceptWorkerHint(first, first.board, {'from': 0, 'to': 0}), isNull);
    });
  });

  group('Color Sort rules and shipped levels', () {
    test('pours only the contiguous top color and fits the target without mutating the input', () {
      final b = [[0, 1, 1, 1], [0, 1, 1], <int>[]];
      final original = jsonClone(b);
      final result = pour(b, noLocks, const Move(0, 1))!;
      expect(result.amount, 1);
      expect(result.board, [[0, 1, 1], [0, 1, 1, 1], <int>[]]);
      expect(b, original);
      expect(inspectPour([[0, 1], [0], []], noLocks, 0, 1).reason, 'different');
      expect(inspectPour(b, noLocks, 2, 0).reason, 'empty');
      expect(inspectPour(b, noLocks, 0, 0).amount, 0);
    });

    test('opens an empty locked tube only after a completed color, and seals finished tubes', () {
      const rules = Rules(4, [TubeLock(4, 1)]);
      Board b = [[0, 0, 1, 1], [1, 1, 0, 0], [], [], []];
      expect(isLocked(b, rules, 4), isTrue);
      expect(inspectPour(b, rules, 0, 4).reason, 'locked');
      b = pour(b, rules, const Move(0, 2))!.board;
      b = pour(b, rules, const Move(1, 0))!.board;
      expect(completedCount(b, 4), 1);
      expect(isLocked(b, rules, 4), isFalse);
      expect(inspectPour(b, rules, 0, 4).reason, 'complete');
      expect(isSolved(pour(b, rules, const Move(2, 1))!.board, 4), isTrue);
    });

    test('ships thirty different puzzles with fully replayable solutions inside their move budgets', () {
      expect(bundledLevels, hasLength(30));
      expect({for (final level in bundledLevels) jsonStringify(level.board)}.length, 30);
      for (var index = 0; index < bundledLevels.length; index++) {
        final level = bundledLevels[index];
        expect(level.level, index + 1);
        expect(validateLevel(level, level.level), isTrue, reason: 'level ${level.level}');
        expect(isSolved(level.board, level.rules.capacity), isFalse);
        expect(replaySolution(level.board, level.rules, level.solution), isNotNull, reason: 'solution ${level.level}');
        if (level.moveLimit != null) expect(level.moveLimit, greaterThanOrEqualTo(level.solution.length));
      }
      expect(getLevelProfile(1).colors, lessThan(getLevelProfile(30).colors));
      expect(getLevelProfile(1).emptyTubes, greaterThan(getLevelProfile(30).emptyTubes));
      final p30 = getLevelProfile(30);
      expect([p30.lockedTubes, p30.hiddenTubes, p30.limitedMoves], [2, 3, true]);
    });

    test('has verified offline fallback levels beyond the initial catalog, including remapped locks', () {
      for (final number in [31, 40, 75, maxLevelCount]) {
        final level = catalog.fallbackLevel(number);
        expect(validateLevel(level, number), isTrue, reason: 'fallback $number');
        expect(replaySolution(level.board, level.rules, level.solution), isNotNull);
      }
    });

    test('generates an additional reproducible puzzle and finds a legal hint path', () {
      final level = generateLevel(31, maxAttempts: 40, maxNodes: 20000)!;
      expect(validateLevel(level, 31), isTrue);
      final result = solve(level.board, level.rules, maxNodes: 30000);
      expect(result.status, 'solved');
      expect(replaySolution(level.board, level.rules, result.moves), isNotNull);
    });

    test('distinguishes a genuinely blocked state from a bounded search and rejects malformed boards', () {
      const rules = Rules(4, [TubeLock(2, 1)]);
      expect(solve([[0, 1, 0, 1], [1, 0, 1, 0], []], rules).status, 'unsolvable');
      final level = bundledLevels[0];
      expect(solve(level.board, level.rules, maxDepth: 0).status, 'limit');
      expect(validateBoard([[0, 9], <int>[]], 2, rules), isFalse);
      expect(validateLevelJson({...level.toJson(), 'solution': [null]}, 1), isFalse);
      expect(boardKey([[1, 0, 11]], noLocks), isNot(boardKey([[10, 1, 1]], noLocks)));
    });
  });

  group('Color Sort local round', () {
    test('undo restores liquid and lock eligibility but retains revealed knowledge', () {
      final level = bundledLevels[15];
      var state = createSession(level);
      final initial = jsonClone(state.json);
      expect(state.revealed.length, lessThan(state.tubes.expand((t) => t).length));
      state = pourSession(state, level, level.solution[0])!.session;
      final known = state.revealed;
      final undone = undoSession(state)!;
      expect(boardOf(undone), level.board);
      expect(undone.moves, 0);
      expect(undone.revealed, containsAll(known));
      expect(state.moves, 1);
      expect(jsonEquals(asMap(initial)['tubes'], createSession(level).json['tubes']), isTrue);
    });

    test('adds only one free tube, preserves every unit and persists/resumes the current round', () {
      final level = bundledLevels[3];
      var state = pourSession(createSession(level), level, level.solution[0])!.session;
      state = addTube(state)!;
      expect(state.tubes, hasLength(level.board.length + 1));
      expect(state.tubes.expand((t) => t), hasLength(level.colors * 4));
      expect(addTube(state), isNull);
      expect(state.history, isEmpty);
      saveSession(store, state, level);
      expect(jsonEquals(readSavedSession(store, level)?.json, state.json), isTrue);
      expect(readSavedSession(store, bundledLevels[0]), isNull);
      store.setItem('anacan_colorsort_round_v1', '{bad');
      expect(readSavedSession(store, level), isNull);
    });
  });

  group('Color Sort language coverage', () {
    test('bundles every game message in all nine supported languages with matching parameters', () {
      final messages = ColorSortMessages.parse(loadAssetText('assets/games/color_sort/messages.json'));
      final languages = messages.catalog.languages;
      expect(languages.keys.toList()..sort(), ['az', 'en', 'tr', 'ru', 'de', 'ar', 'kk', 'uz', 'ka']..sort());
      final az = languages['az']!;
      final keys = az.keys.toList()..sort();
      List<String> parameters(String text) => [for (final m in RegExp(r'\{(\w+)\}').allMatches(text)) m.group(1)!]..sort();
      for (final entry in languages.entries) {
        expect(entry.value.keys.toList()..sort(), keys, reason: entry.key);
        for (final key in keys) {
          expect(entry.value[key]!.trim(), isNotEmpty, reason: '${entry.key}:$key');
          expect(parameters(entry.value[key]!), parameters(az[key]!), reason: '${entry.key}:$key');
        }
      }
      expect(messages.text('xx', 'level', parameters: {'level': 3}), 'Səviyyə 3');
      expect(messages.text('en', 'level', parameters: {'level': 3}, cachedTranslation: (key, _) => key == 'colorsort_level' ? 'L{level}' : null), 'L3');
    });
  });
}
