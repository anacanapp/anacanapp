/**
 * Clinical sections of the doctor PDF report that come from dedicated trackers:
 * blood sugar, kick counts, contractions (pregnancy), EPDS (pregnancy / postpartum),
 * vaccines and WHO growth percentiles (child). Every builder is pure: rows in, a
 * ReportSection out, or null when there is nothing to show for the period.
 */
import { addDays, format, parseISO } from 'date-fns';
import { tr } from '@/lib/tr';
import { getLocaleTag } from '@/lib/i18n';
import { localDateKey } from '@/lib/local-date';
import { ageInMonths, percentile, type Sex } from '@/lib/whoGrowth';
import { getPrematurityInfo } from '@/lib/pregnancy-utils';
import { calendarOffsetDate, vaccineEligible, vaccineStatus, vaccineTiming } from '@/lib/vaccine-schedule';
import type { ReportRange } from './health-report-data';
import type { ReportRow, ReportSection } from './pdfReport';

export const reportDate = (date: Date | string, time = false) => format(typeof date === 'string' ? parseISO(date) : date, time ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy');
const num = (value: number | null, digits = 1) => value === null || !Number.isFinite(value) ? '—' : value.toLocaleString(getLocaleTag(), { minimumFractionDigits: 0, maximumFractionDigits: digits });
const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const avg = (values: number[]) => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
/** m:ss, used for contraction durations/intervals and kick session lengths. */
export const clock = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const time = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};
const inRange = (t: number | null, range: ReportRange) => t !== null && t <= range.end.getTime() && (!range.start || t >= range.start.getTime());
const dayInRange = (day: string, range: ReportRange) => day <= range.endDay && (!range.startDay || day >= range.startDay);

// ── Blood sugar ────────────────────────────────────────────────────────────
export interface ReportBloodSugar { id: string; reading_value: number | string; reading_type: string; meal_context?: string | null; logged_at: string | null; created_at: string | null; }
/**
 * Pregnancy glucose targets the app uses in BloodSugarTracker (mg/dL): below 70 is low,
 * fasting up to 95 and other readings up to 140 are within target.
 */
export const BLOOD_SUGAR_TARGETS = { low: 70, fasting: 95, other: 140 } as const;
export type SugarBand = 'low' | 'target' | 'above';
export function bloodSugarBand(value: number, type: string): SugarBand {
  if (value < BLOOD_SUGAR_TARGETS.low) return 'low';
  return value <= (type === 'fasting' ? BLOOD_SUGAR_TARGETS.fasting : BLOOD_SUGAR_TARGETS.other) ? 'target' : 'above';
}

