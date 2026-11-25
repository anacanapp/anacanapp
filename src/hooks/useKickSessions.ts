import { useState, useEffect, useRef, useMemo } from 'react';
import { tr, formatTr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { usePartnerNotifications } from './usePartnerNotifications';
import { localDateKey, todayKey } from '@/lib/local-date';
import { kickSessionDayKey, kickLiveTimerState, type ActiveKickSession } from '@/lib/kickSession';
import { showToolLiveTimer, hideToolLiveTimer } from '@/lib/tool-live-timer';
import { pendingOutboxRows, retainOutboxUser, saveWithOutbox, subscribeOutbox } from '@/lib/offline-outbox';
import { queuedToast, saveFailedToast } from '@/lib/offline-outbox-copy';

// The partner "10 kicks" alert goes out once per local day; remembered across
// screen visits (the old in-memory flag reset on every mount).
const TEN_KICKS_NOTIFIED_KEY = 'anacan_kick_ten_notified_day';
const readNotifiedDay = () => { try { return localStorage.getItem(TEN_KICKS_NOTIFIED_KEY); } catch { return null; } };
const writeNotifiedDay = (day: string) => { try { localStorage.setItem(TEN_KICKS_NOTIFIED_KEY, day); } catch { /* ignore */ } };
export interface KickSession {
  id: string;
  user_id: string;
  kick_count: number;
  duration_seconds: number;
  session_date: string;
  created_at: string;
  /** İxtiyari mövqe etiketi — əkiz/üçüz hamiləlikdə ana ayıra bilirsə ('left'/'right'). Kimlik deyil, mövqedir. */
  position?: 'left' | 'right' | null;
  /** True while the session only exists in the offline outbox. */
  pending?: boolean;
}

export type AddKickSessionResult =
  | { status: 'saved'; data: KickSession }
  | { status: 'queued'; data: KickSession }
  | { status: 'error'; error: unknown };

/** Server sessions plus queued ones (marked pending), newest first; server rows win on the same id. */
export function mergePendingKickSessions(serverSessions: KickSession[], pendingRows: Record<string, unknown>[], userId: string): KickSession[] {
  const known = new Set(serverSessions.map((s) => s.id));
  const pending = pendingRows
    .filter((row) => typeof row.id === 'string' && !known.has(row.id) && row.user_id === userId)
    .map((row) => ({ ...row, created_at: (row.created_at as string | undefined) ?? new Date().toISOString(), pending: true }) as KickSession);
  if (pending.length === 0) return serverSessions;
  return [...pending, ...serverSessions].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Lock-screen live timer for a running kick session (iOS Live Activity / Android
 * ongoing notification, through the same native plugin as feeding/sleep timers):
 * "Hərəkət · {count}" plus a clock counting up from the stored session start.
 * The count updates on every tap; the timer goes away when the session stops or
 * is reset. Pass enabled=false until the user is known.
 */
export function useKickLiveTimer(session: ActiveKickSession | null, enabled = true) {
  const live = kickLiveTimerState(session);
  const startTime = live?.startTime ?? null;
  const count = live?.count ?? 0;
  useEffect(() => {
    if (!enabled) return;
    if (startTime == null) {
      void hideToolLiveTimer('kick');
      return;
    }
    void showToolLiveTimer('kick', {
      type: 'kick',
      label: formatTr('livetimer_kick_label', 'Hərəkət · {count}', { count }),
      subLabel: tr('livetimer_kick_sub', 'Hər hərəkətdə tətbiqdə toxunun'),
      startTime,
    });
  }, [startTime, count, enabled]);
}

export const useKickSessions = () => {
  const [serverSessions, setServerSessions] = useState<KickSession[]>([]);
  const [outboxVersion, setOutboxVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const sessions = useMemo(
    () => (userId ? mergePendingKickSessions(serverSessions, pendingOutboxRows(userId, 'kick_sessions'), userId) : serverSessions),
    // outboxVersion: re-read the persisted queue whenever it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverSessions, userId, outboxVersion],
  );
  // Today's sessions by the phone's local calendar day
  const todaySessions = useMemo(() => {
    const today = todayKey();
    return sessions.filter(s => kickSessionDayKey(s) === today);
  }, [sessions]);
  const { toast } = useToast();
  const { notifyKickSession } = usePartnerNotifications();
  const notifiedForTenKicks = useRef(false);
  const fetchSessions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('kick_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // DB sütununda CHECK məhdudiyyəti yoxdur (plain TEXT) — generasiya olunan
      // tip 'string' verir, KickSession.position isə 'left'|'right'|null literal
      // union-dur (bax yuxarı şərh) — cast təhlükəsizdir, addKickSession/insert
      // özü heç vaxt bu ikisindən başqa dəyər yazmır.
      setServerSessions((data || []) as KickSession[]);
    } catch (error) {
      console.error('Error fetching kick sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves ONE finished session. `startedAt` (epoch ms) gives the local session day;
   * callers must pass only this session's own count, never a running total.
   * The row is kept in the offline outbox until the server confirms it, so the
   * result is 'saved' (confirmed), 'queued' (will be sent when online) or
   * 'error' (real rejection: the caller keeps its state so the user can retry).
   * `quiet` suppresses only the success toast (the caller shows its own).
   */
  const addSession = async (
    kickCount: number,
    durationSeconds: number,
    position?: 'left' | 'right' | null,
    startedAt?: number,
    opts?: { quiet?: boolean },
  ): Promise<AddKickSessionResult | null> => {
    if (!user) return null;
    const sessionDay = localDateKey(startedAt ? new Date(startedAt) : new Date());

    const outcome = await saveWithOutbox(user.id, 'kick_sessions', {
      user_id: user.id,
      kick_count: kickCount,
      duration_seconds: durationSeconds,
      session_date: sessionDay,
      // The day grouping reads created_at, so a late (queued) upload keeps the real time.
      created_at: new Date().toISOString(),
      ...(position ? { position } : {}),
    });

    if (outcome.status === 'error') {
      const error = outcome.error as { message?: string } | null;
      console.error('Error adding kick session:', error);
      toast({ ...saveFailedToast(), ...(error?.message ? { description: error.message } : {}) });
      return { status: 'error', error: outcome.error };
    }
    if (outcome.status === 'queued') {
      toast(queuedToast());
      return { status: 'queued', data: outcome.data as unknown as KickSession };
    }

    const data = outcome.data as unknown as KickSession;
    setServerSessions((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
    if (!opts?.quiet) {
      toast({
        title: tr("usekicksessions_sessiya_yadda_saxlandi_241831", "Sessiya yadda saxlandı! 👶"),
        description: `${kickCount} ${tr("usekicksessions_tepik", "təpik")}, ${Math.floor(durationSeconds / 60)} ${tr("usekicksessions_deqiqe", "dəqiqə")}`,
      });
    }

    try {
      // Total kicks today (local day) including the new session. The new row's id is
      // excluded in case realtime already merged it into state.
      const today = todayKey();
      const newId = data?.id;
      const todayTotal = sessions
        .filter(s => s.id !== newId && kickSessionDayKey(s) === today)
        .reduce((sum, s) => sum + s.kick_count, 0) + (sessionDay === today ? kickCount : 0);

      // Notify partner when reaching 10 kicks (only once per local day)
      if (todayTotal >= 10 && !notifiedForTenKicks.current && readNotifiedDay() !== today) {
        notifiedForTenKicks.current = true;
        writeNotifiedDay(today);
        await notifyKickSession(todayTotal, durationSeconds);
      }
    } catch (error) {
      console.error('Kick partner notification failed:', error);
    }

    await fetchSessions();
    return { status: 'saved', data };
  };

  // Reset notification flag at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      notifiedForTenKicks.current = false;
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  const getTodayStats = () => {
    const totalKicks = todaySessions.reduce((sum, s) => sum + s.kick_count, 0);
    const totalDuration = todaySessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    return { totalKicks, totalDuration, sessionCount: todaySessions.length };
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  // Offline outbox: flush on mount/login, online and app resume; re-render when
  // the queue changes and refetch once queued sessions were delivered.
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeOutbox((event) => {
      if (event.userId !== userId) return;
      setOutboxVersion((v) => v + 1);
      if (event.sentTables.includes('kick_sessions')) void fetchSessions();
    });
    const release = retainOutboxUser(userId);
    return () => { unsubscribe(); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`kick_sessions_changes:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kick_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    sessions,
    todaySessions,
    loading,
    addSession,
    getTodayStats,
    refetch: fetchSessions,
  };
};
