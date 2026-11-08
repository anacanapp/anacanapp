import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePartnerNotifications } from './usePartnerNotifications';
import { todayKey } from '@/lib/local-date';

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  mood: number | null;
  symptoms: string[] | null;
  water_intake: number | null;
  temperature: number | null;
  bleeding: string | null;
  notes: string | null;
  created_at: string;
  /** Ananın öz yuxu müddəti (saat) — supabase/duzelis/Duzelis11.sql ilə əlavə olunub */
  sleep_hours?: number | null;
  /** Ananın öz yuxu keyfiyyəti (1-5) — flow_daily_logs.sleep_quality ilə eyni miqyas */
  sleep_quality?: number | null;
}

/** Fields a caller may write for one day. Only the keys present are saved; the rest of the row is kept. */
export type DailyLogPatch = Partial<Omit<DailyLog, 'id' | 'user_id' | 'created_at'>>;

/**
 * Row for the `daily_logs` upsert (on user_id,log_date). PostgREST merge-duplicates updates only the columns in the
 * payload, so leaving a field out keeps what is already stored for that day (water from the home screen, sleep,
 * symptoms and notes from the diary). Undefined values are dropped; an explicit null still clears a field.
 * `log_date` defaults to the phone's local day, so 00:00-04:00 in Baku is not saved on yesterday.
 */
export function dailyLogUpsertRow(userId: string, patch: DailyLogPatch, today: string = todayKey()): DailyLogPatch & { user_id: string; log_date: string } {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) row[key] = value;
  return { ...(row as DailyLogPatch), user_id: userId, log_date: patch.log_date || today };
}

export const useDailyLogs = () => {
  const { user } = useAuth();
  const { notifyMoodUpdate, notifyWaterGoal } = usePartnerNotifications();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      setLogs(data || []);
      
      // Check for today's log (local calendar day)
      const today = todayKey();
      const todayData = data?.find(log => log.log_date === today) || null;
      setTodayLog(todayData);
    } catch (error) {
      console.error('Error fetching daily logs:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Saves only the given fields for the day (see dailyLogUpsertRow); other columns of an existing row are kept. */
  const addLog = async (log: DailyLogPatch) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .upsert(dailyLogUpsertRow(user.id, log), {
          onConflict: 'user_id,log_date'
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchLogs();
      return { data, error: null };
    } catch (error) {
      console.error('Error adding daily log:', error);
      return { data: null, error };
    }
  };

  const updateWaterIntake = async (amount: number) => {
    const currentIntake = todayLog?.water_intake || 0;
    const newIntake = currentIntake + amount;
    
    const result = await addLog({ log_date: todayKey(), water_intake: newIntake });

    // Notify partner when water goal reached (8 glasses = 2000ml)
    if (newIntake >= 2000 && currentIntake < 2000) {
      notifyWaterGoal();
    }

    return result;
  };

  const updateMood = useCallback(async (mood: number) => {
    const result = await addLog({ log_date: todayKey(), mood });

    // Notify partner about mood update
    if (result.data) {
      notifyMoodUpdate(mood);
    }

    return result;
  }, [addLog, notifyMoodUpdate]);

  const updateSymptoms = async (symptoms: string[]) => addLog({ log_date: todayKey(), symptoms });

  /** Qanaxma/ləkələnmə qeydi (bump: hamiləlik dövründə ləkələnmə, mommy: doğuşdan sonra lokia izləmə) */
  const updateBleeding = async (bleeding: 'light' | 'medium' | 'heavy' | 'spotting' | null) =>
    addLog({ log_date: todayKey(), bleeding });

  /** Ananın öz yuxusunu qeyd et (Mommy/Bump — Flow-da bunun ekvivalenti flow_daily_logs-dadır) */
  const updateSleep = async (sleepHours: number, sleepQuality: number | null) =>
    addLog({ log_date: todayKey(), sleep_hours: sleepHours, sleep_quality: sleepQuality });

  useEffect(() => {
    fetchLogs();
  }, [user]);

  return {
    logs,
    todayLog,
    loading,
    addLog,
    updateWaterIntake,
    updateMood,
    updateSymptoms,
    updateSleep,
    updateBleeding,
    refetch: fetchLogs
  };
};
