import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { startOfDayOffset, type BabyLogRow } from '@/lib/baby-logs-range';

const KEY = 'baby-logs-range';

/** baby_logs of the selected child for the last `days` days, kept fresh by realtime changes. */
export function useBabyLogsRange(days: number) {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  const childId = selectedChild?.id ?? null;

  const query = useQuery({
    queryKey: [KEY, userId, childId, days],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<BabyLogRow[]> => {
      const from = startOfDayOffset(new Date(), -(days - 1)).toISOString();
      let q = supabase.from('baby_logs').select('*').eq('user_id', userId!).gte('start_time', from)
        .order('start_time', { ascending: false });
      if (childId) q = q.eq('child_id', childId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BabyLogRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`baby_logs_range_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baby_logs', filter: `user_id=eq.${userId}` },
        () => { void qc.invalidateQueries({ queryKey: [KEY] }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

  return {
    logs: query.data ?? [],
    loading: query.isLoading,
    refresh: () => qc.invalidateQueries({ queryKey: [KEY] }),
  };
}
