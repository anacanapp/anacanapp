import { describe, it, expect } from 'vitest';
import {
  evaluate511,
  computeContractionStats,
  startToStartSeconds,
  pruneQueue,
  mergeWithQueue,
  parseQueue,
  type QueuedContraction,
} from './laborUtils';

// 5-1-1 qaydası: "indi xəstəxanaya get" siqnalını verir. Səhv həddlər ya
// hamiləni yalnış həyəcanlandıra, ya da HƏQİQİ doğuşu qaçıra bilər.
const T0 = new Date('2026-11-08T10:00:00Z').getTime();

/** n contractions every `gapSec` seconds (start to start), each `durSec` long. Newest last in time. */
function series(n: number, gapSec: number, durSec: number, startMs = T0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    start_time: new Date(startMs + i * gapSec * 1000).toISOString(),
    duration_seconds: durSec,
  }));
}
const lastStart = (list: { start_time: string }[]) => new Date(list[list.length - 1].start_time).getTime();

describe('evaluate511', () => {
  it('triggers after about an hour of contractions 5 min apart lasting 1 min', () => {
    const list = series(13, 300, 60); // 12 gaps x 5 min = 60 min
    expect(evaluate511(list, lastStart(list) + 90_000)).toBe(true);
  });

  it('counts 55-second contractions as "about a minute"', () => {
    const list = series(13, 300, 55);
    expect(evaluate511(list, lastStart(list) + 60_000)).toBe(true);
  });

  it('uses start-to-start intervals: 60 s contractions with 4 min rest (5 min start to start) trigger', () => {
    // Old code stored end-to-start rest (240 s). Start to start is 300 s.
    const list = series(13, 300, 60);
    const stats = computeContractionStats(list, lastStart(list) + 30_000);
    expect(stats.avgInterval).toBe(300);
    expect(stats.is511).toBe(true);
  });

  it('does NOT trigger before about an hour of the pattern (3 contractions used to be enough)', () => {
    expect(evaluate511(series(3, 300, 60), T0 + 600_000 + 30_000)).toBe(false);
    const list = series(10, 300, 60); // 45 min
    expect(evaluate511(list, lastStart(list) + 30_000)).toBe(false);
  });

  it('does NOT trigger when contractions are further apart than ~5 minutes', () => {
    const list = series(13, 360, 60);
    expect(evaluate511(list, lastStart(list) + 30_000)).toBe(false);
  });

  it('does NOT trigger for short contractions (Braxton Hicks style)', () => {
    const list = series(13, 300, 30);
    expect(evaluate511(list, lastStart(list) + 30_000)).toBe(false);
  });

  it('does NOT trigger from old history once the contractions stopped', () => {
    const list = series(13, 300, 60);
    expect(evaluate511(list, lastStart(list) + 3 * 60 * 60 * 1000)).toBe(false);
  });

  it('only counts the current run: a long pause breaks it', () => {
    const early = series(8, 300, 60, T0);
    const late = series(6, 300, 60, T0 + 2 * 60 * 60 * 1000);
    const list = [...early, ...late];
    expect(evaluate511(list, lastStart(late) + 30_000)).toBe(false);
  });

  it('ignores duplicate starts (a queued copy of a synced row)', () => {
    const list = series(13, 300, 60);
    const dup = [...list, { ...list[5], id: 'dup' }];
    expect(evaluate511(dup, lastStart(list) + 30_000)).toBe(true);
  });

  it('handles empty and single lists', () => {
    expect(evaluate511([], T0)).toBe(false);
    expect(evaluate511(series(1, 300, 60), T0)).toBe(false);
    expect(computeContractionStats([], T0)).toEqual({ avgDuration: 0, avgInterval: 0, is511: false, count: 0 });
  });
});

describe('computeContractionStats', () => {
  it('leaves pauses over an hour out of the average interval', () => {
    const list = [...series(2, 300, 60, T0), ...series(2, 300, 60, T0 + 5 * 60 * 60 * 1000)];
    expect(computeContractionStats(list, T0).avgInterval).toBe(300);
  });
});

describe('startToStartSeconds', () => {
  it('returns null without a recent previous start', () => {
    expect(startToStartSeconds(null, T0)).toBeNull();
    expect(startToStartSeconds(T0 - 2 * 60 * 60 * 1000, T0)).toBeNull();
    expect(startToStartSeconds(T0 + 1000, T0)).toBeNull();
    expect(startToStartSeconds(T0 - 299_600, T0)).toBe(300);
  });
});

describe('offline queue', () => {
  const q = (id: string, iso: string): QueuedContraction => ({ id, start_time: iso, duration_seconds: 60, interval_seconds: null });

  it('drops queue entries already on the server (by id or by start time) and duplicates', () => {
    const queue = [q('a', '2026-11-08T10:00:00.000Z'), q('b', '2026-11-08T10:05:00.000Z'), q('c', '2026-11-08T10:10:00.000Z'), q('c2', '2026-11-08T10:10:00.300Z')];
    const server = [{ id: 'a', start_time: '2026-11-08T10:00:00.000Z' }, { id: 'srv', start_time: '2026-11-08T10:05:00.400Z' }];
    expect(pruneQueue(queue, server).map((x) => x.id)).toEqual(['c']);
  });

  it('merges pending rows into the list, newest first', () => {
    const server = [{ id: 'srv', start_time: '2026-11-08T10:00:00.000Z', duration_seconds: 50 }];
    const merged = mergeWithQueue(server, [q('p', '2026-11-08T10:06:00.000Z')]);
    expect(merged.map((m) => m.id)).toEqual(['p', 'srv']);
    expect((merged[0] as { pending?: boolean }).pending).toBe(true);
  });

  it('parses a stored queue defensively', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    const ok = q('x', '2026-11-08T10:00:00.000Z');
    expect(parseQueue(JSON.stringify([ok, { id: 1 }, { ...ok, start_time: 'bad' }]))).toEqual([ok]);
  });
});
