import { ageInMonths, clampFeeds, currentStep, PLAN_MIN_MONTHS, type Feeds, type WeaningPlan, type WeaningStep } from './weaning';

/**
 * Entry points into the Süddən ayırma tool outside ToolsHub: the one-time home card, the cross-link in the
 * feeding logger and the card under an Anacan.AI answer. All of them follow the same rules as the tile:
 * Ana (mommy) module, admin switch `weaning_tool` = 'on'; the entry points need a child of 12+ months
 * (the age at which a plan can be built). Nothing here is pushed or shown as an ad.
 */
export type WeaningEntry =
  | { kind: 'hidden' }
  | { kind: 'intro' }
  | { kind: 'active'; step: WeaningStep | null; done: number; total: number; paused: boolean };

export interface EntryInput {
  lifeStage: string | null | undefined;
  birthDate: string | null | undefined;
  setting: unknown;
  plan: WeaningPlan | null;
  continueBF: boolean;
  now?: Date;
}

/** Whether the tool can be offered at all (module, switch, 12+ months). */
export function weaningOfferable(o: Pick<EntryInput, 'lifeStage' | 'birthDate' | 'setting' | 'now'>): boolean {
  if (o.lifeStage !== 'mommy' || o.setting !== 'on') return false;
  const months = ageInMonths(o.birthDate, o.now);
  return months !== null && months >= PLAN_MIN_MONTHS;
}

const isLivePlan = (p: WeaningPlan | null): p is WeaningPlan => !!p && (p.status === 'active' || p.status === 'paused');

/** Home card: progress when a plan runs; otherwise a one-time card, gone after "continue" or dismiss. */
export function homeCardState(o: EntryInput & { dismissed: boolean }): WeaningEntry {
  if (!weaningOfferable(o)) return { kind: 'hidden' };
  if (isLivePlan(o.plan)) {
    const done = o.plan.steps.filter((s) => s.status === 'done').length;
    return { kind: 'active', step: currentStep(o.plan), done, total: o.plan.steps.length, paused: o.plan.status === 'paused' };
  }
  if (o.continueBF || o.dismissed) return { kind: 'hidden' };
  return { kind: 'intro' };
}

/** Feeding-logger link: only while no plan runs and the mother has not chosen to continue. */
export function feedingLinkVisible(o: EntryInput): boolean {
  return weaningOfferable(o) && !isLivePlan(o.plan) && !o.continueBF;
}

// ── Plan prefill from the last 7 days of breastfeeding logs ────────────────────────────────
export interface FeedLog { log_type: string; feed_type?: string | null; start_time: string | null }

const isBreastfeed = (l: FeedLog) => l.log_type === 'feeding' && !!l.feed_type && l.feed_type.startsWith('breast');

/**
 * Average daily breastfeeds by time of day: night 22:00–05:59, morning 06:00–08:59, bedtime 19:00–21:59,
 * the rest daytime. Averages over the days that have at least one breastfeed. Needs 3+ such days, else null
 * (the builder keeps its defaults). The nap feed cannot be told apart from daytime feeds, so it is kept.
 */
export function feedsFromLogs(logs: FeedLog[], base: Feeds, now = new Date()): Feeds | null {
  const since = now.getTime() - 7 * 86400000;
  const days = new Set<string>();
  let morning = 0, bedtime = 0, night = 0, day = 0;
  for (const l of logs) {
    if (!isBreastfeed(l) || !l.start_time) continue;
    const t = new Date(l.start_time);
    if (Number.isNaN(t.getTime()) || t.getTime() < since || t.getTime() > now.getTime()) continue;
    days.add(`${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`);
    const h = t.getHours();
    if (h >= 22 || h < 6) night++;
    else if (h < 9) morning++;
    else if (h >= 19) bedtime++;
    else day++;
  }
  const n = days.size;
  if (n < 3) return null;
  const nap = base.nap;
  const dayFeeds = Math.round(day / n) - (nap ? 1 : 0);
  return clampFeeds({ morning: morning / n >= 0.5, day: Math.max(0, dayFeeds), nap, bedtime: bedtime / n >= 0.5, night: Math.round(night / n) });
}

// ── Anacan.AI: is this a weaning question? ──────────────────────────────────────────────────
const WEANING_PATTERNS: RegExp[] = [
  // Azerbaijani: allow inflection (\p{L}, needs the u flag) and up to three words in between ("süddən necə ayırım").
  /(süd|sud|döş|dos|sinə|sine|məmə)\p{L}*(\s+\p{L}+){0,3}\s+(ayır|ayir|kəs|kes)/iu,
  /əmizdirm\p{L}*(\s+\p{L}+){0,3}\s+(dayandır|kəs|bitir|tərgit)/iu,
  /\bwean/i, /stop(ping)?\s+(breast|nursing|breastfeeding)/i,
  /отлуч/i, /(перестать|прекратить|бросить)\s+кормить\s+грудью/i, /отказ\p{L}*\s+от\s+груди/iu,
  /(sütten|memeden)(\s+\p{L}+){0,2}\s+kes/iu, /emzirme\p{L}*(\s+\p{L}+){0,2}\s+(bırak|kes|bitir)/iu,
  /abstill/i, /sevrage|sevrer/i, /destet/i, /desmam/i, /odstaw\p{L}*\s+od\s+piersi/iu, /afvenn|spenen/i, /avvänj|sluta\s+amma/i,
  /فطام|فطم/, /断奶|戒奶|離乳|卒乳|断乳/, /젖\s*떼|단유/, /cai\s+sữa/i, /menyapih|sapih/i, /स्तनपान\s*छुड़|दूध\s*छुड़/,
  /емшектен\s+шығар|ажырат/i, /эмчектен\s+ажырат/i, /ko'?krak(dan)?\s+ajrat/i, /rinnast\s+võõr/i, /ძუძუს?\s*მოწყვეტ|ძუძუდან\s*მოხსნ/,
];
export function isWeaningQuestion(text: string | null | undefined): boolean {
  if (!text) return false;
  return WEANING_PATTERNS.some((re) => re.test(text));
}

// ── Home card dismiss flag (per account and child; this phone only) ─────────────────────────
const dismissKey = (uid: string | null | undefined, childId: string | null | undefined) => `anacan.weaning.homecard.v1.${uid || 'guest'}.${childId || 'none'}`;
export function readHomeDismissed(uid: string | null | undefined, childId: string | null | undefined): boolean {
  try { return localStorage.getItem(dismissKey(uid, childId)) === '1'; } catch { return false; }
}
export function writeHomeDismissed(uid: string | null | undefined, childId: string | null | undefined): void {
  try { localStorage.setItem(dismissKey(uid, childId), '1'); } catch { /* storage unavailable */ }
}
