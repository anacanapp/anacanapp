import { format, parseISO } from 'date-fns';
import { tr } from '@/lib/tr';
import { getLocaleTag } from '@/lib/i18n';
import { classifyBp } from '@/lib/bloodPressure';
import { finiteMeasurement, meanRecorded, reportCoverage, summarizeBabyCare, type HealthReportSnapshot } from './health-report-data';
import type { DoctorReportData, ReportRow } from './pdfReport';

export const reportDate = (date: Date | string, time = false) => format(typeof date === 'string' ? parseISO(date) : date, time ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy');
const number = (value: number | null, digits = 1) => value === null ? '—' : value.toLocaleString(getLocaleTag(), { minimumFractionDigits: 0, maximumFractionDigits: digits });
const recorded = (count: number) => tr('report_recorded_days', '{n} qeydli gün').replace('{n}', String(count));
const minutes = (value: number | null) => value === null ? '—' : `${Math.floor(Math.round(value) / 60)} ${tr('report_hours', 'saat')} ${Math.round(value) % 60} ${tr('report_minutes', 'dəq')}`;

export function buildDoctorReportData(snapshot: HealthReportSnapshot, context: {
  userName: string; stageTitle: string; stage: string; periodLabel: string; stageRows: ReportRow[]; notes: string;
}): DoctorReportData {
  const coverage = reportCoverage(snapshot);
  const { weights, daily, exercises, bloodPressure, fetal, periodDays, baby, range } = snapshot;
  const water = meanRecorded(daily.map(log => log.water_intake));
  const mood = meanRecorded(daily.map(log => log.mood !== null && log.mood >= 1 && log.mood <= 5 ? log.mood : null));
  const sleep = meanRecorded(daily.map(log => log.sleep_hours));
  const validWeights = weights.map(row => ({ ...row, value: finiteMeasurement(row.weight) })).filter(row => row.value !== null);
  const latestWeight = validWeights[validWeights.length - 1]?.value ?? null;
  const delta = validWeights.length > 1 ? latestWeight! - validWeights[0].value! : null;
  const trends: DoctorReportData['trends'] = [
    { label: tr('report_latest_weight', 'Son çəki'), value: latestWeight === null ? '—' : `${number(latestWeight)} ${tr('report_kg', 'kq')}`,
      trend: delta === null ? tr('report_measurements', '{n} ölçmə').replace('{n}', String(validWeights.length)) : `${delta > 0 ? '+' : ''}${number(delta)} ${tr('report_kg', 'kq')}` },
    { label: tr('report_water_average', 'Su, qeydli günlərdə orta'), value: water.value === null ? '—' : `${number(water.value)} ${tr('report_glasses_day', 'stəkan/gün')}`, trend: recorded(water.count) },
    { label: tr('report_mood_average', 'Əhval, özünüqiymətləndirmə'), value: mood.value === null ? '—' : `${number(mood.value)} / 5`, trend: recorded(mood.count) },
    { label: tr('report_maternal_sleep', 'Ana yuxusu, orta'), value: sleep.value === null ? '—' : `${number(sleep.value)} ${tr('report_hours_day', 'saat/gün')}`, trend: recorded(sleep.count) },
    { label: tr('report_exercise', 'Məşq qeydləri'), value: String(exercises.length), trend: exercises.length ? minutes(exercises.reduce((total, log) => total + (finiteMeasurement(log.duration_minutes) || 0), 0)) : '—' },
  ];
  const summary = summarizeBabyCare(baby, range);
  const babyCareRows: ReportRow[] = baby.length ? [
    { label: tr('report_baby_sleep', 'Körpənin yuxusu, qeydli günlərdə orta'), value: `${minutes(summary.sleepAverage)} · ${recorded(summary.sleepDays)}` },
    { label: tr('report_baby_feeding', 'Qidalanma qeydləri, orta/gün'), value: `${number(summary.feedingAverage)} · ${recorded(summary.feedingDays)}` },
    { label: tr('pdf_bc_breast', 'Ana südü (cəmi)'), value: String(summary.breast) },
    { label: tr('pdf_bc_formula', 'Süd əvəzedicisi (cəmi)'), value: String(summary.formula) },
    { label: tr('report_formula_ml', 'Qeyd edilmiş formula miqdarı'), value: summary.formulaAmounts ? `${number(summary.formulaMl, 0)} ml` : '—' },
    { label: tr('pdf_bc_solid', 'Əlavə qida (cəmi)'), value: String(summary.solid) },
    { label: tr('report_baby_diapers', 'Bez qeydləri, orta/gün'), value: `${number(summary.diaperAverage)} · ${recorded(summary.diaperDays)}` },
    { label: tr('report_diaper_types', 'Nəm / çirkli / qarışıq bez'), value: `${summary.wet} / ${summary.dirty} / ${summary.mixed}` },
    ...(summary.unknownDiapers ? [{ label: tr('report_unknown_diapers', 'Növü göstərilməyən bez qeydləri'), value: String(summary.unknownDiapers) }] : []),
  ] : [];
  const flowLabels: Record<string, string> = {
    none: tr('report_flow_none', 'Axın yoxdur'), spotting: tr('report_flow_spotting', 'Ləkələnmə'),
    light: tr('report_flow_light', 'Az'), medium: tr('report_flow_medium', 'Orta'), heavy: tr('report_flow_heavy', 'Güclü'),
    unspecified: tr('report_flow_unspecified', 'Axın var, intensivlik qeyd edilməyib'),
  };
  return {
    userName: context.userName, stageTitle: context.stageTitle, periodLabel: context.periodLabel,
    generatedAt: new Date(), dateRangeLabel: range.start ? `${reportDate(range.start)} — ${reportDate(range.end)}` : tr('report_all_dates', 'Mövcud bütün qeydlər · {date} tarixinədək').replace('{date}', reportDate(range.end)),
    coverage: { records: coverage.total, recordedDays: coverage.recordedDays }, stageRows: context.stageRows, trends, notes: context.notes,
    weightSeries: validWeights.map(row => ({ date: reportDate(row.entry_date), weight: row.value! })),
    bpRows: bloodPressure.map(log => ({
      date: reportDate(log.measured_at, true), reading: `${log.systolic}/${log.diastolic}`,
      pulse: log.pulse == null ? '—' : String(log.pulse), category: classifyBp(log.systolic, log.diastolic, context.stage === 'bump').label,
    })),
    babyCareRows,
    historyTables: [
      { title: tr('report_fetal_history', 'USM / fetal böyümə qeydləri'),
        headers: [tr('pdf_date', 'Tarix'), tr('report_baby_label', 'Körpə'), tr('report_efw_grams', 'Təxmini çəki (q)')],
        rows: fetal.map(log => [reportDate(log.scan_date), log.baby_label, number(finiteMeasurement(log.efw_grams), 0)]), widths: [1.2, 0.6, 1.2] },
      { title: tr('report_period_history', 'Gündəlik axın qeydləri'), headers: [tr('pdf_date', 'Tarix'), tr('report_flow', 'Axın')],
        rows: periodDays.map(log => [reportDate(log.log_date), flowLabels[log.flow_intensity || 'unspecified'] || log.flow_intensity || '—']), widths: [1, 2] },
    ],
  };
}
