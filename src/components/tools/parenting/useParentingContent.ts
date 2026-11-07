import { useCallback, useEffect, useState } from 'react';
import { hasParentingContent, loadParentingContent, peekParentingContent } from '@/data/parenting';
import type { ParentingContent } from '@/data/parenting/types';

/**
 * Tərbiyə content for a language (bundled chunk + published overrides), loaded lazily.
 * `loading` is true until the first load finishes; content already loaded in this session renders at once.
 */
export function useParentingContent(language: string | null | undefined, enabled = true) {
  const lang = String(language || '');
  const available = enabled && hasParentingContent(lang);
  const [state, setState] = useState<{ lang: string; content: ParentingContent | null; failed: boolean }>(
    () => ({ lang, content: available ? peekParentingContent(lang) : null, failed: false }),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    loadParentingContent(lang)
      .then((content) => {
        if (alive) setState((prev) => (prev.lang === lang && prev.content === content && !prev.failed ? prev : { lang, content, failed: !content }));
      })
      .catch(() => { if (alive) setState({ lang, content: null, failed: true }); });
    return () => { alive = false; };
  }, [lang, available, attempt]);

  const failed = state.lang === lang && state.failed;
  const content = available && state.lang === lang ? state.content ?? peekParentingContent(lang) : available ? peekParentingContent(lang) : null;
  const retry = useCallback(() => { setState({ lang, content: null, failed: false }); setAttempt((n) => n + 1); }, [lang]);
  return { content, loading: available && !content && !failed, failed, retry };
}
