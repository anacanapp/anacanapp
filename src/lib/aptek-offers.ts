// One rule table decides which Aptek products are offered where in the app.
// Infant formula is never offered proactively (WHO International Code of Marketing of
// Breast-milk Substitutes); it stays browsable in the store itself.
import type { AptekConfig } from '@/lib/aptek-pricing';

export type OfferContext = 'colic' | 'feed' | 'weaning' | 'cups' | 'newborn' | 'bag';

export interface OfferProduct {
  id: string;
  sku: string | null;
  kind: string | null;
  min_age_months: number | null;
  tags: string[];
  sales_count: number;
  price: number;
}

export interface OfferRule {
  /** Bundle offered next to the products, if any. */
  bundle?: string;
  pick: (products: OfferProduct[], babyMonths: number | null) => OfferProduct[];
}

const FORMULA_DISPENSER = '54692';
const isFormula = (p: OfferProduct) => p.tags.includes('infant_formula') || p.kind === 'food';
const fitsAge = (p: OfferProduct, months: number | null, slack = 0) =>
  p.min_age_months == null || months == null || p.min_age_months <= months + slack;
const anti = (p: OfferProduct) => (p.tags.includes('anti_colic') ? 1 : 0);

export const OFFER_RULES: Record<OfferContext, OfferRule> = {
  colic: {
    pick: (ps) => ps.filter((p) => p.tags.includes('anti_colic'))
      .sort((a, b) => (a.min_age_months ?? 0) - (b.min_age_months ?? 0) || b.sales_count - a.sales_count),
  },
  feed: {
    bundle: 'night',
    pick: (ps, m) => ps.filter((p) => (p.kind === 'bottles' && fitsAge(p, m, 1)) || p.sku === FORMULA_DISPENSER)
      .sort((a, b) => anti(b) - anti(a) || b.sales_count - a.sales_count),
  },
  weaning: {
    bundle: 'weaning',
    pick: (ps) => ps.filter((p) => (p.kind === 'bowls' || p.kind === 'cutlery') && (p.min_age_months == null || p.min_age_months <= 6))
      .sort((a, b) => (b.min_age_months ?? 0) - (a.min_age_months ?? 0) || b.sales_count - a.sales_count),
  },
  cups: {
    bundle: 'cups',
    pick: (ps, m) => ps.filter((p) => p.kind === 'cups' && fitsAge(p, m, 3))
      .sort((a, b) => (a.min_age_months ?? 0) - (b.min_age_months ?? 0)),
  },
  newborn: {
    bundle: 'newborn',
    pick: (ps) => ps.filter((p) => p.min_age_months === 0 || p.sku === FORMULA_DISPENSER).sort((a, b) => a.price - b.price),
  },
  bag: {
    bundle: 'newborn',
    pick: (ps) => ps.filter((p) => p.min_age_months === 0 || p.sku === FORMULA_DISPENSER).sort((a, b) => a.price - b.price),
  },
};

/** Products to offer for a context, or [] when that placement is switched off. */
export function offerProducts<T extends OfferProduct>(
  context: OfferContext, products: T[], config: Pick<AptekConfig, 'placements'> | null | undefined, babyMonths: number | null = null, limit = 8,
): T[] {
  if (!config || config.placements[context] === false) return [];
  const safe = products.filter((p) => !isFormula(p));
  return (OFFER_RULES[context].pick(safe, babyMonths) as T[]).slice(0, limit);
}

/** Context suggested by the mommy home for a baby of this age. */
export function homeOfferContext(stage: string | null | undefined, babyMonths: number | null): OfferContext | null {
  if (stage === 'bump') return 'newborn';
  if (stage !== 'mommy' || babyMonths == null) return null;
  if (babyMonths < 4) return 'colic';
  if (babyMonths < 6) return 'feed';
  if (babyMonths < 9) return 'weaning';
  return 'cups';
}
