import { describe, expect, it } from 'vitest';
import { AFTER_MEAL_1H, formatGlucose, glucoseStatus, hasRepeatedHighs, mgdlToMmol, mmolToMgdl, parseGlucoseInput, targetFor, thresholdText } from './bloodSugar';

describe('gestational diabetes targets', () => {
  it('uses fasting <95, 1 h <140 and 2 h <120 mg/dL', () => {
    expect(targetFor('fasting')).toBe(95);
    expect(targetFor(AFTER_MEAL_1H)).toBe(140);
    expect(targetFor('after_meal')).toBe(120);
    expect(glucoseStatus(94, 'fasting')).toBe('normal');
    expect(glucoseStatus(95, 'fasting')).toBe('high');
    expect(glucoseStatus(139, AFTER_MEAL_1H)).toBe('normal');
    expect(glucoseStatus(140, AFTER_MEAL_1H)).toBe('high');
    expect(glucoseStatus(119, 'after_meal')).toBe('normal');
    expect(glucoseStatus(125, 'after_meal')).toBe('high');
  });

  it('flags hypoglycaemia below 70 mg/dL for any reading type', () => {
    expect(glucoseStatus(69, 'fasting')).toBe('low');
    expect(glucoseStatus(65, 'random')).toBe('low');
    expect(glucoseStatus(70, 'random')).toBe('normal');
  });
});

describe('units', () => {
  it('converts 1 mmol/L = 18 mg/dL and shows the published thresholds', () => {
    expect(mmolToMgdl(5.3)).toBe(95.4);
    expect(mgdlToMmol(95)).toBe(5.3);
    expect(thresholdText(140, 'mmol')).toBe('7.8 mmol/L');
    expect(thresholdText(120, 'mmol')).toBe('6.7 mmol/L');
    expect(thresholdText(70, 'mmol')).toBe('3.9 mmol/L');
    expect(thresholdText(95, 'mgdl')).toBe('95 mg/dL');
  });

  it('parses input in either unit and stores mg/dL', () => {
    expect(parseGlucoseInput('5,5', 'mmol')).toBe(99);
    expect(parseGlucoseInput('92', 'mgdl')).toBe(92);
    expect(parseGlucoseInput('', 'mgdl')).toBeNull();
    expect(parseGlucoseInput('abc', 'mmol')).toBeNull();
    expect(parseGlucoseInput('2000', 'mgdl')).toBeNull();
    expect(formatGlucose(99, 'mmol')).toBe('5.5');
    expect(formatGlucose(99.4, 'mgdl')).toBe('99');
  });
});

describe('repeated readings above target', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const at = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  it('needs two highs within 7 days', () => {
    expect(hasRepeatedHighs([{ reading_value: 100, reading_type: 'fasting', logged_at: at(1) }], now)).toBe(false);
    expect(hasRepeatedHighs([
      { reading_value: 100, reading_type: 'fasting', logged_at: at(1) },
      { reading_value: 130, reading_type: 'after_meal', logged_at: at(30) }], now)).toBe(true);
    expect(hasRepeatedHighs([
      { reading_value: 100, reading_type: 'fasting', logged_at: at(1) },
      { reading_value: 130, reading_type: 'after_meal', logged_at: at(24 * 8) }], now)).toBe(false);
  });
});
