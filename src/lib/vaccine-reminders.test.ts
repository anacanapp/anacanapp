import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDeeplink } from './deeplink';
import { intentFromPushData } from './pushNav';
import {
  MAX_OVERDUE, MAX_REMINDER_CHILDREN, MAX_UPCOMING, VACCINE_CHILD_BASE_ID, VACCINE_CHILD_STRIDE, VACCINE_DEEPLINK, VACCINE_REMINDER_BASE_ID,
  cancelVaccineReminders, refreshAllVaccineReminders, setVaccineRemindersEnabled, syncVaccineReminders, vaccineChildBase, vaccineDueDate,
  vaccineRefreshDue, markVaccineRefresh, vaccineReminderSlots, vaccineSlotsKey, type ReminderDose,
} from './vaccine-reminders';

const ln = vi.hoisted(() => ({
  native: true, perm: 'granted', cancel: vi.fn(), schedule: vi.fn(), checkPermissions: vi.fn(), requestPermissions: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => ln.native, isPluginAvailable: () => ln.native } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  cancel: ln.cancel, schedule: ln.schedule, checkPermissions: ln.checkPermissions, requestPermissions: ln.requestPermissions,
} }));

// Run with TZ=Asia/Baku: every expectation is in local wall-clock time.
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
const NOW = local(2026, 11, 8, 9, 0); // Sunday 09:00
const dose = (id: string, status: ReminderDose['status'], due: Date | null): ReminderDose => ({ id, status, due });
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('vaccineReminderSlots', () => {
  it('reminds at 10:00 three days before and on the due day, only for doses in the next 60 days', () => {
    const slots = vaccineReminderSlots([
      dose('a', 'future', local(2026, 11, 20)),
      dose('far', 'future', local(2027, 1, 20)),
      dose('none', 'future', null),
    ], NOW);
    expect(slots.map((s) => [s.doseId, s.kind, fmt(s.at)])).toEqual([
      ['a', 'soon', '2026-11-17 10:00'],
      ['a', 'today', '2026-11-20 10:00'],
    ]);
    expect(slots.map((s) => s.id)).toEqual([VACCINE_REMINDER_BASE_ID, VACCINE_REMINDER_BASE_ID + 1]);
  });

  it('skips done, skipped, conditional and interval doses and times already past', () => {
    const slots = vaccineReminderSlots([
      dose('done', 'done', local(2026, 11, 20)),
      dose('skip', 'skipped', local(2026, 11, 20)),
      dose('cond', 'conditional', local(2026, 11, 20)),
      dose('int', 'interval', local(2026, 11, 20)),
      dose('today', 'pending', local(2026, 11, 8)),     // due today, 10:00 still ahead
      dose('tomorrow', 'future', local(2026, 11, 9)),   // "3 days before" is in the past
    ], NOW);
    expect(slots.map((s) => [s.doseId, s.kind, fmt(s.at)])).toEqual([
      ['today', 'today', '2026-11-08 10:00'],
      ['tomorrow', 'today', '2026-11-09 10:00'],
    ]);
    const late = vaccineReminderSlots([dose('today', 'pending', local(2026, 11, 8))], local(2026, 11, 8, 10, 30));
    expect(late).toEqual([]);
  });

  it('sends one gentle overdue reminder per dose on its due weekday, at most a few, never older than a year', () => {
    const slots = vaccineReminderSlots([
      dose('o1', 'overdue', local(2026, 9, 2)),   // Wednesday
      dose('o2', 'overdue', local(2026, 9, 3)),   // Thursday
      dose('o3', 'overdue', local(2026, 9, 9)),   // Wednesday again: same day as o1, waits for it
      dose('o4', 'overdue', local(2026, 10, 3)),  // Saturday
      dose('o5', 'overdue', local(2026, 10, 4)),  // Sunday: over the cap
      dose('old', 'overdue', local(2025, 1, 1)),
    ], NOW);
    expect(slots.map((s) => [s.doseId, s.kind, fmt(s.at)])).toEqual([
      ['o1', 'overdue', '2026-11-11 10:00'],
      ['o2', 'overdue', '2026-11-12 10:00'],
      ['o4', 'overdue', '2026-11-14 10:00'],
    ]);
    expect(slots.filter((s) => s.kind === 'overdue')).toHaveLength(MAX_OVERDUE);
  });

  it('keeps the overdue time stable across reschedules within the week (at most once a week)', () => {
    const d = [dose('o', 'overdue', local(2026, 10, 4))]; // Sunday
    const morning = vaccineReminderSlots(d, NOW);                          // Sunday 09:00 → today 10:00
    const later = vaccineReminderSlots(d, local(2026, 11, 8, 11, 0));      // after it fired → next Sunday
    const midweek = vaccineReminderSlots(d, local(2026, 11, 11, 15, 0));   // reopened Wednesday → same next Sunday
    expect(fmt(morning[0].at)).toBe('2026-11-08 10:00');
    expect(fmt(later[0].at)).toBe('2026-11-15 10:00');
    expect(fmt(midweek[0].at)).toBe('2026-11-15 10:00');
  });

  it('caps upcoming reminders and keeps ids in the dedicated range', () => {
    const many = Array.from({ length: 30 }, (_, i) => dose(`d${String(i).padStart(2, '0')}`, 'future', local(2026, 11, 15 + i)));
    const slots = vaccineReminderSlots([...many, dose('o', 'overdue', local(2026, 10, 1))], NOW);
    expect(slots.filter((s) => s.kind !== 'overdue')).toHaveLength(MAX_UPCOMING);
    expect(slots.filter((s) => s.kind === 'overdue')).toHaveLength(1);
    expect(Math.max(...slots.map((s) => s.id))).toBeLessThan(VACCINE_REMINDER_BASE_ID + MAX_UPCOMING + MAX_OVERDUE);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });

  it('changes the key only when the plan changes', () => {
    const a = vaccineReminderSlots([dose('a', 'future', local(2026, 11, 20))], NOW);
    const b = vaccineReminderSlots([dose('a', 'future', local(2026, 11, 20))], local(2026, 11, 8, 9, 30));
    expect(vaccineSlotsKey(a, 'az')).toBe(vaccineSlotsKey(b, 'az'));
    expect(vaccineSlotsKey(a, 'az')).not.toBe(vaccineSlotsKey(a, 'en'));
    expect(vaccineSlotsKey([], 'az')).toBe('az|none');
  });
});

