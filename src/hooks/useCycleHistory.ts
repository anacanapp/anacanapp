import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { effectiveCycleLength, isAnomalousCycleLength } from '@/lib/cycle-predictions';

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
  /** 21–35 gün aralığından kənar tamamlanmış tsikllərin sayı. */
  anomalousCycles: number;
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

/** Proqnozlar üçün tsikl uzunluğu; anomal tsikllər (məs. 53 gün) normanı dəyişmir. */
export const useEffectiveCycleLength = () => {
  const { data: cycles = [] } = useCycleHistory();
  const stored = useUserStore((s) => s.cycleLength);
  return effectiveCycleLength(cycles, stored);
};

export const useCycleStats = () => {
  const { data: cycles = [] } = useCycleHistory();
  const fallbackCycleLength = useEffectiveCycleLength();

  const stats: CycleStats = {
    averageCycleLength: fallbackCycleLength,
    averagePeriodLength: 5,
    shortestCycle: 28,
    longestCycle: 28,
    totalCycles: 0,
    cycleVariation: 0,
    anomalousCycles: 0,
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
      // Orta tsikl yalnız normal (21–35 gün) tsikllərdən; anomaliyalar ayrıca sayılır.
      const normal = cycleLengths.filter(l => !isAnomalousCycleLength(l));
      if (normal.length > 0) stats.averageCycleLength = Math.round(normal.reduce((a, b) => a + b, 0) / normal.length);
      stats.anomalousCycles = cycleLengths.length - normal.length;
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
