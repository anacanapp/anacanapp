import { normalizeAppLanguage } from '@/lib/app-languages';
import type { FeedLang } from '@/lib/langDetect';

/** Selected UI language is the discovery filter. Country no longer adds other
 * languages. Keep this signature for callers of the previous priority helper. */
export function defaultFeedLanguages(_countryCode: string | null | undefined, uiLang: string): FeedLang[] {
  return [normalizeAppLanguage(uiLang)];
}

/** Unknown post metadata is not silently treated as Azerbaijani. */
export function matchesFeedLanguage(post: { language?: string | null }, language: string): boolean {
  return post.language === normalizeAppLanguage(language);
}
