import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback, getPersistedLanguage: () => 'az' }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));

import {
  bloodSugarBand, buildBloodSugarSection, buildClinicalSections, buildContractionSection, buildEpdsSection, buildGrowthSection,
  buildKickSection, buildVaccineSection, clock, epdsBand, groupContractionSessions,
} from './doctor-report-extras';
import { buildDoctorReportData } from './doctor-report';
import { getReportRange, type HealthReportSnapshot } from './health-report-data';
import { percentile } from './whoGrowth';

const now = new Date(2026, 10, 8, 12, 0); // 08.11.2026 12:00 local
const month = getReportRange('1month', now);
const week = getReportRange('1week', now);
const local = (d: number, h = 9, m = 0) => new Date(2026, 10, d, h, m).toISOString();

describe('blood sugar', () => {
  it('bands readings with the app targets (fasting 95, other 140, low 70)', () => {
    expect(bloodSugarBand(95, 'fasting')).toBe('target');
    expect(bloodSugarBand(96, 'fasting')).toBe('above');
    expect(bloodSugarBand(140, 'after_meal')).toBe('target');
    expect(bloodSugarBand(141, 'random')).toBe('above');
    expect(bloodSugarBand(65, 'fasting')).toBe('low');
  });

  it('turns readings in the period into summary cards and a newest-first table', () => {
    const section = buildBloodSugarSection([
      { id: '1', reading_value: 90, reading_type: 'fasting', logged_at: local(6, 7), created_at: local(6, 7) },
      { id: '2', reading_value: 150, reading_type: 'after_meal', logged_at: local(7, 14), created_at: local(7, 14) },
      { id: '3', reading_value: 100, reading_type: 'fasting', logged_at: local(8, 7), created_at: local(8, 7) },
      { id: 'old', reading_value: 300, reading_type: 'random', logged_at: '2026-01-01T09:00:00Z', created_at: '2026-01-01T09:00:00Z' },
    ], month)!;
    expect(section.id).toBe('blood_sugar');
    expect(section.rows).toEqual([
      { label: 'Ölçmələr', value: '3' },
      { label: 'Hədəfdə olan ölçmələr', value: '1 / 3' },
      { label: 'Aclıq qlükozası, orta', value: '95 mg/dL' },
      { label: 'Digər ölçmələr, orta', value: '150 mg/dL' },
    ]);
    expect(section.note).toContain('95 mg/dL');
    expect(section.note).toContain('140 mg/dL');
    expect(section.table!.rows).toEqual([
      ['08.11.2026 07:00', 'Aclıq', '100 (5.6)', 'Hədəfdən yuxarı'],
      ['07.11.2026 14:00', 'Yeməkdən sonra', '150 (8.3)', 'Hədəfdən yuxarı'],
      ['06.11.2026 07:00', 'Aclıq', '90 (5)', 'Hədəfdə'],
    ]);
  });

  it('is omitted when there is no reading in the period', () => {
    expect(buildBloodSugarSection([], month)).toBeNull();
  });
});

describe('kick counts', () => {
  it('groups sessions by the local calendar day, newest first', () => {
    const section = buildKickSection([
      // 00:30 local belongs to the 8th even though the server default session_date is the UTC day (7th in Baku).
      { id: 'a', kick_count: 10, duration_seconds: 600, session_date: '2026-11-07', created_at: local(8, 0, 30) },
      { id: 'b', kick_count: 12, duration_seconds: 900, session_date: '2026-11-08', created_at: local(8, 10) },
      { id: 'c', kick_count: 8, duration_seconds: 1500, session_date: '2026-11-06', created_at: local(6, 20) },
    ], month)!;
    expect(section.rows).toEqual([
      { label: 'Sayma seansları', value: '3' },
      { label: 'Qeydli günlər', value: '2' },
      { label: 'Seans üzrə orta təpik', value: '10' },
      { label: 'Seansın orta müddəti (dəq:san)', value: '16:40' },
    ]);
    expect(section.table!.rows).toEqual([
      ['08.11.2026', '2', '22', '25:00'],
      ['06.11.2026', '1', '8', '25:00'],
    ]);
  });

  it('limits the daily table to the recent days and says so', () => {
    const sessions = Array.from({ length: 10 }, (_, n) => ({ id: String(n), kick_count: 10, duration_seconds: 60, session_date: null, created_at: local(8 - n, 10) }));
    const section = buildKickSection(sessions, month, 7)!;
    expect(section.table!.rows).toHaveLength(7);
    expect(section.note).toContain('7');
  });
});

