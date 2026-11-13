import { describe, expect, it } from 'vitest';
import { isQuizTileVisible } from './visibility';
import { QUIZ_COPY, fill, quizCopy } from './copy';
import { nextIndex, quizPoints } from './api';
import { APP_LANGUAGES } from '@/lib/app-languages';

describe('daily quiz tile visibility', () => {
  const setting = { enabled: true, languages: ['az'] };
  it('shows for enabled languages only', () => {
    expect(isQuizTileVisible({ setting, language: 'az' })).toBe(true);
    expect(isQuizTileVisible({ setting, language: 'en' })).toBe(false);
    expect(isQuizTileVisible({ setting: JSON.stringify(setting), language: 'az' })).toBe(true);
  });
  it('hides when switched off or missing, but admins always see it', () => {
    expect(isQuizTileVisible({ setting: { ...setting, enabled: false }, language: 'az' })).toBe(false);
    expect(isQuizTileVisible({ setting: null, language: 'az' })).toBe(false);
    expect(isQuizTileVisible({ setting: null, language: 'ja', isAdmin: true })).toBe(true);
  });
});

describe('daily quiz copy', () => {
  it('covers every app language with the same keys and placeholders as Azerbaijani', () => {
    const keys = Object.keys(QUIZ_COPY.az).sort();
    for (const { code } of APP_LANGUAGES) {
      const c = QUIZ_COPY[code];
      expect(c, code).toBeTruthy();
      expect(Object.keys(c).sort(), code).toEqual(keys);
      expect(Object.keys(c.categories).sort(), code).toEqual(Object.keys(QUIZ_COPY.az.categories).sort());
      for (const k of keys) {
        const v = (c as unknown as Record<string, unknown>)[k];
        if (typeof v !== 'string') continue;
        const az = (QUIZ_COPY.az as unknown as Record<string, string>)[k];
        expect((v.match(/\{[a-z]+\}/g) || []).sort(), `${code}.${k}`).toEqual((az.match(/\{[a-z]+\}/g) || []).sort());
        expect(v.includes('—'), `${code}.${k} long dash`).toBe(false);
        expect(v.trim().length, `${code}.${k}`).toBeGreaterThan(0);
      }
    }
  });
  it('falls back to English and fills placeholders', () => {
    expect(quizCopy('xx')).toBe(QUIZ_COPY.en);
    expect(quizCopy('az-AZ')).toBe(QUIZ_COPY.az);
    expect(fill(QUIZ_COPY.az.question, { i: 2, n: 5 })).toBe('Sual 2 / 5');
  });
});

describe('daily quiz helpers', () => {
  it('scores like the server', () => {
    expect(quizPoints(0, 5)).toBe(0);
    expect(quizPoints(4, 5)).toBe(80);
    expect(quizPoints(5, 5)).toBe(120);
  });
  it('finds the next unanswered question', () => {
    expect(nextIndex([null, null])).toBe(0);
    expect(nextIndex([1, -1, null])).toBe(2);
    expect(nextIndex([1, 2])).toBe(2);
  });
});
