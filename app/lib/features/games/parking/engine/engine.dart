// Ported from: src/components/games/parking/model.ts, src/components/games/parking/engine.ts,
// src/components/games/parking/levels.ts, src/components/games/parking/state.ts,
// src/components/games/parking/parking.worker.ts, src/components/games/parking/hints.ts
library;

import 'dart:convert';
import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/engine/json_object.dart';

const String parkingId = 'clear-the-way';
const String parkingRevision = 'parking-202610-v1';
const int parkingLevels = 40;
const int parkingSize = 6;

class ParkingCar {
  const ParkingCar(this.id, this.axis, this.lane, this.length, this.color);
  final String id;

  /// 'h' | 'v'
  final String axis;
  final int lane;
  final int length;
  final int color;
  Map<String, Object?> toJson() => {'id': id, 'axis': axis, 'lane': lane, 'length': length, 'color': color};
  static ParkingCar fromJson(Map<String, Object?> json) => ParkingCar(json['id'] as String, json['axis'] as String,
      (json['lane'] as num).toInt(), (json['length'] as num).toInt(), (json['color'] as num).toInt());
}

class ParkingMove {
  const ParkingMove(this.car, this.to);
  final int car;
  final num to;
  Map<String, Object?> toJson() => {'car': car, 'to': to};
  static ParkingMove fromJson(Object? json) => ParkingMove(((json as Map)['car'] as num).toInt(), json['to'] as num);
  @override
  bool operator ==(Object other) => other is ParkingMove && other.car == car && other.to == to;
  @override
  int get hashCode => Object.hash(car, to);
}

class ParkingLevel {
  ParkingLevel({
    required this.revision,
    required this.level,
    required this.chapter,
    required this.cars,
    required this.positions,
    required this.keyBay,
    required this.par,
    required this.solution,
  });
  final String revision;
  final int level;
  final int chapter;
  final List<ParkingCar> cars;
  final List<int> positions;
  final ({int car, int position})? keyBay;
  final int par;
  final List<ParkingMove> solution;

  Map<String, Object?> toJson() => {
        'schema': 'anacan-parking-level-v1', 'revision': revision, 'level': level, 'chapter': chapter,
        'cars': [for (final car in cars) car.toJson()], 'positions': positions,
        'keyBay': keyBay == null ? null : {'car': keyBay!.car, 'position': keyBay!.position}, 'par': par,
        'solution': [for (final move in solution) move.toJson()],
      };

  static ParkingLevel fromJson(Map<String, Object?> json) {
    final keyBay = json['keyBay'] as Map?;
    return ParkingLevel(
      revision: json['revision'] as String,
      level: (json['level'] as num).toInt(),
      chapter: (json['chapter'] as num).toInt(),
      cars: [for (final car in json['cars'] as List) ParkingCar.fromJson((car as Map).cast())],
      positions: [for (final p in json['positions'] as List) (p as num).toInt()],
      keyBay: keyBay == null ? null : (car: (keyBay['car'] as num).toInt(), position: (keyBay['position'] as num).toInt()),
      par: (json['par'] as num).toInt(),
      solution: [for (final move in json['solution'] as List) ParkingMove.fromJson(move)],
    );
  }
}

class ParkingCatalog {
  ParkingCatalog(this.revision, this.levels);
  final String revision;
  final List<ParkingLevel> levels;
  static ParkingCatalog parse(String text) {
    final json = (jsonDecode(text) as Map).cast<String, Object?>();
    return ParkingCatalog(json['revision'] as String, [for (final level in json['levels'] as List) ParkingLevel.fromJson((level as Map).cast())]);
  }

  /// `parkingLevel(level)`.
  ParkingLevel level(int level) {
    if (level < 1 || level > parkingLevels || revision != parkingRevision) throw const GameError('PARKING_LEVEL_INVALID');
    return levels[level - 1];
  }
}

