import { isValidHeightCm } from '@/lib/pregnancyWeightBmi';

/**
 * Mother's height for the pregnancy weight tracker. It lives in profiles.height_cm
 * (supabase/migrations/20261108120000_market_reports_and_height.sql) with a device copy as fallback.
 * The profile from AuthContext is read with select('*'), so the column is "available" exactly when the
 * loaded profile row carries the height_cm key; before the migration nothing is sent to the server.
 * A height that exists only on the device is uploaded once (a per-user flag records the upload).
 */

export const heightStorageKey = (userId: string | undefined | null) => `anacan:weight-tracker:height-cm:${userId ?? 'anon'}`;
export const heightSyncedKey = (userId: string | undefined | null) => `anacan:weight-tracker:height-cm-synced:${userId ?? 'anon'}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): StorageLike | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

const asHeight = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const h = typeof value === 'number' ? value : Number(value);
  return isValidHeightCm(h) ? h : null;
};

export function readLocalHeight(userId: string | undefined | null, storage: StorageLike | null = store()): number | null {
  try { return asHeight(storage?.getItem(heightStorageKey(userId))); } catch { return null; }
}

export function writeLocalHeight(userId: string | undefined | null, h: number, storage: StorageLike | null = store()) {
  try { storage?.setItem(heightStorageKey(userId), String(h)); } catch { /* used for this session only */ }
}

export function isHeightSynced(userId: string | undefined | null, storage: StorageLike | null = store()): boolean {
  try { return storage?.getItem(heightSyncedKey(userId)) === '1'; } catch { return false; }
}

export function markHeightSynced(userId: string | undefined | null, storage: StorageLike | null = store()) {
  try { storage?.setItem(heightSyncedKey(userId), '1'); } catch { /* retried next time */ }
}

/** True when the loaded profile row has the height_cm column (migration applied). */
export const profileHasHeightColumn = (profile: object | null | undefined): boolean =>
  !!profile && Object.prototype.hasOwnProperty.call(profile, 'height_cm');

export interface HeightPlan {
  /** Height to use for the BMI range. */
  height: number | null;
  /** Server value to copy onto the device. */
  writeLocal: number | null;
  /** Device value to upload once. */
  upload: number | null;
}

/** The profile value wins; otherwise the device copy, uploaded once when the column exists and is empty. */
export function planHeight(profile: object | null | undefined, local: number | null, synced: boolean): HeightPlan {
  const available = profileHasHeightColumn(profile);
  const remote = available ? asHeight((profile as { height_cm?: unknown }).height_cm) : null;
  if (remote != null) return { height: remote, writeLocal: remote !== local ? remote : null, upload: null };
  const dev = asHeight(local);
  if (dev == null) return { height: null, writeLocal: null, upload: null };
  return { height: dev, writeLocal: null, upload: available && !synced ? dev : null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any };

/** Saves profiles.height_cm; false (quietly) when the column is missing, offline or refused. */
export async function saveProfileHeight(client: Client, userId: string | undefined | null, h: number): Promise<boolean> {
  if (!userId || !isValidHeightCm(h)) return false;
  try {
    const { error } = await client.from('profiles').update({ height_cm: h }).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
