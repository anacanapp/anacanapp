import { pour, topRun, validateBoard, type Board, type Move } from './engine';
import { seededRandom, shuffled } from './generator';
import type { ColorSortLevel } from './difficulty';

export interface LiquidUnit { id: number; color: number }
interface Snapshot { tubes: LiquidUnit[][]; moves: number }
export interface ColorSortSession extends Snapshot {
  revealed: number[]; bonusMoves: number; hints: number; extraTubes: number; undos: number; history: Snapshot[];
}
const SAVE_KEY = 'anacan_colorsort_round_v1';
export const MAX_HINTS = 3;
export const MAX_EXTRA_TUBES = 1;
export const boardOf = (session: Pick<ColorSortSession, 'tubes'>): Board => session.tubes.map(tube => tube.map(unit => unit.color));

function revealSurface(tubes: LiquidUnit[][], known: number[]): number[] {
  const result = new Set(known);
  for (const tube of tubes) for (const unit of tube.slice(tube.length - topRun(tube.map(item => item.color)))) result.add(unit.id);
  return [...result];
}

export function createSession(definition: ColorSortLevel): ColorSortSession {
  let id = 0;
  const tubes = definition.board.map(tube => tube.map(color => ({ color, id: id++ })));
  const occupied = tubes.flatMap((tube, index) => tube.length ? [index] : []);
  const hidden = new Set(shuffled(occupied, seededRandom(definition.seed ^ 0x7F4A7C15)).slice(0, definition.hiddenTubes));
  const revealed = tubes.flatMap((tube, index) => tube.filter((_, depth) => !hidden.has(index) || depth >= definition.hiddenDepth).map(unit => unit.id));
  return { tubes, revealed: revealSurface(tubes, revealed), moves: 0, bonusMoves: 0, hints: 0, extraTubes: 0, undos: 0, history: [] };
}

export function pourSession(state: ColorSortSession, definition: ColorSortLevel, move: Move) {
  const result = pour(boardOf(state), definition.rules, move);
  if (!result) return null;
  const tubes = state.tubes.slice();
  const units = tubes[move.from].slice(-result.amount);
  tubes[move.from] = tubes[move.from].slice(0, -result.amount);
  tubes[move.to] = [...tubes[move.to], ...units];
  const next: ColorSortSession = { ...state, tubes, moves: state.moves + 1,
    history: [...state.history, { tubes: state.tubes, moves: state.moves }].slice(-50),
    revealed: revealSurface(tubes, [...state.revealed, ...units.map(unit => unit.id)]) };
  return { session: next, amount: result.amount, color: result.color };
}

export function undoSession(state: ColorSortSession): ColorSortSession | null {
  const last = state.history[state.history.length - 1];
  if (!last) return null;
  return { ...state, tubes: last.tubes, moves: last.moves, undos: state.undos + 1, history: state.history.slice(0, -1),
    // Undo moves liquid, but does not erase knowledge of a revealed layer.
    revealed: revealSurface(last.tubes, state.revealed) };
}

export function addTube(state: ColorSortSession): ColorSortSession | null {
  if (state.extraTubes >= MAX_EXTRA_TUBES) return null;
  return { ...state, tubes: [...state.tubes, []], extraTubes: state.extraTubes + 1, history: [] };
}

export const remainingMoves = (state: ColorSortSession, definition: ColorSortLevel) => definition.moveLimit === null
  ? null : Math.max(0, definition.moveLimit + state.bonusMoves - state.moves);

function validSession(value: unknown, definition: ColorSortLevel): value is ColorSortSession {
  if (!value || typeof value !== 'object') return false;
  const state = value as ColorSortSession, original = createSession(definition).tubes.flat();
  const validTubes = (tubes: unknown): tubes is LiquidUnit[][] => {
    if (!Array.isArray(tubes) || tubes.length < definition.board.length || tubes.length > definition.board.length + MAX_EXTRA_TUBES
      || tubes.some(tube => !Array.isArray(tube) || tube.some(unit => !unit || !Number.isInteger(unit.id) || original[unit.id]?.color !== unit.color))) return false;
    const units = tubes.flat();
    return units.length === original.length && new Set(units.map(unit => unit.id)).size === original.length
      && validateBoard(tubes.map(tube => tube.map(unit => unit.color)), definition.colors, definition.rules);
  };
  const integer = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value <= max;
  return validTubes(state.tubes) && integer(state.moves, 10_000) && integer(state.bonusMoves, 60)
    && integer(state.hints, MAX_HINTS) && integer(state.extraTubes, MAX_EXTRA_TUBES) && integer(state.undos, 10_000)
    && state.tubes.length === definition.board.length + state.extraTubes
    && Array.isArray(state.revealed) && state.revealed.length <= original.length
    && state.revealed.every(id => integer(id, original.length - 1))
    && Array.isArray(state.history) && state.history.length <= 50
    && state.history.every(snapshot => snapshot && validTubes(snapshot.tubes) && integer(snapshot.moves, state.moves));
}

export function readSavedSession(definition: ColorSortLevel): ColorSortSession | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw || raw.length > 150_000) return null;
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || saved.level !== definition.level || saved.seed !== definition.seed || !validSession(saved.session, definition)) return null;
    return { ...saved.session, revealed: revealSurface(saved.session.tubes, saved.session.revealed) };
  } catch { return null; }
}

export function saveSession(state: ColorSortSession, definition: ColorSortLevel) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, level: definition.level, seed: definition.seed, session: state })); }
  catch { /* Local gameplay remains available when storage is full or private. */ }
}

export function clearSavedSession(definition: ColorSortLevel) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved?.level === definition.level && saved?.seed === definition.seed) localStorage.removeItem(SAVE_KEY);
  } catch { /* Nothing to clear. */ }
}
