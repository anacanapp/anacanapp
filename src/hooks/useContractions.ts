import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { usePartnerNotifications } from './usePartnerNotifications';
import {
  computeContractionStats,
  mergeWithQueue,
  parseQueue,
  pruneQueue,
  type QueuedContraction,
} from '@/lib/laborUtils';

export interface Contraction {
  id: string;
  user_id: string;
  start_time: string;
  duration_seconds: number;
  /** Start-to-start seconds for new rows (older rows stored end-to-start rest). */
  interval_seconds: number | null;
  created_at: string;
  /** Saved on this device only, waiting to sync. */
  pending?: boolean;
}

// ------------------------------------------------------------
// Device storage (per user): the offline queue and the timer state. Both only
// hold this user's own contraction timings; nothing else is stored.
// ------------------------------------------------------------
const QUEUE_PREFIX = 'anacan_contraction_queue_v1';
const TIMER_PREFIX = 'anacan_contraction_timer_v1';

const readQueue = (uid: string) => {
  try { return parseQueue(localStorage.getItem(`${QUEUE_PREFIX}:${uid}`)); } catch { return []; }
};
const writeQueue = (uid: string, queue: QueuedContraction[]) => {
  try {
    if (queue.length) localStorage.setItem(`${QUEUE_PREFIX}:${uid}`, JSON.stringify(queue));
    else localStorage.removeItem(`${QUEUE_PREFIX}:${uid}`);
  } catch { /* storage blocked */ }
};

export interface ContractionTimerState {
  /** Epoch ms of the running contraction's start, or null when idle. */
  activeStart: number | null;
  /** Epoch ms of the previous contraction's start and end. */
  lastStart: number | null;
  lastEnd: number | null;
}

const EMPTY_TIMER: ContractionTimerState = { activeStart: null, lastStart: null, lastEnd: null };
const finiteOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function loadContractionTimerState(uid: string | null | undefined): ContractionTimerState {
  try {
    const raw = localStorage.getItem(`${TIMER_PREFIX}:${uid || 'anon'}`);
    if (!raw) return EMPTY_TIMER;
    const v = JSON.parse(raw) || {};
    const state = { activeStart: finiteOrNull(v.activeStart), lastStart: finiteOrNull(v.lastStart), lastEnd: finiteOrNull(v.lastEnd) };
    // A contraction "running" for over 30 minutes is a forgotten timer.
    if (state.activeStart != null && Date.now() - state.activeStart > 30 * 60 * 1000) state.activeStart = null;
    return state;
  } catch {
    return EMPTY_TIMER;
  }
}

export function saveContractionTimerState(uid: string | null | undefined, state: ContractionTimerState) {
  try { localStorage.setItem(`${TIMER_PREFIX}:${uid || 'anon'}`, JSON.stringify(state)); } catch { /* storage blocked */ }
}

const newClientId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  // RFC 4122 v4 fallback for older WebViews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const isDuplicateKey = (error: { code?: string } | null | undefined) => error?.code === '23505';

