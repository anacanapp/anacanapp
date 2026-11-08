/**
 * Vaccine reminders (this phone only, no server job): local notifications for every child of the signed-in
 * user.
 *  - each upcoming dose due within the next 60 days: 10:00 three days before and 10:00 on the due day;
 *  - each overdue dose (up to 3, due within the last year): one gentle reminder at 10:00 on the next weekday
 *    of its due date, so it never comes more than once a week however often the calendar is opened;
 *  - done and skipped doses, conditional / seasonal doses and interval doses whose earlier dose is not logged
 *    get nothing.
 * Ids: each child gets its own block of VACCINE_CHILD_STRIDE ids (slot stored per device), so rescheduling one
 * child never touches another child's reminders. The calendar reschedules the open child's block whenever the
 * plan changes; the app refreshes all children once a day at start (refreshAllVaccineReminders), without ever
 * asking for permission there. A tap opens the calendar (anacan://tool/vaccine-calendar via pushNav). The
 * on/off switch is stored per device (default on); off cancels every block.
 */
import { addDays, differenceInCalendarDays, isValid, parseISO, startOfDay } from 'date-fns';
import { calendarOffsetDate, vaccineTiming, type VaccineStatus } from './vaccine-schedule';

export const VACCINE_REMINDER_BASE_ID = 883_300;
export const MAX_UPCOMING = 20;
export const MAX_OVERDUE = 3;
export const UPCOMING_DAYS = 60;
export const OVERDUE_LOOKBACK_DAYS = 365;
export const REMINDER_HOUR = 10;
export const VACCINE_DEEPLINK = 'anacan://tool/vaccine-calendar';
/** Ids per child block; the first MAX_UPCOMING + MAX_OVERDUE are used, the rest is headroom. */
export const VACCINE_CHILD_STRIDE = 30;
/** Per-child blocks start after the legacy single-child range (883_300..883_322, still cancelled for old installs). */
export const VACCINE_CHILD_BASE_ID = 883_400;
export const MAX_REMINDER_CHILDREN = 10;
const PER_CHILD = MAX_UPCOMING + MAX_OVERDUE;
const rangeIds = (base: number) => Array.from({ length: PER_CHILD }, (_, i) => ({ id: base + i }));
const LEGACY_IDS = rangeIds(VACCINE_REMINDER_BASE_ID);
const ALL_CHILD_IDS = Array.from({ length: MAX_REMINDER_CHILDREN }, (_, slot) => rangeIds(VACCINE_CHILD_BASE_ID + slot * VACCINE_CHILD_STRIDE)).flat();
export const vaccineChildBlockBase = (slot: number) => VACCINE_CHILD_BASE_ID + slot * VACCINE_CHILD_STRIDE;

export const VACCINE_CHILD_SLOTS_KEY = 'anacan.vaccineReminders.childSlots.v1';
function readSlots(): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VACCINE_CHILD_SLOTS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [id, slot] of Object.entries(parsed)) {
      if (Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < MAX_REMINDER_CHILDREN && !Object.values(out).includes(slot as number)) out[id] = slot as number;
    }
    return out;
  } catch { return {}; }
}
function writeSlots(slots: Record<string, number>): void {
  try { window.localStorage.setItem(VACCINE_CHILD_SLOTS_KEY, JSON.stringify(slots)); } catch { /* per-device bookkeeping */ }
}
/**
 * The child's id block on this phone (stable once assigned; the lowest free slot otherwise). `keep` lists the
 * children that must keep their slots; any other assignment may be reused when the blocks are full.
 * Null when every block belongs to a child in `keep`.
 */
export function vaccineChildBase(childId: string, keep: string[] = []): number | null {
  const slots = readSlots();
  if (slots[childId] !== undefined) return vaccineChildBlockBase(slots[childId]);
  const used = new Set(Object.values(slots));
  let free = Array.from({ length: MAX_REMINDER_CHILDREN }, (_, i) => i).find((i) => !used.has(i));
  if (free === undefined) {
    const stale = Object.keys(slots).find((id) => id !== childId && !keep.includes(id));
    if (stale === undefined) return null;
    free = slots[stale];
    delete slots[stale];
  }
  slots[childId] = free;
  writeSlots(slots);
  return vaccineChildBlockBase(free);
}
/** Forget every child not in `childIds`; returns the id blocks they held (to cancel). */
function releaseOtherChildren(childIds: string[]): { id: number }[] {
  const slots = readSlots();
  const released: { id: number }[] = [];
  for (const [id, slot] of Object.entries(slots)) {
    if (childIds.includes(id)) continue;
    released.push(...rangeIds(vaccineChildBlockBase(slot)));
    delete slots[id];
  }
  writeSlots(slots);
  return released;
}

