import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Crown, Lock, Sparkles } from 'lucide-react';
import { getDynamicIcon } from '@/lib/dynamicIcon';
import { useEffect, useRef } from 'react';
import { usePaywallConfig } from '@/hooks/usePaywallConfig';
import PaywallCore from '@/components/paywall/PaywallCore';
import { tr } from "@/lib/tr";
import { useAdSafetyBlock } from '@/components/ads/AdExperienceProvider';
import { useUserStore } from '@/store/userStore';
import { onboardingText } from '@/lib/onboarding-i18n';

/**
 * Anacan Premium Paywall — tam custom, sıfırdan.
 * RevenueCat-in native paywall UI-sı İSTİFADƏ OLUNMUR:
 * offerings SDK-dan çəkilir, UI bizimdir, alış düymələrə bağlanır (PaywallCore).
 */

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}

export function PremiumModal({ isOpen, onClose, feature }: PremiumModalProps) {
  useAdSafetyBlock(isOpen);
  const cfg = usePaywallConfig();
  const language = useUserStore(state => state.language);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll kilidi AYRICA effektdə və yalnız [isOpen]-dan asılıdır.
  // Əvvəl onClose/feature ilə birgə idi — valideynlər inline onClose ötürdüyündən
  // hər render-də effekt sökülüb-qurulur, üst-üstə düşən açılış/bağlanışlarda
  // body.style.overflow yanlış vəziyyətdə qala bilirdi.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = '';};
  }, [isOpen]);

  // Analytics + focus + esc
  useEffect(() => {
    if (!isOpen) return;
    import('@/lib/analytics').then((m) => m.analytics.logPaywallShown(feature || 'general')).catch(() => {});
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {onClose();return;}
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0],last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();} else
      if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {document.removeEventListener('keydown', handleKeyDown);};
  }, [isOpen, onClose, feature]);

  const renderPillIcon = (iconName: string) => {
    const IconComp = getDynamicIcon(iconName, Sparkles);
    return <IconComp className="w-3 h-3" />;
  };

  // Maşın feature id-ləri → lokallaşdırılmış adlar (kilid çipində xam string görünməsin)
  const FEATURE_LABELS: Record<string, string> = {
    ad_free: onboardingText(language, 'premium_noads'),
    tool: tr('pm_feat_tool', 'Bu alət'),
    ai_chat: tr('pm_feat_ai_chat', 'Limitsiz AI söhbəti'),
    doctor_report: tr('pm_feat_doctor_report', 'Həkim PDF hesabatı'),
    baby_insight: tr('pm_feat_baby_insight', 'AI tracker analizi'),
    cry_translator: tr('pm_feat_cry', 'Ağlama tərcüməçisi'),
    poop_scanner: tr('pm_feat_poop', 'Bez analizi'),
    fairy_tale: tr('pm_feat_fairy', 'AI nağıllar'),
    horoscope: tr('pm_feat_horoscope', 'Ulduz falı analizi'),
    weekly_stats: tr('pm_feat_weekly', 'Həftəlik statistika'),
    teething: tr('pm_feat_teething', 'Diş izləyicisi'),
    growth: tr('pm_feat_growth', 'Boy-çəki izləyicisi'),
    pregnancy_days: tr('pm_feat_pregdays', 'Bütün günlərə baxış'),
    white_noise: tr('pm_feat_whitenoise', 'Limitsiz ağ səs'),
    winback: tr('pm_feat_winback', 'Premium'),
    onboarding_funnel: tr('pm_feat_general', 'Premium'),
    flow_daily_logger: tr('pm_feat_flow_logger', 'Gündəlik qeydlər'),
    flow_mood_chart: tr('pm_feat_flow_mood', 'Əhval qrafiki'),
    flow_cycle_stats: tr('pm_feat_flow_stats', 'Tsikl statistikası'),
    flow_trend_chart: tr('pm_feat_flow_trend', 'Trend qrafiki'),
    flow_symptom_report: tr('pm_feat_flow_symptom', 'Simptom hesabatı'),
    flow_reminders: tr('pm_feat_flow_reminders', 'Xatırlatmalar'),
  };
  const featureLabel = feature ? (FEATURE_LABELS[feature] ?? feature) : '';
  const featureLockText = feature ? cfg.feature_lock_text.replace('{feature}', featureLabel) : '';

  // PORTAL: modal transform-lu kartların içindən çağırılır (stacking context tələsi)
  return createPortal(
    <AnimatePresence>
      {isOpen &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="a-scope fixed inset-0 z-[100] flex flex-col overflow-x-hidden"
        style={{ background: 'var(--a-bg)' }}
        role="presentation">

          {/* Buludlu brend fonu */}
          <div className="a-sky" aria-hidden>
            <span className="a-cloud c1" />
            <span className="a-cloud c2" />
            <span className="a-cloud c3" />
            <span className="a-cloud c4" />
            <span className="a-cloud c5" />
          </div>

          <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative flex flex-col h-full w-full max-w-md mx-auto"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          role="dialog"
          aria-modal="true"
          aria-label={cfg.title}>

            {/* Bağla */}
            <button
            ref={closeButtonRef}
            onClick={onClose}
            className="a-icon-btn absolute top-3 end-4 z-10"
            style={{ borderRadius: 999, marginTop: 'env(safe-area-inset-top, 0px)' }}
            aria-label={tr("premiummodal_bagla_84bdc9", "Bağla")}>
              <X size={16} strokeWidth={2} />
            </button>

            {/* ── Hero ── */}
            <div className="text-center pt-5 pb-3 px-5 shrink-0">
              <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 13, delay: 0.05 }}
              className="mx-auto mb-3 grid place-items-center relative"
              style={{
                width: 60, height: 60, borderRadius: 21,
                background: 'linear-gradient(135deg, var(--a-peach-2), #e86a4c)',
                boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)'
              }}>
                <Crown className="w-7 h-7 text-white" strokeWidth={2.2} />
                {/* Parıltı nöqtələri */}
                <motion.span
                aria-hidden
                className="absolute -top-1 -end-1 text-sm"
                animate={{ scale: [1, 1.25, 1], rotate: [0, 12, 0] }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.4 }}>
                  ✨
                </motion.span>
              </motion.div>

              <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)', lineHeight: 1.15, margin: 0 }}>
                {cfg.title}
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', marginTop: 3 }}>{cfg.subtitle}</p>

              {/* Benefit pill-ləri */}
              <div className="flex items-center justify-center gap-1.5 mt-2.5 flex-wrap">
                {cfg.pills.map((b, i) =>
              <div key={i} className="flex items-center gap-1"
              style={{ background: 'var(--a-chip-overlay)', border: '1px solid var(--a-line)', borderRadius: 999, padding: '5px 11px', fontSize: 10.5, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
                    {renderPillIcon(b.icon)}
                    {b.text}
                  </div>
              )}
              </div>

              {feature &&
            <div className="mt-2 inline-flex items-center gap-1.5"
            style={{ background: 'var(--a-chip-overlay)', border: '1px solid var(--a-line)', borderRadius: 999, padding: '4px 12px' }}>
                  <Lock className="w-3 h-3" style={{ color: 'var(--a-accent-ink)' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--a-accent-ink)' }}>{featureLockText}</span>
                </div>
            }
            </div>

            {/* ── Paywall nüvəsi (skrollanan) ── */}
            <div
            className="flex-1 overflow-y-auto overscroll-contain px-5 min-h-0 relative"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
              <PaywallCore feature={feature} onPurchased={() => onClose()} />
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>,
    document.body);

}

export default PremiumModal;
