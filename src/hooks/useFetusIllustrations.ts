import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface FetusIllustration {
  id: string;
  month_number: number;
  image_url: string;
  title: string | null;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Hamiləlik ayları 1-9 üçün fetus şəkilləri — bazadan (admin paneldən
// idarə olunur). Cihazda ~30 dəqiqəlik keş saxlanılır.
export const useFetusIllustrations = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['fetus-illustrations', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pregnancy_fetus_illustrations')
        .select('*')
        .eq('is_active', true)
        .order('month_number');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description']) as FetusIllustration[];
    },
    staleTime: 1000 * 60 * 30,
  });
};

// Verilmiş ay üçün fetus şəkli URL-i. Bazada yoxdursa və ya yüklənmə
// xətası olarsa null qaytarır — çağıran tərəf daxili SVG fallback
// göstərir (offline/köhnə versiyada heç nə sınmır).
export const useFetusIllustrationByMonth = (monthNumber: number) => {
  const { data: illustrations = [] } = useFetusIllustrations();

  return useMemo(() => {
    const illustration = illustrations.find((i) => i.month_number === monthNumber);
    return illustration?.image_url || null;
  }, [illustrations, monthNumber]);
};

// Admin hooks
export const useAllFetusIllustrations = () => {
  return useQuery({
    queryKey: ['fetus-illustrations', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pregnancy_fetus_illustrations')
        .select('*')
        .order('month_number');

      if (error) throw error;
      return (data || []) as FetusIllustration[];
    },
  });
};

export const useUpsertFetusIllustration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<FetusIllustration> & { month_number: number; image_url: string }) => {
      const { data: existing } = await supabase
        .from('pregnancy_fetus_illustrations')
        .select('id')
        .eq('month_number', data.month_number)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('pregnancy_fetus_illustrations')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pregnancy_fetus_illustrations')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetus-illustrations'] });
    }
  });
};

export const useDeleteFetusIllustration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pregnancy_fetus_illustrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetus-illustrations'] });
    }
  });
};
