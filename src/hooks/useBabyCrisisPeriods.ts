import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface BabyCrisisPeriod {
  id: string;
  week_start: number;
  week_end: number;
  leap_number: number | null;
  title: string;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  symptoms: string[] | null;
  symptoms_az: string[] | null;
  tips: string[] | null;
  tips_az: string[] | null;
  duration_days: number | null;
  severity: string;
  emoji: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useBabyCrisisPeriods = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['baby-crisis-periods', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_crisis_periods')
        .select('*')
        .eq('is_active', true)
        .order('week_start');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description', 'symptoms', 'tips']) as BabyCrisisPeriod[];
    },
    staleTime: 1000 * 60 * 30,
  });
};

// Get crisis period for a specific baby age in weeks
export const useCurrentBabyCrisis = (babyAgeWeeks: number) => {
  const { data: crisisPeriods = [] } = useBabyCrisisPeriods();
  
  return crisisPeriods.filter(
    cp => babyAgeWeeks >= cp.week_start && babyAgeWeeks <= cp.week_end
  );
};

// Check if baby is currently in a crisis period
export const useIsBabyInCrisis = (babyAgeWeeks: number) => {
  const currentCrises = useCurrentBabyCrisis(babyAgeWeeks);
  return currentCrises.length > 0;
};

// Get upcoming crisis periods for a baby
export const useUpcomingBabyCrises = (babyAgeWeeks: number, limit = 3) => {
  const { data: crisisPeriods = [] } = useBabyCrisisPeriods();
  
  return crisisPeriods
    .filter(cp => cp.week_start > babyAgeWeeks)
    .slice(0, limit);
};

// Admin hooks
export const useAllBabyCrisisPeriods = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['baby-crisis-periods', 'all', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_crisis_periods')
        .select('*')
        .order('week_start');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description', 'symptoms', 'tips']) as BabyCrisisPeriod[];
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useCreateBabyCrisisPeriod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<BabyCrisisPeriod, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('baby_crisis_periods')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-crisis-periods'] });
    }
  });
};

export const useUpdateBabyCrisisPeriod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BabyCrisisPeriod> & { id: string }) => {
      const { error } = await supabase
        .from('baby_crisis_periods')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-crisis-periods'] });
    }
  });
};

export const useDeleteBabyCrisisPeriod = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('baby_crisis_periods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-crisis-periods'] });
    }
  });
};
