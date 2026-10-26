import { describe, expect, it } from 'vitest';
import { fetchAllReportRows, getReportRange, meanRecorded, rehydrateReportSnapshot, summarizeBabyCare, type HealthReportSnapshot, type ReportBabyLog } from './health-report-data';

const row = (values: Partial<ReportBabyLog>): ReportBabyLog => ({ id: 'log', log_type: 'feeding', start_time: '2026-09-15T12:00:00', end_time: null, feed_type: null, diaper_type: null, amount_ml: null, notes: null, ...values });

describe('clinical report source data', () => {
  it('uses seven calendar days, calendar months, and no artificial cutoff for all records', () => {
    const now = new Date(2026, 8, 15, 15);
    expect(getReportRange('1week', now).startDay).toBe('2026-09-09');
    expect(getReportRange('1month', now).startDay).toBe('2026-08-15');
    expect(getReportRange('3months', now).startDay).toBe('2026-06-15');
    expect(getReportRange('all', now).start).toBeNull();
  });

  it('does not turn missing measurements or unlogged days into zeros', () => {
    expect(meanRecorded([null, undefined, '', 'bad'])).toEqual({ value: null, count: 0 });
    expect(meanRecorded([null, 0, 6, '8'])).toEqual({ value: 14 / 3, count: 3 });
  });

  it('clips completed sleep at the reporting boundary, splits midnight, and excludes ongoing sleep', () => {
    const range = getReportRange('1week', new Date(2026, 8, 15, 12));
    const result = summarizeBabyCare([
      row({ log_type: 'sleep', start_time: '2026-09-08T22:00:00', end_time: '2026-09-09T02:00:00' }),
      row({ log_type: 'sleep', start_time: '2026-09-14T23:00:00', end_time: '2026-09-15T01:00:00' }),
      row({ log_type: 'sleep', start_time: '2026-09-15T10:00:00', end_time: null }),
    ], range);
    expect(result.sleepMinutes).toBe(240);
    expect(result.sleepDays).toBe(3);
    expect(result.sleepAverage).toBe(80);
    expect(result.ongoingSleep).toBe(1);
  });

  it('preserves feeding types and does not invent wet/dirty events for unknown diapers', () => {
    const result = summarizeBabyCare([
      row({ feed_type: 'breast_left' }), row({ feed_type: 'right' }),
      row({ feed_type: 'formula', amount_ml: 120 }), row({ feed_type: 'formula', notes: '90 ml' }),
      row({ feed_type: 'solid' }), row({ log_type: 'diaper', diaper_type: null }),
      row({ log_type: 'diaper', diaper_type: 'mixed' }), row({ log_type: 'diaper', diaper_type: 'wet' }),
    ], getReportRange('1month', new Date(2026, 8, 15, 15)));
    expect(result).toMatchObject({ feeding: 5, breast: 2, formula: 2, solid: 1, formulaMl: 210, formulaAmounts: 2,
      feedingAverage: 5, feedingDays: 1, diapers: 3, wet: 1, dirty: 0, mixed: 1, unknownDiapers: 1 });
  });

  it('loads all report pages and exposes failures instead of returning an empty clinical result', async () => {
    const source = Array.from({ length: 2105 }, (_, id) => ({ id }));
    const result = await fetchAllReportRows(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
    expect(result).toHaveLength(2105);
    await expect(fetchAllReportRows(async () => ({ data: null, error: new Error('offline') }))).rejects.toThrow('offline');
  });

  it('rehydrates persisted report dates before any age/duration calculations', () => {
    const original = { range: getReportRange('1month', new Date(2026, 8, 15, 15)), weights: [], daily: [], exercises: [], bloodPressure: [], fetal: [], periodDays: [], baby: [] } satisfies HealthReportSnapshot;
    const restored = rehydrateReportSnapshot(JSON.parse(JSON.stringify(original)));
    expect(restored.range.end.getTime()).toBe(original.range.end.getTime());
    expect(restored.range.start?.getTime()).toBe(original.range.start?.getTime());
    expect(summarizeBabyCare([], restored.range).sleepAverage).toBeNull();
  });
});
