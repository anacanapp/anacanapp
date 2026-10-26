import { describe, expect, it } from 'vitest';
import { AZ, MESSAGES } from './messages';

describe('Color Sort language coverage', () => {
  it('bundles every game message in all nine supported languages with matching parameters', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual(['az', 'en', 'tr', 'ru', 'de', 'ar', 'kk', 'uz', 'ka'].sort());
    const keys = Object.keys(AZ).sort();
    const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const [language, messages] of Object.entries(MESSAGES)) {
      expect(Object.keys(messages).sort(), language).toEqual(keys);
      for (const key of keys) {
        expect(messages[key].trim().length, `${language}:${key}`).toBeGreaterThan(0);
        expect(parameters(messages[key]), `${language}:${key}`).toEqual(parameters(AZ[key]));
      }
    }
  });
});
