import { useEffect, useState } from 'react';
import { hasParentingContent, loadParentingTips, peekParentingTips, type ParentingHomeContent } from '@/data/parenting';

/**
 * The Ana home card's content: daily tips + programmes of the app language (small chunk + published overrides),
 * never the whole content chunk. Null until loaded or when the language has no content.
 */
export function useParentingTips(language: string | null | undefined, enabled = true): ParentingHomeContent | null {
  const lang = String(language || '');
  const available = enabled && hasParentingContent(lang);
  const [state, setState] = useState<{ lang: string; content: ParentingHomeContent | null }>(
    () => ({ lang, content: available ? peekParentingTips(lang) : null }),
  );

  useEffect(() => {
    if (!available) return;
    let alive = true;
    loadParentingTips(lang)
      .then((content) => { if (alive) setState((prev) => (prev.lang === lang && prev.content === content ? prev : { lang, content })); })
      .catch(() => { /* a failed chunk shows no card; the next app open tries again */ });
    return () => { alive = false; };
  }, [lang, available]);

  if (!available) return null;
  return state.lang === lang ? state.content ?? peekParentingTips(lang) : peekParentingTips(lang);
}
