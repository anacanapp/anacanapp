import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface DevelopmentTip {
  id: string;
  age_group: string;
  emoji: string;
  title: string;
  title_az: string | null;
  content: string;
  content_az: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const useDevelopmentTips = (ageGroup?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['development-tips', ageGroup, language],
    queryFn: async () => {
      let query = supabase
        .from('development_tips')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (ageGroup) {
        query = query.eq('age_group', ageGroup);
      }

      const { data, error } = await query;
      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'content']) as DevelopmentTip[];
    },
  });
};

export const useAllDevelopmentTips = () => {
  return useQuery({
    queryKey: ['development-tips-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_tips')
        .select('*')
        .order('age_group')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as DevelopmentTip[];
    },
  });
};

export const useDevelopmentTipsMutations = () => {
  const queryClient = useQueryClient();

  const createTip = useMutation({
    mutationFn: async (tip: Omit<DevelopmentTip, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('development_tips')
        .insert(tip)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-tips'] });
    },
  });

  const updateTip = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DevelopmentTip> & { id: string }) => {
      const { data, error } = await supabase
        .from('development_tips')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-tips'] });
    },
  });

  const deleteTip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('development_tips')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-tips'] });
    },
  });

  return { createTip, updateTip, deleteTip };
};