export function buildBloodSugarSection(logs: ReportBloodSugar[], range: ReportRange): ReportSection | null {
  const readings = logs
    .map(log => ({ log, at: time(log.logged_at ?? log.created_at), value: finite(log.reading_value) }))
    .filter((item): item is { log: ReportBloodSugar; at: number; value: number } => item.value !== null && item.value > 0 && inRange(item.at, range))
    .sort((a, b) => b.at - a.at);
  if (!readings.length) return null;
  const types: Record<string, string> = {
    fasting: tr('bloodsugartracker_acliq_b6d5ee', 'Aclıq'), before_meal: tr('bloodsugartracker_yemekden_evvel_167a3d', 'Yeməkdən əvvəl'),
    after_meal: tr('bloodsugartracker_yemekden_sonra_56238e', 'Yeməkdən sonra'), bedtime: tr('bloodsugartracker_yatmazdan_evvel_a457fa', 'Yatmazdan əvvəl'),
    random: tr('bloodsugartracker_tesadufi_98c20c', 'Təsadüfi'),
  };
  const bands: Record<SugarBand, string> = {
    low: tr('report_sugar_low', 'Aşağı (<70)'), target: tr('report_sugar_in_target', 'Hədəfdə'), above: tr('report_sugar_above', 'Hədəfdən yuxarı'),
  };
  const banded = readings.map(item => ({ ...item, band: bloodSugarBand(item.value, item.log.reading_type) }));
  const fasting = banded.filter(item => item.log.reading_type === 'fasting');
  const other = banded.filter(item => item.log.reading_type !== 'fasting');
  const inTarget = banded.filter(item => item.band === 'target').length;
  const rows: ReportRow[] = [
    { label: tr('report_sugar_readings', 'Ölçmələr'), value: String(banded.length) },
    { label: tr('report_sugar_in_target_count', 'Hədəfdə olan ölçmələr'), value: `${inTarget} / ${banded.length}` },
    ...(fasting.length ? [{ label: tr('report_sugar_fasting_avg', 'Aclıq qlükozası, orta'), value: `${num(avg(fasting.map(item => item.value)), 0)} mg/dL` }] : []),
    ...(other.length ? [{ label: tr('report_sugar_other_avg', 'Digər ölçmələr, orta'), value: `${num(avg(other.map(item => item.value)), 0)} mg/dL` }] : []),
  ];
  return {
    id: 'blood_sugar', title: tr('report_sugar_title', 'Qan şəkəri'), rows,
    note: tr('report_sugar_targets', 'Tətbiqdəki hədəflər: aclıq {fasting} mg/dL və ya aşağı, digər ölçmələr {other} mg/dL və ya aşağı; {low} mg/dL-dən aşağı dəyər aşağı sayılır.')
      .replace('{fasting}', String(BLOOD_SUGAR_TARGETS.fasting)).replace('{other}', String(BLOOD_SUGAR_TARGETS.other)).replace('{low}', String(BLOOD_SUGAR_TARGETS.low)),
    table: {
      headers: [tr('pdf_date_time', 'Tarix / saat'), tr('report_sugar_type', 'Ölçmə növü'), 'mg/dL (mmol/L)', tr('report_sugar_vs_target', 'Hədəfə görə')],
      rows: banded.map(item => [reportDate(new Date(item.at), true), types[item.log.reading_type] || item.log.reading_type || '—',
        `${num(item.value, 0)} (${num(item.value / 18.016, 1)})`, bands[item.band]]),
      widths: [1.2, 1.1, 1, 1],
    },
  };
}

// ── Kick counts ────────────────────────────────────────────────────────────
export interface ReportKickSession { id: string; kick_count: number; duration_seconds: number; session_date: string | null; created_at: string; }
/** Calendar day in the phone's zone; session_date is a server default and may be the UTC day. */
const kickDay = (session: ReportKickSession) => {
  const at = time(session.created_at);
  return at !== null ? localDateKey(new Date(at)) : session.session_date || '';
};

