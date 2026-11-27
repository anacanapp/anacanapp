// ============================================================
// epdsScoring.ts: pure EPDS (Edinburgh Postnatal Depression Scale) scoring.
// Question 10 asks about thoughts of self-harm. Any answer above 0 on it is a
// safety signal on its own: it must lead to the urgent help result whatever
// the total score is (a total of 9 with Q10 = 3 is NOT "normal").
// ============================================================

export type EPDSRiskLevel = 'low' | 'moderate' | 'high';

/** EPDS item number of the self-harm question ("The thought of harming myself has occurred to me"). */
export const EPDS_SELF_HARM_QUESTION = 10;

export interface EPDSScore {
  totalScore: number;
  riskLevel: EPDSRiskLevel;
  /** True when question 10 was answered above 0. Always forces riskLevel 'high'. */
  selfHarm: boolean;
}

type Answers = Record<string | number, number> | null | undefined;

const toScore = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Score of the self-harm item (0 when unanswered). Answers are keyed by question number. */
export function epdsSelfHarmScore(answers: Answers): number {
  if (!answers) return 0;
  return toScore((answers as Record<string, unknown>)[String(EPDS_SELF_HARM_QUESTION)]);
}

/** True when the self-harm item (question 10) was answered above 0. */
export function hasEPDSSelfHarm(answers: Answers): boolean {
  return epdsSelfHarmScore(answers) > 0;
}

/**
 * Total + risk band (existing thresholds: 13+ high, 10-12 moderate) plus a
 * separate self-harm flag. A self-harm answer always lifts the band to 'high'
 * so stored assessments and any reader of risk_level treat it as urgent.
 */
export function scoreEPDS(answers: Answers): EPDSScore {
  const values = answers ? Object.values(answers) : [];
  const totalScore = values.reduce<number>((sum, v) => sum + toScore(v), 0);
  const selfHarm = hasEPDSSelfHarm(answers);
  let riskLevel: EPDSRiskLevel = 'low';
  if (selfHarm || totalScore >= 13) riskLevel = 'high';
  else if (totalScore >= 10) riskLevel = 'moderate';
  return { totalScore, riskLevel, selfHarm };
}
