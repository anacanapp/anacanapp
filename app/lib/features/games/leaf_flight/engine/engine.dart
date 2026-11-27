// Ported from: src/components/games/leaf-flight/model.ts, src/components/games/leaf-flight/engine.ts,
// src/components/games/leaf-flight/LeafFlight.tsx (validSavedRound)
//
// Fixed 60 Hz physics: `stepFlight` is the only integrator; `advanceFlight` is the bounded frame
// accumulator (≤ 0.12 s and ≤ 8 steps per frame, so background time never turns into damage).
// `Math.sin` goes through the fdlibm port so gate motion is bit-identical to V8.
library;

import 'dart:math' as math;

import '../../common/engine/fdlibm.dart';
import '../../common/engine/js.dart';
import '../../common/engine/json_object.dart';

const String leafFlightId = 'leaf-flight';
const String leafFlightRevision = 'flight-202610-v1';
const int leafFlightLevels = 30;
const double flightHeight = 720;
const double flightPlayerX = 100;
const double flightStep = 1 / 60;

class FlightGap {
  const FlightGap(this.center, this.height);
  final double center;
  final double height;
  Map<String, Object?> toJson() => {'center': center, 'height': height};
}

class FlightGate {
  const FlightGate(this.x, this.width, this.gap, this.motion, this.phase, this.secret);
  final double x;
  final double width;
  final FlightGap gap;
  final double motion;
  final double phase;
  final FlightGap? secret;
  Map<String, Object?> toJson() =>
      {'x': x, 'width': width, 'gap': gap.toJson(), 'motion': motion, 'phase': phase, 'secret': secret?.toJson()};
}

class FlightStar {
  const FlightStar(this.id, this.x, this.y, this.secret);
  final int id;
  final double x;
  final double y;
  final bool secret;
  Map<String, Object?> toJson() => {'id': id, 'x': x, 'y': y, 'secret': secret};
}

class FlightWind {
  const FlightWind(this.from, this.to, this.force);
  final double from;
  final double to;
  final double force;
  Map<String, Object?> toJson() => {'from': from, 'to': to, 'force': force};
}

class FlightLevel {
  const FlightLevel(this.level, this.chapter, this.speed, this.distance, this.gates, this.stars, this.winds);
  final int level;
  final int chapter;
  final double speed;
  final double distance;
  final List<FlightGate> gates;
  final List<FlightStar> stars;
  final List<FlightWind> winds;
  Map<String, Object?> toJson() => {
        'schema': 'anacan-leaf-flight-level-v1', 'revision': leafFlightRevision, 'level': level, 'chapter': chapter, 'speed': speed,
        'distance': distance, 'gates': [for (final g in gates) g.toJson()], 'stars': [for (final s in stars) s.toJson()],
        'winds': [for (final w in winds) w.toJson()],
      };
}

FlightLevel flightLevel(int level) {
  if (level < 1 || level > leafFlightLevels) throw const GameError('LEAF_FLIGHT_LEVEL_INVALID');
  final rng = Mulberry32(level * 7351 + 91657);
  final chapter = (level / 6).ceil();
  final speed = (122 + (chapter - 1) * 9 + level % 6).toDouble();
  final count = 6 + chapter;
  final gates = <FlightGate>[];
  for (var index = 0; index < count; index++) {
    final center = 260 + rng() * 180;
    final height = (320 - (chapter - 1) * 24).toDouble();
    final secret = chapter >= 5 && index % 3 == 1 ? FlightGap(center < 350 ? 616 : 100, 116) : null;
    gates.add(FlightGate((650 + index * 425).toDouble(), (58 + chapter * 4).toDouble(), FlightGap(center, height),
        chapter >= 4 && index % 2 == 1 ? (18 + chapter * 4).toDouble() : 0, rng() * math.pi * 2, secret));
  }
  final stars = <FlightStar>[];
  for (var index = 0; index < gates.length; index++) {
    final gate = gates[index];
    stars.add(FlightStar(stars.length, gate.x - 145, gate.gap.center, false));
    stars.add(FlightStar(stars.length, gate.x + gate.width / 2, gate.gap.center, false));
    if (gate.secret != null) stars.add(FlightStar(stars.length, gate.x + gate.width / 2, gate.secret!.center, true));
    if (index == gates.length - 1) stars.add(FlightStar(stars.length, gate.x + 210, 360, false));
  }
  final winds = <FlightWind>[];
  if (chapter >= 2) {
    final windy = [for (var index = 0; index < gates.length; index++) if (index % 3 == 1) gates[index]];
    for (var index = 0; index < windy.length; index++) {
      winds.add(FlightWind(windy[index].x - 280, windy[index].x + 110, ((index % 2 != 0 ? 1 : -1) * (35 + chapter * 9)).toDouble()));
    }
  }
  return FlightLevel(level, chapter, speed, gates.last.x + 480, gates, stars, winds);
}

/// A round state (`anacan-leaf-flight-round-v1`), kept as an ordered JSON map so saves round-trip.
extension type FlightState(JsonMap json) {
  int get level => (json['level'] as num).toInt();
  double get time => (json['time'] as num).toDouble();
  double get distance => (json['distance'] as num).toDouble();
  double get y => (json['y'] as num).toDouble();
  double get velocity => (json['velocity'] as num).toDouble();
  int get hearts => (json['hearts'] as num).toInt();
  double get shield => (json['shield'] as num).toDouble();
  List<int> get collected => [for (final id in json['collected'] as List) (id as num).toInt()];
  bool get won => json['won'] == true;
  bool get lost => json['lost'] == true;
  FlightState copyWith(JsonMap changes) => FlightState({...json, ...changes});
}

