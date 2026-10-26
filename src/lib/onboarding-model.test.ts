import { beforeEach, describe, expect, it } from 'vitest';
import { ONBOARDING_STAGES, BRANCH_QUESTIONS, CONCERNS, QUESTION_OPTIONS, calendarDay, childDueDate, hasPendingOnboarding,
  newOnboardingDraft, onboardingDataError, onboardingSteps, pregnancyDates, readOnboardingDraft, recommendedOnboardingPlan,
  selectOnboardingStage, toggleOnboardingAnswer, validatedOnboardingAnswers, writeOnboardingDraft } from './onboarding-model';
import { ONBOARDING_COPY, ONBOARDING_LANGUAGES, onboardingDate, onboardingText, type OnboardingCopyKey } from './onboarding-i18n';

const actor = '11111111-1111-4111-8111-111111111111', backend = 'https://api.anacan.az';
beforeEach(() => localStorage.clear());
const fixture = () => ({ ...newOnboardingDraft(actor, backend, 'Aysel'), stage: 'bump' as const, pregnancyDate: '2026-06-01' });

describe('calendar and data contracts', () => {
  it('rejects impossible and future dates and derives LMP/due dates without timezone shifts', () => {
    expect(calendarDay('2026-02-30')).toBeNull(); expect(calendarDay('2024-02-29')).not.toBeNull();
    expect(onboardingDataError({ ...fixture(), pregnancyDate: '2026-09-23' }, '2026-09-22')).toBe('pregnancy_date_invalid');
    const dates = pregnancyDates(fixture());
    expect(dates).toEqual({ lastPeriod: '2026-06-01', due: '2027-03-08' });
    expect(pregnancyDates({ dateMode: 'due', pregnancyDate: dates.due })).toEqual(dates);
    expect(onboardingDataError({ ...fixture(), dateMode: 'due', pregnancyDate: '2026-09-15' }, '2026-09-22')).toBeNull();
  });
  it('preserves the supported cycle limits and validates both lengths', () => {
    const draft = { ...fixture(), stage: 'flow' as const, lastPeriodDate: '2026-09-01', cycleLength: 10, periodLength: 10 };
    expect(onboardingDataError(draft, '2026-09-22')).toBeNull();
    expect(onboardingDataError({ ...draft, cycleLength: 51 }, '2026-09-22')).toBe('cycle_length_invalid');
    expect(onboardingDataError({ ...draft, periodLength: 11 }, '2026-09-22')).toBe('cycle_length_invalid');
  });
  it('requires each child and retains the corrected-age input', () => {
    const draft = { ...fixture(), stage: 'mommy' as const };
    draft.children[0] = { ...draft.children[0], name: 'Leyla', gender: 'girl', birthDate: '2026-08-01', term: 'preterm', gestationalWeeks: 34 };
    expect(childDueDate(draft.children[0])).toBe('2026-09-12');
    expect(onboardingDataError(draft, '2026-09-22')).toBeNull();
    expect(onboardingDataError({ ...draft, babyCount: 2 }, '2026-09-22')).toBe('baby_count_invalid');
    expect(onboardingDataError({ ...draft, babyCount: 2, children: [draft.children[0], { ...draft.children[0], id: crypto.randomUUID() }] }, '2026-09-22')).toBe('duplicate_child');
  });
});
it('switches branches without carrying incompatible health data or answer IDs', () => {
  const changed = selectOnboardingStage({ ...fixture(), answers: { firstPregnancy: 'first', sleep: 'poor' } }, 'flow');
  expect(changed).toMatchObject({ stage: 'flow', name: 'Aysel', pregnancyDate: '', lastPeriodDate: '', answers: {}, step: 'name' });
  expect(onboardingSteps('flow', false)).not.toContain('feeding');
  expect(onboardingSteps('mommy', true)).toContain('notifications');
});
it('keeps none exclusive, stores stable IDs and does not invent skipped answers', () => {
  expect(toggleOnboardingAnswer(['none'], 'nausea')).toEqual(['nausea']);
  expect(toggleOnboardingAnswer(['nausea'], 'none')).toEqual(['none']);
  const answers = validatedOnboardingAnswers({ ...fixture(), answers: { feeding: 'formula', bumpSymptoms: ['none', 'nausea'], concern: 'invented', budget: 'flexible' } });
  expect(answers).not.toHaveProperty('feeding'); expect(answers.concern).toBeNull(); expect(answers.bumpSymptoms).toEqual(['none']);
  expect(recommendedOnboardingPlan(answers as any)).toBe('monthly');
});
it('does not present irregular periods as an answer alongside a regular cycle', () => {
  const answers = validatedOnboardingAnswers({ ...fixture(), stage: 'flow', answers: { regularity: 'regular', concern: 'irregular' } });
  expect(answers.regularity).toBe('regular'); expect(answers.concern).toBeNull();
});
it('resumes only the same authenticated realm and never reopens a completed server journey', () => {
  const draft = fixture(); writeOnboardingDraft(draft);
  expect(readOnboardingDraft(actor, backend)).toEqual(draft);
  expect(readOnboardingDraft(actor, 'https://source.example')).toBeNull();
  expect(readOnboardingDraft('other', backend)).toBeNull();
  expect(hasPendingOnboarding(actor, backend, { journey: { version: 3, id: draft.id, revision: 'r', completedAt: '2026-09-22' } })).toBe(false);
});
it('does not silently swallow persistence failures', () => {
  const storage = { setItem: () => { throw new DOMException('blocked', 'SecurityError'); } } as unknown as Storage;
  expect(() => writeOnboardingDraft(fixture(), storage)).toThrow();
});

describe('all nine real language dictionaries', () => {
  it.each(ONBOARDING_LANGUAGES)('%s covers every branch/option and all placeholders', language => {
    const index = ONBOARDING_LANGUAGES.indexOf(language);
    for (const [key, values] of Object.entries(ONBOARDING_COPY)) {
      expect(values).toHaveLength(9); expect(values[index].trim(), key).not.toBe('');
      expect([...values[index].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort(), key)
        .toEqual([...values[0].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort());
    }
    for (const stage of ONBOARDING_STAGES) {
      expect(onboardingText(language, `stage_${stage}`)).not.toBe('');
      for (const question of [...BRANCH_QUESTIONS[stage], 'sleep', 'supportLevel', 'duration', 'budget'] as const) {
        expect(onboardingText(language, `q_${question}` as OnboardingCopyKey)).not.toBe('');
        for (const option of QUESTION_OPTIONS[question]) expect(onboardingText(language, option as OnboardingCopyKey)).not.toBe(option);
      }
      for (const option of CONCERNS[stage]) expect(onboardingText(language, option as OnboardingCopyKey)).not.toBe('');
    }
    expect(onboardingDate(language, '2026-09-22')).not.toMatch(/Invalid|M09/);
  });
});
