import { solve } from './engine';
import { generateLevel } from './generator';
import { getFallbackLevel } from './levels';
import type { Board, Rules } from './engine';

type Request = { kind: 'level'; level: number } | { kind: 'hint'; board: Board; rules: Rules };
self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.kind === 'level') {
      const level = generateLevel(request.level, { maxAttempts: 24, maxNodes: 30_000, maxMilliseconds: 2200 })
        ?? getFallbackLevel(request.level);
      self.postMessage({ kind: 'level', level });
    } else {
      const result = solve(request.board, request.rules, { maxNodes: 45_000, maxMilliseconds: 2200 });
      self.postMessage({ kind: 'hint', move: result.status === 'solved' ? result.moves[0] ?? null : null });
    }
  } catch { self.postMessage({ kind: request.kind, error: true }); }
};
