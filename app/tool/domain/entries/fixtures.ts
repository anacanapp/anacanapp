// Cross-language fixtures: runs the ORIGINAL TypeScript on a spread of inputs. gen_fixtures.mjs calls
// `zoned(setSystemTime)` once per time zone (child process with TZ set) and `zoneFree()` once.
import { getCycleDayForDate, getPhaseInfoForDate, getNextPeriodDate, getFertileWindow, calculateCycleStats } from '@/lib/cycle-utils';
import { computeAdaptiveCycleStats, getCyclePredictions, refineOvulation, effectiveCycleLength } from '@/lib/cycle-predictions';
import * as preg from '@/lib/pregnancy-utils';
import { storedCalendarDate, storedDateKey } from '@/lib/stored-date-key';
import { vaccineStatus } from '@/lib/vaccine-schedule';
import { sleepEntries, sleepSummary, sleepDays, buildSchedule, scheduleStatus } from '@/lib/sleep-training';
import { predictNextNap, predictDay, upcomingRegressions, personalWakeWindow } from '@/lib/sleep-predict';
import { planLocalNotifications, nextFireAt, fingerprint } from '@/lib/local-notification-scheduler';
import { daysBetween, addDays as weaningAddDays, ageInMonths as weaningAge, createPlan, reminderDays } from '@/lib/weaning';
import { trendPoints, dailyHistory, feedingStats, sleepStats } from '@/lib/baby-logs-range';
import { validatePeriodDates } from '@/lib/period-flow';
import { percentile, zScore, valueAtPercentile, buildCurveData } from '@/lib/whoGrowth';
import { estimatePercentileForWeight } from '@/lib/fetalGrowth';
import { computeAptekTotals, parseAptekConfig } from '@/lib/aptek-pricing';
import { buildRecapModel } from '@/lib/recap/model';
import { recapSource } from '@/lib/recap/copy';
import { RECAP_DEMO_LABELS_AZ, RECAP_PERSONAS } from '@/lib/recap/fixtures';
import { formatNumber, formatPercent, formatUnit } from '@/lib/recap/numbers';
import { parseRecap } from '@/lib/recap/types';
import { todaysPicks as kidPicks, searchExercises, foldSearch, groupsOf, currentGroupKey } from '@/lib/kid-exercises';
import kidAz from '@/data/kid-exercises/az.json';
import { mergeKidExLocale } from '@/data/kid-exercises';
import { KIDEX_UI_AZ } from '@/data/kid-exercises/ui-az';
import type { KidExSource } from '@/data/kid-exercises/types';
import { PLAY_GAMES_AZ } from '@/data/play-together/az';
import { gamesForAge, todaysPicks as playPicks } from '@/lib/play-together';
import { vitaminSlicesForZone } from '../../../../scripts/notification-jobs/vitamin-zones.mjs';
import { maternityRules } from '@/data/maternityRules';
import { addDays, subDays } from 'date-fns';

type SetTime = (ms: number) => void;
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);

// Calendar edge cases: month ends, leap days, year boundaries, US and EU DST changes (2026: US 03-08 / 11-01,
// EU 03-29 / 10-25).
const DAYS = ['2024-02-28', '2024-02-29', '2024-03-01', '2025-12-31', '2026-01-01', '2026-01-31', '2026-02-28', '2026-03-07',
  '2026-03-08', '2026-03-09', '2026-03-28', '2026-03-29', '2026-03-30', '2026-06-15', '2026-10-24', '2026-10-25', '2026-10-26',
  '2026-10-31', '2026-11-01', '2026-11-02', '2026-12-31'];
const NOWS = [[2024, 2, 29, 0, 30], [2026, 1, 1, 0, 5], [2026, 3, 8, 3, 30], [2026, 3, 9, 0, 30], [2026, 3, 29, 1, 30], [2026, 3, 29, 23, 59],
  [2026, 3, 30, 0, 1], [2026, 6, 15, 12, 0], [2026, 10, 25, 2, 30], [2026, 10, 26, 0, 0], [2026, 11, 1, 1, 30], [2026, 11, 2, 23, 0],
  [2026, 12, 31, 23, 59], [2027, 3, 8, 12, 0]] as const;
