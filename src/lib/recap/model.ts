/**
 * buildRecapModel — turns anacan_recap_v1 data into an ordered, timed list of scenes.
 * Pure and deterministic: same data + language + translations → the same model.
 *
 * Music map (recap-2026.mp3, 60/120 bpm): soft piano 0–16 s, full section from 16 s (the drop), a two-second
 * breath at 30–32 s, the brighter lift at 32 s, the tail from 48 s, silence after ~52 s. Scene cuts land on
 * these anchors; inside a section they are snapped to the half-second beat grid.
 */
import { appLanguageLocale, normalizeAppLanguage } from '@/lib/app-languages';
import { fillRecap, type RecapCopyKey, type RecapTranslate } from './copy';
import { formatHour, formatNumber, formatPercent, formatUnit, type RecapUnit } from './numbers';
import { minSceneDuration } from './pace';
import { pickPersonaDef, pickWhyLine } from './persona';
import type {
  ColdScene, RecapData, RecapLook, RecapModel, RecapMotif, RecapPersona, RecapScene, RecapStage, RecapStat, StatScene,
} from './types';

export interface RecapLabels {
  tool?: (id: string) => string | null | undefined;
  milestone?: (id: string) => string | null | undefined;
  symptom?: (id: string) => string | null | undefined;
}

/**
 * The music the video is cut to. Only these numbers change for a new track:
 *  drop   — first big hit (stage scenes start here)
 *  breath — start of the quiet bar before the lift (the emotional peak starts here, building)
 *  lift   — the second hit (confetti burst)
 *  tail   — the music starts to resolve / fade (outro starts here)
 *  end    — video end (music fades out from tail to end)
 */
export interface RecapMusic {
  src?: string; length: number; drop: number; breath: number; lift: number; tail: number; end: number; beat: number;
}

/** recap-2026.mp3 as measured: piano 0–16 s, drop 16 s, breath 30–32 s, lift 32 s, tail 48 s, silence ≈52 s. */
export const RECAP_MUSIC_2026: RecapMusic = { src: '/recap/recap-2026.mp3', length: 56, drop: 16, breath: 30, lift: 32, tail: 48, end: 52.2, beat: 0.5 };
/** @deprecated name kept for callers; use RECAP_MUSIC_2026. */
export const RECAP_TIMING = RECAP_MUSIC_2026;
export type RecapTiming = RecapMusic;

export interface BuildRecapOptions {
  labels?: RecapLabels;
  music?: RecapMusic;
  /** @deprecated use music */
  timing?: RecapMusic;
  /** Stable per-person seed (e.g. the user id) for picking alternative copy lines. */
  seed?: string;
}

// ── Looks (palette per scene) ─────────────────────────────────────────────────────────────────
const look = (bg: [string, string, string], ink: 'light' | 'dark', accent: string): RecapLook => ({ bg, ink, accent });
export const RECAP_LOOKS = {
  cold: look(['#12040C', '#3A0F23', '#FF5A5F'], 'light', '#FFB59E'),
  days: look(['#FF5A5F', '#FF9A7A', '#FFD3B8'], 'light', '#FFF1E8'),
  journey: look(['#2A0B24', '#B8325A', '#FFC977'], 'light', '#FFC977'),
  feed: look(['#3E0D2A', '#B92B4B', '#FF9A7A'], 'light', '#FFC4AE'),
  sleep: look(['#0F0C2A', '#2E2766', '#8C7CF0'], 'light', '#C9C0FF'),
  diapers: look(['#FFF4EC', '#FFC9B3', '#FF7A6B'], 'dark', '#E63E4B'),
  milestones: look(['#FFF1E8', '#FFB59E', '#FF5A5F'], 'dark', '#E63E4B'),
  growth: look(['#FF6F5B', '#FFA94D', '#FFE0A3'], 'light', '#FFF4D6'),
  weeks: look(['#22081D', '#7A1E48', '#FF8FA3'], 'light', '#FFB8C6'),
  kicks: look(['#FF5A5F', '#B81D47', '#FFB59E'], 'light', '#FFE1D6'),
  bag: look(['#FFF4EE', '#FFD0BE', '#FF5A5F'], 'dark', '#E63E4B'),
  cycles: look(['#2E0822', '#A3164F', '#FF8FA3'], 'light', '#FFC2D1'),
  flowdays: look(['#FF7A8A', '#E63E4B', '#FFD3C2'], 'light', '#FFF1E8'),
  water: look(['#0D2533', '#1D6A86', '#7FD8E8'], 'light', '#BFF0F7'),
  hourNight: look(['#0D0A24', '#2B235A', '#FFB59E'], 'light', '#FFD3B8'),
  hourMorning: look(['#FFC2A8', '#FFE7CF', '#FF5A5F'], 'dark', '#E63E4B'),
  hourDay: look(['#FF9A7A', '#FFD08A', '#FFF1D6'], 'dark', '#B8283E'),
  hourEvening: look(['#3D1433', '#D9534F', '#FFC977'], 'light', '#FFD9A0'),
  ai: look(['#140924', '#3E1A63', '#FF8FA3'], 'light', '#E7C9FF'),
  community: look(['#FF5A5F', '#FF8FA3', '#FFD3C2'], 'light', '#FFF1E8'),
  games: look(['#271C57', '#C4405E', '#FFC977'], 'light', '#FFE3A8'),
  peak: look(['#FF5A5F', '#FF8A5B', '#FFC977'], 'light', '#FFF4E0'),
  persona: look(['#16050F', '#4A1030', '#FFC977'], 'light', '#FFC977'),
  summary: look(['#FF5A5F', '#FF9C84', '#FFE1D4'], 'light', '#FFE1D4'),
  outro: look(['#FF6A63', '#E63E4B', '#FFB59E'], 'light', '#FFF1E8'),
} satisfies Record<string, RecapLook>;

