import { useCallback, useEffect, useRef, useState } from 'react';
import { readLocal, syncWeaning, writeLocal, type WeaningLocal } from '@/lib/weaning-sync';
import type { WeaningPlan } from '@/lib/weaning';

/**
 * Device-first weaning state: every change is applied and stored locally at once (optimistic, offline-safe)
 * and pushed to the server in the background; the 'online' event retries pending changes.
 */
export function useWeaningState(uid: string | null, childId: string | null) {
  const [state, setState] = useState<WeaningLocal>(() => readLocal(uid));
  const ref = useRef(state);
  const syncing = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  useEffect(() => { const s = readLocal(uid); ref.current = s; setState(s); }, [uid]);

  const commit = useCallback((next: WeaningLocal) => {
    ref.current = next;
    writeLocal(uid, next);
    setState(next);
  }, [uid]);

  const sync = useCallback(async () => {
    if (!uid) return;
    if (syncing.current) { again.current = true; return; }
    syncing.current = true;
    try {
      const snap = ref.current;
      const { state: res } = await syncWeaning(uid, childId, snap);
      const cur = ref.current;
      // Changes made while syncing stay; only the parts of the snapshot that were reconciled are applied.
      const syncedIds = new Set(res.checkins.filter((c) => c.synced).map((c) => c.id));
      const next: WeaningLocal = {
        ...cur,
        ...(cur.plan === snap.plan ? { plan: res.plan, planDirty: res.planDirty } : {}),
        checkins: cur.checkins.map((c) => (syncedIds.has(c.id) ? { ...c, synced: true } : c)),
      };
      commit(next);
    } finally {
      syncing.current = false;
      if (again.current) { again.current = false; void sync(); }
    }
  }, [uid, childId, commit]);

  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void sync(); }, 400);
  }, [sync]);

  useEffect(() => { void sync(); }, [sync]);
  useEffect(() => {
    const on = () => { setOnline(true); void sync(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); if (timer.current) clearTimeout(timer.current); };
  }, [sync]);

  /** Apply a change locally now and queue it for the server. */
  const update = useCallback((fn: (s: WeaningLocal) => WeaningLocal) => {
    commit(fn(ref.current));
    scheduleSync();
  }, [commit, scheduleSync]);

  /** Replace the plan (marks it for upload). */
  const setPlan = useCallback((plan: WeaningPlan | null) => update((s) => ({ ...s, plan, planDirty: !!plan })), [update]);

  const pending = !!(state.planDirty || state.checkins.some((c) => !c.synced));
  return { state, update, setPlan, online, pending };
}
