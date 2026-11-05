import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import {
  type CheckinAnswers, type Feeds, type WeaningPlan,
  DEFAULT_FEEDS, EMPTY_CHECKIN, EMPTY_READINESS, MIN_DAYS, PACE, PACES,
  addDays, ageInMonths, applyCheckin, buildSteps, canComplete, canStartNow, cancelPlan, completeCurrent, createPlan,
  currentStep, daysBetween, evaluateCheckin, extendStep, isWeaningTileVisible, milkStatus, pausePlan, planLastDay,
  planStepCount, planWeeks, readinessVerdict, reminderDays, resumePlan, startNow, stepState,
} from './weaning';
import { WEANING_COPY } from './weaning-copy';

const ALL: Feeds = { morning: true, day: 2, nap: true, bedtime: true, night: 2 };
const plan = (o: Partial<Parameters<typeof createPlan>[0]> = {}): WeaningPlan =>
  createPlan({ feeds: ALL, pace: 'gentle', nightMode: 'last', start: '2026-11-09', childId: 'c1', ...o });
const ci = (o: Partial<CheckinAnswers> = {}): CheckinAnswers =>
  ({ ...EMPTY_CHECKIN, childMood: 'happy', diapers: 'ok', fullness: 'none', motherMood: 'good', ...o });

describe('plan building', () => {
  it('orders daytime → nap → morning → night → bedtime last', () => {
    const steps = buildSteps(ALL, 'gentle', 'last', '2026-11-09');
    expect(steps.map((s) => `${s.type}${s.n || ''}`)).toEqual(['day1', 'day2', 'nap', 'morning', 'night1', 'night2', 'bedtime']);
    expect(steps.at(-1)!.type).toBe('bedtime');
  });

  it('numbers repeated feeds only when there are several', () => {
    const steps = buildSteps({ ...ALL, day: 1, night: 1 }, 'gentle', 'last', '2026-11-09');
    expect(steps.filter((s) => s.type === 'day' || s.type === 'night').map((s) => s.n)).toEqual([0, 0]);
  });

  it('uses 7-day (gentle) and 4-day (medium) contiguous steps', () => {
    for (const [pace, days] of [['gentle', 7], ['medium', 4]] as const) {
      const steps = buildSteps(ALL, pace, 'last', '2026-11-09');
      steps.forEach((s, i) => {
        expect(s.len).toBe(days);
        expect(s.start).toBe(addDays('2026-11-09', i * days));
        expect(s.status).toBe('todo');
      });
    }
  });

  it('has no one-day option and never builds steps shorter than MIN_DAYS', () => {
    expect(PACES).toEqual(['gentle', 'medium']);
    expect(Object.values(PACE).every((p) => p.days >= MIN_DAYS)).toBe(true);
    expect(Object.values(PACE).some((p) => p.days === 1)).toBe(false);
    expect(() => buildSteps(ALL, 'oneday' as never, 'last', '2026-11-09')).toThrow();
    expect(MIN_DAYS).toBe(3);
  });

  it('leaves night feeds to the separate module when nightMode is separate', () => {
    const steps = buildSteps(ALL, 'gentle', 'separate', '2026-11-09');
    expect(steps.some((s) => s.type === 'night')).toBe(false);
    expect(planStepCount(ALL, 'separate')).toBe(5);
    expect(planStepCount(ALL, 'last')).toBe(7);
    expect(plan({ nightMode: 'separate' }).nightMode).toBe('separate');
    // Without night feeds the night choice is irrelevant.
    expect(plan({ feeds: { ...ALL, night: 0 }, nightMode: 'separate' }).nightMode).toBe('last');
  });

  it('estimates the duration in weeks and clamps the feed counts', () => {
    expect(planWeeks(ALL, 'last', 'gentle')).toBe(7);
    expect(planWeeks(ALL, 'last', 'medium')).toBe(4);
    expect(buildSteps({ ...ALL, day: 9, night: 9 }, 'gentle', 'last', '2026-11-09').length).toBe(1 + 4 + 1 + 3 + 1);
  });

  it('refuses an empty plan', () => {
    expect(() => plan({ feeds: { morning: false, day: 0, nap: false, bedtime: false, night: 0 } })).toThrow();
    expect(planStepCount(DEFAULT_FEEDS, 'last')).toBe(6);
  });
});

