import { expect, it } from 'vitest';
import { hasPeriodFlow, localPeriodDate, periodFlowLabel, validatePeriodDates } from './period-flow';

it('keeps selected local days rather than converting midnight to the previous UTC day', () => {
  expect(localPeriodDate(new Date(2026, 8, 14, 0, 0))).toBe('2026-09-14');
  expect(localPeriodDate('2026-09-14')).toBe('2026-09-14');
});
it('retains all five explicitly selected days and makes repeated selections idempotent', () => {
  expect(validatePeriodDates(['2026-09-14', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'],
    new Date(2026, 8, 14))).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
});
it('distinguishes had-flow without an amount from no flow, spotting, or no record', () => {
  expect(hasPeriodFlow(null)).toBe(true);
  expect(hasPeriodFlow('unspecified')).toBe(true);
  expect(hasPeriodFlow('medium')).toBe(true);
  expect(hasPeriodFlow('none')).toBe(false);
  expect(hasPeriodFlow('spotting')).toBe(false);
  expect(hasPeriodFlow(undefined)).toBe(false);
  expect(periodFlowLabel(null)).toBe('unspecified');
});
it('does not allow empty, malformed or predicted future days to be recorded', () => {
  for (const dates of [[], ['not-a-date'], ['2026-09-15']]) {
    expect(() => validatePeriodDates(dates, new Date(2026, 8, 14))).toThrow();
  }
});
