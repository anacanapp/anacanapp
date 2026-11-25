import { describe, expect, it } from 'vitest';
import { buildWeightAiPrompt, resolveWeightTrackerStage, weightTrend, type WeightPromptCopy } from './weightTrackerStage';

const copy: WeightPromptCopy = {
  prefix: 'Weight:', week: 'week', start: 'start:', now: 'now:', gain: 'gain:', change: 'change:', rec: 'rec:', status: 'Status:', rules: 'RULES.',
  contextPregnancyUnknownWeek: 'Pregnant, week unknown.', contextCycle: 'Not pregnant, tracks her cycle.', contextPostpartum: 'Postpartum, not pregnant.',
};

describe('resolveWeightTrackerStage', () => {
  it('pregnancy with a known week shows ranges, the chart and the pre-eclampsia strip', () => {
    expect(resolveWeightTrackerStage('bump', 23)).toEqual({ mode: 'pregnancy', week: 23, trimester: 2, showGainRange: true, showPregnancySafety: true });
  });
  it('never invents week 20 when the pregnancy week is unknown', () => {
    for (const week of [null, undefined, 0, -3, Number.NaN]) {
      expect(resolveWeightTrackerStage('bump', week)).toMatchObject({ mode: 'pregnancy', week: null, trimester: null, showGainRange: false });
    }
  });
  it('cycle and postpartum users get no pregnancy week, range or danger strip (even with a period date)', () => {
    expect(resolveWeightTrackerStage('flow', 20)).toEqual({ mode: 'cycle', week: null, trimester: null, showGainRange: false, showPregnancySafety: false });
    expect(resolveWeightTrackerStage('mommy', 20)).toEqual({ mode: 'postpartum', week: null, trimester: null, showGainRange: false, showPregnancySafety: false });
    expect(resolveWeightTrackerStage(null, 20).mode).toBe('cycle');
  });
});

describe('buildWeightAiPrompt', () => {
  const base = { startWeight: 60, currentWeight: 62.5, change: 2.5, statusText: 'Normal', recommended: { min: 1.2, max: 3.4 }, bmi: 22.1 };
  it('pregnancy: real week and IOM range', () => {
    const text = buildWeightAiPrompt({ ...base, stage: resolveWeightTrackerStage('bump', 18) }, copy);
    expect(text).toContain('18 week');
    expect(text).toContain('rec: 1.2-3.4kg');
  });
  it('flow and mommy prompts name the real stage and carry no week or pregnancy range', () => {
    for (const [stage, context] of [['flow', copy.contextCycle], ['mommy', copy.contextPostpartum]] as const) {
      const text = buildWeightAiPrompt({ ...base, stage: resolveWeightTrackerStage(stage, 20) }, copy);
      expect(text).toContain(context);
      expect(text).not.toMatch(/\bweek\b|rec:|20/);
      expect(text).toContain('change: +2.5kg');
      expect(text).toContain('BMI: 22.1');
    }
  });
  it('pregnancy with an unknown week says so instead of claiming a week', () => {
    const text = buildWeightAiPrompt({ ...base, stage: resolveWeightTrackerStage('bump', null) }, copy);
    expect(text).toContain(copy.contextPregnancyUnknownWeek);
    expect(text).not.toContain('rec:');
  });
});

describe('weightTrend', () => {
  it('treats small changes as stable', () => {
    expect(weightTrend(0.3)).toBe('stable');
    expect(weightTrend(1.2)).toBe('up');
    expect(weightTrend(-2)).toBe('down');
  });
});
