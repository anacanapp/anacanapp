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

// Həssas sağlamlıq nəticələri (ruhi sağlamlıq/EPDS, əhval, təzyiq, qan şəkəri, xəstəlik, sağlamlıq/HealthKit
// datası, həkim hesabatı) heç vaxt localStorage-a yazılmır: cihaz paylaşılanda və ya hesab dəyişəndə orada
// qalmasın. Onlayn olduqda hər açılışda serverdən yenidən çəkilir.
export const SENSITIVE_HEALTH_KEYS: ReadonlySet<string> = new Set([
  'epds-assessments', 'mood-checkins', 'mood-checkin-today', 'partner-recent-moods', 'postpartum-checkins',
  'bp-logs', 'blood-sugar-logs',
  'illness-entries', 'illness-episodes',
  'health-daily', 'health-workouts', 'health-report-v2', 'doctor-report-extras-v1',
]);

// Prefiks üzrə istisnalar (çat və story ailəsi)
const EXCLUDED_PREFIXES = ['chat-', 'story-'];

/** localStorage açarı (App.tsx persister-i ilə eyni olmalıdır). */
export const PERSISTED_QUERY_CACHE_KEY = 'anacan-rq-cache';

// Logout/hesab dəyişmə anı. Bu andan əvvəl yüklənmiş (köhnə hesabın) nəticələri yaddaşda qalsa da yenidən
// persist edilmir; yalnız sonra çəkilən data yazılır.
let clearedAt = 0;

/** Persist olunmuş sorğu cache-ini silir və köhnə yaddaş datasının yenidən yazılmasının qarşısını alır. */
export function clearPersistedQueryCache(storage?: Pick<Storage, 'removeItem'> | null, now: number = Date.now()): void {
  clearedAt = Math.max(clearedAt, now);
  try {
    (storage ?? (typeof localStorage !== 'undefined' ? localStorage : null))?.removeItem(PERSISTED_QUERY_CACHE_KEY);
  } catch { /* private mode / bloklanmış storage */ }
}

/** Testlər üçün. */
export function resetPersistClearMarkForTests(): void { clearedAt = 0; }

// Bu intervaldan tez-tez sorğulanan nəticələr persist edilmir
const POLL_PERSIST_LIMIT_MS = 60_000;

type PersistCandidate = {
  queryKey: readonly unknown[];
  state: { status: string; dataUpdatedAt?: number };
  meta?: Record<string, unknown>;
  // refetchInterval observer seçimidir; runtime-da query.options-a birləşdirilir
  options?: object;
};

export function shouldPersistQuery(query: PersistCandidate): boolean {
  if (query.state.status !== 'success' || query.meta?.persist === false) return false;
  if (clearedAt && (query.state.dataUpdatedAt ?? 0) <= clearedAt) return false;
  const head = query.queryKey[0];
  if (typeof head === 'string') {
    if (EXCLUDED_KEYS.has(head) || SENSITIVE_HEALTH_KEYS.has(head)) return false;
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
