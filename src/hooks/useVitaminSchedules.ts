import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { retainOutboxUser, saveWithOutbox, subscribeOutbox } from '@/lib/offline-outbox';
// "Taken today" uses the phone's local day. The reminder job (scripts/notification-jobs/send-vitamin-reminders.mjs
// with vitamin-window.mjs) checks vitamin_intake_logs.log_date against the Baku (UTC+4) day, which is the same
// day for users in Azerbaijan; the old UTC key logged 00:00-04:00 intakes on yesterday.
import { todayKey } from '@/lib/local-date';

export interface VitaminSchedule {
  id: string;
  user_id: string;
  vitamin_name: string;
  icon_emoji: string;
  scheduled_time: string; // HH:MM:SS
  days_of_week: number[];
  is_active: boolean;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VitaminIntakeLog {
  id: string;
  user_id: string;
  schedule_id: string;
  vitamin_name: string;
  taken_at: string;
  log_date: string;
  created_at: string;
}

export const useVitaminSchedules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ['vitamin-schedules', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_vitamin_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_time');
      if (error) throw error;
      return data as VitaminSchedule[];
    },
    enabled: !!user,
  });

  const todayLogsQuery = useQuery({
    queryKey: ['vitamin-logs-today', user?.id, todayKey()],
    queryFn: async () => {
      if (!user) return [];
      const today = todayKey();
      const { data, error } = await supabase
        .from('vitamin_intake_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', today);
      if (error) throw error;
      return data as VitaminIntakeLog[];
    },
    enabled: !!user,
  });

  const addSchedule = useMutation({
    mutationFn: async (schedule: {
      vitamin_name: string;
      icon_emoji: string;
      scheduled_time: string;
      days_of_week?: number[];
      notification_enabled?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('user_vitamin_schedules')
        .insert({ ...schedule, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitamin-schedules'] });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VitaminSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('user_vitamin_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitamin-schedules'] });
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_vitamin_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitamin-schedules'] });
    },
  });

  const logIntake = useMutation({
    mutationFn: async (schedule: VitaminSchedule) => {
      if (!user) throw new Error('Not authenticated');
      // Queued in the offline outbox first (client UUID id, idempotent replay): offline or a
      // timeout keeps the intake and syncs later instead of losing it.
      const outcome = await saveWithOutbox(user.id, 'vitamin_intake_logs', {
        user_id: user.id,
        schedule_id: schedule.id,
        vitamin_name: schedule.vitamin_name,
        log_date: todayKey(),
        taken_at: new Date().toISOString(),
      });
      if (outcome.status === 'error') throw outcome.error;
      return outcome.data as unknown as VitaminIntakeLog;
    },
    onSuccess: (row) => {
      // Optimistic insert so a queued (offline) intake shows "taken" at once; replaced on refetch.
      queryClient.setQueryData<VitaminIntakeLog[]>(['vitamin-logs-today', user?.id, todayKey()], (old) => {
        const list = old ?? [];
        return list.some((l) => l.id === row.id) ? list : [...list, row];
      });
      queryClient.invalidateQueries({ queryKey: ['vitamin-logs-today'] });
    },
  });

  const undoIntake = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('vitamin_intake_logs')
        .delete()
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitamin-logs-today'] });
    },
  });

  // Offline outbox: flush queued vitamin intakes (mount, online, app resume) and
  // refresh once a background flush delivered them.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const unsubscribe = subscribeOutbox((event) => {
      if (event.userId === uid && event.sentTables.includes('vitamin_intake_logs')) {
        void queryClient.invalidateQueries({ queryKey: ['vitamin-logs-today'] });
      }
    });
    const release = retainOutboxUser(uid);
    return () => { unsubscribe(); release(); };
  }, [user?.id, queryClient]);

  const isVitaminTakenToday = (scheduleId: string) => {
    return todayLogsQuery.data?.some(log => log.schedule_id === scheduleId) ?? false;
  };

  const getIntakeLog = (scheduleId: string) => {
    return todayLogsQuery.data?.find(log => log.schedule_id === scheduleId);
  };

  return {
    schedules: schedulesQuery.data ?? [],
    todayLogs: todayLogsQuery.data ?? [],
    isLoading: schedulesQuery.isLoading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    logIntake,
    undoIntake,
    isVitaminTakenToday,
    getIntakeLog,
  };
};
