/**
 * Tərbiyə (evidence-based positive parenting, children 0–12 years): pure rules for the tile, age bands, the daily
 * tip, programme progress and quiz scoring, plus the device store.
 *
 * The device copy (localStorage per account) is what the UI reads; it is merged with public.parenting_state in
 * the background (src/lib/parenting-sync.ts) so progress, quiz results and bookmarks follow the account.
 */
import type {
  AgeBandId, MilestoneAnswer, MilestoneCheckpoint, MilestoneResultId, StyleDimension, StyleResultId,
} from '@/data/parenting/types';
import { hasParentingContent, PARENTING_CONTENT_LANGUAGES } from '@/data/parenting';
import { ageInMonths, isoDay } from './weaning';

export { ageInMonths, isoDay };

/** App languages with registered Tərbiyə content (src/data/parenting/index.ts). */
export const PARENTING_LANGUAGES = PARENTING_CONTENT_LANGUAGES;
/** Up to and including 12 years. */
export const MAX_MONTHS = 13 * 12;

/** Content is registered for this app language (az now; other languages as their folders are registered). */
export function isParentingLanguage(language: string | null | undefined): boolean {
  return hasParentingContent(language);
}

/**
 * Tile visibility: Ana (mommy) module, content registered for the app language, admin switch
 * app_settings.parenting_tool = 'on', and the active child (when known) is younger than 13. Without a birth date
 * the parent picks the age band.
 */
export function isParentingTileVisible(o: {
  lifeStage: string | null | undefined;
  language: string | null | undefined;
  setting: unknown;
  birthDate?: string | null;
  /**
   * Every child's birth date (multi-child families): visible while at least one child is under 13 or has no
   * birth date, so a younger sibling keeps the tool although the selected child is 13+. Wins over `birthDate`.
   */
  birthDates?: (string | null | undefined)[] | null;
  now?: Date;
}): boolean {
  if (o.lifeStage !== 'mommy' || o.setting !== 'on' || !isParentingLanguage(o.language)) return false;
  if (o.birthDates?.length) return o.birthDates.some((d) => isParentingAge(d, o.now));
  return isParentingAge(o.birthDate, o.now);
}

/** Under 13, or no birth date (the parent picks the band). */
export function isParentingAge(birthDate: string | null | undefined, now?: Date): boolean {
  const months = ageInMonths(birthDate, now);
  return months === null || months < MAX_MONTHS;
}

/** The children the tool is for (under 13 or without a birth date), in the given order. */
export function parentingChildren<T extends { birth_date?: string | null }>(kids: T[], now?: Date): T[] {
  return kids.filter((k) => isParentingAge(k.birth_date, now));
}

/**
 * The child the tool reads for: the explicitly picked one, else the preferred one (the app's selected child /
 * her current child), else the first eligible child; null when no child is eligible or known.
 */
export function pickParentingChild<T extends { id?: string | null; birth_date?: string | null }>(
  kids: T[], o: { picked?: string | null; preferred?: string | null; now?: Date } = {},
): T | null {
  const list = parentingChildren(kids, o.now);
  const byId = (id: string | null | undefined) => (id ? list.find((k) => k.id === id) : undefined);
  return byId(o.picked) ?? byId(o.preferred) ?? list[0] ?? null;
}

/**
 * Partner (father) mode: the woman he is linked to is in the Ana module, content exists for his app language, the
 * same admin switch is on and her active child (when known) is younger than 13.
 */
export function isParentingPartnerVisible(o: {
  womanLifeStage: string | null | undefined;
  language: string | null | undefined;
  setting: unknown;
  birthDate?: string | null;
  /** Her children he can see (any one under 13 keeps the tool). */
  birthDates?: (string | null | undefined)[] | null;
  now?: Date;
}): boolean {
  return isParentingTileVisible({ lifeStage: o.womanLifeStage, language: o.language, setting: o.setting, birthDate: o.birthDate, birthDates: o.birthDates, now: o.now });
}

