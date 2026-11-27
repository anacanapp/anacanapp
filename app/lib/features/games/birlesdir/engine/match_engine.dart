// Ported from: src/components/games/birlesdir/matchEngine.ts, src/components/games/birlesdir/BirlesdirGame.tsx
// (computeScore, attemptSwap/resolveFrom without the animation sleeps)
//
// The React engine draws refills/boards from `Math.random()` and numbers tiles from a module-level
// counter; both are injected here ([Match3.random], [Match3.nextId]) so play is reproducible in tests.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';

/// 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb'
typedef SpecialKind = String;

class Tile {
  const Tile(this.id, this.type, [this.special]);
  final int id;

  /// Colour index; colour bombs use -1 (wildcard).
  final int type;
  final SpecialKind? special;
}

typedef Board = List<List<Tile?>>;

class Pos {
  const Pos(this.row, this.col);
  final int row;
  final int col;
  Map<String, Object?> toJson() => {'row': row, 'col': col};
  @override
  bool operator ==(Object other) => other is Pos && other.row == row && other.col == col;
  @override
  int get hashCode => Object.hash(row, col);
}

class MatchGroup {
  MatchGroup(this.type, this.cells, this.shape, this.spawnCell);
  final int type;
  final List<Pos> cells;

  /// 'plain' | 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb'
  final String shape;
  final Pos? spawnCell;
  Map<String, Object?> toJson() => {
        'type': type, 'cells': [for (final c in cells) c.toJson()], 'shape': shape,
        if (spawnCell != null) 'spawnCell': spawnCell!.toJson(),
      };
}

class MatchResult {
  MatchResult(this.groups, this.matchedCells);
  final List<MatchGroup> groups;
  final List<Pos> matchedCells;
}

class SpecialEvent {
  const SpecialEvent(this.kind, this.pos, this.created);
  final SpecialKind kind;
  final Pos pos;
  final bool created;
  Map<String, Object?> toJson() => {'kind': kind, 'pos': pos.toJson(), 'created': created};
}

class ResolutionStep {
  ResolutionStep(this.board, this.clearedCount, this.events);
  final Board board;
  final int clearedCount;
  final List<SpecialEvent> events;
}

int _keyOf(Pos p) => p.row * 1000 + p.col;

Board cloneBoard(Board board) => [for (final row in board) List<Tile?>.of(row)];

bool isAdjacent(Pos a, Pos b) => (a.row - b.row).abs() + (a.col - b.col).abs() == 1;

Board swap(Board board, Pos a, Pos b) {
  final next = cloneBoard(board);
  final tmp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = tmp;
  return next;
}

({List<List<int>> rowRun, List<List<int>> colRun}) _runLengths(Board board, int rows, int cols) {
  final rowRun = [for (var r = 0; r < rows; r++) List<int>.filled(cols, 0)];
  final colRun = [for (var r = 0; r < rows; r++) List<int>.filled(cols, 0)];
  for (var r = 0; r < rows; r++) {
    var c = 0;
    while (c < cols) {
      final t = board[r][c]?.type;
      if (t == null || t == -1) {
        c++;
        continue;
      }
      var c2 = c;
      while (c2 < cols && board[r][c2]?.type == t) {
        c2++;
      }
      final run = c2 - c;
      if (run >= 3) {
        for (var k = c; k < c2; k++) {
          rowRun[r][k] = run;
        }
      }
      c = c2;
    }
  }
  for (var c = 0; c < cols; c++) {
    var r = 0;
    while (r < rows) {
      final t = board[r][c]?.type;
      if (t == null || t == -1) {
        r++;
        continue;
      }
      var r2 = r;
      while (r2 < rows && board[r2][c]?.type == t) {
        r2++;
      }
      final run = r2 - r;
      if (run >= 3) {
        for (var k = r; k < r2; k++) {
          colRun[k][c] = run;
        }
      }
      r = r2;
    }
  }
  return (rowRun: rowRun, colRun: colRun);
}

Pos? _findHint(List<Pos>? hints, bool Function(Pos) test) {
  if (hints == null) return null;
  for (final h in hints) {
    if (test(h)) return h;
  }
  return null;
}

