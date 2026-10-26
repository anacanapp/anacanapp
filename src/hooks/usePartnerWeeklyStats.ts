import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface DailyMoodEntry {
  date: string;
  mood: number | null;
  water_intake: number;
}

interface ExerciseEntry {
  date: string;
  count: number;
  minutes: number;
  calories: number;
}

export interface WeeklyStats {
  dailyMoods: DailyMoodEntry[];
  exerciseData: ExerciseEntry[];
  totalWater: number;
  avgMood: number;
  exerciseCount: number;
  totalCalories: number;
}

export const usePartnerWeeklyStats = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeeklyStats = async () => {
    if (!profile?.linked_partner_id) {
      setLoading(false);
      return;
    }

    try {
      // Get partner's user_id
      const { data: partnerData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profile.linked_partner_id)
        .single();

      if (!partnerData) {
        setLoading(false);
        return;
      }

      const partnerId = partnerData.user_id;

      // Calculate date range (last 7 days)
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      
      const startDate = weekAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Fetch daily logs for the week
      const { data: dailyLogs } = await supabase
        .from('daily_logs')
        .select('log_date, mood, water_intake')
        .eq('user_id', partnerId)
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: true });

      // Fetch exercise logs for the week
      const { data: exerciseLogs } = await supabase
        .from('exercise_logs')
        .select('completed_at, duration_minutes, calories_burned')
        .eq('user_id', partnerId)
        .gte('completed_at', `${startDate}T00:00:00`)
        .lte('completed_at', `${endDate}T23:59:59`);

      // Process daily moods (fill in missing days)
      const dailyMoods: DailyMoodEntry[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const log = dailyLogs?.find(l => l.log_date === dateStr);
        dailyMoods.push({
          date: dateStr,
          mood: log?.mood || null,
          water_intake: log?.water_intake || 0
        });
      }

      // Process exercise data by day
      const exerciseByDay: Record<string, { count: number; minutes: number; calories: number }> = {};
      exerciseLogs?.forEach(log => {
        const date = log.completed_at.split('T')[0];
        if (!exerciseByDay[date]) {
          exerciseByDay[date] = { count: 0, minutes: 0, calories: 0 };
        }
        exerciseByDay[date].count++;
        exerciseByDay[date].minutes += log.duration_minutes;
        exerciseByDay[date].calories += log.calories_burned;
      });

      const exerciseData: ExerciseEntry[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = exerciseByDay[dateStr] || { count: 0, minutes: 0, calories: 0 };
        exerciseData.push({
          date: dateStr,
          ...dayData
        });
      }

      // Calculate totals
      const totalWater = dailyMoods.reduce((sum, d) => sum + d.water_intake, 0);
      const moodEntries = dailyMoods.filter(d => d.mood !== null);
      const avgMood = moodEntries.length > 0 
        ? moodEntries.reduce((sum, d) => sum + (d.mood || 0), 0) / moodEntries.length 
        : 0;
      const exerciseCount = exerciseLogs?.length || 0;
      const totalCalories = exerciseLogs?.reduce((sum, e) => sum + e.calories_burned, 0) || 0;

      setStats({
        dailyMoods,
        exerciseData,
        totalWater,
        avgMood,
        exerciseCount,
        totalCalories
      });
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyStats();
  }, [profile?.linked_partner_id]);

  return { stats, loading, refetch: fetchWeeklyStats };
};