describe('contractions', () => {
  const rows = [
    { id: '1', start_time: local(7, 22, 0), duration_seconds: 40, interval_seconds: null },
    { id: '2', start_time: local(7, 22, 10), duration_seconds: 50, interval_seconds: 600 },
    { id: '3', start_time: local(7, 22, 18), duration_seconds: 60, interval_seconds: 480 },
    { id: '4', start_time: local(8, 6, 0), duration_seconds: 45, interval_seconds: 30000 },
    { id: '5', start_time: local(8, 6, 5), duration_seconds: 55, interval_seconds: 300 },
  ];
  it('splits sessions on a pause longer than an hour and averages duration and start-to-start interval', () => {
    const sessions = groupContractionSessions(rows, month);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ count: 3, avgDuration: 50, avgInterval: 540 });
    expect(sessions[1]).toMatchObject({ count: 2, avgDuration: 50, avgInterval: 300 });
  });

  it('lists recent sessions newest first', () => {
    const section = buildContractionSection(rows, month)!;
    expect(section.rows).toEqual([{ label: 'Qeyd edilmiş sancılar', value: '5' }, { label: 'Ölçmə seansları', value: '2' }]);
    expect(section.table!.rows).toEqual([
      ['08.11.2026 06:00', '2', '0:50', '5:00'],
      ['07.11.2026 22:00', '3', '0:50', '9:00'],
    ]);
  });

  it('formats clock values', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(null)).toBe('—');
  });
});

describe('EPDS', () => {
  it('uses the app score bands', () => {
    expect(epdsBand(9)).toBe('low');
    expect(epdsBand(10)).toBe('possible');
    expect(epdsBand(12)).toBe('possible');
    expect(epdsBand(13)).toBe('probable');
  });

  it('shows date, score and band, and flags question 10 above 0 for the clinician', () => {
    const section = buildEpdsSection([
      { id: 'a', total_score: 14, risk_level: 'high', completed_at: local(5, 10), answers: { 1: 2, 10: 1 } },
      { id: 'b', total_score: 6, risk_level: 'low', completed_at: local(1, 10), answers: { '1': 0, '10': 0 } },
    ], month)!;
    expect(section.table!.rows).toEqual([
      ['05.11.2026', '14 / 30', 'Ehtimal olunan depressiya (13+)', '1 (!)'],
      ['01.11.2026', '6 / 30', 'Hədd altında (0-9)', '0'],
    ]);
    expect(section.flag).toContain('10-cu sual');
    expect(section.flag).toContain('05.11.2026 (1/3)');
    expect(section.flag).not.toContain('01.11.2026');
  });

  it('has no flag when question 10 is 0, and keeps the latest screening when none falls in the period', () => {
    const section = buildEpdsSection([{ id: 'a', total_score: 11, completed_at: '2026-08-01T10:00:00Z', answers: { 10: 0 } }], week)!;
    expect(section.flag).toBeUndefined();
    expect(section.table!.rows).toHaveLength(1);
    expect(section.table!.rows[0][2]).toBe('Mümkün depressiya (10-12)');
  });
});

describe('vaccines', () => {
  const child = { birth_date: '2026-05-01', gender: 'girl' };
  const schedule = [
    { id: 'bcg', dose_number: 1, recommended_age_days: 0, min_age_days: 0, max_age_days: 30, dose_label: '1', age_label: 'Doğuşda', vaccine: { name: 'BCG', is_active: true } },
    { id: 'hep2', dose_number: 2, recommended_age_days: 60, min_age_days: 60, max_age_days: 90, dose_label: '2', age_label: '2 ay', vaccine: { name: 'HepB', is_active: true } },
    { id: 'dtp3', dose_number: 3, recommended_age_days: 180, min_age_days: 180, max_age_days: 240, dose_label: '3', age_label: '6 ay', vaccine: { name: 'DTP', is_active: true } },
    { id: 'mmr', dose_number: 1, recommended_age_days: 365, min_age_days: 365, max_age_days: 450, dose_label: '1', age_label: '12 ay', vaccine: { name: 'MMR', is_active: true } },
    { id: 'retired', dose_number: 1, recommended_age_days: 30, min_age_days: 30, max_age_days: 40, vaccine: { name: 'Old', is_active: false } },
  ];
  it('counts done, due and overdue and lists them with dates', () => {
    const section = buildVaccineSection(schedule, [{ vaccine_schedule_id: 'bcg', administered_at: '2026-10-20', is_skipped: false }], child, month, now)!;
    expect(section.rows).toEqual([
      { label: 'Vurulub', value: '1' }, { label: 'Vaxtı çatıb', value: '1' }, { label: 'Gecikib', value: '1' },
    ]);
    expect(section.table!.rows).toEqual([
      ['HepB', '2', 'Gecikib', '2 ay · 30.06.2026'],
      ['DTP', '3', 'Vaxtı çatıb', '6 ay · 28.10.2026'],
      ['BCG', '1', 'Vurulub', '20.10.2026'],
    ]);
  });

  it('keeps done doses outside the period in the count only', () => {
    const section = buildVaccineSection(schedule, [{ vaccine_schedule_id: 'bcg', administered_at: '2026-05-02', is_skipped: false }], child, week, now)!;
    expect(section.rows![0].value).toBe('1');
    expect(section.table!.rows.some(row => row[0] === 'BCG')).toBe(false);
  });
});

