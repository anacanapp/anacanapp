// Ported from: src/components/games/color-sort/generator.ts, src/components/games/color-sort/color-sort.worker.ts
library;

import '../../common/engine/js.dart';
import 'difficulty.dart';
import 'engine.dart';
import 'levels.dart';

/// `seededRandom(seed)` — mulberry32 with `state = seed >>> 0`.
JsRandom seededRandom(num seed) => Mulberry32(toUint32(seed)).call;

List<T> shuffled<T>(List<T> items, JsRandom random) => jsShuffle(items, random);

/// Deterministic unless [maxMilliseconds] is finite (the worker uses a 2.2 s wall-clock budget).
ColorSortLevel? generateLevel(int level, {int maxAttempts = 48, int maxNodes = 35000, double maxMilliseconds = double.infinity}) {
  final profile = getLevelProfile(level), rules = rulesForProfile(profile);
  if (profile.level == 1) {
    return makeLevel(profile, 1, [
      [0, 0, 1, 1], [1, 1, 0, 0], [], [], [],
    ], const [Move(0, 2), Move(1, 0), Move(2, 1)]);
  }
  final started = Stopwatch()..start();
  double elapsed() => started.elapsedMicroseconds / 1000;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    if (elapsed() > maxMilliseconds) return null;
    final seed = toUint32(imul(profile.level, 0x45D9F3B) + imul(attempt + 1, 0x9E3779B9));
    final random = seededRandom(seed);
    final unitSize = profile.level == 2 ? 2 : 1;
    final units = profile.colors * capacity ~/ unitSize;
    final chunks = [
      for (final chunk in shuffled([
        for (var index = 0; index < units; index++) List<int>.filled(unitSize, index ~/ (capacity ~/ unitSize)),
      ], random))
        ...chunk,
    ];
    final board = <List<int>>[
      for (var index = 0; index < profile.colors; index++) chunks.sublist(index * capacity, (index + 1) * capacity),
    ];
    if (board.any((tube) => isComplete(tube, capacity))) continue;
    final signatures = {for (final tube in board) tube.join(',')};
    if (signatures.length != profile.colors || segmentCount(board) < profile.colors * (unitSize == 2 ? 2 : 3)) continue;
    for (var index = 0; index < profile.emptyTubes + profile.lockedTubes; index++) {
      board.add(<int>[]);
    }
    final remaining = maxMilliseconds - elapsed();
    final result = solve(board, rules, maxNodes: maxNodes, maxMilliseconds: remaining, maxDepth: 120);
    if (result.status == 'solved' && result.moves.length >= profile.colors + 1 && replaySolution(board, rules, result.moves) != null) {
      return makeLevel(profile, seed, board, result.moves);
    }
  }
  return null;
}

/// Safe offline fallback: permutes a proven same-difficulty template (colours, tube order, locks, solution).
ColorSortLevel permuteLevel(ColorSortLevel template, int level) {
  final random = seededRandom(imul(level, 0x27D4EB2D));
  final colors = shuffled([for (var index = 0; index < template.colors; index++) index], random);
  final order = shuffled([for (var index = 0; index < template.board.length; index++) index], random);
  final inverse = {for (var index = 0; index < order.length; index++) order[index]: index};
  final board = [for (final index in order) [for (final color in template.board[index]) colors[color]]];
  final rules = Rules(template.rules.capacity, [for (final lock in template.rules.locks) TubeLock(inverse[lock.tube]!, lock.after)]);
  final solution = [for (final move in template.solution) Move(inverse[move.from]!, inverse[move.to]!)];
  return ColorSortLevel(
    profile: getLevelProfile(level),
    seed: level,
    board: board,
    rules: rules,
    solution: solution,
    parMoves: template.parMoves,
    moveLimit: template.moveLimit,
  );
}

/// Worker entry point (`color-sort.worker.ts`) as a pure top-level function for `Isolate.run`.
/// Request: `{kind: 'level', level, catalog}` (catalog = asset text, for the fallback) or
/// `{kind: 'hint', board, rules}`; pass [timeBudget] = false for deterministic results.
Map<String, Object?> colorSortWorkerJob(Map<String, Object?> request, {bool timeBudget = true}) {
  final budget = timeBudget ? 2200.0 : double.infinity;
  try {
    if (request['kind'] == 'level') {
      final level = (request['level'] as num).toInt();
      final value = generateLevel(level, maxAttempts: 24, maxNodes: 30000, maxMilliseconds: budget) ?? ColorSortCatalog.parse(request['catalog'] as String).fallbackLevel(level);
      return {'kind': 'level', 'level': value.toJson()};
    }
    final board = [for (final tube in request['board'] as List) [for (final color in tube as List) (color as num).toInt()]];
    final result = solve(board, rulesFromJson((request['rules'] as Map).cast()), maxNodes: 45000, maxMilliseconds: budget);
    return {'kind': 'hint', 'move': result.status == 'solved' && result.moves.isNotEmpty ? result.moves.first.toJson() : null};
  } catch (_) {
    return {'kind': request['kind'], 'error': true};
  }
}
