import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { localNotifications } from '@/lib/native';

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

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAppointments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Schedule notification for appointment
  const scheduleAppointmentNotification = async (appointment: {
    title: string;
    event_date: string;
    event_time?: string;
    reminder_enabled?: boolean;
  }) => {
    if (!appointment.reminder_enabled) return;

    try {
      const appointmentDate = new Date(appointment.event_date);
      if (appointment.event_time) {
        const [hours, minutes] = appointment.event_time.split(':').map(Number);
        appointmentDate.setHours(hours, minutes, 0, 0);
      }

      // Schedule reminder for day before at 10:00
      const reminderTime = new Date(appointmentDate);
      reminderTime.setDate(reminderTime.getDate() - 1);
      reminderTime.setHours(10, 0, 0, 0);

      const now = new Date();
      if (reminderTime > now) {
        await localNotifications.schedule([{
          id: 400 + Math.floor(Math.random() * 1000),
          title: tr("appointments_sabah_randevunuz_var", 'Sabah randevunuz var!') + ' 📅',
          body: appointment.title,
          schedule: { at: reminderTime }
        }]);
      }

      // Also schedule 2 hours before if time is set
      if (appointment.event_time) {
        const twoHoursBefore = new Date(appointmentDate);
        twoHoursBefore.setHours(twoHoursBefore.getHours() - 2);
        
        if (twoHoursBefore > now) {
          await localNotifications.schedule([{
            id: 500 + Math.floor(Math.random() * 1000),
            title: tr("appointments_saat_sonra_randevunuz_var", '2 saat sonra randevunuz var!') + ' ⏰',
            body: appointment.title,
            schedule: { at: twoHoursBefore }
          }]);
        }
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const addAppointment = async (appointment: {
    title: string;
    description?: string;
    event_date: string;
    event_time?: string;
    event_type?: string;
    reminder_enabled?: boolean;
  }) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          reminder_enabled: true,
          ...appointment,
        })
        .select()
        .single();

      if (error) throw error;

      // Schedule notification if reminder enabled
      if (appointment.reminder_enabled !== false) {
        await scheduleAppointmentNotification({
          ...appointment,
          reminder_enabled: true,
        });
      }

      toast({
        title: tr("useappointments_randevu_elave_edildi_dc2666", "Randevu əlavə edildi! 📅"),
        description: appointment.title,
      });

      await fetchAppointments();
      return data;
    } catch (error: any) {
      console.error('Error adding appointment:', error);
      toast({
        title: tr("useappointments_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchAppointments();
    } catch (error: any) {
      console.error('Error updating appointment:', error);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: tr("appointments_randevu_silindi", 'Randevu silindi'),
      });

      await fetchAppointments();
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
    }
  };

  const getUpcoming = (days: number = 7) => {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    return appointments.filter(apt => {
      const aptDate = new Date(apt.event_date);
      return aptDate >= today && aptDate <= endDate;
    });
  };

  const getByDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(apt => apt.event_date === dateStr);
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  return {
    appointments,
    loading,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getUpcoming,
    getByDate,
    refetch: fetchAppointments,
  };
};
