import { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { notifyIncomingChatMessage } from '@/lib/chat-notifications';

export interface PartnerMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_type: string;
  content: string | null;
  is_read: boolean;
  created_at: string;
}

// Modul-səviyyəli PAYLAŞILAN realtime kanal — bir neçə komponent (BottomNav, Dashboard,
// PartnerCareCard, PartnerActivityFeed və s.) eyni anda bu hook-u çağırır. ƏVVƏLKİ BUG:
// hər instansiya öz kanalını açıb-bağlayırdı — Supabase JS eyni topic üçün TƏK obyekt
// qaytarsa da, İSTƏNİLƏN instansiyanın unmount təmizləməsi (`removeChannel`) HAMISI üçün
// server-side abunəliyi öldürürdü. Konkret nəticə: BottomNav həmişə mount olunub qalsa da,
// Dashboard (Home tab-dan çıxanda unmount olur) təmizləyəndə BottomNav-ın "oxunmamış"
// nişanı bir daha CANLI yenilənmirdi (yalnız ilk yükləmə statik qalırdı). İndi YALNIZ
// son mount olunmuş instansiya real təmizləmə edir + toast/push bildirişi TƏK dəfə
// (kanalın .on() callback-i artıq YALNIZ bir dəfə — ilk yaradılışda — təyin olunur).
// Kanal user id-yə görə açarlanır: hesab dəyişəndə yeni istifadəçi üçün filtrlənmiş
// kanal qurulur (əvvəl ilk user.id-li kanal qalırdı).
interface PartnerMsgsSharedEntry {
  channel: ReturnType<typeof supabase.channel>;
  subscribers: Map<symbol, () => void>;
}
const partnerMsgsSharedChannels = new Map<string, PartnerMsgsSharedEntry>();