/** Mood 1–5 → orb colour (soft lavender → warm gold). */
export const moodColor = (mood: number): string => {
  const stops = ['#9C8CF0', '#C9A2E8', '#FF9AB0', '#FFB07A', '#FFD36E'];
  return stops[Math.max(0, Math.min(4, Math.round(mood) - 1))];
};

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────
const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** Number in the app language (deterministic, see numbers.ts). The first argument is the app language code. */
export const formatRecapNumber = (lang: string, n: number, decimals = 0) => formatNumber(lang, n, decimals);
const unit = (lang: string, n: number, u: RecapUnit, decimals = 0) => formatUnit(lang, n, u, decimals);
const pct = (lang: string, n: number) => formatPercent(lang, Math.max(1, n));
const showPct = (v: number | null | undefined): v is number => typeof v === 'number' && v >= 0 && v <= 30;
const clean = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const CJK = new Set(['zh', 'ja']);

type Untimed<T> = T extends RecapScene ? Omit<T, 'start' | 'end'> : never;
type Draft = Untimed<RecapScene> & { priority?: number; order?: number };

interface Ctx {
  d: RecapData; lang: string; t: RecapTranslate; labels: RecapLabels; child: string | null;
}

const tf = (c: Ctx, key: RecapCopyKey, values: Record<string, string | number> = {}) => fillRecap(c.t(key), values);

function stat(c: Ctx, id: string, lk: RecapLook, motif: RecapMotif, eyebrow: string, value: RecapStat, line: string,
  extra: Partial<Pick<StatScene, 'subs' | 'badge' | 'chips' | 'param' | 'param2'>> = {}): Omit<StatScene, 'start' | 'end'> {
  return {
    kind: 'stat', id, look: lk, seed: hash(id), motif, eyebrow, value, line,
    subs: extra.subs ?? [], badge: extra.badge ?? null, chips: extra.chips ?? [], param: extra.param ?? 0, param2: extra.param2 ?? 0,
  };
}
const n0 = (n: number, label = ''): RecapStat => ({ n, decimals: 0, label });

