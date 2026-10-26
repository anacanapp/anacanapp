import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePartnerNotifications } from './usePartnerNotifications';

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
      
      // Check for today's log
      const today = new Date().toISOString().split('T')[0];
      const todayData = data?.find(log => log.log_date === today) || null;
      setTodayLog(todayData);
    } catch (error) {
      console.error('Error fetching daily logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLog = async (log: Omit<DailyLog, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .upsert({
          ...log,
          user_id: user.id,
          log_date: log.log_date || new Date().toISOString().split('T')[0]
        }, {
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
    const today = new Date().toISOString().split('T')[0];
    const currentIntake = todayLog?.water_intake || 0;
    const newIntake = currentIntake + amount;
    
    const result = await addLog({
      log_date: today,
      water_intake: newIntake,
      mood: todayLog?.mood || null,
      symptoms: todayLog?.symptoms || null,
      temperature: todayLog?.temperature || null,
      bleeding: todayLog?.bleeding || null,
      notes: todayLog?.notes || null
    });

    // Notify partner when water goal reached (8 glasses = 2000ml)
    if (newIntake >= 2000 && currentIntake < 2000) {
      notifyWaterGoal();
    }

    return result;
  };

  const updateMood = useCallback(async (mood: number) => {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await addLog({
      log_date: today,
      mood,
      water_intake: todayLog?.water_intake || 0,
      symptoms: todayLog?.symptoms || null,
      temperature: todayLog?.temperature || null,
      bleeding: todayLog?.bleeding || null,
      notes: todayLog?.notes || null
    });

    // Notify partner about mood update
    if (result.data) {
      notifyMoodUpdate(mood);
    }

    return result;
  }, [todayLog, addLog, notifyMoodUpdate]);

  const updateSymptoms = async (symptoms: string[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    return addLog({
      log_date: today,
      symptoms,
      mood: todayLog?.mood || null,
      water_intake: todayLog?.water_intake || 0,
      temperature: todayLog?.temperature || null,
      bleeding: todayLog?.bleeding || null,
      notes: todayLog?.notes || null
    });
  };

  /** Qanaxma/ləkələnmə qeydi (bump: hamiləlik dövründə ləkələnmə, mommy: doğuşdan sonra lokia izləmə) */
  const updateBleeding = async (bleeding: 'light' | 'medium' | 'heavy' | 'spotting' | null) => {
    const today = new Date().toISOString().split('T')[0];

    return addLog({
      log_date: today,
      bleeding,
      mood: todayLog?.mood || null,
      water_intake: todayLog?.water_intake || 0,
      symptoms: todayLog?.symptoms || null,
      temperature: todayLog?.temperature || null,
      notes: todayLog?.notes || null
    });
  };

  /** Ananın öz yuxusunu qeyd et (Mommy/Bump — Flow-da bunun ekvivalenti flow_daily_logs-dadır) */
  const updateSleep = async (sleepHours: number, sleepQuality: number | null) => {
    const today = new Date().toISOString().split('T')[0];

    return addLog({
      log_date: today,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      mood: todayLog?.mood || null,
      water_intake: todayLog?.water_intake || 0,
      symptoms: todayLog?.symptoms || null,
      temperature: todayLog?.temperature || null,
      bleeding: todayLog?.bleeding || null,
      notes: todayLog?.notes || null
    });
  };

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
