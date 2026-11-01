import { beforeEach, describe, expect, it } from 'vitest';
import { markPromptShown, promptShownToday } from './prompt-day';

describe('prompt-day', () => {
  beforeEach(() => localStorage.clear());
  it('blocks a second prompt on the same day only', () => {
    const d = new Date(2026, 10, 1, 9);
    expect(promptShownToday(d)).toBe(false);
    markPromptShown(d);
    expect(promptShownToday(new Date(2026, 10, 1, 22))).toBe(true);
    expect(promptShownToday(new Date(2026, 10, 2, 8))).toBe(false);
  });
});
