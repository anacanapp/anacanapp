import type { CycleHistory } from '@/hooks/useCycleHistory';

/**
 * Adaptiv tsikl proqnoz mühərriki.
 * Statik cycle_length əvəzinə cycle_history-dən ÖYRƏNİR:
 *  - son 6 tamamlanmış tsiklin çəkili ortalaması (yenilər daha ağır)
 *  - standart sapma → proqnoz dəqiqliyi (±gün) və etibar səviyyəsi
 */

export type PredictionConfidence = 'high' | 'medium' | 'low' | 'none';

export interface AdaptiveCycleStats {
  /** Çəkili proqnoz uzunluğu (gün). Data yoxdursa fallback. */
  predictedCycleLength: number;
  /** Orta period uzunluğu. */
  predictedPeriodLength: number;
  /** Standart sapma (gün). */
  stdDev: number;
  /** Neçə tamamlanmış tsiklə əsaslanır. */
  basedOnCycles: number;
  confidence: PredictionConfidence;
}

export interface CyclePredictions extends AdaptiveCycleStats {
  nextPeriodDate: Date;
  daysUntilNextPeriod: number;
  ovulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  pmsStart: Date;
  isLate: boolean;
  lateDays: number;
}

const MAX_CYCLES = 6;
const MIN_VALID = 15; // qeyri-real qısa tsiklləri at
const MAX_VALID = 60; // qeyri-real uzunları at

/**
 * Tamamlanmış tsikllərdən çəkili statistika.
 * cycles: useCycleHistory nəticəsi (cycle_number desc sıralı olması vacib deyil).
 */
export function computeAdaptiveCycleStats(
cycles: CycleHistory[],
fallbackCycleLength: number = 28,
fallbackPeriodLength: number = 5)
: AdaptiveCycleStats {
  // Yalnız tamamlanmış (cycle_length dolu) və ağlabatan tsikllər, ən yenilər öndə
  const completed = [...cycles].
  filter((c) => c.cycle_length != null && c.cycle_length >= MIN_VALID && c.cycle_length <= MAX_VALID).
  sort((a, b) => b.cycle_number - a.cycle_number).
  slice(0, MAX_CYCLES);

  if (completed.length === 0) {
    return {
      predictedCycleLength: fallbackCycleLength,
      predictedPeriodLength: fallbackPeriodLength,
      stdDev: 0,
      basedOnCycles: 0,
      confidence: 'none'
    };
  }

  // Çəkili ortalama: ən yeni tsikl ən ağır (w = n, n-1, ..., 1)
  const lengths = completed.map((c) => c.cycle_length!);
  let weightedSum = 0;
  let weightTotal = 0;
  lengths.forEach((len, i) => {
    const w = lengths.length - i;
    weightedSum += len * w;
    weightTotal += w;
  });
  const predictedCycleLength = Math.round(weightedSum / weightTotal);

  // Standart sapma (sadə, populyasiya)
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  // Period uzunluğu ortalaması
  const periods = completed.map((c) => c.period_length).filter((p): p is number => p != null && p > 0 && p <= 12);
  const predictedPeriodLength = periods.length > 0 ?
  Math.round(periods.reduce((a, b) => a + b, 0) / periods.length) :
  fallbackPeriodLength;

  // Etibar səviyyəsi
  let confidence: PredictionConfidence = 'low';
  if (completed.length >= 3 && stdDev <= 2) confidence = 'high';else
  if (completed.length >= 2 && stdDev <= 4) confidence = 'medium';

  return { predictedCycleLength, predictedPeriodLength, stdDev, basedOnCycles: completed.length, confidence };
}

/** Tam proqnoz dəsti — dashboard/təqvim/bildirişlər üçün vahid mənbə. */
export function getCyclePredictions(
lastPeriodDate: Date | string,
cycles: CycleHistory[],
fallbackCycleLength: number = 28,
fallbackPeriodLength: number = 5)
: CyclePredictions {
  const stats = computeAdaptiveCycleStats(cycles, fallbackCycleLength, fallbackPeriodLength);
  const L = stats.predictedCycleLength;

  const lpd = new Date(lastPeriodDate);
  lpd.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const addDays = (base: Date, d: number) => {
    const r = new Date(base);
    r.setDate(r.getDate() + d);
    return r;
  };

  // Növbəti period: gecikirsə keçmişə düşməsin deyə "proqnozlaşdırılan ilk gələcək" YOX —
  // gecikməni aşkar etmək üçün xam proqnozu saxlayırıq.
  const nextPeriodDate = addDays(lpd, L);
  const daysUntilNextPeriod = Math.round((nextPeriodDate.getTime() - today.getTime()) / 86400000);

  const ovulationDate = addDays(nextPeriodDate, -14);
  const fertileWindowStart = addDays(ovulationDate, -5);
  const fertileWindowEnd = addDays(ovulationDate, 1);
  const pmsStart = addDays(nextPeriodDate, -5);

  const isLate = daysUntilNextPeriod < 0;
  const lateDays = isLate ? Math.abs(daysUntilNextPeriod) : 0;

  return {
    ...stats,
    nextPeriodDate,
    daysUntilNextPeriod,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    pmsStart,
    isLate,
    lateDays
  };
}

