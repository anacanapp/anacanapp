import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface TrimesterTip {
  id: string;
  trimester: number;
  icon: string;
  tip_text: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch tips by trimester
export const useTrimesterTips = (trimester?: number) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['trimester_tips', trimester, language],
    queryFn: async () => {
      let query = (supabase as any)
        .from('trimester_tips')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (trimester) {
        query = query.eq('trimester', trimester);
      }

      const { data, error } = await query;
      if (error) throw error;
      return mapRowsTranslation(data, language, ['tip_text']) as TrimesterTip[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

// Admin hook for managing tips
export const useTrimesterTipsAdmin = () => {
  const queryClient = useQueryClient();

  const fetchAllTips = useQuery({
    queryKey: ['trimester_tips_admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trimester_tips')
        .select('*')
        .order('trimester', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as TrimesterTip[];
    },
  });

  const createTip = useMutation({
    mutationFn: async (tip: Partial<TrimesterTip>) => {
      const { data, error } = await (supabase as any)
        .from('trimester_tips')
        .insert(tip)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trimester_tips_admin'] });
      queryClient.invalidateQueries({ queryKey: ['trimester_tips'] });
    },
  });

  const updateTip = useMutation({
    mutationFn: async ({ id, ...tip }: Partial<TrimesterTip> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('trimester_tips')
        .update(tip)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trimester_tips_admin'] });
      queryClient.invalidateQueries({ queryKey: ['trimester_tips'] });
    },
  });

  const deleteTip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('trimester_tips')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trimester_tips_admin'] });
      queryClient.invalidateQueries({ queryKey: ['trimester_tips'] });
    },
  });

  return {
    tips: fetchAllTips.data || [],
    isLoading: fetchAllTips.isLoading,
    error: fetchAllTips.error,
    createTip,
    updateTip,
    deleteTip,
    refetch: fetchAllTips.refetch,
  };
};
