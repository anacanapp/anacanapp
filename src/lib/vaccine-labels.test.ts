import { describe, expect, it, vi } from 'vitest';
import { APP_LANGUAGES } from './app-languages';
import {
  VACCINE_LABEL_PACKS, vaccineAgeGroups, vaccineAgeLabel, vaccineDisplayName, vaccineDoseLabel, vaccineRouteLabel,
} from './vaccine-labels';

vi.mock('./tr', () => ({ tr: (_k: string, f: string) => f, formatTr: (_k: string, f: string) => f }));

const row = (over: Record<string, unknown> = {}, vaccine: Record<string, unknown> = {}) => ({
  id: 'r1', dose_number: 1, recommended_age_days: 60, min_age_days: null, max_age_days: null,
  age_label: '2 aylıq', age_label_az: '2 aylıq', dose_label: '1-ci doza', dose_label_az: '1-ci doza',
  ...over,
  vaccine: { code: 'MMR', name: 'Qızılca, parotit, məxmərək', name_az: 'Qızılca, parotit, məxmərək', route: 'Dərialtı', route_az: 'Dərialtı', ...vaccine },
});

describe('vaccine label packs', () => {
  it('cover all 23 app languages with every term filled', () => {
    expect(Object.keys(VACCINE_LABEL_PACKS).sort()).toEqual(APP_LANGUAGES.map((l) => l.code).sort());
    for (const pack of Object.values(VACCINE_LABEL_PACKS)) {
      for (const value of [...Object.values(pack.terms), ...Object.values(pack.phrases)]) expect(value.trim()).not.toBe('');
      expect(pack.phrases.dose).toContain('{n}');
    }
  });
});

describe('vaccineDisplayName', () => {
  it('keeps the abbreviation and translates the description, never showing Azerbaijani in other languages', () => {
    expect(vaccineDisplayName(row(), 'en')).toBe('Measles, mumps, and rubella (MMR)');
    expect(vaccineDisplayName(row(), 'ja')).toBe('麻しん、おたふくかぜ、風しん (MMR)');
    expect(vaccineDisplayName(row(), 'ru')).toBe('Корь, паротит и краснуха (MMR)');
    expect(vaccineDisplayName(row({}, { code: 'BCG', name: 'Vərəm (BCG)' }), 'et')).toBe('Tuberkuloos (BCG)');
    expect(vaccineDisplayName(row({}, { code: 'HepB' }), 'ky')).toBe('B гепатити (HepB)');
    expect(vaccineDisplayName(row({}, { code: 'HIB' }), 'zh')).toBe('b型流感嗜血杆菌 (Hib)');
    for (const { code } of APP_LANGUAGES.filter((l) => l.code !== 'az')) {
      expect(vaccineDisplayName(row({}, { code: 'DTaP' }), code)).toMatch(/\(DTaP\)$/);
      expect(vaccineDisplayName(row({}, { code: 'DTaP', name: 'Göy öskürək, difteriya, tetanoz' }), code)).not.toMatch(/göy öskürək/i);
    }
  });

  it('keeps the database text for Azerbaijani, unknown codes and reviewed programme names', () => {
    expect(vaccineDisplayName(row(), 'az')).toBe('Qızılca, parotit, məxmərək');
    expect(vaccineDisplayName(row({}, { code: 'XYZ', name: 'Local name' }), 'en')).toBe('Local name');
    const meta = { protocol: 'anacan-vaccine-schedule-v1', version: '1', kind: 'routine', age: { months: 2, days: 0 }, end_age: null,
      expected_age_days: 60, expected_dose_number: 1, source_url: 'x', source_label: 'x', display_name: { fr: 'ROR (rougeole, oreillons, rubéole)' } };
    expect(vaccineDisplayName(row({ schedule_meta: meta }, { name: 'ROR (rougeole, oreillons, rubéole)' }), 'fr')).toBe('ROR (rougeole, oreillons, rubéole)');
  });
});

describe('vaccineAgeLabel / vaccineDoseLabel / vaccineRouteLabel', () => {
  it('formats ages from the source label, keeping ranges and birth', () => {
    expect(vaccineAgeLabel(row(), 'en')).toBe('2 months');
    expect(vaccineAgeLabel(row({ age_label_az: '4-6 yaş' }), 'en')).toBe('4–6 years');
    expect(vaccineAgeLabel(row({ age_label_az: 'Doğulanda' }), 'de')).toBe('Bei Geburt');
    expect(vaccineAgeLabel(row({ age_label_az: 'Doğulanda (0-4 həftə)' }), 'en')).toBe('At birth (0–4 weeks)');
    expect(vaccineAgeLabel(row({ age_label_az: '3 yaş 4 ay' }), 'en')).toBe('3 years 4 months');
    expect(vaccineAgeLabel(row({ age_label_az: '4.5 aylıq' }), 'en')).toBe('4.5 months');
    expect(vaccineAgeLabel(row(), 'az')).toBe('2 aylıq');
    expect(vaccineAgeLabel(row({ age_label: 'Odd text', age_label_az: 'Qeyri-adi' }), 'en')).toBe('Odd text');
  });

  it('formats doses and routes', () => {
    expect(vaccineDoseLabel(row({ dose_label_az: '3-cü doza' }), 'en')).toBe('Dose 3');
    expect(vaccineDoseLabel(row({ dose_label_az: '2-ci doza' }), 'ja')).toBe('2回目');
    expect(vaccineDoseLabel(row({ dose_label_az: 'Bustər' }), 'es')).toBe('Refuerzo');
    expect(vaccineDoseLabel(row({ dose_label_az: 'İkinci bustər' }), 'en')).toBe('Second booster');
    expect(vaccineDoseLabel(row({ dose_label_az: '1-ci doza (doğulanda)' }), 'en')).toBe('Dose 1 (at birth)');
    expect(vaccineDoseLabel(row(), 'az')).toBe('1-ci doza');
    expect(vaccineRouteLabel(row(), 'fr')).toBe('Sous-cutanée');
    expect(vaccineRouteLabel(row({}, { route_az: 'Ağızdan (oral)' }), 'en')).toBe('Oral');
  });
});

describe('vaccineAgeGroups', () => {
  it('groups by recommended age days, not by translated text, in age order', () => {
    const items = [
      { row: row({ id: 'b', recommended_age_days: 120, age_label_az: '4 aylıq' }) },
      { row: row({ id: 'a1', recommended_age_days: 60, age_label_az: '2 aylıq' }) },
      { row: row({ id: 'a2', recommended_age_days: 60, age_label_az: '8 həftə' }) },
      { row: row({ id: 'a3', recommended_age_days: 60, age_label_az: '2 aylıq' }) },
    ];
    const groups = vaccineAgeGroups(items, 'en');
    expect(groups.map((g) => [g.days, g.label, g.items.map((i) => i.row.id)])).toEqual([
      [60, '2 months / 8 weeks', ['a1', 'a2', 'a3']],
      [120, '4 months', ['b']],
    ]);
    // Same grouping in every language.
    for (const { code } of APP_LANGUAGES) expect(vaccineAgeGroups(items, code).map((g) => g.items.length)).toEqual([3, 1]);
  });
});
