import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bookOrderTotal, bookUnitPrice, nextBookTier } from './pricing';
import { BOOKS, bookAgeForMonths } from './catalog';

describe('printable book pricing', () => {
  it('lowers the price per book with the bundle size (4 → 2 AZN)', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 70].map(bookUnitPrice)).toEqual([4, 4, 3, 3, 2.6, 2.6, 2, 2]);
    expect([1, 3, 5, 10].map(bookOrderTotal)).toEqual([4, 9, 13, 20]);
  });
  it('nudges to the next cheaper tier', () => {
    expect(nextBookTier(1)).toEqual({ add: 2, unit: 3 });
    expect(nextBookTier(4)).toEqual({ add: 1, unit: 2.6 });
    expect(nextBookTier(10)).toBeNull();
  });
  it('is identical to the server copy', () => {
    const strip = (source: string) => source.split('\n').filter(line => !line.startsWith('//') && !line.startsWith('/**')).join('\n');
    const server = strip(readFileSync('supabase/functions/_shared/book-pricing.ts', 'utf8'));
    expect(strip(readFileSync('src/lib/books/pricing.ts', 'utf8')).startsWith(server.trimEnd())).toBe(true);
  });
});

describe('book catalog', () => {
  it('has 70 books, 10 per age group, each with a cover', () => {
    expect(BOOKS).toHaveLength(70);
    for (const age of ['6m', '1y', '2y', '3y', '4y', '5y', '6y']) expect(BOOKS.filter(book => book.age === age)).toHaveLength(10);
    for (const book of BOOKS) expect(() => readFileSync(`public/books/covers/${book.id}.webp`)).not.toThrow();
  });
  it('matches the age group to the child', () => {
    expect([3, 6, 11, 12, 30, 47, 70, 90].map(bookAgeForMonths)).toEqual([null, '6m', '6m', '1y', '2y', '3y', '5y', '6y']);
  });
});
