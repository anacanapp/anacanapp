import { describe, expect, it } from 'vitest';
import { moodTone, moodToneStyle } from './mood-colors';

describe('mood colours', () => {
  it('colours the 1-5 scale from the value, ignoring the light-only database class', () => {
    expect([1, 2, 3, 4, 5].map((v) => moodTone(v))).toEqual(['pink', 'coral', 'yellow', 'blue', 'green']);
    expect(moodTone(1, 'bg-green-100 border-green-300')).toBe('pink');
  });

  it('maps the database class for values outside the scale', () => {
    expect(moodTone(6, 'bg-red-100 border-red-300')).toBe('pink');
    expect(moodTone(7, 'bg-orange-100 border-orange-300')).toBe('coral');
    expect(moodTone(8, 'bg-lime-100 border-lime-300')).toBe('green');
    expect(moodTone(9, 'bg-purple-100')).toBe('lav');
    expect(moodTone(0, 'bg-gray-100 border-gray-300')).toBe('neutral');
    expect(moodTone(0, null)).toBe('neutral');
  });

  it('uses only design tokens (with .dark values) for the style', () => {
    for (const tone of ['pink', 'coral', 'yellow', 'blue', 'green', 'lav', 'neutral'] as const) {
      const style = moodToneStyle(tone);
      expect(String(style.background)).toMatch(/^var\(--a-[a-z0-9-]+\)$/);
      expect(String(style.borderColor)).toMatch(/^var\(--a-[a-z0-9-]+\)$/);
    }
  });
});
