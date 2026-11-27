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

/**
 * Age group for the home carousel: the child's own group, or the youngest group (6+ ay) when there is no child or
 * the baby is younger than 5 months (the first books to get ready for).
 */
export function homeBookAge(months: number | null | undefined): BookAge {
  return bookAgeForMonths(months) ?? BOOK_AGES[0];
}

/** Books of one age group in catalogue order (10 per group). */
export const booksForAge = (age: BookAge, limit = 10): Book[] => BOOKS.filter(book => book.age === age).slice(0, limit);

/** Accent colours per age group, matched to the cover age badges. */
export const AGE_TINT: Record<BookAge, { bg: string; ink: string; bgDark: string; inkDark: string }> = {
  '6m': { bg: '#EFE6FF', ink: '#6B4BC8', bgDark: '#2C2540', inkDark: '#C7B6FF' },
  '1y': { bg: '#FFF0D6', ink: '#B86E00', bgDark: '#3A2E1A', inkDark: '#FFC56B' },
  '2y': { bg: '#FFE4EF', ink: '#C2185B', bgDark: '#3D2230', inkDark: '#FF9CC4' },
  '3y': { bg: '#DDF6F0', ink: '#0F7F6B', bgDark: '#1C3732', inkDark: '#7EDCC6' },
  '4y': { bg: '#FFE7E1', ink: '#D2452F', bgDark: '#3D2723', inkDark: '#FFA48F' },
  '5y': { bg: '#E3E8FF', ink: '#3A4FC0', bgDark: '#232A45', inkDark: '#A9B6FF' },
  '6y': { bg: '#FFE3E3', ink: '#C62F3A', bgDark: '#3E2326', inkDark: '#FF9AA1' },
};

/** CSS variables for an age tint; books.css picks the light or dark pair (.bk-tint-*). */
export const tintVars = (age: BookAge): Record<string, string> => {
  const t = AGE_TINT[age];
  return { '--tb': t.bg, '--ti': t.ink, '--tbd': t.bgDark, '--tid': t.inkDark, '--ts': t.ink };
};
