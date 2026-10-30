import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Partner Module 2.0 — paylaşım icazələri.
 * Ana (data sahibi) partnyorun nəyi görə biləcəyini idarə edir.
 * Sətir yoxdursa və ya cədvəl hələ migrate olunmayıbsa → default-lar işləyir
 * (hamısı açıq, çəki bağlı).
 */

export interface PartnerSharingSettings {
  share_mood: boolean;
  share_symptoms: boolean;
  share_water: boolean;
  share_kicks: boolean;
  share_contractions: boolean;
  share_weight: boolean;
  share_appointments: boolean;
  share_baby_logs: boolean;
  share_cycle: boolean;
}

export const DEFAULT_SHARING: PartnerSharingSettings = {
  share_mood: true,
  share_symptoms: true,
  share_water: true,
  share_kicks: true,
  share_contractions: true,
  share_weight: false,
  share_appointments: true,
  share_baby_logs: true,
  share_cycle: true
};

export type SharingKey = keyof PartnerSharingSettings;

const SHARING_KEYS = Object.keys(DEFAULT_SHARING) as SharingKey[];

const pickSettings = (row: any): PartnerSharingSettings => {
  const out = { ...DEFAULT_SHARING };
  if (row && typeof row === 'object') {
    for (const k of SHARING_KEYS) {
      if (typeof row[k] === 'boolean') out[k] = row[k];
    }
  }
  return out;
};

// ── Ana tərəfi: öz ayarlarını oxu/yaz ──────────────────────────
export const usePartnerSharing = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PartnerSharingSettings>(DEFAULT_SHARING);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true); // cədvəl mövcuddurmu

  const fetchSettings = useCallback(async () => {
    if (!user) {setLoading(false);return;}
    try {
      const { data, error } = await (supabase as any).
      from('partner_sharing_settings').
      select('*').
      eq('user_id', user.id).
      maybeSingle();

      if (error) {
        // Cədvəl hələ yaradılmayıb — default-larla davam et
        console.warn('partner_sharing_settings unavailable:', error.message);
        setAvailable(false);
      } else {
        setSettings(pickSettings(data));
      }
    } catch (e) {
      console.warn('partner_sharing_settings fetch failed:', e);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: SharingKey, value: boolean): Promise<boolean> => {
    if (!user) return false;
    const prev = settings;
    const next = { ...settings, [key]: value };
    setSettings(next); // optimistic
    try {
      const { error } = await (supabase as any).
      from('partner_sharing_settings').
      upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      invalidateSharingCache(); // events sent from this device follow the new choice immediately
      return true;
    } catch (e) {
      console.error('updateSetting failed:', e);
      setSettings(prev); // rollback
      return false;
    }
  }, [user, settings]);

  return { settings, updateSetting, loading, available, refetch: fetchSettings };
};

// ── Partnyor tərəfi: ananın ayarlarını oxu (realtime) ──────────
export const usePartnerSharedSettings = () => {
  const { user, profile } = useAuth();
  const [sharing, setSharing] = useState<PartnerSharingSettings>(DEFAULT_SHARING);
  const [loading, setLoading] = useState(true);

  const fetchSharing = useCallback(async () => {
    if (!user || !profile?.linked_partner_id) {setLoading(false);return;}
    try {
      // RLS: yalnız öz sətrim + linked ananın sətri görünür
      const { data, error } = await (supabase as any).
      from('partner_sharing_settings').
      select('*').
      neq('user_id', user.id).
      limit(1);

      if (!error && data && data.length > 0) {
        setSharing(pickSettings(data[0]));
      } else {
        setSharing(DEFAULT_SHARING);
      }
    } catch {
      setSharing(DEFAULT_SHARING);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.linked_partner_id]);

  useEffect(() => {
    fetchSharing();
  }, [fetchSharing]);

  useEffect(() => {
    if (!profile?.linked_partner_id) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Ana toggle dəyişən kimi partnyor UI yenilənsin — yalnız ananın
      // user_id-sinə filtrlənir, bütün partner_sharing_settings cədvəlinə yox.
      const { data: motherProfile } = await supabase.
      from('profiles').
      select('user_id').
      eq('id', profile.linked_partner_id).
      single();
      if (cancelled || !motherProfile?.user_id) return;

      channel = supabase.
      channel(`partner-sharing-${profile.linked_partner_id}:${crypto.randomUUID()}`).
      on('postgres_changes', { event: '*', schema: 'public', table: 'partner_sharing_settings', filter: `user_id=eq.${motherProfile.user_id}` }, () => {
        fetchSharing();
      }).
      subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchSharing, profile?.linked_partner_id]);

  return { sharing, loading, refetch: fetchSharing };
};

// ── Event-bus üçün yüngül cache-li yoxlama (hook-suz) ──────────
let _sharingCache: { userId: string; settings: PartnerSharingSettings; ts: number } | null = null;
const SHARING_CACHE_TTL = 60_000;

export const getOwnSharingSettings = async (userId: string): Promise<PartnerSharingSettings> => {
  if (_sharingCache && _sharingCache.userId === userId && Date.now() - _sharingCache.ts < SHARING_CACHE_TTL) {
    return _sharingCache.settings;
  }
  try {
    const { data, error } = await (supabase as any).
    from('partner_sharing_settings').
    select('*').
    eq('user_id', userId).
    maybeSingle();
    const settings = error ? DEFAULT_SHARING : pickSettings(data);
    _sharingCache = { userId, settings, ts: Date.now() };
    return settings;
  } catch {
    return DEFAULT_SHARING;
  }
};

export const invalidateSharingCache = () => {_sharingCache = null;};
