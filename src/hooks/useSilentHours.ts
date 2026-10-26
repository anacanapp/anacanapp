import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SilentHoursSettings {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

const defaultSettings: SilentHoursSettings = {
  enabled: false,
  startTime: '22:00',
  endTime: '08:00',
};

export const useSilentHours = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SilentHoursSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('silent_hours_enabled, silent_hours_start, silent_hours_end')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading silent hours:', error);
        }

        if (data) {
          setSettings({
            enabled: data.silent_hours_enabled ?? false,
            startTime: data.silent_hours_start ?? '22:00',
            endTime: data.silent_hours_end ?? '08:00',
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

  // Update settings - persists to database
  const updateSettings = useCallback(async (updates: Partial<SilentHoursSettings>) => {
    if (!user) return;

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    // Persist to database
    try {
      const dbUpdates: Record<string, unknown> = { user_id: user.id };
      
      if ('enabled' in updates) {
        dbUpdates.silent_hours_enabled = updates.enabled;
      }
      if ('startTime' in updates) {
        dbUpdates.silent_hours_start = updates.startTime;
      }
      if ('endTime' in updates) {
        dbUpdates.silent_hours_end = updates.endTime;
      }

      const { error } = await supabase
        .from('user_preferences')
        .update(dbUpdates)
        .eq('user_id', user.id);

      // If no row exists, insert it
      if (error && error.code === 'PGRST116') {
        await supabase
          .from('user_preferences')
          .insert({ user_id: user.id, ...dbUpdates });

      } else if (error) {
        console.error('Error saving silent hours:', error);
        setSettings(settings); // Revert on error
      }
    } catch (error) {
      console.error('Error:', error);
      setSettings(settings);
    }

    // Also save to localStorage for chat-notifications lib
    if (user) {
      localStorage.setItem(`silent_hours_${user.id}`, JSON.stringify(newSettings));
    }
  }, [user, settings]);

  // Check if current time is within silent hours
  const isInSilentHours = useCallback((): boolean => {
    if (!settings.enabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = settings.startTime.split(':').map(Number);
    const [endH, endM] = settings.endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight ranges (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  }, [settings]);

  return {
    settings,
    loading,
    updateSettings,
    isInSilentHours,
  };
};
