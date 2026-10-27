import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { clearLegacyAppointmentNotifications } from '@/lib/native';

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_type: string;
  reminder_enabled: boolean;
  created_at: string;
}

export interface AppointmentInput {
  title: string;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  event_type?: string;
  reminder_enabled?: boolean;
}

// Reminders are sent by the server (Google notification job, `appointment_reminder` push):
// the day before at 10:00 Baku time and 2 hours before when a time is set. They follow edits
// and deletes and reach every signed-in device, so nothing is scheduled locally any more.
const COLUMNS = 'id, user_id, title, description, event_date, event_time, event_type, reminder_enabled, created_at';

export const appointmentsKey = (userId: string | undefined) => ['appointments', userId] as const;

/** Upcoming first; same day ordered by time (untimed last). */
export function sortAppointments(list: Appointment[]): Appointment[] {
  return [...list].sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time || '99').localeCompare(b.event_time || '99'));
}

export const useAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = appointmentsKey(user?.id);

  const { data: appointments = [], isLoading, refetch } = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(COLUMNS)
        .eq('user_id', user!.id)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return sortAppointments((data || []) as Appointment[]);
    },
  });

  useEffect(() => { if (user) void clearLegacyAppointmentNotifications(); }, [user]);

  const setList = (fn: (list: Appointment[]) => Appointment[]) =>
    queryClient.setQueryData<Appointment[]>(key, (old) => sortAppointments(fn(old || [])));

  const fail = (error: unknown) => {
    console.error('Appointment change failed:', error);
    toast({
      title: tr("useappointments_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive',
    });
  };

  const addMutation = useMutation({
    mutationFn: async (input: AppointmentInput) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert({ user_id: user!.id, reminder_enabled: true, event_type: 'appointment', ...input })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as Appointment;
    },
    onSuccess: (row) => {
      setList((list) => [...list.filter((a) => a.id !== row.id), row]);
      toast({ title: tr("useappointments_randevu_elave_edildi_dc2666", "Randevu əlavə edildi! 📅"), description: row.title });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AppointmentInput> }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as Appointment;
    },
    onSuccess: (row) => setList((list) => list.map((a) => (a.id === row.id ? row : a))),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id).eq('user_id', user!.id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      setList((list) => list.filter((a) => a.id !== id));
      toast({ title: tr("appointments_randevu_silindi", 'Randevu silindi') });
    },
  });

  const addAppointment = useCallback(async (input: AppointmentInput) => {
    if (!user) return null;
    try { return await addMutation.mutateAsync(input); } catch (e) { fail(e); return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, addMutation.mutateAsync]);

  const updateAppointment = useCallback(async (id: string, updates: Partial<AppointmentInput>) => {
    if (!user) return null;
    try { return await updateMutation.mutateAsync({ id, updates }); } catch (e) { fail(e); return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, updateMutation.mutateAsync]);

  const deleteAppointment = useCallback(async (id: string) => {
    if (!user) return false;
    try { await deleteMutation.mutateAsync(id); return true; } catch (e) { fail(e); return false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, deleteMutation.mutateAsync]);

  const getUpcoming = (days: number = 7) => {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.event_date);
      return aptDate >= today && aptDate <= endDate;
    });
  };

  const getByDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter((apt) => apt.event_date === dateStr);
  };

  return {
    appointments,
    loading: !!user && isLoading,
    saving: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getUpcoming,
    getByDate,
    refetch,
  };
};