/** The child the partner reads for: her current active child he can see, else her profile's baby. */
export function partnerParentingChild(
  children: { name: string; birth_date: string | null; is_current: boolean }[],
  profile: { baby_name?: string | null; baby_birth_date?: string | null } | null,
): { name: string | null; birth_date: string | null } | null {
  const kid = children.find((c) => c.is_current) ?? children[0];
  if (kid) return { name: kid.name, birth_date: kid.birth_date };
  return profile ? { name: profile.baby_name ?? null, birth_date: profile.baby_birth_date ?? null } : null;
}

/** The age band for a child of this many months (null when unknown or 13+). */
export function ageBandFor(months: number | null | undefined): AgeBandId | null {
  if (months === null || months === undefined || !Number.isFinite(months) || months < 0) return null;
  if (months < 12) return '0-1';
  if (months < 36) return '1-3';
  if (months < 72) return '3-6';
  if (months < MAX_MONTHS) return '6-12';
  return null;
}

/** Days since 1970-01-01 for a local calendar day (stable across time zones and DST). */
function dayNumber(day: string): number {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Deterministic "tip of the day": the same tip all day, the next one tomorrow. */
export function dailyTipIndex(today: string, count: number): number {
  if (count <= 0) return -1;
  return ((dayNumber(today) % count) + count) % count;
}

/**
 * Ana home teaser: same rules as the Tools tile plus the per-language tool switch (useDisabledTools), and never in
 * the pregnancy-loss recovery home.
 */
export function isParentingHomeCardVisible(o: Parameters<typeof isParentingTileVisible>[0] & {
  toolDisabled?: boolean;
  recovering?: boolean;
}): boolean {
  if (o.toolDisabled || o.recovering) return false;
  return isParentingTileVisible(o);
}

/**
 * Today's tip exactly as the tool's home shows it: the parent's chosen band, else the child's band, else 1–3;
 * the same tip all day.
 */
export function homeTipFor<T>(tips: Record<AgeBandId, T[]>, o: {
  birthDate?: string | null;
  chosenBand?: AgeBandId | null;
  /** The child's per-child state: its manual band applies while it still fits the child (see effectiveBand). */
  slot?: Pick<ChildSlot, 'band' | 'bandFor'> | null;
  now?: Date;
}): { band: AgeBandId; index: number; tip: T } | null {
  const now = o.now ?? new Date();
  const childBand = ageBandFor(ageInMonths(o.birthDate, now));
  const band = (o.slot ? effectiveBand(o.slot, childBand) : o.chosenBand ?? childBand) ?? '1-3';
  const list = tips[band] ?? [];
  const index = dailyTipIndex(isoDay(now), list.length);
  return index < 0 ? null : { band, index, tip: list[index] };
}

// ── Programmes ──────────────────────────────────────────────────────────────────────────
export interface ProgrammeProgress {
  startedAt: string;
  /** Calendar day each programme day was checked off, in order (index 0 = day 1). */
  done: string[];
  /** Last change: an ISO timestamp (older device data has a calendar day). Used by the sync merge. */
  updatedAt: string;
  /** Paused by the parent: no reminders until resumed. */
  paused?: boolean;
}

/** Free users can follow the first days of every programme; the rest is Premium. */
export const FREE_PROGRAMME_DAYS = 3;
export const isDayLocked = (dayIndex: number, isPremium: boolean) => !isPremium && dayIndex >= FREE_PROGRAMME_DAYS;

export function startProgramme(today: string): ProgrammeProgress {
  return { startedAt: today, done: [], updatedAt: today };
}

/** 0-based index of the next programme day (equals total when finished). */
export const nextDayIndex = (p: ProgrammeProgress | null | undefined) => (p ? p.done.length : 0);

/** One small step a day: the next day can be checked off once per calendar day. */
export function canCompleteToday(p: ProgrammeProgress | null | undefined, total: number, today: string): boolean {
  if (!p || p.done.length >= total) return false;
  return p.done[p.done.length - 1] !== today;
}

export function completeDay(p: ProgrammeProgress, total: number, today: string): ProgrammeProgress {
  if (!canCompleteToday(p, total, today)) return p;
  return { ...p, done: [...p.done, today], updatedAt: today };
}

/** Undo only the most recent check-off (a mis-tap). */
export function undoLastDay(p: ProgrammeProgress, today: string): ProgrammeProgress {
  if (!p.done.length) return p;
  return { ...p, done: p.done.slice(0, -1), updatedAt: today };
}

export const isFinished = (p: ProgrammeProgress | null | undefined, total: number) => !!p && p.done.length >= total;
export const progressPercent = (p: ProgrammeProgress | null | undefined, total: number) =>
  (!p || total <= 0 ? 0 : Math.round((Math.min(p.done.length, total) / total) * 100));

/** Finished programme summary: days checked off and the first / last calendar day. */
export function programmeSummary(p: ProgrammeProgress | null | undefined, total: number): { days: number; from: string; to: string } | null {
  if (!p || !isFinished(p, total)) return null;
  const days = p.done.slice(0, total);
  return { days: days.length, from: days[0] ?? p.startedAt, to: days[days.length - 1] ?? p.startedAt };
}

/**
 * What to suggest after a programme: another programme for the band the parent has not finished; one not
 * started yet first, then a running one; outside the band only when nothing in the band is left.
 */
export function suggestNextProgramme<P extends { id: string; bands: AgeBandId[]; days: unknown[] }>(
  programmes: P[], progress: Record<string, ProgrammeProgress>, band: AgeBandId, currentId: string,
): P | null {
  const open = programmes.filter((p) => p.id !== currentId && !isFinished(progress[p.id], p.days.length));
  const rank = (p: P) => (p.bands.includes(band) ? 0 : 2) + (progress[p.id] ? 1 : 0);
  return [...open].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

// ── Quiz navigation (answers kept when going back) ─────────────────────────────────────
export interface QuizNav<T> {
  /** 0-based question shown now; equals the question count when the quiz is done. */
  pos: number;
  answers: (T | undefined)[];
}
export const startQuiz = <T,>(): QuizNav<T> => ({ pos: 0, answers: [] });
/** Answer the current question (overwriting an earlier answer after "back") and move on. */
export function quizAnswer<T>(nav: QuizNav<T>, value: T, total: number): QuizNav<T> {
  if (nav.pos >= total) return nav;
  const answers = [...nav.answers];
  answers[nav.pos] = value;
  return { pos: nav.pos + 1, answers };
}
/** One question back; every answer stays (the earlier choice is shown as selected). */
export const quizBack = <T,>(nav: QuizNav<T>): QuizNav<T> => (nav.pos > 0 ? { ...nav, pos: nav.pos - 1 } : nav);
export const quizDone = <T,>(nav: QuizNav<T>, total: number) =>
  nav.pos >= total && Array.from({ length: total }, (_, i) => nav.answers[i]).every((a) => a !== undefined);

// ── Quizzes ─────────────────────────────────────────────────────────────────────────────
/** Average per dimension for 0…3 answers. */
export function styleScores(items: { dim: StyleDimension }[], answers: (number | null | undefined)[]): Record<StyleDimension, number> {
  const sum: Record<StyleDimension, number> = { warmth: 0, structure: 0, harsh: 0, giveIn: 0 };
  const n: Record<StyleDimension, number> = { warmth: 0, structure: 0, harsh: 0, giveIn: 0 };
  items.forEach((it, i) => {
    const a = answers[i];
    if (typeof a !== 'number' || a < 0 || a > 3) return;
    sum[it.dim] += a;
    n[it.dim] += 1;
  });
  const avg = (d: StyleDimension) => (n[d] ? sum[d] / n[d] : 0);
  return { warmth: avg('warmth'), structure: avg('structure'), harsh: avg('harsh'), giveIn: avg('giveIn') };
}

/**
 * Non-judgemental profile from Baumrind's two dimensions (warmth, structure) plus how often harshness or giving in
 * shows up when the parent is tired. Thresholds sit on the middle of the 0…3 scale.
 */
export function styleResult(s: Record<StyleDimension, number>): StyleResultId {
  const warm = s.warmth >= 1.75;
  const clear = s.structure >= 1.75 && s.giveIn < 1.75;
  const harsh = s.harsh >= 1.5;
  if (warm && harsh) return 'storm';
  if (harsh) return 'strict';
  if (warm && clear) return 'balanced';
  if (warm) return 'gentle';
  return clear ? 'strict' : 'stretched';
}

/** Too young for the milestone self-check: before the first checkpoint the items are not expected yet. */
export function tooEarlyForMilestones(checkpoints: MilestoneCheckpoint[], months: number | null): number | null {
  if (months === null || !checkpoints.length) return null;
  const first = Math.min(...checkpoints.map((c) => c.fromMonths));
  return months < first ? first : null;
}

/** The latest checkpoint the child has reached (the first one for very young babies). */
export function checkpointFor(checkpoints: MilestoneCheckpoint[], months: number | null): MilestoneCheckpoint | null {
  if (!checkpoints.length) return null;
  const sorted = [...checkpoints].sort((a, b) => a.fromMonths - b.fromMonths);
  if (months === null) return sorted[0];
  let found = sorted[0];
  for (const c of sorted) if (months >= c.fromMonths) found = c;
  return found;
}

/**
 * Milestone self-check: a lost skill or "not yet" on a red-flag item → talk to a doctor; three or more "not yet /
 * not sure" → watch and support; otherwise on track. It is never a diagnosis.
 */
export function milestoneResult(
  checkpoint: MilestoneCheckpoint,
  answers: (MilestoneAnswer | null | undefined)[],
  regression: MilestoneAnswer | null | undefined,
): { id: MilestoneResultId; notYet: number[]; flagged: number[] } {
  const notYet: number[] = [];
  const flagged: number[] = [];
  checkpoint.items.forEach((it, i) => {
    const a = answers[i];
    if (a === 'no' || a === 'unsure') notYet.push(i);
    if (a === 'no' && it.flag) flagged.push(i);
  });
  const id: MilestoneResultId = regression === 'yes' || flagged.length ? 'talk' : notYet.length >= 3 ? 'watch' : 'ontrack';
  return { id, notYet, flagged };
}

// ── Device store ────────────────────────────────────────────────────────────────────────
export interface ReminderPref {
  on: boolean;
  /** Local time HH:MM. */
  time: string;
}
export const DEFAULT_REMINDER_TIME = '20:30';

/** One child's part of the state: band choice, programme progress and quiz results. */
export interface ChildSlot {
  /** Parent's manual age band (null = follow the child's age). */
  band: AgeBandId | null;
  /** When the band was chosen (ISO). */
  bandAt?: string;
  /**
   * The child's own band when the manual band was chosen (null = no birth date then). The manual band expires as
   * soon as the child's band differs, e.g. after a birthday moves the child to the next band. Missing on data
   * from before multi-child support (the tool stamps it on first open).
   */
  bandFor?: AgeBandId | null;
  programmes: Record<string, ProgrammeProgress>;
  quizzes: Record<string, { at: string; result: string }>;
  /** Restart tombstones 'p:<programmeId>' (ISO); on the account level also bookmark removals 's:<ref>'. */
  removed?: Record<string, string>;
}

export interface ParentingLocal extends ChildSlot {
  v: 1;
  /** Bookmarks: 'a:<articleId>' or 's:<sosId>', newest first (shared by all children). */
  saved: string[];
  /** When each bookmark was added (ISO); the sync merge keeps the newest of add / remove. */
  savedAt?: Record<string, string>;
  /**
   * The child the account-level fields (band, programmes, quizzes) belong to. Data from before multi-child
   * support becomes this child's on the first open with a known child; older app versions keep reading and
   * writing those same fields, so the format stays compatible.
   */
  rootChild?: string;
  /** When rootChild was claimed (ISO); the earliest claim wins in the merge. */
  rootChildAt?: string;
  /** Every other child's state, by child id. */
  children?: Record<string, ChildSlot>;
  /** Local changes not yet on the server. */
  dirty?: boolean;
  /** Daily programme reminder on this phone (Premium). Never synced: notifications are per device. */
  reminder?: ReminderPref;
}

export const EMPTY_PARENTING = (): ParentingLocal => ({ v: 1, band: null, programmes: {}, quizzes: {}, saved: [] });
export const EMPTY_SLOT = (): ChildSlot => ({ band: null, programmes: {}, quizzes: {} });
export const storageKey = (uid: string | null) => `anacan.parenting.v1.${uid || 'guest'}`;

const BANDS: AgeBandId[] = ['0-1', '1-3', '3-6', '6-12'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
const REF = /^[as]:[a-z0-9-]{1,60}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Child ids (uuid). */
export const CHILD_ID = /^[A-Za-z0-9-]{1,64}$/;
const MAX_MARKS = 300;
const MAX_CHILDREN = 12;
const ROOT_REMOVED = /^(s:[as]:[a-z0-9-]{1,60}|p:[a-z0-9-]{1,60})$/;
const SLOT_REMOVED = /^p:[a-z0-9-]{1,60}$/;

/** Keep the newest `max` entries of a timestamp map. */
export function capMarks(marks: Record<string, string>, max = MAX_MARKS): Record<string, string> {
  const entries = Object.entries(marks);
  if (entries.length <= max) return marks;
  return Object.fromEntries(entries.sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, max));
}

function cleanMarks(raw: unknown, key: RegExp): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (key.test(k) && typeof v === 'string' && STAMP.test(v)) out[k] = v;
  return Object.keys(out).length ? capMarks(out) : undefined;
}

/** Band, programmes, quizzes and tombstones of one slot (account level or one child), sanitised into `out`. */
function sanitizeSlotInto(out: ChildSlot, data: Partial<ChildSlot> & Record<string, unknown>, removedKey: RegExp) {
  if (data.band && BANDS.includes(data.band)) out.band = data.band;
  if (typeof data.bandAt === 'string' && STAMP.test(data.bandAt)) out.bandAt = data.bandAt;
  if (data.bandFor === null || (typeof data.bandFor === 'string' && BANDS.includes(data.bandFor))) out.bandFor = data.bandFor;
  const programmes = data.programmes && typeof data.programmes === 'object' ? data.programmes : {};
  for (const [id, p] of Object.entries(programmes)) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !p || typeof p.startedAt !== 'string' || !Array.isArray(p.done)) continue;
    out.programmes[id] = {
      startedAt: p.startedAt,
      done: p.done.filter((d) => typeof d === 'string' && DAY.test(d)).slice(0, 60),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.startedAt,
      ...(p.paused === true ? { paused: true } : {}),
    };
  }
  const quizzes = data.quizzes && typeof data.quizzes === 'object' ? data.quizzes : {};
  for (const [id, q] of Object.entries(quizzes)) {
    if (q && typeof q.result === 'string' && typeof q.at === 'string') out.quizzes[id] = { at: q.at, result: q.result };
  }
  const removed = cleanMarks(data.removed, removedKey);
  if (removed) out.removed = removed;
}

