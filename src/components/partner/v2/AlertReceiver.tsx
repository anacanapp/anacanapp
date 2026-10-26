import { motion, AnimatePresence } from 'framer-motion';
import { getLocaleTag } from '@/lib/i18n';
import { Siren, Baby, MapPin, Check, Car } from 'lucide-react';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';

/**
 * Universal SOS/Doğuş siqnalı qəbuledicisi — HƏR İKİ rol üçün mount olunur.
 * birth → xüsusi doğuş ekranı (+ partnyor üçün "Xəstəxana rejimi" CTA)
 * emergency → klassik SOS ekranı.
 */

interface Props {
  isPartner: boolean;
  onHospitalRun?: () => void;
}

const AlertReceiver = ({ isPartner, onHospitalRun }: Props) => {
  const { user } = useAuth();
  const { pendingAlert, acknowledgeAlert } = useSOSAlert();

  if (!pendingAlert) return null;

  const isBirth = pendingAlert.alert_type === 'birth';
  const hasLocation = pendingAlert.latitude !== null && pendingAlert.longitude !== null;

  const openMaps = () => {
    if (!hasLocation) return;
    window.open(`https://maps.google.com/?q=${pendingAlert.latitude},${pendingAlert.longitude}`, '_blank');
  };

  const sendOnMyWay = async () => {
    await hapticFeedback.medium();
    if (!user) return;
    try {
      await supabase.from('partner_messages').insert({
        sender_id: user.id,
        receiver_id: pendingAlert.sender_id,
        message_type: 'text',
        content: tr('partnerv2_yoldayam_msg', 'Yoldayam! 🚗 Tezliklə çatıram!')
      });
    } catch (e) {
      console.error(e);
    }
  };

  const timeStr = new Date(pendingAlert.created_at).toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="a-scope fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 text-center text-white"
        style={{
          background: isBirth ?
          'linear-gradient(165deg, #f2764f 0%, #e0526e 60%, var(--a-pink-ink) 100%)' :
          'linear-gradient(165deg, #e0526e 0%, var(--a-pink-ink) 60%, var(--a-alert-ink) 100%)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)'
        }}>

        {/* Pulsasiya edən ikon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.1, repeat: 4 }}
          className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(255,255,255,0.22)', boxShadow: '0 0 0 18px rgba(255,255,255,0.08)' }}>
          {isBirth ? <Baby size={56} /> : <Siren size={56} />}
        </motion.div>

        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {isBirth ?
          tr('partnerv2_dogus_basladi_receiver', 'DOĞUŞ BAŞLADI!') :
          tr('partnerv2_sos_receiver', 'TƏCİLİ XƏBƏRDARLIQ!')}
        </h1>
        <p style={{ fontSize: 15.5, opacity: 0.92, maxWidth: 300, lineHeight: 1.45 }}>
          {pendingAlert.message}
        </p>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>{timeStr}</p>

        <div className="w-full max-w-sm space-y-3 mt-8">
          {/* Partnyor: doğuşda xəstəxana rejimi */}
          {isBirth && isPartner && onHospitalRun &&
          <button
            onClick={() => {acknowledgeAlert(pendingAlert.id);onHospitalRun();}}
            className="w-full h-14 rounded-full flex items-center justify-center gap-2 font-bold"
            style={{ background: '#ffffff', color: '#b1275b', fontSize: 15.5, boxShadow: '0 16px 32px -12px rgba(0,0,0,0.4)' }}>{/* sabit qırmızı alert fonu üzərində — tema-dan asılı deyil */}
              <Car size={20} />
              {tr('partnerv2_xestexana_rejimi_btn', 'Xəstəxana rejimi — YOLA DÜŞ!')}
            </button>
          }

          {hasLocation &&
          <button
            onClick={openMaps}
            className="w-full h-13 rounded-full flex items-center justify-center gap-2 font-bold"
            style={{ background: 'rgba(255,255,255,0.22)', height: 50, fontSize: 14 }}>
              <MapPin size={18} />
              {tr('partnerv2_lokasiyaya_get', 'Lokasiyaya get')}
            </button>
          }

          {isPartner &&
          <button
            onClick={() => {sendOnMyWay();}}
            className="w-full rounded-full flex items-center justify-center gap-2 font-bold"
            style={{ background: 'rgba(255,255,255,0.16)', height: 50, fontSize: 14 }}>
              🚗 {tr('partnerv2_yoldayam_btn', 'Yoldayam — xəbər ver')}
            </button>
          }

          <button
            onClick={() => acknowledgeAlert(pendingAlert.id)}
            className="w-full rounded-full flex items-center justify-center gap-2 font-bold"
            style={{ background: 'rgba(0,0,0,0.18)', height: 50, fontSize: 14 }}>
            <Check size={18} />
            {tr('partnerv2_gordum_btn', 'Gördüm')}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>);

};

export default AlertReceiver;
