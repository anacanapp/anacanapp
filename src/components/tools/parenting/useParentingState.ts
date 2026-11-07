import { useCallback, useEffect, useRef, useState } from 'react';
import { readParenting, writeParenting, type ParentingLocal } from '@/lib/parenting';
import { mergeParenting, syncParenting } from '@/lib/parenting-sync';

/**
 * Tərbiyə state per account (programme progress, quiz results, bookmarks, chosen age band): every change is
 * applied and stored on the phone at once and merged with the account copy (public.parenting_state) in the
 * background; the 'online' event retries. `sync: false` reads the device copy only (dashboard teaser).
 */
export function useParentingState(uid: string | null, opts: { sync?: boolean } = {}) {
  const doSync = opts.sync !== false;
  const [state, setState] = useState<ParentingLocal>(() => readParenting(uid));
  const ref = useRef(state);
  const syncing = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  useEffect(() => { const s = readParenting(uid); ref.current = s; setState(s); }, [uid]);

  const commit = useCallback((next: ParentingLocal) => {
    ref.current = next;
    writeParenting(uid, next);
    setState(next);
  }, [uid]);

  const sync = useCallback(async () => {
    if (!uid || !doSync) return;
    if (syncing.current) { again.current = true; return; }
    syncing.current = true;
    try {
      const snap = ref.current;
      const { state: res, ok } = await syncParenting(uid, snap);
      if (!ok) return;
      const cur = ref.current;
      // Changes made while syncing stay (and stay dirty); the merge is idempotent.
      commit(cur === snap ? res : { ...mergeParenting(cur, res), dirty: true });
      if (cur !== snap) again.current = true;
    } finally {
      syncing.current = false;
      if (again.current) { again.current = false; void sync(); }
    }
  }, [uid, doSync, commit]);

  useEffect(() => { void sync(); }, [sync]);
  useEffect(() => {
    if (!doSync) return;
    const on = () => { setOnline(true); void sync(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sync, doSync]);

  /** Apply a change locally now and queue it for the account copy. */
  const update = useCallback((fn: (s: ParentingLocal) => ParentingLocal) => {
    commit({ ...fn(ref.current), dirty: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void sync(); }, 800);
  }, [commit, sync]);

  /** Device-only change (reminder preference): stored, not marked for upload. */
  const updateLocal = useCallback((fn: (s: ParentingLocal) => ParentingLocal) => { commit(fn(ref.current)); }, [commit]);

  return { state, update, updateLocal, online, pending: !!state.dirty };
}
