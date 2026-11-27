import type { LifeStage } from '@/types/anacan';

/**
 * Which kind of weight tracking a user gets. Only a pregnancy shows week-based gain ranges, the IOM chart and
 * the pre-eclampsia danger strip; cycle tracking is plain weight/BMI, after birth it is postpartum tracking.
 * The pregnancy week is never invented: an unknown week hides every week-dependent range.
 */
export type WeightTrackerMode = 'pregnancy' | 'cycle' | 'postpartum';

export interface WeightTrackerStage {
  mode: WeightTrackerMode;
  /** Current pregnancy week, only in pregnancy mode and only when known (> 0). */
  week: number | null;
  trimester: 1 | 2 | 3 | null;
  /** IOM gain range, its progress bar and the week chart are shown only for a known pregnancy week. */
  showGainRange: boolean;
  /** "Call now: sudden swelling, severe headache, vision changes" (pre-eclampsia) belongs to pregnancy only. */
  showPregnancySafety: boolean;
}

export function resolveWeightTrackerStage(lifeStage: LifeStage | null | undefined, pregnancyWeek: number | null | undefined): WeightTrackerStage {
  if (lifeStage === 'bump') {
    const week = typeof pregnancyWeek === 'number' && Number.isFinite(pregnancyWeek) && pregnancyWeek > 0 ? Math.min(Math.floor(pregnancyWeek), 42) : null;
    const trimester = week == null ? null : week <= 12 ? 1 : week <= 26 ? 2 : 3;
    return { mode: 'pregnancy', week, trimester, showGainRange: week != null, showPregnancySafety: true };
  }
  return { mode: lifeStage === 'mommy' ? 'postpartum' : 'cycle', week: null, trimester: null, showGainRange: false, showPregnancySafety: false };
}

export type WeightTrend = 'up' | 'down' | 'stable';

/** Direction of the latest change against the start weight; within ±0.5 kg counts as stable. */
export function weightTrend(totalChange: number): WeightTrend {
  if (!Number.isFinite(totalChange) || Math.abs(totalChange) < 0.5) return 'stable';
  return totalChange > 0 ? 'up' : 'down';
}

export interface WeightPromptInput {
  stage: WeightTrackerStage;
  startWeight: number;
  currentWeight: number;
  change: number;
  statusText: string;
  recommended?: { min: number; max: number } | null;
  bmi?: number | null;
}

/** Translated prompt words, passed in so this stays a pure function (tr() lives in the component). */
export interface WeightPromptCopy {
  prefix: string;
  week: string;
  start: string;
  now: string;
  gain: string;
  change: string;
  rec: string;
  status: string;
  rules: string;
  contextPregnancyUnknownWeek: string;
  contextCycle: string;
  contextPostpartum: string;
}

const kg = (value: number) => `${Math.round(value * 10) / 10}kg`;

/** The AI weight analysis prompt for the user's real stage: no pregnancy week or gain range outside pregnancy. */
export function buildWeightAiPrompt(input: WeightPromptInput, copy: WeightPromptCopy): string {
  const { stage } = input;
  const parts: string[] = [copy.prefix];
  if (stage.mode === 'pregnancy' && stage.week != null) parts.push(`${stage.week} ${copy.week},`);
  else if (stage.mode === 'pregnancy') parts.push(copy.contextPregnancyUnknownWeek);
  else parts.push(stage.mode === 'postpartum' ? copy.contextPostpartum : copy.contextCycle);
  parts.push(`${copy.start} ${kg(input.startWeight)}, ${copy.now} ${kg(input.currentWeight)},`);
  if (stage.showGainRange && input.recommended) {
    parts.push(`${copy.gain} ${kg(input.change)} (${copy.rec} ${input.recommended.min}-${input.recommended.max}kg).`);
  } else {
    parts.push(`${copy.change} ${input.change >= 0 ? '+' : ''}${kg(input.change)}.`);
  }
  if (stage.mode !== 'pregnancy' && input.bmi != null) parts.push(`BMI: ${input.bmi}.`);
  parts.push(`${copy.status} ${input.statusText}.`, copy.rules);
  return parts.join(' ');
}
