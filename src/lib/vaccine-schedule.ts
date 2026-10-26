import { addDays, addMonths, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { APP_LANGUAGES, normalizeAppLanguage } from './app-languages';

export interface CalendarOffset { months: number; days: number }
export interface VaccineTiming {
  protocol: 'anacan-vaccine-schedule-v1';
  version: string;
  kind: 'routine' | 'conditional' | 'seasonal';
  age: CalendarOffset;
  end_age: CalendarOffset | null;
  expected_age_days: number;
  expected_dose_number: number;
  source_url: string;
  source_label: string;
  relative?: { schedule_id: string; min: CalendarOffset; max?: CalendarOffset };
  gender?: 'boy' | 'girl';
  born_from?: string;
  display_name?: Record<string, string>;
}
interface ScheduleLike {
  id: string;
  dose_number: number;
  recommended_age_days: number;
  min_age_days: number | null;
  max_age_days: number | null;
  schedule_meta?: unknown;
}
interface VaccinationLike { administered_at: string | null; is_skipped: boolean }
export type VaccineStatus = 'done' | 'skipped' | 'overdue' | 'pending' | 'future' | 'conditional' | 'seasonal' | 'interval';
const offsetValid = (value: unknown): value is CalendarOffset => {
  const item = value as CalendarOffset | null;
  return !!item && Number.isInteger(item.months) && item.months >= 0 && item.months <= 240
    && Number.isInteger(item.days) && item.days >= -1 && item.days <= 7300;
};
export function vaccineTiming(row: ScheduleLike): VaccineTiming | null {
  const meta = row.schedule_meta as VaccineTiming | null;
  if (!meta || meta.protocol !== 'anacan-vaccine-schedule-v1' || !['routine', 'conditional', 'seasonal'].includes(meta.kind)
    || meta.expected_age_days !== row.recommended_age_days || meta.expected_dose_number !== row.dose_number
    || !offsetValid(meta.age) || (meta.end_age !== null && !offsetValid(meta.end_age))
    || (meta.relative && (!meta.relative.schedule_id || meta.relative.schedule_id === row.id || !offsetValid(meta.relative.min)
      || (meta.relative.max && !offsetValid(meta.relative.max))))) return null;
  return meta;
}
export function regionalCountry(language: string, ...selected: Array<string | null | undefined>): string {
  const explicit = selected.find(value => typeof value === 'string' && /^[a-z]{2}$/i.test(value));
  return explicit?.toUpperCase() || APP_LANGUAGES.find(item => item.code === normalizeAppLanguage(language))!.flag.toUpperCase();
}
export function calendarOffsetDate(iso: string, offset: CalendarOffset): Date {
  // parseISO keeps date-only observations on their local civil day; date-fns
  // clamps month ends and handles DST without dividing elapsed milliseconds.
  return addDays(addMonths(parseISO(iso), offset.months), offset.days);
}
export function vaccineEligible(row: ScheduleLike, birthDate: string, gender: string, log?: VaccinationLike | null): boolean {
  if (log?.administered_at || log?.is_skipped) return true;
  const timing = vaccineTiming(row);
  if (!timing) return true;
  if (timing.gender && gender !== timing.gender) return false;
  return !timing.born_from || birthDate >= timing.born_from;
}
export function vaccineStatus(row: ScheduleLike, birthDate: string, logs: Map<string, VaccinationLike>, today = new Date()): VaccineStatus {
  const log = logs.get(row.id);
  if (log?.administered_at) return 'done';
  if (log?.is_skipped) return 'skipped';
  const birth = parseISO(birthDate);
  if (!isValid(birth) || differenceInCalendarDays(today, birth) < 0) return 'future';
  const timing = vaccineTiming(row);
  if (!timing) {
    const age = differenceInCalendarDays(today, birth);
    if (age > (row.max_age_days ?? row.recommended_age_days + 60)) return 'overdue';
    return age >= (row.min_age_days ?? row.recommended_age_days) ? 'pending' : 'future';
  }
  if (timing.kind !== 'routine') return timing.kind;
  let start = calendarOffsetDate(birthDate, timing.age);
  let end = timing.end_age ? calendarOffsetDate(birthDate, timing.end_age) : null;
  if (timing.relative) {
    const earlier = logs.get(timing.relative.schedule_id)?.administered_at;
    if (!earlier || !isValid(parseISO(earlier))) return 'interval';
    const intervalStart = calendarOffsetDate(earlier, timing.relative.min);
    if (intervalStart > start) start = intervalStart;
    // An age illustration must never make an interval-based dose overdue before
    // the earlier dose's actual date. The stated interval is authoritative here.
    end = timing.relative.max ? calendarOffsetDate(earlier, timing.relative.max) : null;
  }
  if (differenceInCalendarDays(today, start) < 0) return 'future';
  if (end && differenceInCalendarDays(today, end) > 0) return 'overdue';
  return 'pending';
}