const ser = (v: unknown): unknown => JSON.parse(JSON.stringify(v, function (this: Record<string, unknown>, k) {
  const raw = this[k];
  if (raw instanceof Date) return { $date: Number.isNaN(raw.getTime()) ? null : raw.getTime() };
  if (typeof raw === 'number' && !Number.isFinite(raw)) return { $num: String(raw) };
  return raw;
}));

function cycle(setTime: SetTime) {
  const cases: unknown[] = [];
  const histories = [
    [],
    [{ cycle_number: 1, cycle_length: 30, period_length: 5 }, { cycle_number: 2, cycle_length: 27, period_length: 4 }],
    [{ cycle_number: 3, cycle_length: 26, period_length: 6 }, { cycle_number: 1, cycle_length: 31, period_length: 5 }, { cycle_number: 2, cycle_length: 53, period_length: 5 },
      { cycle_number: 4, cycle_length: 29, period_length: null }, { cycle_number: 5, cycle_length: 28, period_length: 13 }],
  ] as never[];
  for (const now of NOWS) {
    setTime(local(...now).getTime());
    for (const lpd of DAYS) {
      for (const L of [21, 28, 35]) {
        cases.push({
          fn: 'cycle', now: local(...now).getTime(), lpd, L,
          cycleDay: getCycleDayForDate(local(...now), storedCalendarDate(lpd)!, L),
          phase: getPhaseInfoForDate(local(...now), storedCalendarDate(lpd)!, L, 5),
          next: getNextPeriodDate(storedCalendarDate(lpd)!, L),
          fertile: getFertileWindow(storedCalendarDate(lpd)!, L),
        });
      }
      histories.forEach((h, hi) => cases.push({ fn: 'predictions', now: local(...now).getTime(), lpd, history: hi, out: getCyclePredictions(lpd, h, 28, 5) }));
    }
  }
  const stats = histories.map((h) => ({ adaptive: computeAdaptiveCycleStats(h), effective: effectiveCycleLength(h, 40), simple: calculateCycleStats(h) }));
  setTime(local(2026, 4, 2, 12).getTime());
  const logs = [
    { log_date: '2026-03-03', ovulation_test: 'peak' }, { log_date: '2026-03-12', cervical_mucus: 'eggwhite' }, { log_date: '2026-03-14', cervical_mucus: 'eggwhite' },
    { log_date: '2026-03-15', ovulation_test: 'positive' }, { log_date: '2026-03-16', ovulation_test: 'peak' }, { log_date: '2026-05-01', ovulation_test: 'peak' },
  ];
  const refine = [logs, logs.slice(0, 4), logs.slice(0, 3), logs.slice(0, 1), []].map((l) => refineOvulation(l as never, '2026-03-01', local(2026, 3, 15)));
  return ser({ cases, stats, refine });
}

function pregnancy(setTime: SetTime) {
  const out: unknown[] = [];
  const values: (string | null)[] = [...DAYS, '2025-06-01', '2026-02-20', null, 'not-a-date'];
  for (const now of NOWS) {
    setTime(local(...now).getTime());
    for (const v of values) {
      out.push({
        now: local(...now).getTime(), v,
        day: preg.getPregnancyDay(v), week: preg.getPregnancyWeek(v), dayInWeek: preg.getDayInWeek(v), until: preg.getDaysUntilDue(v),
        untilDue: preg.getDaysUntilDue(null, v), elapsed: preg.getDaysElapsed(v), progress: preg.getPregnancyProgress(v),
        due: preg.calculateDueDate(v), lmp: preg.calculateLMPFromDueDate(v), age: preg.getRealCalendarAge(v),
        weekAt: v ? preg.getPregnancyWeekAtDate(v, '2026-10-26') : null, str: preg.getWeekDayString(v),
        prem: preg.getPrematurityInfo(v, '2026-11-01'), key: storedDateKey(v), cal: storedCalendarDate(v),
      });
    }
  }
  return ser(out);
}

