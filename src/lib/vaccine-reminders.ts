/**
 * Vaccine reminders (this phone only, no server job): local notifications for the child selected in the
 * vaccine calendar.
 *  - each upcoming dose due within the next 60 days: 10:00 three days before and 10:00 on the due day;
 *  - each overdue dose (up to 3, due within the last year): one gentle reminder at 10:00 on the next weekday
 *    of its due date, so it never comes more than once a week however often the calendar is opened;
 *  - done and skipped doses, conditional / seasonal doses and interval doses whose earlier dose is not logged
 *    get nothing.
 * The calendar cancels and reschedules the whole range whenever the plan changes; a tap opens the calendar
 * (anacan://tool/vaccine-calendar via pushNav). The on/off switch is stored per device (default on).
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
const ALL_IDS = Array.from({ length: MAX_UPCOMING + MAX_OVERDUE }, (_, i) => ({ id: VACCINE_REMINDER_BASE_ID + i }));

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
export function vaccineReminderSlots(doses: ReminderDose[], now: Date = new Date()): VaccineReminderSlot[] {
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
    .map((s, i) => ({ ...s, id: VACCINE_REMINDER_BASE_ID + i }));
}

/** Stable key: reschedule only when the planned reminders (or their language) change. */
export const vaccineSlotsKey = (slots: VaccineReminderSlot[], extra = '') =>
  `${extra}|${slots.map((s) => `${s.doseId}:${s.kind}@${s.at.getTime()}`).join('|') || 'none'}`;

export type VaccineReminderResult = 'scheduled' | 'cleared' | 'denied' | 'unavailable';

/** Replace this phone's vaccine reminders with `slots` (empty = cancel all). Never throws. */
export async function syncVaccineReminders(
  slots: VaccineReminderSlot[],
  text: (slot: VaccineReminderSlot) => { title: string; body: string },
  opts: { ask?: boolean } = {},
): Promise<VaccineReminderResult> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) return 'unavailable';
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ALL_IDS });
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

/** Cancel every vaccine reminder on this phone (switch turned off). */
export const cancelVaccineReminders = () => syncVaccineReminders([], () => ({ title: '', body: '' }));