export const VACCINE_REMINDERS_KEY = 'anacan.vaccineReminders.v1';

export function vaccineRemindersEnabled(): boolean {
  try { return window.localStorage.getItem(VACCINE_REMINDERS_KEY) !== '0'; } catch { return true; }
}
export function setVaccineRemindersEnabled(on: boolean): void {
  try { window.localStorage.setItem(VACCINE_REMINDERS_KEY, on ? '1' : '0'); } catch { /* per-device preference */ }
}

interface ScheduleLike {
  id: string;
  dose_number: number;
  recommended_age_days: number;
  min_age_days: number | null;
  max_age_days: number | null;
  schedule_meta?: unknown;
}
interface VaccinationLike { administered_at: string | null; is_skipped: boolean }

/** The day a dose is due (local midnight), mirroring vaccineStatus' start of the window; null when unknown. */
export function vaccineDueDate(row: ScheduleLike, birthDate: string, logs: Map<string, VaccinationLike>): Date | null {
  const birth = parseISO(birthDate);
  if (!isValid(birth)) return null;
  const timing = vaccineTiming(row);
  if (!timing) return startOfDay(addDays(birth, row.recommended_age_days));
  if (timing.kind !== 'routine') return null;
  let start = calendarOffsetDate(birthDate, timing.age);
  if (timing.relative) {
    const earlier = logs.get(timing.relative.schedule_id)?.administered_at;
    if (!earlier || !isValid(parseISO(earlier))) return null;
    const intervalStart = calendarOffsetDate(earlier, timing.relative.min);
    if (intervalStart > start) start = intervalStart;
  }
  return startOfDay(start);
}

export interface ReminderDose { id: string; status: VaccineStatus; due: Date | null }
export type VaccineReminderKind = 'soon' | 'today' | 'overdue';
export interface VaccineReminderSlot { id: number; at: Date; doseId: string; kind: VaccineReminderKind }

const at10 = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), REMINDER_HOUR, 0, 0, 0);

/** Which reminders should exist now (pure; local time). */
export function vaccineReminderSlots(doses: ReminderDose[], now: Date = new Date(), baseId: number = VACCINE_REMINDER_BASE_ID): VaccineReminderSlot[] {
  const today = startOfDay(now);
  const upcoming: Omit<VaccineReminderSlot, 'id'>[] = [];
  for (const d of doses) {
    if ((d.status !== 'pending' && d.status !== 'future') || !d.due) continue;
    const inDays = differenceInCalendarDays(d.due, today);
    if (inDays < 0 || inDays > UPCOMING_DAYS) continue;
    const soon = at10(addDays(d.due, -3)), onDay = at10(d.due);
    if (soon > now) upcoming.push({ at: soon, doseId: d.id, kind: 'soon' });
    if (onDay > now) upcoming.push({ at: onDay, doseId: d.id, kind: 'today' });
  }
  upcoming.sort((a, b) => a.at.getTime() - b.at.getTime() || a.doseId.localeCompare(b.doseId));

  const overdue: Omit<VaccineReminderSlot, 'id'>[] = [];
  const usedDays = new Set<string>();
  const late = doses
    .filter((d) => d.status === 'overdue' && d.due && differenceInCalendarDays(today, d.due) <= OVERDUE_LOOKBACK_DAYS)
    .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime() || a.id.localeCompare(b.id));
  for (const d of late) {
    if (overdue.length >= MAX_OVERDUE) break;
    // Next occurrence of the due date's weekday at 10:00: stable across reschedules, so at most once a week.
    let next = at10(addDays(today, ((d.due as Date).getDay() - today.getDay() + 7) % 7));
    if (next <= now) next = addDays(next, 7);
    const key = next.toDateString();
    if (usedDays.has(key)) continue; // one gentle reminder a day at most; the next dose follows once this one is logged
    usedDays.add(key);
    overdue.push({ at: next, doseId: d.id, kind: 'overdue' });
  }

  return [...upcoming.slice(0, MAX_UPCOMING), ...overdue]
    .map((s, i) => ({ ...s, id: baseId + i }));
}

