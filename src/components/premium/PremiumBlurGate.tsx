import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { PremiumModal } from '@/components/PremiumModal';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';

interface PremiumBlurGateProps {
  /** Analytics + paywall feature adı */
  feature: string;
  /** Overlay başlığı (lokallaşdırılmış) */
  title?: string;
  /** Overlay alt yazısı */
  subtitle?: string;
  /** CTA mətni */
  cta?: string;
  /** Blur gücü */
  blur?: 'sm' | 'md' | 'lg';
  /** true → premium istifadəçilər üçün də gizlət (test) */
  forceLock?: boolean;
  children: ReactNode;
}

const BLUR_PX = { sm: 4, md: 7, lg: 12 };

/**
 * Flo / BabyCenter / Pregnancy+ üslubunda premium qapısı:
 * real kontent blur ilə "dadızdırılır", üstündə tac + başlıq + CTA.
 * Toxunuş paywall-u açır. Premium istifadəçilər konteti olduğu kimi görür.
 */
const PremiumBlurGate = ({
  feature,
  title,
  subtitle,
  cta,
  blur = 'md',
  forceLock = false,
  children,
}: PremiumBlurGateProps) => {
  const { isPremium } = useSubscription();
  const { isAdmin } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  // Admin bypass — PremiumGate ilə eyni davranış
  if (isPremium && !forceLock) return <>{children}</>;

  const open = () => {
    hapticFeedback.light();
    setShowPaywall(true);
  };

  return (
    <>
      <div
        style={{ position: 'relative', cursor: 'pointer' }}
        onClick={open}
        role="button"
        aria-label={title || tr('premiumgate_default_title', 'Bu bölmə Premium-dadır')}
      >
        {/* Real kontent — blur + qeyri-interaktiv (teaser) */}
        <div
          aria-hidden="true"
          style={{
            filter: `blur(${BLUR_PX[blur]}px) saturate(0.9)`,
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0.9,
          }}
        >
          <div className="min-h-[170px] p-5 space-y-4" aria-hidden="true"><div className="h-5 w-2/3 rounded bg-muted" /><div className="h-12 rounded bg-muted" /><div className="h-5 w-4/5 rounded bg-muted" /></div>
        </div>

        {/* PREMIUM nişanı — sağ üst (Flo-stil) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineEnd: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: 'var(--a-warn-ink)',
            background: 'linear-gradient(135deg, #ffe9b3, #ffd166)',
            boxShadow: '0 2px 8px rgba(180,130,0,0.25)',
            zIndex: 2,
          }}
        >
          <Crown size={11} strokeWidth={2.5} />
          PREMIUM
        </div>

        {/* Overlay — yumşaq qradiyent + mərkəzi CTA */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '16px 20px',
            textAlign: 'center',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--a-surface, #fff) 15%, transparent) 0%, color-mix(in srgb, var(--a-surface, #fff) 55%, transparent) 45%, color-mix(in srgb, var(--a-surface, #fff) 85%, transparent) 100%)',
            borderRadius: 'inherit',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #ffd166, #f9a03f)',
              boxShadow: '0 6px 18px rgba(249,160,63,0.45)',
            }}
          >
            <Lock size={20} strokeWidth={2.4} color="#fff" />
          </motion.div>

          <p
            className="a-heading"
            style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--a-ink, #2b2b2b)', textShadow: '0 1px 6px color-mix(in srgb, var(--a-surface, #fff) 80%, transparent)' }}
          >
            {title || tr('premiumgate_default_title', 'Bu bölmə Premium-dadır')}
          </p>
          {subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--a-ink-soft, #6b6b6b)',
                maxWidth: 260,
              }}
            >
              {subtitle}
            </p>
          )}

          <motion.span
            whileTap={{ scale: 0.95 }}
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              background: 'linear-gradient(135deg, #f97316, #ec4899)',
              boxShadow: '0 6px 16px rgba(236,72,153,0.35)',
            }}
          >
            <Crown size={14} strokeWidth={2.5} />
            {cta || tr('usepaywallconfig_premium_a_kec_2e8b0e', 'Premium-a Keç')}
          </motion.span>
        </div>
      </div>

      <PremiumModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature={feature} />
    </>
  );
};

export default PremiumBlurGate;
