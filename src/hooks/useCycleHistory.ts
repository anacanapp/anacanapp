import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CycleHistory {
  id: string;
  user_id: string;
  cycle_number: number;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_length: number | null;
  ovulation_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface CycleStats {
  averageCycleLength: number;
  averagePeriodLength: number;
  shortestCycle: number;
  longestCycle: number;
  totalCycles: number;
  cycleVariation: number;
}

export const useCycleHistory = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cycle-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('cycle_history')
        .select('*')
        .eq('user_id', user.id)
        .order('cycle_number', { ascending: false });

      if (error) throw error;
      return data as CycleHistory[];
    },
    enabled: !!user?.id,
  });
};

export const useCycleStats = () => {
  const { data: cycles = [] } = useCycleHistory();

  const stats: CycleStats = {
    averageCycleLength: 28,
    averagePeriodLength: 5,
    shortestCycle: 28,
    longestCycle: 28,
    totalCycles: 0,
    cycleVariation: 0,
  };

  if (cycles.length > 0) {
    // Sanity filtri (15-60 gün): köhnə bug-ların yaratdığı 1-2 günlük saxta
    // tsikllər ortalamanı zəhərləməsin (bax usePeriodDayLogs sync düzəlişi)
    const cycleLengths = cycles.
    filter(c => c.cycle_length && c.cycle_length >= 15 && c.cycle_length <= 60).
    map(c => c.cycle_length!);
    const periodLengths = cycles.
    filter(c => c.end_date && c.period_length && c.period_length >= 1 && c.period_length <= 15).
    map(c => c.period_length!);

    if (cycleLengths.length > 0) {
      stats.averageCycleLength = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      stats.shortestCycle = Math.min(...cycleLengths);
      stats.longestCycle = Math.max(...cycleLengths);
      stats.cycleVariation = stats.longestCycle - stats.shortestCycle;
    }

    if (periodLengths.length > 0) {
      stats.averagePeriodLength = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
    }

    stats.totalCycles = cycles.length;
  }

  return stats;
};

export const useAddCycle = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cycle: Omit<CycleHistory, 'id' | 'user_id' | 'created_at'>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('cycle_history')
        .insert({
          ...cycle,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-history'] });
    },
  });
};

export const useUpdateCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CycleHistory> & { id: string }) => {
      const { data, error } = await supabase
        .from('cycle_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-history'] });
    },
  });
};

export const useDeleteCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cycle_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-history'] });
    },
  });
};
