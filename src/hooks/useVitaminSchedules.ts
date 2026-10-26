import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    queryKey: ['vitamin-logs-today', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString().split('T')[0];
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
      const { data, error } = await supabase
        .from('vitamin_intake_logs')
        .insert({
          user_id: user.id,
          schedule_id: schedule.id,
          vitamin_name: schedule.vitamin_name,
          log_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
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
