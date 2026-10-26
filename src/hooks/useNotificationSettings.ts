import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { localNotifications, isNative } from '@/lib/native';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useUserStore } from '@/store/userStore';

interface NotificationSettings {
  notifications_enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  water_reminder: boolean;
  vitamin_reminder: boolean;
  exercise_reminder: boolean;
  vitamin_time: string; // HH:MM format
  exercise_days: number[]; // 0-6 (Sunday-Saturday)
}

const defaultSettings: NotificationSettings = {
  notifications_enabled: true,
  sound_enabled: true,
  vibration_enabled: true,
  water_reminder: true,
  vitamin_reminder: true,
  exercise_reminder: false,
  vitamin_time: '09:00',
  exercise_days: [1, 3, 5] // Monday, Wednesday, Friday
};

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const language = useUserStore(s => s.language);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.
        from('user_preferences').
        select('notifications_enabled, sound_enabled, vibration_enabled, water_reminder, vitamin_reminder, exercise_reminder, vitamin_time, exercise_days').
        eq('user_id', user.id).
        single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading notification settings:', error);
        }

        if (data) {
          setSettings({
            notifications_enabled: data.notifications_enabled ?? true,
            sound_enabled: data.sound_enabled ?? true,
            vibration_enabled: data.vibration_enabled ?? true,
            water_reminder: data.water_reminder ?? true,
            vitamin_reminder: data.vitamin_reminder ?? true,
            exercise_reminder: data.exercise_reminder ?? false,
            vitamin_time: data.vitamin_time ?? '09:00',
            exercise_days: data.exercise_days ?? [1, 3, 5]
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Schedule the water reminder — exactly ONE notification per day at 10:00
  // (repeats daily). Legacy every-2-hours reminders are cancelled first.
  const scheduleWaterReminders = useCallback(async () => {
    if (!settings.notifications_enabled || !settings.water_reminder || !isNative) {
      return;
    }

    await localNotifications.scheduleWaterReminder();
    console.log('Scheduled daily water reminder (10:00)');
  }, [settings.notifications_enabled, settings.water_reminder, language]);

  // Schedule vitamin reminder
  const scheduleVitaminReminder = useCallback(async () => {
    if (!settings.notifications_enabled || !settings.vitamin_reminder || !isNative) {
      return;
    }

    const now = new Date();
    const [hours, minutes] = settings.vitamin_time.split(':').map(Number);

    const reminderTime = new Date(now);
    reminderTime.setHours(hours, minutes, 0, 0);

    // If time passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    await localNotifications.schedule([{
      id: 200,
      title: tr("usenotificationsettings_vitamin_vaxti_9bfc40", "Vitamin vaxtı! 💊"),
      body: tr("usenotificationsettings_gundelik_vitaminlerinizi_qebul_6a3811", "Gündəlik vitaminlərinizi qəbul etməyi unutmayın."),
      schedule: { at: reminderTime }
    }]);
    console.log('Scheduled vitamin reminder');
  }, [settings.notifications_enabled, settings.vitamin_reminder, settings.vitamin_time, language]);

  // Schedule exercise reminders
  const scheduleExerciseReminders = useCallback(async () => {
    if (!settings.notifications_enabled || !settings.exercise_reminder || !isNative) {
      return;
    }

    const now = new Date();
    const reminders = [];

    // Schedule for next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);

      const dayOfWeek = checkDate.getDay();

      if (settings.exercise_days.includes(dayOfWeek)) {
        const reminderTime = new Date(checkDate);
        reminderTime.setHours(10, 0, 0, 0);

        if (reminderTime > now) {
          reminders.push({
            id: 300 + i,
            title: tr("usenotificationsettings_mesq_vaxti_4a1396", "Məşq vaxtı! 🧘‍♀️"),
            body: tr("usenotificationsettings_hamilelik_ucun_saglam_mesqler__015e22", "Hamil\u0259lik \xFC\xE7\xFCn sa\u011Flam m\u0259\u015Fql\u0259r ed\u0259r\u0259k g\xFCn\u0259 enerji il\u0259 ba\u015Flay\u0131n."),
            schedule: { at: reminderTime }
          });
        }
      }
    }

    if (reminders.length > 0) {
      await localNotifications.schedule(reminders);
      console.log(`Scheduled ${reminders.length} exercise reminders`);
    }
  }, [settings.notifications_enabled, settings.exercise_reminder, settings.exercise_days, language]);

  // Schedule appointment reminder
  const scheduleAppointmentReminder = useCallback(async (appointmentDate: Date, title: string) => {
    if (!settings.notifications_enabled || !isNative) {
      return;
    }

    const reminderTime = new Date(appointmentDate);
    reminderTime.setDate(reminderTime.getDate() - 1);
    reminderTime.setHours(10, 0, 0, 0);

    const now = new Date();
    if (reminderTime <= now) {
      // If reminder time passed, set for same day morning
      reminderTime.setTime(appointmentDate.getTime());
      reminderTime.setHours(8, 0, 0, 0);

      if (reminderTime <= now) {
        return; // Skip if appointment is too soon
      }
    }

    await localNotifications.schedule([{
      id: 400 + Math.floor(Math.random() * 100),
      title: tr("appointments_sabah_randevunuz_var", 'Sabah randevunuz var!') + ' 📅',
      body: title,
      schedule: { at: reminderTime }
    }]);

    toast.success(tr("usenotificationsettings_randevu_xatirlatmasi_teyin_edi_48cc3e", "Randevu xat\u0131rlatmas\u0131 t\u0259yin edildi"));
  }, [settings.notifications_enabled]);

  // Update a single setting - persists to database
  const updateSetting = useCallback(async <K extends keyof NotificationSettings,>(
  key: K,
  value: NotificationSettings[K]) =>
  {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Persist to database
    try {
      const { error } = await supabase.
      from('user_preferences').
      update({ [key]: value }).
      eq('user_id', user.id);

      // If no row exists, insert it
      if (error && error.code === 'PGRST116') {
        await supabase.
        from('user_preferences').
        insert({ user_id: user.id, [key]: value });
      } else if (error) {
        console.error('Error saving notification setting:', error);
        // Revert on error
        setSettings(settings);
        return;
      }
    } catch (error) {
      console.error('Error:', error);
      setSettings(settings);
      return;
    }

    // Cancel all notifications if disabled
    if (key === 'notifications_enabled' && !value) {
      if (isNative) {
        await localNotifications.cancelAll();
      }
      toast.info(tr("usenotificationsettings_butun_bildirisler_deaktiv_edil_085777", "B\xFCt\xFCn bildiri\u015Fl\u0259r deaktiv edildi"));
      return;
    }

    // Re-schedule notifications based on changes
    if (key === 'water_reminder') {
      // Mirror to localStorage so app-start scheduling (initializeNativeFeatures)
      // respects the toggle even before the DB settings are loaded.
      try {
        localStorage.setItem('anacan_water_reminder_enabled', value ? 'true' : 'false');
      } catch {
        // ignore storage errors
      }
      if (value) {
        await scheduleWaterReminders();
        toast.success(tr("usenotificationsettings_su_xatirlatmalari_aktivlesdiri_dd0c67", "Su xat\u0131rlatmalar\u0131 aktivl\u0259\u015Fdirildi"));
      } else {
        if (isNative) {
          await localNotifications.cancelWaterReminders();
        }
        toast.info(tr("usenotificationsettings_su_xatirlatmalari_deaktiv_edil_153c1c", "Su xat\u0131rlatmalar\u0131 deaktiv edildi"));
      }
    }

    if (key === 'vitamin_reminder' || key === 'vitamin_time') {
      if (newSettings.vitamin_reminder) {
        await scheduleVitaminReminder();
        toast.success(tr("usenotificationsettings_vitamin_xatirlatmasi_aktivlesd_866e4a", "Vitamin xat\u0131rlatmas\u0131 aktivl\u0259\u015Fdirildi"));
      }
    }

    if (key === 'exercise_reminder' || key === 'exercise_days') {
      if (newSettings.exercise_reminder) {
        await scheduleExerciseReminders();
        toast.success(tr("usenotificationsettings_mesq_xatirlatmalari_aktivlesdi_ea41d4", "M\u0259\u015Fq xat\u0131rlatmalar\u0131 aktivl\u0259\u015Fdirildi"));
      }
    }
  }, [user, settings, scheduleWaterReminders, scheduleVitaminReminder, scheduleExerciseReminders]);

  // Initialize all reminders
  const initializeReminders = useCallback(async () => {
    if (!settings.notifications_enabled || !isNative) return;

    // Request permissions first
    const permStatus = await localNotifications.requestPermissions();
    if (permStatus.display !== 'granted') {
      toast.error(tr("usenotificationsettings_bildiris_icazesi_verilmedi_a6583b", "Bildiri\u015F icaz\u0259si verilm\u0259di"));
      return;
    }

    // Schedule all enabled reminders
    await Promise.all([
    settings.water_reminder ? scheduleWaterReminders() : Promise.resolve(),
    settings.vitamin_reminder ? scheduleVitaminReminder() : Promise.resolve(),
    settings.exercise_reminder ? scheduleExerciseReminders() : Promise.resolve()]
    );

    console.log('All reminders initialized');
  }, [settings, scheduleWaterReminders, scheduleVitaminReminder, scheduleExerciseReminders]);

  return {
    settings,
    loading,
    updateSetting,
    scheduleAppointmentReminder,
    initializeReminders,
    isNative
  };
};