function vaccines(setTime: SetTime) {
  setTime(local(2026, 6, 1).getTime());
  const row = (meta: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({ id: 'dose-2', dose_number: 2, recommended_age_days: 60, min_age_days: 50, max_age_days: 120,
    schedule_meta: meta && { protocol: 'anacan-vaccine-schedule-v1', version: 'f', kind: 'routine', age: { months: 2, days: 0 }, end_age: null, expected_age_days: 60, expected_dose_number: 2, source_url: '', source_label: '', ...meta }, ...extra });
  const rows = [row(null), row({}), row({ end_age: { months: 4, days: -1 } }), row({ age: { months: 1, days: 14 }, end_age: { months: 12, days: 0 } }),
    row({ relative: { schedule_id: 'dose-1', min: { months: 1, days: 0 }, max: { months: 3, days: 0 } } })];
  const logs = [new Map(), new Map([['dose-1', { administered_at: '2026-03-31', is_skipped: false }]])];
  const out: unknown[] = [];
  for (const birth of ['2025-12-31', '2026-01-31', '2026-02-28', '2024-02-29', '2025-10-31']) {
    for (const now of NOWS) {
      rows.forEach((r, ri) => logs.forEach((l, li) => out.push({ birth, now: local(...now).getTime(), row: ri, logs: li, status: vaccineStatus(r, birth, l, local(...now)) })));
    }
  }
  return ser(out);
}

function sleep(setTime: SetTime) {
  const out: unknown[] = [];
  for (const [y, m, d] of [[2026, 3, 8], [2026, 3, 29], [2026, 10, 25], [2026, 11, 1], [2026, 6, 15]]) {
    const at = (h: number, mi = 0, off = 0) => local(y, m, d + off, h, mi);
    const logs = [];
    for (let off = -7; off <= 0; off++) {
      logs.push({ id: `n${off}`, log_type: 'sleep', start_time: at(20, 30, off - 1).toISOString(), end_time: at(6, 10, off).toISOString() });
      logs.push({ id: `a${off}`, log_type: 'sleep', start_time: at(9, 15, off).toISOString(), end_time: at(10, 5, off).toISOString() });
      if (off < 0) logs.push({ id: `b${off}`, log_type: 'sleep', start_time: at(12, 40, off).toISOString(), end_time: at(14, 0, off).toISOString() });
      logs.push({ id: `f${off}`, log_type: 'feeding', feed_type: off % 2 ? 'formula' : 'breast_left', notes: '90 ml', start_time: at(1, 30, off).toISOString(), end_time: at(1, 50, off).toISOString() });
    }
    const entries = sleepEntries(logs);
    for (const band of ['1-3', '4-6', '7-9', '10-12'] as const) {
      for (const [h, mi] of [[1, 0], [3, 0], [10, 30], [13, 0], [18, 20]]) {
        const now = at(h, mi);
        setTime(now.getTime());
        const next = predictNextNap({ entries, band, now, morningWake: at(6, 10) });
        out.push({
          date: [y, m, d], band, now: now.getTime(), next, day: predictDay({ entries, band, now, next }), ww: personalWakeWindow(entries, band, now),
          summary: sleepSummary({ sessions: entries, band, now }), days: sleepDays(entries, now).map((s) => [s.key, s.totalMinutes, s.napCount, s.nightMinutes]),
          regressions: upcomingRegressions(at(0, 0, -120), now), schedule: scheduleStatus(buildSchedule({ wakeTime: '06:45', band }), now),
          trend: trendPoints(logs, 'sleep', now, 7).map((p) => [p.key, p.count, p.minutes]), history: dailyHistory(logs, now, 3).map((r) => [r.key, r.feedings, r.formulaMl, r.sleepMinutes, r.diapers]),
          feeding: feedingStats(logs), sleepStats: sleepStats(logs),
        });
      }
    }
  }
  return ser(out);
}

function notifications(setTime: SetTime) {
  const out: unknown[] = [];
  for (const now of NOWS) {
    const n = local(...now).getTime();
    setTime(n);
    const ns = {
      water: [{ id: 101, title: 'w', body: 'b', at: local(2026, 1, 1, 8, 0).getTime(), repeat: 'day' as const }, { id: 102, title: 'w2', body: 'b', at: local(2025, 7, 1, 2, 30).getTime(), repeat: 'day' as const }],
      vaccine: Array.from({ length: 40 }, (_, i) => ({ id: 1 + i, title: `v${i}`, body: 'b', at: n + (i - 3) * 3_600_000 * 7 })),
      nap: [{ id: 880001, title: 'n', body: 'b', at: n + 4_000 }, { id: 880002, title: 'n2', body: 'b', at: n + 6_000, extra: { a: 1, b: 'x' } }],
      'baby:1': Array.from({ length: 30 }, (_, i) => ({ id: 500 + i, title: `m${i}`, body: 'b', at: local(now[0], now[1], now[2] + i, 9, 0).getTime(), ...(i % 5 === 0 ? { repeat: 'day' as const } : {}) })),
    };
    const plan = planLocalNotifications(ns, n);
    out.push({ now: n, ns, plan: plan.map((p) => [p.id, p.namespace, p.next]), small: planLocalNotifications(ns, n, 7).map((p) => p.id),
      next: ns.water.map((w) => nextFireAt(w, n)), fps: [...ns.water, ...ns.nap].map(fingerprint) });
  }
  return ser(out);
}

function weaning(setTime: SetTime) {
  const out: unknown[] = [];
  for (const a of DAYS) for (const b of ['2026-03-29', '2026-10-25', '2026-11-01', '2027-01-01']) out.push({ a, b, between: daysBetween(a, b), add: weaningAddDays(a, 9) });
  const plans: unknown[] = [];
  for (const now of NOWS) {
    setTime(local(...now).getTime());
    const p = createPlan({ feeds: { morning: true, day: 2, nap: true, bedtime: true, night: 1 }, pace: 'medium', nightMode: 'last', start: '2026-03-27', childId: null });
    plans.push({ now: local(...now).getTime(), age: DAYS.map((d) => weaningAge(d, local(...now))), reminders: reminderDays(p, local(...now)).map((r) => [r.step.id, r.at]) });
  }
  return ser({ out, plans });
}

function periodDates() {
  const out: unknown[] = [];
  for (const today of [local(2026, 3, 29, 1), local(2026, 10, 25, 23), local(2026, 1, 1)]) {
    for (const dates of [['2026-03-28', '2026-03-29', '2026-03-29'], ['2025-12-31', '2026-01-01'], [local(2026, 3, 29, 0, 30), '2026-03-30'], ['2026-10-25T23:30:00']]) {
      try { out.push({ today, dates, ok: validatePeriodDates(dates, today) }); } catch (e) { out.push({ today, dates, error: (e as Error).message }); }
    }
  }
  return ser(out);
}

/** The calculator lives inside React components: gen_fixtures.mjs extracts the original function bodies from
 *  MaternityCalculator.tsx (handleCalculate) and useMaternityBenefits.ts (calculateBenefit) and they run here. */
export async function maternity(maternityCalcSource: string, calculateBenefitSource: string,
  transform: (code: string, opts: { loader: 'ts' }) => Promise<{ code: string }>) {
  const fnSrc = (await transform(`(function(ctx){ const {eddDate, role, pregnancyType, selectedRule, selectedCountryCode, config, salary, isAZ, addDays, subDays} = ctx;
    const calculateBenefit = (function(){ ${calculateBenefitSource} return calculateBenefit; })();
    let result = null; const setResult = (r) => { result = r; };
    (function(){ ${maternityCalcSource} })();
    return result; })`, { loader: 'ts' })).code;
  const calc = (0, eval)(fnSrc);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: unknown[] = [];
  const config = { birthBenefit: 600, normalDaysBefore: 70, normalDaysAfter: 56, complicatedDaysAfter: 70, multipleDaysBefore: 70, multipleDaysAfter: 70, minSalary: 400, minPension: 320 };
  for (const rule of maternityRules) {
    for (const role of ['mother', 'father']) for (const pregnancyType of ['normal', 'complicated', 'multiple']) {
      for (const [edd, salary, isAZ, azConfig] of [['2026-03-29T00:00', '1500', true, true], ['2026-10-25T00:00', '9000.5', false, false], ['2027-01-15T00:00', '', true, false]] as const) {
        const r = calc({ eddDate: edd, role, pregnancyType, selectedRule: rule, selectedCountryCode: rule.code, config: azConfig ? config : null, salary, isAZ, addDays, subDays });
        if (!r) continue;
        out.push({ code: rule.code, role, pregnancyType, edd, salary, isAz: isAZ, azConfig, out: { daysBefore: r.daysBefore, daysAfter: r.daysAfter, totalDays: r.totalDays,
          start: fmt(r.leaveStartDate), end: fmt(r.leaveEndDate), return: fmt(r.returnToWorkDate), benefit: r.benefitResult } });
      }
    }
  }
  return ser(out);
}

export function zoned(setTime: SetTime) {
  return { cycle: cycle(setTime), pregnancy: pregnancy(setTime), vaccines: vaccines(setTime), sleep: sleep(setTime), notifications: notifications(setTime),
    weaning: weaning(setTime), period_dates: periodDates() };
}

export function zoneFree() {
  const who: unknown[] = [];
  for (const measure of ['weight', 'height', 'head'] as const) for (const sex of ['boy', 'girl'] as const) {
    for (const age of [0, 0.5, 1, 5.25, 12, 23.5, 23.999, 24, 24.5, 36, 47.3, 59.9, 60]) {
      for (const v of [2.1, 3.3, 7.7, 10, 14.2, 20, 33, 45.5, 50, 75, 90, 110]) who.push({ measure, sex, age, v, p: percentile(measure, sex, age, v), z: zScore(measure, sex, age, v) });
      who.push({ measure, sex, age, at: [3, 15, 50, 85, 97, 42].map((p) => valueAtPercentile(measure, sex, age, p)) });
    }
    who.push({ measure, sex, curve: buildCurveData(measure, sex, 60) });
  }
  const fetal = [];
  for (let w = 18; w <= 42; w += 0.5) for (const g of [200, 400, 900, 1500, 2300, 3000, 3600, 4200, 5000]) fetal.push([w, g, estimatePercentileForWeight(w, g)]);
  const aptekConfig = parseAptekConfig({ enabled: true, bundle_discount_pct: 15, free_shipping_min: 25.5, bundles: [{ id: 'b1', skus: ['a', 'b'] }, { id: 'b2', skus: ['b', 'c', 'c'] }] });
  const aptek = [];
  const prices = [0.1, 0.2, 1.005, 2.675, 7.5, 17.8, 4.6, 6.6, 9.99, 12.345];
  for (let i = 0; i < 60; i++) {
    const lines = ['a', 'b', 'c', 'x', null].map((sku, j) => ({ sku, price: prices[(i * 3 + j * 7) % prices.length], quantity: (i + j) % 4 }));
    const coupon = { code: 'C', discount_type: i % 3 ? 'percentage' : 'fixed', discount_value: (i % 7) * 4.5, applicable_to: ['aptek'], is_active: true, starts_at: null, expires_at: null, max_uses: null, used_count: 0, min_order_amount: i % 5 ? null : 10 };
    aptek.push({ lines, coupon, out: computeAptekTotals(lines, aptekConfig, i % 4 ? coupon : null, new Date(0)) });
  }
  const recapLangs = ['az', 'en', 'ru', 'tr', 'ar', 'ja', 'zh', 'pl', 'uk', 'fr', 'es', 'ko', 'kk'];
  const recapCases: unknown[] = [];
  const raws = {
    ...RECAP_PERSONAS,
    empty: parseRecap({ available: true, year: 2026, stage: 'mommy', mommy: { feedings: 0 } }),
    strings: parseRecap({ available: true, year: '2026', stage: 'bump', stages: ['bump'], days_active: '12.6', favorite_hour: '23.7', ai_questions: '11', likes: '4', comments: 2, posts: '1',
      bump: { week_start: '12', week_end: 13, kicks: '0', bag_items_ready: 0, favorite_names: '3' }, top_tools: [{ id: 'x', count: '2' }, { id: '', count: 3 }, { id: 'y', count: 0 }] }),
    unavailable: parseRecap({ available: false, reason: 'closed' }),
  };
  for (const [name, d] of Object.entries(raws)) {
    if (!(d as { available: boolean }).available) { recapCases.push({ name, data: d }); continue; }
    for (const lang of recapLangs) {
      recapCases.push({ name, lang, data: d, model: buildRecapModel(d as never, lang, recapSource, { labels: RECAP_DEMO_LABELS_AZ, seed: lang === 'az' ? undefined : `seed-${name}` }) });
    }
  }
  const longMusic = { length: 70, drop: 16, breath: 44, lift: 46, tail: 62, end: 66.2, beat: 0.5 };
  recapCases.push({ name: 'mommy', lang: 'az', music: longMusic, data: RECAP_PERSONAS.mommy, model: buildRecapModel(RECAP_PERSONAS.mommy, 'az', recapSource, { labels: RECAP_DEMO_LABELS_AZ, music: longMusic }) });
  const numbers = [];
  for (const lang of [...recapLangs, 'de', 'pt', 'et', 'sv', 'hi', 'xx']) {
    for (const n of [0, 1, 2, 3, 5, 11, 21, 22, 25, 101, 1000, 1505, 12345, 1234567, -1234.5, 6.25, 0.5, 2.5, 1.005]) {
      numbers.push({ lang, n, num: formatNumber(lang, n), num1: formatNumber(lang, n, 1), pct: formatPercent(lang, n),
        day: formatUnit(lang, n, 'day'), hour1: formatUnit(lang, n, 'hour', 1), kg1: formatUnit(lang, n, 'kilogram', 1) });
    }
  }
  const kidContent = mergeKidExLocale('az', kidAz as KidExSource, { ui: KIDEX_UI_AZ, sets: {}, groups: {}, exercises: {} });
  const exercises = kidContent.exercises.map(({ id, set, groupKey, group, title, how, benefit }) => ({ id, set, groupKey, group, title, how, benefit }));
  const kidPicksOut = [];
  for (const set of ['0-1', '1-2', '2-3', '3-4', '4-5']) {
    const inSet = kidContent.exercises.filter((e) => e.set === set);
    for (const months of [null, 0, 2, 4, 7, 11, 13, 16, 20, 30, 50]) for (let d = 1; d <= 6; d++) {
      const seed = `2026-11-${d}|child-${set}|${set}`;
      kidPicksOut.push({ set, months, seed, picks: kidPicks(inSet, seed, months).map((e) => e.id) });
    }
  }
  const queries = ['qarin ustə', 'TOP', 'əl', 'Şə', 'ayaq', 'Ü', 'çanaq', 'xyz', '  ', 'İ'];
  const folds = ['Qarın üstə', 'İstanbul', 'ŞƏKİ', 'Ağdam ölkə', 'Ñandú café', 'Ёжик Йод', 'Việt Nam', 'Straße', 'İıIi', '한국어', 'Ελληνικά άέ'];
  const play = PLAY_GAMES_AZ.map(({ id, cat, minM, maxM, minutes, books }) => ({ id, cat, minM, maxM, minutes, books }));
  const playOut = [];
  for (const months of [3, 6, 8, 14, 20, 26, 30, 38, 42, 50, 62, 70, 80, 100, 120]) {
    const games = gamesForAge(PLAY_GAMES_AZ, months);
    for (let d = 1; d <= 4; d++) {
      const seed = `2026-11-${d}|c1|m${months}`;
      const played = new Set(games.slice(0, d - 1).map((g) => g.id));
      playOut.push({ months, seed, played: [...played], ids: games.map((g) => g.id), picks: playPicks(games, seed, played).map((g) => g.id) });
    }
  }
  const vitamin = [];
  const offsetAt = (date: Date, zone: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(date).map((x) => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  };
  for (const zone of ['Asia/Baku', 'Europe/Berlin', 'America/New_York', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/St_Johns']) {
    for (const iso of ['2026-10-27T10:55:00Z', '2026-10-27T19:55:20Z', '2026-07-01T10:55:00Z', '2026-11-08T03:55:00Z', '2026-03-29T00:57:00Z', '2026-03-08T06:58:00Z',
      '2026-12-31T19:56:00Z', '2026-12-31T23:59:59Z', '2024-02-29T20:00:00Z', '2026-10-25T00:58:00Z']) {
      const now = new Date(iso);
      const tick = new Date(Math.floor(now.getTime() / 300000) * 300000);
      vitamin.push({ zone, iso, offset: offsetAt(tick, zone), slices: vitaminSlicesForZone(now, zone) });
    }
  }
  return ser({ who, fetal, aptek, aptekConfig, recap: recapCases, recap_numbers: numbers,
    kid_exercises: { exercises, picks: kidPicksOut, search: queries.map((q) => ({ q, ids: searchExercises(kidContent.exercises, q).map((e) => e.id) })),
      folds: folds.map((t) => [t, foldSearch(t)]), groups: groupsOf(kidContent.exercises).map((g) => [g.key, g.items.length]),
      current: [0, 2, 4, 8, 13, 16, 22, 30].map((m) => [m, currentGroupKey(kidContent.exercises, m < 12 ? '0-1' : '1-2', m)]) },
    play_together: { games: play, picks: playOut }, vitamin_slices: vitamin });
}
