// Pure match-3 engine for "Birləşdir". No DOM/React dependencies so the core
// rules (matching, specials, cascades, gravity) can be reasoned about and
// tested in isolation from rendering/animation concerns.

export type SpecialKind = 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb';

export interface Tile {
  id: number;
  // Regular tile color/type index. Color-bomb tiles use -1 (wildcard: never
  // passively matches by color, only activates via a direct swap).
  type: number;
  special?: SpecialKind;
}

export type Cell = Tile | null;
export type Board = Cell[][];

export interface Pos {
  row: number;
  col: number;
}

export interface MatchGroup {
  type: number;
  cells: Pos[];
  shape: 'plain' | 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb';
  spawnCell?: Pos;
}

export interface MatchResult {
  groups: MatchGroup[];
  matchedCells: Pos[];
}

export interface SpecialEvent {
  kind: SpecialKind;
  pos: Pos;
  // true if this is a brand-new special being created (vs. an existing one being activated)
  created: boolean;
}

export interface ResolutionStep {
  board: Board;
  clearedCount: number;
  events: SpecialEvent[];
}

let tileIdCounter = 1;

function makeTile(type: number, special?: SpecialKind): Tile {
  return { id: tileIdCounter++, type, special };
}

function keyOf(p: Pos) {
  return p.row * 1000 + p.col;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

export function swap(board: Board, a: Pos, b: Pos): Board {
  const next = cloneBoard(board);
  const tmp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = tmp;
  return next;
}

function computeRunLengths(board: Board, rows: number, cols: number) {
  const rowRunLen: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const colRunLen: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const t = board[r][c]?.type;
      if (t === undefined || t === -1) {
        c++;
        continue;
      }
      let c2 = c;
      while (c2 < cols && board[r][c2]?.type === t) c2++;
      const runLen = c2 - c;
      if (runLen >= 3) {
        for (let k = c; k < c2; k++) rowRunLen[r][k] = runLen;
      }
      c = c2;
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const t = board[r][c]?.type;
      if (t === undefined || t === -1) {
        r++;
        continue;
      }
      let r2 = r;
      while (r2 < rows && board[r2][c]?.type === t) r2++;
      const runLen = r2 - r;
      if (runLen >= 3) {
        for (let k = r; k < r2; k++) colRunLen[k][c] = runLen;
      }
      r = r2;
    }
  }

  return { rowRunLen, colRunLen };
}

/**
 * Scans the board for all 3+ matches, groups connected matched cells into
 * components, and classifies each component's resulting special-tile shape.
 *
 * @param swapHint optional positions the player just swapped — used to prefer
 * spawning any resulting special tile at the position the player moved into,
 * matching standard match-3 UX.
 */
export function findMatchGroups(board: Board, swapHint?: Pos[]): MatchResult {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const { rowRunLen, colRunLen } = computeRunLengths(board, rows, cols);

  const matchedMask: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let any = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rowRunLen[r][c] >= 3 || colRunLen[r][c] >= 3) {
        matchedMask[r][c] = true;
        any = true;
      }
    }
  }

  if (!any) return { groups: [], matchedCells: [] };

  const visited: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const groups: MatchGroup[] = [];
  const matchedCells: Pos[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matchedMask[r][c] || visited[r][c]) continue;

      // Flood fill connected matched component (4-directional)
      const type = board[r][c]!.type;
      const stack: Pos[] = [{ row: r, col: c }];
      const cells: Pos[] = [];
      visited[r][c] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        matchedCells.push(cur);
        const neighbors = [
          { row: cur.row - 1, col: cur.col },
          { row: cur.row + 1, col: cur.col },
          { row: cur.row, col: cur.col - 1 },
          { row: cur.row, col: cur.col + 1 },
        ];
        for (const n of neighbors) {
          if (
            n.row >= 0 &&
            n.row < rows &&
            n.col >= 0 &&
            n.col < cols &&
            matchedMask[n.row][n.col] &&
            !visited[n.row][n.col] &&
            board[n.row][n.col]?.type === type
          ) {
            visited[n.row][n.col] = true;
            stack.push(n);
          }
        }
      }

      // Find any intersection cell (row-run>=3 AND col-run>=3) => L/T/plus shape
      const intersections = cells.filter((p) => rowRunLen[p.row][p.col] >= 3 && colRunLen[p.row][p.col] >= 3);

      let shape: MatchGroup['shape'] = 'plain';
      let spawnCell: Pos | undefined;

      if (intersections.length > 0) {
        shape = 'wrapped';
        spawnCell =
          swapHint?.find((h) => intersections.some((p) => p.row === h.row && p.col === h.col)) || intersections[0];
      } else {
        // Pure straight run (all same row, or all same col)
        const allSameRow = cells.every((p) => p.row === cells[0].row);
        const allSameCol = cells.every((p) => p.col === cells[0].col);
        if (cells.length >= 5 && (allSameRow || allSameCol)) {
          shape = 'color-bomb';
          spawnCell = swapHint?.find((h) => cells.some((p) => p.row === h.row && p.col === h.col)) || cells[Math.floor(cells.length / 2)];
        } else if (cells.length === 4 && allSameRow) {
          shape = 'striped-h';
          spawnCell = swapHint?.find((h) => cells.some((p) => p.row === h.row && p.col === h.col)) || cells[Math.floor(cells.length / 2)];
        } else if (cells.length === 4 && allSameCol) {
          shape = 'striped-v';
          spawnCell = swapHint?.find((h) => cells.some((p) => p.row === h.row && p.col === h.col)) || cells[Math.floor(cells.length / 2)];
        }
      }

      groups.push({ type, cells, shape, spawnCell });
    }
  }

  return { groups, matchedCells };
}