// ── Scene candidates ──────────────────────────────────────────────────────────────────────────────
function mommyScenes(c: Ctx): Draft[] {
  const m = c.d.mommy;
  if (!m) return [];
  const out: Draft[] = [];
  const child = c.child;
  if (m.feedings > 0) {
    const subs = m.night_feedings > 0 ? [tf(c, 'recap_feed_night', { n: formatRecapNumber(c.lang, m.night_feedings) })] : [];
    out.push({ ...stat(c, 'mommy_feed', RECAP_LOOKS.feed, 'bloom', c.t('recap_feed_eyebrow'), n0(m.feedings),
      m.night_feedings >= 5 ? c.t('recap_feed_night_line') : c.t('recap_feed_line'),
      { subs, badge: showPct(m.feedings_top_pct) ? tf(c, 'recap_top_pct', { pct: pct(c.lang, m.feedings_top_pct) }) : null }), priority: 90, order: 10 });
  }
  if (m.sleep_hours >= 1) {
    out.push({ ...stat(c, 'mommy_sleep', RECAP_LOOKS.sleep, 'moons', c.t('recap_sleep_eyebrow'), n0(Math.round(m.sleep_hours)),
      child ? tf(c, 'recap_sleep_line_child', { child }) : c.t('recap_sleep_line'),
      { subs: m.longest_sleep_hours >= 1 ? [tf(c, 'recap_sleep_longest', { hours: unit(c.lang, m.longest_sleep_hours, 'hour', 1) })] : [],
        param: Math.max(3, Math.min(9, Math.round(m.sleep_hours / 150))) }), priority: 80, order: 20 });
  }
  if (m.diapers > 0) {
    out.push({ ...stat(c, 'mommy_diapers', RECAP_LOOKS.diapers, 'bubbles', c.t('recap_diaper_eyebrow'), n0(m.diapers), c.t('recap_diaper_line')), priority: 55, order: 30 });
  }
  const msLabels = m.milestone_ids.map((id) => clean(c.labels.milestone?.(id))).filter((x): x is string => !!x)
    .filter((x, i, a) => a.indexOf(x) === i);
  if (m.milestones > 0) {
    const items = msLabels.slice(0, 4);
    const rest = Math.max(0, m.milestones - items.length);
    out.push({
      kind: 'milestones', id: 'mommy_milestones', look: RECAP_LOOKS.milestones, seed: hash('mommy_milestones'),
      eyebrow: c.t('recap_ms_eyebrow'), value: n0(m.milestones), items,
      more: items.length && rest > 0 ? tf(c, 'recap_ms_more', { n: formatRecapNumber(c.lang, rest) }) : null,
      line: child ? tf(c, 'recap_ms_line_child', { child }) : c.t('recap_ms_line'), priority: 85, order: 40,
    });
  }
  const w0 = m.weight_start_kg ?? 0, w1 = m.weight_end_kg ?? 0;
  if (m.growth_entries >= 2 && w0 > 0 && w1 - w0 >= 0.1) {
    const gain = Math.round((w1 - w0) * 10) / 10;
    out.push({
      kind: 'growth', id: 'mommy_growth', look: RECAP_LOOKS.growth, seed: hash('mommy_growth'), eyebrow: c.t('recap_growth_eyebrow'),
      from: { n: w0, decimals: 1, label: unit(c.lang, w0, 'kilogram', 1) },
      to: { n: w1, decimals: 1, label: unit(c.lang, w1, 'kilogram', 1) },
      gain: tf(c, 'recap_growth_gain', { kg: unit(c.lang, gain, 'kilogram', 1) }), fromLabel: c.t('recap_growth_from'), toLabel: c.t('recap_growth_to'),
      line: child ? tf(c, 'recap_growth_line_child', { child, kg: unit(c.lang, gain, 'kilogram', 1) }) : tf(c, 'recap_growth_line', { kg: unit(c.lang, gain, 'kilogram', 1) }),
      priority: 75, order: 50,
    });
  }
  return out;
}

