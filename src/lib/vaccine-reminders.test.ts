import { describe, expect, it } from 'vitest';
import { parseDeeplink } from './deeplink';
import { intentFromPushData } from './pushNav';
import {
  MAX_OVERDUE, MAX_UPCOMING, VACCINE_DEEPLINK, VACCINE_REMINDER_BASE_ID, vaccineDueDate, vaccineReminderSlots, vaccineSlotsKey,
  type ReminderDose,
} from './vaccine-reminders';

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
