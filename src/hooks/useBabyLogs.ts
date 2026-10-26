import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useChildren } from './useChildren';

export interface BabyLog {
  id: string;
  user_id: string;
  child_id: string | null;
  log_type: 'feeding' | 'sleep' | 'diaper';
  start_time: string;
  end_time: string | null;
  feed_type: string | null;
  diaper_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface FeedingHistoryItem {
  id: string;
  feedType: 'left' | 'right' | 'formula' | 'solid';
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
  date: string;
  notes: string | null;
}

// Modul-səviyyəli PAYLAŞILAN realtime kanal — bir neçə komponent (MommyDashboard,
// FloatingTimerWidget, FeedingHistoryPanel, QuickStatsWidget, AIChatScreen) eyni anda
// bu hook-u çağıra bilər. Ref-sayğac təmin edir ki, YALNIZ son mount olunmuş instansiya
// real `removeChannel` edir — əvvəlki kimi istənilən instansiyanın unmount-u qalan
// bacıları/qardaşları "yetim" qoymur.
// Shared realtime channels keyed by user id, so an account switch builds a
// channel filtered to the new user instead of reusing the first user's one.
interface BabyLogsSharedEntry {
  channel: ReturnType<typeof supabase.channel>;
  subscribers: Map<symbol, () => void>;
}
const babyLogsSharedChannels = new Map<string, BabyLogsSharedEntry>();

// ~7 instansiya eyni anda mount olur; hər realtime hadisəsində eyni 7 günlük sorğu
// 7 dəfə gedirdi. Eyni istifadəçi+uşaq üçün davam edən sorğu paylaşılır.
const inflightBabyLogs = new Map<string, Promise<{ data: BabyLog[] | null; error: unknown }>>();
// Yazışdan sonra köhnə (yazışdan əvvəl başlamış) sorğu paylaşılmasın
let babyLogsGeneration = 0;
function loadRecentBabyLogs(userId: string, childId: string | null) {
  const key = `${userId}:${childId ?? ''}:${babyLogsGeneration}`;
  const pending = inflightBabyLogs.get(key);
  if (pending) return pending;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  let query = supabase
    .from('baby_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', sevenDaysAgo.toISOString())
    .order('start_time', { ascending: false });
  if (childId) query = query.eq('child_id', childId);
  const request = Promise.resolve(query)
    .then(({ data, error }) => ({ data: data as BabyLog[] | null, error }))
    .finally(() => inflightBabyLogs.delete(key));
  inflightBabyLogs.set(key, request);
  return request;
}

export const useBabyLogs = () => {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const [logs, setLogs] = useState<BabyLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<BabyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Son 7 günün qeydləri (seçilmiş uşaq varsa, ona görə filtrlənir)
      const { data, error } = await loadRecentBabyLogs(user.id, selectedChild?.id ?? null);

      if (error) throw error;
      
      setLogs((data || []) as BabyLog[]);
      
      // Filter today's logs using local timezone
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayData = (data || []).filter(log => {
        const logDate = new Date(log.start_time);
        const logLocal = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
        return logLocal === localToday;
      }) as BabyLog[];
      setTodayLogs(todayData);
    } catch (error) {
      console.error('Error fetching baby logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedChild]);

  const addLog = async (log: {
    log_type: 'feeding' | 'sleep' | 'diaper';
    start_time?: string;
    end_time?: string | null;
    feed_type?: string | null;
    diaper_type?: string | null;
    notes?: string | null;
    /** Açıq child_id (widget-dən dayandırma kimi hallarda) — verilməzsə selectedChild işlənir.
     *  DÜZƏLİŞ: əvvəllər bunu ötürmək mümkün deyildi və təzə mount olunmuş closure-larda
     *  selectedChild hələ null olduğu üçün qeyd child_id=NULL ilə yazılır, UI-da isə
     *  child_id filtri onu heç vaxt göstərmirdi ("qeyd yoxa çıxır" bug-ı). */
    child_id?: string | null;
  }) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { child_id: explicitChildId, ...rest } = log;
      const { data, error } = await supabase
        .from('baby_logs')
        .insert({
          ...rest,
          user_id: user.id,
          child_id: explicitChildId !== undefined ? explicitChildId : (selectedChild?.id || null),
          start_time: log.start_time || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      babyLogsGeneration++;
      await fetchLogs();
      return { data, error: null };
    } catch (error) {
      console.error('Error adding baby log:', error);
      return { data: null, error };
    }
  };

  const updateLog = async (id: string, updates: {
    start_time?: string;
    end_time?: string | null;
    feed_type?: string | null;
    diaper_type?: string | null;
    notes?: string | null;
  }) => {
    if (!user) return { error: 'No user logged in' };
    try {
      const { error } = await supabase
        .from('baby_logs')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      babyLogsGeneration++;
      await fetchLogs();
      return { error: null };
    } catch (error) {
      console.error('Error updating baby log:', error);
      return { error };
    }
  };

  const deleteLog = async (id: string) => {
    if (!user) return { error: 'No user logged in' };
    try {
      const { error } = await supabase
        .from('baby_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      babyLogsGeneration++;
      await fetchLogs();
      return { error: null };
    } catch (error) {
      console.error('Error deleting baby log:', error);
      return { error };
    }
  };

  // Get feeding history for last N days
  const getFeedingHistory = useCallback((days: number = 3): Map<string, FeedingHistoryItem[]> => {
    const feedingLogs = logs.filter(l => l.log_type === 'feeding');
    const historyMap = new Map<string, FeedingHistoryItem[]>();
    
    // Get date strings for last N days
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Initialize map with empty arrays
    dates.forEach(date => historyMap.set(date, []));
    
    feedingLogs.forEach(log => {
      const dateStr = log.start_time.split('T')[0];
      if (!dates.includes(dateStr)) return;
      
      const startTime = new Date(log.start_time);
      const endTime = log.end_time ? new Date(log.end_time) : null;
      const durationSeconds = endTime 
        ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;
      
      // Normalize feed type
      let feedType: 'left' | 'right' | 'formula' | 'solid' = 'left';
      if (log.feed_type === 'breast_left' || log.feed_type === 'left') {
        feedType = 'left';
      } else if (log.feed_type === 'breast_right' || log.feed_type === 'right') {
        feedType = 'right';
      } else if (log.feed_type === 'formula') {
        feedType = 'formula';
      } else if (log.feed_type === 'solid') {
        feedType = 'solid';
      }
      
      const existingItems = historyMap.get(dateStr) || [];
      existingItems.push({
        id: log.id,
        feedType,
        startTime,
        endTime,
        durationSeconds,
        date: dateStr,
        notes: log.notes,
      });
      historyMap.set(dateStr, existingItems);
    });
    
    return historyMap;
  }, [logs]);

  // Get today's feeding stats with detailed breakdown
  const getTodayFeedingBreakdown = useMemo(() => {
    const feedingLogs = todayLogs.filter(l => l.log_type === 'feeding');
    
    let leftCount = 0;
    let rightCount = 0;
    let leftTotalSeconds = 0;
    let rightTotalSeconds = 0;
    let formulaCount = 0;
    let solidCount = 0;
    
    feedingLogs.forEach(log => {
      const startTime = new Date(log.start_time);
      const endTime = log.end_time ? new Date(log.end_time) : null;
      const durationSeconds = endTime 
        ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;
      
      if (log.feed_type === 'breast_left' || log.feed_type === 'left') {
        leftCount++;
        leftTotalSeconds += durationSeconds;
      } else if (log.feed_type === 'breast_right' || log.feed_type === 'right') {
        rightCount++;
        rightTotalSeconds += durationSeconds;
      } else if (log.feed_type === 'formula') {
        formulaCount++;
      } else if (log.feed_type === 'solid') {
        solidCount++;
      }
    });
    
    return {
      leftCount,
      rightCount,
      leftTotalSeconds,
      rightTotalSeconds,
      formulaCount,
      solidCount,
      totalBreastFeedings: leftCount + rightCount,
      totalBreastSeconds: leftTotalSeconds + rightTotalSeconds,
    };
  }, [todayLogs]);

  const getTodayStats = useCallback(() => {
    const feedingLogs = todayLogs.filter(l => l.log_type === 'feeding');
    const sleepLogs = todayLogs.filter(l => l.log_type === 'sleep');
    const diaperLogs = todayLogs.filter(l => l.log_type === 'diaper');

    // Calculate total sleep time
    let totalSleepMinutes = 0;
    sleepLogs.forEach(log => {
      if (log.end_time) {
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        totalSleepMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
      }
    });

    // Count feeding by type - support both old and new format
    const breastFeedingCount = feedingLogs.filter(l => 
      l.feed_type === 'breast_left' || l.feed_type === 'breast_right' || 
      l.feed_type === 'left' || l.feed_type === 'right'
    ).length;
    const formulaCount = feedingLogs.filter(l => l.feed_type === 'formula').length;
    const solidCount = feedingLogs.filter(l => l.feed_type === 'solid').length;

    // Count diaper by type
    const wetCount = diaperLogs.filter(l => l.diaper_type === 'wet').length;
    const dirtyCount = diaperLogs.filter(l => l.diaper_type === 'dirty').length;
    const bothCount = diaperLogs.filter(l => l.diaper_type === 'mixed').length;

    return {
      feedingCount: feedingLogs.length,
      breastFeedingCount,
      formulaCount,
      solidCount,
      sleepHours: Math.round(totalSleepMinutes / 60 * 10) / 10,
      sleepMinutes: Math.round(totalSleepMinutes),
      diaperCount: diaperLogs.length,
      wetCount,
      dirtyCount,
      bothCount,
      lastFeeding: feedingLogs[0] || null,
      lastSleep: sleepLogs[0] || null,
      lastDiaper: diaperLogs[0] || null,
      feedingLogs,
      sleepLogs,
      diaperLogs,
    };
  }, [todayLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime abunəliyi — REF-SAYĞACLI PAYLAŞILAN kanal (bax fayl sonundakı modul-səviyyəli
  // dəyişənlər). Bu hook eyni zamanda bir neçə komponentdə mount olunur (MommyDashboard,
  // FloatingTimerWidget — qlobal, FeedingHistoryPanel, QuickStatsWidget, AIChatScreen).
  // ƏVVƏLKİ BUG: hər instansiya öz `supabase.channel('baby_logs_changes')` çağırırdı —
  // Supabase JS eyni topic üçün TƏK obyekt qaytarsa da (join təkrarlanmır), HƏR HANSI BİR
  // instansiyanın unmount təmizləməsi (`removeChannel`) HAMISI üçün server-side abunəliyi
  // ÖLDÜRÜRDÜ — nəticədə, məs. Home-dan çıxıb-girəndə qlobal FloatingTimerWidget artıq
  // canlı yeniləmə almırdı. İndi YALNIZ son mount olunmuş instansiya real təmizləmə edir.
  const realtimeUserId = user?.id ?? null;
  useEffect(() => {
    if (!realtimeUserId) return;

    const token = Symbol('baby-logs-subscriber');
    let entry = babyLogsSharedChannels.get(realtimeUserId);
    if (!entry) {
      const subscribers = new Map<symbol, () => void>();
      const channel = supabase
        .channel(`baby_logs_changes:${realtimeUserId}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'baby_logs',
            filter: `user_id=eq.${realtimeUserId}`
          },
          () => {
            subscribers.forEach((cb) => cb());
          }
        )
        .subscribe();
      entry = { channel, subscribers };
      babyLogsSharedChannels.set(realtimeUserId, entry);
    }
    entry.subscribers.set(token, fetchLogs);

    return () => {
      const current = babyLogsSharedChannels.get(realtimeUserId);
      if (!current) return;
      current.subscribers.delete(token);
      if (current.subscribers.size === 0) {
        babyLogsSharedChannels.delete(realtimeUserId);
        supabase.removeChannel(current.channel);
      }
    };
  }, [realtimeUserId, fetchLogs]);

  return {
    logs,
    todayLogs,
    loading,
    addLog,
    updateLog,
    deleteLog,
    getTodayStats,
    getFeedingHistory,
    getTodayFeedingBreakdown,
    refetch: fetchLogs
  };
};
