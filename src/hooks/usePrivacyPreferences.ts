import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { CUSTOMER_IO_CONSENT_EVENT } from '@/lib/customerio';

/**
 * Privacy toggle-larının DB persist-i (user_preferences).
 * Əvvəllər bu ayarlar yalnız local state idi — heç yerə yazılmırdı.
 * Sütunlar migration-a qədər yoxdursa → default-larla işləyir, yazma xətası revert edir.
 */

export interface PrivacyPrefs {
  privacy_profile_visible: boolean;
  privacy_show_in_community: boolean;
  privacy_allow_messages: boolean;
  privacy_share_analytics: boolean;
  privacy_location_sharing: boolean;
  privacy_notification_sounds: boolean;
}

export const DEFAULT_PRIVACY: PrivacyPrefs = {
  privacy_profile_visible: true,
  privacy_show_in_community: true,
  privacy_allow_messages: true,
  privacy_share_analytics: false,
  privacy_location_sharing: true,
  privacy_notification_sounds: true
};

const KEYS = Object.keys(DEFAULT_PRIVACY) as (keyof PrivacyPrefs)[];

export const usePrivacyPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {setLoading(false);return;}
      try {
        const { data, error } = await (supabase as any).
        from('user_preferences').
        select(KEYS.join(', ')).
        eq('user_id', user.id).
        maybeSingle();

        if (!cancelled && !error && data) {
          const next = { ...DEFAULT_PRIVACY };
          for (const k of KEYS) {
            if (typeof data[k] === 'boolean') next[k] = data[k];
          }
          setPrefs(next);
        }
      } catch (e) {
        console.warn('privacy prefs unavailable:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, [user]);

  const updatePref = useCallback(async (key: keyof PrivacyPrefs, value: boolean): Promise<boolean> => {
    if (!user) return false;
    const prev = prefs;
    const notifyAnalytics = (allowed: boolean) => window.dispatchEvent(new CustomEvent(CUSTOMER_IO_CONSENT_EVENT, {
      detail: { userId: user.id, backend: getBackendConfig().url, allowed },
    }));
    if (key === 'privacy_share_analytics' && !value) notifyAnalytics(false);
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic
    try {
      const { error } = await (supabase as any).
      from('user_preferences').
      upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' });
      if (error) throw error;
      if (key === 'privacy_share_analytics') notifyAnalytics(value);
      return true;
    } catch (e) {
      console.error('privacy pref save failed:', e);
      setPrefs(prev); // revert
      if (key === 'privacy_share_analytics') notifyAnalytics(prev.privacy_share_analytics);
      return false;
    }
  }, [user, prefs]);

  return { prefs, updatePref, loading };
};
