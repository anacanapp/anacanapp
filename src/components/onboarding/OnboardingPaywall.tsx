import { useEffect, useRef, useState } from 'react';
import { Coffee, X } from 'lucide-react';
import { useInAppPurchase } from '@/hooks/useInAppPurchase';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlatform } from '@/lib/revenuecat';
import { ONBOARDING_OFFER_PRODUCT, standardStorePlan, annualStorePlan, type StorePlan } from '@/lib/onboarding-billing';
import { onboardingText, onboardingLocale, type OnboardingCopyKey } from '@/lib/onboarding-i18n';
import type { OnboardingStage, OnboardingOutcome } from '@/lib/onboarding-model';
import { OnboardingCompanion } from './OnboardingCompanion';
import { OnboardingButton } from './OnboardingFrame';
import { OnboardingBenefits } from './OnboardingBenefits';

export default function OnboardingPaywall({ stage, language, mode, initialPlan, onPlanChange, offerSeen, pending, onPending, onOffer, onSkip, onSuccess, onLegal }: {
  stage: OnboardingStage; language: string; mode: 'paywall' | 'offer'; initialPlan: 'yearly' | 'monthly'; offerSeen: boolean; pending: boolean;
  onPending: () => void; onOffer: () => Promise<boolean>; onSkip: () => void; onSuccess: (outcome: OnboardingOutcome, selectedPlan?: 'yearly' | 'monthly') => void;
  onLegal: (document: 'privacy_policy' | 'terms_of_service') => void;
  onPlanChange: (plan: 'yearly' | 'monthly') => void;
}) {
  const iap = useInAppPurchase();
  const { isPremium, loading: entitlementLoading } = useSubscription();
  const platform = getPlatform();
  const [plan, setPlan] = useState(initialPlan), [working, setWorking] = useState(false);
  const [message, setMessage] = useState<OnboardingCopyKey | null>(null);
  const finished = useRef(false), actionLock = useRef(false), handledCancellation = useRef(false);
  const t = (key: OnboardingCopyKey, values?: Record<string, string | number>) => onboardingText(language, key, values);
  const find = (type: string) => iap.packages.find(pkg => pkg.packageType === type && pkg.product.identifier.split(':')[0] !== ONBOARDING_OFFER_PRODUCT);
  const yearPkg = find('ANNUAL'), monthPkg = find('MONTHLY');
  const yearly = annualStorePlan(yearPkg, platform, iap.introEligibility[yearPkg?.product.identifier || '']);
  const monthly = standardStorePlan(monthPkg, platform, 'monthly', iap.introEligibility[monthPkg?.product.identifier || '']);
  const choice = mode === 'offer' ? monthly : plan === 'yearly' ? yearly : monthly;
  const waiting = pending || iap.purchaseStatus === 'pending';
  const busy = working || iap.isPurchasing;
  useEffect(() => {
    if (iap.purchaseStatus === 'pending') onPending();
  }, [iap.purchaseStatus]);
  useEffect(() => {
    if (isPremium && !entitlementLoading && !waiting && !finished.current) { finished.current = true; onSuccess('existing'); }
  }, [isPremium, entitlementLoading, waiting]);

  const run = async (operation: () => Promise<void>) => {
    if (actionLock.current || busy) return;
    actionLock.current = true; setWorking(true); setMessage(null);
    try { await operation(); } catch { setMessage('purchase_failed'); }
    finally { actionLock.current = false; setWorking(false); }
  };
  const purchase = () => run(async () => {
    if (!choice || !iap.isSupported || waiting) return;
    handledCancellation.current = false;
    if (await iap.purchaseExact(choice.pkg, choice.request)) { finished.current = true; onSuccess('purchased', choice.kind); }
  });
  const restore = () => run(async () => {
    if (!iap.isSupported) return;
    if (await iap.restorePurchases()) { finished.current = true; onSuccess('restored'); }
    else setMessage('restore_none');
  });
  const close = () => run(async () => {
    if (mode === 'paywall' && plan === 'yearly' && monthly && !offerSeen && !waiting) await onOffer();
    else onSkip();
  });
  useEffect(() => {
    if (iap.purchaseStatus === 'cancelled' && !busy && !handledCancellation.current && mode === 'paywall' && plan === 'yearly') {
      handledCancellation.current = true;
      void close();
    }
  }, [iap.purchaseStatus, busy, mode, plan]);
  const refresh = () => run(async () => {
    if (await iap.retryActivation()) { finished.current = true; onSuccess('restored'); }
  });
  const prices = (value: StorePlan) => <>
    <p className="onb-note">{t('charged_today', { price: value.priceString })}</p>
    <p className="onb-note">{t(value.kind === 'yearly' ? 'renewal_year' : 'renewal_month', { price: value.renewalPriceString })}</p>
  </>;
  const card = (kind: 'yearly' | 'monthly', value: StorePlan | null) => <button type="button" className="onb-plan" data-plan={kind}
    disabled={busy || !value || waiting} aria-pressed={plan === kind} onClick={() => { setPlan(kind); onPlanChange(kind); }}>
    {kind === initialPlan && <span className="onb-plan-badge">{t('recommended')}</span>}
    <div className="onb-plan-top"><span>{t(kind)}</span><span>
      {value && value.price < value.renewalPrice && <del className="block text-xs font-normal opacity-70"><bdi>{t('per_year', { price: value.renewalPriceString })}</bdi></del>}
      <bdi>{value ? t(kind === 'yearly' ? 'per_year' : 'per_month', { price: value.priceString }) : t('price_unavailable')}</bdi>
    </span></div>
    {value && value.price < value.renewalPrice && <small>{t('first_year', { price: value.priceString })}</small>}
    {value && <small>{kind === 'yearly' ? t('equivalent_month', { price: new Intl.NumberFormat(onboardingLocale(language), { style: 'currency', currency: value.currency }).format(value.price / 12) }) : t('flexible_plan')}</small>}
  </button>;

  return <div className="onb-paywall" data-testid="onboarding-paywall">
    <div className="onb-payment-top"><button type="button" className="onb-icon" disabled={busy} onClick={() => void close()} aria-label={t('close')}><X size={21} /></button>
      {platform !== 'web' && <button type="button" disabled={busy || iap.isLoading || !iap.isSupported} onClick={() => void restore()}>{t('restore')}</button>}
    </div>
    <div className="onb-summary-heading"><div>
      <h1 tabIndex={-1}>{t(mode === 'offer' ? 'coffee_title' : 'premium_title')}</h1>
      <p className="onb-sub">{t(mode === 'offer' ? 'coffee_sub' : 'premium_sub')}</p>
    </div><OnboardingCompanion stage={stage} pose={mode === 'offer' ? 'exit' : 'paywall'} language={language} size="tiny" /></div>
    <OnboardingBenefits stage={stage} page={mode} language={language} />
    {waiting ? <p className="onb-feedback" role="status">{t('purchase_pending')}</p>
      : platform === 'web' ? <p className="onb-feedback">{t('mobile_purchase')}</p>
      : iap.isLoading ? <p role="status" className="onb-note">{t('loading_prices')}</p>
      : mode === 'offer' && monthly ? <div className="onb-offer"><Coffee size={28} aria-hidden="true" />
        <strong><bdi>{t('per_month', { price: monthly.priceString })}</bdi></strong></div>
      : mode === 'paywall' ? <div className="onb-plans">{card('yearly', yearly)}{card('monthly', monthly)}</div>
      : <p className="onb-feedback">{t('store_unavailable')}</p>}
    {mode === 'offer' && !waiting && <p className="onb-note">{t('once_only')}</p>}
    {(message || iap.purchaseStatus === 'failed') && !waiting && <p className="onb-error" role="alert">{t(message || 'purchase_failed')}</p>}
    <div className="onb-payment-actions">
      {waiting ? <OnboardingButton onClick={() => void refresh()} busy={busy}>{t('refresh_status')}</OnboardingButton>
        : platform !== 'web' && <OnboardingButton onClick={() => void purchase()} busy={busy} disabled={iap.isLoading || !iap.isSupported || !choice}>
          {choice ? t(mode === 'offer' ? 'buy_monthly' : 'buy', { price: choice.priceString }) : t('price_unavailable')}
        </OnboardingButton>}
      {platform !== 'web' && !choice && !iap.isLoading && !waiting && <OnboardingButton secondary busy={busy} onClick={() => void run(iap.reloadOfferings)}>{t('retry')}</OnboardingButton>}
      <OnboardingButton data-testid="onb-skip-premium" secondary busy={busy} onClick={() => void close()}>{t(mode === 'offer' ? 'decline' : 'continue_free')}</OnboardingButton>
    </div>
    <div className="onb-payment-disclosure">{choice && !waiting && prices(choice)}
      <p className="onb-note">{t('manage_store')}</p></div>
    <div className="onb-legal"><button type="button" disabled={busy} onClick={() => onLegal('terms_of_service')}>{t('terms')}</button>
      <button type="button" disabled={busy} onClick={() => onLegal('privacy_policy')}>{t('privacy')}</button></div>
  </div>;
}