MatchResult findMatchGroups(Board board, [List<Pos>? swapHint]) {
  final rows = board.length;
  final cols = rows == 0 ? 0 : board[0].length;
  final runs = _runLengths(board, rows, cols);
  final matched = [for (var r = 0; r < rows; r++) List<bool>.filled(cols, false)];
  var any = false;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      if (runs.rowRun[r][c] >= 3 || runs.colRun[r][c] >= 3) {
        matched[r][c] = true;
        any = true;
      }
    }
  }
  if (!any) return MatchResult([], []);
  final visited = [for (var r = 0; r < rows; r++) List<bool>.filled(cols, false)];
  final groups = <MatchGroup>[];
  final matchedCells = <Pos>[];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      if (!matched[r][c] || visited[r][c]) continue;
      final type = board[r][c]!.type;
      final stack = <Pos>[Pos(r, c)];
      final cells = <Pos>[];
      visited[r][c] = true;
      while (stack.isNotEmpty) {
        final cur = stack.removeLast();
        cells.add(cur);
        matchedCells.add(cur);
        for (final n in [Pos(cur.row - 1, cur.col), Pos(cur.row + 1, cur.col), Pos(cur.row, cur.col - 1), Pos(cur.row, cur.col + 1)]) {
          if (n.row >= 0 && n.row < rows && n.col >= 0 && n.col < cols && matched[n.row][n.col] && !visited[n.row][n.col] &&
              board[n.row][n.col]?.type == type) {
            visited[n.row][n.col] = true;
            stack.add(n);
          }
        }
      }
      final intersections = [for (final p in cells) if (runs.rowRun[p.row][p.col] >= 3 && runs.colRun[p.row][p.col] >= 3) p];
      var shape = 'plain';
      Pos? spawnCell;
      if (intersections.isNotEmpty) {
        shape = 'wrapped';
        spawnCell = _findHint(swapHint, (h) => intersections.contains(h)) ?? intersections[0];
      } else {
        final sameRow = cells.every((p) => p.row == cells[0].row), sameCol = cells.every((p) => p.col == cells[0].col);
        Pos middle() => _findHint(swapHint, (h) => cells.contains(h)) ?? cells[cells.length ~/ 2];
        if (cells.length >= 5 && (sameRow || sameCol)) {
          shape = 'color-bomb';
          spawnCell = middle();
        } else if (cells.length == 4 && sameRow) {
          shape = 'striped-h';
          spawnCell = middle();
        } else if (cells.length == 4 && sameCol) {
          shape = 'striped-v';
          spawnCell = middle();
        }
      }
      groups.add(MatchGroup(type, cells, shape, spawnCell));
    }
  }
  return MatchResult(groups, matchedCells);
}

List<Pos> _specialClearCells(SpecialKind kind, Pos pos, int rows, int cols) {
  final cells = <Pos>[];
  if (kind == 'striped-h') {
    for (var c = 0; c < cols; c++) {
      cells.add(Pos(pos.row, c));
    }
  } else if (kind == 'striped-v') {
    for (var r = 0; r < rows; r++) {
      cells.add(Pos(r, pos.col));
    }
  } else if (kind == 'wrapped') {
    for (var r = pos.row - 1; r <= pos.row + 1; r++) {
      for (var c = pos.col - 1; c <= pos.col + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) cells.add(Pos(r, c));
      }
    }
  }
  return cells;
}

bool hasAnyPossibleMove(Board board, int typeCount) {
  final rows = board.length;
  final cols = rows == 0 ? 0 : board[0].length;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      if (board[r][c]?.special == 'color-bomb') return true;
      if (c + 1 < cols && findMatchGroups(swap(board, Pos(r, c), Pos(r, c + 1))).groups.isNotEmpty) return true;
      if (r + 1 < rows && findMatchGroups(swap(board, Pos(r, c), Pos(r + 1, c))).groups.isNotEmpty) return true;
    }
  }
  return false;
}

/// Engine functions that create tiles (ids) or draw random tile types.
class Match3 {
  Match3({JsRandom? random, this.nextId = 1}) : random = random ?? math.Random().nextDouble;
  final JsRandom random;
  int nextId;

  Tile _makeTile(int type, [SpecialKind? special]) => Tile(nextId++, type, special);

