// Ported from: src/components/games/parking/engine.test.ts, src/components/games/casual/storage.test.ts
// (+ fixtures from app/tool/games/entries/parking.ts and casual.ts)
import 'package:anacan/features/games/casual/data/messages.dart';
import 'package:anacan/features/games/casual/persistence/storage.dart';
import 'package:anacan/features/games/common/data/game_messages.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/leaf_flight/engine/engine.dart';
import 'package:anacan/features/games/parking/engine/engine.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

final catalog = ParkingCatalog.parse(loadAssetText('assets/games/parking/catalog.json'));
ParkingLevel parkingLevel(int n) => catalog.level(n);
bool validRound(Object? round) => validParkingRound(round, catalog);

final fixtureLevel = ParkingLevel(
  revision: parkingRevision, level: 1, chapter: 1,
  cars: const [ParkingCar('Q', 'h', 2, 2, 0), ParkingCar('A', 'v', 3, 3, 1)],
  positions: const [0, 0], keyBay: null, par: 2, solution: const [ParkingMove(1, 3), ParkingMove(0, 6)],
);

ParkingLevel withKeyBay(ParkingLevel level, ({int car, int position}) keyBay) => ParkingLevel(
    revision: level.revision, level: level.level, chapter: level.chapter, cars: level.cars, positions: level.positions, keyBay: keyBay,
    par: level.par, solution: level.solution);

