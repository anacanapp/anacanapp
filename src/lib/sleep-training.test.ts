import { describe, expect, it } from 'vitest';
import {
  adjustNightWakes, ageBand, buildSchedule, DEFAULT_PLAN_STATE, monthsOld, nightKey, parsePlanState, pickMethod, planDayNumber,
  planProgress, prunePlanState, ratePlanDay, routineStreak, scheduleStatus, shiftWake, sleepEntries, sleepSummary, sleepTrainingEligible,
  timelineSegments, toggleRoutine, ROUTINE_STEPS,
} from './sleep-training';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('age', () => {
  it('counts whole months and maps them to bands; only 1–12 months are eligible', () => {
    expect(monthsOld(at(2026, 5, 20), at(2026, 10, 19))).toBe(4);
    expect(monthsOld(at(2026, 5, 20), at(2026, 10, 20))).toBe(5);
    expect(ageBand(0)).toBeNull();
    expect(ageBand(3)).toBe('1-3');
    expect(ageBand(6)).toBe('4-6');
    expect(ageBand(12)).toBe('10-12');
    expect(ageBand(13)).toBeNull();
    expect(sleepTrainingEligible({ lifeStage: 'mommy', birthDate: at(2026, 6, 1), now: at(2026, 10, 26) })).toBe(true);
    expect(sleepTrainingEligible({ lifeStage: 'bump', birthDate: at(2026, 6, 1), now: at(2026, 10, 26) })).toBe(false);
    expect(sleepTrainingEligible({ lifeStage: 'mommy', birthDate: at(2026, 10, 10), now: at(2026, 10, 26) })).toBe(false);
  });
});

describe('buildSchedule', () => {
  it('builds wake/nap blocks ending in a bedtime between 19:00 and 20:30', () => {
    const s = buildSchedule({ wakeTime: '07:00', band: '4-6' });
    expect(s[0]).toMatchObject({ type: 'wake', start: '07:00' });
    expect(s[s.length - 1]).toMatchObject({ type: 'bedtime', start: '20:00' });
    expect(s.filter((b) => b.type === 'nap')).toHaveLength(3);
    expect(buildSchedule({ wakeTime: '06:30', band: '10-12' }).filter((b) => b.type === 'nap')).toHaveLength(2);
    expect(buildSchedule({ wakeTime: 'bad', band: '1-3' })).toEqual([]);
  });

  it('reports the current and next block and wraps the night past midnight', () => {
    const s = buildSchedule({ wakeTime: '07:00', band: '4-6' });
    const st = scheduleStatus(s, at(2026, 10, 26, 7, 30));
    expect(st.currentIndex).toBe(0);
    expect(st.nextIndex).toBe(1);
    const night = timelineSegments(s).filter((seg) => seg.kind === 'night');
    expect(night).toHaveLength(2); // 20:00→24:00 and 00:00→07:00
  });

  it('clamps the wake time to 05:00–10:30', () => {
    expect(shiftWake('05:00', -15)).toBe('05:00');
    expect(shiftWake('10:30', 15)).toBe('10:30');
    expect(shiftWake('07:00', 15)).toBe('07:15');
  });
});

describe('sleepSummary', () => {
  const log = (id: string, s: Date, e: Date) => ({ id, log_type: 'sleep', start_time: s.toISOString(), end_time: e.toISOString() });
  it('classifies night vs nap and asks for more data under 3 days', () => {
    const entries = sleepEntries([log('n', at(2026, 10, 25, 20), at(2026, 10, 26, 6)), log('p', at(2026, 10, 25, 13), at(2026, 10, 25, 14))]);
    expect(entries.map((e) => e.kind)).toEqual(['nap', 'night']);
    expect(sleepSummary({ sessions: entries, band: '4-6', now: at(2026, 10, 27, 12) }).insights).toEqual(['need_more_data']);
    expect(sleepSummary({ sessions: [], band: '4-6', now: at(2026, 10, 27, 12) }).insights).toEqual(['no_data']);
  });

  it('flags short nights over a few days', () => {
    const logs = [1, 2, 3, 4].flatMap((d) => [log(`n${d}`, at(2026, 10, 20 + d, 21), at(2026, 10, 21 + d, 1))]);
    const s = sleepSummary({ sessions: sleepEntries(logs), band: '7-9', now: at(2026, 10, 26, 12) });
    expect(s.daysWithData).toBeGreaterThanOrEqual(3);
    expect(s.insights).toContain('night_short');
  });
});

describe('plan state', () => {
  it('rates plan days only after a method is picked and counts progress', () => {
    let s = ratePlanDay(DEFAULT_PLAN_STATE, 1, 'easy');
    expect(s.planDone).toEqual({});
    s = pickMethod(s, 'chair', '2026-10-20');
    s = ratePlanDay(s, 1, 'easy');
    s = ratePlanDay(s, 2, 'hard');
    expect(planProgress(s).completed).toBe(2);
    expect(planDayNumber('2026-10-20', '2026-10-26')).toBe(7);
    expect(ratePlanDay(s, 2, null, true).planDone).toEqual({ 1: 'easy' });
  });

  it('counts routine streaks and keeps night wake-ups within 0–20', () => {
    let s = DEFAULT_PLAN_STATE;
    for (const k of ['2026-10-24', '2026-10-25']) for (const step of ROUTINE_STEPS) s = toggleRoutine(s, k, step);
    expect(routineStreak(s.routineDone, '2026-10-26')).toBe(2);
    expect(adjustNightWakes(DEFAULT_PLAN_STATE, 'k', -3).nightWakes.k).toBe(0);
    expect(nightKey(at(2026, 10, 26, 3))).toBe('2026-10-25');
  });

  it('parses stored state safely, including the old planDays format, and prunes old days', () => {
    const parsed = parsePlanState({ wakeTime: '99:99', method: 'nope', planDays: [1, 3], stepsDone: ['chair_step_1', 'x'], pendingSleepStart: 'nope' });
    expect(parsed.wakeTime).toBe('07:00');
    expect(parsed.method).toBeNull();
    expect(parsed.planDone).toEqual({ 1: null, 3: null });
    expect(parsed.stepsDone).toEqual(['chair_step_1']);
    expect(parsed.pendingSleepStart).toBeNull();
    const pruned = prunePlanState({ ...DEFAULT_PLAN_STATE, nightWakes: { '2026-08-01': 2, '2026-10-25': 1 } }, '2026-10-26');
    expect(pruned.nightWakes).toEqual({ '2026-10-25': 1 });
    expect(parsePlanState(null)).toBe(DEFAULT_PLAN_STATE);
  });
});
