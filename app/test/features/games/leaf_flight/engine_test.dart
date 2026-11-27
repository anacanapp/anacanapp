// Ported from: src/components/games/leaf-flight/engine.test.ts (+ fixtures from app/tool/games/entries/leaf-flight.ts)
import 'dart:math' as math;

import 'package:anacan/features/games/common/engine/fdlibm.dart';
import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/leaf_flight/engine/engine.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

void main() {
  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('leaf_flight'));

    test('Math.sin / Math.cos: fdlibm port equals V8 bit-for-bit', () {
      var platformMismatches = 0;
      for (final raw in asList(data['sin'])) {
        final row = asList(raw), x = (row[0] as num).toDouble();
        expect(jsSin(x), row[1], reason: 'sin($x)');
        expect(jsCos(x), row[2], reason: 'cos($x)');
        if (math.sin(x) != row[1] || math.cos(x) != row[2]) platformMismatches++;
      }
      // Informational: how often the platform libm would have differed from V8.
      printOnFailure('dart:math sin/cos mismatches vs V8: $platformMismatches');
    });

    test('all 30 generated levels equal the TypeScript generator', () {
      final levels = asList(data['levels']);
      for (var i = 0; i < 30; i++) {
        expect(jsonStringify(flightLevel(i + 1).toJson()), jsonStringify(levels[i]), reason: 'level ${i + 1}');
      }
      for (final raw in asList(data['winds'])) {
        final item = asMap(raw), level = flightLevel(item['level'] as int);
        expect([for (final x in [0, 500, 800, 1000, 1500, 2000, 2400, 3000]) flightWind(level, x.toDouble())], item['values']);
      }
    });

    test('autopilot hold/release play-throughs match step for step', () {
      for (final raw in asList(data['autopilot'])) {
        final item = asMap(raw), level = flightLevel(item['level'] as int);
        var state = createFlightState(level.level);
        var steps = 0;
        final samples = asList(item['samples']);
        var sample = 0;
        while (!state.won && !state.lost && state.time < 110) {
          FlightGate? next;
          for (final gate in level.gates) {
            if (gate.x + gate.width + 50 > state.distance + 100) {
              next = gate;
              break;
            }
          }
          final target = next != null ? flightGateGaps(next, state.time)[0].center : 360;
          state = stepFlight(level, state, state.y + state.velocity * .35 > target);
          if (++steps % 97 == 0) expect(jsonStringify(state.json), jsonStringify(samples[sample++]), reason: 'level ${level.level} step $steps');
        }
        expect(steps, item['steps']);
        expect(jsonStringify(state.json), jsonStringify(item['final']), reason: 'final ${level.level}');
        final result = flightResult(level, state);
        expect({'stars': result.stars, 'score': result.score, 'collected': result.collected}, item['result']);
        expect(validFlightState(state.json, level), item['valid']);
      }
    });

    test('erratic frame times through the bounded accumulator match', () {
      for (final raw in asList(data['erratic'])) {
        final item = asMap(raw), n = item['level'] as int, level = flightLevel(n);
        final rng = mulberry32(n * 31);
        var state = createFlightState(n);
        var carry = 0.0, frames = 0, lifting = false, sample = 0;
        final samples = asList(item['samples']);
        while (!state.won && !state.lost && frames < 3000) {
          if (rng() < 0.08) lifting = !lifting;
          final elapsed = [1 / 60, 1 / 30, 1 / 120, 0.2, 0.0, 0.0161][(rng() * 6).floor()];
          final result = advanceFlight(level, state, lifting, elapsed, carry);
          state = result.state;
          carry = result.carry;
          frames++;
          if (frames % 50 == 0) {
            final expected = asMap(samples[sample++]);
            expect(carry, expected['carry']);
            expect(jsonStringify(state.json), jsonStringify(expected['state']), reason: 'level $n frame $frames');
          }
        }
        expect([frames, carry], [item['frames'], item['carry']]);
        expect(jsonStringify(state.json), jsonStringify(item['final']));
        final result = flightResult(level, state);
        expect({'stars': result.stars, 'score': result.score, 'collected': result.collected}, item['result']);
        expect(validFlightState(state.json, level), item['valid']);
      }
      expect(jsonStringify(advanceFlight(flightLevel(1), createFlightState(1), true, 1 / 60 * 3).state.json), jsonStringify(asMap(data['stepped'])['state']));
    });

    test('saved-round validation', () {
      for (final raw in asList(data['validity'])) {
        final item = asMap(raw);
        expect(validFlightState(item['state'], flightLevel(4)), item['valid'], reason: jsonStringify(item['state']));
      }
    });
  });

  group('leaf parachute flight', () {
    test('rises while held, descends when released and processes the same fixed steps at different frame rates', () {
      final level = flightLevel(1), initial = createFlightState(1);
      var up = initial, down = initial;
      for (var i = 0; i < 45; i++) {
        up = stepFlight(level, up, true);
        down = stepFlight(level, down, false);
      }
      expect(up.y, lessThan(initial.y));
      expect(down.y, greaterThan(initial.y));
      expect(jsonEquals(advanceFlight(level, initial, true, flightStep * 3).state.json,
          stepFlight(level, stepFlight(level, stepFlight(level, initial, true), true), true).json), isTrue);
      expect(advanceFlight(level, initial, true, 600).state.distance, lessThan(level.speed * .13));
    });

    test('handles collision shields and collects each star only once', () {
      final level = flightLevel(1), gate = level.gates[0];
      final state = createFlightState(1).copyWith({'shield': 0, 'time': (gate.x - 100) / level.speed, 'distance': gate.x - 100, 'y': 50});
      final hit = stepFlight(level, state, false);
      expect(hit.hearts, 2);
      expect(stepFlight(level, hit, false).hearts, 2);
      final star = level.stars[0];
      final near = createFlightState(1).copyWith({'distance': star.x - 100, 'time': (star.x - 100) / level.speed, 'y': star.y});
      final collected = stepFlight(level, near, false);
      expect(collected.collected, [star.id]);
      expect(stepFlight(level, collected, false).collected, [star.id]);
    });

    test('makes every level safely completable with responsive hold/release control', () {
      for (var n = 1; n <= 30; n++) {
        final level = flightLevel(n);
        var state = createFlightState(n);
        while (!state.won && !state.lost && state.time < 110) {
          final next = level.gates.where((gate) => gate.x + gate.width + 50 > state.distance + 100).firstOrNull;
          final target = next != null ? flightGateGaps(next, state.time)[0].center : 360;
          state = stepFlight(level, state, state.y + state.velocity * .35 > target);
        }
        expect(state.won, isTrue, reason: 'level $n');
        expect(state.hearts, greaterThan(0), reason: 'level $n');
        expect(validFlightState(state.json, level), isTrue);
      }
    });

    test('adds wind, narrower gaps, moving branches and real alternative secret gaps by chapter', () {
      expect(flightLevel(1).winds, isEmpty);
      expect(flightLevel(7).winds, isNotEmpty);
      expect(flightLevel(13).gates[0].gap.height, lessThan(flightLevel(1).gates[0].gap.height));
      expect(flightLevel(19).gates.any((gate) => gate.motion > 0), isTrue);
      expect(flightLevel(25).gates.any((gate) => flightGateGaps(gate, 0).length == 2), isTrue);
      expect(validFlightState({...createFlightState(1).json, 'collected': [9000]}, flightLevel(1)), isFalse);
    });
  });
}
