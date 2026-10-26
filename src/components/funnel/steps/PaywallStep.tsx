import { motion } from 'framer-motion';
import { X, Crown } from 'lucide-react';
import { usePaywallConfig } from '@/hooks/usePaywallConfig';
import PaywallCore from '@/components/paywall/PaywallCore';
import { tr } from '@/lib/tr';

/**
 * Funnel paywall addımı — tam custom Anacan paywall (a-* stil).
 * Əvvəllər RevenueCat-in native paywall UI-sı avtomatik təqdim olunurdu —
 * artıq YOX: offerings + custom UI + düyməyə bağlı alış (PaywallCore).
 */

interface PaywallStepProps {
  onPurchase: (planId: string) => void;
  onClose: () => void;
}

export default function PaywallStep({ onPurchase, onClose }: PaywallStepProps) {
  const cfg = usePaywallConfig();

  return (
    <div className="a-scope relative flex flex-col min-h-full px-6 py-6" style={{ background: 'var(--a-bg)' }}>
      {/* Buludlar */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      {/* Bağla → endirim təklifinə keçir */}
      <button
        onClick={onClose}
        className="a-icon-btn absolute top-4 end-4 z-10"
        style={{ borderRadius: 999 }}
        aria-label={tr('pw_close', 'Bağla')}>
        <X size={15} strokeWidth={2.2} />
      </button>

      <div className="relative z-[1] flex-1">
        {/* Hero */}
        <div className="text-center mb-4 pt-2">
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 13 }}
            className="mx-auto mb-3 grid place-items-center"
            style={{
              width: 60, height: 60, borderRadius: 21,
              background: 'linear-gradient(135deg, var(--a-peach-2), #e86a4c)',
              boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)'
            }}>
            <Crown className="w-7 h-7 text-white" strokeWidth={2.2} />
          </motion.div>
          <h2 style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)', margin: 0 }}>
            {cfg.title}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', marginTop: 3 }}>
            {tr('pw_funnel_subtitle', 'Fərdi planınız hazırdır — tam imkanlarla başlayın')}
          </p>
        </div>

        {/* Nüvə: planlar + alış + bərpa + legal.
            Web-də funnel bloklanmır → davam et. */}
        <div className="pb-safe">
          <PaywallCore
            feature="onboarding_funnel"
            compact
            onPurchased={(planId) => onPurchase(planId)}
            onNonNativeCta={() => onPurchase('web_continue')} />
        </div>
      </div>
    </div>);

}