FlightState createFlightState(int level) => FlightState({
      'schema': 'anacan-leaf-flight-round-v1', 'level': level, 'time': 0, 'distance': 0, 'y': 360, 'velocity': 0, 'hearts': 3, 'shield': 1,
      'collected': <Object?>[], 'won': false, 'lost': false,
    });

List<FlightGap> flightGateGaps(FlightGate gate, double time) {
  final center = gate.gap.center + jsSin(time * .85 + gate.phase) * gate.motion;
  return [FlightGap(center, gate.gap.height), if (gate.secret != null) gate.secret!];
}

double flightWind(FlightLevel level, double x) {
  num force = 0;
  for (final wind in level.winds) {
    if (x >= wind.from && x <= wind.to) force = force + wind.force;
  }
  return force.toDouble();
}

FlightState stepFlight(FlightLevel level, FlightState state, bool lifting) {
  if (state.won || state.lost) return state;
  final time = state.time + flightStep, distance = state.distance + level.speed * flightStep;
  final x = distance + flightPlayerX, wind = flightWind(level, x);
  var velocity = math.max(-210.0, math.min(220.0, state.velocity + ((lifting ? -390 : 260) + wind - state.velocity * 1.5) * flightStep));
  var y = state.y + velocity * flightStep;
  var hearts = state.hearts;
  var shield = math.max(0.0, state.shield - flightStep);
  var collision = y < 38 || y > flightHeight - 32;
  for (final gate in level.gates) {
    if (x + 12 < gate.x || x - 12 > gate.x + gate.width) continue;
    if (!flightGateGaps(gate, time).any((gap) => y - 12 >= gap.center - gap.height / 2 && y + 12 <= gap.center + gap.height / 2)) {
      collision = true;
    }
  }
  if (collision && shield == 0) {
    hearts--;
    shield = 1.25;
    velocity *= -.35;
  }
  y = math.max(39.0, math.min(flightHeight - 33, y));
  final collected = state.collected;
  for (final star in level.stars) {
    if (!collected.contains(star.id) && (star.x - x).abs() <= 22 && (star.y - y).abs() <= 30) collected.add(star.id);
  }
  return state.copyWith({
    'time': time, 'distance': distance, 'velocity': velocity, 'y': y, 'hearts': hearts, 'shield': shield, 'collected': collected,
    'lost': hearts <= 0, 'won': hearts > 0 && distance >= level.distance,
  });
}

bool validFlightState(Object? value, FlightLevel level) {
  if (value is! Map) return false;
  final s = value.cast<String, Object?>();
  final numbers = [s['time'], s['distance'], s['y'], s['velocity'], s['shield']];
  if (s['schema'] != 'anacan-leaf-flight-round-v1' || s['level'] != level.level || !numbers.every(isJsFinite)) return false;
  final time = (s['time'] as num).toDouble(), distance = (s['distance'] as num).toDouble(), y = (s['y'] as num).toDouble();
  final velocity = (s['velocity'] as num).toDouble(), shield = (s['shield'] as num).toDouble();
  final hearts = s['hearts'], won = s['won'], lost = s['lost'], collected = s['collected'];
  return time >= 0 && time <= 120 && distance >= 0 && distance <= level.distance + 5 && (distance - time * level.speed).abs() < 1 &&
      y >= 38 && y <= flightHeight - 32 && velocity.abs() <= 220 && isJsInteger(hearts) && (hearts as num) >= 0 && hearts <= 3 &&
      shield >= 0 && shield <= 1.3 && won is bool && lost is bool &&
      (!won || (distance >= level.distance && hearts > 0)) && (lost == (hearts == 0)) &&
      collected is List && collected.length <= level.stars.length && collected.toSet().length == collected.length &&
      collected.every((id) => isJsInteger(id) && level.stars.any((star) => star.id == id));
}

/// `validSavedRound` of LeafFlight.tsx: validates against the round's own level.
bool validSavedFlightRound(Object? value) {
  try {
    final level = value is Map ? value['level'] : null;
    if (!isSafeInteger(level)) return false;
    return validFlightState(value, flightLevel((level as num).toInt()));
  } catch (_) {
    return false;
  }
}

({int stars, int score, int collected}) flightResult(FlightLevel level, FlightState state) {
  final main = level.stars.where((star) => !star.secret).toList();
  final collected = state.collected;
  final found = main.where((star) => collected.contains(star.id)).length;
  final stars = found >= (main.length * .8).ceil() && state.hearts >= 2
      ? 3
      : found >= (main.length * .45).ceil()
          ? 2
          : 1;
  return (stars: stars, score: collected.length * 100 + state.hearts * 150 + level.chapter * 100, collected: collected.length);
}

/// Bounded frame accumulator: long frames never turn background time into damage.
({FlightState state, double carry}) advanceFlight(FlightLevel level, FlightState state, bool lifting, double elapsed, [double carry = 0]) {
  var remaining = carry + math.max(0.0, math.min(.12, elapsed));
  var steps = 0;
  var next = state;
  while (remaining >= flightStep && steps < 8 && !next.won && !next.lost) {
    next = stepFlight(level, next, lifting);
    remaining -= flightStep;
    steps++;
  }
  return (state: next, carry: math.min(flightStep, remaining));
}
