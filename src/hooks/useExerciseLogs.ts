import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { todayKey, localDateKey } from '@/lib/local-date';
import { retainOutboxUser, saveWithOutbox, subscribeOutbox } from '@/lib/offline-outbox';

export interface ExerciseLog {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  duration_minutes: number;
  calories_burned: number;
  completed_at: string;
}

export const useExerciseLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;
    
    try {
      const today = todayKey();
      
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const allLogs = data || [];
      setLogs(allLogs);
      
      // Filter today's logs
      const todaysLogs = allLogs.filter(log => 
        localDateKey(new Date(log.completed_at)) === today
      );
      setTodayLogs(todaysLogs);
    } catch (error) {
      console.error('Error fetching exercise logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLog = async (exerciseId: string, exerciseName: string, durationMinutes: number, caloriesBurned: number) => {
    if (!user) return;

    // Queued in the offline outbox first (client UUID id, idempotent replay): offline or a
    // timeout keeps it and syncs later instead of losing the completed exercise.
    const outcome = await saveWithOutbox(user.id, 'exercise_logs', {
      user_id: user.id,
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      duration_minutes: durationMinutes,
      calories_burned: caloriesBurned,
      completed_at: new Date().toISOString(),
    });
    if (outcome.status === 'error') {
      console.error('Error adding exercise log:', outcome.error);
      return;
    }
    const saved = outcome.data as unknown as ExerciseLog;
    setLogs(prev => [saved, ...prev.filter(l => l.id !== saved.id)]);
    setTodayLogs(prev => [saved, ...prev.filter(l => l.id !== saved.id)]);
    if (outcome.status === 'saved') void fetchLogs();
  };

  const isCompletedToday = (exerciseId: string) => {
    return todayLogs.some(log => log.exercise_id === exerciseId);
  };

  const getTodayStats = () => {
    const totalCalories = todayLogs.reduce((sum, log) => sum + log.calories_burned, 0);
    const totalMinutes = todayLogs.reduce((sum, log) => sum + log.duration_minutes, 0);
    return {
      completedCount: todayLogs.length,
      totalCalories,
      totalMinutes,
    };
  };

  // Calculate streak
  const getStreak = () => {
    if (logs.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if there's a log today
    const hasToday = logs.some(log => {
      const logDate = new Date(log.completed_at);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === today.getTime();
    });
    
    if (hasToday) streak = 1;
    
    // Check previous days
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);
      
      const hasLog = logs.some(log => {
        const logDate = new Date(log.completed_at);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === checkDate.getTime();
      });
      
      if (hasLog) {
        if (streak === 0 && i === 1) streak = 1;
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  // Offline outbox: flush queued exercise logs (mount, online, app resume) and
  // refetch once a background flush delivered them.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const unsubscribe = subscribeOutbox((event) => {
      if (event.userId === uid && event.sentTables.includes('exercise_logs')) void fetchLogs();
    });
    const release = retainOutboxUser(uid);
    return () => { unsubscribe(); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    logs,
    todayLogs,
    loading,
    addLog,
    isCompletedToday,
    getTodayStats,
    getStreak,
    refetch: fetchLogs,
  };
};