/** Sanitise any stored or server state; a bad shape yields an empty state. */
export function sanitizeParenting(input: unknown): ParentingLocal {
  const out = EMPTY_PARENTING();
  if (!input || typeof input !== 'object') return out;
  const data = input as Partial<ParentingLocal> & Record<string, unknown>;
  sanitizeSlotInto(out, data, ROOT_REMOVED);
  if (Array.isArray(data.saved)) {
    out.saved = [...new Set(data.saved.filter((x) => typeof x === 'string' && REF.test(x)))].slice(0, 200);
  }
  const savedAt = cleanMarks(data.savedAt, REF);
  if (savedAt) out.savedAt = savedAt;
  if (typeof data.rootChild === 'string' && CHILD_ID.test(data.rootChild)) {
    out.rootChild = data.rootChild;
    if (typeof data.rootChildAt === 'string' && STAMP.test(data.rootChildAt)) out.rootChildAt = data.rootChildAt;
  }
  if (data.children && typeof data.children === 'object' && !Array.isArray(data.children)) {
    const kids: Record<string, ChildSlot> = {};
    for (const [id, raw] of Object.entries(data.children as Record<string, unknown>).slice(0, MAX_CHILDREN)) {
      if (!CHILD_ID.test(id) || id === out.rootChild || !raw || typeof raw !== 'object') continue;
      const slot = EMPTY_SLOT();
      sanitizeSlotInto(slot, raw as Record<string, unknown>, SLOT_REMOVED);
      kids[id] = slot;
    }
    if (Object.keys(kids).length) out.children = kids;
  }
  if (data.dirty === true) out.dirty = true;
  const r = data.reminder as Partial<ReminderPref> | undefined;
  if (r && typeof r === 'object') out.reminder = { on: r.on === true, time: typeof r.time === 'string' && TIME.test(r.time) ? r.time : DEFAULT_REMINDER_TIME };
  return out;
}