  Board _gravity(Board cleared, int rows, int cols, int typeCount) {
    final finalBoard = [for (var r = 0; r < rows; r++) List<Tile?>.filled(cols, null)];
    for (var c = 0; c < cols; c++) {
      final remaining = <Tile>[for (var r = 0; r < rows; r++) if (cleared[r][c] != null) cleared[r][c]!];
      final missing = rows - remaining.length;
      final fresh = <Tile>[for (var i = 0; i < missing; i++) _makeTile((random() * typeCount).floor())];
      final column = [...fresh, ...remaining];
      for (var r = 0; r < rows; r++) {
        finalBoard[r][c] = column[r];
      }
    }
    return finalBoard;
  }

  ResolutionStep applyMatchResult(Board board, MatchResult result, int typeCount) {
    final rows = board.length;
    final cols = rows == 0 ? 0 : board[0].length;
    final events = <SpecialEvent>[];
    final toClear = <int>{for (final p in result.matchedCells) _keyOf(p)};
    final spawnMap = <int, ({int type, SpecialKind special})>{};
    for (final group in result.groups) {
      if (group.shape != 'plain' && group.spawnCell != null) {
        final key = _keyOf(group.spawnCell!);
        spawnMap[key] = (type: group.shape == 'color-bomb' ? -1 : group.type, special: group.shape);
        toClear.remove(key);
        events.add(SpecialEvent(group.shape, group.spawnCell!, true));
      }
    }
    var frontier = [for (final k in toClear) Pos(k ~/ 1000, k % 1000)];
    var iterations = 0;
    while (frontier.isNotEmpty && iterations < 12) {
      iterations++;
      final nextFrontier = <Pos>[];
      for (final p in frontier) {
        final tile = board[p.row][p.col];
        final key = _keyOf(p);
        if (tile?.special != null && !spawnMap.containsKey(key)) {
          events.add(SpecialEvent(tile!.special!, p, false));
          for (final ep in _specialClearCells(tile.special!, p, rows, cols)) {
            final ek = _keyOf(ep);
            if (!toClear.contains(ek) && !spawnMap.containsKey(ek)) {
              toClear.add(ek);
              nextFrontier.add(ep);
            }
          }
        }
      }
      frontier = nextFrontier;
    }
    final cleared = cloneBoard(board);
    spawnMap.forEach((key, spawn) => cleared[key ~/ 1000][key % 1000] = _makeTile(spawn.type, spawn.special));
    for (final key in toClear) {
      cleared[key ~/ 1000][key % 1000] = null;
    }
    return ResolutionStep(_gravity(cleared, rows, cols, typeCount), toClear.length, events);
  }