describe('vaccineDueDate', () => {
  const row = { id: 'r', dose_number: 1, recommended_age_days: 60, min_age_days: 45, max_age_days: 120 };
  it('uses the recommended age for plain rows and local midnight', () => {
    expect(fmt(vaccineDueDate(row, '2026-10-01', new Map()) as Date)).toBe('2026-11-30 00:00');
    expect(vaccineDueDate(row, 'nope', new Map())).toBeNull();
  });

  it('follows calendar offsets and waits for the earlier dose of an interval', () => {
    const meta = (extra: Record<string, unknown>) => ({
      protocol: 'anacan-vaccine-schedule-v1', version: '1', kind: 'routine', age: { months: 2, days: 0 }, end_age: null,
      expected_age_days: 60, expected_dose_number: 1, source_url: 'x', source_label: 'x', ...extra,
    });
    expect(fmt(vaccineDueDate({ ...row, schedule_meta: meta({}) }, '2026-10-31', new Map()) as Date)).toBe('2026-12-31 00:00');
    const rel = { ...row, schedule_meta: meta({ relative: { schedule_id: 'prev', min: { months: 1, days: 0 } } }) };
    expect(vaccineDueDate(rel, '2026-10-01', new Map())).toBeNull();
    const logs = new Map([['prev', { administered_at: '2026-12-15', is_skipped: false }]]);
    expect(fmt(vaccineDueDate(rel, '2026-10-01', logs) as Date)).toBe('2027-01-15 00:00');
    expect(vaccineDueDate({ ...row, schedule_meta: meta({ kind: 'seasonal' }) }, '2026-10-01', new Map())).toBeNull();
  });
});

describe('tap payload', () => {
  it('opens the vaccine calendar through the existing deeplink route', () => {
    expect(parseDeeplink(VACCINE_DEEPLINK)).toMatchObject({ action: 'tool', params: { tool_id: 'vaccine-calendar' } });
    // The type alone is unknown to pushNav, so the deeplink is what routes the tap.
    expect(intentFromPushData({ type: 'vaccine_reminder' })).toBeNull();
  });
});