/** Read and sanitise the stored state; any storage error or bad shape yields an empty state. */
export function readParenting(uid: string | null): ParentingLocal {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey(uid));
    return raw ? sanitizeParenting(JSON.parse(raw)) : EMPTY_PARENTING();
  } catch {
    return EMPTY_PARENTING();
  }
}

// ── Per-child slots ─────────────────────────────────────────────────────────────────────
/**
 * True when `childId` reads and writes the account-level fields: no child known (null), no child has claimed
 * them yet (data from before multi-child support), or it is the child that claimed them.
 */
export const usesRoot = (s: ParentingLocal, childId: string | null | undefined) => !childId || !s.rootChild || s.rootChild === childId;

/** One child's slot (the account-level fields for the root child). */
export function readSlot(s: ParentingLocal, childId: string | null | undefined): ChildSlot {
  if (usesRoot(s, childId)) {
    const slot: ChildSlot = { band: s.band, programmes: s.programmes, quizzes: s.quizzes };
    if (s.bandAt) slot.bandAt = s.bandAt;
    if (s.bandFor !== undefined) slot.bandFor = s.bandFor;
    if (s.removed) slot.removed = s.removed;
    return slot;
  }
  return s.children?.[childId as string] ?? EMPTY_SLOT();
}

/** Change one child's slot; the root child's slot is the account-level fields (older app versions read them). */
export function writeSlot(s: ParentingLocal, childId: string | null | undefined, fn: (slot: ChildSlot) => ChildSlot): ParentingLocal {
  const cur = readSlot(s, childId);
  const next = fn(cur);
  if (next === cur) return s;
  if (usesRoot(s, childId)) {
    const out: ParentingLocal = { ...s, band: next.band, programmes: next.programmes, quizzes: next.quizzes };
    for (const k of ['bandAt', 'bandFor', 'removed'] as const) {
      if (next[k] === undefined) delete out[k]; else (out as unknown as Record<string, unknown>)[k] = next[k];
    }
    return out;
  }
  return { ...s, children: { ...(s.children || {}), [childId as string]: next } };
}

