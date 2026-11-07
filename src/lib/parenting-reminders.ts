/**
 * Tərbiyə programme reminders (Premium, this phone only): one local notification a day at the parent's chosen
 * time (default 20:30) while a programme runs. Nothing is scheduled — and everything already scheduled is
 * cancelled — when the preference is off, the programme is finished or paused, or the admin switch / content
 * / Premium is gone. The next 7 days are scheduled and refreshed whenever the app opens the tool or home.
 */
import type { Programme } from '@/data/parenting/types';
import { DEFAULT_REMINDER_TIME, isFinished, type ParentingLocal, type ProgrammeProgress } from './parenting';

const BASE_ID = 882_200;
export const REMINDER_DAYS = 7;
const ALL_IDS = Array.from({ length: REMINDER_DAYS + 1 }, (_, i) => ({ id: BASE_ID + i }));

export interface ReminderSlot {
  id: number;
  at: Date;
  programmeId: string;
  /** 0-based programme day the reminder is about. */
  dayIndex: number;
}

/** The running programme reminders follow: not finished, not paused; the most recently changed one. */
export function activeProgramme(state: ParentingLocal, programmes: Programme[]): { programme: Programme; progress: ProgrammeProgress } | null {
  let best: { programme: Programme; progress: ProgrammeProgress } | null = null;
  for (const programme of programmes) {
    const progress = state.programmes[programme.id];
    if (!progress || progress.paused || isFinished(progress, programme.days.length)) continue;
    if (!best || progress.updatedAt > best.progress.updatedAt) best = { programme, progress };
  }
  return best;
}

const atTime = (base: Date, time: string, addDays: number) => {
  const [h, m] = (/^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_REMINDER_TIME).split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, h, m, 0, 0);
};

/**
 * Which reminders should exist now. Today is included only while today's step is still open and the time has
 * not passed; each following day reminds about the next step (assuming one step a day).
 */
export function reminderSlots(o: {
  state: ParentingLocal;
  programmes: Programme[];
  /** Premium, admin switch on and content available for the app language. */
  allowed: boolean;
  now?: Date;
  today: string;
}): ReminderSlot[] {
  if (!o.allowed || !o.state.reminder?.on) return [];
  const active = activeProgramme(o.state, o.programmes);
  if (!active) return [];
  const now = o.now ?? new Date();
  const { programme, progress } = active;
  const total = programme.days.length;
  const next = progress.done.length;
  const doneToday = progress.done[progress.done.length - 1] === o.today;
  const time = o.state.reminder.time || DEFAULT_REMINDER_TIME;
  const startToday = !doneToday && atTime(now, time, 0) > now;
  const slots: ReminderSlot[] = [];
  for (let k = 0; slots.length < REMINDER_DAYS; k++) {
    const dayIndex = next + k;
    if (dayIndex >= total) break;
    const at = atTime(now, time, startToday ? k : k + 1);
    slots.push({ id: BASE_ID + slots.length, at, programmeId: programme.id, dayIndex });
  }
  return slots;
}

/** Stable key: re-schedule only when the planned reminders change. */
export const slotsKey = (slots: ReminderSlot[]) => slots.map((s) => `${s.programmeId}:${s.dayIndex}@${s.at.getTime()}`).join('|') || 'none';

/** Replace this phone's Tərbiyə reminders with `slots` (empty = cancel all). Never throws. */
export async function syncParentingReminders(
  slots: ReminderSlot[],
  text: (slot: ReminderSlot) => { title: string; body: string },
  opts: { partner?: boolean } = {},
): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ALL_IDS });
    if (!slots.length) return;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: slots.map((s) => ({ id: s.id, ...text(s), schedule: { at: s.at, allowWhileIdle: true }, extra: { type: 'parenting_programme', partner: opts.partner ? '1' : '0' } })),
    });
  } catch { /* reminders are a convenience; the programme screen still shows today's step */ }
}