  ResolutionStep activateColorBombSwap(Board board, Pos a, Pos b, int typeCount) {
    final rows = board.length;
    final cols = rows == 0 ? 0 : board[0].length;
    final tileA = board[a.row][a.col], tileB = board[b.row][b.col];
    final bombPos = tileA?.special == 'color-bomb' ? a : b;
    final otherPos = tileA?.special == 'color-bomb' ? b : a;
    final otherTile = board[otherPos.row][otherPos.col];
    final events = [SpecialEvent('color-bomb', bombPos, false)];
    final cleared = cloneBoard(board);
    var clearedCount = 0;
    final bothBombs = tileA?.special == 'color-bomb' && tileB?.special == 'color-bomb';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final t = cleared[r][c];
        if (t == null) continue;
        if (bothBombs || t.type == otherTile?.type || t.special == 'color-bomb') {
          cleared[r][c] = null;
          clearedCount++;
        }
      }
    }
    return ResolutionStep(_gravity(cleared, rows, cols, typeCount), clearedCount, events);
  }

  Board createBoard(int rows, int cols, int typeCount) {
    late Board board;
    var guard = 0;
    do {
      board = [];
      for (var r = 0; r < rows; r++) {
        final row = <Tile?>[];
        for (var c = 0; c < cols; c++) {
          var t = 0, attempts = 0;
          do {
            t = (random() * typeCount).floor();
            attempts++;
          } while (attempts < 30 &&
              ((c >= 2 && row[c - 1]?.type == t && row[c - 2]?.type == t) ||
                  (r >= 2 && board[r - 1][c]?.type == t && board[r - 2][c]?.type == t)));
          row.add(_makeTile(t));
        }
        board.add(row);
      }
      guard++;
    } while (guard < 40 && (findMatchGroups(board).groups.isNotEmpty || !hasAnyPossibleMove(board, typeCount)));
    return board;
  }

  Board reshuffleBoard(Board board, int typeCount) {
    final rows = board.length;
    final cols = rows == 0 ? 0 : board[0].length;
    final flat = <({int type, SpecialKind? special})>[
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++)
          board[r][c] != null
              ? (type: board[r][c]!.type, special: board[r][c]!.special)
              : (type: (random() * typeCount).floor(), special: null),
    ];
    var attempt = 0;
    Board result = board;
    do {
      for (var i = flat.length - 1; i > 0; i--) {
        final j = (random() * (i + 1)).floor();
        final tmp = flat[i];
        flat[i] = flat[j];
        flat[j] = tmp;
      }
      var idx = 0;
      result = [
        for (var r = 0; r < rows; r++)
          [
            for (var c = 0; c < cols; c++)
              () {
                final src = flat[idx++];
                return _makeTile(src.type, src.special);
              }(),
          ],
      ];
      attempt++;
    } while (attempt < 60 && (findMatchGroups(result).groups.isNotEmpty || !hasAnyPossibleMove(result, typeCount)));
    return result;
  }

  /// One player swap resolved like `attemptSwap` + `resolveFrom` (animation delays removed).
  /// Returns null for an invalid swap (the UI shows the shake and swaps back).
  SwapOutcome? playSwap(Board board, Pos a, Pos b, int typeCount, double scoreMultiplier) {
    final tileA = board[a.row][a.col], tileB = board[b.row][b.col];
    final steps = <ResolutionStep>[];
    if (tileA?.special == 'color-bomb' || tileB?.special == 'color-bomb') {
      steps.add(activateColorBombSwap(board, a, b, typeCount));
    } else {
      final swapped = swap(board, a, b);
      final result = findMatchGroups(swapped, [a, b]);
      if (result.groups.isEmpty) return null;
      steps.add(applyMatchResult(swapped, result, typeCount));
    }
    var gained = computeScore(steps[0].clearedCount, 0, steps[0].events, scoreMultiplier);
    var current = steps[0].board;
    var cascadeIndex = 1;
    while (true) {
      final result = findMatchGroups(current);
      if (result.groups.isEmpty) break;
      final step = applyMatchResult(current, result, typeCount);
      gained += computeScore(step.clearedCount, cascadeIndex, step.events, scoreMultiplier);
      current = step.board;
      steps.add(step);
      cascadeIndex++;
    }
    var reshuffled = false;
    if (!hasAnyPossibleMove(current, typeCount)) {
      current = reshuffleBoard(current, typeCount);
      reshuffled = true;
    }
    return SwapOutcome(current, gained, steps, reshuffled);
  }
}

class SwapOutcome {
  SwapOutcome(this.board, this.gained, this.steps, this.reshuffled);
  final Board board;
  final int gained;
  final List<ResolutionStep> steps;
  final bool reshuffled;
}

/// `computeScore` of BirlesdirGame.tsx.
int computeScore(int clearedCount, int cascadeIndex, List<SpecialEvent> events, double scoreMultiplier) {
  final base = clearedCount * 12;
  final cascadeMultiplier = 1 + cascadeIndex * 0.5;
  var bonus = 0;
  for (final e in events) {
    if (e.kind == 'striped-h' || e.kind == 'striped-v') {
      bonus += e.created ? 30 : 60;
    } else if (e.kind == 'wrapped') {
      bonus += e.created ? 50 : 100;
    } else if (e.kind == 'color-bomb') {
      bonus += e.created ? 80 : 160;
    }
  }
  return jsRound((base * cascadeMultiplier + bonus) * scoreMultiplier);
}

/// End-of-round bonus of BirlesdirGame.tsx: unused moves × max(12, round(55 × multiplier)).
int birlesdirFinalScore(int score, int movesLeft, int targetScore, double scoreMultiplier) {
  if (score < targetScore) return score;
  final perMove = math.max(12, jsRound(55 * scoreMultiplier));
  return score + math.max(0, movesLeft) * perMove;
}