function bumpScenes(c: Ctx): Draft[] {
  const b = c.d.bump;
  if (!b) return [];
  const out: Draft[] = [];
  if (b.week_end > 0 && b.week_end > b.week_start) {
    const from = Math.max(1, Math.round(b.week_start)), to = Math.min(42, Math.round(b.week_end));
    out.push({ ...stat(c, 'bump_weeks', RECAP_LOOKS.weeks, 'ring', c.t('recap_weeks_eyebrow'),
      { n: to, decimals: 0, text: `${formatRecapNumber(c.lang, from)} → ${formatRecapNumber(c.lang, to)}`, label: '' }, c.t('recap_weeks_line'),
      { param: from, param2: to }), priority: 85, order: 10 });
  }
  if (b.kicks > 0) {
    out.push({ ...stat(c, 'bump_kicks', RECAP_LOOKS.kicks, 'pulse', c.t('recap_kicks_eyebrow'), n0(b.kicks), c.t('recap_kicks_line'),
      { subs: b.max_kicks_session > 1 ? [tf(c, 'recap_kicks_max', { n: formatRecapNumber(c.lang, b.max_kicks_session) })] : [],
        badge: showPct(b.kicks_top_pct) ? tf(c, 'recap_top_pct', { pct: pct(c.lang, b.kicks_top_pct) }) : null }), priority: 90, order: 20 });
  }
  if (b.bag_items_ready > 0) {
    out.push({ ...stat(c, 'bump_bag', RECAP_LOOKS.bag, 'gift', c.t('recap_bag_eyebrow'), n0(b.bag_items_ready), c.t('recap_bag_line'),
      { subs: b.favorite_names > 0 ? [tf(c, 'recap_names_sub', { n: formatRecapNumber(c.lang, b.favorite_names) })] : [] }), priority: 60, order: 30 });
  } else if (b.favorite_names > 0) {
    out.push({ ...stat(c, 'bump_names', RECAP_LOOKS.bag, 'names', c.t('recap_names_eyebrow'), n0(b.favorite_names), c.t('recap_names_line')), priority: 55, order: 30 });
  }
  return out;
}

function flowScenes(c: Ctx): Draft[] {
  const f = c.d.flow;
  if (!f) return [];
  const out: Draft[] = [];
  if (f.cycles > 0) {
    const subs: string[] = [];
    if (f.avg_cycle_length && f.avg_cycle_length >= 15) subs.push(tf(c, 'recap_cycles_avg', { days: unit(c.lang, Math.round(f.avg_cycle_length), 'day') }));
    if (f.avg_period_length && f.avg_period_length >= 1) subs.push(tf(c, 'recap_period_avg', { days: unit(c.lang, Math.round(f.avg_period_length), 'day') }));
    out.push({ ...stat(c, 'flow_cycles', RECAP_LOOKS.cycles, 'ring', c.t('recap_cycles_eyebrow'), n0(f.cycles), c.t('recap_cycles_line'),
      { subs, param: f.avg_period_length ?? 5, param2: f.avg_cycle_length ?? 28 }), priority: 88, order: 10 });
  }
  const logged = Math.max(f.days_logged, f.period_days_logged);
  if (logged > 0) {
    out.push({ ...stat(c, 'flow_days', RECAP_LOOKS.flowdays, 'calendar', c.t('recap_flowdays_eyebrow'), n0(logged), c.t('recap_flowdays_line'),
      { badge: showPct(f.logging_top_pct) ? tf(c, 'recap_top_pct', { pct: pct(c.lang, f.logging_top_pct) }) : null, param: Math.min(1, logged / 365) }), priority: 86, order: 20 });
  }
  if (f.mood_avg != null && f.mood_avg >= 1) {
    const mood = Math.max(1, Math.min(5, f.mood_avg));
    const word = mood < 2.5 ? c.t('recap_mood_1') : mood < 3.5 ? c.t('recap_mood_2') : mood < 4.3 ? c.t('recap_mood_3') : c.t('recap_mood_4');
    const symptom = f.top_symptom ? clean(c.labels.symptom?.(f.top_symptom)) : null;
    out.push({ ...stat(c, 'flow_mood', { ...RECAP_LOOKS.cycles, bg: ['#1E0A1E', '#4A1A3E', moodColor(mood)], accent: moodColor(mood) }, 'orb',
      c.t('recap_mood_eyebrow'), { n: mood, decimals: 1, text: word, label: '' }, c.t('recap_mood_line'),
      { subs: symptom ? [tf(c, 'recap_mood_symptom', { symptom })] : [], param: mood }), priority: 70, order: 30 });
  }
  if (f.water_glasses >= 5) {
    out.push({ ...stat(c, 'flow_water', RECAP_LOOKS.water, 'glasses', c.t('recap_water_eyebrow'), n0(f.water_glasses), c.t('recap_water_line')), priority: 50, order: 40 });
  }
  return out;
}

