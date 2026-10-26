import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartHandshake, Home, Users, BellRing, Shield, ChevronRight, X } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';
import { useIsRtl, rtlX } from '@/lib/rtl';

/**
 * Partnyor Modulu 2.0 onboarding turu.
 * İlk girişdə bir dəfə göstərilir (localStorage flag).
 * Mavi partnyor vurğusu, addım-addım bottom sheet.
 */

export const PARTNER_TOUR_KEY = 'anacan_partner_tour_v1';

// Dark mode düzəlişi: hardcode #153e57 dark modda --a-grad-blue-in tünd
// tint-inə qarşı demək olar oxunmurdu (icon görünmürdü).
const BLUE_INK = 'var(--a-blue-ink)';
const BLUE_SOFT = 'var(--a-blue-ink)';

interface Step {
  icon: typeof HeartHandshake;
  emoji: string;
  title: string;
  text: string;
}

interface Props {
  onClose: () => void;
}

const PartnerOnboardingTour = ({ onClose }: Props) => {
  const isRtl = useIsRtl();
  const [step, setStep] = useState(0);

  const steps: Step[] = [
  {
    icon: HeartHandshake,
    emoji: '💙',
    title: tr('ptour_welcome_title', '"Birlikdə"yə xoş gəldiniz!'),
    text: tr('ptour_welcome_text', 'Bu bölmə sizin üçündür — xanımınızın səyahətində ən böyük dəstəkçisi olun. Qısa tura baxaq?')
  },
  {
    icon: Home,
    emoji: '🏠',
    title: tr('ptour_home_title', '"Bu gün" ekranı'),
    text: tr('ptour_home_text', 'Körpənin həftəlik inkişafı, xanımınızın əhvalı və sürətli sevgi mesajları — hamısı ana ekranda.')
  },
  {
    icon: Users,
    emoji: '🤝',
    title: tr('ptour_together_title', '"Birlikdə" bölməsi'),
    text: tr('ptour_together_text', 'Gündəlik missiyalar, aktivlik lenti, alış-veriş siyahısı və həkim görüşləri — birgə idarə edin, xal qazanın.')
  },
  {
    icon: BellRing,
    emoji: '🚨',
    title: tr('ptour_sos_title', 'SOS siqnalları'),
    text: tr('ptour_sos_text', 'Xanımınız təcili kömək və ya doğuş siqnalı göndərsə, telefonunuza dərhal bildiriş gələcək. Sancı rejimində canlı izləyə bilərsiniz.')
  },
  {
    icon: Shield,
    emoji: '🔒',
    title: tr('ptour_privacy_title', 'Məxfilik və Premium'),
    text: tr('ptour_privacy_text', 'Nəyin paylaşılacağını xanımınız özü seçir. Premium isə ailəvidir — biri alsa, hər ikiniz istifadə edirsiniz.')
  }];


  const isLast = step === steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

  const next = async () => {
    await hapticFeedback.light();
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end"
      onClick={onClose}>
      
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="a-scope w-full overflow-hidden"
        style={{ background: 'var(--a-surface)', borderRadius: '30px 30px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)' }}>
        
        {/* Header banner */}
        <div className="relative h-24 flex items-center justify-center" style={{ background: 'var(--a-grad-blue)' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--a-chip-overlay)' }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', damping: 18 }}>
              
              <Icon size={30} strokeWidth={2} style={{ color: BLUE_INK }} />
            </motion.div>
          </AnimatePresence>
          <button
            onClick={onClose}
            className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer' }}
            aria-label={tr('ptour_skip', 'Keç')}>
            
            <X size={15} strokeWidth={2.4} style={{ color: BLUE_INK }} />
          </button>
        </div>

        <div className="px-6 pt-5">
          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: rtlX(24, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(-24, isRtl) }}
              transition={{ duration: 0.18 }}
              style={{ minHeight: 108 }}>
              
              <h2 className="a-heading" style={{ margin: '0 0 6px', fontSize: 19, color: 'var(--a-ink)' }}>
                {current.emoji} {current.title}
              </h2>
              <p className="a-list-sub" style={{ whiteSpace: 'normal', lineHeight: 1.55, fontSize: 13.5 }}>
                {current.text}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5" style={{ margin: '16px 0' }}>
            {steps.map((_, i) =>
            <motion.span
              key={i}
              className="rounded-full"
              animate={{
                width: i === step ? 22 : 7,
                background: i === step ? 'var(--a-blue-2)' : i < step ? `${BLUE_SOFT}66` : 'var(--a-line-strong)'
              }}
              style={{ height: 7 }} />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isLast &&
            <button
              className="a-btn-soft"
              style={{ justifyContent: 'center', minWidth: 92 }}
              onClick={onClose}>
              
                {tr('ptour_skip', 'Keç')}
              </button>
            }
            <motion.button
              onClick={next}
              className="a-cta-btn flex-1"
              style={{ justifyContent: 'center', height: 48, background: 'var(--a-blue-2)', color: '#fff' }}
              whileTap={{ scale: 0.98 }}>
              
              {isLast ? tr('ptour_done', 'Başlayaq! 💙') : tr('ptour_next', 'Növbəti')}
              {!isLast && <ChevronRight className="rtl:rotate-180" size={16} strokeWidth={2.4} />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>);

};

export default PartnerOnboardingTour;
