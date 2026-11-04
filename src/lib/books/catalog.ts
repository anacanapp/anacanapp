import catalog from '@/data/books/catalog.json';

export type BookAge = '6m' | '1y' | '2y' | '3y' | '4y' | '5y' | '6y';
export type BookTopic = 'numbers' | 'letters' | 'logic' | 'nature' | 'feelings' | 'habits' | 'art';
export interface Book { id: string; age: BookAge; topic: BookTopic; title: string; subtitle: string; about: string; skills: string[]; pages: number }

export const BOOKS = catalog as Book[];
export const BOOK_AGES: BookAge[] = ['6m', '1y', '2y', '3y', '4y', '5y', '6y'];
export const BOOK_TOPICS: BookTopic[] = ['numbers', 'letters', 'logic', 'nature', 'feelings', 'habits', 'art'];
const byId = new Map(BOOKS.map(book => [book.id, book]));
export const findBook = (id: string) => byId.get(id);
export const bookCover = (id: string) => `/books/covers/${id}.webp`;

/** Age group that fits a child of `months` (real age): 6–11 m → 6+ ay, 12–23 m → 1+ yaş … 72 m+ → 6+ yaş. */
export function bookAgeForMonths(months: number | null | undefined): BookAge | null {
  if (months == null || !Number.isFinite(months) || months < 5) return null;
  if (months < 12) return '6m';
  const years = Math.min(6, Math.floor(months / 12));
  return `${years}y` as BookAge;
}

/** Accent colours per age group, matched to the cover age badges. */
export const AGE_TINT: Record<BookAge, { bg: string; ink: string }> = {
  '6m': { bg: '#EFE6FF', ink: '#6B4BC8' },
  '1y': { bg: '#FFF0D6', ink: '#B86E00' },
  '2y': { bg: '#FFE4EF', ink: '#C2185B' },
  '3y': { bg: '#DDF6F0', ink: '#0F7F6B' },
  '4y': { bg: '#FFE7E1', ink: '#D2452F' },
  '5y': { bg: '#E3E8FF', ink: '#3A4FC0' },
  '6y': { bg: '#FFE3E3', ink: '#C62F3A' },
};