function anacanScenes(c: Ctx): Draft[] {
  const d = c.d;
  const out: Draft[] = [];
  const tools = d.top_tools.map((tool) => clean(c.labels.tool?.(tool.id))).filter((x): x is string => !!x).slice(0, 3);
  if (d.favorite_hour != null) {
    const h = d.favorite_hour;
    const band = h >= 22 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : 'evening';
    const lk = band === 'night' ? RECAP_LOOKS.hourNight : band === 'morning' ? RECAP_LOOKS.hourMorning : band === 'day' ? RECAP_LOOKS.hourDay : RECAP_LOOKS.hourEvening;
    const line = c.t(band === 'night' ? 'recap_hour_night' : band === 'morning' ? 'recap_hour_morning' : band === 'day' ? 'recap_hour_day' : 'recap_hour_evening');
    out.push({ ...stat(c, 'anacan_hour', lk, 'clock', c.t('recap_hour_eyebrow'), { n: h, decimals: 0, text: formatHour(h), label: '' }, line,
      { chips: tools, subs: tools.length ? [c.t('recap_tools_title')] : [], param: h }), priority: 58, order: 60 });
  }
  if (d.ai_questions > 0) {
    out.push({ ...stat(c, 'anacan_ai', RECAP_LOOKS.ai, 'sparkle', c.t('recap_ai_eyebrow'), n0(d.ai_questions), c.t('recap_ai_line')), priority: d.ai_questions >= 10 ? 57 : 45, order: 70 });
  }
  const social = d.likes + d.comments + d.posts;
  if (d.posts_read > 0 || social > 0) {
    const chips = [
      d.posts_read > 0 && d.likes > 0 ? tf(c, 'recap_comm_likes', { n: formatRecapNumber(c.lang, d.likes) }) : null,
      d.comments > 0 ? tf(c, 'recap_comm_comments', { n: formatRecapNumber(c.lang, d.comments) }) : null,
      d.posts > 0 ? tf(c, 'recap_comm_posts', { n: formatRecapNumber(c.lang, d.posts) }) : null,
    ].filter((x): x is string => !!x);
    const reads = d.posts_read > 0;
    out.push({ ...stat(c, 'anacan_community', RECAP_LOOKS.community, 'hearts', c.t(reads ? 'recap_reads_eyebrow' : 'recap_likes_eyebrow'),
      n0(reads ? d.posts_read : d.likes || social), c.t('recap_comm_line'), { chips }), priority: d.posts_read >= 20 || social >= 10 ? 52 : 42, order: 80 });
  }
  if (d.game_plays > 0 || d.achievements > 0) {
    out.push({ ...stat(c, 'anacan_games', RECAP_LOOKS.games, 'stars', c.t(d.game_plays > 0 ? 'recap_games_eyebrow' : 'recap_games_eyebrow'),
      n0(d.game_plays || d.achievements), c.t('recap_games_line'),
      { chips: d.game_plays > 0 && d.achievements > 0 ? [tf(c, 'recap_achievements', { n: formatRecapNumber(c.lang, d.achievements) })] : [] }), priority: 20, order: 90 });
  }
  return out;
}

/** Journey is shown only for forward transitions (flow→bump→mommy); never for anything that could mean a loss. */
function journeyScene(c: Ctx): Draft | null {
  const order: RecapStage[] = ['flow', 'bump', 'mommy'];
  const s = c.d.stages;
  if (s.length < 2 || !s.includes('bump') || s[s.length - 1] !== c.d.stage) return null;
  for (let i = 1; i < s.length; i++) if (order.indexOf(s[i]) <= order.indexOf(s[i - 1])) return null;
  const line = s.length === 3 ? c.t('recap_journey_full') : s.includes('mommy') ? c.t('recap_journey_bump_mommy') : c.t('recap_journey_flow_bump');
  return {
    kind: 'journey', id: 'journey', look: RECAP_LOOKS.journey, seed: hash('journey'), eyebrow: c.t('recap_journey_eyebrow'),
    stages: s.map((x) => c.t(x === 'flow' ? 'recap_stage_flow' : x === 'bump' ? 'recap_stage_bump' : 'recap_stage_mommy')), line, priority: 101, order: 2,
  };
}

// ── Persona (table-driven, see persona.ts) ────────────────────────────────────────────────────────
export function pickPersona(d: RecapData): RecapPersona {
  return pickPersonaDef(d).id;
}

