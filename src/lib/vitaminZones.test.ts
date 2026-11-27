import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE, groupZonesBySlices, normalizeTimeZone, vitaminSlicesForZone } from '../../scripts/notification-jobs/vitamin-zones.mjs';

type Slice = { from: string; to: string; date: string; dow: number };
const slices = (iso: string, zone?: string): Slice[] => vitaminSlicesForZone(new Date(iso), zone);

describe('vitamin reminder slices per time zone', () => {
  it('matches the existing Baku window (UTC+4, 3-7 minutes ahead)', () => {
    expect(DEFAULT_TIME_ZONE).toBe('Asia/Baku');
    expect(slices('2026-10-27T10:55:00Z')).toEqual([{ from: '14:58:00', to: '15:03:00', date: '2026-10-27', dow: 2 }]);
    // A few seconds of start delay keep the same tick.
    expect(slices('2026-10-27T10:55:20Z')).toEqual(slices('2026-10-27T10:55:00Z'));
  });

  it('splits at local midnight with each part on its own local date', () => {
    expect(slices('2026-10-27T19:55:00Z')).toEqual([
      { from: '23:58:00', to: '24:00:00', date: '2026-10-27', dow: 2 },
      { from: '00:00:00', to: '00:03:00', date: '2026-10-28', dow: 3 },
    ]);
  });

  it('uses the user zone, including daylight saving time and quarter-hour offsets', () => {
    expect(slices('2026-07-01T10:55:00Z', 'Europe/Berlin')[0]).toMatchObject({ from: '12:58:00', date: '2026-07-01' });
    expect(slices('2026-10-27T10:55:00Z', 'Europe/Berlin')[0]).toMatchObject({ from: '11:58:00', date: '2026-10-27' });
    expect(slices('2026-10-27T10:55:00Z', 'Asia/Kathmandu')[0]).toMatchObject({ from: '16:43:00', to: '16:48:00' });
  });

  it('takes the "today" day in the user zone (taken-today check)', () => {
    // 03:55 UTC on 8 Nov is still Saturday 7 Nov evening in New York.
    expect(slices('2026-11-08T03:55:00Z', 'America/New_York')).toEqual([{ from: '22:58:00', to: '23:03:00', date: '2026-11-07', dow: 6 }]);
    expect(slices('2026-11-08T03:55:00Z')[0].date).toBe('2026-11-08');
  });

  it('falls back to Baku for unknown zones', () => {
    expect(normalizeTimeZone('Not/AZone')).toBeNull();
    expect(normalizeTimeZone(' Europe/Berlin ')).toBe('Europe/Berlin');
    expect(normalizeTimeZone(null)).toBeNull();
    expect(slices('2026-10-27T10:55:00Z', 'Not/AZone')).toEqual(slices('2026-10-27T10:55:00Z'));
  });

  it('groups zones that need the same slice', () => {
    const groups = groupZonesBySlices(['Asia/Dubai', 'Europe/Berlin', 'Not/AZone', null, 'Asia/Baku'], new Date('2026-10-27T10:55:00Z'));
    expect(groups).toHaveLength(2);
    const baku = groups.find((g: { includesDefault: boolean }) => g.includesDefault);
    expect(baku.zones.sort()).toEqual(['Asia/Baku', 'Asia/Dubai', 'Not/AZone']);
    const berlin = groups.find((g: { includesDefault: boolean }) => !g.includesDefault);
    expect(berlin.zones).toEqual(['Europe/Berlin']);
    expect(berlin.slices[0].from).toBe('11:58:00');
  });
});
