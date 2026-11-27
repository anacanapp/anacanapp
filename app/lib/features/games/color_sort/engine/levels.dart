// Ported from: src/components/games/color-sort/levels.ts (pure parts), src/components/games/color-sort/workerClient.ts
library;

import 'dart:convert';

import '../../common/engine/js.dart';
import '../../common/engine/js_json.dart';
import 'difficulty.dart';
import 'engine.dart';
import 'generator.dart';

/// `BUNDLED_LEVELS`: the 30 authored levels of `catalog.json` (asset `assets/games/color_sort/catalog.json`).
class ColorSortCatalog {
  ColorSortCatalog(this.bundled);
  final List<ColorSortLevel> bundled;

  static ColorSortCatalog parse(String catalogJson) => ColorSortCatalog([
        for (final raw in jsonDecode(catalogJson) as List)
          () {
            final item = (raw as Map).cast<String, Object?>();
            return makeLevel(
              getLevelProfile(item['level'] as num),
              (item['seed'] as num).toInt(),
              [for (final tube in item['board'] as List) [for (final color in tube as List) (color as num).toInt()]],
              [for (final move in item['solution'] as List) moveFromJson(move)!],
            );
          }(),
      ]);

  ColorSortLevel? bundledLevel(int level) {
    for (final item in bundled) {
      if (item.level == level) return item;
    }
    return null;
  }

  /// `getFallbackLevel`.
  ColorSortLevel fallbackLevel(num input) {
    final level = normalizeLevel(input);
    final found = bundledLevel(level);
    if (found != null) return ColorSortLevel.fromJson(found.toJson());
    final templates = bundled.where((item) => item.level >= 28).toList();
    return permuteLevel(templates[(level - 31) % templates.length], level);
  }
}

/// `validateLevel(value, expectedLevel)` on decoded JSON (e.g. a cached level from storage).
bool validateLevelJson(Object? value, int expectedLevel) {
  if (value is! Map) return false;
  final level = value.cast<String, Object?>();
  final profile = getLevelProfile(expectedLevel);
  try {
    final rules = level['rules'];
    if (level['version'] != 1 || level['level'] != profile.level || !isJsInteger(level['seed']) || level['colors'] != profile.colors ||
        level['emptyTubes'] != profile.emptyTubes || level['lockedTubes'] != profile.lockedTubes || level['hiddenTubes'] != profile.hiddenTubes ||
        level['hiddenDepth'] != profile.hiddenDepth || level['difficulty'] != profile.difficulty || level['limitedMoves'] != profile.limitedMoves ||
        rules is! Map || rules['capacity'] != 4 || rules['locks'] is! List || (rules['locks'] as List).length != profile.lockedTubes) {
      return false;
    }
    final locks = rules['locks'] as List;
    if (!locks.every((lock) => lock is Map && isJsInteger(lock['tube']) && isJsInteger(lock['after']))) return false;
    final typedRules = rulesFromJson(rules.cast());
    if (!validateBoard(level['board'], profile.colors, typedRules)) return false;
    final afters = jsDefaultSorted([for (final lock in typedRules.locks) lock.after]);
    final expectedAfters = jsDefaultSorted([for (final lock in rulesForProfile(profile).locks) lock.after]);
    if (jsonStringify(afters) != jsonStringify(expectedAfters)) return false;
    final board = [for (final tube in level['board'] as List) [for (final color in tube as List) (color as num).toInt()]];
    if (board.length != profile.colors + profile.emptyTubes + profile.lockedTubes) return false;
    if (!typedRules.locks.every((lock) => board[lock.tube].isEmpty)) return false;
    final solution = level['solution'];
    if (solution is! List || solution.isEmpty || solution.length > 120) return false;
    if (!solution.every((move) => move is Map && isJsInteger(move['from']) && isJsInteger(move['to']))) return false;
    if (level['parMoves'] != solution.length) return false;
    final moveLimit = level['moveLimit'];
    if (profile.limitedMoves
        ? !(isJsInteger(moveLimit) && (moveLimit as num) >= solution.length && moveLimit <= 240)
        : moveLimit != null || !level.containsKey('moveLimit')) {
      return false;
    }
    return replaySolution(board, typedRules, [for (final move in solution) moveFromJson(move)!]) != null;
  } catch (_) {
    return false;
  }
}

bool validateLevel(ColorSortLevel level, int expectedLevel) => validateLevelJson(level.toJson(), expectedLevel);

bool _sameBoard(Board a, Board b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length != b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) {
      if (a[i][j] != b[i][j]) return false;
    }
  }
  return true;
}

Move? knownSolutionMove(ColorSortLevel definition, Board board) {
  var current = definition.board;
  for (final move in definition.solution) {
    if (_sameBoard(current, board)) return move;
    final result = pour(current, definition.rules, move);
    if (result == null) break;
    current = result.board;
  }
  return null;
}

/// Hint resolution of `requestColorSortHint`: the authored solution when the board is still on it,
/// otherwise the solver's first move (run [colorSortWorkerJob] in an isolate for that part).
Move? immediateColorSortHint(ColorSortLevel definition, Board board) {
  final known = knownSolutionMove(definition, board);
  if (known != null && inspectPour(board, definition.rules, known.from, known.to).amount > 0) return known;
  return null;
}

/// Accepts a worker hint only when it is a legal pour on the current board.
Move? acceptWorkerHint(ColorSortLevel definition, Board board, Object? move) {
  final parsed = moveFromJson(move);
  return parsed != null && inspectPour(board, definition.rules, parsed.from, parsed.to).amount > 0 ? parsed : null;
}
