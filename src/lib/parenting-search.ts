/**
 * Tərbiyə search: diacritic-insensitive matching over article titles / summaries / tags, SOS titles / moments /
 * tags and programme titles / summaries. Azerbaijani letters fold to plain Latin (ə→e, ı→i, ö→o, ü→u, ş→s,
 * ç→c, ğ→g; İ/I → i), so "usaq yatmir" finds "uşaq yatmır". Every query word must match (prefix of a word or
 * substring); title hits rank first.
 */
import type { Article, ParentingContent, Programme, SosCard } from '@/data/parenting/types';

/** Lower-case, strip diacritics and fold Azerbaijani letters; punctuation becomes a space. */
export function foldText(text: string | null | undefined): string {
  return String(text || '')
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"«»„'’`´.,;:!?()[\]{}…/\\|—–_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const foldWords = (text: string | null | undefined) => foldText(text).split(' ').filter(Boolean);

export interface SearchHit<T> { item: T; score: number }
export interface ParentingSearchResults {
  sos: SearchHit<SosCard>[];
  articles: SearchHit<Article>[];
  programmes: SearchHit<Programme>[];
  total: number;
}

const MIN_QUERY = 2;

/** Score one item: 0 when a query word is missing anywhere; title > tags > body. */
function scoreFields(words: string[], title: string, tags: string[] | undefined, body: string[]): number {
  const t = foldText(title);
  const g = foldText((tags || []).join(' '));
  const b = foldText(body.join(' '));
  let score = 0;
  for (const w of words) {
    const inWord = (hay: string) => hay.split(' ').some((x) => x.startsWith(w));
    if (inWord(t)) score += 6;
    else if (t.includes(w)) score += 4;
    else if (inWord(g) || g.includes(w)) score += 3;
    else if (inWord(b)) score += 2;
    else if (b.includes(w)) score += 1;
    else return 0;
  }
  return score;
}

const rank = <T,>(hits: SearchHit<T>[]) => hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score);

/** Grouped results (SOS, articles, programmes); empty below 2 characters. */
export function searchParenting(content: ParentingContent, query: string): ParentingSearchResults {
  const words = foldWords(query);
  if (foldText(query).length < MIN_QUERY || !words.length) return { sos: [], articles: [], programmes: [], total: 0 };
  const sos = rank(content.sos.map((item) => ({ item, score: scoreFields(words, item.title, item.tags, [item.moment]) })));
  const articles = rank(content.articles.map((item) => ({ item, score: scoreFields(words, item.title, item.tags, [item.summary]) })));
  const programmes = rank(content.programmes.map((item) => ({ item, score: scoreFields(words, item.title, item.tags, [item.summary]) })));
  return { sos, articles, programmes, total: sos.length + articles.length + programmes.length };
}
