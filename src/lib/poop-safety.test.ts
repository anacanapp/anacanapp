import { describe, expect, it } from 'vitest';
import {
  RED_FLAG_ADVICE, enforcePoopSafety, type PoopAnalysisLike, knownAgeDays, redFlagAdvice, redFlagColour,
} from '../../supabase/functions/analyze-poop/safety';

const relaxed = {
  colorDetected: 'white',
  colorNameAz: 'Ağ',
  consistency: 'normal',
  isNormal: true,
  concernLevel: 'normal',
  explanation: 'Model text stays.',
  recommendations: ['Monitor the baby'],
  shouldSeeDoctor: false,
  doctorUrgency: 'none',
};

describe('redFlagColour', () => {
  it('classifies pale, black and red codes', () => {
    for (const c of ['white', 'grey', 'gray', 'clay', 'pale', 'WHITE', 'white/grey']) expect(redFlagColour(c)).toBe('pale');
    for (const c of ['black', 'tarry', 'Black']) expect(redFlagColour(c)).toBe('black');
    for (const c of ['red', 'bloody', 'blood']) expect(redFlagColour(c)).toBe('red');
  });
  it('leaves normal colours and mixed brown/green shades alone', () => {
    for (const c of ['brown', 'yellow', 'green', 'unknown', 'reddish-brown', 'dark green', '', undefined, null, 5]) {
      expect(redFlagColour(c)).toBeNull();
    }
  });
});

describe('knownAgeDays', () => {
  it('prefers exact days and falls back to months only when at least one month', () => {
    expect(knownAgeDays({ babyAgeDays: 2, babyAgeMonths: 0 })).toBe(2);
    expect(knownAgeDays({ babyAgeMonths: 0 })).toBeNull();
    expect(knownAgeDays({ babyAgeMonths: 2 })).toBe(60);
    expect(knownAgeDays(undefined)).toBeNull();
    expect(knownAgeDays({ babyAgeDays: Number.NaN })).toBeNull();
  });
});

describe('enforcePoopSafety', () => {
  it('forces urgent/immediate for pale stool and mentions the liver', () => {
    const out = enforcePoopSafety({ ...relaxed }, { babyAgeDays: 20 }, 'en');
    expect(out.concernLevel).toBe('urgent');
    expect(out.doctorUrgency).toBe('immediate');
    expect(out.shouldSeeDoctor).toBe(true);
    expect(out.isNormal).toBe(false);
    expect(out.explanation).toBe('Model text stays.');
    expect(out.recommendations[0]).toMatch(/liver/);
    expect(out.recommendations[0]).toMatch(/biliary atresia/);
    expect(out.recommendations).toContain('Monitor the baby');
  });

  it('forces urgent for red stool at any age, including newborns', () => {
    const out = enforcePoopSafety({ ...relaxed, colorDetected: 'red' }, { babyAgeDays: 1 }, 'az');
    expect(out.concernLevel).toBe('urgent');
    expect(out.doctorUrgency).toBe('immediate');
    expect(out.recommendations[0]).toBe(RED_FLAG_ADVICE.az.red);
  });

  it('does not force black stool in the meconium days (age known, under 4 days)', () => {
    const input = { ...relaxed, colorDetected: 'black' };
    for (const days of [0, 1, 2, 3]) expect(enforcePoopSafety(input, { babyAgeDays: days })).toBe(input);
  });

  it('forces black stool from day 4, when age is only known in months, or when age is unknown', () => {
    for (const age of [{ babyAgeDays: 4 }, { babyAgeMonths: 3 }, undefined, {}]) {
      const out = enforcePoopSafety({ ...relaxed, colorDetected: 'black' }, age, 'ru');
      expect(out.concernLevel).toBe('urgent');
      expect(out.doctorUrgency).toBe('immediate');
      expect(out.recommendations[0]).toBe(RED_FLAG_ADVICE.ru.black);
    }
  });

  it('leaves normal colours untouched and does not mutate the input', () => {
    const brown = { ...relaxed, colorDetected: 'brown' };
    expect(enforcePoopSafety(brown, { babyAgeDays: 30 })).toBe(brown);
    const pale = { ...relaxed, recommendations: ['a'] };
    enforcePoopSafety(pale, null, 'en');
    expect(pale.concernLevel).toBe('normal');
    expect(pale.recommendations).toEqual(['a']);
  });

  it('copes with a missing recommendations array and does not duplicate the advice', () => {
    const once = enforcePoopSafety<PoopAnalysisLike>({ colorDetected: 'grey' }, null, 'en');
    expect(once.recommendations).toEqual([RED_FLAG_ADVICE.en.pale]);
    const twice = enforcePoopSafety(once, null, 'en');
    expect(twice.recommendations).toEqual([RED_FLAG_ADVICE.en.pale]);
  });

  it('has advice for all 23 app languages and falls back to Azerbaijani', () => {
    const langs = ['az', 'en', 'tr', 'ru', 'kk', 'uz', 'ka', 'de', 'ar', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et'];
    expect(Object.keys(RED_FLAG_ADVICE).sort()).toEqual([...langs].sort());
    for (const l of langs) for (const c of ['pale', 'black', 'red'] as const) {
      expect(RED_FLAG_ADVICE[l][c].length).toBeGreaterThan(10);
      expect(RED_FLAG_ADVICE[l][c]).not.toContain('—');
    }
    expect(redFlagAdvice('red', 'xx')).toBe(RED_FLAG_ADVICE.az.red);
  });
});
