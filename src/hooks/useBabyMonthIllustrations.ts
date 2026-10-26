import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

// Default placeholder for months without illustrations
export const DEFAULT_BABY_ILLUSTRATION = '/placeholder.svg';

export interface BabyMonthIllustration {
  id: string;
  month_number: number;
  image_url: string;
  title: string | null;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useBabyMonthIllustrations = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['baby-month-illustrations', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_month_illustrations')
        .select('*')
        .eq('is_active', true)
        .order('month_number');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description']) as BabyMonthIllustration[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 mins
  });
};

export const useBabyIllustrationByMonth = (monthNumber: number) => {
  const { data: illustrations = [], isLoading, error } = useBabyMonthIllustrations();
  
  const result = useMemo(() => {
    const illustration = illustrations.find(i => i.month_number === monthNumber);
    return {
      imageUrl: illustration?.image_url || DEFAULT_BABY_ILLUSTRATION,
      title: illustration?.title || null,
      description: illustration?.description || null,
      hasIllustration: !!illustration
    };
  }, [illustrations, monthNumber]);

  return { ...result, isLoading, error };
};

// Admin hooks
export const useAllBabyMonthIllustrations = () => {
  return useQuery({
    queryKey: ['baby-month-illustrations', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_month_illustrations')
        .select('*')
        .order('month_number');
      
      if (error) throw error;
      return (data || []) as BabyMonthIllustration[];
    },
  });
};

export const useUpsertBabyMonthIllustration = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<BabyMonthIllustration> & { month_number: number; image_url: string }) => {
      // Check if illustration exists for this month
      const { data: existing } = await supabase
        .from('baby_month_illustrations')
        .select('id')
        .eq('month_number', data.month_number)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('baby_month_illustrations')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('baby_month_illustrations')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-month-illustrations'] });
    }
  });
};

export const useDeleteBabyMonthIllustration = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('baby_month_illustrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-month-illustrations'] });
    }
  });
};
