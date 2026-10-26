import { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { usePartnerNotifications } from './usePartnerNotifications';
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
      
      // Filter today's sessions
      const today = new Date().toISOString().split('T')[0];
      setTodaySessions(typedData.filter(s => s.session_date === today));
    } catch (error: any) {
      console.error('Error fetching kick sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSession = async (kickCount: number, durationSeconds: number, position?: 'left' | 'right' | null) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('kick_sessions')
        .insert({
          user_id: user.id,
          kick_count: kickCount,
          duration_seconds: durationSeconds,
          ...(position ? { position } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: tr("usekicksessions_sessiya_yadda_saxlandi_241831", "Sessiya yadda saxlandı! 👶"),
        description: `${kickCount} ${tr("usekicksessions_tepik", "təpik")}, ${Math.floor(durationSeconds / 60)} ${tr("usekicksessions_deqiqe", "dəqiqə")}`,
      });

      // Calculate total kicks today including new session
      const today = new Date().toISOString().split('T')[0];
      const todayTotal = todaySessions.reduce((sum, s) => sum + s.kick_count, 0) + kickCount;
      
      // Notify partner when reaching 10 kicks (only once per day)
      if (todayTotal >= 10 && !notifiedForTenKicks.current) {
        notifiedForTenKicks.current = true;
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
