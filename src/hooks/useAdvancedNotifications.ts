import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

// ==================== AUDIENCE STATS ====================
export interface AudienceStats {
  total_users: number;
  users_with_tokens: number;
  by_audience: {
    all: { users: number; tokens: number };
    flow: { users: number; tokens: number };
    bump: { users: number; tokens: number };
    mommy: { users: number; tokens: number };
    partner: { users: number; tokens: number };
  };
}

export const useAudienceStats = () => {
  return useQuery({
    queryKey: ['audience-stats'],
    queryFn: async (): Promise<AudienceStats> => {
      // DÜZƏLİŞ: hər ikisi limitsiz idi — profiles/device_tokens 1000-i
      // keçəndə (bizdə qat-qat çoxdur) auditoriya sayları səhv idi, bu isə
      // Bulk Push-un "Göndər" düyməsinin aktiv olub-olmamasını (tokens===0
      // yoxlaması) belə səhv təyin edə bilirdi.
      const [profiles, tokens] = await Promise.all([
        fetchAllRows<{ user_id: string; life_stage: string | null; role: string | null }>((from, to) =>
          supabase.from('profiles').select('user_id, life_stage, role').range(from, to)
        ),
        fetchAllRows<{ user_id: string }>((from, to) =>
          supabase.from('device_tokens').select('user_id').range(from, to)
        ),
      ]);

      const tokenUserIds = new Set(tokens?.map(t => t.user_id) || []);

      const stats: AudienceStats = {
        total_users: profiles?.length || 0,
        users_with_tokens: tokenUserIds.size,
        by_audience: {
          all: { users: profiles?.length || 0, tokens: tokenUserIds.size },
          flow: { users: 0, tokens: 0 },
          bump: { users: 0, tokens: 0 },
          mommy: { users: 0, tokens: 0 },
          partner: { users: 0, tokens: 0 },
        },
      };

      profiles?.forEach(profile => {
        const hasToken = tokenUserIds.has(profile.user_id);
        
        // Check life_stage for partner (from profiles table)
        const lifeStage = profile.life_stage as string;
        
        if (lifeStage === 'flow') {
          stats.by_audience.flow.users++;
          if (hasToken) stats.by_audience.flow.tokens++;
        } else if (lifeStage === 'bump') {
          stats.by_audience.bump.users++;
          if (hasToken) stats.by_audience.bump.tokens++;
        } else if (lifeStage === 'mommy') {
          stats.by_audience.mommy.users++;
          if (hasToken) stats.by_audience.mommy.tokens++;
        }
        
        // Partners are identified by role in profiles (cast to string to avoid type error)
        if ((profile.role as string) === 'partner') {
          stats.by_audience.partner.users++;
          if (hasToken) stats.by_audience.partner.tokens++;
        }
      });

      return stats;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
};

// ==================== PREGNANCY DAY NOTIFICATIONS ====================
export interface PregnancyDayNotification {
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

export const usePregnancyDayNotifications = () => {
  return useQuery({
    queryKey: ['pregnancy-day-notifications'],
    queryFn: async () => {
      // Cəmi ~294 gün (< 1000) olsa da, sibling hook (useMommyDayNotifications,
      // 1460 gün) ilə tutarlılıq üçün eyni təhlükəsiz pattern istifadə olunur.
      const data = await fetchAllRows<PregnancyDayNotification>((from, to) =>
        supabase.from('pregnancy_day_notifications').select('*').order('day_number', { ascending: true }).range(from, to)
      );
      return data;
    },
  });
};

export const useCreatePregnancyDayNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Omit<PregnancyDayNotification, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('pregnancy_day_notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-day-notifications'] });
    },
  });
};

export const useUpdatePregnancyDayNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PregnancyDayNotification> & { id: string }) => {
      const { error } = await supabase
        .from('pregnancy_day_notifications')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-day-notifications'] });
    },
  });
};

export const useDeletePregnancyDayNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pregnancy_day_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-day-notifications'] });
    },
  });
};

// ==================== BULK PUSH NOTIFICATIONS ====================
export interface BulkPushNotification {
  id: string;
  title: string;
  body: string;
  target_audience: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_sent: number;
  total_failed: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  created_by: string | null;
  created_at: string;
}

export const useBulkPushNotifications = () => {
  return useQuery({
    queryKey: ['bulk-push-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_push_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching bulk notifications:', error);
        throw error;
      }

      return data as BulkPushNotification[];
    },
  });
};

export const useCreateBulkPushNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Pick<BulkPushNotification, 'title' | 'body' | 'target_audience'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('bulk_push_notifications')
        .insert({
          ...notification,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BulkPushNotification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-push-notifications'] });
    },
  });
};

export const useSendBulkPushNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase.functions.invoke('send-bulk-push', {
        body: { notificationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-push-notifications'] });
    },
  });
};

// ==================== GET NOTIFICATION FOR PREGNANCY DAY ====================
export const usePregnancyDayNotificationByDay = (day: number | null) => {
  return useQuery({
    queryKey: ['pregnancy-day-notification', day],
    queryFn: async () => {
      if (day === null || day < 0 || day > 293) return null;

      const { data, error } = await supabase
        .from('pregnancy_day_notifications')
        .select('*')
        .eq('day_number', day)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching notification for day:', error);
        return null;
      }

      return data as PregnancyDayNotification[];
    },
    enabled: day !== null && day >= 0 && day <= 293,
  });
};