// ── Timing ─────────────────────────────────────────────────────────────────────────────────────────
interface Slot { min: number; max: number; w: number }
/** Distributes `span` over the slots within their min/max; returns durations (sum may be < span when all hit max). */
export function fitDurations(span: number, slots: Slot[]): number[] {
  const out = slots.map(() => 0);
  const fixed = slots.map(() => false);
  for (let pass = 0; pass < slots.length + 1; pass++) {
    const used = out.reduce((s, v, i) => s + (fixed[i] ? v : 0), 0);
    const freeW = slots.reduce((s, v, i) => s + (fixed[i] ? 0 : v.w), 0);
    if (freeW <= 0) break;
    let changed = false;
    slots.forEach((slot, i) => {
      if (fixed[i]) return;
      const d = ((span - used) * slot.w) / freeW;
      if (d > slot.max) { out[i] = slot.max; fixed[i] = true; changed = true; } else if (d < slot.min) { out[i] = slot.min; fixed[i] = true; changed = true; } else out[i] = d;
    });
    if (!changed) break;
  }
  return out;
}

/** Cuts inside a section are snapped to the beat grid; the section end stays exact. */
function place(start: number, durations: number[], grid: number): Array<[number, number]> {
  const end = start + durations.reduce((s, v) => s + v, 0);
  const cuts: number[] = [start];
  let acc = start;
  durations.forEach((d, i) => {
    acc += d;
    cuts.push(i === durations.length - 1 ? end : Math.round(acc / grid) * grid);
  });
  return durations.map((_, i) => [cuts[i], cuts[i + 1]]);
}

/** At most this many stage scenes per video (the strongest by priority); the rest of the room goes to journey / days / your Anacan. */
const STAGE_MAX = 4;
const FLEX_MAX_DURATION = 7.5;

interface Plan { k: number; chosen: Draft[]; mins: number[] }

/**
 * Picks the flex scenes that fit the music: stage scenes first (strongest, up to STAGE_MAX), then the journey,
 * days together and the "your Anacan" scenes. Each scene gets at least its build time + hold + exit; the
 * longest list that fits wins. `k` scenes go before the drop, the rest between the drop and the breath.
 */
function planFlex(stageDrafts: Draft[], others: Draft[], coldMin: number, music: RecapMusic, cjk: boolean): Plan {
  const byPriority = (a: Draft, z: Draft) => (z.priority ?? 0) - (a.priority ?? 0);
  const ranked = [...[...stageDrafts].sort(byPriority).slice(0, STAGE_MAX), ...[...others].sort(byPriority)];
  const intro = music.drop, mid = music.breath - music.drop;
  for (let n = Math.min(ranked.length, 9); n >= 0; n--) {
    const chosen = ranked.slice(0, n).sort((a, z) => (a.order ?? 0) - (z.order ?? 0));
    const mins = chosen.map((d) => Math.max(3.5, minSceneDuration(d, cjk)));
    let best: Plan | null = null, bestSlack = -Infinity;
    for (let k = 0; k <= n; k++) {
      const a = coldMin + mins.slice(0, k).reduce((x, v) => x + v, 0), b = mins.slice(k).reduce((x, v) => x + v, 0);
      if (a > intro + 1e-6 || b > mid + 1e-6) continue;
      // Prefer both halves filled (no gap before the drop or the breath) and evenly loose.
      const cap1 = 7 + k * FLEX_MAX_DURATION, cap2 = (n - k) * FLEX_MAX_DURATION;
      const gap = Math.max(0, intro - cap1) + Math.max(0, mid - cap2);
      const slack = Math.min((intro - a) / (k + 1), n - k ? (mid - b) / (n - k) : 99) - gap * 10;
      if (slack > bestSlack) { bestSlack = slack; best = { k, chosen, mins }; }
    }
    if (best) return best;
  }
  return { k: 0, chosen: [], mins: [] };
}

