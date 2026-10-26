import { describe, expect, it } from 'vitest';
import { homeOfferContext, offerProducts, OFFER_RULES, type OfferContext, type OfferProduct } from './aptek-offers';

const p = (id: string, over: Partial<OfferProduct> = {}): OfferProduct => ({
  id, sku: id, kind: 'bottles', min_age_months: null, tags: [], sales_count: 0, price: 10, ...over,
});
const catalogue: OfferProduct[] = [
  p('anti0', { tags: ['anti_colic'], min_age_months: 0, sales_count: 5 }),
  p('anti3', { tags: ['anti_colic'], min_age_months: 3 }),
  p('bottle12', { min_age_months: 12 }),
  p('formula', { kind: 'food', tags: ['infant_formula'], min_age_months: 0 }),
  p('54692', { kind: 'appliances' }),
  p('bowl', { kind: 'bowls', min_age_months: 6 }),
  p('spoon', { kind: 'cutlery', min_age_months: 6 }),
  p('cup9', { kind: 'cups', min_age_months: 9 }),
  p('cup12', { kind: 'cups', min_age_months: 12 }),
];
const on = { placements: {} as Record<string, boolean> };

describe('offerProducts', () => {
  it('never offers infant formula in any context', () => {
    for (const ctx of Object.keys(OFFER_RULES) as OfferContext[]) {
      expect(offerProducts(ctx, catalogue, on, 0).map((x) => x.id)).not.toContain('formula');
    }
  });

  it('respects the per-placement switch and a missing config', () => {
    expect(offerProducts('colic', catalogue, { placements: { colic: false } })).toEqual([]);
    expect(offerProducts('colic', catalogue, null)).toEqual([]);
  });

  it('filters by age: feeding bottles fit the baby, cups allow a 3-month look-ahead', () => {
    expect(offerProducts('feed', catalogue, on, 2).map((x) => x.id)).toEqual(['anti0', 'anti3', '54692']);
    expect(offerProducts('cups', catalogue, on, 6).map((x) => x.id)).toEqual(['cup9']);
  });

  it('colic picks anti-colic products youngest first', () => {
    expect(offerProducts('colic', catalogue, on).map((x) => x.id)).toEqual(['anti0', 'anti3']);
  });
});

describe('homeOfferContext', () => {
  it('maps stage and baby age to a context', () => {
    expect(homeOfferContext('bump', null)).toBe('newborn');
    expect(homeOfferContext('mommy', 1)).toBe('colic');
    expect(homeOfferContext('mommy', 5)).toBe('feed');
    expect(homeOfferContext('mommy', 7)).toBe('weaning');
    expect(homeOfferContext('mommy', 11)).toBe('cups');
    expect(homeOfferContext('flow', null)).toBeNull();
  });
});
