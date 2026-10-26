// localStorage-a yazılan React Query cache-i yalnız offline açılış üçün dəyərli,
// nisbətən sabit datadan ibarət olmalıdır. İcma lenti, çat, story və tez-tez
// sorğulanan (polled) nəticələr hər yazışda böyük JSON serializasiyası yaradır,
// zəif cihazlarda main thread-i bloklayır və offline açılışda onsuz da köhnə olur.

// Tam açar (queryKey[0]) üzrə istisnalar
const EXCLUDED_KEYS = new Set([
  'chat-media-v2', 'chat-media-v3', 'premium-access-v1', 'subscription', 'household-premium',
  'community-feed', 'community-ad-mine', 'community-profile-stats', 'community-connections',
  'group-posts', 'post-comments', 'single-post', 'stories', 'user-memberships',
]);

// Prefiks üzrə istisnalar (çat və story ailəsi)
const EXCLUDED_PREFIXES = ['chat-', 'story-'];

// Bu intervaldan tez-tez sorğulanan nəticələr persist edilmir
const POLL_PERSIST_LIMIT_MS = 60_000;

type PersistCandidate = {
  queryKey: readonly unknown[];
  state: { status: string };
  meta?: Record<string, unknown>;
  // refetchInterval observer seçimidir; runtime-da query.options-a birləşdirilir
  options?: object;
};

export function shouldPersistQuery(query: PersistCandidate): boolean {
  if (query.state.status !== 'success' || query.meta?.persist === false) return false;
  const head = query.queryKey[0];
  if (typeof head === 'string') {
    if (EXCLUDED_KEYS.has(head)) return false;
    for (const prefix of EXCLUDED_PREFIXES) if (head.startsWith(prefix)) return false;
  }
  const interval = (query.options as { refetchInterval?: unknown } | undefined)?.refetchInterval;
  if (typeof interval === 'function' || (typeof interval === 'number' && interval > 0 && interval <= POLL_PERSIST_LIMIT_MS)) return false;
  // Admin/AdMob dataları saxlanmır — JSON.stringify əvəzinə yalnız string hissələr yoxlanılır
  for (const part of query.queryKey) {
    if (typeof part !== 'string') continue;
    const lower = part.toLowerCase();
    if (lower.includes('admin') || lower.includes('admob')) return false;
  }
  return true;
}
