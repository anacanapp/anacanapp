import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
      const today = new Date().toISOString().split('T')[0];
      
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
        log.completed_at.startsWith(today)
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

    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .insert({
          user_id: user.id,
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          duration_minutes: durationMinutes,
          calories_burned: caloriesBurned,
        })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setLogs(prev => [data, ...prev]);
        setTodayLogs(prev => [data, ...prev]);
      }
    } catch (error) {
      console.error('Error adding exercise log:', error);
    }
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
