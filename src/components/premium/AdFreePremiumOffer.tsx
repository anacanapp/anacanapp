import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { onboardingText } from '@/lib/onboarding-i18n';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { writeStorageItem } from '@/lib/local-storage';

const PremiumModal = lazy(() => import('@/components/PremiumModal').then(module => ({ default: module.PremiumModal })));
type Position = 'top' | 'bottom';
const shownInMemory = new Set<string>();

function wasShown(scope: string) {
  if (shownInMemory.has(scope)) return true;
  try { return localStorage.getItem(scope) === '1'; } catch { return false; }
}

export default function AdFreePremiumOffer({ position }: { position: Position }) {
  const { user } = useAuth();
  const lifeStage = useUserStore(state => state.lifeStage);
  const scope = user?.id ? `anacan-ad-free-offer-seen-v1:${encodeURIComponent(getBackendConfig().url)}:${user.id}` : null;
  return <OfferForVisit key={`${scope}:${lifeStage}`} scope={scope} position={position} />;
}

function OfferForVisit({ scope, position }: { scope: string | null; position: Position }) {
  const { isPremium, loading } = useSubscription();
  const language = useUserStore(state => state.language);
  const [open, setOpen] = useState(false);
  // Both dashboard slots capture the same initial placement. Recording the
  // impression does not move the card or close its paywall while it is being read.
  const [intro, setIntro] = useState(() => !!scope && !wasShown(scope));
  const card = useRef<HTMLElement>(null);
  const visible = !!scope && !isPremium && !loading && position === (intro ? 'top' : 'bottom');
  useEffect(() => {
    if (isPremium) {
      setOpen(false);
      if (scope && wasShown(scope)) setIntro(false);
    }
  }, [isPremium, scope]);
  useEffect(() => {
    if (!visible || position !== 'top' || !scope || !card.current) return;
    let active = true;
    let observer: IntersectionObserver | undefined;
    const remember = () => {
      if (!active) return;
      shownInMemory.add(scope);
      try { writeStorageItem(localStorage, scope, '1'); } catch { /* Retain this session's placement if storage is unavailable. */ }
      observer?.disconnect();
    };
    if (typeof IntersectionObserver === 'undefined') remember();
    else {
      const element = card.current;
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5)) remember();
      }, { threshold: 0.5 });
      observer.observe(element);
    }
    return () => { active = false; observer?.disconnect(); };
  }, [visible, position, scope]);
  const t = (key: Parameters<typeof onboardingText>[1]) => onboardingText(language, key);
  if (!visible) return null;
  return <>
    <section ref={card} className="a-scope a-card my-4 p-4" data-testid="ad-free-premium-offer" data-offer-position={position} aria-label={t('remove_ads_premium')}>
      <div className="flex items-start gap-3"><ShieldCheck size={24} className="shrink-0 mt-1" style={{ color: 'var(--a-accent-ink)' }} aria-hidden="true" />
        <div className="min-w-0"><h2 className="font-bold text-sm" style={{ color: 'var(--a-ink)' }}>{t('remove_ads_premium')}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--a-ink-soft)' }}>{t('remove_ads_sub')}</p></div>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="a-cta-btn w-full justify-center mt-3 min-h-11 text-sm">
        <Crown size={16} aria-hidden="true" />{t('premium_cta')}
      </button>
    </section>
    {open && <Suspense fallback={null}><PremiumModal isOpen onClose={() => setOpen(false)} feature="ad_free" /></Suspense>}
  </>;
}
