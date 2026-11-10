/**
 * Azerbaijani maternity benefit ("dekret pulu") arithmetic for /az/dekret-pulu-kalkulyatoru/.
 * Leave days and the pay percentage come from the app's `src/data/maternityRules.ts` (AZ rule); this
 * module only combines them. Daily amount = average monthly salary × 12 / 365 × payPercentage, the same
 * formula the app uses (useMaternityBenefits): sosial.gov.az computes the average daily earnings from the
 * four quarters before the leave month divided by its calendar days.
 *
 * Multiple births: Əmək Məcəlləsi article 125.1 gives 70 days before and 70 after birth both for a
 * complicated birth and for two or more children (agricultural workers, 125.2: 70 + 110). The AZ rule's
 * `multipleDaysBefore/After` (84 + 110) does not match that text, so the website uses the complicated
 * values for multiple births until the rule is reviewed (MULTIPLE_BIRTH_BASIS).
 */
import type { MaternityRule } from '../../data/maternityRules';
import { addCalendarDays, calendarIso, parseCalendarDate } from '../calculators';

export type BirthType = 'normal' | 'complicated' | 'multiple';
export const BIRTH_TYPES: readonly BirthType[] = ['normal', 'complicated', 'multiple'];
/** 'labour-code': multiple births use normalDaysBefore + complicatedDaysAfter (Labour Code 125.1).
 *  'rules': use multipleDaysBefore/After from maternityRules as the app does. */
export const MULTIPLE_BIRTH_BASIS: 'labour-code' | 'rules' = 'labour-code';
export const DAYS_PER_YEAR = 365;

export interface LeaveDays { before: number; after: number; total: number }
export function leaveDays(rule: MaternityRule, type: BirthType): LeaveDays {
  const before = type === 'multiple' && MULTIPLE_BIRTH_BASIS === 'rules' ? rule.multipleDaysBefore : rule.normalDaysBefore;
  const after = type === 'normal' ? rule.normalDaysAfter : type === 'multiple' && MULTIPLE_BIRTH_BASIS === 'rules' ? rule.multipleDaysAfter : rule.complicatedDaysAfter;
  return { before, after, total: before + after };
}
export const payShare = (rule: MaternityRule) => (rule.payPercentage ?? rule.compensation?.percentage ?? 100) / 100;
export const round2 = (value: number) => Math.round(value * 100) / 100;

export class DekretInputError extends Error {
  readonly code: 'salary' | 'date';
  constructor(code: 'salary' | 'date') { super(code); this.code = code; }
}
export interface DekretEstimate extends LeaveDays {
  salary: number; daily: number; benefit: number; percentage: number;
  start?: string; end?: string; returnDate?: string; dueDate?: string;
}
export function estimateDekret(rule: MaternityRule, input: { salary: number; type: BirthType; dueDate?: string }): DekretEstimate {
  const { salary, type } = input;
  if (!Number.isFinite(salary) || salary <= 0 || salary > 1_000_000) throw new DekretInputError('salary');
  const days = leaveDays(rule, type), share = payShare(rule);
  const dailyExact = salary * 12 / DAYS_PER_YEAR * share;
  const result: DekretEstimate = { ...days, salary, percentage: share * 100, daily: round2(dailyExact), benefit: round2(dailyExact * days.total) };
  if (input.dueDate) {
    const due = parseCalendarDate(input.dueDate);
    if (!due) throw new DekretInputError('date');
    const start = addCalendarDays(due, -days.before), end = addCalendarDays(start, days.total - 1);
    Object.assign(result, { dueDate: input.dueDate, start: calendarIso(start), end: calendarIso(end), returnDate: calendarIso(addCalendarDays(end, 1)) });
  }
  return result;
}
/** "4 142,47" style AZN amount (space thousands, comma decimals) without Intl differences between server and browser. */
export function formatAzn(value: number): string {
  const [whole, fraction] = round2(value).toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${fraction}`;
}
