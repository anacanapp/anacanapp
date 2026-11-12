import { describe, expect, it } from 'vitest';
import { FETAL_SIZE_BY_WEEK, HADLOCK_EFW, hadlockMedianG } from './fetal-size';
import { FRUIT_SIZES } from '@/types/anacan';
import { getFetalWeightBand, estimatePercentileForWeight } from './fetalGrowth';
import { FETAL_LENGTH_NOTE_LANGUAGES, formatFetalWeight } from './fetal-size-copy';
import { APP_LANGUAGES } from './app-languages';

const weeks = Object.keys(FETAL_SIZE_BY_WEEK).map(Number);

describe('fetal size reference', () => {
  it('covers weeks 4-42 with growing weight and length within each measurement', () => {
    expect(weeks).toEqual(Array.from({ length: 39 }, (_, i) => i + 4));
    for (let w = 5; w <= 42; w++) {
      const a = FETAL_SIZE_BY_WEEK[w - 1], b = FETAL_SIZE_BY_WEEK[w];
      expect(b.weightG, `weight ${w}`).toBeGreaterThanOrEqual(a.weightG);
      if (a.measure === b.measure) expect(b.lengthCm, `length ${w}`).toBeGreaterThan(a.lengthCm - 0.31);
      expect(b.measure).toBe(w < 20 ? 'crl' : 'crown-heel');
    }
  });

  it('uses the Hadlock 1991 median from 20 weeks; the printed table matches the equation', () => {
    for (let w = 20; w <= 40; w++) expect(FETAL_SIZE_BY_WEEK[w].weightG).toBe(Math.round(hadlockMedianG(w)));
    for (const [w, row] of Object.entries(HADLOCK_EFW)) expect(Math.abs(row[2] - hadlockMedianG(Number(w)))).toBeLessThanOrEqual(1.5);
    expect(FETAL_SIZE_BY_WEEK[40]).toMatchObject({ lengthCm: 51.2, weightG: 3619 });
  });

  it('matches the database values written by 20261112140000_hero_growth_data_fix (first day of the week)', () => {
    expect(FETAL_SIZE_BY_WEEK[20]).toMatchObject({ lengthCm: 25.6, weightG: 331, fruit: 'Banan' });
    expect(FETAL_SIZE_BY_WEEK[26]).toMatchObject({ lengthCm: 35.6, weightG: 913, fruit: 'Kabaçok' });
    expect(FETAL_SIZE_BY_WEEK[9]).toMatchObject({ lengthCm: 2.4, weightG: 2, fruit: 'Gilas' });
  });

  it('keeps the app fallback table and the ultrasound tool on the same source', () => {
    for (const w of weeks) expect(FRUIT_SIZES[w]).toMatchObject({ lengthCm: FETAL_SIZE_BY_WEEK[w].lengthCm, weightG: FETAL_SIZE_BY_WEEK[w].weightG });
    for (let w = 20; w <= 40; w++) expect(getFetalWeightBand(w).p50).toBe(HADLOCK_EFW[w][2]);
    // An exactly average baby reads as the 50th percentile (the old tool showed 63rd-91st).
    for (let w = 20; w <= 40; w++) expect(estimatePercentileForWeight(w, HADLOCK_EFW[w][2])).toBe(50);
  });

  it('has the length note in every app language and formats tiny weights', () => {
    for (const { code } of APP_LANGUAGES) expect(FETAL_LENGTH_NOTE_LANGUAGES, code).toContain(code);
    expect(formatFetalWeight(0.01)).toBe('<0.1');
    expect(formatFetalWeight(331)).toBe('331');
  });
});
