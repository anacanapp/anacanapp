import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PushSettings {
  push_enabled: boolean;
  push_messages: boolean;
  push_likes: boolean;
  push_comments: boolean;
  push_community: boolean;
}

const defaultSettings: PushSettings = {
  push_enabled: true,
  push_messages: true,
  push_likes: true,
  push_comments: true,
  push_community: true,
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PushSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('push_enabled, push_messages, push_likes, push_comments, push_community')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching push settings:', error);
      }

      if (data) {
        setSettings({
          push_enabled: data.push_enabled ?? true,
          push_messages: data.push_messages ?? true,
          push_likes: data.push_likes ?? true,
          push_comments: data.push_comments ?? true,
          push_community: data.push_community ?? true,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async <K extends keyof PushSettings>(
    key: K,
    value: PushSettings[K]
  ) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating push setting:', error);
        // Revert on error
        setSettings(settings);
      }
    } catch (error) {
      console.error('Error:', error);
      setSettings(settings);
    }
  }, [user, settings]);

  return {
    settings,
    loading,
    updateSetting,
    refetch: fetchSettings,
  };
};