describe('growth', () => {
  const entries = [
    { id: '1', entry_date: '2026-09-01', weight_kg: 5.8, height_cm: 60, head_cm: 40 },
    { id: '2', entry_date: '2026-11-01', weight_kg: 7, height_cm: 64.5, head_cm: null },
  ];
  it('adds WHO weight and height percentiles from whoGrowth for the latest measurement', () => {
    const child = { birth_date: '2026-05-01', gender: 'boy' };
    const section = buildGrowthSection(entries, child, month)!;
    const months = (Date.parse('2026-11-01') - Date.parse('2026-05-01')) / (30.4375 * 86400000);
    const wp = percentile('weight', 'boy', months, 7), hp = percentile('height', 'boy', months, 64.5);
    expect(section.rows).toEqual([
      { label: 'Çəki persentili (ÜST)', value: `P${wp} · 7 kq` },
      { label: 'Boy persentili (ÜST)', value: `P${hp} · 64.5 cm` },
    ]);
    expect(section.table!.rows).toEqual([['01.11.2026', '6', `7 · P${wp}`, `64.5 · P${hp}`, '—']]);
  });

  it('falls back to the latest measurement and uses corrected age for a preterm baby', () => {
    const preterm = { birth_date: '2026-05-01', due_date: '2026-06-26', gender: 'girl' };
    const section = buildGrowthSection(entries.slice(0, 1), preterm, week)!;
    const corrected = (Date.parse('2026-09-01') - Date.parse('2026-06-26')) / (30.4375 * 86400000);
    expect(section.table!.rows[0][1]).toBe((Math.round(corrected * 10) / 10).toString());
    expect(section.table!.rows[0][2]).toBe(`5.8 · P${percentile('weight', 'girl', corrected, 5.8)}`);
    expect(section.note).toContain('korreksiya');
  });

  it('omits percentiles when the sex is not recorded', () => {
    const section = buildGrowthSection(entries, { birth_date: '2026-05-01', gender: 'unknown' }, month)!;
    expect(section.rows).toEqual([]);
    expect(section.table!.rows[0][2]).toBe('7');
    expect(section.note).toContain('Cinsiyyət');
  });
});

describe('stage selection', () => {
  const extras = {
    bloodSugar: [{ id: '1', reading_value: 90, reading_type: 'fasting', logged_at: local(8, 7), created_at: local(8, 7) }],
    kicks: [{ id: 'k', kick_count: 10, duration_seconds: 600, session_date: '2026-11-08', created_at: local(8, 10) }],
    contractions: [],
    epds: [{ id: 'e', total_score: 5, completed_at: local(8, 10), answers: { 10: 0 } }],
    growth: [{ id: 'g', entry_date: '2026-11-01', weight_kg: 7, height_cm: 64, head_cm: null }],
  };
  it('pregnancy shows sugar, kicks and EPDS but no child sections; empty contractions are omitted', () => {
    expect(buildClinicalSections(extras, { stage: 'bump', range: month }).map(item => item.id)).toEqual(['blood_sugar', 'kicks', 'epds']);
  });
  it('postpartum shows EPDS and child sections, and EPDS can be left out', () => {
    const child = { birth_date: '2026-05-01', gender: 'boy' };
    expect(buildClinicalSections(extras, { stage: 'mommy', range: month, child }).map(item => item.id)).toEqual(['epds', 'growth']);
    expect(buildClinicalSections(extras, { stage: 'mommy', range: month, child, includeEpds: false }).map(item => item.id)).toEqual(['growth']);
  });
  it('cycle tracking shows none of them', () => {
    expect(buildClinicalSections(extras, { stage: 'flow', range: month })).toEqual([]);
  });
  it('reaches the report data through buildDoctorReportData', () => {
    const snapshot: HealthReportSnapshot = { range: month, weights: [], daily: [], exercises: [], bloodPressure: [], fetal: [], periodDays: [], baby: [] };
    const data = buildDoctorReportData(snapshot, { userName: 'A', stageTitle: 'B', stage: 'bump', periodLabel: '1 ay', stageRows: [], notes: '', extras });
    expect(data.sections!.map(item => item.id)).toEqual(['blood_sugar', 'kicks', 'epds']);
  });
});