/** Every slot with its child id (the root slot's id is rootChild, or null before any child claimed it). */
export function allSlots(s: ParentingLocal): { childId: string | null; slot: ChildSlot }[] {
  return [
    { childId: s.rootChild ?? null, slot: readSlot(s, null) },
    ...Object.entries(s.children || {}).map(([childId, slot]) => ({ childId, slot })),
  ];
}

/**
 * The band the tool shows: the parent's manual band while it still fits (chosen for the child's current band),
 * else the child's band. A manual band from before multi-child support (no bandFor) applies until stamped.
 */
export function effectiveBand(slot: Pick<ChildSlot, 'band' | 'bandFor'>, childBand: AgeBandId | null): AgeBandId | null {
  if (!slot.band) return childBand;
  if (slot.bandFor === undefined || slot.bandFor === childBand) return slot.band;
  return childBand;
}

/** Choose a band for a child (null or the child's own band = follow the child), stamped for the merge. */
export function setSlotBand(slot: ChildSlot, band: AgeBandId | null, childBand: AgeBandId | null, at = new Date().toISOString()): ChildSlot {
  const manual = band && band !== childBand ? band : null;
  return { ...slot, band: manual, bandAt: at, bandFor: childBand };
}

/**
 * On opening the tool for a child: claim the account-level data for it (first child seen), stamp a legacy manual
 * band with the child's current band, and drop a manual band that no longer fits the child. Returns the same
 * object when nothing changes (no write, no sync).
 */
