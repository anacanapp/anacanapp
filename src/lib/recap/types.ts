/** Anacan Recap — server data (anacan_recap_v1) and the scene model the renderer draws. */

export type RecapStage = 'flow' | 'bump' | 'mommy';

export interface RecapTool { id: string; count: number }

export interface RecapMommy {
  child_name: string | null;
  child_birth_date: string | null;
  born_this_year: boolean;
  feedings: number;
  night_feedings: number;
  sleeps: number;
  sleep_hours: number;
  longest_sleep_hours: number;
  diapers: number;
  milestones: number;
  milestone_ids: string[];
  growth_entries: number;
  weight_start_kg: number | null;
  weight_end_kg: number | null;
  photos: number;
  feedings_top_pct: number | null;
}

export interface RecapBump {
  due_date: string | null;
  week_start: number;
  week_end: number;
  kick_sessions: number;
  kicks: number;
  max_kicks_session: number;
  kicks_top_pct: number | null;
  bag_items_ready: number;
  favorite_names: number;
}

export interface RecapFlow {
  cycles: number;
  avg_cycle_length: number | null;
  avg_period_length: number | null;
  period_days_logged: number;
  days_logged: number;
  top_symptom: string | null;
  mood_avg: number | null;
  water_glasses: number;
  logging_top_pct: number | null;
  goal: string | null;
}

export interface RecapData {
  available: true;
  preview: boolean;
  year: number;
  name: string | null;
  stage: RecapStage | null;
  stages: RecapStage[];
  member_since: string | null;
  first_open_this_year: string | null;
  days_active: number;
  longest_streak: number;
  favorite_hour: number | null;
  top_tools: RecapTool[];
  ai_questions: number;
  posts_read: number;
  likes: number;
  comments: number;
  posts: number;
  game_plays: number;
  achievements: number;
  is_premium: boolean;
  mommy: RecapMommy | null;
  bump: RecapBump | null;
  flow: RecapFlow | null;
}

export interface RecapUnavailable { available: false; reason: string; opens_at: string | null }

export type RecapResult = RecapData | RecapUnavailable;

// ── Parsing (the RPC returns jsonb; numbers may arrive as strings) ─────────────────────────
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isStage = (v: unknown): v is RecapStage => v === 'flow' || v === 'bump' || v === 'mommy';

export function parseRecap(raw: unknown): RecapResult {
  const r = obj(raw);
  if (!r || r.available !== true) {
    return { available: false, reason: str(r?.reason) ?? 'unknown', opens_at: str(r?.opens_at) };
  }
  const m = obj(r.mommy), b = obj(r.bump), f = obj(r.flow);
  const hour = numOrNull(r.favorite_hour);
  return {
    available: true,
    preview: r.preview === true,
    year: num(r.year) || 2026,
    name: str(r.name),
    stage: isStage(r.stage) ? r.stage : null,
    stages: Array.isArray(r.stages) ? (r.stages.filter(isStage) as RecapStage[]).filter((s, i, a) => a.indexOf(s) === i) : [],
    member_since: str(r.member_since),
    first_open_this_year: str(r.first_open_this_year),
    days_active: Math.round(num(r.days_active)),
    longest_streak: Math.round(num(r.longest_streak)),
    favorite_hour: hour != null && hour >= 0 && hour <= 23 ? Math.floor(hour) : null,
    top_tools: Array.isArray(r.top_tools)
      ? r.top_tools.map(obj).filter((t): t is Raw => !!t && !!str(t.id)).map((t) => ({ id: str(t.id)!, count: num(t.count) })).filter((t) => t.count > 0)
      : [],
    ai_questions: num(r.ai_questions),
    posts_read: num(r.posts_read),
    likes: num(r.likes),
    comments: num(r.comments),
    posts: num(r.posts),
    game_plays: num(r.game_plays),
    achievements: num(r.achievements),
    is_premium: r.is_premium === true,
    mommy: m ? {
      child_name: str(m.child_name),
      child_birth_date: str(m.child_birth_date),
      born_this_year: m.born_this_year === true,
      feedings: num(m.feedings),
      night_feedings: num(m.night_feedings),
      sleeps: num(m.sleeps),
      sleep_hours: num(m.sleep_hours),
      longest_sleep_hours: num(m.longest_sleep_hours),
      diapers: num(m.diapers),
      milestones: num(m.milestones),
      milestone_ids: Array.isArray(m.milestone_ids) ? m.milestone_ids.map(str).filter((x): x is string => !!x) : [],
      growth_entries: num(m.growth_entries),
      weight_start_kg: numOrNull(m.weight_start_kg),
      weight_end_kg: numOrNull(m.weight_end_kg),
      photos: num(m.photos),
      feedings_top_pct: numOrNull(m.feedings_top_pct),
    } : null,
    bump: b ? {
      due_date: str(b.due_date),
      week_start: num(b.week_start),
      week_end: num(b.week_end),
      kick_sessions: num(b.kick_sessions),
      kicks: num(b.kicks),
      max_kicks_session: num(b.max_kicks_session),
      kicks_top_pct: numOrNull(b.kicks_top_pct),
      bag_items_ready: num(b.bag_items_ready),
      favorite_names: num(b.favorite_names),
    } : null,
    flow: f ? {
      cycles: num(f.cycles),
      avg_cycle_length: numOrNull(f.avg_cycle_length),
      avg_period_length: numOrNull(f.avg_period_length),
      period_days_logged: num(f.period_days_logged),
      days_logged: num(f.days_logged),
      top_symptom: str(f.top_symptom),
      mood_avg: numOrNull(f.mood_avg),
      water_glasses: num(f.water_glasses),
      logging_top_pct: numOrNull(f.logging_top_pct),
      goal: str(f.goal),
    } : null,
  };
}

