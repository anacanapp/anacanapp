import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { calendarOffsetDate, regionalCountry, vaccineEligible, vaccineStatus, type VaccineTiming } from './vaccine-schedule';

const row = (changes: Partial<VaccineTiming> = {}) => ({ id: 'dose-2', dose_number: 2, recommended_age_days: 60, min_age_days: 60, max_age_days: null,
  schedule_meta: { protocol: 'anacan-vaccine-schedule-v1', version: 'fixture', kind: 'routine', age: { months: 2, days: 0 }, end_age: null,
    expected_age_days: 60, expected_dose_number: 2, source_url: 'https://example.org/schedule', source_label: 'Fixture', ...changes } as VaccineTiming });
const empty = () => new Map();
describe('regional vaccination schedules', () => {
  it('honours child, account and stored country before the language suggestion', () => {
    expect(regionalCountry('ja', 'FR', 'AZ')).toBe('FR');
    expect(regionalCountry('vi', null, 'SE')).toBe('SE');
    expect(regionalCountry('ko', null, null, 'NL')).toBe('NL');
    for (const [lang, country] of Object.entries({ zh: 'CN', id: 'ID', fr: 'FR', es: 'ES', pt: 'PT', vi: 'VN', hi: 'IN', ja: 'JP', ko: 'KR', pl: 'PL', nl: 'NL', sv: 'SE' })) {
      expect(regionalCountry(lang)).toBe(country);
    }
  });
  it('uses calendar months, leap years and civil days rather than 30-day months', () => {
    expect(format(calendarOffsetDate('2024-01-31', { months: 1, days: 0 }), 'yyyy-MM-dd')).toBe('2024-02-29');
    expect(format(calendarOffsetDate('2025-01-31', { months: 1, days: 0 }), 'yyyy-MM-dd')).toBe('2025-02-28');
    expect(format(calendarOffsetDate('2024-02-29', { months: 12, days: 0 }), 'yyyy-MM-dd')).toBe('2025-02-28');
    expect(vaccineStatus(row(), '2026-01-31', empty(), new Date(2026, 2, 30, 23))).toBe('future');
    expect(vaccineStatus(row(), '2026-01-31', empty(), new Date(2026, 2, 31))).toBe('pending');
  });
  it('does not invent a 60-day overdue deadline for a reviewed age without a stated range', () => {
    expect(vaccineStatus(row(), '2025-01-01', empty(), new Date(2026, 8, 24))).toBe('pending');
    expect(vaccineStatus(row({ end_age: { months: 4, days: -1 } }), '2026-01-01', empty(), new Date(2026, 4, 1))).toBe('overdue');
  });
  it('anchors subsequent doses to the actual prior vaccination, not to birth or the nominal age', () => {
    const schedule = row({ relative: { schedule_id: 'dose-1', min: { months: 6, days: 0 }, max: { months: 12, days: 0 } } });
    expect(vaccineStatus(schedule, '2024-01-01', empty(), new Date(2026, 8, 24))).toBe('interval');
    const logs = new Map([['dose-1', { administered_at: '2026-04-30', is_skipped: false }]]);
    expect(vaccineStatus(schedule, '2024-01-01', logs, new Date(2026, 8, 24))).toBe('future');
    expect(vaccineStatus(schedule, '2024-01-01', logs, new Date(2026, 9, 30))).toBe('pending');
  });
  it('does not turn conditional/product/seasonal programmes into automatic overdue doses', () => {
    expect(vaccineStatus(row({ kind: 'conditional' }), '2020-01-01', empty(), new Date(2026, 8, 24))).toBe('conditional');
    expect(vaccineStatus(row({ kind: 'seasonal' }), '2020-01-01', empty(), new Date(2026, 8, 24))).toBe('seasonal');
  });
  it('applies cohort and gender rules while retaining a recorded historical vaccination', () => {
    const child = row({ gender: 'girl', born_from: '2021-01-01' });
    expect(vaccineEligible(child, '2022-01-01', 'boy')).toBe(false);
    expect(vaccineEligible(child, '2020-12-31', 'girl')).toBe(false);
    expect(vaccineEligible(child, '2022-01-01', 'girl')).toBe(true);
    expect(vaccineEligible(child, '2020-12-31', 'girl', { administered_at: '2025-01-01', is_skipped: false })).toBe(true);
    expect(vaccineStatus(child, '2020-12-31', new Map([['dose-2', { administered_at: '2025-01-01', is_skipped: false }]]))).toBe('done');
  });
});
