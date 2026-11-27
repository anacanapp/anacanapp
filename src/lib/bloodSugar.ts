/**
 * Blood sugar in pregnancy (gestational diabetes self-monitoring).
 * Targets follow ACOG / ADA / NICE style values: fasting < 95 mg/dL (5.3 mmol/L),
 * 1 hour after a meal < 140 mg/dL (7.8), 2 hours after a meal < 120 mg/dL (6.7).
 * Below 70 mg/dL (3.9 mmol/L) is a low reading (hypo).
 *
 * Values are always stored in mg/dL (blood_sugar_logs.reading_value, numeric(5,1)); mmol/L is a
 * per-device display/input preference only. 1 mmol/L = 18 mg/dL.
 */

export type GlucoseUnit = 'mgdl' | 'mmol';
export type GlucoseStatus = 'low' | 'normal' | 'high';

/** reading_type values. `after_meal` keeps its original meaning (2 hours after a meal). */
export const AFTER_MEAL_1H = 'after_meal_1h';
export const AFTER_MEAL_2H = 'after_meal';

export const MGDL_PER_MMOL = 18;
export const HYPO_MGDL = 70;
export const TARGETS_MGDL = { fasting: 95, after1h: 140, after2h: 120 } as const;

/** Upper target (exclusive) for a reading type, or null when no pregnancy target applies. */
export function targetFor(readingType: string): number | null {
  if (readingType === 'fasting') return TARGETS_MGDL.fasting;
  if (readingType === AFTER_MEAL_1H) return TARGETS_MGDL.after1h;
  if (readingType === AFTER_MEAL_2H) return TARGETS_MGDL.after2h;
  return null;
}

/**
 * low: below 70 mg/dL. high: at or above the target for fasting / after-meal readings; for
 * other types (before meal, bedtime, random) the fasting target is used for before-meal and
 * bedtime, and the 1 hour value (140) for random readings.
 */
export function glucoseStatus(mgdl: number, readingType: string): GlucoseStatus {
  if (!Number.isFinite(mgdl)) return 'normal';
  if (mgdl < HYPO_MGDL) return 'low';
  const target = targetFor(readingType)
    ?? (readingType === 'before_meal' || readingType === 'bedtime' ? TARGETS_MGDL.fasting : TARGETS_MGDL.after1h);
  return mgdl >= target ? 'high' : 'normal';
}

export const mmolToMgdl = (mmol: number) => Math.round(mmol * MGDL_PER_MMOL * 10) / 10;
export const mgdlToMmol = (mgdl: number) => Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10;

/** Input text in the chosen unit → mg/dL to store (null when not a plausible reading). */
export function parseGlucoseInput(text: string, unit: GlucoseUnit): number | null {
  const value = Number(String(text).trim().replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const mgdl = unit === 'mmol' ? mmolToMgdl(value) : Math.round(value * 10) / 10;
  return mgdl >= 10 && mgdl <= 900 ? mgdl : null;
}

/** Display a stored mg/dL value in the chosen unit (mg/dL whole number, mmol/L one decimal). */
export function formatGlucose(mgdl: number, unit: GlucoseUnit): string {
  if (unit === 'mmol') return mgdlToMmol(mgdl).toFixed(1);
  return String(Math.round(mgdl));
}

export const unitLabel = (unit: GlucoseUnit) => (unit === 'mmol' ? 'mmol/L' : 'mg/dL');

/** Threshold text in the chosen unit, e.g. "95 mg/dL" or "5.3 mmol/L". */
export const thresholdText = (mgdl: number, unit: GlucoseUnit) => `${formatGlucose(mgdl, unit)} ${unitLabel(unit)}`;

/**
 * "Repeated" high readings: at least 2 of the readings in the last 7 days (newest first input)
 * are at or above their target. Low readings are handled separately.
 */
export function hasRepeatedHighs(logs: { reading_value: number; reading_type: string; logged_at: string }[], now = new Date()): boolean {
  const since = now.getTime() - 7 * 86400_000;
  let highs = 0;
  for (const log of logs) {
    const at = new Date(log.logged_at).getTime();
    if (!(at >= since)) continue;
    if (glucoseStatus(Number(log.reading_value), log.reading_type) === 'high' && ++highs >= 2) return true;
  }
  return false;
}

const UNIT_KEY = 'anacan_glucose_unit';

/** Per-device unit preference (mg/dL by default). */
export function loadGlucoseUnit(): GlucoseUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'mmol' ? 'mmol' : 'mgdl';
  } catch {
    return 'mgdl';
  }
}

export function saveGlucoseUnit(unit: GlucoseUnit): void {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    /* storage unavailable: keep the in-memory choice */
  }
}
