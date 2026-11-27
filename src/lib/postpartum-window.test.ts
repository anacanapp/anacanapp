import { expect, it } from 'vitest';
import { daysSinceYoungestBirth, isEarlyPostpartum } from './postpartum-window';

const now = new Date(2026, 10, 8, 1, 30); // 8 Nov 2026, 01:30 local

it('uses the youngest baby and local calendar days', () => {
  expect(daysSinceYoungestBirth(['2024-01-01', '2026-11-01', null], now)).toBe(7);
  expect(isEarlyPostpartum(['2024-01-01', '2026-11-01'], now)).toBe(true);
});

it('ends after 41 days and ignores missing or future dates', () => {
  expect(isEarlyPostpartum(['2026-09-28'], now)).toBe(true); // day 41
  expect(isEarlyPostpartum(['2026-09-27'], now)).toBe(false); // day 42
  expect(isEarlyPostpartum([null, undefined, '2027-01-01', 'bad'], now)).toBe(false);
  expect(isEarlyPostpartum([new Date(2026, 10, 8)], now)).toBe(true);
});
