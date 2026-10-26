import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MommyDayNotification {
  id: string;
  day_number: number;
  title: string;
  body: string;
  emoji: string | null;
  send_time: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

const fetchAllMommyNotifications = async (): Promise<MommyDayNotification[]> => {
  const PAGE_SIZE = 1000;
  let allData: MommyDayNotification[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('mommy_day_notifications')
      .select('*')
      .order('day_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data as MommyDayNotification[]);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
};

export const useMommyDayNotifications = () => {
  return useQuery({
    queryKey: ['mommy-day-notifications'],
    queryFn: fetchAllMommyNotifications,
  });
};

export const useCreateMommyDayNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: Omit<MommyDayNotification, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('mommy_day_notifications')
        .insert(notification)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mommy-day-notifications'] });
    },
  });
};

export const useUpdateMommyDayNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MommyDayNotification> & { id: string }) => {
      const { error } = await supabase
        .from('mommy_day_notifications')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mommy-day-notifications'] });
    },
  });
};

export const useDeleteMommyDayNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mommy_day_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mommy-day-notifications'] });
    },
  });
};

export const useMommyDayNotificationByDay = (day: number | null) => {
  return useQuery({
    queryKey: ['mommy-day-notification', day],
    queryFn: async () => {
      if (day === null || day < 1 || day > 1460) return null;
      const { data, error } = await supabase
        .from('mommy_day_notifications')
        .select('*')
        .eq('day_number', day)
        .eq('is_active', true);
      if (error) return null;
      return data as MommyDayNotification[];
    },
    enabled: day !== null && day >= 1 && day <= 1460,
  });
};
