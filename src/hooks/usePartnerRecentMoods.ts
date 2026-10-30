import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addDays, isoDay } from './usePartnerFamily';

/**
 * The woman's shared moods for the last `days` days (partner side, masked by Duzelis68:
 * mood is null unless she shares it). `lowDays` counts days with mood 1–2.
 */
export function usePartnerRecentMoods(days = 7, enabled = true) {
  const { user } = useAuth();
  const today = new Date();
  const from = isoDay(addDays(today, -(days - 1)));
  const to = isoDay(today);
  const query = useQuery({
    queryKey: ['partner-recent-moods', user?.id, from, to],
    enabled: !!user && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ log_date: string; mood: number | null }[]> => {
      const { data, error } = await (supabase as any).rpc('partner_daily_logs_v1', { p_from: from, p_to: to });
      if (error) throw error;
      return data || [];
    },
  });
  const moods = (query.data || []).filter((row) => typeof row.mood === 'number');
  return { moods, lowDays: moods.filter((row) => (row.mood as number) <= 2).length };
}
