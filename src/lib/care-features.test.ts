import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { earlyDose, episodeDay, illnessAlerts, medStatuses, reminderId, tempBand, type IllnessEntry } from './illness';
import { checkupDate, flagSeverity, kegelLevel, weekAfterBirth } from './recovery';
import { bbtShift, chanceFor, doctorThreshold, monthsTrying } from './ttc';

const entry = (over: Partial<IllnessEntry>): IllnessEntry => ({
  id: Math.random().toString(36), kind: 'temp', at: new Date().toISOString(), temp_c: null, temp_method: null, med_name: null,
  dose: null, interval_hours: null, remind: false, symptoms: null, note: null, by: 'mother', by_me: true, ...over
});
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe('illness journal', () => {
  it('bands temperatures', () => {
    expect(tempBand(35.5)).toBe('low');
    expect(tempBand(36.8)).toBe('normal');
    expect(tempBand(37.7)).toBe('subfebrile');
    expect(tempBand(38.4)).toBe('fever');
    expect(tempBand(39.6)).toBe('high');
  });

  it('keeps the latest dose per medicine and computes the next allowed time from the entered interval', () => {
    const entries = [
      entry({ kind: 'med', med_name: 'Parasetamol', dose: '5 ml', interval_hours: 6, at: hoursAgo(2), remind: true }),
      entry({ kind: 'med', med_name: 'parasetamol', dose: '5 ml', interval_hours: 6, at: hoursAgo(8) }),
      entry({ kind: 'med', med_name: 'İbuprofen', dose: '2,5 ml', interval_hours: 8, at: hoursAgo(1) })
    ];
    const meds = medStatuses(entries);
    expect(meds.map((m) => m.name)).toEqual(['İbuprofen', 'Parasetamol']);
    const para = meds[1];
    expect(Math.round((para.nextAt.getTime() - para.lastAt.getTime()) / 3600_000)).toBe(6);
    expect(para.remind).toBe(true);
    expect(earlyDose(entries, 'PARASETAMOL', new Date())?.minutesAgo).toBe(120);
    expect(earlyDose(entries, 'Parasetamol', new Date(Date.now() + 5 * 3600_000))).toBeNull();
    expect(earlyDose(entries, 'Burun damcısı', new Date())).toBeNull();
  });

  it('raises the safety alerts', () => {
    const episode = { started_at: hoursAgo(80), ended_at: null };
    const entries = [
      entry({ temp_c: 40.1, at: hoursAgo(0) }),
      entry({ kind: 'symptom', symptoms: ['breathing'], at: hoursAgo(1) }),
      entry({ temp_c: 38.5, at: hoursAgo(79) })
    ];
    const kinds = illnessAlerts(episode, entries, 2).map((a) => a.kind);
    expect(kinds).toEqual(['infant', 'breathing', 'high', 'long']);
    expect(illnessAlerts(episode, [entry({ temp_c: 38.2 })], 7)).toEqual([]);
    expect(illnessAlerts({ ...episode, ended_at: hoursAgo(1) }, entries, 2)).toEqual([]);
    expect(illnessAlerts(episode, [entry({ temp_c: 38.2 })], null)).toEqual([]);
  });

  it('counts episode days and makes stable reminder ids', () => {
    const now = new Date(2026, 10, 3, 9);
    expect(episodeDay(new Date(2026, 10, 1, 23).toISOString(), now)).toBe(3);
    expect(reminderId('a', 'Parasetamol')).toBe(reminderId('a', ' parasetamol '));
    expect(reminderId('a', 'x')).not.toBe(reminderId('b', 'x'));
    expect(reminderId('a', 'x')).toBeGreaterThan(0);
    expect(reminderId('a', 'x')).toBeLessThan(2 ** 31);
  });
});

describe('postpartum recovery', () => {
  it('computes weeks after birth and the check-up', () => {
    const now = new Date(2026, 10, 15);
    expect(weekAfterBirth('2026-11-15', now)).toBe(1);
    expect(weekAfterBirth('2026-11-08', now)).toBe(2);
    expect(weekAfterBirth('2026-11-20', now)).toBeNull();
    expect(weekAfterBirth(null, now)).toBeNull();
    expect(checkupDate('2026-11-01').getDate()).toBe(13);
  });

  it('starts pelvic floor training gently', () => {
    expect(kegelLevel(1)).toMatchObject({ level: 0, hold: 3 });
    expect(kegelLevel(4)).toMatchObject({ level: 1, hold: 5 });
    expect(kegelLevel(9)).toMatchObject({ level: 2, hold: 8 });
  });

  it('treats dangerous signs as urgent', () => {
    expect(flagSeverity(['heavy_bleeding'], null)).toBe('urgent');
    expect(flagSeverity(['harm'], null)).toBe('urgent');
    expect(flagSeverity(['fever'], null)).toBe('doctor');
    expect(flagSeverity([], 3)).toBe('doctor');
    expect(flagSeverity([], 1)).toBeNull();
  });
});

describe('trying to conceive', () => {
  it('rates the chance around ovulation', () => {
    const ov = new Date(2026, 10, 14);
    const day = (d: number) => new Date(2026, 10, 14 + d);
    expect(chanceFor(day(0), ov)).toBe('peak');
    expect(chanceFor(day(-1), ov)).toBe('peak');
    expect(chanceFor(day(-3), ov)).toBe('high');
    expect(chanceFor(day(-5), ov)).toBe('medium');
    expect(chanceFor(day(1), ov)).toBe('medium');
    expect(chanceFor(day(4), ov)).toBe('low');
  });

  it('counts months and the doctor threshold', () => {
    const now = new Date(2026, 10, 15);
    expect(monthsTrying('2026-07-01', now)).toBe(4);
    expect(monthsTrying('2026-11-01', now)).toBe(0);
    expect(monthsTrying(undefined, now)).toBeNull();
    expect(doctorThreshold(36)).toBe(6);
    expect(doctorThreshold(null)).toBe(12);
  });

  it('detects a basal temperature shift (three over six)', () => {
    expect(bbtShift([36.4, 36.5, 36.4, 36.45, 36.5, 36.4, 36.75, 36.8, 36.8])).toBe(6);
    expect(bbtShift([36.4, 36.5, 36.4, 36.45, 36.5, 36.4, 36.55, 36.5])).toBeNull();
    expect(bbtShift([36.4, null, 36.5, 36.4, 36.45, 36.5, 36.4, 36.75, 36.8, 36.8])).toBe(7);
  });
});

describe('feature copy', () => {
  const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shape(v)])) : typeof value;
  const placeholders = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(...(value.match(/\{\w+\}/g) ?? []).sort());
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((v) => placeholders(v, out));
    return out;
  };
  it.each(['illness', 'recovery', 'ttc', 'sleep-next', 'widgets'])('%s has 21 languages with the same shape and placeholders', (feature) => {
    const dir = join(__dirname, '..', 'data', feature);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(21);
    const az = JSON.parse(readFileSync(join(dir, 'az.json'), 'utf8'));
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      expect(shape(data), file).toEqual(shape(az));
      expect(placeholders(data), file).toEqual(placeholders(az));
    }
  });
});
