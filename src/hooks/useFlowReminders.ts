import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ReminderType = 'period_start' | 'period_end' | 'ovulation' | 'fertile_start' | 'fertile_end' | 'pms' | 'pill' | 'custom';

export interface FlowReminder {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  days_before: number;
  time_of_day: string;
  is_enabled: boolean;
  title: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export const REMINDER_TYPE_INFO: Record<ReminderType, {label: string;labelAz: string;emoji: string;description: string;}> = {
  period_start: { label: 'Period Start', labelAz: tr("useflowreminders_period_baslangici_9350e0", "Period Ba\u015Flan\u011F\u0131c\u0131"), emoji: '🔴', description: tr("useflowreminders_period_baslamadan_evvel_xeberdar_ol_b8867d", "Period başlamadan əvvəl xəbərdar ol") },
  period_end: { label: 'Period End', labelAz: 'Period Sonu', emoji: '✅', description: tr("useflowreminders_period_bitende_xeberdar_ol_2d8f7f", "Period bitəndə xəbərdar ol") },
  ovulation: { label: 'Ovulation', labelAz: 'Ovulyasiya', emoji: '🌸', description: tr("useflowreminders_ovulyasiya_gununden_evvel_xeberdar_ol_0c1c95", "Ovulyasiya günündən əvvəl xəbərdar ol") },
  fertile_start: { label: 'Fertile Window Start', labelAz: tr("useflowreminders_mehsuldar_gunler_16513f", "M\u0259hsuldar G\xFCnl\u0259r"), emoji: '💕', description: tr("useflowreminders_mehsuldar_gunler_baslayanda_xeberdar_ol_a14656", "Məhsuldar günlər başlayanda xəbərdar ol") },
  fertile_end: { label: 'Fertile Window End', labelAz: tr("useflowreminders_mehsuldar_gunler_sonu_856dec", "M\u0259hsuldar G\xFCnl\u0259r Sonu"), emoji: '📅', description: tr("useflowreminders_mehsuldar_gunler_bitende_xeberdar_ol_1356c7", "Məhsuldar günlər bitəndə xəbərdar ol") },
  pms: { label: 'PMS', labelAz: tr("useflowreminders_pms_dovru_16f417", "PMS D\xF6vr\xFC"), emoji: '⚡', description: tr("useflowreminders_pms_dovru_baslayanda_xeberdar_ol_d31932", "PMS dövrü başlayanda xəbərdar ol") },
  pill: { label: 'Pill Reminder', labelAz: tr("useflowreminders_heb_xatirlatmasi_e3e934", "H\u0259b Xat\u0131rlatmas\u0131"), emoji: '💊', description: tr("useflowreminders_gundelik_heb_xatirlatmasi_149aba", "Gündəlik həb xatırlatması") },
  custom: { label: 'Custom', labelAz: tr("useflowreminders_xususi_1055b8", "X\xFCsusi"), emoji: '🔔', description: tr("useflowreminders_xususi_xatirlatma_dd5178", "Xüsusi xatırlatma") }
};

export const useFlowReminders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['flow-reminders'],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.
      from('flow_reminders').
      select('*').
      eq('user_id', user.id).
      order('created_at');

      if (error) throw error;
      return data as FlowReminder[];
    },
    enabled: !!user?.id
  });
};

export const useSaveFlowReminder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminder: Partial<FlowReminder> & {reminder_type: ReminderType;}) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase.
      from('flow_reminders').
      upsert({
        ...reminder,
        user_id: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,reminder_type'
      }).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-reminders'] });
    }
  });
};

export const useToggleReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_enabled }: {id: string;is_enabled: boolean;}) => {
      const { data, error } = await supabase.
      from('flow_reminders').
      update({ is_enabled, updated_at: new Date().toISOString() }).
      eq('id', id).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-reminders'] });
    }
  });
};

export const useDeleteFlowReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('flow_reminders').
      delete().
      eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-reminders'] });
    }
  });
};

// Initialize default reminders for a new user
export const useInitializeFlowReminders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const defaultReminders: Omit<FlowReminder, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        user_id: user.id,
        reminder_type: 'period_start',
        days_before: 2,
        time_of_day: '09:00',
        is_enabled: true,
        title: tr("useflowreminders_period_yaxinlasir_06bbcf", "Period yaxınlaşır"),
        message: tr("useflowreminders_perioda_2_gun_qaldi_hazir_ol_0c170f", "Perioda 2 gün qaldı, hazır ol!")
      },
      {
        user_id: user.id,
        reminder_type: 'ovulation',
        days_before: 1,
        time_of_day: '09:00',
        is_enabled: true,
        title: tr("useflowreminders_ovulyasiya_gunu_751dc6", "Ovulyasiya günü"),
        message: tr("useflowreminders_sabah_ovulyasiya_gunudur_c8c5d7", "Sabah ovulyasiya günüdür!")
      },
      {
        user_id: user.id,
        reminder_type: 'fertile_start',
        days_before: 1,
        time_of_day: '09:00',
        is_enabled: true,
        title: tr("useflowreminders_mehsuldar_gunler_b8c031", "Məhsuldar günlər"),
        message: tr("useflowreminders_sabahdan_mehsuldar_gunler_baslayir_fba6cc", "Sabahdan məhsuldar günlər başlayır!")
      },
      {
        user_id: user.id,
        reminder_type: 'pms',
        days_before: 0,
        time_of_day: '09:00',
        is_enabled: true,
        title: tr("useflowreminders_pms_dovru_16f417", "PMS Dövrü"),
        message: tr("useflowreminders_pms_yaxinlasir_ozune_bax", "PMS dövrü yaxınlaşır — özünə qayğı göstər! ⚡")
      }];


      const { error } = await supabase.
      from('flow_reminders').
      upsert(defaultReminders, { onConflict: 'user_id,reminder_type' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-reminders'] });
    }
  });
};