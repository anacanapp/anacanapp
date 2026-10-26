import { cacheLevel, getCachedLevel, getFallbackLevel, knownSolutionMove, validateLevel } from './levels';
import { inspectPour, type Board, type Move } from './engine';
import { normalizeLevel, type ColorSortLevel } from './difficulty';

function workerRequest<T>(message: unknown, fallback: T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted || typeof Worker === 'undefined') return Promise.resolve(fallback);
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new Worker(new URL('./color-sort.worker.ts', import.meta.url), { type: 'module' }); }
    catch { resolve(fallback); return; }
    let finished = false;
    const finish = (value: T) => {
      if (finished) return;
      finished = true; clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate(); resolve(value);
    };
    const abort = () => finish(fallback);
    const timeout = setTimeout(abort, 4500);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => finish(event.data);
    worker.onerror = () => finish(fallback);
    try { worker.postMessage(message); } catch { finish(fallback); }
  });
}

export async function loadColorSortLevel(input: number, signal?: AbortSignal): Promise<ColorSortLevel> {
  const level = normalizeLevel(input), cached = getCachedLevel(level);
  if (cached) return cached;
  const fallback = getFallbackLevel(level);
  const result = await workerRequest<{ level?: ColorSortLevel }>({ kind: 'level', level }, { level: fallback }, signal);
  const definition = validateLevel(result.level, level) ? result.level : fallback;
  if (!signal?.aborted) cacheLevel(definition);
  return definition;
}

export async function requestColorSortHint(definition: ColorSortLevel, board: Board, signal?: AbortSignal): Promise<Move | null> {
  const known = knownSolutionMove(definition, board);
  if (known && inspectPour(board, definition.rules, known.from, known.to).amount > 0) return known;
  const result = await workerRequest<{ move?: Move }>({ kind: 'hint', board, rules: definition.rules }, {}, signal);
  const move = result.move;
  return move && inspectPour(board, definition.rules, move.from, move.to).amount > 0 ? move : null;
}
