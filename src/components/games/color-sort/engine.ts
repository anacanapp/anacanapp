// Tubes are stored bottom → top. No rendering, timers, randomness or network
// belongs in this engine; saved solutions and the hint worker use the same rules.
export type Board = number[][];
export interface TubeLock { tube: number; after: number }
export interface Rules { capacity: number; locks: TubeLock[] }
export interface Move { from: number; to: number }
export type PourReason = 'ready' | 'same' | 'empty' | 'complete' | 'locked' | 'full' | 'different';
export interface PourDecision { amount: number; color: number | null; reason: PourReason }

export const topColor = (tube: readonly number[]) => tube.length ? tube[tube.length - 1] : null;
export const isUniform = (tube: readonly number[]) => tube.length > 0 && tube.every(color => color === tube[0]);
export const isComplete = (tube: readonly number[], capacity: number) => tube.length === capacity && isUniform(tube);
export const completedCount = (board: Board, capacity: number) => board.filter(tube => isComplete(tube, capacity)).length;
export const isSolved = (board: Board, capacity: number) => board.some(tube => tube.length > 0)
  && board.every(tube => tube.length === 0 || isComplete(tube, capacity));

export function topRun(tube: readonly number[]): number {
  const color = topColor(tube);
  let count = 0;
  for (let index = tube.length - 1; index >= 0 && tube[index] === color; index--) count++;
  return count;
}

export function isLocked(board: Board, rules: Rules, tube: number): boolean {
  const lock = rules.locks.find(item => item.tube === tube);
  return !!lock && completedCount(board, rules.capacity) < lock.after;
}

export function inspectPour(board: Board, rules: Rules, from: number, to: number): PourDecision {
  const denied = (reason: PourReason): PourDecision => ({ amount: 0, color: null, reason });
  if (!Number.isInteger(from) || !Number.isInteger(to) || !board[from] || !board[to] || from === to) return denied('same');
  if (isLocked(board, rules, from) || isLocked(board, rules, to)) return denied('locked');
  const source = board[from], target = board[to];
  if (!source.length) return denied('empty');
  // A completed vitamin tube is sealed. This also makes key progress monotonic
  // during forward play; undo restores the previous board and its locks.
  if (isComplete(source, rules.capacity)) return denied('complete');
  if (target.length >= rules.capacity) return denied('full');
  const color = topColor(source)!;
  if (target.length && topColor(target) !== color) return denied('different');
  return { amount: Math.min(topRun(source), rules.capacity - target.length), color, reason: 'ready' };
}

export function pour(board: Board, rules: Rules, move: Move): { board: Board; amount: number; color: number } | null {
  const decision = inspectPour(board, rules, move.from, move.to);
  if (!decision.amount || decision.color === null) return null;
  const next = board.slice();
  next[move.from] = board[move.from].slice(0, -decision.amount);
  next[move.to] = [...board[move.to], ...Array(decision.amount).fill(decision.color)];
  return { board: next, amount: decision.amount, color: decision.color };
}

export function legalMoves(board: Board, rules: Rules, pruneSymmetry = false): Move[] {
  const moves: Move[] = [], sources = new Set<string>();
  for (let from = 0; from < board.length; from++) {
    const signature = board[from].join(',');
    if (pruneSymmetry && sources.has(signature)) continue;
    if (isLocked(board, rules, from)) continue;
    sources.add(signature);
    const targets = new Set<string>();
    for (let to = 0; to < board.length; to++) {
      if (pruneSymmetry && !board[to].length && isUniform(board[from])) continue;
      if (inspectPour(board, rules, from, to).amount === 0) continue;
      const target = board[to].join(',');
      if (pruneSymmetry && targets.has(target)) continue;
      targets.add(target); moves.push({ from, to });
    }
  }
  return moves;
}

export function validateBoard(board: unknown, colorCount: number, rules: Rules): board is Board {
  if (!Number.isInteger(colorCount) || colorCount < 2 || colorCount > 12
    || !Number.isInteger(rules.capacity) || rules.capacity < 2 || rules.capacity > 6
    || !Array.isArray(board) || board.length < colorCount + 1 || board.length > colorCount + 6) return false;
  const counts = Array(colorCount).fill(0);
  for (const tube of board) {
    if (!Array.isArray(tube) || tube.length > rules.capacity) return false;
    for (const color of tube) {
      if (!Number.isInteger(color) || color < 0 || color >= colorCount) return false;
      counts[color]++;
    }
  }
  return counts.every(count => count === rules.capacity)
    && new Set(rules.locks.map(lock => lock.tube)).size === rules.locks.length
    && rules.locks.every(lock => Number.isInteger(lock.tube) && lock.tube >= 0 && lock.tube < board.length
      && Number.isInteger(lock.after) && lock.after > 0 && lock.after < colorCount);
}

