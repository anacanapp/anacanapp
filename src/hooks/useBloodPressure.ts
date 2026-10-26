import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Qan təzyiqi qeydləri — blood_pressure_logs.
 * (Cədvəl migration tətbiqinə qədər mövcud olmaya bilər → boş siyahı + xəta swallow)
 */

export interface BpLog {
  id: string;
  user_id: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measured_at: string;
  notes: string | null;
  created_at: string;
}

export const useBloodPressureLogs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bp-logs'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase as any).
      from('blood_pressure_logs').
      select('*').
      eq('user_id', user.id).
      order('measured_at', { ascending: false }).
      limit(90);
      if (error) {
        console.warn('bp logs unavailable:', error.message);
        return [];
      }
      return (data || []) as BpLog[];
    },
    enabled: !!user?.id
  });
};

export const useAddBpLog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: {systolic: number;diastolic: number;pulse?: number | null;notes?: string | null;measured_at?: string;}) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await (supabase as any).
      from('blood_pressure_logs').
      insert({
        user_id: user.id,
        systolic: log.systolic,
        diastolic: log.diastolic,
        pulse: log.pulse ?? null,
        notes: log.notes ?? null,
        measured_at: log.measured_at || new Date().toISOString()
      }).
      select().
      single();
      if (error) throw error;
      return data as BpLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp-logs'] });
    }
  });
};

export const useDeleteBpLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).
      from('blood_pressure_logs').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp-logs'] });
    }
  });
};
