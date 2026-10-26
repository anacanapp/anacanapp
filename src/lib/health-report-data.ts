import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, subDays, subMonths } from 'date-fns';

export type ReportPeriod = '1week' | '1month' | '3months' | 'all';
export interface ReportRange { start: Date | null; end: Date; startDay: string | null; endDay: string; }
export interface ReportWeight { id: string; entry_date: string; weight: number | string; }
export interface ReportDailyLog { id: string; log_date: string; water_intake: number | null; mood: number | null; sleep_hours: number | string | null; }
export interface ReportExercise { id: string; completed_at: string; duration_minutes: number | null; }
export interface ReportBp { id: string; measured_at: string; systolic: number; diastolic: number; pulse: number | null; }
export interface ReportFetal { id: string; baby_label: string; scan_date: string; efw_grams: number | string; }
export interface ReportPeriodDay { id: string; log_date: string; flow_intensity: string | null; }
export interface ReportBabyLog { id: string; log_type: string; start_time: string; end_time: string | null; feed_type: string | null; diaper_type: string | null; amount_ml: number | null; notes: string | null; }
export interface HealthReportSnapshot {
  range: ReportRange; weights: ReportWeight[]; daily: ReportDailyLog[]; exercises: ReportExercise[];
  bloodPressure: ReportBp[]; fetal: ReportFetal[]; periodDays: ReportPeriodDay[]; baby: ReportBabyLog[];
}

export function rehydrateReportSnapshot(snapshot: HealthReportSnapshot): HealthReportSnapshot {
  if (snapshot.range.end instanceof Date && (!snapshot.range.start || snapshot.range.start instanceof Date)) return snapshot;
  return { ...snapshot, range: { ...snapshot.range, start: snapshot.range.start ? new Date(snapshot.range.start) : null, end: new Date(snapshot.range.end) } };
}

export function getReportRange(period: ReportPeriod, now = new Date()): ReportRange {
  const start = period === 'all' ? null : startOfDay(period === '1week' ? subDays(now, 6) : subMonths(now, period === '3months' ? 3 : 1));
  return { start, end: now, startDay: start ? format(start, 'yyyy-MM-dd') : null, endDay: format(now, 'yyyy-MM-dd') };
}

export function finiteMeasurement(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function meanRecorded(values: unknown[]): { value: number | null; count: number } {
  const measured = values.map(finiteMeasurement).filter((value): value is number => value !== null);
  return { value: measured.length ? measured.reduce((sum, n) => sum + n, 0) / measured.length : null, count: measured.length };
}

export function summarizeBabyCare(logs: ReportBabyLog[], range: ReportRange) {
  const sleepByDay = new Map<string, number>();
  const feedingDays = new Set<string>(), diaperDays = new Set<string>();
  let feeding = 0, breast = 0, formula = 0, solid = 0, unknownFeeding = 0, diapers = 0, wet = 0, dirty = 0, mixed = 0, unknownDiapers = 0;
  let formulaMl = 0, formulaAmounts = 0, completedSleep = 0, ongoingSleep = 0;
  const from = range.start?.getTime() ?? -Infinity, to = range.end.getTime();
  for (const log of logs) {
    const start = new Date(log.start_time).getTime();
    if (!Number.isFinite(start) || start > to) continue;
    if (log.log_type === 'sleep') {
      if (!log.end_time) { ongoingSleep++; continue; }
      const end = new Date(log.end_time).getTime();
      if (!Number.isFinite(end) || end <= start || end <= from) continue;
      const clippedEnd = Math.min(end, to);
      let cursor = Math.max(start, from);
      if (cursor >= clippedEnd) continue;
      completedSleep++;
      while (cursor < clippedEnd) {
        const day = format(new Date(cursor), 'yyyy-MM-dd');
        const boundary = startOfDay(addDays(new Date(cursor), 1)).getTime();
        const stop = Math.min(boundary, clippedEnd);
        sleepByDay.set(day, (sleepByDay.get(day) || 0) + (stop - cursor) / 60000);
        cursor = stop;
      }
      continue;
    }
    if (start < from) continue;
    const day = format(new Date(start), 'yyyy-MM-dd');
    if (log.log_type === 'feeding') {
      feeding++; feedingDays.add(day);
      if (['breast','breastfeeding','breast_left','breast_right','left','right'].includes(log.feed_type || '')) breast++;
      else if (log.feed_type === 'formula') {
        formula++;
        const legacyAmount = log.notes?.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i)?.[1]?.replace(',', '.');
        const amount = finiteMeasurement(log.amount_ml ?? legacyAmount);
        if (amount !== null && amount >= 0) { formulaMl += amount; formulaAmounts++; }
      } else if (log.feed_type === 'solid') solid++;
      else unknownFeeding++;
    } else if (log.log_type === 'diaper') {
      diapers++; diaperDays.add(day);
      if (log.diaper_type === 'wet') wet++;
      else if (log.diaper_type === 'dirty') dirty++;
      else if (['mixed','both'].includes(log.diaper_type || '')) mixed++;
      else unknownDiapers++;
    }
  }
  const sleepMinutes = [...sleepByDay.values()].reduce((sum, value) => sum + value, 0);
  return {
    sleepMinutes, sleepDays: sleepByDay.size, sleepAverage: sleepByDay.size ? sleepMinutes / sleepByDay.size : null,
    completedSleep, ongoingSleep, feeding, feedingDays: feedingDays.size, feedingAverage: feedingDays.size ? feeding / feedingDays.size : null,
    breast, formula, solid, unknownFeeding, formulaMl, formulaAmounts, diapers, diaperDays: diaperDays.size,
    diaperAverage: diaperDays.size ? diapers / diaperDays.size : null, wet, dirty, mixed, unknownDiapers,
  };
}

export function reportCoverage(snapshot: HealthReportSnapshot) {
  const days = new Set<string>();
  snapshot.weights.forEach(row => days.add(row.entry_date));
  snapshot.daily.forEach(row => days.add(row.log_date));
  snapshot.exercises.forEach(row => days.add(format(parseISO(row.completed_at), 'yyyy-MM-dd')));
  snapshot.bloodPressure.forEach(row => days.add(format(parseISO(row.measured_at), 'yyyy-MM-dd')));
  snapshot.fetal.forEach(row => days.add(row.scan_date));
  snapshot.periodDays.forEach(row => days.add(row.log_date));
  snapshot.baby.forEach(row => {
    const day = format(parseISO(row.start_time), 'yyyy-MM-dd');
    if ((!snapshot.range.startDay || day >= snapshot.range.startDay) && day <= snapshot.range.endDay) days.add(day);
  });
  const total = snapshot.weights.length + snapshot.daily.length + snapshot.exercises.length + snapshot.bloodPressure.length + snapshot.fetal.length + snapshot.periodDays.length + snapshot.baby.length;
  return { total, recordedDays: days.size, calendarDays: snapshot.range.start ? differenceInCalendarDays(snapshot.range.end, snapshot.range.start) + 1 : null };
}

/** PostgREST returns at most one page. Reports must not silently omit older records. */
export async function fetchAllReportRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