export function buildKickSection(sessions: ReportKickSession[], range: ReportRange, maxDays = 7): ReportSection | null {
  const valid = sessions.filter(session => {
    const day = kickDay(session);
    return day && dayInRange(day, range) && (finite(session.kick_count) ?? -1) >= 0;
  });
  if (!valid.length) return null;
  const byDay = new Map<string, { sessions: number; kicks: number; seconds: number }>();
  for (const session of valid) {
    const day = kickDay(session);
    const entry = byDay.get(day) || { sessions: 0, kicks: 0, seconds: 0 };
    entry.sessions++; entry.kicks += finite(session.kick_count) || 0; entry.seconds += Math.max(0, finite(session.duration_seconds) || 0);
    byDay.set(day, entry);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const totalKicks = valid.reduce((sum, session) => sum + (finite(session.kick_count) || 0), 0);
  return {
    id: 'kicks', title: tr('report_kicks_title', 'Təpik sayı'),
    rows: [
      { label: tr('report_kicks_sessions', 'Sayma seansları'), value: String(valid.length) },
      { label: tr('report_kicks_days', 'Qeydli günlər'), value: String(byDay.size) },
      { label: tr('report_kicks_avg_session', 'Seans üzrə orta təpik'), value: num(totalKicks / valid.length, 1) },
      { label: tr('report_kicks_avg_duration', 'Seansın orta müddəti (dəq:san)'), value: clock(avg(valid.map(session => Math.max(0, finite(session.duration_seconds) || 0)))) },
    ],
    note: days.length > maxDays ? tr('report_recent_days_note', 'Cədvəldə son {n} qeydli gün göstərilir.').replace('{n}', String(maxDays)) : undefined,
    table: {
      headers: [tr('pdf_date', 'Tarix'), tr('report_kicks_sessions', 'Sayma seansları'), tr('report_kicks_total', 'Cəmi təpik'), tr('report_kicks_time', 'Cəmi vaxt (dəq:san)')],
      rows: days.slice(0, maxDays).map(([day, entry]) => [reportDate(day), String(entry.sessions), String(entry.kicks), clock(entry.seconds)]),
      widths: [1, 1, 1, 1],
    },
  };
}

// ── Contractions ───────────────────────────────────────────────────────────
export interface ReportContraction { id: string; start_time: string; duration_seconds: number; interval_seconds: number | null; }
/** A pause longer than this starts a new contraction-timing session. */
export const CONTRACTION_SESSION_GAP_MS = 60 * 60 * 1000;
export interface ContractionSession { start: number; count: number; avgDuration: number | null; avgInterval: number | null; }

export function groupContractionSessions(rows: ReportContraction[], range: ReportRange): ContractionSession[] {
  const items = rows.map(row => ({ at: time(row.start_time), duration: finite(row.duration_seconds), interval: finite(row.interval_seconds) }))
    .filter((item): item is { at: number; duration: number | null; interval: number | null } => inRange(item.at, range))
    .sort((a, b) => a.at - b.at);
  const groups: typeof items[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && item.at - last[last.length - 1].at <= CONTRACTION_SESSION_GAP_MS) last.push(item);
    else groups.push([item]);
  }
  return groups.map(group => {
    const intervals: number[] = [];
    // Start-to-start within the session is authoritative; a stored interval fills in only for the first one.
    group.forEach((item, index) => {
      if (index > 0) intervals.push((item.at - group[index - 1].at) / 1000);
      else if (item.interval !== null && item.interval > 0 && item.interval * 1000 <= CONTRACTION_SESSION_GAP_MS) intervals.push(item.interval);
    });
    return {
      start: group[0].at, count: group.length,
      avgDuration: avg(group.map(item => item.duration).filter((n): n is number => n !== null && n > 0)),
      avgInterval: avg(intervals),
    };
  });
}

export function buildContractionSection(rows: ReportContraction[], range: ReportRange, maxSessions = 5): ReportSection | null {
  const sessions = groupContractionSessions(rows, range);
  if (!sessions.length) return null;
  const recent = [...sessions].reverse().slice(0, maxSessions);
  return {
    id: 'contractions', title: tr('report_contractions_title', 'Sancılar'),
    rows: [
      { label: tr('report_contractions_count', 'Qeyd edilmiş sancılar'), value: String(sessions.reduce((sum, item) => sum + item.count, 0)) },
      { label: tr('report_contractions_sessions', 'Ölçmə seansları'), value: String(sessions.length) },
    ],
    note: sessions.length > maxSessions ? tr('report_recent_sessions_note', 'Cədvəldə son {n} seans göstərilir.').replace('{n}', String(maxSessions)) : undefined,
    table: {
      headers: [tr('report_session_start', 'Başlama'), tr('report_contractions_count_short', 'Sancı sayı'), tr('report_avg_duration', 'Orta müddət (dəq:san)'), tr('report_avg_interval', 'Orta interval (dəq:san)')],
      rows: recent.map(item => [reportDate(new Date(item.start), true), String(item.count), clock(item.avgDuration), clock(item.avgInterval)]),
      widths: [1.2, 0.8, 1, 1],
    },
  };
}

// ── EPDS ───────────────────────────────────────────────────────────────────
export interface ReportEpds { id: string; total_score: number; risk_level?: string | null; completed_at: string | null; answers: unknown; }
export type EpdsBand = 'low' | 'possible' | 'probable';
/** The thresholds the app scores with (useSubmitEPDS): 10-12 moderate, 13+ high. */
export const epdsBand = (score: number): EpdsBand => score >= 13 ? 'probable' : score >= 10 ? 'possible' : 'low';
/** Answers are stored by question number; question 10 is thoughts of self-harm. */
export function epdsQuestion10(answers: unknown): number | null {
  if (!answers || typeof answers !== 'object') return null;
  const value = finite((answers as Record<string, unknown>)['10']);
  return value === null ? null : value;
}

