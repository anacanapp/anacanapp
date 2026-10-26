import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { format, parseISO } from 'date-fns';
import { type PeriodFlowAction, validatePeriodDates } from '@/lib/period-flow';

export interface PeriodDayLog {
  id: string;
  user_id: string;
  log_date: string;
  flow_intensity: string | null;
  notes: string | null;
  created_at: string;
}

export const usePeriodDayLogs = (month?: Date) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['period-day-logs', user?.id, month?.getFullYear(), month?.getMonth()],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase.from('period_day_logs').select('*').eq('user_id', user.id).order('log_date');
      if (month) {
        query = query.gte('log_date', format(new Date(month.getFullYear(), month.getMonth() - 1, 1), 'yyyy-MM-dd'))
          .lte('log_date', format(new Date(month.getFullYear(), month.getMonth() + 2, 0), 'yyyy-MM-dd'));
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PeriodDayLog[];
    },
    enabled: !!user?.id,
    staleTime: 0,
  });
};

export interface PeriodWrite {
  dates: (Date | string)[];
  flow: PeriodFlowAction | null;
  complete?: boolean;
  preserveExisting?: boolean;
  dailyLog?: Record<string, unknown>;
}

interface PeriodWriteResult {
  ok: true;
  userId: string;
  dates: string[];
  flow: PeriodFlowAction | null;
  dailyLog: any;
  profile: { last_period_date: string | null; period_length: number; cycle_length: number };
  healthDays: { date: string; flow: PeriodFlowAction; cycleStart: boolean }[];
}

export async function recordPeriodDays(userId: string, input: PeriodWrite): Promise<PeriodWriteResult> {
  if (!userId) throw new Error('NOT_AUTHENTICATED');
  const dates = validatePeriodDates(input.dates);
  const { data, error } = await supabase.rpc('record_period_days' as any, {
    p_expected_user_id: userId,
    p_dates: dates,
    p_flow: input.flow,
    p_complete: input.complete ?? false,
    p_preserve_existing: input.preserveExisting ?? false,
    p_daily_log: input.dailyLog ?? null,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  if (error) throw error;
  const result = data as unknown as PeriodWriteResult;
  if (!result?.ok || result.userId !== userId) throw new Error('PERIOD_WRITE_FAILED');
  return result;
}

export async function completePeriodWrite(result: PeriodWriteResult, userId: string, queryClient: QueryClient) {
  const store = useUserStore.getState();
  if (store.userId === userId && store.lifeStage === 'flow') {
    useUserStore.setState({ lastPeriodDate: result.profile.last_period_date ? parseISO(result.profile.last_period_date) : null,
      periodLength: result.profile.period_length ?? store.periodLength, cycleLength: result.profile.cycle_length ?? store.cycleLength });
  }
  await Promise.all(['period-day-logs', 'cycle-history', 'flow-daily-log', 'flow-daily-logs', 'flow-month-logs', 'flow-mood-chart']
    .map(key => queryClient.invalidateQueries({ queryKey: [key, userId] })));
  // The app record has committed. Health is optional, device-local and limited to
  // explicitly observed dates; old native bridges never receive guessed flow data.
  if (useUserStore.getState().userId === userId && result.healthDays.length) {
    try {
      const { syncPeriodDaysToHealth } = await import('@/lib/healthCycle');
      if (useUserStore.getState().userId === userId) await syncPeriodDaysToHealth(result.healthDays);
    } catch { /* Optional device sync must not misreport a committed app record. */ }
  }
}

export const useRecordPeriodDays = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `period-recording:${user?.id}` },
    mutationFn: (input: PeriodWrite) => recordPeriodDays(user?.id ?? '', input),
    onSuccess: result => completePeriodWrite(result, user!.id, queryClient),
  });
};
