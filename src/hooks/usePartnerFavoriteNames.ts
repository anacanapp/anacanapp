import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { FavoriteName } from './useFavoriteNames';

export const usePartnerFavoriteNames = () => {
  const { profile } = useAuth();
  const [partnerFavorites, setPartnerFavorites] = useState<FavoriteName[]>([]);
  const [loading, setLoading] = useState(true);
  const partnerUserIdRef = useRef<string | null>(null);

  const fetch = useCallback(async () => {
    if (!profile?.linked_partner_id) {
      setPartnerFavorites([]);
      setLoading(false);
      return;
    }
    try {
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profile.linked_partner_id)
        .single();

      if (!partnerProfile?.user_id) {
        setPartnerFavorites([]);
        return;
      }
      partnerUserIdRef.current = partnerProfile.user_id;

      const { data, error } = await supabase
        .from('favorite_names')
        .select('*')
        .eq('user_id', partnerProfile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartnerFavorites((data || []) as FavoriteName[]);
    } catch (e) {
      console.error('Partner favorites fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.linked_partner_id]);

  useEffect(() => {
    if (!profile?.linked_partner_id) {
      fetch();
      return;
    }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetch();
      // Yalnız partnyorun user_id-si məlum olduqdan sonra, ona filtrlənmiş
      // realtime kanalı açırıq — bütün favorite_names cədvəlinə yox.
      if (cancelled || !partnerUserIdRef.current) return;
      channel = supabase
        .channel(`partner_favorite_names_${profile.linked_partner_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'favorite_names', filter: `user_id=eq.${partnerUserIdRef.current}` }, () => fetch())
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.linked_partner_id, fetch]);

  return { partnerFavorites, loading, refetch: fetch };
};