/** Stable key: reschedule only when the planned reminders (or their language) change. */
export const vaccineSlotsKey = (slots: VaccineReminderSlot[], extra = '') =>
  `${extra}|${slots.map((s) => `${s.doseId}:${s.kind}@${s.at.getTime()}`).join('|') || 'none'}`;

export type VaccineReminderResult = 'scheduled' | 'cleared' | 'denied' | 'unavailable';

/**
 * Replace this phone's vaccine reminders for one id block with `slots` (empty = cancel that block). `baseId`
 * is the child's block (vaccineChildBase); `ask: false` never shows the permission prompt. Never throws.
 */
export async function syncVaccineReminders(
  slots: VaccineReminderSlot[],
  text: (slot: VaccineReminderSlot) => { title: string; body: string },
  opts: { ask?: boolean; baseId?: number; cancelAll?: boolean } = {},
): Promise<VaccineReminderResult> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) return 'unavailable';
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // The legacy single-child range is always cleared: those ids predate per-child blocks.
    const cancel = opts.cancelAll ? [...LEGACY_IDS, ...ALL_CHILD_IDS]
      : [...LEGACY_IDS, ...(opts.baseId !== undefined ? rangeIds(opts.baseId) : [])];
    await LocalNotifications.cancel({ notifications: cancel });
    if (!slots.length) return 'cleared';
    let perm = await LocalNotifications.checkPermissions();
    if (opts.ask !== false && (perm.display === 'prompt' || perm.display === 'prompt-with-rationale')) perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 'denied';
    await LocalNotifications.schedule({
      notifications: slots.map((s) => ({
        id: s.id, ...text(s), schedule: { at: s.at, allowWhileIdle: true },
        extra: { type: 'vaccine_reminder', deeplink: VACCINE_DEEPLINK, dose: s.doseId },
      })),
    });
    return 'scheduled';
  } catch { return 'unavailable'; /* reminders are a convenience; the calendar still shows what is due */ }
}

/** Cancel every vaccine reminder on this phone, for every child (switch turned off). */
export const cancelVaccineReminders = () => syncVaccineReminders([], () => ({ title: '', body: '' }), { cancelAll: true });

/** One child's input for the app-start refresh: the doses as the calendar computes them, plus a text builder. */
export interface ChildReminderPlan {
  childId: string;
  doses: ReminderDose[];
  text: (slot: VaccineReminderSlot) => { title: string; body: string };
}

/**
 * App-start refresh for all children: never prompts for permission (asks nothing unless already granted),
 * respects the per-device switch, gives each child its own id block and cancels blocks of children that are
 * gone (deleted child, other account). Returns the overall result ('scheduled' if any child got reminders).
 */
export async function refreshAllVaccineReminders(plans: ChildReminderPlan[], now: Date = new Date()): Promise<VaccineReminderResult> {
  if (!vaccineRemindersEnabled()) return cancelVaccineReminders();
  const ids = plans.map((p) => p.childId);
  const released = releaseOtherChildren(ids);
  if (released.length) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.cancel({ notifications: released });
      }
    } catch { /* best effort */ }
  }
  const results: VaccineReminderResult[] = [];
  for (const plan of plans) {
    const baseId = vaccineChildBase(plan.childId, ids);
    if (baseId === null) continue; // more children than blocks: the calendar still shows what is due
    const slots = vaccineReminderSlots(plan.doses, now, baseId);
    results.push(await syncVaccineReminders(slots, plan.text, { ask: false, baseId }));
  }
  if (results.includes('scheduled')) return 'scheduled';
  if (results.includes('denied')) return 'denied';
  if (results.includes('unavailable')) return 'unavailable';
  return 'cleared';
}

export const VACCINE_REFRESH_KEY = 'anacan.vaccineReminders.refreshedOn.v1';
/** False when the app-start refresh already ran with this stamp (account + day + language) on this device. */
export function vaccineRefreshDue(stamp: string): boolean {
  try { return window.localStorage.getItem(VACCINE_REFRESH_KEY) !== stamp; } catch { return true; }
}
export function markVaccineRefresh(stamp: string): void {
  try { window.localStorage.setItem(VACCINE_REFRESH_KEY, stamp); } catch { /* next start retries */ }
}
