import { supabase } from '@/integrations/supabase/client';

/**
 * "Trying to conceive" goal inside Flow (Duzelis75). profiles.flow_goal switches the Flow home,
 * profiles.ttc_state keeps the start month, checklist and pregnancy tests (bounded JSON). Daily LH,
 * basal temperature and intimacy are ordinary flow_daily_logs fields (own rows only).
 */

export type FlowGoal = 'track' | 'conceive';
export type PregnancyTest = 'negative' | 'faint' | 'positive';
export const CHECKLIST_KEYS = ['folic', 'gyn', 'labs', 'vaccines', 'dentist', 'lifestyle', 'meds', 'partner'] as const;
export type ChecklistKey = typeof CHECKLIST_KEYS[number];

export interface TtcState {
  /** yyyy-mm-dd: when they started trying. */
  started_on?: string;
  checklist?: Partial<Record<ChecklistKey, boolean>>;
  tests?: { date: string; result: PregnancyTest }[];
  /** Positive test was postponed ("remind me in 2 days") until this date. */
  snooze_until?: string;
  /**
   * Mother's birth year (optional, asked in the TTC card). Profiles store no birth date, so this
   * is the only age source for the "see a doctor after 6 months from age 35" rule.
   */
  birth_year?: number;
}

export type Chance = 'low' | 'medium' | 'high' | 'peak';

const DAY = 86400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const dayDiff = (a: Date, b: Date) => Math.round((midnight(a).getTime() - midnight(b).getTime()) / DAY);

/** Chance of conceiving on a day relative to (estimated or confirmed) ovulation. */
export function chanceFor(day: Date, ovulation: Date): Chance {
  const d = dayDiff(day, ovulation);
  if (d === -1 || d === 0) return 'peak';
  if (d === -2 || d === -3) return 'high';
  if (d === -4 || d === -5 || d === 1) return 'medium';
  return 'low';
}

/** Whole months since they started trying (0 in the first month). */
export function monthsTrying(startedOn: string | undefined, now = new Date()): number | null {
  if (!startedOn) return null;
  const [y, m, d] = startedOn.split('-').map(Number);
  if (!y || !m) return null;
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
  if (now.getDate() < (d || 1)) months -= 1;
  return Math.max(0, months);
}

/** See a doctor after 12 months, or 6 months from age 35. */
export const doctorThreshold = (age: number | null) => (age != null && age >= 35 ? 6 : 12);

export const MIN_BIRTH_YEAR = 1950;
/** Youngest plausible birth year for someone trying to conceive (age 12). */
export const maxBirthYear = (now = new Date()) => now.getFullYear() - 12;

/** A valid stored birth year, or null. */
export function validBirthYear(value: unknown, now = new Date()): number | null {
  const year = typeof value === 'string' ? Number(value) : value;
  return typeof year === 'number' && Number.isInteger(year) && year >= MIN_BIRTH_YEAR && year <= maxBirthYear(now) ? year : null;
}

/**
 * Age from the birth year only (day and month are not stored). It can be at most one year too
 * high before the birthday, which errs toward the earlier (6 month) doctor visit.
 */
export function ageFromBirthYear(value: unknown, now = new Date()): number | null {
  const year = validBirthYear(value, now);
  return year == null ? null : now.getFullYear() - year;
}

/** Months of trying after which a doctor visit is advised for this user. */
export const doctorThresholdFor = (state: Pick<TtcState, 'birth_year'> | null | undefined, now = new Date()) =>
  doctorThreshold(ageFromBirthYear(state?.birth_year, now));

/**
 * A rise of at least 0.2 °C held for 3 days over the previous 6 days' highest value (the classic
 * "three over six" rule). Values are per day, oldest first; nulls are skipped.
 */
export function bbtShift(values: (number | null)[]): number | null {
  const days = values.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v != null);
  for (let k = 6; k + 2 < days.length; k++) {
    const base = Math.max(...days.slice(k - 6, k).map((x) => x.v));
    if (days.slice(k, k + 3).every((x) => x.v >= base + 0.2)) return days[k].i;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables/RPCs newer than the generated types
const db = supabase as unknown as { from: (table: string) => any };

export async function saveFlowGoal(userId: string, goal: FlowGoal, state?: TtcState): Promise<void> {
  const update: Record<string, unknown> = { flow_goal: goal };
  if (state) update.ttc_state = state;
  const { error } = await db.from('profiles').update(update).eq('user_id', userId);
  if (error) throw error;
}

export async function saveTtcState(userId: string, state: TtcState): Promise<void> {
  const bounded: TtcState = { ...state, tests: (state.tests ?? []).slice(-30) };
  if (state.birth_year != null && validBirthYear(state.birth_year) == null) delete bounded.birth_year;
  const { error } = await db.from('profiles').update({ ttc_state: bounded }).eq('user_id', userId);
  if (error) throw error;
}

/** Positive test → pregnancy mode with the current cycle's first day as LMP. */
export async function switchToPregnancy(userId: string, lmp: string, dueDate: string): Promise<void> {
  const { error } = await db.from('profiles').update({ life_stage: 'bump', last_period_date: lmp, due_date: dueDate, flow_goal: 'track' }).eq('user_id', userId);
  if (error) throw error;
}