export function normalizeForChild(s: ParentingLocal, childId: string | null | undefined, childBand: AgeBandId | null, at = new Date().toISOString()): ParentingLocal {
  let out = s;
  if (childId && CHILD_ID.test(childId) && !s.rootChild) out = { ...out, rootChild: childId, rootChildAt: at };
  return writeSlot(out, childId, (slot) => {
    if (!slot.band) return slot;
    if (slot.bandFor === undefined) return { ...slot, bandFor: childBand };
    if (slot.bandFor !== childBand) return { ...slot, band: null, bandAt: at, bandFor: childBand };
    return slot;
  });
}

/** Where a programme runs (for a reminder tap or "Continue" without a child): the child with its newest change. */
export function childForProgramme(s: ParentingLocal, programmeId: string): string | null {
  let best: { childId: string | null; at: string } | null = null;
  for (const { childId, slot } of allSlots(s)) {
    const p = slot.programmes[programmeId];
    if (p && (!best || p.updatedAt > best.at)) best = { childId, at: p.updatedAt };
  }
  return best?.childId ?? null;
}

/** Add or remove a bookmark (newest first). */
export function toggleSaved(saved: string[], ref: string): string[] {
  return saved.includes(ref) ? saved.filter((x) => x !== ref) : [ref, ...saved].slice(0, 200);
}

