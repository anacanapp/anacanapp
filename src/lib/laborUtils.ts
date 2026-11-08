// ============================================================
// laborUtils.ts — Doğuş/kontraksiya ilə bağlı saf (React-dan asılı olmayan)
// hesablama məntiqi. useContractions.ts-dən çıxarılıb ki, "get to the
// hospital now" siqnalı verən kritik qayda unit-test edilə bilsin.
//
// Everything works from timestamps (start_time + duration), never from timer
// ticks, so a locked screen cannot break durations or intervals.
// ============================================================

export interface TimedContraction {
  start_time: string;
  duration_seconds: number;
}

/**
 * 5-1-1 rule: contractions about 5 minutes apart (start to start), each lasting
 * about 1 minute, for about an hour. Small slack covers tap timing:
 *  - every start-to-start gap in the run is at most 5.5 minutes,
 *  - the run's average contraction lasts at least 50 seconds (a 55-second
 *    contraction is "about a minute"),
 *  - the run spans at least 55 minutes (first start to last start),
 *  - and it is still going: the newest contraction started within 15 minutes.
 */
export const RULE_511 = {
  maxGapSeconds: 330,
  minAvgDurationSeconds: 50,
  minSpanSeconds: 55 * 60,
  maxSinceLastStartSeconds: 15 * 60,
} as const;

/** Start-to-start gaps longer than this are a pause, not labour frequency. */
export const MAX_INTERVAL_SECONDS = 60 * 60;

const startMs = (c: TimedContraction) => new Date(c.start_time).getTime();

/** Valid entries, newest first. */
export function sortNewestFirst<T extends TimedContraction>(list: readonly T[]): T[] {
  return list
    .filter((c) => Number.isFinite(startMs(c)) && Number.isFinite(c.duration_seconds) && c.duration_seconds >= 0)
    .sort((a, b) => startMs(b) - startMs(a));
}

/** Start-to-start interval in whole seconds, or null when there is no recent previous contraction. */
export function startToStartSeconds(previousStartMs: number | null | undefined, currentStartMs: number): number | null {
  if (previousStartMs == null || !Number.isFinite(previousStartMs)) return null;
  const diff = (currentStartMs - previousStartMs) / 1000;
  if (diff <= 0 || diff > MAX_INTERVAL_SECONDS) return null;
  return Math.round(diff);
}

/** True when the recent contractions meet the 5-1-1 rule (see RULE_511). */
export function evaluate511(list: readonly TimedContraction[], now: number = Date.now()): boolean {
  const sorted = sortNewestFirst(list);
  if (sorted.length < 2) return false;
  const newest = sorted[0];
  if ((now - startMs(newest)) / 1000 > RULE_511.maxSinceLastStartSeconds) return false;

  const run: TimedContraction[] = [newest];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (startMs(run[run.length - 1]) - startMs(sorted[i])) / 1000;
    if (gap <= 0) continue; // duplicate start (e.g. a queued copy): ignore
    if (gap > RULE_511.maxGapSeconds) break;
    run.push(sorted[i]);
  }
  const span = (startMs(run[0]) - startMs(run[run.length - 1])) / 1000;
  if (span < RULE_511.minSpanSeconds) return false;
  const avgDuration = run.reduce((sum, c) => sum + c.duration_seconds, 0) / run.length;
  return avgDuration >= RULE_511.minAvgDurationSeconds;
}

export interface ContractionStats {
  avgDuration: number;
  avgInterval: number;
  is511: boolean;
  count: number;
}

/**
 * Averages over the 5 newest contractions. The interval is start to start,
 * computed from timestamps; gaps over an hour (a pause) are left out.
 */
export function computeContractionStats(list: readonly TimedContraction[], now: number = Date.now()): ContractionStats {
  const sorted = sortNewestFirst(list);
  const recent = sorted.slice(0, 5);
  if (recent.length === 0) return { avgDuration: 0, avgInterval: 0, is511: false, count: 0 };
  const avgDuration = Math.round(recent.reduce((sum, c) => sum + c.duration_seconds, 0) / recent.length);
  const gaps: number[] = [];
  for (let i = 0; i < recent.length - 1; i++) {
    const gap = startToStartSeconds(startMs(recent[i + 1]), startMs(recent[i]));
    if (gap != null) gaps.push(gap);
  }
  const avgInterval = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  return { avgDuration, avgInterval, is511: evaluate511(sorted, now), count: sorted.length };
}

// ------------------------------------------------------------
// Offline queue: entries that could not be inserted stay on the device and
// sync later. Deduped by the client-generated id, or by start time.
// ------------------------------------------------------------

export interface QueuedContraction {
  /** Client-generated UUID, sent as the row id so a retry can never duplicate. */
  id: string;
  start_time: string;
  duration_seconds: number;
  interval_seconds: number | null;
}

/** Same contraction when the id matches or the start times are within a second. */
export function isSameContraction(a: { id?: string; start_time: string }, b: { id?: string; start_time: string }) {
  if (a.id && b.id && a.id === b.id) return true;
  return Math.abs(new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) < 1000;
}

/** Queue entries not yet present on the server (and not duplicated within the queue). */
export function pruneQueue(queue: readonly QueuedContraction[], server: readonly { id: string; start_time: string }[]): QueuedContraction[] {
  const out: QueuedContraction[] = [];
  for (const q of queue) {
    if (server.some((s) => isSameContraction(s, q))) continue;
    if (out.some((o) => isSameContraction(o, q))) continue;
    out.push(q);
  }
  return out;
}

/** Server rows plus still-pending local rows, newest first. Pending rows carry `pending: true`. */
export function mergeWithQueue<T extends { id: string; start_time: string; duration_seconds: number }>(
  server: readonly T[],
  queue: readonly QueuedContraction[]
): Array<T | (QueuedContraction & { pending: true })> {
  const pending = pruneQueue(queue, server).map((q) => ({ ...q, pending: true as const }));
  return [...server, ...pending].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

/** Defensive parse of a stored queue. */
export function parseQueue(raw: string | null): QueuedContraction[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((q): q is QueuedContraction =>
      !!q && typeof q.id === 'string' && typeof q.start_time === 'string' &&
      Number.isFinite(new Date(q.start_time).getTime()) &&
      typeof q.duration_seconds === 'number' && Number.isFinite(q.duration_seconds) &&
      (q.interval_seconds === null || typeof q.interval_seconds === 'number'));
  } catch {
    return [];
  }
}
