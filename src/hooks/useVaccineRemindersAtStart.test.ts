import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runVaccineReminderRefresh, useVaccineRemindersAtStart, type VaccineRefreshDeps } from './useVaccineRemindersAtStart';
import { VACCINE_CHILD_BASE_ID, VACCINE_CHILD_STRIDE, markVaccineRefresh } from '@/lib/vaccine-reminders';

const ln = vi.hoisted(() => ({ native: true, cancel: vi.fn(), schedule: vi.fn(), checkPermissions: vi.fn(), requestPermissions: vi.fn(), from: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => ln.native, isPluginAvailable: () => ln.native } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  cancel: ln.cancel, schedule: ln.schedule, checkPermissions: ln.checkPermissions, requestPermissions: ln.requestPermissions,
} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: ln.from } }));
vi.mock('@/lib/tr', async (orig) => ({ ...(await orig<object>()), tr: (_k: string, f: string) => f,
  formatTr: (_k: string, f: string, v: Record<string, string>) => f.replace(/\{(\w+)\}/g, (_m, k) => v[k] ?? '') }));

const NOW = new Date(2026, 10, 8, 9, 0);
const vaccine = (id: string, code: string) => ({ id, code, name: code, name_az: code, is_active: true });
const sched = (id: string, vaccineId: string, days: number, country: string) => ({
  id, vaccine_id: vaccineId, country_code: country, dose_number: 1, recommended_age_days: days, min_age_days: null, max_age_days: null,
  age_label: '', age_label_az: '', dose_label: '1-ci doza', dose_label_az: '1-ci doza', notes: null, sort_order: 1,
});

describe('runVaccineReminderRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); ln.native = true;
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
  });

  it('schedules reminders for every child, each with its own country plan, name and id block', async () => {
    const deps: VaccineRefreshDeps = {
      loadChildren: vi.fn(async () => [
        { id: 'a', name: 'Aylin', birth_date: '2026-09-21', gender: 'girl', vaccine_country_code: 'AZ' },   // 60 days → 2026-11-20
        { id: 'b', name: 'Bəxtiyar', birth_date: '2026-07-01', gender: 'boy', vaccine_country_code: 'TR' }, // 150 days → 2026-11-28
      ]),
      loadSchedule: vi.fn(async (country: string) => country === 'AZ'
        ? [{ ...sched('az-mmr', 'v1', 60, 'AZ'), vaccine: vaccine('v1', 'MMR') }]
        : [{ ...sched('tr-hepb', 'v2', 150, 'TR'), vaccine: vaccine('v2', 'HepB') },
          { ...sched('tr-done', 'v2', 140, 'TR'), vaccine: vaccine('v2', 'HepB') }]) as unknown as VaccineRefreshDeps['loadSchedule'],
      loadLogs: vi.fn(async () => [{ child_id: 'b', vaccine_schedule_id: 'tr-done', administered_at: '2026-11-01', is_skipped: false }]),
    };
    const result = await runVaccineReminderRefresh({ userId: 'u', language: 'en', now: NOW }, deps);
    expect(result).toBe('scheduled');
    expect(deps.loadSchedule).toHaveBeenCalledTimes(2);
    expect(deps.loadLogs).toHaveBeenCalledWith('u', ['a', 'b']);
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    const notes = ln.schedule.mock.calls.flatMap(([arg]) => arg.notifications);
    expect(notes.map((n: any) => [n.id, n.extra.dose])).toEqual([
      [VACCINE_CHILD_BASE_ID, 'az-mmr'], [VACCINE_CHILD_BASE_ID + 1, 'az-mmr'],
      [VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE, 'tr-hepb'], [VACCINE_CHILD_BASE_ID + VACCINE_CHILD_STRIDE + 1, 'tr-hepb'],
    ]);
    expect(notes[0].body).toBe('Aylin: Measles, mumps, and rubella (MMR) (Dose 1) 3 gün sonradır.');
    expect(notes[2].body).toContain('Bəxtiyar: Hepatitis B (HepB) (Dose 1)');
  });
});

describe('useVaccineRemindersAtStart', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); localStorage.clear(); ln.native = true; });
  afterEach(() => vi.useRealTimers());

  it('does nothing on the web, before login or before the profile is ready', () => {
    ln.native = false;
    renderHook(() => useVaccineRemindersAtStart({ userId: 'u', ready: true, language: 'en' }));
    ln.native = true;
    renderHook(() => useVaccineRemindersAtStart({ userId: null, ready: true, language: 'en' }));
    renderHook(() => useVaccineRemindersAtStart({ userId: 'u', ready: false, language: 'en' }));
    vi.advanceTimersByTime(10_000);
    expect(ln.from).not.toHaveBeenCalled();
  });

  it('loads the children on the phone after login, once the start delay passes', async () => {
    const q: any = { select: () => q, eq: () => q, order: async () => ({ data: [], error: null }) };
    ln.from.mockReturnValue(q);
    ln.cancel.mockResolvedValue(undefined);
    renderHook(() => useVaccineRemindersAtStart({ userId: 'u', ready: true, language: 'en' }));
    expect(ln.from).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(ln.from).toHaveBeenCalledWith('user_children'));
  });

  it('skips when it already ran today for this account and language', () => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    markVaccineRefresh(`u:${key}:en`);
    renderHook(() => useVaccineRemindersAtStart({ userId: 'u', ready: true, language: 'en' }));
    vi.advanceTimersByTime(10_000);
    expect(ln.from).not.toHaveBeenCalled();
  });
});
