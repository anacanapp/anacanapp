import './setup';
import { boardKey, legalMoves, segmentCount, solve, inspectPour, type Board } from '@/components/games/color-sort/engine';
import { BUNDLED_LEVELS, cacheLevel, getCachedLevel, getFallbackLevel, knownSolutionMove, validateLevel } from '@/components/games/color-sort/levels';
import { generateLevel, permuteLevel, seededRandom, shuffled } from '@/components/games/color-sort/generator';
import { getLevelProfile, resultForLevel, rulesForProfile, normalizeLevel } from '@/components/games/color-sort/difficulty';
import { addTube, createSession, pourSession, readSavedSession, remainingMoves, saveSession, undoSession, boardOf, clearSavedSession } from '@/components/games/color-sort/session';
import { readLevelCount } from '@/components/games/color-sort/useColorSortLibrary';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

export function all() {
  const random = seededRandom(0xDEADBEEF);
  const primitives = {
    random: Array.from({ length: 12 }, () => random()),
    imulSeeds: [31, 100, 300].map(level => ({ level, permuteSeed: Math.imul(level, 0x27D4EB2D), genSeeds: [0, 1, 23].map(attempt => (Math.imul(level, 0x45D9F3B) + Math.imul(attempt + 1, 0x9E3779B9)) >>> 0) })),
    shuffled: shuffled(range(0, 15), seededRandom(7)),
    profiles: [0, 1, 2, 3, 6, 7, 11, 13, 19, 25, 28, 30, 35, 45, 300, 301, 2.7, -3].map(level => ({ input: level, profile: getLevelProfile(level), rules: rulesForProfile(getLevelProfile(level)), normalized: normalizeLevel(level) })),
    keys: [[[1, 0, 11]], [[10, 1, 1]], [[0, 0], [], [1, 1, 1, 1], [0, 0]]].map(board => ({ board, key: boardKey(board as Board, { capacity: 4, locks: [{ tube: 1, after: 1 }] }), segments: segmentCount(board as Board) })),
  };
  const bundled = BUNDLED_LEVELS.map(level => ({
    level,
    valid: validateLevel(level, level.level),
    solve: solve(level.board, level.rules),
    hint: solve(level.board, level.rules, { maxNodes: 45_000 }),
    legal: legalMoves(level.board, level.rules, false),
    legalPruned: legalMoves(level.board, level.rules, true),
  }));
  const generated = [31, 32, 33, 34, 40, 41, 50, 75, 100, 300].map(n => ({ level: n, value: generateLevel(n, { maxAttempts: 24, maxNodes: 30_000 }) }));
  const generatedTest = generateLevel(31, { maxAttempts: 40, maxNodes: 20_000 });
  const fallback = [...range(31, 40), 75, 100, 299, 300].map(n => ({ level: n, value: getFallbackLevel(n), valid: validateLevel(getFallbackLevel(n), n) }));
  const permuted = permuteLevel(BUNDLED_LEVELS[29], 1234);
  const blocked = solve([[0, 1, 0, 1], [1, 0, 1, 0], []], { capacity: 4, locks: [{ tube: 2, after: 1 }] });
  const depthLimit = solve(BUNDLED_LEVELS[0].board, BUNDLED_LEVELS[0].rules, { maxDepth: 0 });

  const sessions = [1, 4, 13, 16, 22, 25, 30].map(number => {
    const level = BUNDLED_LEVELS[number - 1];
    let session = createSession(level);
    const created = session;
    const steps: unknown[] = [];
    level.solution.forEach((move, index) => {
      const result = pourSession(session, level, move)!;
      session = result.session;
      steps.push({ move, amount: result.amount, color: result.color, moves: session.moves, revealed: session.revealed, left: remainingMoves(session, level) });
      if (index === 1) { session = undoSession(session)!; steps.push({ undo: true, revealed: session.revealed, board: boardOf(session) }); session = pourSession(session, level, move)!.session; }
      if (index === 2 && number === 4) { session = addTube(session)!; steps.push({ addTube: true, tubes: session.tubes.length }); }
    });
    localStorage.clear();
    saveSession(session, level);
    const raw = localStorage.getItem('anacan_colorsort_round_v1');
    const read = readSavedSession(level);
    clearSavedSession(level);
    return { number, created, steps, final: session, raw, read, cleared: localStorage.getItem('anacan_colorsort_round_v1'),
      result: resultForLevel(level, session.moves, session.hints, session.extraTubes, session.undos), invalidPour: pourSession(createSession(level), level, { from: 0, to: 0 }) };
  });
  const midSaves = [3, 16].map(number => {
    const level = BUNDLED_LEVELS[number - 1];
    let session = createSession(level);
    for (const move of level.solution.slice(0, 3)) session = pourSession(session, level, move)!.session;
    localStorage.clear(); saveSession(session, level);
    const raw = localStorage.getItem('anacan_colorsort_round_v1')!;
    const tampered = raw.replace('"hints":0', '"hints":9');
    localStorage.setItem('anacan_colorsort_round_v1', tampered);
    return { number, raw, tampered, readTampered: readSavedSession(level), known: knownSolutionMove(level, boardOf(session)), knownStart: knownSolutionMove(level, level.board), unknown: knownSolutionMove(level, [[9]]) };
  });
  const results = [[1, 3, 0, 0, 0], [7, 20, 0, 0, 2], [7, 30, 1, 0, 0], [20, 40, 2, 1, 10], [30, 200, 3, 0, 0]].map(([n, moves, hints, extra, undos]) =>
    ({ n, moves, hints, extra, undos, value: resultForLevel(BUNDLED_LEVELS[n - 1], moves, hints, extra, undos) }));
  const counts = [null, '', '44', '300', '1000', 'abc', '7', '-5', '30.5', ' 41 '].map(raw => {
    localStorage.clear(); if (raw !== null) localStorage.setItem('anacan_colorsort_level_count_v1', raw); return { raw, value: readLevelCount() };
  });
  localStorage.clear();
  localStorage.setItem('anacan_colorsort_level_v1_55', JSON.stringify(getFallbackLevel(55)));
  localStorage.setItem('anacan_colorsort_level_v1_33', JSON.stringify(getFallbackLevel(33)));
  const cacheTrace: unknown[] = [];
  for (const n of [...range(31, 54), 40, 60]) {
    cacheLevel(getFallbackLevel(n));
    cacheTrace.push({ n, index: localStorage.getItem('anacan_colorsort_level_index_v1'), keys: Object.keys(Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => [localStorage.key(i), 1]))).sort() });
  }
  const cachedRead = [31, 45, 60, 61].map(n => ({ n, value: getCachedLevel(n) }));
  const pours = [[[[0, 1, 1, 1], [0, 1, 1], []], 0, 1], [[[0, 1], [0], []], 0, 1], [[[0, 1, 1, 1], [0, 1, 1], []], 2, 0], [[[0, 0, 0, 0], [], []], 0, 1]].map(([board, from, to]) => ({ board, from, to, value: inspectPour(board as Board, { capacity: 4, locks: [] }, from as number, to as number) }));
  return { primitives, bundled, generated, generatedTest, fallback, permuted, blocked, depthLimit, sessions, midSaves, results, counts, cacheTrace, cachedRead, pours };
}
