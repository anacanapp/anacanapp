import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { getContentTranslationsVersion, subscribeContentTranslations } from './content-i18n';
import { readAppLanguage } from './app-languages';

type Subscribe = (listener: () => void) => () => void;

/** Rows mapped inside a queryFn keep their en/ru fallback in the (persisted) cache.
 * When a content shard they waited for arrives, refetch the active queries keyed by
 * the current language, coalesced so a burst of shards costs one refetch. */
export function installContentTranslationRefresh(client: Pick<QueryClient, 'invalidateQueries'>,
  { subscribe = subscribeContentTranslations as Subscribe, language = readAppLanguage, delayMs = 300 } = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const current = language();
      void client.invalidateQueries({ predicate: query => Array.isArray(query.queryKey) && query.queryKey.includes(current) });
    }, delayMs);
  });
  return () => { clearTimeout(timer); unsubscribe(); };
}

/** Re-render subscriber for rows translated during render. */
export function useContentTranslationsVersion(): number {
  return useSyncExternalStore(subscribeContentTranslations, getContentTranslationsVersion, getContentTranslationsVersion);
}
