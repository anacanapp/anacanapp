// Ported from: src/components/games/color-sort/session.ts (round state; storage half lives in
// ../persistence/storage.dart)
//
// The session is an ordered JSON map (`{tubes, revealed, moves, bonusMoves, hints, extraTubes, undos,
// history}`, units `{color, id}`) so a saved round round-trips byte-for-byte with the React app.
library;

import '../../common/engine/js.dart';
import '../../common/engine/json_object.dart';
import 'difficulty.dart';
import 'engine.dart';
import 'generator.dart';

const int maxHints = 3;
const int maxExtraTubes = 1;

typedef Unit = JsonMap; // {color, id}
typedef Tubes = List<List<Unit>>;

extension type ColorSortSession(JsonMap json) {
  Tubes get tubes => _tubes(json['tubes']);
  List<int> get revealed => [for (final id in json['revealed'] as List) (id as num).toInt()];
  int get moves => (json['moves'] as num).toInt();
  int get bonusMoves => (json['bonusMoves'] as num).toInt();
  int get hints => (json['hints'] as num).toInt();
  int get extraTubes => (json['extraTubes'] as num).toInt();
  int get undos => (json['undos'] as num).toInt();
  List<JsonMap> get history => [for (final item in json['history'] as List) asMap(item)];
  ColorSortSession copyWith(JsonMap changes) => ColorSortSession({...json, ...changes});
}

Tubes _tubes(Object? raw) => [for (final tube in raw as List) [for (final unit in tube as List) asMap(unit)]];

Board boardOf(ColorSortSession session) => boardOfTubes(session.tubes);
Board boardOfTubes(Tubes tubes) => [for (final tube in tubes) [for (final unit in tube) (unit['color'] as num).toInt()]];

List<int> revealSurface(Tubes tubes, List<int> known) {
  final result = <int>{...known};
  for (final tube in tubes) {
    final colors = [for (final unit in tube) (unit['color'] as num).toInt()];
    for (final unit in tube.sublist(tube.length - topRun(colors))) {
      result.add((unit['id'] as num).toInt());
    }
  }
  return result.toList();
}

ColorSortSession createSession(ColorSortLevel definition) {
  var id = 0;
  final Tubes tubes = [for (final tube in definition.board) [for (final color in tube) {'color': color, 'id': id++}]];
  final occupied = [for (var index = 0; index < tubes.length; index++) if (tubes[index].isNotEmpty) index];
  final hidden = shuffled(occupied, seededRandom(xor32(definition.seed, 0x7F4A7C15))).take(definition.hiddenTubes).toSet();
  final revealed = <int>[
    for (var index = 0; index < tubes.length; index++)
      for (var depth = 0; depth < tubes[index].length; depth++)
        if (!hidden.contains(index) || depth >= definition.hiddenDepth) (tubes[index][depth]['id'] as num).toInt(),
  ];
  return ColorSortSession({
    'tubes': tubes, 'revealed': revealSurface(tubes, revealed), 'moves': 0, 'bonusMoves': 0, 'hints': 0, 'extraTubes': 0, 'undos': 0,
    'history': <Object?>[],
  });
}

({ColorSortSession session, int amount, int color})? pourSession(ColorSortSession state, ColorSortLevel definition, Move move) {
  final result = pour(boardOf(state), definition.rules, move);
  if (result == null) return null;
  final previous = state.tubes;
  final tubes = List<List<Unit>>.of(previous);
  final source = tubes[move.from];
  final units = source.sublist(source.length - result.amount);
  tubes[move.from] = source.sublist(0, source.length - result.amount);
  tubes[move.to] = [...tubes[move.to], ...units];
  final history = [...state.history, {'tubes': state.json['tubes'], 'moves': state.moves}];
  final next = state.copyWith({
    'tubes': tubes,
    'moves': state.moves + 1,
    'history': history.length > 50 ? history.sublist(history.length - 50) : history,
    'revealed': revealSurface(tubes, [...state.revealed, for (final unit in units) (unit['id'] as num).toInt()]),
  });
  return (session: next, amount: result.amount, color: result.color);
}

ColorSortSession? undoSession(ColorSortSession state) {
  final history = state.history;
  if (history.isEmpty) return null;
  final last = history.last;
  final lastTubes = _tubes(last['tubes']);
  return state.copyWith({
    'tubes': last['tubes'],
    'moves': last['moves'],
    'undos': state.undos + 1,
    'history': history.sublist(0, history.length - 1),
    'revealed': revealSurface(lastTubes, state.revealed),
  });
}

ColorSortSession? addTube(ColorSortSession state) {
  if (state.extraTubes >= maxExtraTubes) return null;
  return state.copyWith({'tubes': [...state.tubes, <Unit>[]], 'extraTubes': state.extraTubes + 1, 'history': <Object?>[]});
}

int? remainingMoves(ColorSortSession state, ColorSortLevel definition) {
  final limit = definition.moveLimit;
  if (limit == null) return null;
  final left = limit + state.bonusMoves - state.moves;
  return left < 0 ? 0 : left;
}

bool _integer(Object? value, int max) => isJsInteger(value) && (value as num) >= 0 && value <= max;

/// `validSession` on decoded JSON.
bool validSessionJson(Object? value, ColorSortLevel definition) {
  if (value is! Map) return false;
  final state = value.cast<String, Object?>();
  final original = [for (final tube in createSession(definition).tubes) ...tube];
  bool validTubes(Object? tubes) {
    if (tubes is! List || tubes.length < definition.board.length || tubes.length > definition.board.length + maxExtraTubes) return false;
    for (final tube in tubes) {
      if (tube is! List) return false;
      for (final unit in tube) {
        if (unit is! Map || !isJsInteger(unit['id'])) return false;
        final id = (unit['id'] as num).toInt();
        if (id < 0 || id >= original.length || original[id]['color'] != unit['color']) return false;
      }
    }
    final units = [for (final tube in tubes) ...(tube as List)];
    if (units.length != original.length || {for (final unit in units) (unit as Map)['id']}.length != original.length) return false;
    return validateBoard([for (final tube in tubes) [for (final unit in tube as List) (unit as Map)['color']]], definition.colors, definition.rules);
  }

  final moves = state['moves'];
  final revealed = state['revealed'];
  final history = state['history'];
  return validTubes(state['tubes']) && _integer(moves, 10000) && _integer(state['bonusMoves'], 60) && _integer(state['hints'], maxHints) &&
      _integer(state['extraTubes'], maxExtraTubes) && _integer(state['undos'], 10000) &&
      (state['tubes'] as List).length == definition.board.length + (state['extraTubes'] as num) &&
      revealed is List && revealed.length <= original.length && revealed.every((id) => _integer(id, original.length - 1)) &&
      history is List && history.length <= 50 &&
      history.every((snapshot) => snapshot is Map && validTubes(snapshot['tubes']) && _integer(snapshot['moves'], (moves as num).toInt()));
}
