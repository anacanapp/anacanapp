import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MealLog {
  id: string;
  user_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  portion: string | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

export const useMealLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      setLogs((data as MealLog[]) || []);
      
      // Filter today's logs using local timezone
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayData = (data || []).filter(log => {
        const logDate = new Date(log.logged_at);
        const logLocal = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
        return logLocal === localToday;
      }) as MealLog[];
      setTodayLogs(todayData);
    } catch (error) {
      console.error('Error fetching meal logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addMealLog = async (log: {
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    food_name: string;
    calories: number;
    portion?: string;
    notes?: string;
  }) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .insert({
          ...log,
          user_id: user.id,
          logged_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchLogs();
      return { data: data as MealLog, error: null };
    } catch (error) {
      console.error('Error adding meal log:', error);
      return { data: null, error };
    }
  };

  const deleteMealLog = async (id: string) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await fetchLogs();
      return { error: null };
    } catch (error) {
      console.error('Error deleting meal log:', error);
      return { error };
    }
  };

  const getTodayStats = useCallback(() => {
    const totalCalories = todayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
    const mealCounts = {
      breakfast: todayLogs.filter(l => l.meal_type === 'breakfast').length,
      lunch: todayLogs.filter(l => l.meal_type === 'lunch').length,
      dinner: todayLogs.filter(l => l.meal_type === 'dinner').length,
      snack: todayLogs.filter(l => l.meal_type === 'snack').length,
    };
    const mealCalories = {
      breakfast: todayLogs.filter(l => l.meal_type === 'breakfast').reduce((sum, l) => sum + l.calories, 0),
      lunch: todayLogs.filter(l => l.meal_type === 'lunch').reduce((sum, l) => sum + l.calories, 0),
      dinner: todayLogs.filter(l => l.meal_type === 'dinner').reduce((sum, l) => sum + l.calories, 0),
      snack: todayLogs.filter(l => l.meal_type === 'snack').reduce((sum, l) => sum + l.calories, 0),
    };

    return {
      totalCalories,
      mealCounts,
      mealCalories,
      totalMeals: todayLogs.length,
    };
  }, [todayLogs]);

  const getMealsByType = useCallback((mealType: string) => {
    return todayLogs.filter(log => log.meal_type === mealType);
  }, [todayLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Setup realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`meal_logs_changes:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_logs',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLogs]);

  return {
    logs,
    todayLogs,
    loading,
    addMealLog,
    deleteMealLog,
    getTodayStats,
    getMealsByType,
    refetch: fetchLogs
  };
};
