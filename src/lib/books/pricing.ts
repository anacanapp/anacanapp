// Printable book bundle pricing (AZN). Kept identical to supabase/functions/_shared/book-pricing.ts (a test compares them).
// The more books in one order, the lower the price of every book in it.
export const BOOK_PRICE_TIERS = [
  { min: 10, unit: 2.0 },
  { min: 5, unit: 2.6 },
  { min: 3, unit: 3.0 },
  { min: 1, unit: 4.0 },
] as const;
export const BOOK_BASE_PRICE = 4.0;
export const MAX_BOOKS_PER_ORDER = 70;

export function bookUnitPrice(count: number): number {
  for (const tier of BOOK_PRICE_TIERS) if (count >= tier.min) return tier.unit;
  return BOOK_BASE_PRICE;
}
export function bookOrderTotal(count: number): number {
  return Math.round(bookUnitPrice(count) * count * 100) / 100;
}

/** Next tier that would lower the per-book price, for the "add N more" nudge. */
export function nextBookTier(count: number): { add: number; unit: number } | null {
  const better = [...BOOK_PRICE_TIERS].reverse().find(tier => tier.min > count && tier.unit < bookUnitPrice(count));
  return better ? { add: better.min - count, unit: better.unit } : null;
}
export const formatAzn = (value: number) => `${value.toFixed(2).replace('.', ',')} ₼`;