// ── Scene model ─────────────────────────────────────────────────────────────────────────────

/** Background: top colour, bottom colour, glow colour. `ink` is the text colour family. */
export interface RecapLook { bg: [string, string, string]; ink: 'light' | 'dark'; accent: string }

export type RecapMotif =
  | 'calendar' | 'bloom' | 'moons' | 'bubbles' | 'pulse' | 'ring' | 'orb' | 'glasses' | 'clock'
  | 'sparkle' | 'hearts' | 'stars' | 'gift' | 'names';

export interface RecapStat { n: number; decimals: number; text?: string; label: string }

interface SceneBase {
  id: string;
  start: number;
  end: number;
  look: RecapLook;
  seed: number;
}

export interface ColdScene extends SceneBase { kind: 'cold'; year: number; title: string }
export interface StatScene extends SceneBase {
  kind: 'stat';
  motif: RecapMotif;
  eyebrow: string;
  /** Counted value (n with decimals) or a fixed text such as "22:00" when `text` is set. */
  value: RecapStat;
  line: string;
  subs: string[];
  badge: string | null;
  chips: string[];
  /** Motif parameter: fill ratio (calendar), hour (clock), mood 1-5 (orb), ring from/to etc. */
  param: number;
  param2: number;
}
export interface JourneyScene extends SceneBase { kind: 'journey'; eyebrow: string; stages: string[]; line: string }
export interface MilestonesScene extends SceneBase { kind: 'milestones'; eyebrow: string; value: RecapStat; items: string[]; more: string | null; line: string }
export interface GrowthScene extends SceneBase { kind: 'growth'; eyebrow: string; from: RecapStat; to: RecapStat; gain: string; fromLabel: string; toLabel: string; line: string }
export interface PeakScene extends SceneBase { kind: 'peak'; lead: string; stats: RecapStat[]; close: string; burst: number }
export interface PersonaScene extends SceneBase { kind: 'persona'; persona: RecapPersona; eyebrow: string; title: string; reason: string }
export interface SummaryScene extends SceneBase { kind: 'summary'; name: string | null; year: number; kicker: string; stats: RecapStat[]; persona: string; site: string }
export interface OutroScene extends SceneBase { kind: 'outro'; tagline: string; site: string; stores: string }

export type RecapScene = ColdScene | StatScene | JourneyScene | MilestonesScene | GrowthScene | PeakScene | PersonaScene | SummaryScene | OutroScene;

export type RecapPersona = 'night' | 'planner' | 'knowledge' | 'community' | 'caring';

export interface RecapModel {
  version: 1;
  year: number;
  language: string;
  locale: string;
  rtl: boolean;
  /** Character-wrapped scripts (no spaces between words). */
  cjk: boolean;
  stage: RecapStage | null;
  persona: RecapPersona;
  scenes: RecapScene[];
  duration: number;
  /** Music: beat period (s) and the second the music starts to fade out. */
  beat: number;
  fadeStart: number;
  /** Musical hits (the drop, the lift) where the renderer adds a light flash. */
  hits: number[];
}
