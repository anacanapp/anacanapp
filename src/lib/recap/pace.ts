/**
 * Reveal schedule shared by the renderer (when each element animates in) and the model (how long a scene
 * must last). Rule: every scene holds fully built — all text visible, counters finished — for at least
 * HOLD seconds before its exit transition.
 */
import type { RecapScene, StatScene, UntimedScene } from './types';

export const PACE = {
  hold: 1.8,
  exit: 0.36,
  word: 0.5,          // one word's rise-in
  stagger: 0.035,     // between words of a sentence
  pill: 0.45,         // a pill / chip / badge popping in
  numberStart: 0.3,
  numberCount: 1.2,
  numberPop: 0.4,
  lineDelay: 0.7,     // headline sentence after the number has started
  subGap: 0.15,
  chipGap: 0.1,
  calendar: 1.4,
} as const;

/** Word tokens as the renderer lays them out (Chinese / Japanese break per character). */
export function tokenize(text: string, cjk: boolean): string[] {
  if (!cjk) return text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const re = /[A-Za-z0-9.,:%+\-→·]+|[\s]+|[　-〿＀-￯，。！？、：」』）]|./gu;
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    if (/^\s+$/.test(tok)) continue;
    if (out.length && /^[　-〿＀-￯，。！？、：」』）]$/u.test(tok)) out[out.length - 1] += tok;
    else out.push(tok);
  }
  return out;
}

/** End of a staggered sentence starting at `delay`. */
export const sentenceEnd = (text: string, cjk: boolean, delay: number, stagger: number = PACE.stagger) =>
  delay + Math.max(0, tokenize(text, cjk).length - 1) * stagger + PACE.word;

export interface StatPlan { number: number; line: number; subs: number[]; chips: number; calendar: number; badge: number; built: number }

/** When each part of a stat scene appears, and when the scene is fully built. */
export function statPlan(s: Pick<StatScene, 'line' | 'subs' | 'chips' | 'badge' | 'motif' | 'param'>, cjk: boolean): StatPlan {
  const lineEnd = sentenceEnd(s.line, cjk, PACE.lineDelay);
  let t = PACE.lineDelay + 0.2 + Math.max(0, tokenize(s.line, cjk).length - 1) * PACE.stagger;
  let built = Math.max(PACE.numberStart + PACE.numberCount + PACE.numberPop, lineEnd);
  const calendar = s.motif === 'calendar' && s.param * 365 >= 30 ? t - 0.2 : -1;
  if (calendar >= 0) { built = Math.max(built, calendar + 0.1 + PACE.calendar); t += 0.3; }
  const subs = s.subs.map((_, i) => t + i * PACE.subGap);
  if (subs.length) { built = Math.max(built, subs[subs.length - 1] + PACE.pill); t = subs[subs.length - 1] + PACE.subGap; }
  const chips = s.chips.length ? t : -1;
  if (chips >= 0) { built = Math.max(built, chips + (s.chips.length - 1) * PACE.chipGap + PACE.pill); t = chips + s.chips.length * PACE.chipGap; }
  const badge = s.badge ? t + 0.05 : -1;
  if (badge >= 0) built = Math.max(built, badge + 0.55);
  if (s.motif === 'glasses') built = Math.max(built, 0.4 + 7 * 0.1 + 0.6);
  return { number: PACE.numberStart, line: PACE.lineDelay, subs, chips, calendar, badge, built };
}

/** Seconds from the scene start until everything is on screen. */
export function sceneBuildTime(s: UntimedScene | RecapScene, cjk: boolean): number {
  switch (s.kind) {
    case 'cold': return Math.max(0.5 + 3 * 0.12 + 0.8, sentenceEnd(s.title, cjk, 1.2, 0.06));
    case 'stat': return statPlan(s, cjk).built;
    case 'journey': return Math.max(0.3 + (s.stages.length - 1) * 0.45 + 0.6, sentenceEnd(s.line, cjk, 0.4 + s.stages.length * 0.45));
    case 'milestones': {
      const n = s.items.length + (s.more ? 1 : 0);
      return Math.max(0.3 + 1.0, 0.8 + Math.max(0, n - 1) * 0.22 + 0.5, sentenceEnd(s.line, cjk, 0.9 + n * 0.22));
    }
    case 'growth': return Math.max(0.6 + 1.0 + 0.4, 0.5 + 1.1, sentenceEnd(s.line, cjk, 0.9));
    case 'peak': return Math.max(s.burst + (s.stats.length - 1) * 0.25 + 0.8, sentenceEnd(s.close, cjk, s.burst + 0.2 + s.stats.length * 0.2, 0.06));
    case 'persona': return Math.max(1.1, sentenceEnd(s.title, cjk, 0.5, 0.1), sentenceEnd(s.reason, cjk, 0.9, 0.03));
    case 'summary': return 0.6 + 3 * 0.15 + 1.0;
    case 'outro': return 1.9;
  }
}

/** Shortest duration that still holds the built scene for PACE.hold seconds. */
export const minSceneDuration = (s: Parameters<typeof sceneBuildTime>[0], cjk: boolean, last = false) =>
  sceneBuildTime(s, cjk) + PACE.hold + (last ? 0 : PACE.exit);
