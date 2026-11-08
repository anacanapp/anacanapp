import { useCallback, useEffect, useRef, useState } from 'react';
import { localDateKey, prunePlanState, type PlanState } from '@/lib/sleep-training';
import {
  applyLocalChange, emptyStored, readLocalPlan, syncPlan, writeLocalPlan, type KeyValueStorage, type StoredPlan,
} from '@/lib/sleep-training-sync';

const storage = (): KeyValueStorage | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

/**
 * The sleep-training plan of one child: read from and written to the phone at once, synced with the account
 * copy (public.sleep_training_plans) in the background — after load, ~1.5 s after a change and when the phone
 * comes back online. Guests (no user) and a missing child stay local-only.
 */
export function useSleepTrainingPlan(userId: string | null, childId: string | null) {
  const owner = userId ?? 'guest';
  const [stored, setStored] = useState<StoredPlan>(emptyStored);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(stored);
  const scope = useRef(`${owner}:${childId}`);
  const syncing = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSync = !!userId && !!childId;

  const commit = useCallback((next: StoredPlan) => {
    ref.current = next;
    writeLocalPlan(storage(), owner, childId, next);
    setStored(next);
  }, [owner, childId]);

  const sync = useCallback(async () => {
    if (!canSync || !userId) return;
    if (syncing.current) { again.current = true; return; }
    syncing.current = true;
    const here = `${owner}:${childId}`;
    try {
      const snap = ref.current;
      const { state, ok } = await syncPlan({ userId, childId, local: snap, todayKey: localDateKey(new Date()) });
      if (!ok || scope.current !== here) return;
      // A change made while syncing stays (and stays dirty); the next round uploads it.
      if (ref.current === snap) commit(state); else again.current = true;
    } finally {
      syncing.current = false;
      if (again.current && scope.current === here) { again.current = false; void sync(); }
    }
  }, [canSync, userId, childId, owner, commit]);

  useEffect(() => {
    scope.current = `${owner}:${childId}`;
    again.current = false;
    const s = readLocalPlan(storage(), owner, childId, localDateKey(new Date()));
    ref.current = s;
    setStored(s);
    setLoaded(true);
  }, [owner, childId]);

  useEffect(() => { if (loaded) void sync(); }, [loaded, sync]);
  useEffect(() => {
    if (!canSync) return;
    const on = () => { void sync(); };
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('online', on);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sync, canSync]);

  /** Apply a change now (pruned to the last 30 days) and queue it for the account copy. */
  const update = useCallback((fn: (s: PlanState) => PlanState) => {
    const cur = ref.current;
    const next = applyLocalChange(cur, prunePlanState(fn(cur.plan), localDateKey(new Date())));
    if (next === cur) return;
    commit(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void sync(); }, 1500);
  }, [commit, sync]);

  return { state: stored.plan, loaded, update, pending: stored.dirty };
}