class ParkingState {
  const ParkingState(this.positions, this.open);
  final List<int> positions;
  final bool open;
  Map<String, Object?> toJson() => {'positions': positions, 'open': open};
  static ParkingState fromJson(Map<String, Object?> json) =>
      ParkingState([for (final p in json['positions'] as List) (p as num).toInt()], json['open'] as bool);
}

List<int> parkingCells(ParkingCar car, int position) => [
      for (var index = 0; index < car.length; index++)
        car.axis == 'h' ? car.lane * parkingSize + position + index : (position + index) * parkingSize + car.lane,
    ];

ParkingState initialParkingState(ParkingLevel level) => ParkingState(
    List.of(level.positions), level.keyBay == null || level.positions[level.keyBay!.car] == level.keyBay!.position);

bool parkingSolved(ParkingState state) => state.positions[0] == parkingSize;

List<int> parkingOccupancy(ParkingLevel level, ParkingState state) {
  final board = List<int>.filled(36, -1);
  for (var index = 0; index < level.cars.length; index++) {
    if (index == 0 && state.positions[index] == 6) continue;
    for (final cell in parkingCells(level.cars[index], state.positions[index])) {
      if (cell < 0 || cell >= 36 || board[cell] != -1) throw const GameError('PARKING_OVERLAPPING_CARS');
      board[cell] = index;
    }
  }
  return board;
}

bool _opens(ParkingLevel level, ParkingState state, int car, num to) =>
    state.open || (level.keyBay != null && car == level.keyBay!.car && to == level.keyBay!.position);

ParkingState? moveParking(ParkingLevel level, ParkingState state, ParkingMove move) {
  if (move.car < 0 || move.car >= level.cars.length) return null;
  final car = level.cars[move.car], from = state.positions[move.car];
  if (!isJsInteger(move.to) || move.to == from || parkingSolved(state)) return null;
  final to = move.to.toInt();
  final exit = move.car == 0 && to == 6;
  if (to < 0 || (to > 6 - car.length && !exit) || (exit && !state.open)) return null;
  final board = parkingOccupancy(level, state), sign = to > from ? 1 : -1;
  for (var position = from + sign; sign > 0 ? position <= to : position >= to; position += sign) {
    for (final cell in parkingCells(car, position)) {
      if (exit && car.axis == 'h' && cell >= car.lane * 6 + 6) continue;
      if (board[cell] != -1 && board[cell] != move.car) return null;
    }
  }
  final positions = List.of(state.positions);
  positions[move.car] = to;
  return ParkingState(positions, _opens(level, state, move.car, to));
}

List<ParkingMove> parkingMoves(ParkingLevel level, ParkingState state) {
  if (parkingSolved(state)) return [];
  final moves = <ParkingMove>[];
  final board = parkingOccupancy(level, state);
  for (var index = 0; index < level.cars.length; index++) {
    final car = level.cars[index], from = state.positions[index];
    int cell(int position) => car.axis == 'h' ? car.lane * 6 + position : position * 6 + car.lane;
    for (var to = from - 1; to >= 0 && board[cell(to)] == -1; to--) {
      moves.add(ParkingMove(index, to));
    }
    for (var to = from + 1; to <= 6 - car.length && board[cell(to + car.length - 1)] == -1; to++) {
      moves.add(ParkingMove(index, to));
    }
  }
  final first = level.cars[0];
  final free = [
    for (var i = 0; i < math.max(0, 6 - state.positions[0] - first.length); i++) first.lane * 6 + state.positions[0] + first.length + i,
  ].every((cell) => board[cell] == -1);
  if (state.open && free) moves.insert(0, const ParkingMove(0, 6));
  return moves;
}

String parkingStateKey(ParkingState state) => '${state.positions.join()}:${state.open ? 1 : 0}';

