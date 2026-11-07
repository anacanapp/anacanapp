import { describe, expect, it } from 'vitest';
import { BOOK_AGES, bookAgeForMonths, booksForAge, homeBookAge } from './catalog';

describe('home carousel age group', () => {
  it.each([
    [null, '6m'], [undefined, '6m'], [0, '6m'], [4, '6m'], [5, '6m'], [11, '6m'],
    [12, '1y'], [23, '1y'], [24, '2y'], [36, '3y'], [48, '4y'], [60, '5y'], [71, '5y'], [72, '6y'], [150, '6y'],
  ])('%s months → %s', (months, age) => {
    expect(homeBookAge(months as number | null | undefined)).toBe(age);
  });

  it('keeps the old card rule for real ages (null under 5 months)', () => {
    expect(bookAgeForMonths(4)).toBeNull();
    expect(bookAgeForMonths(5)).toBe('6m');
  });

  it('has 10 books for each of the 7 groups', () => {
    expect(BOOK_AGES).toHaveLength(7);
    for (const age of BOOK_AGES) {
      const books = booksForAge(age);
      expect(books).toHaveLength(10);
      expect(books.every((book) => book.age === age)).toBe(true);
    }
  });
});