export function segmentCount(board: Board): number {
  return board.reduce((total, tube) => total + tube.reduce((count, color, index) => count + Number(index === 0 || color !== tube[index - 1]), 0), 0);
}

// Positions of still-locked tubes matter; unlocked tubes of equal capacity are
// interchangeable. Parent nodes always retain real indexes for playable hints.
export function boardKey(board: Board, rules: Rules): string {
  const completed = completedCount(board, rules.capacity);
  return board.map((tube, index) => {
    const after = rules.locks.find(lock => lock.tube === index)?.after ?? 0;
    return `${after > completed ? after : 0}:${tube.join(',')}`;
  }).sort().join('|');
}

interface SearchNode { board: Board; depth: number; heuristic: number; priority: number; parent: SearchNode | null; move: Move | null; key: string; order: number }
class MinHeap {
  private entries: SearchNode[] = [];
  get size() { return this.entries.length; }
  private before(a: SearchNode, b: SearchNode) { return a.priority < b.priority || (a.priority === b.priority && (a.heuristic < b.heuristic || (a.heuristic === b.heuristic && a.order < b.order))); }
  push(node: SearchNode) {
    this.entries.push(node);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.before(node, this.entries[parent])) break;
      this.entries[index] = this.entries[parent]; index = parent;
    }
    this.entries[index] = node;
  }
  pop(): SearchNode {
    const first = this.entries[0], last = this.entries.pop()!;
    if (!this.entries.length) return first;
    let index = 0;
    while (index * 2 + 1 < this.entries.length) {
      const left = index * 2 + 1, right = left + 1;
      const child = right < this.entries.length && this.before(this.entries[right], this.entries[left]) ? right : left;
      if (!this.before(this.entries[child], last)) break;
      this.entries[index] = this.entries[child]; index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

export type SolutionResult = { status: 'solved'; moves: Move[]; explored: number }
  | { status: 'limit' | 'unsolvable'; moves: []; explored: number };

/** Bounded, deterministic weighted A*. Run nontrivial searches in the worker. */
export function solve(board: Board, rules: Rules, options: { maxNodes?: number; maxDepth?: number; maxMilliseconds?: number } = {}): SolutionResult {
  const { maxNodes = 30_000, maxDepth = 160, maxMilliseconds = Infinity } = options;
  const colorCount = new Set(board.flat()).size;
  if (!validateBoard(board, colorCount, rules)) return { status: 'unsolvable', moves: [], explored: 0 };
  if (isSolved(board, rules.capacity)) return { status: 'solved', moves: [], explored: 0 };
  const started = performance.now(), queue = new MinHeap(), visited = new Map<string, number>();
  const initialKey = boardKey(board, rules), initialH = segmentCount(board) - colorCount;
  queue.push({ board, depth: 0, heuristic: initialH, priority: initialH * 2.5, parent: null, move: null, key: initialKey, order: 0 });
  visited.set(initialKey, 0);
  let explored = 0, order = 1, hitDepthLimit = false;
  while (queue.size && explored < maxNodes) {
    if ((explored & 127) === 0 && performance.now() - started > maxMilliseconds) return { status: 'limit', moves: [], explored };
    const current = queue.pop();
    if (current.depth !== visited.get(current.key)) continue;
    explored++;
    if (isSolved(current.board, rules.capacity)) {
      const moves: Move[] = [];
      for (let node: SearchNode | null = current; node?.move; node = node.parent) moves.push(node.move);
      return { status: 'solved', moves: moves.reverse(), explored };
    }
    if (current.depth >= maxDepth) { hitDepthLimit = true; continue; }
    for (const move of legalMoves(current.board, rules, true)) {
      const next = pour(current.board, rules, move)!.board;
      const key = boardKey(next, rules), depth = current.depth + 1;
      if ((visited.get(key) ?? Infinity) <= depth) continue;
      visited.set(key, depth);
      const heuristic = segmentCount(next) - colorCount;
      queue.push({ board: next, depth, heuristic, priority: depth + heuristic * 2.5,
        parent: current, move, key, order: order++ });
    }
  }
  return { status: queue.size || hitDepthLimit ? 'limit' : 'unsolvable', moves: [], explored };
}

export function replaySolution(board: Board, rules: Rules, moves: Move[]): Board | null {
  let current = board;
  for (const move of moves) {
    const result = pour(current, rules, move);
    if (!result) return null;
    current = result.board;
  }
  return isSolved(current, rules.capacity) ? current : null;
}