/** Toggle a bookmark in the full state, stamping the add / remove time for the sync merge. */
export function toggleSavedState(s: ParentingLocal, ref: string, at = new Date().toISOString()): ParentingLocal {
  const saved = toggleSaved(s.saved, ref);
  const adding = saved.includes(ref);
  const savedAt = { ...(s.savedAt || {}) };
  const removed = { ...(s.removed || {}) };
  if (adding) { savedAt[ref] = at; delete removed[`s:${ref}`]; } else { delete savedAt[ref]; removed[`s:${ref}`] = at; }
  return { ...s, saved, savedAt, removed: capMarks(removed) };
}

/** Choose a band on the account level (null = follow the child), stamped for the merge. */
export function setBandState(s: ParentingLocal, band: AgeBandId | null, at = new Date().toISOString()): ParentingLocal {
  return { ...s, band, bandAt: at };
}

/**
 * Write one programme's progress (null = restart / remove), stamping it for the merge; a removal leaves a
 * tombstone so another device's older copy does not bring it back. Works on the whole state or a child slot.
 */
export function setProgrammeState<S extends Pick<ChildSlot, 'programmes' | 'removed'>>(s: S, id: string, p: ProgrammeProgress | null, at = new Date().toISOString()): S {
  const programmes = { ...s.programmes };
  const removed = { ...(s.removed || {}) };
  if (p) { programmes[id] = { ...p, updatedAt: at }; delete removed[`p:${id}`]; } else { delete programmes[id]; removed[`p:${id}`] = at; }
  return { ...s, programmes, removed: capMarks(removed) };
}

/** Whether the parent has used the tool at all on this account (first-run intro only for new users). */
export function hasParentingActivity(s: ParentingLocal): boolean {
  if (s.saved.length) return true;
  return allSlots(s).some(({ slot }) => !!slot.band || Object.keys(slot.programmes).length > 0 || Object.keys(slot.quizzes).length > 0);
}

/** Rough reading time of a text block at ~180 words a minute (at least 1 minute). */
export function readingMinutes(parts: (string | undefined)[]): number {
  const words = parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

export function writeParenting(uid: string | null, state: ParentingLocal): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    /* private mode or full storage: progress stays in memory for this session */
  }
}
