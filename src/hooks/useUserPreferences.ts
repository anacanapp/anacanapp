import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPreferences {
  id: string;
  user_id: string;
  white_noise_volume: number;
  white_noise_timer: number | null;
  last_white_noise_sound: string | null;
  created_at: string;
  updated_at: string;
}

export const useUserPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default preferences
        await createDefaultPreferences();
      } else {
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          white_noise_volume: 70,
          white_noise_timer: null,
          last_white_noise_sound: null,
        }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) setPreferences(data);
    } catch (error) {
      console.error('Error creating default preferences:', error);
    }
  };

  const updatePreferences = async (updates: Partial<Pick<UserPreferences, 'white_noise_volume' | 'white_noise_timer' | 'last_white_noise_sound'>>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) setPreferences(data);
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  };

  const updateWhiteNoiseVolume = async (volume: number) => {
    await updatePreferences({ white_noise_volume: volume });
  };

  const updateWhiteNoiseTimer = async (timer: number | null) => {
    await updatePreferences({ white_noise_timer: timer });
  };

  const updateLastWhiteNoiseSound = async (soundId: string | null) => {
    await updatePreferences({ last_white_noise_sound: soundId });
  };

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  return {
    preferences,
    loading,
    updatePreferences,
    updateWhiteNoiseVolume,
    updateWhiteNoiseTimer,
    updateLastWhiteNoiseSound,
    refetch: fetchPreferences,
  };
};