export const useContractions = () => {
  const [serverRows, setServerRows] = useState<Contraction[]>([]);
  const [queue, setQueue] = useState<QueuedContraction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyContractionStarted, notifyContraction511 } = usePartnerNotifications();
  const has511Notified = useRef(false);
  const syncing = useRef(false);

  const updateQueue = useCallback((uid: string, update: (q: QueuedContraction[]) => QueuedContraction[]) => {
    const next = update(readQueue(uid));
    writeQueue(uid, next);
    setQueue(next);
    return next;
  }, []);

  const fetchContractions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('contractions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      const rows = (data || []) as Contraction[];
      setServerRows(rows);
      // Anything already on the server leaves the local queue.
      updateQueue(user.id, (q) => pruneQueue(q, rows));
    } catch (error: unknown) {
      console.error('Error fetching contractions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, updateQueue]);

  /** Sends queued entries; the client id makes a retry idempotent. */
  const syncQueue = useCallback(async () => {
    if (!user || syncing.current || !isOnline()) return;
    const pending = readQueue(user.id);
    if (!pending.length) return;
    syncing.current = true;
    try {
      for (const entry of pending) {
        const { error } = await supabase.from('contractions').insert({ ...entry, user_id: user.id });
        if (error && !isDuplicateKey(error)) break; // still offline / failing: keep the rest queued
        updateQueue(user.id, (q) => q.filter((x) => x.id !== entry.id));
      }
    } finally {
      syncing.current = false;
    }
    await fetchContractions();
  }, [user, updateQueue, fetchContractions]);

  /**
   * Saves one contraction. It is queued on the device first, then inserted; when the
   * insert fails or the device is offline it stays queued, shows in the list and
   * syncs automatically later.
   */
  const addContraction = async (durationSeconds: number, intervalSeconds?: number | null, startedAt?: number) => {
    if (!user) return null;
    const start = startedAt ?? Date.now() - durationSeconds * 1000;
    const entry: QueuedContraction = {
      id: newClientId(),
      start_time: new Date(start).toISOString(),
      duration_seconds: Math.max(0, Math.round(durationSeconds)),
      interval_seconds: intervalSeconds ?? null,
    };
    updateQueue(user.id, (q) => [...q, entry]);

    const keptOnDevice = () => toast({
      title: tr('contraction_saved_offline_title', 'Bu cihazda saxlanıldı'),
      description: tr('contraction_saved_offline_desc', 'İnternet bərpa olunanda avtomatik sinxronlaşacaq.'),
    });

    if (!isOnline()) {
      keptOnDevice();
      return entry;
    }

    try {
      const { data, error } = await supabase
        .from('contractions')
        .insert({ ...entry, user_id: user.id })
        .select()
        .single();

      if (error && !isDuplicateKey(error)) throw error;
      updateQueue(user.id, (q) => q.filter((x) => x.id !== entry.id));

      // Notify partner about contraction
      notifyContractionStarted(entry.duration_seconds, entry.interval_seconds ?? undefined);

      await fetchContractions();
      return data ?? entry;
    } catch (error: unknown) {
      console.error('Error adding contraction (kept in local queue):', error);
      keptOnDevice();
      return entry;
    }
  };

  const contractions = useMemo<Contraction[]>(() => {
    const uid = user?.id ?? '';
    return mergeWithQueue(serverRows, queue).map((c) =>
      'pending' in c && c.pending
        ? { ...c, user_id: uid, created_at: c.start_time, pending: true }
        : (c as Contraction));
  }, [serverRows, queue, user?.id]);

  const stats = computeContractionStats(contractions);

  // Notify partner once when the 5-1-1 rule is met (not as a side effect of render).
  useEffect(() => {
    if (stats.is511 && !has511Notified.current) {
      has511Notified.current = true;
      notifyContraction511();
    }
  }, [stats.is511, notifyContraction511]);

  const getStats = () => stats;

  const clearAll = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('contractions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setServerRows([]);
      updateQueue(user.id, () => []);
      saveContractionTimerState(user.id, { ...loadContractionTimerState(user.id), lastStart: null, lastEnd: null });
      has511Notified.current = false;
      toast({
        title: tr("usecontractions_sancilar_silindi_535de3", "Sancılar silindi"),
        description: tr("usecontractions_butun_qeydler_silindi_1f1172", "Bütün qeydlər silindi."),
      });
    } catch (error: unknown) {
      console.error('Error clearing contractions:', error);
      toast({
        title: tr("usecontractions_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!user) return;
    setQueue(readQueue(user.id));
    void fetchContractions().then(() => syncQueue());
  }, [user, fetchContractions, syncQueue]);

  // Sync automatically when the device comes back online.
  useEffect(() => {
    if (!user) return;
    const onOnline = () => { void syncQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, syncQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`contractions_changes:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contractions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchContractions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchContractions]);

  return {
    contractions,
    loading,
    addContraction,
    getStats,
    clearAll,
    refetch: fetchContractions,
  };
};