export function buildEpdsSection(assessments: ReportEpds[], range: ReportRange): ReportSection | null {
  const dated = assessments.map(item => ({ item, at: time(item.completed_at), score: finite(item.total_score) }))
    .filter((entry): entry is { item: ReportEpds; at: number; score: number } => entry.at !== null && entry.score !== null && entry.at <= range.end.getTime())
    .sort((a, b) => b.at - a.at);
  // A screening outside a short period is still the latest one the clinician should see.
  const shown = dated.filter(entry => inRange(entry.at, range));
  const list = shown.length ? shown : dated.slice(0, 1);
  if (!list.length) return null;
  const bands: Record<EpdsBand, string> = {
    low: tr('report_epds_low', 'Hədd altında (0-9)'),
    possible: tr('report_epds_possible', 'Mümkün depressiya (10-12)'),
    probable: tr('report_epds_probable', 'Ehtimal olunan depressiya (13+)'),
  };
  const flagged = list.filter(entry => (epdsQuestion10(entry.item.answers) ?? 0) > 0);
  const flag = flagged.length ? tr('report_epds_q10_flag', 'Diqqət: 10-cu sual (özünə zərər vermək fikri) 0-dan yuxarı qiymətləndirilib: {dates}. Təhlükəsizlik qiymətləndirməsi tövsiyə olunur.')
    .replace('{dates}', flagged.map(entry => `${reportDate(new Date(entry.at))} (${epdsQuestion10(entry.item.answers)}/3)`).join(', ')) : undefined;
  return {
    id: 'epds', title: tr('report_epds_title', 'EPDS (Edinburq doğuşdansonrakı depressiya şkalası)'), flag,
    note: tr('report_epds_note', 'EPDS skrininq vasitəsidir, diaqnoz deyil. Maksimum bal 30-dur.'),
    table: {
      headers: [tr('pdf_date', 'Tarix'), tr('report_epds_score', 'Bal'), tr('report_epds_band', 'Risk qrupu'), tr('report_epds_q10', 'Sual 10')],
      rows: list.map(entry => {
        const q10 = epdsQuestion10(entry.item.answers);
        return [reportDate(new Date(entry.at)), `${entry.score} / 30`, bands[epdsBand(entry.score)], q10 === null ? '—' : q10 > 0 ? `${q10} (!)` : '0'];
      }),
      widths: [1, 0.7, 1.6, 0.7],
    },
  };
}

// ── Vaccines ───────────────────────────────────────────────────────────────
export interface ReportVaccineSchedule {
  id: string; dose_number: number; recommended_age_days: number; min_age_days: number | null; max_age_days: number | null;
  schedule_meta?: unknown; dose_label?: string | null; dose_label_az?: string | null; age_label?: string | null; age_label_az?: string | null;
  vaccine: { name?: string | null; name_az?: string | null; is_active: boolean };
}
export interface ReportVaccination { vaccine_schedule_id: string; administered_at: string | null; is_skipped: boolean; }
export interface ReportChild { birth_date: string; gender: string; due_date?: string | null; }

