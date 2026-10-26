import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import type { PushEventData } from '@/lib/push';
import { useAuth } from './useAuth';
import { usePrivacyPreferences } from './usePrivacyPreferences';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface SOSAlert {
  id: string;
  sender_id: string;
  receiver_id: string;
  alert_type: string;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

// Module-level dedupe so one SOS alert vibrates once across all mounted hooks.
const buzzedSosAlertIds = new Set<string>();
const claimSosHaptic = (alertId: string | undefined) => {
  if (!alertId) return true;
  if (buzzedSosAlertIds.has(alertId)) return false;
  buzzedSosAlertIds.add(alertId);
  if (buzzedSosAlertIds.size > 200) {
    const oldest = buzzedSosAlertIds.values().next().value;
    if (oldest !== undefined) buzzedSosAlertIds.delete(oldest);
  }
  return true;
};

export const useSOSAlert = () => {
  const { user, profile } = useAuth();
  // DÜZƏLİŞ: "Məkan paylaşımı" gizlilik keçidi (PartnerPrivacyScreen.tsx)
  // istifadəçiyə nəzarət hissi verirdi, amma əvvəllər burada HEÇ YOXLANILMIRDI
  // — keçid söndürülsə belə SOS zamanı dəqiq GPS məkanı hər halda tutulub
  // partnyora göndərilirdi. İndi bu preference REAL şəkildə tətbiq olunur.
  const { prefs: privacyPrefs } = usePrivacyPreferences();
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAlert, setPendingAlert] = useState<SOSAlert | null>(null);

  const getPartnerUserId = useCallback(async (): Promise<string | null> => {
    if (!profile?.linked_partner_id) return null;

    try {
      const { data, error } = await supabase.
      from('profiles').
      select('user_id').
      eq('id', profile.linked_partner_id).
      single();

      if (error || !data) return null;
      return data.user_id;
    } catch {
      return null;
    }
  }, [profile?.linked_partner_id]);

  const fetchAlerts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.
      from('sos_alerts').
      select('*').
      or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).
      order('created_at', { ascending: false }).
      limit(20);

      if (error) throw error;
      setAlerts((data || []) as SOSAlert[]);

      // Check for unacknowledged alerts where I'm the receiver
      const pending = data?.find(
        (a) => a.receiver_id === user.id && !a.is_acknowledged
      );
      setPendingAlert(pending as SOSAlert || null);
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
    }
  };

  const getCurrentLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    locationName?: string;
  } | null> => {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          return null;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const sendSOS = async (
  message?: string,
  includeLocation: boolean = true,
  alertType: 'emergency' | 'birth' = 'emergency') =>
  {
    if (!user) return { error: 'No user logged in' };

    setLoading(true);

    try {
      // Haptic feedback
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}

      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) {
        return { error: 'No partner linked' };
      }

      // Çağıran includeLocation=true göndərsə belə, istifadəçinin özü
      // "Məkan paylaşımı"nı söndürübsə (privacy_location_sharing=false),
      // GPS heç tutulmur — siqnal/mesaj yenə göndərilir, sadəcə koordinatsız.
      let location = null;
      if (includeLocation && privacyPrefs.privacy_location_sharing) {
        location = await getCurrentLocation();
      }

      const isBirth = alertType === 'birth';
      const defaultMessage = isBirth ?
      tr("usesosalert_dogus_basladi_msg", "Do\u011Fu\u015F ba\u015Flad\u0131! X\u0259st\u0259xanaya getm\u0259 vaxt\u0131d\u0131r!") :
      tr("usesosalert_teci_li_mene_komek_lazimdir_032838", "T\u018FC\u0130L\u0130! M\u0259n\u0259 k\xF6m\u0259k laz\u0131md\u0131r!");

      const { data, error } = await supabase.
      from('sos_alerts').
      insert({
        sender_id: user.id,
        receiver_id: partnerUserId,
        alert_type: alertType,
        message: message || defaultMessage,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        location_name: location?.locationName || null
      }).
      select().
      single();

      if (error) throw error;

      const pushTitle = isBirth ?
      tr("usesosalert_dogus_siqnali_title", "\uD83D\uDC76 DO\u011EU\u015E S\u0130QNALI!") :
      tr("usesosalert_tecili_xeberdarliq_5bfb41", "🆘 TƏCİLİ XƏBƏRDARLIQ!");
      const pushBody = message || (isBirth ?
      tr("usesosalert_dogus_basladi_push_body", "Sanc\u0131lar ba\u015Flad\u0131 \u2014 d\u0259rhal \u0259laq\u0259 saxla!") :
      tr("usesosalert_partnyorunuz_tecili_komek_iste_b7a70c", "Partnyorunuz t\u0259cili k\xF6m\u0259k ist\u0259yir!"));

      // Also send a partner message for in-app notification
      try {
        await supabase.from('partner_messages').insert({
          sender_id: user.id,
          receiver_id: partnerUserId,
          message_type: isBirth ? 'birth_alert' : 'sos_alert',
          content: JSON.stringify({
            type: isBirth ? 'birth_alert' : 'sos_alert',
            title: pushTitle,
            body: pushBody,
            alertId: data.id,
            latitude: location?.latitude,
            longitude: location?.longitude,
            timestamp: new Date().toISOString()
          })
        });
      } catch (msgErr) {
        console.warn('partner_messages insert failed (sos):', msgErr);
      }

      // Kritik hadisə: tətbiq bağlı olsa belə çatsın (FCM push)
      try {
        const { invokeSendPush } = await import('@/lib/push');
        await invokeSendPush({
          userId: data.receiver_id,
          title: pushTitle,
          body: pushBody,
          data: {
            type: isBirth ? 'birth_alert' : 'sos_alert',
            context: 'partner',
            alertId: data.id,
            interactionId: data.id
          } satisfies PushEventData
        });
      } catch (pushErr) {
        console.warn('SOS push failed:', pushErr);
      }

      await fetchAlerts();
      return { data, error: null };
    } catch (error) {
      console.error('Error sending SOS:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.
      from('sos_alerts').
      update({
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      }).
      eq('id', alertId).
      eq('receiver_id', user.id);

      if (error) throw error;

      setPendingAlert(null);
      await fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  // Set up realtime subscription for alerts — mən göndərən VƏ YA qəbul edən
  // olduğum sətirlərə filtrlənmiş iki handler (app-boyu bütün SOS-lara yox).
  useEffect(() => {
    if (!user) return;
    fetchAlerts();

    const channel = supabase.
    channel(`sos_alerts_changes:${crypto.randomUUID()}`).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sos_alerts', filter: `sender_id=eq.${user.id}` },
      () => {
        fetchAlerts();
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sos_alerts', filter: `receiver_id=eq.${user.id}` },
      async (payload) => {
        // Yeni siqnal və mən qəbul edənəm → haptic
        // Several copies of this hook are mounted at once; buzz once per alert.
        const alertId = (payload.new as SOSAlert | undefined)?.id;
        if (payload.eventType === 'INSERT' && (payload.new as SOSAlert).receiver_id === user.id && claimSosHaptic(alertId)) {
          try {
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await Haptics.impact({ style: ImpactStyle.Heavy });
            await Haptics.impact({ style: ImpactStyle.Heavy });
          } catch {}
        }
        fetchAlerts();
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    alerts,
    pendingAlert,
    loading,
    sendSOS,
    acknowledgeAlert,
    hasPartner: !!profile?.linked_partner_id,
    refetch: fetchAlerts
  };
};
