import { format, isValid, parseISO, startOfDay } from 'date-fns';

export type PeriodFlow = 'unspecified' | 'light' | 'medium' | 'heavy' | 'none' | 'spotting';
export type PeriodFlowAction = PeriodFlow | 'clear';
export const PERIOD_FLOWS: readonly PeriodFlow[] = ['unspecified', 'light', 'medium', 'heavy', 'none', 'spotting'];

/** A present legacy/null record means bleeding was logged without an amount. */
export function hasPeriodFlow(flow: string | null | undefined): boolean {
  return flow !== undefined && flow !== 'none' && flow !== 'spotting';
}

export function localPeriodDate(value: Date | string): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) throw new Error('INVALID_PERIOD_DATE');
  return format(date, 'yyyy-MM-dd');
}

export function validatePeriodDates(dates: readonly (Date | string)[], today = new Date()): string[] {
  const keys = [...new Set(dates.map(localPeriodDate))].sort();
  if (!keys.length || keys.length > 90 || keys.some(key => startOfDay(parseISO(key)) > startOfDay(today))) {
    throw new Error('INVALID_PERIOD_DATES');
  }
  return keys;
}

export function periodFlowLabel(flow: string | null | undefined): 'unspecified' | PeriodFlow {
  return PERIOD_FLOWS.includes(flow as PeriodFlow) ? flow as PeriodFlow : 'unspecified';
}