export function buildVaccineSection(schedule: ReportVaccineSchedule[], logs: ReportVaccination[], child: ReportChild, range: ReportRange, today = new Date()): ReportSection | null {
  if (!schedule.length || !child.birth_date) return null;
  const logMap = new Map(logs.map(log => [log.vaccine_schedule_id, log]));
  const items = schedule.filter(row => {
    const log = logMap.get(row.id);
    return (row.vaccine.is_active || !!log) && vaccineEligible(row, child.birth_date, child.gender, log);
  }).map(row => ({ row, log: logMap.get(row.id) || null, status: vaccineStatus(row, child.birth_date, logMap, today), timing: vaccineTiming(row) }));
  const routine = items.filter(item => !item.timing || item.timing.kind === 'routine');
  const done = items.filter(item => item.status === 'done');
  const due = routine.filter(item => item.status === 'pending');
  const overdue = routine.filter(item => item.status === 'overdue');
  if (!done.length && !due.length && !overdue.length) return null;
  const name = (item: typeof items[number]) => item.row.vaccine.name || item.row.vaccine.name_az || '—';
  const dose = (item: typeof items[number]) => item.row.dose_label || item.row.dose_label_az || String(item.row.dose_number);
  const dueDate = (item: typeof items[number]) => item.timing ? calendarOffsetDate(child.birth_date, item.timing.age) : addDays(parseISO(child.birth_date), item.row.recommended_age_days);
  const statusLabel = { done: tr('report_vaccine_done', 'Vurulub'), due: tr('report_vaccine_due', 'Vaxtı çatıb'), overdue: tr('report_vaccine_overdue', 'Gecikib') };
  const doneInRange = done.filter(item => item.log?.administered_at && dayInRange(item.log.administered_at.slice(0, 10), range))
    .sort((a, b) => (b.log!.administered_at || '').localeCompare(a.log!.administered_at || ''));
  const byAge = (a: typeof items[number], b: typeof items[number]) => a.row.recommended_age_days - b.row.recommended_age_days;
  const scheduled = (item: typeof items[number]) => `${item.row.age_label || item.row.age_label_az || ''}${item.row.age_label || item.row.age_label_az ? ' · ' : ''}${reportDate(dueDate(item))}`;
  return {
    id: 'vaccines', title: tr('report_vaccines_title', 'Peyvəndlər'),
    rows: [
      { label: tr('report_vaccine_done', 'Vurulub'), value: String(done.length) },
      { label: tr('report_vaccine_due', 'Vaxtı çatıb'), value: String(due.length) },
      { label: tr('report_vaccine_overdue', 'Gecikib'), value: String(overdue.length) },
    ],
    note: tr('report_vaccines_note', 'Tətbiqdə seçilmiş ölkə təqvimi və valideynin qeydləri əsasında. Cədvəldə gecikən, vaxtı çatan və seçilmiş dövrdə vurulan dozalar göstərilir.'),
    table: {
      headers: [tr('report_vaccine_name', 'Peyvənd'), tr('report_vaccine_dose', 'Doza'), tr('report_vaccine_status', 'Status'), tr('report_vaccine_date', 'Tarix / tövsiyə olunan yaş')],
      rows: [
        ...overdue.sort(byAge).map(item => [name(item), dose(item), statusLabel.overdue, scheduled(item)]),
        ...due.sort(byAge).map(item => [name(item), dose(item), statusLabel.due, scheduled(item)]),
        ...doneInRange.map(item => [name(item), dose(item), statusLabel.done, reportDate(item.log!.administered_at!.slice(0, 10))]),
      ],
      widths: [1.3, 0.9, 0.8, 1.3],
    },
  };
}

// ── Growth (WHO percentiles) ───────────────────────────────────────────────
export interface ReportGrowth { id: string; entry_date: string; weight_kg: number | string | null; height_cm: number | string | null; head_cm?: number | string | null; }

