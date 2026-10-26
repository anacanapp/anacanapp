import { describe, it, expect } from 'vitest';
import { is511Rule } from './laborUtils';

// 5-1-1 qaydası: "indi xəstəxanaya get" siqnalını verir. Səhv həddlər ya
// hamiləni yalnış həyəcanlandıra, ya da HƏQİQİ doğuşu qaçıra bilər.
describe('is511Rule', () => {
  it('triggers true when interval<=5min, duration>=1min, and at least 3 recent contractions', () => {
    expect(is511Rule(300, 60, 3)).toBe(true); // exactly at both boundaries
    expect(is511Rule(240, 90, 5)).toBe(true); // well within range
  });

  it('does NOT trigger if the interval is longer than 5 minutes (301+ seconds)', () => {
    expect(is511Rule(301, 60, 3)).toBe(false);
    expect(is511Rule(600, 90, 5)).toBe(false);
  });

  it('does NOT trigger if the duration is shorter than 1 minute (<60 seconds)', () => {
    expect(is511Rule(200, 59, 3)).toBe(false);
    expect(is511Rule(180, 30, 5)).toBe(false);
  });

  it('does NOT trigger with fewer than 3 recent contractions (not enough data yet)', () => {
    expect(is511Rule(200, 90, 2)).toBe(false);
    expect(is511Rule(200, 90, 1)).toBe(false);
    expect(is511Rule(200, 90, 0)).toBe(false);
  });

  it('does NOT trigger when interval is 0 or negative (interval unknown — e.g. only one contraction logged)', () => {
    expect(is511Rule(0, 90, 3)).toBe(false);
    expect(is511Rule(-10, 90, 3)).toBe(false);
  });

  it('a real "false labor" scenario (long, infrequent, short contractions) does not trigger', () => {
    // Braxton Hicks tipik: seyrək (10+ dəqiqə) və qısa (<30 saniyə)
    expect(is511Rule(600, 20, 4)).toBe(false);
  });
});