describe('MIN_DAYS gating', () => {
  const p = plan();
  const s0 = p.steps[0];

  it('enables "comfortable, done" only from day MIN_DAYS of the step', () => {
    expect(canComplete(s0, '2026-11-09')).toBe(false);
    expect(canComplete(s0, '2026-11-10')).toBe(false);
    expect(canComplete(s0, '2026-11-11')).toBe(true);
    expect(completeCurrent(p, '2026-11-10')).toBe(p);
    expect(completeCurrent(p, '2026-11-11').steps[0].status).toBe('done');
  });

  it('keeps a future next step on schedule after completing', () => {
    const done = completeCurrent(p, '2026-11-11');
    expect(done.steps[1].start).toBe('2026-11-16');
    expect(stepState(done.steps[1], '2026-11-11')).toBe('future');
  });

  it('offers "start now" only when MIN_DAYS passed since the previous step started', () => {
    const done = completeCurrent(p, '2026-11-11');
    expect(canStartNow(done, '2026-11-11')).toBe(false);
    expect(startNow(done, '2026-11-11')).toBe(done);
    expect(canStartNow(done, '2026-11-12')).toBe(true);
    const started = startNow(done, '2026-11-12');
    expect(started.steps[1].start).toBe('2026-11-12');
    // Later steps follow the moved step; done steps keep their dates.
    expect(started.steps[2].start).toBe('2026-11-19');
    expect(started.steps[0].start).toBe('2026-11-09');
  });

  it('never offers "start now" for the first step or while paused', () => {
    expect(canStartNow(p, '2026-11-01')).toBe(false);
    const done = completeCurrent(p, '2026-11-11');
    expect(canStartNow(pausePlan(done, 'manual'), '2026-11-13')).toBe(false);
  });

  it('starts an overdue next step today when completing late', () => {
    const late = completeCurrent(p, '2026-11-20');
    expect(late.steps[1].start).toBe('2026-11-20');
    expect(late.steps[2].start).toBe('2026-11-27');
  });

  it('finishes the plan after the last step', () => {
    let q = plan({ feeds: { morning: false, day: 1, nap: false, bedtime: true, night: 0 }, pace: 'medium' });
    q = completeCurrent(q, '2026-11-11');
    q = completeCurrent(q, '2026-11-15');
    expect(q.status).toBe('finished');
    expect(currentStep(q)).toBeNull();
  });

  it('extends a step by 3 days and shifts later steps', () => {
    const ext = extendStep(p, 's0', 3);
    expect(ext.steps[0].len).toBe(10);
    expect(ext.steps[1].start).toBe('2026-11-19');
    expect(planLastDay(ext)).toBe(addDays(planLastDay(p), 3));
  });

  it('pauses, resumes (restarting a running step today) and cancels', () => {
    const paused = pausePlan(p, 'doctor');
    expect(paused).toMatchObject({ status: 'paused', pauseReason: 'doctor' });
    const { plan: resumed, shifted } = resumePlan(paused, '2026-11-12');
    expect(shifted).toBe(true);
    expect(resumed).toMatchObject({ status: 'active', pauseReason: null });
    expect(resumed.steps[0].start).toBe('2026-11-12');
    expect(resumed.steps[1].start).toBe('2026-11-19');
    expect(resumePlan(pausePlan(p, 'manual'), '2026-11-05').shifted).toBe(false);
    expect(cancelPlan(p).status).toBe('cancelled');
  });
});

describe('readiness', () => {
  const yes = { ...EMPTY_READINESS, sick: false, change: false, allergy: false };
  it('builds no plan under 12 months or without a birth date', () => {
    expect(readinessVerdict(11, yes)).toMatchObject({ tone: 'red', canPlan: false, title: 'weaning_verdict_young_title' });
    expect(readinessVerdict(9, yes).canPlan).toBe(false);
    expect(readinessVerdict(null, yes).canPlan).toBe(false);
  });
  it('suggests a 10-day delay for a sick child and 14 days for a big change', () => {
    expect(readinessVerdict(14, { ...yes, sick: true })).toMatchObject({ tone: 'amber', canPlan: true, delay: 10 });
    expect(readinessVerdict(14, { ...yes, change: true })).toMatchObject({ tone: 'amber', canPlan: true, delay: 14 });
    expect(readinessVerdict(14, { ...yes, sick: true, change: true }).delay).toBe(10);
    expect(readinessVerdict(12, yes)).toMatchObject({ tone: 'mint', canPlan: true, delay: 0 });
  });
  it('computes the age in whole months from the birth date', () => {
    const now = new Date(2026, 10, 9);
    expect(ageInMonths('2025-11-09', now)).toBe(12);
    expect(ageInMonths('2025-11-10', now)).toBe(11);
    expect(ageInMonths('2026-02-01', now)).toBe(9);
    expect(ageInMonths(null, now)).toBeNull();
    expect(ageInMonths('2027-01-01', now)).toBeNull();
  });
  it('shows the tile only in the mommy module from 9 months when the admin switch is on', () => {
    const now = new Date(2026, 10, 9);
    expect(isWeaningTileVisible({ lifeStage: 'mommy', birthDate: '2026-02-09', setting: 'on', now })).toBe(true);
    expect(isWeaningTileVisible({ lifeStage: 'mommy', birthDate: '2026-02-10', setting: 'on', now })).toBe(false);
    expect(isWeaningTileVisible({ lifeStage: 'mommy', birthDate: '2025-01-01', setting: 'off', now })).toBe(false);
    expect(isWeaningTileVisible({ lifeStage: 'mommy', birthDate: '2025-01-01', setting: undefined, now })).toBe(false);
    expect(isWeaningTileVisible({ lifeStage: 'bump', birthDate: '2025-01-01', setting: 'on', now })).toBe(false);
    expect(isWeaningTileVisible({ lifeStage: 'mommy', birthDate: null, setting: 'on', now })).toBe(false);
  });
});