// ============================================================
// Flow P1: simptom-əsaslı ovulyasiya dəqiqləşdirməsi
//   Təqvim proqnozu (L-14) → OPK testi və servikal maye ilə
//   düzəldilir. Mənbə prioriteti: peak OPK > positive OPK >
//   yumurta ağı maye > təqvim.
// ============================================================

/** refineOvulation üçün lazım olan minimal log sahələri. */
export interface OvulationSignalLog {
  log_date: string;
  ovulation_test?: 'negative' | 'positive' | 'peak' | null;
  cervical_mucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' | null;
}

export type OvulationSource = 'opk_peak' | 'opk_positive' | 'mucus' | 'calendar';

export interface RefinedOvulation {
  ovulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  /** Hansı siqnala əsaslanır. */
  source: OvulationSource;
  /** Cari tsikldə real test/maye siqnalı tapılıb (yalnız təqvim deyil). */
  confirmed: boolean;
}

const DAY_MS = 86400000;

function atMidnight(d: Date | string): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDaysTo(base: Date, d: number): Date {
  const r = new Date(base);
  r.setDate(r.getDate() + d);
  return r;
}

/**
 * Cari tsiklin gündəlik loglarından ovulyasiya gününü dəqiqləşdirir.
 *
 * Bioloji qaydalar:
 *  - peak OPK → ovulyasiya ~24 saat sonra (test günü + 1)
 *  - positive OPK (LH yüksəlişi) → ovulyasiya 24-36 saat sonra (+1 gün)
 *  - yumurta ağı servikal maye → pik fertillik; son "eggwhite" günü + 1
 *  - siqnal yoxdursa → təqvim proqnozu olduğu kimi qalır
 *
 * @param logs cari tsiklə düşən gündəlik loglar (sıra vacib deyil)
 * @param lastPeriodDate cari tsiklin başlanğıcı
 * @param calendarOvulation təqvim-əsaslı proqnoz (getCyclePredictions-dan)
 */
export function refineOvulation(
logs: OvulationSignalLog[],
lastPeriodDate: Date | string,
calendarOvulation: Date)
: RefinedOvulation {
  const cycleStart = atMidnight(lastPeriodDate);
  const today = atMidnight(new Date());

  // Yalnız cari tsiklin logları (başlanğıcdan bu günə qədər)
  const cycleLogs = logs.
  filter((l) => {
    const d = atMidnight(l.log_date);
    return d.getTime() >= cycleStart.getTime() && d.getTime() <= today.getTime();
  }).
  sort((a, b) => atMidnight(a.log_date).getTime() - atMidnight(b.log_date).getTime());

  const build = (ovulation: Date, source: OvulationSource, confirmed: boolean): RefinedOvulation => ({
    ovulationDate: ovulation,
    fertileWindowStart: addDaysTo(ovulation, -5),
    fertileWindowEnd: addDaysTo(ovulation, 1),
    source,
    confirmed
  });

  // Ağlabatan pəncərə: tsiklin 6-cı günündən sonra gələn siqnallar
  // (period içi yanlış-pozitivləri kəsmək üçün)
  const plausible = (l: OvulationSignalLog) =>
  (atMidnight(l.log_date).getTime() - cycleStart.getTime()) / DAY_MS >= 6;

  // 1) peak OPK — ən güclü siqnal (ilk peak günü götürülür)
  const peak = cycleLogs.find((l) => l.ovulation_test === 'peak' && plausible(l));
  if (peak) return build(addDaysTo(atMidnight(peak.log_date), 1), 'opk_peak', true);

  // 2) positive OPK — ilk müsbət gün (LH yüksəlişinin başlanğıcı)
  const positive = cycleLogs.find((l) => l.ovulation_test === 'positive' && plausible(l));
  if (positive) return build(addDaysTo(atMidnight(positive.log_date), 1), 'opk_positive', true);

  // 3) Yumurta ağı maye — SON eggwhite günü (pik fertilliyin sonu ovulyasiyaya yaxındır)
  const eggwhites = cycleLogs.filter((l) => l.cervical_mucus === 'eggwhite' && plausible(l));
  if (eggwhites.length > 0) {
    const last = eggwhites[eggwhites.length - 1];
    return build(addDaysTo(atMidnight(last.log_date), 1), 'mucus', true);
  }

  // 4) Siqnal yoxdur → təqvim proqnozu
  return build(atMidnight(calendarOvulation), 'calendar', false);
}
