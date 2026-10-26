import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';
import { completePeriodWrite, recordPeriodDays } from '@/hooks/usePeriodDayLogs';

export interface FlowDailyLog {
  id: string;
  user_id: string;
  log_date: string;
  mood: number | null;
  energy_level: number | null;
  symptoms: string[];
  pain_level: number | null;
  flow_intensity: 'unspecified' | 'none' | 'spotting' | 'light' | 'medium' | 'heavy' | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  temperature: number | null;
  water_glasses: number;
  notes: string | null;
  /** Flow P0: servikal maye (fertillik göstəricisi) */
  cervical_mucus: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' | null;
  /** Flow P0: cinsi əlaqə */
  sexual_activity: 'none' | 'protected' | 'unprotected' | null;
  /** Flow P0: libido 1-3 */
  libido: number | null;
  /** Flow P1: OPK/LH ovulyasiya testi nəticəsi */
  ovulation_test: 'negative' | 'positive' | 'peak' | null;
  created_at: string;
  updated_at: string;
}

export interface FlowSymptom {
  id: string;
  symptom_key: string;
  label: string;
  label_az: string | null;
  emoji: string | null;
  category: 'physical' | 'emotional' | 'digestive' | 'skin' | 'other';
  sort_order: number;
  is_active: boolean;
}

export const useFlowSymptoms = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['flow-symptoms', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_symptoms_db')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['label']) as FlowSymptom[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useFlowDailyLog = (date: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['flow-daily-log', user?.id, date],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('flow_daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', date)
        .maybeSingle();

      if (error) throw error;
      return data as FlowDailyLog | null;
    },
    enabled: !!user?.id,
  });
};

export const useFlowDailyLogs = (startDate?: string, endDate?: string) => {
  const { user } = useAuth();
  const start = startDate || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const end = endDate || format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['flow-daily-logs', user?.id, start, end],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('flow_daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', start)
        .lte('log_date', end)
        .order('log_date', { ascending: false });

      if (error) throw error;
      return data as FlowDailyLog[];
    },
    enabled: !!user?.id,
  });
};

export const useFlowMonthLogs = (month: Date) => {
  const { user } = useAuth();
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['flow-month-logs', user?.id, start, end],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('flow_daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', start)
        .lte('log_date', end)
        .order('log_date');

      if (error) throw error;
      return data as FlowDailyLog[];
    },
    enabled: !!user?.id,
  });
};

export const useSaveFlowDailyLog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: `period-recording:${user?.id}` },
    mutationFn: async (log: Partial<FlowDailyLog> & { log_date: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { log_date, flow_intensity, ...dailyLog } = log;
      return recordPeriodDays(user.id, { dates: [log_date], flow: flow_intensity ?? null, dailyLog });
    },
    onSuccess: result => completePeriodWrite(result, user!.id, queryClient),
  });
};

// Get mood data for chart (last 30 days)
export const useFlowMoodChart = () => {
  const { user } = useAuth();
  const start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const end = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['flow-mood-chart', user?.id, start, end],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('flow_daily_logs')
        .select('log_date, mood, energy_level, pain_level, sleep_quality')
        .eq('user_id', user.id)
        .gte('log_date', start)
        .lte('log_date', end)
        .not('mood', 'is', null)
        .order('log_date');

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};
