import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { todayKey, localDateKey, daysAgoKey } from '@/lib/local-date';
import { localDayStartIso } from '@/lib/local-day-range';

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
      const startDate = daysAgoKey(6);
      const endDate = todayKey();
      const weekDays = Array.from({ length: 7 }, (_, i) => daysAgoKey(6 - i));

      // Fetch daily logs for the week
      // Masked by her sharing settings on the server (Duzelis68).
      const { data: dailyLogs } = await (supabase as any).rpc('partner_daily_logs_v1', { p_from: startDate, p_to: endDate }) as
        { data: { log_date: string; mood: number | null; water_intake: number | null }[] | null };

      // Fetch exercise logs for the week
      const { data: exerciseLogs } = await supabase
        .from('exercise_logs')
        .select('completed_at, duration_minutes, calories_burned')
        .eq('user_id', partnerId)
        .gte('completed_at', localDayStartIso(startDate))
        .lt('completed_at', localDayStartIso(daysAgoKey(-1)));

      // Process daily moods (fill in missing days)
      const dailyMoods: DailyMoodEntry[] = [];
      for (const dateStr of weekDays) {
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
        const date = localDateKey(new Date(log.completed_at));
        if (!exerciseByDay[date]) {
          exerciseByDay[date] = { count: 0, minutes: 0, calories: 0 };
        }
        exerciseByDay[date].count++;
        exerciseByDay[date].minutes += log.duration_minutes;
        exerciseByDay[date].calories += log.calories_burned;
      });

      const exerciseData: ExerciseEntry[] = [];
      for (const dateStr of weekDays) {
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
