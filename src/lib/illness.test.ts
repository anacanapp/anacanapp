import { afterEach, describe, expect, it } from 'vitest';
import {
  TEMP_UNIT_KEY, cToF, defaultTempUnit, fToC, formatTemp, fromUnit, illnessAlerts, localizeTempText, readTempUnit, saveTempUnit,
  tempBand, tempTemplate, toUnit, type IllnessEntry
} from './illness';

const NOW = new Date('2026-11-08T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
let seq = 0;
const entry = (over: Partial<IllnessEntry>): IllnessEntry => ({
  id: `e${seq++}`, kind: 'temp', at: NOW.toISOString(), temp_c: null, temp_method: null, med_name: null,
  dose: null, interval_hours: null, remind: false, symptoms: null, note: null, by: 'mother', by_me: true, ...over
});
const open = { started_at: hoursAgo(100), ended_at: null };
const kinds = (entries: IllnessEntry[], months: number | null) => illnessAlerts(open, entries, months, NOW).map((a) => a.kind);

describe('illnessAlerts', () => {
  it('flags any fever (38 °C or more) in a baby under 3 months', () => {
    expect(kinds([entry({ temp_c: 38 })], 2)).toEqual(['infant']);
    expect(kinds([entry({ temp_c: 38 })], 0)).toEqual(['infant']);
    expect(illnessAlerts(open, [entry({ temp_c: 38.3 })], 1, NOW)[0]).toEqual({ kind: 'infant', temp: 38.3, months: 1 });
  });

  it('does not raise the infant alert below 38 °C, from 3 months, or when the age is unknown', () => {
    expect(kinds([entry({ temp_c: 37.9 })], 1)).toEqual([]);
    expect(kinds([entry({ temp_c: 38.5 })], 3)).toEqual([]);
    expect(kinds([entry({ temp_c: 38.5 })], null)).toEqual([]);
  });

  it('uses the latest reading (entries are newest first)', () => {
    expect(kinds([entry({ temp_c: 37.2, at: hoursAgo(0) }), entry({ temp_c: 38.6, at: hoursAgo(2) })], 1)).toEqual([]);
    expect(kinds([entry({ temp_c: 38.5, at: hoursAgo(0) }), entry({ temp_c: 40.3, at: hoursAgo(2) })], 12)).toEqual([]);
  });

  it('flags 40 °C or more at any age', () => {
    expect(kinds([entry({ temp_c: 40 })], 24)).toEqual(['high']);
    expect(kinds([entry({ temp_c: 39.9 })], 24)).toEqual([]);
    expect(kinds([entry({ temp_c: 40.2 })], null)).toEqual(['high']);
    expect(kinds([entry({ temp_c: 40.2 })], 1)).toEqual(['infant', 'high']);
  });

  it('flags breathing difficulty logged in the last 24 hours', () => {
    expect(kinds([entry({ kind: 'symptom', symptoms: ['cough', 'breathing'], at: hoursAgo(23) })], 10)).toEqual(['breathing']);
    expect(kinds([entry({ kind: 'symptom', symptoms: ['breathing'], at: hoursAgo(25) })], 10)).toEqual([]);
    expect(kinds([entry({ kind: 'symptom', symptoms: ['cough'], at: hoursAgo(1) })], 10)).toEqual([]);
  });

  it('flags fever lasting more than 3 days', () => {
    const fever = (h: number, temp = 38.4) => entry({ temp_c: temp, at: hoursAgo(h) });
    expect(kinds([fever(0), fever(40), fever(73)], 24)).toEqual(['long']);
    expect(kinds([fever(0), fever(72)], 24)).toEqual([]);
    expect(kinds([fever(0)], 24)).toEqual([]);
    // Normal readings do not count towards the fever span.
    expect(kinds([fever(0), fever(80, 36.9)], 24)).toEqual([]);
  });

  it('shows nothing once the episode has ended', () => {
    const entries = [entry({ temp_c: 40.5 }), entry({ kind: 'symptom', symptoms: ['breathing'] })];
    expect(illnessAlerts({ ...open, ended_at: hoursAgo(1) }, entries, 1, NOW)).toEqual([]);
  });
});

describe('temperature units', () => {
  afterEach(() => localStorage.removeItem(TEMP_UNIT_KEY));

  it('converts between °C and °F', () => {
    expect(cToF(37)).toBeCloseTo(98.6, 10);
    expect(cToF(38)).toBeCloseTo(100.4, 10);
    expect(cToF(40)).toBe(104);
    expect(fToC(212)).toBe(100);
    expect(fToC(100.4)).toBeCloseTo(38, 10);
    expect(toUnit(38.5, 'F')).toBe(101.3);
    expect(toUnit(38.5, 'C')).toBe(38.5);
    expect(fromUnit(101.3, 'F')).toBe(38.5);
    expect(fromUnit(38.46, 'C')).toBe(38.5);
  });

  it('round-trips every 0.1 °C step through the °F dial without drift', () => {
    for (let tenths = 350; tenths <= 425; tenths++) {
      const c = tenths / 10;
      expect(fromUnit(toUnit(c, 'F'), 'F')).toBe(c);
    }
  });

  it('evaluates thresholds in °C whatever the unit used for input', () => {
    expect(kinds([entry({ temp_c: fromUnit(100.4, 'F') })], 1)).toEqual(['infant']);
    expect(kinds([entry({ temp_c: fromUnit(100.2, 'F') })], 1)).toEqual([]);
    expect(kinds([entry({ temp_c: fromUnit(104, 'F') })], 24)).toEqual(['high']);
    expect(kinds([entry({ temp_c: fromUnit(103.7, 'F') })], 24)).toEqual([]);
    expect(tempBand(fToC(100.4))).toBe('fever');
    expect(tempBand(fToC(98.6))).toBe('normal');
  });

  it('formats readings in the chosen unit', () => {
    expect(formatTemp(38.5, 'C', 'en-US')).toBe('38.5 °C');
    expect(formatTemp(38.5, 'F', 'en-US')).toBe('101.3 °F');
    expect(formatTemp(38, 'C', 'de-DE')).toBe('38,0 °C');
    expect(formatTemp(38, 'F', 'en-US', false)).toBe('100.4');
  });

  it('defaults to °F only on US English devices', () => {
    expect(defaultTempUnit('en-US')).toBe('F');
    expect(defaultTempUnit('en_US')).toBe('F');
    expect(defaultTempUnit('en-GB')).toBe('C');
    expect(defaultTempUnit('az-AZ')).toBe('C');
    expect(defaultTempUnit(null)).toBe('C');
  });

  it('remembers the choice on this device', () => {
    saveTempUnit('F');
    expect(readTempUnit()).toBe('F');
    saveTempUnit('C');
    expect(readTempUnit()).toBe('C');
    localStorage.setItem(TEMP_UNIT_KEY, 'K');
    expect(readTempUnit()).toBe(defaultTempUnit(navigator.language));
  });

  it('rewrites °C copy for display', () => {
    expect(tempTemplate('Temperature {temp} °C. Call {number}.')).toBe('Temperature {temp}. Call {number}.');
    expect(tempTemplate('{temp} °Cです。')).toBe('{temp}です。');
    expect(localizeTempText('38,0 °C eller mer', 'C')).toBe('38,0 °C eller mer');
    expect(localizeTempText('38.0 °C or higher under 3 months', 'F', 'en-US')).toBe('100.4 °F or higher under 3 months');
    expect(localizeTempText('39 °C以上', 'F', 'ja-JP')).toBe('102.2 °F以上');
    expect(localizeTempText('38,0°', 'F', 'en-US')).toBe('100.4 °F');
  });
});
