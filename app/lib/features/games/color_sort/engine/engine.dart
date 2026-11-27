// Ported from: src/components/games/color-sort/engine.ts
//
// Tubes are stored bottom → top. Pure rules shared by play, saved solutions and the hint worker.
library;

import '../../common/engine/js.dart';

typedef Board = List<List<int>>;

class TubeLock {
  const TubeLock(this.tube, this.after);
  final int tube;
  final int after;
  Map<String, Object?> toJson() => {'tube': tube, 'after': after};
}

class Rules {
  const Rules(this.capacity, this.locks);
  final int capacity;
  final List<TubeLock> locks;
  Map<String, Object?> toJson() => {'capacity': capacity, 'locks': [for (final lock in locks) lock.toJson()]};
}

class Move {
  const Move(this.from, this.to);
  final int from;
  final int to;
  Map<String, Object?> toJson() => {'from': from, 'to': to};
  @override
  bool operator ==(Object other) => other is Move && other.from == from && other.to == to;
  @override
  int get hashCode => Object.hash(from, to);
  @override
  String toString() => '$from→$to';
}

/// 'ready' | 'same' | 'empty' | 'complete' | 'locked' | 'full' | 'different'
class PourDecision {
  const PourDecision(this.amount, this.color, this.reason);
  final int amount;
  final int? color;
  final String reason;
  Map<String, Object?> toJson() => {'amount': amount, 'color': color, 'reason': reason};
}

int? topColor(List<int> tube) => tube.isEmpty ? null : tube.last;
bool isUniform(List<int> tube) => tube.isNotEmpty && tube.every((color) => color == tube[0]);
bool isComplete(List<int> tube, int capacity) => tube.length == capacity && isUniform(tube);
int completedCount(Board board, int capacity) => board.where((tube) => isComplete(tube, capacity)).length;
bool isSolved(Board board, int capacity) =>
    board.any((tube) => tube.isNotEmpty) && board.every((tube) => tube.isEmpty || isComplete(tube, capacity));

int topRun(List<int> tube) {
  final color = topColor(tube);
  var count = 0;
  for (var index = tube.length - 1; index >= 0 && tube[index] == color; index--) {
    count++;
  }
  return count;
}

TubeLock? _lockOf(Rules rules, int tube) {
  for (final lock in rules.locks) {
    if (lock.tube == tube) return lock;
  }
  return null;
}

bool isLocked(Board board, Rules rules, int tube) {
  final lock = _lockOf(rules, tube);
  return lock != null && completedCount(board, rules.capacity) < lock.after;
}

PourDecision inspectPour(Board board, Rules rules, int from, int to) {
  PourDecision denied(String reason) => PourDecision(0, null, reason);
  if (from < 0 || to < 0 || from >= board.length || to >= board.length || from == to) return denied('same');
  if (isLocked(board, rules, from) || isLocked(board, rules, to)) return denied('locked');
  final source = board[from], target = board[to];
  if (source.isEmpty) return denied('empty');
  if (isComplete(source, rules.capacity)) return denied('complete');
  if (target.length >= rules.capacity) return denied('full');
  final color = topColor(source)!;
  if (target.isNotEmpty && topColor(target) != color) return denied('different');
  final run = topRun(source), space = rules.capacity - target.length;
  return PourDecision(run < space ? run : space, color, 'ready');
}

({Board board, int amount, int color})? pour(Board board, Rules rules, Move move) {
  final decision = inspectPour(board, rules, move.from, move.to);
  if (decision.amount == 0 || decision.color == null) return null;
  final next = List<List<int>>.of(board);
  next[move.from] = board[move.from].sublist(0, board[move.from].length - decision.amount);
  next[move.to] = [...board[move.to], for (var i = 0; i < decision.amount; i++) decision.color!];
  return (board: next, amount: decision.amount, color: decision.color!);
}

List<Move> legalMoves(Board board, Rules rules, [bool pruneSymmetry = false]) {
  final moves = <Move>[];
  final sources = <String>{};
  for (var from = 0; from < board.length; from++) {
    final signature = board[from].join(',');
    if (pruneSymmetry && sources.contains(signature)) continue;
    if (isLocked(board, rules, from)) continue;
    sources.add(signature);
    final targets = <String>{};
    for (var to = 0; to < board.length; to++) {
      if (pruneSymmetry && board[to].isEmpty && isUniform(board[from])) continue;
      if (inspectPour(board, rules, from, to).amount == 0) continue;
      final target = board[to].join(',');
      if (pruneSymmetry && targets.contains(target)) continue;
      targets.add(target);
      moves.add(Move(from, to));
    }
  }
  return moves;
}

/// `validateBoard` for decoded JSON or a typed board.
bool validateBoard(Object? board, int colorCount, Rules rules) {
  if (colorCount < 2 || colorCount > 12 || rules.capacity < 2 || rules.capacity > 6 || board is! List ||
      board.length < colorCount + 1 || board.length > colorCount + 6) {
    return false;
  }
  final counts = List<int>.filled(colorCount, 0);
  for (final tube in board) {
    if (tube is! List || tube.length > rules.capacity) return false;
    for (final color in tube) {
      if (!isJsInteger(color) || (color as num) < 0 || color >= colorCount) return false;
      counts[color.toInt()]++;
    }
  }
  return counts.every((count) => count == rules.capacity) &&
      {for (final lock in rules.locks) lock.tube}.length == rules.locks.length &&
      rules.locks.every((lock) => lock.tube >= 0 && lock.tube < board.length && lock.after > 0 && lock.after < colorCount);
}