// ── Build ──────────────────────────────────────────────────────────────────────────────────────────
export function buildRecapModel(data: RecapData, language: string, t: RecapTranslate, options: BuildRecapOptions = {}): RecapModel {
  const lang = normalizeAppLanguage(language);
  const locale = appLanguageLocale(lang);
  const music = options.music ?? options.timing ?? RECAP_MUSIC_2026;
  const labels = options.labels ?? {};
  const stage = data.stage;
  const child = clean(data.mommy?.child_name);
  const c: Ctx = { d: data, lang, t, labels, child };
  const year = data.year;
  const cjk = CJK.has(lang);

  // Stage scenes follow the current stage only (a past stage never surfaces unless it is a forward journey).
  const journey = journeyScene(c);
  let stageDrafts: Draft[] = stage === 'mommy' ? mommyScenes(c) : stage === 'bump' ? bumpScenes(c) : stage === 'flow' ? flowScenes(c) : [];
  if (journey && stage === 'mommy' && data.stages.includes('bump')) {
    // A bump→mommy year: the strongest pregnancy memory may join the story.
    const kicks = bumpScenes(c).find((s) => s.id === 'bump_kicks');
    if (kicks) stageDrafts = [...stageDrafts, { ...kicks, priority: 50, order: 5 }];
  }
  const days: Draft | null = data.days_active > 0
    ? { ...stat(c, 'days', RECAP_LOOKS.days, 'calendar', c.t('recap_days_eyebrow'), n0(data.days_active), c.t('recap_days_line'),
      { subs: data.longest_streak >= 2 ? [tf(c, 'recap_days_streak', { days: unit(lang, data.longest_streak, 'day') })] : [], param: Math.min(1, data.days_active / 365) }), priority: 100, order: 1 }
    : null;

  const cold: Omit<ColdScene, 'start' | 'end'> = { kind: 'cold', id: 'cold', look: RECAP_LOOKS.cold, seed: hash('cold'), year,
    title: data.name ? tf(c, 'recap_cold_title_name', { name: data.name }) : c.t('recap_cold_title') };
  const coldMin = Math.max(4.5, minSceneDuration(cold, cjk));
  const others: Draft[] = [...(journey ? [journey] : []), ...(days ? [days] : []), ...anacanScenes(c)];
  const plan = planFlex(stageDrafts, others, coldMin, music, cjk);
  const chosen = plan.chosen;

  // Peak line: the three strongest numbers of the year.
  const peakStats = pickStats(c, 3);
  const personaDef = pickPersonaDef(data);
  const persona = personaDef.id;
  const why = pickWhyLine(personaDef, options.seed ?? `${data.name ?? ''}|${data.member_since ?? ''}|${data.days_active}`, year);
  const closeKey: RecapCopyKey = stage === 'mommy' ? 'recap_peak_close_mommy' : stage === 'bump' ? 'recap_peak_close_bump' : stage === 'flow' ? 'recap_peak_close_flow' : 'recap_peak_close';

  // Timing: cold + flex scenes fill [0, breath) with a cut on the drop; then peak, persona, summary, outro.
  const k = plan.k;
  const g1 = fitDurations(music.drop, [{ min: coldMin, max: 7, w: 1 }, ...chosen.slice(0, k).map((_, i) => ({ min: plan.mins[i], max: FLEX_MAX_DURATION, w: 1 }))]);
  const g2 = fitDurations(music.breath - music.drop, chosen.slice(k).map((_, i) => ({ min: plan.mins[k + i], max: FLEX_MAX_DURATION, w: 1 })));
  const p1 = place(0, g1, music.beat);
  const g1End = p1[p1.length - 1][1];
  const p2 = g2.length ? place(g1End, g2, music.beat) : [];
  const flexEnd = p2.length ? p2[p2.length - 1][1] : g1End;
  const shift = flexEnd - music.breath; // ≤ 0 when there is too little to fill the first half
  const peakStart = music.breath + shift;
  const personaStart = music.lift + 4 + shift;
  const summaryStart = personaStart + 5;
  const outroStart = music.tail + shift;
  const end = music.end + shift;

  const scenes: RecapScene[] = [];
  scenes.push({ ...cold, start: p1[0][0], end: p1[0][1] });
  chosen.forEach((draft, i) => {
    const [s, e] = i < k ? p1[i + 1] : p2[i - k];
    const { priority: _p, order: _o, ...scene } = draft;
    scenes.push({ ...(scene as RecapScene), start: s, end: e });
  });
  scenes.push({
    kind: 'peak', id: 'peak', look: RECAP_LOOKS.peak, seed: hash('peak'), start: peakStart, end: personaStart,
    lead: stage === 'mommy' && child ? tf(c, 'recap_peak_lead_child', { child }) : c.t('recap_peak_lead'),
    stats: peakStats, close: c.t(closeKey), burst: music.lift - music.breath,
  });
  scenes.push({
    kind: 'persona', id: 'persona', look: RECAP_LOOKS.persona, seed: hash('persona'), start: personaStart, end: summaryStart, persona,
    eyebrow: tf(c, 'recap_persona_eyebrow', { year }), title: c.t(`recap_persona_${persona}` as RecapCopyKey),
    reason: c.t(`recap_persona_${persona}_why_${why}` as RecapCopyKey),
  });
  scenes.push({
    kind: 'summary', id: 'summary', look: RECAP_LOOKS.summary, seed: hash('summary'), start: summaryStart, end: outroStart,
    name: data.name, year, kicker: c.t('recap_summary_kicker'), stats: pickStats(c, 4), persona: c.t(`recap_persona_${persona}` as RecapCopyKey), site: 'anacan.az',
  });
  scenes.push({
    kind: 'outro', id: 'outro', look: RECAP_LOOKS.outro, seed: hash('outro'), start: outroStart, end, tagline: c.t('recap_outro_tagline'), site: 'anacan.az', stores: c.t('recap_outro_stores'),
  });

  return {
    version: 1, year, language: lang, locale, rtl: lang === 'ar', cjk, stage, persona, scenes,
    duration: end, beat: music.beat, fadeStart: outroStart,
    hits: [g1End, music.lift + shift].filter((h, i, a) => h > 1 && a.indexOf(h) === i),
  };
}