ParkingState replayParking(ParkingLevel level, List<ParkingMove> path) {
  var state = initialParkingState(level);
  for (final move in path) {
    final next = moveParking(level, state, move);
    if (next == null) throw const GameError('PARKING_SAVED_MOVE_INVALID');
    state = next;
  }
  return state;
}

class ParkingSolution {
  const ParkingSolution(this.path, this.visited, this.exhausted);
  final List<ParkingMove>? path;
  final int visited;
  final bool exhausted;
  Map<String, Object?> toJson() =>
      {'path': path == null ? null : [for (final move in path!) move.toJson()], 'visited': visited, 'exhausted': exhausted};
}

ParkingSolution solveParking(ParkingLevel level, [ParkingState? start, int budget = 65000]) {
  start ??= initialParkingState(level);
  if (parkingSolved(start)) return const ParkingSolution([], 1, false);
  final queue = [start];
  final seen = <String, ({String? previous, ParkingMove? move})>{parkingStateKey(start): (previous: null, move: null)};
  for (var index = 0; index < queue.length; index++) {
    final state = queue[index], key = parkingStateKey(state);
    for (final move in parkingMoves(level, state)) {
      final positions = List.of(state.positions);
      positions[move.car] = move.to.toInt();
      final next = ParkingState(positions, _opens(level, state, move.car, move.to));
      final nextKey = parkingStateKey(next);
      if (seen.containsKey(nextKey)) continue;
      seen[nextKey] = (previous: key, move: move);
      if (parkingSolved(next)) {
        final path = <ParkingMove>[];
        var current = nextKey;
        while (seen[current]!.previous != null) {
          final record = seen[current]!;
          path.add(record.move!);
          current = record.previous!;
        }
        return ParkingSolution(path.reversed.toList(), seen.length, false);
      }
      if (seen.length >= budget) return ParkingSolution(null, seen.length, true);
      queue.add(next);
    }
  }
  return ParkingSolution(null, seen.length, false);
}

/// Hint worker entry point (`parking.worker.ts`) for `Isolate.run`: the first move or null.
Map<String, Object?>? parkingHintJob(({Map<String, Object?> level, Map<String, Object?> state}) request) {
  final path = solveParking(ParkingLevel.fromJson(request.level), ParkingState.fromJson(request.state)).path;
  return path == null || path.isEmpty ? null : path.first.toJson();
}

// --- state.ts --------------------------------------------------------------------------------

JsonMap createParkingRound(int level) =>
    {'schema': 'anacan-parking-round-v1', 'level': level, 'path': <Object?>[], 'moves': 0, 'hints': 0, 'undos': 0};

/// `validParkingRound` on decoded JSON (replays the saved path against the catalog).
bool validParkingRound(Object? value, ParkingCatalog catalog) {
  if (value is! Map) return false;
  try {
    final counts = [value['moves'], value['hints'], value['undos']];
    final path = value['path'];
    if (value['schema'] != 'anacan-parking-round-v1' || !counts.every((n) => isSafeInteger(n) && (n as num) >= 0) ||
        (value['hints'] as num) > 3 || path is! List || path.length > 240 || (value['moves'] as num) < path.length ||
        !path.every((move) => move is Map && isJsInteger(move['car']) && isJsInteger(move['to']))) {
      return false;
    }
    final level = value['level'];
    if (!isSafeInteger(level)) return false;
    replayParking(catalog.level((level as num).toInt()), [for (final move in path) ParkingMove.fromJson(move)]);
    return true;
  } catch (_) {
    return false;
  }
}

({int stars, int score}) parkingResult(ParkingLevel level, JsonMap round) {
  final moves = round['moves'] as num, hints = round['hints'] as num;
  final stars = moves <= level.par && hints == 0
      ? 3
      : moves <= level.par + 5 && hints <= 1
          ? 2
          : 1;
  return (
    stars: stars,
    score: math.max(100, 600 + level.chapter * 100 + stars * 150 - math.max(0, moves - level.par) * 20 - hints * 30).toInt(),
  );
}
