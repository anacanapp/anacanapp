import { tr } from "@/lib/tr";import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/PremiumModal';

const AIChatScreen = lazy(() => import('@/components/AIChatScreen'));

const fallback =
<div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
    <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
  </div>;


const PartnerAIPremiumGate = () => {
  const { isPremium, loading } = useSubscription();
  const [showModal, setShowModal] = useState(false);
  const hadPremium = useRef(false);

  useEffect(() => {
    if (isPremium) { hadPremium.current = true; return; }
    if (hadPremium.current) {
      hadPremium.current = false;
      setShowModal(true);
    }
  }, [isPremium]);

  if (loading) return fallback;

  if (isPremium) {
    return (
      <Suspense fallback={fallback}>
        <AIChatScreen />
      </Suspense>);

  }

  return (
    <div className="a-scope min-h-screen px-5 pt-8 pb-28 relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto relative z-10">

        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-5">
            <motion.div
              className="w-24 h-24 flex items-center justify-center"
              style={{ borderRadius: 28, background: 'var(--a-grad-peach)', boxShadow: '0 24px 48px -16px rgba(217, 108, 74, 0.55)' }}
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 4 }}>

              <Crown size={44} style={{ color: 'var(--a-accent-ink)' }} />
            </motion.div>
            <motion.div
              className="absolute -top-2 -end-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)' }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2 }}>

              <Sparkles size={15} style={{ color: '#ffc94d' }} />
            </motion.div>
          </div>
          <h1 className="mb-2" style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
            {tr("partneraipremiumgate_anacan_ai_premium_ucundur_37ae9a", "Anacan.AI Premium \xFC\xE7\xFCnd\xFCr")}
          </h1>
          <p className="leading-relaxed" style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}>
            {tr("partneraipremiumgate_anacan_ai_komekcisi_ve_partnyo_b352ea", "Anacan.AI k\xF6m\u0259k\xE7isi v\u0259 partnyor funksiyalar\u0131 yaln\u0131z Premium istifad\u0259\xE7il\u0259r \xFC\xE7\xFCnd\xFCr.\n            H\u0259yat yolda\u015F\u0131n\u0131z\u0131n v\u0259 ya \xF6z hesab\u0131n\u0131z\u0131n Premium aboneliyi aktiv olduqda burada\n            ekspert m\u0259sl\u0259h\u0259tl\u0259ri ala bil\u0259rsiniz.")}


          </p>
        </div>

        <div className="a-card mb-5">
          <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 12 }}>
            <Sparkles size={15} style={{ color: 'var(--a-yellow-ink)' }} />
            {tr("partneraipremiumgate_premium_da_ne_var_d28116", "Premium-da n\u0259 var?")}
          </h3>
          <ul className="space-y-2.5">
            {[tr("partneraipremiumgate_anacan_ai_ile_limitsiz_sohbet_431177", "Anacan.AI il\u0259 limitsiz s\xF6hb\u0259t"), tr("partneraipremiumgate_hamilelik_ve_korpe_bilgileri_9b3dc5", "Hamil\u0259lik v\u0259 k\xF6rp\u0259 bilgil\u0259ri"), tr("partneraipremiumgate_partnyor_mod_ve_sinxronizasiya_1e764c", "Partnyor mod v\u0259 sinxronizasiya"), tr("partneraipremiumgate_butun_premium_aletler_b6b57d", "B\xFCt\xFCn premium al\u0259tl\u0259r")].




            map((item) =>
            <li key={item} className="flex items-start gap-2" style={{ fontSize: 13, color: 'var(--a-ink)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--a-green-1)' }}>
                  <Check className="w-3 h-3" style={{ color: 'var(--a-green-ink)' }} strokeWidth={3} />
                </div>
                {item}
              </li>
            )}
          </ul>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="w-full h-14 rounded-full text-white font-bold text-base border-0 hover:opacity-95"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}>

          <Crown className="w-5 h-5 me-2" />
          {tr("partneraipremiumgate_premium_a_kec_9dadb6", "Premium-a ke\xE7")}
        </Button>
        <p className="text-center mt-3" style={{ fontSize: 11.5, color: 'var(--a-on-bg-soft)' }}>
          {tr("partneraipremiumgate_aboneliyi_heyat_yoldasiniz_da__8eb9a1", "Aboneliyi h\u0259yat yolda\u015F\u0131n\u0131z da \u0259ld\u0259 ed\u0259 bil\u0259r \u2014 ikiniz \xFC\xE7\xFCn d\u0259 a\xE7\u0131lacaq.")}
        </p>
      </motion.div>

      <PremiumModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>);

};

export default PartnerAIPremiumGate;