/**
 * Music length a full story would need (every candidate flex scene at its minimum duration), for briefing a
 * longer track. Returns the section lengths in seconds.
 */
export function recapMusicNeeds(data: RecapData, language: string, t: RecapTranslate, options: BuildRecapOptions = {}) {
  const m = buildRecapModel(data, language, t, { ...options, music: { length: 999, drop: 400, breath: 800, lift: 802, tail: 818, end: 822.2, beat: 0.5 } });
  const flex = m.scenes.filter((s) => s.kind !== 'cold' && s.kind !== 'peak' && s.kind !== 'persona' && s.kind !== 'summary' && s.kind !== 'outro');
  const cold = m.scenes[0];
  const flexMin = flex.reduce((x, s) => x + Math.max(3.5, minSceneDuration(s, m.cjk)), 0) + Math.max(4.5, minSceneDuration(cold, m.cjk));
  return { flexScenes: flex.map((s) => s.id), introAndBuild: Math.ceil(flexMin * 2) / 2, afterBreath: 2 + 4 + 5 + 7 + 4.2 };
}

/** The strongest numbers of the year, stage first, never zero. */
export function pickStats(c: Ctx, count: number): RecapStat[] {
  const d = c.d, m = d.mommy, b = d.bump, f = d.flow;
  const out: Array<RecapStat & { p: number }> = [];
  const add = (n: number | null | undefined, key: RecapCopyKey, p: number) => { if (n && n > 0) out.push({ n: Math.round(n), decimals: 0, label: c.t(key), p }); };
  if (d.stage === 'mommy' && m) {
    add(m.sleep_hours, 'recap_label_sleep', 92); add(m.milestones, 'recap_label_milestones', 90); add(m.feedings, 'recap_label_feedings', 88);
    add(m.diapers, 'recap_label_diapers', 60);
  }
  if (d.stage === 'bump' && b) {
    add(b.week_end > b.week_start ? b.week_end - b.week_start : 0, 'recap_label_weeks', 92); add(b.kicks, 'recap_label_kicks', 90);
    add(b.bag_items_ready, 'recap_label_bag', 62); add(b.favorite_names, 'recap_label_names', 58);
  }
  if (d.stage === 'flow' && f) {
    add(Math.max(f.days_logged, f.period_days_logged), 'recap_label_flowdays', 92); add(f.cycles, 'recap_label_cycles', 90);
    add(f.water_glasses >= 5 ? f.water_glasses : 0, 'recap_label_water', 60);
  }
  add(d.days_active, 'recap_label_days', 80);
  add(d.ai_questions, 'recap_label_ai', 55 + Math.min(20, d.ai_questions / 5));
  add(d.posts_read, 'recap_label_reads', 50 + Math.min(15, d.posts_read / 20));
  add(d.longest_streak >= 3 ? d.longest_streak : 0, 'recap_label_streak', 40);
  add(d.likes, 'recap_label_likes', 35);
  add(d.game_plays, 'recap_label_games', 20);
  return out.sort((a, z) => z.p - a.p).slice(0, count).map(({ p: _p, ...s }) => s);
}
