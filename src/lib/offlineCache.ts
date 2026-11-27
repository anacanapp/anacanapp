/**
 * Offline "son vəziyyət" cache-i (localStorage).
 * Məqsəd: şəbəkə olmayanda istifadəçi onboarding-ə atılmasın,
 * son uğurlu fetch-in nəticəsi göstərilsin.
 *
 * Qeyd: bu, təhlükəsizlik qatı DEYİL — yalnız UI davamlılığıdır.
 * Server tərəfdə RLS bütün real icazələri qoruyur.
 */

import { writeStorageCache } from './local-storage';
import { clearPersistedQueryCache } from './query-persist-policy';

const PREFIX = 'anacan_ocache_v1:';

interface CacheEnvelope<T> {
  userId: string;
  savedAt: number;
  data: T;
}

/** Yazma — user-ə bağlı açarla. */
export function writeCache<T>(key: string, userId: string, data: T): void {
  try {
    const envelope: CacheEnvelope<T> = { userId, savedAt: Date.now(), data };
    writeStorageCache(localStorage, PREFIX + key, JSON.stringify(envelope));
  } catch {
    /* dolu localStorage / private mode — sükutla keç */
  }
}

/**
 * Oxuma — yalnız eyni user üçün qaytarır (hesab dəyişəndə köhnə data sızmasın).
 * maxAgeMs keçibsə null (default 30 gün).
 */
export function readCache<T>(key: string, userId: string, maxAgeMs: number = 30 * 24 * 3600 * 1000): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (envelope.userId !== userId) return null;
    if (Date.now() - envelope.savedAt > maxAgeMs) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

/** Bir açarı sil. */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {/* boş */}
}

// Logout-da silinən, serverdən yenidən alına bilən şəxsi sağlamlıq cache-ləri (AI körpə analizi mətni).
// İlk yardım cache-i şəxsi deyil və offline lazımdır, ona toxunulmur; yalnız lokal saxlanan istifadəçi yazıları
// (məs. məktub/qeydlər) data itkisi olmasın deyə burada silinmir, onlar user id ilə açarlanıb.
const LOGOUT_CLEAR_PREFIXES = [PREFIX, 'anacan-baby-insight-v2:'];

/** Bütün offline cache-i sil (logout / hesab dəyişmə üçün), React Query persist cache-i də daxil olmaqla. */
export function clearAllCaches(): void {
  clearPersistedQueryCache();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && LOGOUT_CLEAR_PREFIXES.some((p) => k.startsWith(p))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {/* boş */}
}

/** Cihaz hazırda offline görünür? (heuristika) */
export function isLikelyOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
