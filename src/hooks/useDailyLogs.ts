import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePartnerNotifications } from './usePartnerNotifications';
import { todayKey } from '@/lib/local-date';
import { retainOutboxUser, subscribeOutbox } from '@/lib/offline-outbox';
import { WATER_OUTBOX_TABLE, addWater, displayedWater } from '@/lib/water-intake';

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
  const [, setOutboxVersion] = useState(0);
  /** Bumped by every confirmed water total, so an older in-flight fetch cannot overwrite it. */
  const waterGeneration = useRef(0);
  const userId = user?.id ?? null;

  const fetchLogs = async () => {
    if (!user) return;
    const generation = waterGeneration.current;

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
      setTodayLog((previous) => {
        // A water tap was confirmed while this read was in flight: keep its newer total.
        if (generation !== waterGeneration.current && previous?.log_date === today) {
          return todayData ? { ...todayData, water_intake: previous.water_intake } : previous;
        }
        return todayData;
      });
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

  /**
   * Adds `amount` glasses to the phone's current local day as an atomic server delta (see
   * lib/water-intake). Shown at once (queued taps count), kept offline and replayed once.
   */
  const updateWaterIntake = async (amount: number) => {
    if (!user) return { data: null, error: 'No user logged in' };
    const day = todayKey();
    const outcome = await addWater(user.id, amount, {
      day,
      onServerTotal: (total, totalDay, applied) => {
        waterGeneration.current++;
        setTodayLog((previous) => previous?.log_date === totalDay
          ? { ...previous, water_intake: total }
          : { id: '', user_id: user.id, log_date: totalDay, mood: null, symptoms: null, water_intake: total,
              temperature: null, bleeding: null, notes: null, created_at: new Date().toISOString() });
        // Notify partner when water goal reached (8 glasses = 2000ml)
        if (applied && total >= 2000 && total - amount < 2000) notifyWaterGoal();
      },
    });
    if (outcome.status === 'error') {
      console.error('Error adding water:', outcome.error);
      return { data: null, error: outcome.error };
    }
    return { data: outcome.data, error: null };
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
  }, [user?.id]);

  // Offline outbox: flush queued water taps (mount, online, resume), re-render when the queue
  // changes, reload the day after a background flush delivered water.
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeOutbox((event) => {
      if (event.userId !== userId) return;
      setOutboxVersion((v) => v + 1);
      if (event.sentTables.includes(WATER_OUTBOX_TABLE)) void fetchLogs();
    });
    const release = retainOutboxUser(userId);
    return () => { unsubscribe(); release(); };
  }, [userId]);

  // "Today" is evaluated on every render: a row loaded before midnight is not today's row.
  const today = todayKey();
  const waterToday = displayedWater(userId, todayLog, today);
  const visibleTodayLog = todayLog?.log_date === today ? { ...todayLog, water_intake: waterToday } : null;

  return {
    logs,
    todayLog: visibleTodayLog,
    /** Glasses for the phone's current local day, including taps still queued offline. */
    waterToday,
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