function specialClearCells(kind: SpecialKind, pos: Pos, rows: number, cols: number): Pos[] {
  const cells: Pos[] = [];
  if (kind === 'striped-h') {
    for (let c = 0; c < cols; c++) cells.push({ row: pos.row, col: c });
  } else if (kind === 'striped-v') {
    for (let r = 0; r < rows; r++) cells.push({ row: r, col: pos.col });
  } else if (kind === 'wrapped') {
    for (let r = pos.row - 1; r <= pos.row + 1; r++) {
      for (let c = pos.col - 1; c <= pos.col + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) cells.push({ row: r, col: c });
      }
    }
  }
  return cells;
}

/**
 * Applies one full "resolution step" to the board: clears matched groups,
 * spawns any new special tiles, activates pre-existing specials that got
 * caught in the match (recursively, with a safety cap), then applies gravity
 * and refills empty cells with fresh random tiles.
 */
export function applyMatchResult(board: Board, result: MatchResult, typeCount: number): ResolutionStep {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const events: SpecialEvent[] = [];

  const toClear = new Set<number>();
  for (const p of result.matchedCells) toClear.add(keyOf(p));

  const spawnMap = new Map<number, { type: number; special: SpecialKind }>();
  for (const group of result.groups) {
    if (group.shape !== 'plain' && group.spawnCell) {
      const key = keyOf(group.spawnCell);
      // Color bombs are wildcards: type -1 so they never passively match by
      // color (they only activate via a direct swap), matching the Tile docs.
      const spawnType = group.shape === 'color-bomb' ? -1 : group.type;
      spawnMap.set(key, { type: spawnType, special: group.shape as SpecialKind });
      toClear.delete(key); // spawn cell is overwritten, not cleared to null
      events.push({ kind: group.shape as SpecialKind, pos: group.spawnCell, created: true });
    }
  }

  // Activate any *pre-existing* specials caught in this match (recursively).
  let frontier = Array.from(toClear).map((k) => ({ row: Math.floor(k / 1000), col: k % 1000 }));
  let iterations = 0;
  while (frontier.length > 0 && iterations < 12) {
    iterations++;
    const nextFrontier: Pos[] = [];
    for (const p of frontier) {
      const tile = board[p.row][p.col];
      const key = keyOf(p);
      if (tile?.special && !spawnMap.has(key)) {
        events.push({ kind: tile.special, pos: p, created: false });
        const extra = specialClearCells(tile.special, p, rows, cols);
        for (const ep of extra) {
          const ek = keyOf(ep);
          if (!toClear.has(ek) && !spawnMap.has(ek)) {
            toClear.add(ek);
            nextFrontier.push(ep);
          }
        }
      }
    }
    frontier = nextFrontier;
  }

  // Build the post-clear board (spawn specials, null out cleared cells)
  const cleared = cloneBoard(board);
  for (const [key, spawn] of spawnMap) {
    const row = Math.floor(key / 1000);
    const col = key % 1000;
    cleared[row][col] = makeTile(spawn.type, spawn.special);
  }
  for (const key of toClear) {
    const row = Math.floor(key / 1000);
    const col = key % 1000;
    cleared[row][col] = null;
  }

  const clearedCount = toClear.size;

  // Gravity + refill
  const finalBoard: Board = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    const remaining: Tile[] = [];
    for (let r = 0; r < rows; r++) {
      if (cleared[r][c]) remaining.push(cleared[r][c]!);
    }
    const missing = rows - remaining.length;
    const newOnes: Tile[] = [];
    for (let i = 0; i < missing; i++) newOnes.push(makeTile(Math.floor(Math.random() * typeCount)));
    const column = [...newOnes, ...remaining];
    for (let r = 0; r < rows; r++) finalBoard[r][c] = column[r];
  }

  return { board: finalBoard, clearedCount, events };
}