void main() {
  final store = MemoryGameStore();
  setUp(store.clear);

  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('parking'));

    test('solver, legal moves and random walks for all 40 catalog levels', () {
      for (final raw in asList(data['levels'])) {
        final item = asMap(raw), level = parkingLevel(item['n'] as int);
        expect(solveParking(level).toJson(), item['solve'], reason: 'solve ${item['n']}');
        final half = replayParking(level, level.solution.sublist(0, level.solution.length ~/ 2));
        expect(half.toJson(), item['half']);
        expect(solveParking(level, half).toJson(), item['solveHalf']);
        expect(solveParking(level, null, 40).toJson(), item['tight']);
        expect(parkingOccupancy(level, initialParkingState(level)), item['occupancy']);
        final rng = mulberry32(1000 + (item['n'] as int) - 1);
        var state = initialParkingState(level);
        for (final rawStep in asList(item['walk'])) {
          final step = asMap(rawStep);
          final moves = parkingMoves(level, state);
          expect([for (final m in moves) m.toJson()], step['moves']);
          final legal = moves.where((m) => !(m.car == 0 && m.to == 6)).toList();
          final move = legal.isEmpty ? null : legal[(rng() * legal.length).floor()];
          if (legal.isEmpty) rng(); // Math.floor(random() * 0) still consumed one value
          final next = move == null ? null : moveParking(level, state, move);
          if (next != null) state = next;
          expect(move?.toJson(), step['move']);
          expect(state.toJson(), step['state']);
          expect(parkingStateKey(state), step['key']);
        }
        expect(solveParking(level, state).toJson(), item['solveWalk'], reason: 'walk ${item['n']}');
        for (final rawBogus in asList(item['bogus'])) {
          final bogus = asMap(rawBogus);
          expect(moveParking(level, initialParkingState(level), ParkingMove.fromJson(bogus['move']))?.toJson(), bogus['value']);
        }
      }
    });

    test('cells, results and saved-round validation', () {
      for (final raw in asList(data['cells'])) {
        final item = asMap(raw);
        expect(parkingCells(ParkingCar.fromJson(asMap(item['car'])), item['position'] as int), item['value']);
      }
      for (final raw in asList(data['results'])) {
        final item = asMap(raw);
        final result = parkingResult(parkingLevel(item['n'] as int), {...createParkingRound(item['n'] as int), 'moves': item['moves'], 'hints': item['hints']});
        expect({'stars': result.stars, 'score': result.score}, item['value']);
      }
      for (final raw in asList(data['rounds'])) {
        final item = asMap(raw);
        expect(validRound(item['round']), item['valid'], reason: jsonStringify(item['round']));
      }
    });

    test('casual profiles for Clear the Way and Leaf Flight parse and re-serialise byte-for-byte', () {
      final casual = asMap(loadFixture('casual'));
      for (final raw in asList(casual['storage'])) {
        final item = asMap(raw);
        store.clear();
        final parking = item['game'] == 'parking';
        if (item['raw'] != null) store.setItem(item['key'] as String, item['raw'] as String);
        final profile = parking
            ? readCasualProfile(store, parkingId, parkingRevision, parkingLevels, validRound)
            : readCasualProfile(store, leafFlightId, leafFlightRevision, leafFlightLevels, validSavedFlightRound);
        expect(jsonStringify(profile.json), jsonStringify(item['profile']), reason: item['name'] as String);
        writeCasualProfile(store, profile);
        expect(store.getItem(item['key'] as String), item['rewritten'], reason: item['name'] as String);
      }
      var parking = readCasualProfile(store..clear(), parkingId, parkingRevision, parkingLevels, validRound);
      parking = recordCasualWin(parking, 1, 40, (stars: 3, score: 1000));
      parking = recordCasualWin(parking, 2, 40, (stars: 1, score: 400));
      parking = recordCasualWin(parking, 1, 40, (stars: 2, score: 1200));
      parking = recordCasualWin(parking, 40, 40, (stars: 2, score: 900));
      expect(jsonStringify(parking.json), jsonStringify(casual['parking']));
      final messages = CasualMessages.parse(loadAssetText('assets/games/casual/messages.json'), loadAssetText('assets/games/iki_dost/messages.json'));
      for (final raw in asList(casual['text'])) {
        final item = asMap(raw);
        expect(messages.text(item['language'] as String, item['key'] as String, {'count': 5, 'level': 3}), item['value']);
      }
    });
  });

  group('clear-the-way sliding cars', () {
    test('rejects passing through blockers and permits only legal axis positions', () {
      final initial = initialParkingState(fixtureLevel);
      expect(moveParking(fixtureLevel, initial, const ParkingMove(0, 4)), isNull);
      expect(moveParking(fixtureLevel, initial, const ParkingMove(1, 4)), isNull);
      final next = moveParking(fixtureLevel, initial, const ParkingMove(1, 3))!;
      expect(parkingSolved(moveParking(fixtureLevel, next, const ParkingMove(0, 6))!), isTrue);
    });

    test('keeps a locked exit closed until the marked car finishes in its key bay', () {
      final level = withKeyBay(fixtureLevel, (car: 1, position: 3)), initial = initialParkingState(level);
      expect(initial.open, isFalse);
      final open = moveParking(level, initial, const ParkingMove(1, 3))!;
      expect(open.open, isTrue);
      expect(moveParking(level, open, const ParkingMove(1, 2))!.open, isTrue);
      expect(moveParking(level, ParkingState(open.positions, false), const ParkingMove(0, 6)), isNull);
    });

    test('matches optimized legal move enumeration to collision checks for every catalog state', () {
      for (var n = 1; n <= 40; n++) {
        final level = parkingLevel(n);
        var state = initialParkingState(level);
        for (final move in level.solution) {
          expect(parkingMoves(level, state), contains(move));
          for (final candidate in parkingMoves(level, state)) {
            expect(moveParking(level, state, candidate), isNotNull);
          }
          state = moveParking(level, state, move)!;
          expect(() => parkingOccupancy(level, state), returnsNormally);
        }
        expect(parkingSolved(state), isTrue);
      }
    });

    test('verifies every stored solution is shortest, including locked-exit levels', () {
      for (var n = 1; n <= 40; n++) {
        final level = parkingLevel(n), solved = solveParking(level);
        expect(solved.path?.length, level.par, reason: 'level $n');
        expect(solved.exhausted, isFalse);
        expect(parkingSolved(replayParking(level, level.solution)), isTrue);
      }
    });
  });

  group('offline casual game profiles', () {
    test('preserves aggregate results when a malformed round cannot be replayed', () {
      var profile = readCasualProfile(store, parkingId, parkingRevision, parkingLevels, validRound);
      profile = recordCasualWin(profile, 1, 40, (stars: 3, score: 1000)).withRound(createParkingRound(2));
      expect(writeCasualProfile(store, profile), isTrue);
      expect(jsonEquals(readCasualProfile(store, parkingId, parkingRevision, 40, validRound).json, profile.json), isTrue);
      store.setItem(casualStorageKey(parkingId, parkingRevision), jsonStringify({...profile.json, 'round': {...asMap(profile.round), 'path': [{'car': 90, 'to': 6}], 'moves': 1}}));
      final recovered = readCasualProfile(store, parkingId, parkingRevision, 40, validRound);
      expect(recovered.round, isNull);
      expect(jsonEquals(recovered.levels, profile.levels), isTrue);
    });

    test('blocks future saved levels and keeps game/revision namespaces independent', () {
      final profile = readCasualProfile(store, parkingId, parkingRevision, 40, validRound);
      writeCasualProfile(store, profile.withRound(createParkingRound(40)));
      expect(readCasualProfile(store, parkingId, parkingRevision, 40, validRound).round, isNull);
      expect(casualStorageKey(parkingId, parkingRevision), isNot(casualStorageKey('leaf-flight', 'flight-202610-v1')));
    });

    test('bundles matching complete copy for both games in all 21 UI languages', () {
      final messages = CasualMessages.parse(loadAssetText('assets/games/casual/messages.json'), loadAssetText('assets/games/iki_dost/messages.json'));
      final languages = messages.catalog.languages;
      expect(languages.keys.toList()..sort(), List.of(gameAppLanguageCodes)..sort());
      final az = languages['az']!, pattern = RegExp(r'\{\w+\}');
      for (final language in gameAppLanguageCodes) {
        for (final key in az.keys) {
          final copy = languages[language]![key]!;
          expect(copy.trim(), isNot(''));
          expect([for (final m in pattern.allMatches(copy)) m.group(0)], [for (final m in pattern.allMatches(az[key]!)) m.group(0)]);
          expect(messages.text(language, key, {'count': 5}), isNot(matches(pattern)));
        }
      }
    });
  });
}
