// Ported from: src/components/games/qabarciq/engine.ts, src/components/games/qabarciq/BubblePop.tsx (tap/pop scoring,
// combo window, boosters)
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';

const String bubbleId = 'qabarciq';
const int cols = 8;
const int rows = 10;
const int colors = 6;
const int roundSeconds = 90;
const int comboWindowMs = 1600;
const int maxMultiplier = 5;
const int startWands = 2;
const int startRainbows = 1;
const int maxScore = 300000; // server bound (submit_game_score_v1)

class Bubble {
  const Bubble(this.id, this.color);
  final int id;
  final int color;
}

/// grid[col][row], row 0 = top.
typedef Grid = List<List<Bubble>>;

/// xorshift32 (`createRng`): `s = seed >>> 0 || 1`.
class BubbleRng {
  BubbleRng(num seed) : _s = toUint32(seed) == 0 ? 1 : toUint32(seed);
  int _s;
  double next() {
    _s = (_s ^ (_s << 13)) & 0xFFFFFFFF;
    _s = _s ^ (_s >> 17);
    _s = (_s ^ (_s << 5)) & 0xFFFFFFFF;
    return _s / 0x100000000;
  }
}

class BoardState {
  BoardState(this.grid, this.nextId, this.rng);
  final Grid grid;
  final int nextId;
  final BubbleRng rng;
}

/// The React app seeds with `Date.now()`; pass the same millisecond clock value.
BoardState createBubbleBoard(num seed) {
  final rng = BubbleRng(seed);
  var nextId = 1;
  final grid = <List<Bubble>>[];
  for (var c = 0; c < cols; c++) {
    final col = <Bubble>[];
    for (var r = 0; r < rows; r++) {
      col.add(Bubble(nextId++, (rng.next() * colors).floor()));
    }
    grid.add(col);
  }
  final board = BoardState(grid, nextId, rng);
  ensureMove(board);
  return board;
}

int _key(int c, int r) => c * rows + r;

/// Connected same-colour cells (4-neighbour) starting at (c, r), in the TS stack order.
List<(int, int)> findGroup(Grid grid, int c, int r) {
  if (c < 0 || c >= grid.length || r < 0 || r >= grid[c].length) return [];
  final color = grid[c][r].color;
  final seen = <int>{_key(c, r)};
  final out = <(int, int)>[];
  final stack = <(int, int)>[(c, r)];
  while (stack.isNotEmpty) {
    final (x, y) = stack.removeLast();
    out.add((x, y));
    for (final (dx, dy) in const [(1, 0), (-1, 0), (0, 1), (0, -1)]) {
      final nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.contains(_key(nx, ny))) continue;
      if (grid[nx][ny].color != color) continue;
      seen.add(_key(nx, ny));
      stack.add((nx, ny));
    }
  }
  return out;
}

bool hasMove(Grid grid) {
  for (var c = 0; c < cols; c++) {
    for (var r = 0; r < rows; r++) {
      final color = grid[c][r].color;
      if ((c + 1 < cols && grid[c + 1][r].color == color) || (r + 1 < rows && grid[c][r + 1].color == color)) return true;
    }
  }
  return false;
}

void ensureMove(BoardState board) {
  if (hasMove(board.grid)) return;
  final c = (board.rng.next() * (cols - 1)).floor(), r = (board.rng.next() * rows).floor();
  board.grid[c + 1][r] = Bubble(board.grid[c + 1][r].id, board.grid[c][r].color);
}

BoardState removeCells(BoardState board, List<(int, int)> cells) {
  final remove = {for (final (c, r) in cells) _key(c, r)};
  var nextId = board.nextId;
  final grid = <List<Bubble>>[];
  for (var c = 0; c < board.grid.length; c++) {
    final kept = [for (var r = 0; r < board.grid[c].length; r++) if (!remove.contains(_key(c, r))) board.grid[c][r]];
    final fresh = <Bubble>[];
    while (fresh.length + kept.length < rows) {
      fresh.add(Bubble(nextId++, (board.rng.next() * colors).floor()));
    }
    grid.add([...fresh, ...kept]);
  }
  final next = BoardState(grid, nextId, board.rng);
  ensureMove(next);
  return next;
}

double multiplierFor(int combo) => math.min(maxMultiplier.toDouble(), 1 + math.max(0, combo - 1) * 0.5);

int pointsFor(int n, int combo) => n < 1 ? 0 : jsRound(n * n * 5 * multiplierFor(combo));

List<(int, int)> cellsOfColor(Grid grid, int color) => [
      for (var c = 0; c < cols; c++)
        for (var r = 0; r < rows; r++)
          if (grid[c][r].color == color) (c, r),
    ];

class RoundStats {
  const RoundStats({this.score = 0, this.popped = 0, this.bestCombo = 0, this.pops = 0});
  final int score;
  final int popped;
  final int bestCombo;
  final int pops;
  Map<String, Object?> toJson() => {'score': score, 'popped': popped, 'bestCombo': bestCombo, 'pops': pops};
}

/// 'pop' | 'wand' | 'rainbow'
typedef BubbleMode = String;

/// The scoring/booster state machine of BubblePop.tsx `tap` + `pop`, with an injected millisecond
/// clock (`Date.now()` in the React code) so it can be tested and driven from a Ticker.
class BubbleRound {
  BubbleRound(this.board);
  BoardState board;
  RoundStats stats = const RoundStats();
  int combo = 0;
  int lastPop = 0;
  int wands = startWands;
  int rainbows = startRainbows;
  BubbleMode mode = 'pop';

  /// The 100 ms clock tick: drops the combo once the window has passed.
  void tick(int nowMs) {
    if (combo != 0 && nowMs - lastPop > comboWindowMs) combo = 0;
  }

  /// Returns the popped cells and points, or null for a single bubble (the UI shakes it).
  ({List<(int, int)> cells, int gained, int combo, String kind})? tap(int c, int r, int nowMs) {
    final grid = board.grid;
    if (mode == 'wand' && wands > 0) {
      final group = findGroup(grid, c, r);
      wands--;
      mode = 'pop';
      return _pop(group, jsRound(math.pow(math.max(1, group.length), 2) * 5 * multiplierFor(combo + 1)) + 50, 'wand', nowMs);
    }
    if (mode == 'rainbow' && rainbows > 0) {
      final cells = cellsOfColor(grid, grid[c][r].color);
      rainbows--;
      mode = 'pop';
      return _pop(cells, jsRound(cells.length * 25 * multiplierFor(combo + 1)), 'rainbow', nowMs);
    }
    final group = findGroup(grid, c, r);
    if (group.length < 2) return null;
    return _pop(group, 0, 'group', nowMs);
  }

  ({List<(int, int)> cells, int gained, int combo, String kind}) _pop(List<(int, int)> cells, int points, String kind, int now) {
    final nextCombo = now - lastPop <= comboWindowMs ? combo + 1 : 1;
    lastPop = now;
    combo = nextCombo;
    final gained = kind == 'group' ? pointsFor(cells.length, nextCombo) : points;
    board = removeCells(board, cells);
    stats = RoundStats(
      score: math.min(maxScore, stats.score + gained),
      popped: stats.popped + cells.length,
      bestCombo: math.max(stats.bestCombo, nextCombo),
      pops: stats.pops + 1,
    );
    return (cells: cells, gained: gained, combo: nextCombo, kind: kind);
  }
}
