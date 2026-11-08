import { describe, expect, it, vi, afterEach } from 'vitest';
import { storedDateKey } from './stored-date-key';
import { localDayStartIso } from './local-day-range';
import { dayKey } from './baby-chat';
import { isoDay } from '@/hooks/usePartnerFamily';
import { moodDiaryFormFromLog, moodDiaryPatch } from '@/components/tools/mood-diary-form';
import { dailyLogUpsertRow } from '@/hooks/useDailyLogs';
import { todayKey } from './local-date';

// Run with TZ=Asia/Baku (UTC+4): the 00:00-04:00 local window is where UTC keys used to fall on yesterday.
const baku = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Baku';

afterEach(() => { vi.useRealTimers(); });

describe('local calendar days (dates group)', () => {
  it.runIf(baku)('todayKey at 00:30 Baku is today, not yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T20:30:00Z')); // 00:30 on 8 Nov in Baku
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-07');
    expect(todayKey()).toBe('2026-11-08');
    expect(dailyLogUpsertRow('u', { mood: 4 })).toEqual({ mood: 4, user_id: 'u', log_date: '2026-11-08' });
  });

  it.runIf(baku)('localDayStartIso gives the UTC instant of local midnight', () => {
    expect(localDayStartIso('2026-11-08')).toBe('2026-11-07T20:00:00.000Z');
  });

  it('dayKey / isoDay use the local day', () => {
    const lateNight = new Date(2026, 10, 8, 1, 15);
    expect(dayKey(lateNight)).toBe('2026-11-08');
    expect(isoDay(lateNight)).toBe('2026-11-08');
  });

  it('storedDateKey keeps the stored day for both Date shapes', () => {
    expect(storedDateKey('2026-03-01')).toBe('2026-03-01');
    expect(storedDateKey(new Date('2026-03-01'))).toBe('2026-03-01'); // profile row, UTC midnight
    expect(storedDateKey(new Date(2026, 2, 1))).toBe('2026-03-01'); // on-device picker, local midnight
    expect(storedDateKey(new Date(2026, 2, 1).toISOString())).toBe('2026-03-01'); // persisted then rehydrated
    expect(storedDateKey(null)).toBeUndefined();
    expect(storedDateKey('not a date')).toBeUndefined();
  });
});

describe('daily log merge', () => {
  it('sends only the given fields, drops undefined, keeps explicit null', () => {
    expect(dailyLogUpsertRow('u', { log_date: '2026-11-08', water_intake: 500, notes: undefined, bleeding: null }))
      .toEqual({ log_date: '2026-11-08', water_intake: 500, bleeding: null, user_id: 'u' });
  });

  it('mood diary patch carries only the diary fields', () => {
    const form = moodDiaryFormFromLog({ mood: 3, symptoms: ['tired'], bleeding: 'spotting', notes: 'ok' });
    expect(form).toEqual({ mood: 3, symptoms: ['tired'], bleeding: 'spotting', notes: 'ok' });
    expect(moodDiaryPatch(form, '2026-11-08', true))
      .toEqual({ log_date: '2026-11-08', mood: 3, symptoms: ['tired'], notes: 'ok', bleeding: 'spotting' });
    const flow = moodDiaryPatch({ ...form, notes: '  ' }, '2026-11-08', false);
    expect(flow).toEqual({ log_date: '2026-11-08', mood: 3, symptoms: ['tired'], notes: null });
    expect('bleeding' in flow).toBe(false);
    expect('water_intake' in flow).toBe(false);
  });

  it('an empty day gives an empty form', () => {
    expect(moodDiaryFormFromLog(null)).toEqual({ mood: null, symptoms: [], bleeding: null, notes: '' });
  });
});