export const usePartnerMessages = () => {
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.
      from('partner_messages').
      select('*').
      or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).
      order('created_at', { ascending: false }).
      limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching partner messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, messageType: string, content?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.
      from('partner_messages').
      insert({
        sender_id: user.id,
        receiver_id: receiverId,
        message_type: messageType,
        content: content || null
      }).
      select().
      single();

      if (error) throw error;

      if (messageType === 'love') {
        toast({
          title: tr("usepartnermessages_sevgi_gonderildi_14b554", "Sevgi göndərildi! ❤️"),
          description: tr("usepartnermessages_partnyorunuz_bildiris_alacaq_62f7d7", "Partnyorunuz bildiriş alacaq")
        });
      } else {
        toast({
          title: tr("usepartnermessages_mesaj_gonderildi_353ca0", "Mesaj göndərildi! 💬")
        });
      }

      await fetchMessages();
      return data;
    } catch (error: any) {
      console.error('Error sending partner message:', error);
      toast({
        title: tr("usepartnermessages_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }
  };

  const sendLoveToPartner = async () => {
    if (!profile?.linked_partner_id) {
      toast({
        title: tr("usepartnermessages_partnyor_tapilmadi_1239a8", "Partnyor tapılmadı"),
        description: tr("usepartnermessages_evvelce_partnyorla_elaqelenin_2378fa", "Əvvəlcə partnyorla əlaqələnin"),
        variant: 'destructive'
      });
      return null;
    }

    // Get partner's user_id from their profile id
    const { data: partnerProfile } = await supabase.
    from('profiles').
    select('user_id').
    eq('id', profile.linked_partner_id).
    single();

    if (!partnerProfile) {
      toast({
        title: tr("usepartnermessages_partnyor_tapilmadi_1239a8", "Partnyor tapılmadı"),
        variant: 'destructive'
      });
      return null;
    }

    return sendMessage(partnerProfile.user_id, 'love', '❤️');
  };

  const markAsRead = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.
      from('partner_messages').
      update({ is_read: true }).
      eq('id', id).
      eq('receiver_id', user.id);

      if (error) throw error;
      await fetchMessages();
    } catch (error: any) {
      console.error('Error marking message as read:', error);
    }
  };

  const getUnreadCount = () => {
    return messages.filter((m) => m.receiver_id === user?.id && !m.is_read).length;
  };

  useEffect(() => {
    fetchMessages();
  }, [user]);

  // Realtime subscription — ref-sayğaclı paylaşılan kanal (bax fayl başındakı modul-səviyyəli dəyişənlər)
  // Həmişə ən son render-in fetchMessages/toast-unu çağır (köhnə closure-lar yox).
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const realtimeUserId = user?.id ?? null;
  useEffect(() => {
    if (!realtimeUserId) return;

    const token = Symbol('partner-messages-subscriber');
    let entry = partnerMsgsSharedChannels.get(realtimeUserId);
    if (!entry) {
    const subscribers = new Map<symbol, () => void>();
    const toast = (...args: Parameters<typeof toastRef.current>) => toastRef.current(...args);
    const channel = supabase.
    channel(`partner_messages_changes:${realtimeUserId}:${crypto.randomUUID()}`).
    on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'partner_messages',
        filter: `receiver_id=eq.${realtimeUserId}`
      },
      (payload) => {
        // Bütün mount olunmuş instansiyaların öz siyahısını təzələ (hər birinin öz local state-i var)
        subscribers.forEach((cb) => cb());
        const newMessage = payload.new as any;

        if (newMessage) {
          // Parse notification content if available
          let notificationData: any = null;
          try {
            if (newMessage.content) {
              notificationData = JSON.parse(newMessage.content);
            }
          } catch {

            // Content is not JSON, use as-is
          }
          // Trigger native phone notification for text/love messages
          if (['text', 'love'].includes(newMessage.message_type)) {
            const title = newMessage.message_type === 'love' ? tr("usepartnermessages_sevgi_aldiniz_346423", "Sevgi ald\u0131n\u0131z! \u2764\uFE0F") : tr("usepartnermessages_yeni_mesaj_title", "Yeni mesaj 💬");
            const body = newMessage.message_type === 'love' ? tr("usepartnermessages_partnyorunuz_size_sevgi_gonder_765fb4", "Partnyorunuz siz\u0259 sevgi g\xF6nd\u0259rdi") :

            typeof newMessage.content === 'string' ? newMessage.content.slice(0, 60) : tr("usepartnermessages_mesaj_geldi_9e478b", "Mesaj g\u0259ldi");
            void notifyIncomingChatMessage({ title, body, idSeed: Date.now(), userId: realtimeUserId });
          }

          // Show appropriate toast based on message type
          switch (newMessage.message_type) {
            case 'love':
              toast({
                title: tr("usepartnermessages_sevgi_aldiniz_346423", "Sevgi aldınız! ❤️"),
                description: tr("usepartnermessages_partnyorunuz_size_sevgi_gonderdi_765fb4", "Partnyorunuz sizə sevgi göndərdi")
              });
              break;
            case 'mood_update':
              toast({
                title: notificationData?.title || tr("usepartnermessages_ehval_yenilendi_967cd7", "\u018Fhval yenil\u0259ndi \uD83D\uDCAD"),
                description: notificationData?.body || tr("usepartnermessages_partnyorunuz_ehvalini_qeyd_etd_612302", "Partnyorunuz \u0259hval\u0131n\u0131 qeyd etdi")
              });
              break;
            case 'contraction_started':
              toast({
                title: notificationData?.title || tr("usepartnermessages_sanci_basladi_c51f20", "Sanc\u0131 ba\u015Flad\u0131! \u23F1\uFE0F"),
                description: notificationData?.body || tr("usepartnermessages_partnyorunuz_sanci_qeyd_etdi_ac77ff", "Partnyorunuz sanc\u0131 qeyd etdi")
              });
              break;
            case 'contraction_511':
              toast({
                title: tr("usepartnermessages_5_1_1_qaydasi_976061", "⚠️ 5-1-1 Qaydası!"),
                description: tr("usepartnermessages_xestexanaya_getme_vaxti_ola_biler_b244c0", "Xəstəxanaya getmə vaxtı ola bilər!")
                // Use destructive variant for urgent notifications
              });
              break;
            case 'kick_session':
              toast({
                title: notificationData?.title || tr("usepartnermessages_korpe_tepik_atdi_628b12", "K\xF6rp\u0259 t\u0259pik atd\u0131! \uD83D\uDC76"),
                description: notificationData?.body
              });
              break;
            case 'water_goal':
              toast({
                title: notificationData?.title || tr("usepartnermessages_su_hedefine_catdi_55f2fb", "Su h\u0259d\u0259fin\u0259 \xE7atd\u0131! \uD83D\uDCA7"),
                description: tr("usepartnermessages_partnyorunuz_gundelik_su_hedefine_catdi_f06510", "Partnyorunuz gündəlik su hədəfinə çatdı!")
              });
              break;
            default:
              if (notificationData?.title) {
                toast({
                  title: notificationData.title,
                  description: notificationData.body
                });
              }
          }
        }
      }
    ).
    subscribe();
    entry = { channel, subscribers };
    partnerMsgsSharedChannels.set(realtimeUserId, entry);
    }
    entry.subscribers.set(token, () => { void fetchMessagesRef.current(); });

    return () => {
      const current = partnerMsgsSharedChannels.get(realtimeUserId);
      if (!current) return;
      current.subscribers.delete(token);
      if (current.subscribers.size === 0) {
        partnerMsgsSharedChannels.delete(realtimeUserId);
        supabase.removeChannel(current.channel);
      }
    };
  }, [realtimeUserId]);

  return {
    messages,
    loading,
    sendMessage,
    sendLoveToPartner,
    markAsRead,
    getUnreadCount,
    refetch: fetchMessages
  };
};