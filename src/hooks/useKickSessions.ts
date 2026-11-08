import { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { usePartnerNotifications } from './usePartnerNotifications';
import { localDateKey, todayKey } from '@/lib/local-date';
import { kickSessionDayKey } from '@/lib/kickSession';

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
}

export const useKickSessions = () => {
  const [sessions, setSessions] = useState<KickSession[]>([]);
  const [todaySessions, setTodaySessions] = useState<KickSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
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
      const typedData = (data || []) as KickSession[];
      setSessions(typedData);
      
      // Today's sessions by the phone's local calendar day
      const today = todayKey();
      setTodaySessions(typedData.filter(s => kickSessionDayKey(s) === today));
    } catch (error: any) {
      console.error('Error fetching kick sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves ONE finished session. `startedAt` (epoch ms) gives the local session day;
   * callers must pass only this session's own count, never a running total.
   */
  const addSession = async (kickCount: number, durationSeconds: number, position?: 'left' | 'right' | null, startedAt?: number) => {
    if (!user) return null;
    const sessionDay = localDateKey(startedAt ? new Date(startedAt) : new Date());

    try {
      const { data, error } = await supabase
        .from('kick_sessions')
        .insert({
          user_id: user.id,
          kick_count: kickCount,
          duration_seconds: durationSeconds,
          session_date: sessionDay,
          ...(position ? { position } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: tr("usekicksessions_sessiya_yadda_saxlandi_241831", "Sessiya yadda saxlandı! 👶"),
        description: `${kickCount} ${tr("usekicksessions_tepik", "təpik")}, ${Math.floor(durationSeconds / 60)} ${tr("usekicksessions_deqiqe", "dəqiqə")}`,
      });

      // Total kicks today (local day) including the new session. The new row's id is
      // excluded in case realtime already merged it into state.
      const today = todayKey();
      const newId = (data as { id?: string } | null)?.id;
      const todayTotal = sessions
        .filter(s => s.id !== newId && kickSessionDayKey(s) === today)
        .reduce((sum, s) => sum + s.kick_count, 0) + (sessionDay === today ? kickCount : 0);

      // Notify partner when reaching 10 kicks (only once per local day)
      if (todayTotal >= 10 && !notifiedForTenKicks.current && readNotifiedDay() !== today) {
        notifiedForTenKicks.current = true;
        writeNotifiedDay(today);
        await notifyKickSession(todayTotal, durationSeconds);
      }

      await fetchSessions();
      return data;
    } catch (error: any) {
      console.error('Error adding kick session:', error);
      toast({
        title: tr("usekicksessions_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
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
