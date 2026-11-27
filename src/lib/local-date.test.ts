import { describe, expect, it } from 'vitest';
import { daysAgoKey, localDateKey } from './local-date';

describe('local date keys', () => {
  it('uses the local calendar day, not UTC', () => {
    const lateNight = new Date(2026, 10, 8, 1, 30); // 01:30 local
    expect(localDateKey(lateNight)).toBe('2026-11-08');
    expect(daysAgoKey(1, lateNight)).toBe('2026-11-07');
    expect(daysAgoKey(8, new Date(2026, 2, 3, 12))).toBe('2026-02-23');
  });
});
