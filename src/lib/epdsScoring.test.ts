import { describe, it, expect } from 'vitest';
import { scoreEPDS, hasEPDSSelfHarm, epdsSelfHarmScore } from './epdsScoring';

const answers = (values: number[]) =>
  Object.fromEntries(values.map((v, i) => [String(i + 1), v])) as Record<string, number>;

describe('scoreEPDS', () => {
  it('total 9 with Q10 = 3 is high risk with the self-harm flag (was "normal")', () => {
    const r = scoreEPDS(answers([1, 1, 1, 1, 1, 1, 0, 0, 0, 3]));
    expect(r.totalScore).toBe(9);
    expect(r.selfHarm).toBe(true);
    expect(r.riskLevel).toBe('high');
  });

  it('any Q10 answer above 0 sets the flag, even with an otherwise zero total', () => {
    const r = scoreEPDS(answers([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]));
    expect(r.totalScore).toBe(1);
    expect(r.selfHarm).toBe(true);
    expect(r.riskLevel).toBe('high');
  });

  it('keeps the existing bands when Q10 is 0', () => {
    expect(scoreEPDS(answers([1, 1, 1, 1, 1, 1, 1, 1, 0, 0]))).toEqual({ totalScore: 8, riskLevel: 'low', selfHarm: false });
    expect(scoreEPDS(answers([2, 2, 2, 2, 2, 0, 0, 0, 0, 0]))).toEqual({ totalScore: 10, riskLevel: 'moderate', selfHarm: false });
    expect(scoreEPDS(answers([2, 2, 2, 2, 2, 3, 0, 0, 0, 0]))).toEqual({ totalScore: 13, riskLevel: 'high', selfHarm: false });
  });

  it('accepts numeric keys and tolerates missing / bad input', () => {
    expect(hasEPDSSelfHarm({ 10: 2 } as Record<number, number>)).toBe(true);
    expect(epdsSelfHarmScore(null)).toBe(0);
    expect(scoreEPDS(undefined)).toEqual({ totalScore: 0, riskLevel: 'low', selfHarm: false });
    expect(hasEPDSSelfHarm({ '10': 0 })).toBe(false);
  });
});
