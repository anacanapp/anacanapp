import { describe, expect, it } from 'vitest';
import { dailyHistory, diaperStats, feedingStats, formatClockSeconds, formatMinutes, mlFromNotes, sleepStats, trendPoints } from './baby-logs-range';

const iso = (h: number, m = 0, day = 26) => new Date(2026, 9, day, h, m).toISOString();
const logs = [
  { id: '1', log_type: 'feeding', feed_type: 'breast_left', start_time: iso(8), end_time: iso(8, 15) },
  { id: '2', log_type: 'feeding', feed_type: 'formula', notes: '120 ml', start_time: iso(11) },
  { id: '3', log_type: 'feeding', feed_type: 'solid', notes: 'Banan', start_time: iso(14) },
  { id: '4', log_type: 'sleep', start_time: iso(9), end_time: iso(10, 30) },
  { id: '5', log_type: 'diaper', diaper_type: 'wet', start_time: iso(9) },
  { id: '6', log_type: 'diaper', diaper_type: 'mixed', start_time: iso(13) },
  { id: '7', log_type: 'diaper', diaper_type: 'dirty', start_time: iso(13, 0, 25) },
];

describe('baby log statistics', () => {
  it('summarises feeding with breast minutes, formula ml and the average gap', () => {
    const s = feedingStats(logs);
    expect(s).toMatchObject({ total: 3, left: 1, right: 0, breastMinutes: 15, formulaCount: 1, formulaMl: 120, solidCount: 1 });
    expect(s.averageGapMinutes).toBe(180);
    expect(s.last?.kind).toBe('solid');
  });

  it('summarises sleep and diapers', () => {
    expect(sleepStats(logs)).toMatchObject({ totalMinutes: 90, longestMinutes: 90 });
    expect(diaperStats(logs)).toMatchObject({ total: 3, wet: 1, dirty: 1, mixed: 1 });
  });

  it('builds daily trend points and newest-first history', () => {
    const now = new Date(2026, 9, 26, 20);
    const trend = trendPoints(logs, 'diaper', now, 7);
    expect(trend).toHaveLength(7);
    expect(trend[6].count).toBe(2);
    expect(trend[5].count).toBe(1);
    expect(trendPoints(logs, 'sleep', now, 90)).toHaveLength(13); // weekly buckets past 30 days
    expect(dailyHistory(logs, now, 2)[0]).toMatchObject({ feedings: 3, formulaMl: 120, sleepMinutes: 90, diapers: 2 });
  });

  it('formats durations and parses ml', () => {
    expect(formatMinutes(95, { hour: 's', minute: 'dəq' })).toBe('1 s 35 dəq');
    expect(formatMinutes(60, { hour: 'h', minute: 'min' })).toBe('1 h');
    expect(formatClockSeconds(3725)).toBe('1:02:05');
    expect(mlFromNotes('90,5 ml')).toBe(90.5);
    expect(mlFromNotes('Banan')).toBeNull();
  });
});
