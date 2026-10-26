import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuickAction {
  id: string;
  life_stage: string;
  age_group: string;
  icon: string;
  label: string;
  label_az: string | null;
  tool_key: string;
  color_from: string;
  color_to: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const useQuickActions = (lifeStage: string = 'mommy', ageGroup?: string) => {
  return useQuery({
    queryKey: ['quick-actions', lifeStage, ageGroup],
    queryFn: async () => {
      let query = supabase
        .from('quick_actions')
        .select('*')
        .eq('life_stage', lifeStage)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (ageGroup) {
        query = query.eq('age_group', ageGroup);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuickAction[];
    },
  });
};

export const useAllQuickActions = () => {
  return useQuery({
    queryKey: ['quick-actions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_actions')
        .select('*')
        .order('life_stage')
        .order('age_group')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as QuickAction[];
    },
  });
};

export const useQuickActionsMutations = () => {
  const queryClient = useQueryClient();

  const createAction = useMutation({
    mutationFn: async (action: Omit<QuickAction, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('quick_actions')
        .insert(action)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-actions'] });
    },
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuickAction> & { id: string }) => {
      const { data, error } = await supabase
        .from('quick_actions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-actions'] });
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_actions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-actions'] });
    },
  });

  return { createAction, updateAction, deleteAction };
};
