/**
 * "Your 2026 type" — a data-driven table. Each persona has the stages it applies to, scoring terms over the
 * person's numbers, and its copy keys: recap_persona_<id> (title) and recap_persona_<id>_why_<1..lines>.
 * To add a persona: add a row here and its keys to copy.ts and the 23 locale files (the i18n test checks).
 *
 * A term adds `weight × ramp(value)`, where the ramp goes 0 → 1 between `from` and `to`. The highest score
 * wins (ties: table order). `base` is a floor so the fallback (caring) wins when nothing stands out.
 */
import type { RecapData, RecapStage } from './types';

export interface PersonaFeatures {
  night_hour: number; night_feedings: number; night_share: number; streak: number; days_active: number;
  bag_items: number; flow_days: number; kick_sessions: number; feedings: number; milestones: number; sleep_hours: number;
  ai_questions: number; posts_read: number; social: number; water: number; games: number;
}

export interface PersonaTerm { input: keyof PersonaFeatures; from: number; to: number; weight: number }

export interface PersonaDef {
  id: string;
  stages: Array<RecapStage | 'all'>;
  base?: number;
  terms: PersonaTerm[];
  /** Number of alternative "why" lines (recap_persona_<id>_why_1 … _why_<lines>). */
  lines: number;
}

export const RECAP_PERSONA_TABLE: PersonaDef[] = [
  { id: 'night', stages: ['all'], lines: 2, terms: [
    { input: 'night_hour', from: 0, to: 1, weight: 2 },
    { input: 'night_feedings', from: 10, to: 30, weight: 1.5 },
    { input: 'night_share', from: 0.1, to: 0.2, weight: 1 },
  ] },
  { id: 'planner', stages: ['all'], lines: 2, terms: [
    { input: 'streak', from: 7, to: 14, weight: 1.5 },
    { input: 'bag_items', from: 5, to: 10, weight: 1.2 },
    { input: 'flow_days', from: 30, to: 60, weight: 1.4 },
    { input: 'kick_sessions', from: 10, to: 20, weight: 0.8 },
    { input: 'feedings', from: 150, to: 300, weight: 0.6 },
  ] },
  { id: 'knowledge', stages: ['all'], lines: 2, terms: [
    { input: 'ai_questions', from: 8, to: 20, weight: 1.6 },
    { input: 'posts_read', from: 20, to: 50, weight: 1.2 },
  ] },
  { id: 'community', stages: ['all'], lines: 2, terms: [
    { input: 'social', from: 15, to: 40, weight: 2 },
  ] },
  { id: 'caring', stages: ['all'], base: 0.9, lines: 2, terms: [] },
];

export const DEFAULT_PERSONA = 'caring';

export function personaFeatures(d: RecapData): PersonaFeatures {
  const m = d.mommy, b = d.bump, f = d.flow;
  const nightHour = d.favorite_hour != null && (d.favorite_hour >= 22 || d.favorite_hour < 5);
  return {
    night_hour: nightHour ? 1 : 0,
    night_feedings: m?.night_feedings ?? 0,
    night_share: m && m.feedings > 0 ? m.night_feedings / m.feedings : 0,
    streak: d.longest_streak,
    days_active: d.days_active,
    bag_items: b?.bag_items_ready ?? 0,
    flow_days: f?.days_logged ?? 0,
    kick_sessions: b?.kick_sessions ?? 0,
    feedings: m?.feedings ?? 0,
    milestones: m?.milestones ?? 0,
    sleep_hours: m?.sleep_hours ?? 0,
    ai_questions: d.ai_questions,
    posts_read: d.posts_read,
    social: d.likes + d.comments * 2 + d.posts * 3,
    water: f?.water_glasses ?? 0,
    games: d.game_plays,
  };
}

const ramp = (v: number, from: number, to: number) => (to === from ? (v >= to ? 1 : 0) : Math.max(0, Math.min(1, (v - from) / (to - from))));

export function scorePersona(def: PersonaDef, x: PersonaFeatures): number {
  return (def.base ?? 0) + def.terms.reduce((sum, term) => sum + term.weight * ramp(x[term.input], term.from, term.to), 0);
}

export function pickPersonaDef(d: RecapData, table: PersonaDef[] = RECAP_PERSONA_TABLE): PersonaDef {
  const x = personaFeatures(d);
  const stage = d.stage;
  const eligible = table.filter((p) => p.stages.includes('all') || (stage != null && p.stages.includes(stage)));
  let best = eligible.find((p) => p.id === DEFAULT_PERSONA) ?? eligible[0] ?? table[0];
  let bestScore = -Infinity;
  for (const p of eligible) {
    const sc = scorePersona(p, x);
    if (sc > bestScore + 1e-9) { best = p; bestScore = sc; }
  }
  return best;
}

/** Deterministic FNV-1a hash. */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Which "why" line (1-based) this person gets, stable for the same person and year. */
export const pickWhyLine = (def: PersonaDef, seed: string, year: number) => (hashText(`${seed}|${year}|${def.id}`) % Math.max(1, def.lines)) + 1;