int segmentCount(Board board) {
  var total = 0;
  for (final tube in board) {
    for (var index = 0; index < tube.length; index++) {
      if (index == 0 || tube[index] != tube[index - 1]) total++;
    }
  }
  return total;
}

String boardKey(Board board, Rules rules) {
  final completed = completedCount(board, rules.capacity);
  final parts = <String>[
    for (var index = 0; index < board.length; index++)
      '${(_lockOf(rules, index)?.after ?? 0) > completed ? _lockOf(rules, index)!.after : 0}:${board[index].join(',')}',
  ];
  parts.sort(codeOrder);
  return parts.join('|');
}

class _Node {
  _Node(this.board, this.depth, this.heuristic, this.priority, this.parent, this.move, this.key, this.order);
  final Board board;
  final int depth;
  final int heuristic;
  final double priority;
  final _Node? parent;
  final Move? move;
  final String key;
  final int order;
}

class _MinHeap {
  final List<_Node> _entries = [];
  int get size => _entries.length;
  bool _before(_Node a, _Node b) =>
      a.priority < b.priority ||
      (a.priority == b.priority && (a.heuristic < b.heuristic || (a.heuristic == b.heuristic && a.order < b.order)));

  void push(_Node node) {
    _entries.add(node);
    var index = _entries.length - 1;
    while (index > 0) {
      final parent = (index - 1) ~/ 2;
      if (!_before(node, _entries[parent])) break;
      _entries[index] = _entries[parent];
      index = parent;
    }
    _entries[index] = node;
  }

  _Node pop() {
    final first = _entries[0], last = _entries.removeLast();
    if (_entries.isEmpty) return first;
    var index = 0;
    while (index * 2 + 1 < _entries.length) {
      final left = index * 2 + 1, right = left + 1;
      final child = right < _entries.length && _before(_entries[right], _entries[left]) ? right : left;
      if (!_before(_entries[child], last)) break;
      _entries[index] = _entries[child];
      index = child;
    }
    _entries[index] = last;
    return first;
  }
}

/// 'solved' | 'limit' | 'unsolvable'
class SolutionResult {
  const SolutionResult(this.status, this.moves, this.explored);
  final String status;
  final List<Move> moves;
  final int explored;
  Map<String, Object?> toJson() => {'status': status, 'moves': [for (final move in moves) move.toJson()], 'explored': explored};
}

/// Bounded, deterministic weighted A*. [maxMilliseconds] is wall-clock (non-deterministic) and
/// only used by the worker's time budget, exactly like `performance.now()` in the TS.
SolutionResult solve(Board board, Rules rules, {int maxNodes = 30000, int maxDepth = 160, double maxMilliseconds = double.infinity}) {
  final colorCount = {for (final tube in board) ...tube}.length;
  if (!validateBoard(board, colorCount, rules)) return const SolutionResult('unsolvable', [], 0);
  if (isSolved(board, rules.capacity)) return const SolutionResult('solved', [], 0);
  final started = Stopwatch()..start();
  final queue = _MinHeap();
  final visited = <String, int>{};
  final initialKey = boardKey(board, rules), initialH = segmentCount(board) - colorCount;
  queue.push(_Node(board, 0, initialH, initialH * 2.5, null, null, initialKey, 0));
  visited[initialKey] = 0;
  var explored = 0, order = 1;
  var hitDepthLimit = false;
  while (queue.size > 0 && explored < maxNodes) {
    if ((explored & 127) == 0 && started.elapsedMicroseconds / 1000 > maxMilliseconds) return SolutionResult('limit', const [], explored);
    final current = queue.pop();
    if (current.depth != visited[current.key]) continue;
    explored++;
    if (isSolved(current.board, rules.capacity)) {
      final moves = <Move>[];
      for (_Node? node = current; node?.move != null; node = node.parent) {
        moves.add(node!.move!);
      }
      return SolutionResult('solved', moves.reversed.toList(), explored);
    }
    if (current.depth >= maxDepth) {
      hitDepthLimit = true;
      continue;
    }
    for (final move in legalMoves(current.board, rules, true)) {
      final next = pour(current.board, rules, move)!.board;
      final key = boardKey(next, rules), depth = current.depth + 1;
      final seen = visited[key];
      if (seen != null && seen <= depth) continue;
      visited[key] = depth;
      final heuristic = segmentCount(next) - colorCount;
      queue.push(_Node(next, depth, heuristic, depth + heuristic * 2.5, current, move, key, order++));
    }
  }
  return SolutionResult(queue.size > 0 || hitDepthLimit ? 'limit' : 'unsolvable', const [], explored);
}

Board? replaySolution(Board board, Rules rules, List<Move> moves) {
  var current = board;
  for (final move in moves) {
    final result = pour(current, rules, move);
    if (result == null) return null;
    current = result.board;
  }
  return isSolved(current, rules.capacity) ? current : null;
}