export function buildGrowthSection(entries: ReportGrowth[], child: ReportChild, range: ReportRange, maxRows = 8): ReportSection | null {
  if (!child.birth_date) return null;
  const valid = entries.filter(entry => entry.entry_date && entry.entry_date.slice(0, 10) <= range.endDay
      && (finite(entry.weight_kg) ?? 0) + (finite(entry.height_cm) ?? 0) + (finite(entry.head_cm) ?? 0) > 0)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const shown = valid.filter(entry => dayInRange(entry.entry_date.slice(0, 10), range));
  // Outside the period, the latest measurement is still what a paediatrician asks for.
  const list = (shown.length ? shown : valid.slice(0, 1)).slice(0, maxRows);
  if (!list.length) return null;
  const prematurity = getPrematurityInfo(child.birth_date, child.due_date ?? null);
  // Same reference as BabyGrowthTracker: corrected age (from the due date) for babies born preterm.
  const reference = prematurity.isPremature && child.due_date ? child.due_date : child.birth_date;
  const sex: Sex | null = child.gender === 'boy' || child.gender === 'girl' ? child.gender : null;
  const pct = (measure: 'weight' | 'height', months: number, value: number | null) => {
    if (!sex || value === null || value <= 0) return null;
    return percentile(measure, sex, months, value);
  };
  const cell = (value: number | null, digits: number, p: number | null) => value === null || value <= 0 ? '—' : `${num(value, digits)}${p === null ? '' : ` · P${p}`}`;
  const rows = list.map(entry => {
    const months = ageInMonths(reference, entry.entry_date);
    const weight = finite(entry.weight_kg), height = finite(entry.height_cm), head = finite(entry.head_cm);
    return { entry, months, weight, height, head, wp: pct('weight', months, weight), hp: pct('height', months, height) };
  });
  const latest = rows[0];
  const cards: ReportRow[] = [
    ...(latest.wp !== null ? [{ label: tr('report_growth_weight_pct', 'Çəki persentili (ÜST)'), value: `P${latest.wp} · ${num(latest.weight, 2)} ${tr('report_kg', 'kq')}` }] : []),
    ...(latest.hp !== null ? [{ label: tr('report_growth_height_pct', 'Boy persentili (ÜST)'), value: `P${latest.hp} · ${num(latest.height, 1)} cm` }] : []),
  ];
  const notes = [tr('report_growth_note', 'Persentillər ÜST uşaq böyümə standartlarına əsaslanır (0-24 ay).')];
  if (reference !== child.birth_date) notes.push(tr('report_growth_corrected', 'Vaxtından əvvəl doğulduğu üçün korreksiya olunmuş yaş istifadə edilib.'));
  if (!sex) notes.push(tr('report_growth_no_sex', 'Cinsiyyət qeyd edilmədiyi üçün persentil hesablanmayıb.'));
  return {
    id: 'growth', title: tr('report_growth_title', 'Böyümə (ÜST persentilləri)'), rows: cards, note: notes.join(' '),
    table: {
      headers: [tr('pdf_date', 'Tarix'), tr('report_growth_age', 'Yaş (ay)'), tr('report_growth_weight', 'Çəki, kq (P)'), tr('report_growth_height', 'Boy, cm (P)'), tr('report_growth_head', 'Baş çevrəsi, cm')],
      rows: rows.map(row => [reportDate(row.entry.entry_date.slice(0, 10)), row.months >= 0 ? num(row.months, 1) : '—', cell(row.weight, 2, row.wp), cell(row.height, 1, row.hp), row.head === null || row.head <= 0 ? '—' : num(row.head, 1)]),
      widths: [1, 0.7, 1.1, 1.1, 0.9],
    },
  };
}

// ── Assembly ───────────────────────────────────────────────────────────────
export interface DoctorReportExtras {
  bloodSugar?: ReportBloodSugar[]; kicks?: ReportKickSession[]; contractions?: ReportContraction[]; epds?: ReportEpds[];
  growth?: ReportGrowth[]; vaccines?: { schedule: ReportVaccineSchedule[]; logs: ReportVaccination[] };
}
export interface ExtrasContext { stage: string; range: ReportRange; child?: ReportChild | null; includeEpds?: boolean; today?: Date; }

/** Only the sections that belong to the life stage and have data. */
export function buildClinicalSections(extras: DoctorReportExtras, context: ExtrasContext): ReportSection[] {
  const { stage, range, child } = context;
  const sections: (ReportSection | null)[] = [];
  if (stage === 'bump') {
    sections.push(buildBloodSugarSection(extras.bloodSugar || [], range));
    sections.push(buildKickSection(extras.kicks || [], range));
    sections.push(buildContractionSection(extras.contractions || [], range));
  }
  if ((stage === 'bump' || stage === 'mommy') && context.includeEpds !== false) sections.push(buildEpdsSection(extras.epds || [], range));
  if (stage === 'mommy' && child) {
    sections.push(buildGrowthSection(extras.growth || [], child, range));
    if (extras.vaccines) sections.push(buildVaccineSection(extras.vaccines.schedule, extras.vaccines.logs, child, range, context.today));
  }
  return sections.filter((item): item is ReportSection => !!item);
}
