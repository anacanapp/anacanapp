import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { PremiumModal } from '@/components/PremiumModal';
import { tr } from '@/lib/tr';

/**
 * Premium bölmə qapısı — freemium sisteminin UI hissəsi.
 * Premium/admin: children olduğu kimi. Free: cazibədar kilidli kart →
 * toxununca paywall. Məqsəd: istifadəçini free trial-a yönəltmək.
 */

interface PremiumGateProps {
  children: ReactNode;
  /** Kilidli kartda görünən başlıq (bölmənin adı) */
  title: string;
  /** Qısa dəyər cümləsi */
  description?: string;
  /** Analytics üçün bölmə adı */
  feature?: string;
  /** Kilidli kartın emoji-si */
  emoji?: string;
}

const PremiumGate = ({ children, title, description, feature, emoji = '✨' }: PremiumGateProps) => {
  const { isPremium } = useSubscription();
  const { isAdmin } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  if (isPremium) return <>{children}</>;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setShowPaywall(true)}
        className="a-card w-full text-start relative overflow-hidden"
        style={{ padding: '16px', border: '1px dashed var(--a-peach-2)', cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}>

        <span className="absolute top-0 end-0" aria-hidden
        style={{ width: 90, height: 90, borderRadius: 999, background: 'var(--a-peach-1)', opacity: 0.45, transform: 'translate(30%, -30%)' }} />

        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 grid place-items-center shrink-0 text-xl" style={{ borderRadius: 14, background: 'var(--a-grad-peach)' }}>
            {emoji}
          </span>
          <div className="flex-1 min-w-0">
            <p className="a-list-title flex items-center gap-1.5" style={{ fontSize: 14 }}>
              <Lock size={12} strokeWidth={2.4} style={{ color: 'var(--a-accent-ink)' }} />
              {title}
            </p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {description || tr('pgate_default_desc', 'Premium ilə açılır — 3 gün pulsuz sınayın')}
            </p>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1"
            style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)', borderRadius: 999, padding: '6px 12px', fontSize: 10.5, fontWeight: 800 }}>
            <Crown size={11} strokeWidth={2.4} />
            {tr('pgate_unlock', 'Aç')}
          </span>
        </div>
      </motion.button>
      <PremiumModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature={feature || title} />
    </>);
};

export default PremiumGate;
