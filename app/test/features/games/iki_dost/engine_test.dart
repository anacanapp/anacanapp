// Ported from: src/components/games/iki-dost/engine.test.ts, src/components/games/iki-dost/state.test.ts,
// src/components/games/iki-dost/messages.test.ts (+ fixtures from app/tool/games/entries/iki-dost.ts)
import 'package:anacan/features/games/common/data/game_messages.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/iki_dost/data/messages.dart';
import 'package:anacan/features/games/iki_dost/engine/engine.dart';
import 'package:anacan/features/games/iki_dost/engine/state.dart';
import 'package:anacan/features/games/iki_dost/persistence/storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

final catalog = FriendsCatalog.parse(loadAssetText('assets/games/iki_dost/catalog.json'));
FriendsLevel friendsLevel(int n) => catalog.level(n);

FriendsLevel fixture(List<String> left, List<String> right, [List<int> plateCounts = const [0, 0]]) => FriendsLevel(
    revision: twoFriendsRevision, level: 1, chapter: 1, worlds: [readFriendWorld(left), readFriendWorld(right)], control: 'same',
    plateCounts: plateCounts, par: 1, solution: const []);

void main() {
  final store = MemoryGameStore();
  setUp(store.clear);

  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('iki_dost'));

    test('solver, move traces and random walks for all 40 catalog levels', () {
      var matched = 0;
      for (final raw in asList(data['levels'])) {
        final item = asMap(raw), level = friendsLevel(item['n'] as int);
        expect(solveFriends(level).toJson(), item['solve'], reason: 'solve ${item['n']}');
        final half = replayFriends(level, level.solution.sublist(0, level.solution.length ~/ 2)).state;
        expect(half.toJson(), item['half']);
        expect(solveFriends(level, half).toJson(), item['solveHalf']);
        expect(solveFriends(level, null, 25).toJson(), item['tight']);
        var state = initialFriendsState(level);
        final trace = asList(item['trace']);
        for (var i = 0; i < level.solution.length; i++) {
          final move = moveFriends(level, state, level.solution[i]);
          expect(move.toJson(), trace[i], reason: 'trace ${item['n']} #$i');
          state = move.state;
        }
        var walkState = initialFriendsState(level);
        for (final rawStep in asList(item['walk'])) {
          final step = asMap(rawStep);
          final move = moveFriends(level, walkState, step['direction'] as String);
          expect(move.toJson(), step['move']);
          expect(friendsStateKey(move.state), step['key']);
          expect(friendsPlateMask(level, move.state), step['plates']);
          if (!move.lost) walkState = move.state;
        }
        expect(solveFriends(level, walkState).toJson(), item['solveWalk'], reason: 'walk solve ${item['n']}');
        matched++;
      }
      expect(matched, 40);
    });

    test('controls, world parsing, results, profile flow and replays', () {
      for (final raw in asList(data['directions'])) {
        final item = asMap(raw);
        expect([for (final d in friendDirections) friendDirection(d, item['control'] as String)], item['value']);
      }
      for (final raw in asList(data['worlds'])) {
        final item = asMap(raw);
        try {
          expect(readFriendWorld(asList(item['rows']).cast<String>()).toJson(), item['value']);
          expect(item.containsKey('error'), isFalse);
        } catch (error) {
          expect('$error', item['error']);
        }
      }
      for (final raw in asList(data['results'])) {
        final item = asMap(raw);
        final result = friendsResult(friendsLevel(item['n'] as int),
            createFriendsRound(item['n'] as int).copyWith({'moves': item['moves'], 'hints': item['hints']}));
        expect({'stars': result.stars, 'score': result.score}, item['value']);
      }
      final flow = asMap(data['flow']);
      final level1 = friendsLevel(1), level2 = friendsLevel(2);
      final fresh = createFriendsProfile().withRound(createFriendsRound(1).copyWith({'path': level1.solution, 'moves': level1.par}));
      expect(jsonStringify(fresh.json), jsonStringify(flow['fresh']));
      final won = completeFriendsLevel(fresh, level1);
      expect(jsonStringify(won.json), jsonStringify(flow['won']));
      final replay = completeFriendsLevel(
          won.withRound(createFriendsRound(1).copyWith({'path': level1.solution, 'moves': level1.par + 9, 'hints': 2})), level1);
      expect(jsonStringify(replay.json), jsonStringify(flow['replay']));
      final second = completeFriendsLevel(
          replay.withRound(createFriendsRound(2).copyWith({'path': level2.solution, 'moves': 12, 'hints': 1, 'undos': 3})), level2);
      expect(jsonStringify(second.json), jsonStringify(flow['second']));
      expect(identical(completeFriendsLevel(won, level1), won), flow['same']);
      for (final raw in asList(data['replays'])) {
        final item = asMap(raw);
        try {
          final result = replayFriends(level1, asList(item['path']));
          expect({'state': result.state.toJson(), 'lost': result.lost}, item['value']);
        } catch (error) {
          expect('$error', item['error']);
        }
      }
    });

    test('saved profiles parse, recover and re-serialise byte-for-byte', () {
      for (final raw in asList(data['storage'])) {
        final item = asMap(raw);
        store.clear();
        if (item['raw'] != null) store.setItem(friendsStorageKey, item['raw'] as String);
        final profile = readFriendsProfile(store, catalog);
        expect(jsonStringify(profile.json), jsonStringify(item['profile']), reason: item['name'] as String);
        writeFriendsProfile(store, profile);
        expect(store.getItem(friendsStorageKey), item['rewritten'], reason: item['name'] as String);
      }
    });

    test('hint job returns the next optimal direction', () {
      final level = friendsLevel(12);
      expect(friendsHintJob((level: level.toJson(), state: initialFriendsState(level).toJson())), solveFriends(level).path!.first);
    });
  });

  group('two linked friends', () {
    test('moves both with one command while an obstacle can stop only one', () {
      final level = fixture(['#####', '#S.H#', '#...#', '#####'], ['#####', '#S#H#', '#...#', '#####']);
      final move = moveFriends(level, initialFriendsState(level), 'right');
      expect(move.moved, [true, false]);
      expect(move.state.positions, [7, 6]);
      expect(moveFriends(level, initialFriendsState(level), 'up').changed, isFalse);
    });

    test('maps each mirrored axis and all four opposite directions precisely', () {
      expect([for (final d in friendDirections) friendDirection(d, 'opposite')], ['down', 'left', 'up', 'right']);
      expect([for (final d in friendDirections) friendDirection(d, 'mirror-x')], ['up', 'left', 'down', 'right']);
      expect([for (final d in friendDirections) friendDirection(d, 'mirror-y')], ['down', 'right', 'up', 'left']);
    });

    test('uses a shared key only after it is collected, including across the other world', () {
      final level = fixture(['######', '#Sk.H#', '#....#', '######'], ['######', '#SK.H#', '#....#', '######']);
      var move = moveFriends(level, initialFriendsState(level), 'right');
      expect(move.moved, [true, false]);
      expect(move.collectedKeys, 1);
      move = moveFriends(level, move.state, 'right');
      expect(move.moved, [true, true]);
      expect(move.state.keys, 1);
    });

    test('opens a pressure gate using the pre-move held switch and closes it after departure', () {
      final level = fixture(['######', '#Sa.H#', '#....#', '######'], ['######', '#SA.H#', '#....#', '######'], [1, 0]);
      final onSwitch = moveFriends(level, initialFriendsState(level), 'right');
      expect(onSwitch.moved, [true, false]);
      expect(friendsPlateMask(level, onSwitch.state), 1);
      final crossed = moveFriends(level, onSwitch.state, 'right');
      expect(crossed.moved, [true, true]);
      expect(friendsPlateMask(level, crossed.state), 0);
      final leftDoor = moveFriends(level, crossed.state, 'down');
      expect(leftDoor.moved[1], isTrue);
      expect(moveFriends(level, leftDoor.state, 'up').moved[1], isFalse);
    });

    test('requires both held switches for a two-friend coordinated gate', () {
      final level = fixture(['######', '#SaAH#', '#....#', '######'], ['######', '#SaAH#', '#....#', '######'], [2, 0]);
      final start = initialFriendsState(level);
      expect(friendsPlateMask(level, FriendsState(const [8, 7], start.keys)), 0);
      final together = moveFriends(level, start, 'right');
      expect(friendsPlateMask(level, together.state), 1);
      expect(moveFriends(level, together.state, 'right').moved, [true, true]);
    });

    test('does not freeze a friend at home and fails safely if either falls in water', () {
      final level = fixture(['#####', '#SH.#', '#...#', '#####'], ['#####', '#S!H#', '#...#', '#####']);
      final move = moveFriends(level, initialFriendsState(level), 'right');
      expect(move.lost, isTrue);
      expect(move.won, isFalse);
      expect(friendsAtHome(level, move.state), [true, false]);
      expect(moveFriends(level, move.state, 'down').moved[0], isTrue);
    });

    test('solves every shipped level and reproduces its stored optimal solution', () {
      for (var n = 1; n <= 40; n++) {
        final level = friendsLevel(n), solved = solveFriends(level);
        expect(solved.path?.length, level.par, reason: 'level $n');
        expect(solved.exhausted, isFalse);
        final last = replayFriends(level, level.solution);
        expect(last.lost, isFalse);
        expect(friendsAtHome(level, last.state), [true, true]);
      }
    });
  });

  group('Two Friends saved journey', () {
    test('unlocks once and does not count the same rescue again on replay', () {
      final level = friendsLevel(1);
      final fresh = createFriendsProfile().withRound(createFriendsRound(1).copyWith({'path': level.solution, 'moves': level.par}));
      final won = completeFriendsLevel(fresh, level);
      expect(won.unlocked, 2);
      expect(won.totalRescues, 2);
      expect(asMap(won.levels['1'])['stars'], 3);
      expect(identical(completeFriendsLevel(won, level), won), isTrue);
      expect(completeFriendsLevel(won.withRound(fresh.round), level).totalRescues, 2);
    });

    test('restores a partially played path and preserves progression when only the round is malformed', () {
      final level = friendsLevel(1);
      final profile = createFriendsProfile().withRound(createFriendsRound(1).copyWith({'path': level.solution.sublist(0, 2), 'moves': 2}));
      expect(writeFriendsProfile(store, profile), isTrue);
      expect(jsonEquals(readFriendsProfile(store, catalog).json, profile.json), isTrue);
      store.setItem(friendsStorageKey, jsonStringify({...profile.json, 'round': {...profile.round!.json, 'path': ['up']}}));
      expect(readFriendsProfile(store, catalog).round, isNull);
      expect(jsonEquals(readFriendsProfile(store, catalog).progress, profile.progress), isTrue);
    });

    test('does not accept future levels or an awarded unsolved round', () {
      final profile = createFriendsProfile();
      store.setItem(friendsStorageKey, jsonStringify({...profile.json, 'round': createFriendsRound(40).json}));
      expect(readFriendsProfile(store, catalog).round, isNull);
      store.setItem(friendsStorageKey, jsonStringify({...profile.json, 'round': createFriendsRound(1).copyWith({'awarded': true}).json}));
      expect(readFriendsProfile(store, catalog).round, isNull);
    });
  });

  group('Two Friends offline language packs', () {
    test('bundles every label and matching placeholders in all 21 app languages', () {
      final messages = FriendsMessages.parse(loadAssetText('assets/games/iki_dost/messages.json'));
      final languages = messages.catalog.languages;
      expect(languages.keys.toList()..sort(), List.of(gameAppLanguageCodes)..sort());
      final az = languages['az']!;
      final pattern = RegExp(r'\{\w+\}');
      for (final language in gameAppLanguageCodes) {
        for (final key in az.keys) {
          final text = languages[language]![key];
          expect(text?.trim(), isNotEmpty);
          expect([for (final m in pattern.allMatches(text!)) m.group(0)], [for (final m in pattern.allMatches(az[key]!)) m.group(0)]);
          expect(messages.text(language, key, {'level': 2, 'count': 3}), isNot(matches(pattern)));
        }
      }
    });
  });
}