describe('multi-child reminders', () => {
  const text = () => ({ title: 't', body: 'b' });
  const scheduledIds = () => ln.schedule.mock.calls.flatMap(([arg]) => arg.notifications.map((n: { id: number }) => n.id));
  const cancelledIds = () => ln.cancel.mock.calls.flatMap(([arg]) => arg.notifications.map((n: { id: number }) => n.id));
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); ln.native = true; ln.perm = 'granted';
    ln.checkPermissions.mockImplementation(async () => ({ display: ln.perm }));
    ln.requestPermissions.mockResolvedValue({ display: 'granted' });
  });

  it('gives every child a stable block that never overlaps another child or the legacy range', () => {
    const a = vaccineChildBase('a'), b = vaccineChildBase('b');
    expect(a).toBe(VACCINE_CHILD_BASE_ID);
    expect(b).toBe(VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE);
    expect(vaccineChildBase('a')).toBe(a);
    expect(VACCINE_CHILD_STRIDE).toBeGreaterThanOrEqual(MAX_UPCOMING + MAX_OVERDUE);
    expect(VACCINE_CHILD_BASE_ID).toBeGreaterThanOrEqual(VACCINE_REMINDER_BASE_ID + MAX_UPCOMING + MAX_OVERDUE);
    const many = Array.from({ length: 30 }, (_, i) => dose(`d${String(i).padStart(2, '0')}`, 'future', local(2026, 11, 15 + i)));
    const sa = vaccineReminderSlots(many, NOW, a as number), sb = vaccineReminderSlots(many, NOW, b as number);
    const ids = [...sa, ...sb].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...sa.map((x) => x.id))).toBeLessThan(b as number);
  });

  it('reuses a slot of a child that is no longer kept, and refuses when every block is taken', () => {
    const ids = Array.from({ length: MAX_REMINDER_CHILDREN }, (_, i) => `c${i}`);
    ids.forEach((id) => vaccineChildBase(id, ids));
    expect(vaccineChildBase('extra', ids)).toBeNull();
    expect(vaccineChildBase('extra', ids.slice(1))).toBe(VACCINE_CHILD_BASE_ID); // c0 left
  });

  it('schedules all children at app start without prompting, each in its own block', async () => {
    const result = await refreshAllVaccineReminders([
      { childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text },
      { childId: 'b', doses: [dose('y', 'future', local(2026, 11, 21))], text },
    ], NOW);
    expect(result).toBe('scheduled');
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(scheduledIds()).toEqual([VACCINE_CHILD_BASE_ID, VACCINE_CHILD_BASE_ID + 1,
      VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE, VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE + 1]);
    expect(ln.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ extra: { type: 'vaccine_reminder', deeplink: VACCINE_DEEPLINK, dose: 'x' } });
    // Rescheduling child a from the calendar leaves child b alone.
    ln.cancel.mockClear();
    await syncVaccineReminders([], text, { baseId: vaccineChildBase('a') as number });
    expect(cancelledIds()).not.toContain(VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE);
    expect(cancelledIds()).toContain(VACCINE_CHILD_BASE_ID);
    expect(cancelledIds()).toContain(VACCINE_REMINDER_BASE_ID); // legacy single-child ids
  });

  it('does not ask for permission and schedules nothing when it is not granted', async () => {
    ln.perm = 'prompt';
    const result = await refreshAllVaccineReminders([{ childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text }], NOW);
    expect(result).toBe('denied');
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('cancels every block when the switch is off, and the blocks of children that are gone', async () => {
    await refreshAllVaccineReminders([
      { childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text },
      { childId: 'b', doses: [dose('y', 'future', local(2026, 11, 21))], text },
    ], NOW);
    ln.cancel.mockClear(); ln.schedule.mockClear();
    await refreshAllVaccineReminders([{ childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text }], NOW);
    expect(cancelledIds()).toContain(VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE); // b's block released
    expect(scheduledIds()).toEqual([VACCINE_CHILD_BASE_ID, VACCINE_CHILD_BASE_ID + 1]);

    ln.cancel.mockClear(); ln.schedule.mockClear();
    setVaccineRemindersEnabled(false);
    expect(await refreshAllVaccineReminders([{ childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text }], NOW)).toBe('cleared');
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(cancelledIds()).toContain(VACCINE_CHILD_BASE_ID + (MAX_REMINDER_CHILDREN - 1) * VACCINE_CHILD_STRIDE);
    ln.cancel.mockClear();
    await cancelVaccineReminders();
    expect(cancelledIds()).toHaveLength((MAX_REMINDER_CHILDREN + 1) * (MAX_UPCOMING + MAX_OVERDUE));
  });

  it('runs the app-start refresh once per stamp (account, day, language)', () => {
    expect(vaccineRefreshDue('u:2026-11-08:az')).toBe(true);
    markVaccineRefresh('u:2026-11-08:az');
    expect(vaccineRefreshDue('u:2026-11-08:az')).toBe(false);
    expect(vaccineRefreshDue('u:2026-11-09:az')).toBe(true);
    expect(vaccineRefreshDue('other:2026-11-08:az')).toBe(true);
  });
});
