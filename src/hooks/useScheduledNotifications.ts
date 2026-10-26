import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  target_audience: string;
  notification_type: string | null;
  is_active: boolean | null;
  priority: number | null;
  created_at: string;
  updated_at: string;
}

export const useScheduledNotifications = () => {
  return useQuery({
    queryKey: ['scheduled-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error fetching scheduled notifications:', error);
        return [];
      }

      return data as ScheduledNotification[];
    },
  });
};

export const useCreateScheduledNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Omit<ScheduledNotification, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('scheduled_notifications')
        .insert(notification);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-notifications'] });
    },
  });
};

export const useUpdateScheduledNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledNotification> & { id: string }) => {
      const { error } = await supabase
        .from('scheduled_notifications')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-notifications'] });
    },
  });
};

export const useDeleteScheduledNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-notifications'] });
    },
  });
};

export const useTriggerDailyNotifications = () => {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('send-daily-notifications', {
        body: { manual: true },
      });

      if (error) throw error;
    },
  });
};
