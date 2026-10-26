import { EXPANDED_SERVER_COPY } from './expanded-copy.ts';

/** Generated, reviewed static copy only. User messages and identifiers do not
 * pass through this lookup; existing-language fallbacks retain their contract. */
export function serverCopy<T>(namespace: string, language: string, fallback: T): T {
  const copy = (EXPANDED_SERVER_COPY as Record<string, Record<string, unknown>>)[language]?.[namespace];
  return (copy ?? fallback) as T;
}