describe('evaluateCheckin (red flags)', () => {
  it('pauses and sends to a doctor for lump + fever or redness + fever (possible mastitis)', () => {
    for (const flags of [{ lump: true, fever: true }, { red: true, fever: true }, { lump: true, red: true, fever: true }]) {
      const r = evaluateCheckin(ci({ ...flags, childSick: true, motherMood: 'low' }));
      expect(r).toMatchObject({ tone: 'red', action: 'pause', title: 'weaning_res_mastitis_title' });
      expect(r.items).toHaveLength(3);
    }
  });

  it('pauses and sends to a doctor for few wet diapers in a sick child (dehydration)', () => {
    const r = evaluateCheckin(ci({ diapers: 'few', childSick: true }));
    expect(r).toMatchObject({ tone: 'red', action: 'pause', title: 'weaning_res_dehyd_title', emergency: true });
    expect(WEANING_COPY[r.items[1]]).toContain('{emergency}');
    expect(WEANING_COPY[r.items[1]]).not.toMatch(/103|112/);
    // Few diapers alone is not the red flag.
    expect(evaluateCheckin(ci({ diapers: 'few' })).tone).toBe('mint');
  });

  it('slows down (+3 days) for a lump or redness without fever', () => {
    for (const flags of [{ lump: true }, { red: true }]) {
      expect(evaluateCheckin(ci({ ...flags, fullness: 'much' }))).toMatchObject({ tone: 'amber', action: 'slow', title: 'weaning_res_clog_title' });
    }
  });

  it('extends (+2 days) for very full breasts', () => {
    const r = evaluateCheckin(ci({ fullness: 'much' }));
    expect(r).toMatchObject({ tone: 'amber', action: 'extend', title: 'weaning_res_full_title' });
    expect(evaluateCheckin(ci({ fullness: 'some' })).action).toBeNull();
  });

  it('offers a pause for a sick child (and keeps an amber title)', () => {
    expect(evaluateCheckin(ci({ childSick: true }))).toMatchObject({ tone: 'sky', action: 'offerPause', title: 'weaning_res_sick_title' });
    const both = evaluateCheckin(ci({ childSick: true, fullness: 'much' }));
    expect(both).toMatchObject({ tone: 'amber', action: 'extend', title: 'weaning_res_full_title' });
    expect(both.items).toContain('weaning_res_sick_item');
  });

  it('links low maternal mood to the Mood diary and adds the sad-child note', () => {
    const r = evaluateCheckin(ci({ motherMood: 'low', childMood: 'sad' }));
    expect(r.moodLink).toBe(true);
    expect(r.items).toEqual(['weaning_res_child_sad', 'weaning_res_mother_low']);
    expect(evaluateCheckin(ci()).moodLink).toBe(false);
  });

  it('says all is well otherwise', () => {
    expect(evaluateCheckin(ci())).toMatchObject({ tone: 'mint', action: null, items: ['weaning_res_ok_item'] });
  });

  it('applies the result to the running step', () => {
    const p = plan();
    expect(applyCheckin(p, evaluateCheckin(ci({ lump: true }))).steps[0].len).toBe(10);
    expect(applyCheckin(p, evaluateCheckin(ci({ fullness: 'much' }))).steps[0].len).toBe(9);
    expect(applyCheckin(p, evaluateCheckin(ci({ red: true, fever: true })))).toMatchObject({ status: 'paused', pauseReason: 'doctor' });
    expect(applyCheckin(p, evaluateCheckin(ci({ childSick: true })))).toBe(p);
    expect(applyCheckin(cancelPlan(p), evaluateCheckin(ci({ lump: true, fever: true }))).status).toBe('cancelled');
  });
});

describe('nutrition and reminders', () => {
  it('rates milk: 2–3 cups ≈ 470–710 ml, a warning above 710 ml', () => {
    expect(milkStatus(3)).toBe('low');
    expect(milkStatus(4)).toBe('good');
    expect(milkStatus(5)).toBe('good');
    expect(milkStatus(6)).toBe('over');
  });

  it('plans 09:00 reminders only for upcoming steps of an active plan', () => {
    const p = plan();
    const now = new Date(2026, 10, 20, 12);
    const r = reminderDays(p, now);
    expect(r[0].step.id).toBe('s2');
    expect(r[0].at.getHours()).toBe(9);
    expect(reminderDays(pausePlan(p, 'manual'), now)).toEqual([]);
  });

  it('counts calendar days across DST changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});