/**
 * Direct activation for swaps involving a color-bomb wildcard tile: clears
 * every tile matching the *other* swapped tile's type (plus itself). If both
 * swapped tiles are color-bombs, clears the entire board (a rare jackpot).
 */
export function activateColorBombSwap(board: Board, a: Pos, b: Pos, typeCount: number): ResolutionStep {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const tileA = board[a.row][a.col];
  const tileB = board[b.row][b.col];
  const events: SpecialEvent[] = [];

  const bombPos = tileA?.special === 'color-bomb' ? a : b;
  const otherPos = tileA?.special === 'color-bomb' ? b : a;
  const otherTile = board[otherPos.row][otherPos.col];

  events.push({ kind: 'color-bomb', pos: bombPos, created: false });

  const cleared = cloneBoard(board);
  let clearedCount = 0;

  const bothBombs = tileA?.special === 'color-bomb' && tileB?.special === 'color-bomb';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = cleared[r][c];
      if (!t) continue;
      const shouldClear = bothBombs || t.type === otherTile?.type || t.special === 'color-bomb';
      if (shouldClear) {
        cleared[r][c] = null;
        clearedCount++;
      }
    }
  }

  const finalBoard: Board = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    const remaining: Tile[] = [];
    for (let r = 0; r < rows; r++) {
      if (cleared[r][c]) remaining.push(cleared[r][c]!);
    }
    const missing = rows - remaining.length;
    const newOnes: Tile[] = [];
    for (let i = 0; i < missing; i++) newOnes.push(makeTile(Math.floor(Math.random() * typeCount)));
    const column = [...newOnes, ...remaining];
    for (let r = 0; r < rows; r++) finalBoard[r][c] = column[r];
  }

  return { board: finalBoard, clearedCount, events };
}

export function createBoard(rows: number, cols: number, typeCount: number): Board {
  let board: Board;
  let guard = 0;
  do {
    board = [];
    for (let r = 0; r < rows; r++) {
      const rowArr: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        let t = 0;
        let attempts = 0;
        do {
          t = Math.floor(Math.random() * typeCount);
          attempts++;
        } while (
          attempts < 30 &&
          ((c >= 2 && rowArr[c - 1]?.type === t && rowArr[c - 2]?.type === t) ||
            (r >= 2 && board[r - 1][c]?.type === t && board[r - 2][c]?.type === t))
        );
        rowArr.push(makeTile(t));
      }
      board.push(rowArr);
    }
    guard++;
  } while (guard < 40 && (findMatchGroups(board).groups.length > 0 || !hasAnyPossibleMove(board, typeCount)));
  return board;
}

/** Checks whether swapping any two adjacent tiles would create a match — used to
 * detect "stuck" boards that need a shuffle. */
export function hasAnyPossibleMove(board: Board, typeCount: number): boolean {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // color-bomb tiles always provide a possible "move" (swap with any neighbor)
      if (board[r][c]?.special === 'color-bomb') return true;
      if (c + 1 < cols) {
        const swapped = swap(board, { row: r, col: c }, { row: r, col: c + 1 });
        if (findMatchGroups(swapped).groups.length > 0) return true;
      }
      if (r + 1 < rows) {
        const swapped = swap(board, { row: r, col: c }, { row: r + 1, col: c });
        if (findMatchGroups(swapped).groups.length > 0) return true;
      }
    }
  }
  return false;
}

export function reshuffleBoard(board: Board, typeCount: number): Board {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  // Preserve full tiles (type + earned specials) — a shuffle must never
  // destroy a striped/wrapped/color-bomb the player worked for, and must not
  // strip the special flag off a wildcard (-1) tile (which would leave a
  // permanently unmatchable dead tile on the board).
  const flatTiles: { type: number; special?: SpecialKind }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = board[r][c];
      flatTiles.push(
        t ? { type: t.type, special: t.special } : { type: Math.floor(Math.random() * typeCount) }
      );
    }
  }
  // Fisher-Yates shuffle, retry until a valid (match-free, has-a-move) layout is found
  let attempt = 0;
  let result: Board = board;
  do {
    for (let i = flatTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flatTiles[i], flatTiles[j]] = [flatTiles[j], flatTiles[i]];
    }
    result = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const rowArr: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        const src = flatTiles[idx++];
        rowArr.push(makeTile(src.type, src.special));
      }
      result.push(rowArr);
    }
    attempt++;
  } while (attempt < 60 && (findMatchGroups(result).groups.length > 0 || !hasAnyPossibleMove(result, typeCount)));
  return result;
}
