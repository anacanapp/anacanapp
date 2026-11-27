import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Loader2, RefreshCw, Shield, Sparkles, Infinity as InfinityIcon } from 'lucide-react';
import SponsorEntry from '@/components/premium/SponsorEntry';
import { useInAppPurchase, type RCPackage } from '@/hooks/useInAppPurchase';
import { usePaywallConfig } from '@/hooks/usePaywallConfig';
import { getPlatform, isNativePlatform } from '@/lib/revenuecat';
import { annualStorePlan, standardStorePlan } from '@/lib/onboarding-billing';
import { appLanguageLocale } from '@/lib/app-languages';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { purchaseErrorMessage } from '@/lib/purchase-errors';
import { onboardingText } from '@/lib/onboarding-i18n';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';
import { paywallFeatures, paywallHeadline, paywallSocialProof, paywallStage } from '@/lib/paywall-stage-copy';
import { QaygiCashPremiumOption, QcPremiumEarnLine } from '@/components/qaygicash/QaygiCashPremium';
import EpointPayOption from '@/components/paywall/EpointPayOption';
import { funnelHit, purchaseIntent } from '@/lib/premium-funnel';

/**
 * Anacan Paywall Core — sıfırdan qurulmuş custom paywall (RevenueCat native UI YOX).
 *
 *  1. Offerings SDK-dan çəkilir  → useInAppPurchase (Purchases.getOfferings)
 *  2. UI tam custom              → a-* dizayn sistemi
 *  3. Alış düymələrə bağlanır    → purchaseByIdentifier (Purchases.purchase(package))
 *
 * Bütün ödəmə səthləri (PremiumModal, funnel PaywallStep) bu nüvəni paylaşır.
 */

type PlanKey = 'yearly' | 'monthly' | 'lifetime';

interface PaywallCoreProps {
  /** Analytics source (e.g. tool id) for the click event; falls back to `feature`. */
  analyticsSource?: string;
  feature?: string;
  /** Uğurlu alışdan sonra çağırılır */
  onPurchased: (planId: string) => void;
  /** Web/dəstəklənməyən platformada CTA davranışı (funnel: davam et). Yoxdursa toast göstərilir. */
  onNonNativeCta?: () => void;
  /** Funnel üçün bir az sıx rejim */
  compact?: boolean;
}

/** Store-currency price in the app language's number format (same approach as OnboardingPaywall). */
const formatMoney = (language: string, amount: number, currency?: string) => {
  try {
    return new Intl.NumberFormat(appLanguageLocale(language), { style: 'currency', currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : 'USD' }).format(amount);
  } catch { return amount.toFixed(2); }
};

const PaywallCore = ({ feature, analyticsSource, onPurchased, onNonNativeCta, compact = false }: PaywallCoreProps) => {
  const { toast } = useToast();
  const cfg = usePaywallConfig();
  const language = useUserStore(state => state.language);
  const text = (key: Parameters<typeof onboardingText>[1], values?: Record<string, string | number>) => onboardingText(language, key, values);
  const stage = paywallStage(useUserStore(state => state.lifeStage));
  const {
    packages, isLoading, isPurchasing, error, isSupported,
    purchaseByIdentifier, purchaseExact, introEligibility, restorePurchasesDetailed,
    offeringsFailed, reloadOfferings, purchaseStatus, retryActivation
  } = useInAppPurchase();
  // Current server grant: a store purchase must not duplicate web/promo/household Premium.
  const { ownPremium, householdPremium } = usePremiumEntitlement();

  const isNative = isNativePlatform();
  const [selected, setSelected] = useState<PlanKey>('yearly');
  const [restoring, setRestoring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── 1) Offerings → paketlər ──
  const findPkg = useCallback((type: string, idPart: string): RCPackage | undefined =>
  packages.find((p) =>
  p.packageType === type ||
  p.identifier === `$rc_${idPart === 'yearly' ? 'annual' : idPart}` ||
  p.product.identifier.includes(idPart) ||
  idPart === 'yearly' && p.product.identifier.includes('annual')
  ), [packages]);

  const yearlyPkg = useMemo(() => findPkg('ANNUAL', 'yearly'), [findPkg]);
  const monthlyPkg = useMemo(() => findPkg('MONTHLY', 'monthly'), [findPkg]);
  const lifetimePkg = useMemo(() => findPkg('LIFETIME', 'lifetime'), [findPkg]);
  const yearlyPlan = annualStorePlan(yearlyPkg, getPlatform(), introEligibility[yearlyPkg?.product.identifier || '']);
  const monthlyPlan = standardStorePlan(monthlyPkg, getPlatform(), 'monthly', introEligibility[monthlyPkg?.product.identifier || '']);

  // ── Qiymət hesablamaları (RC → fallback) ──
  // Web display reference only; native charges always use the actual store price.
  const currency = yearlyPlan?.currency || monthlyPlan?.currency || yearlyPkg?.product.currencyCode || monthlyPkg?.product.currencyCode;
  const monthlyPrice = monthlyPlan?.price ?? monthlyPkg?.product.price ?? 3.99;
  const yearlyPrice = yearlyPlan?.price ?? yearlyPkg?.product.price ?? 29.99;
  const monthlyStr = isNative && !monthlyPlan ? '–' : monthlyPlan?.priceString || monthlyPkg?.product.priceString || formatMoney(language, monthlyPrice, currency);
  const yearlyStr = isNative && !yearlyPlan ? '–' : yearlyPlan?.priceString || yearlyPkg?.product.priceString || formatMoney(language, yearlyPrice, currency);
  const annualDiscount = !!yearlyPlan && yearlyPlan.price < yearlyPlan.renewalPrice;
  const lifetimeStr = lifetimePkg?.product.priceString || '';
  const yearlyPerMonth = formatMoney(language, yearlyPrice / 12, yearlyPlan?.currency || currency);
  // iOS with unknown intro eligibility: StoreKit charges the first-year price when eligible, otherwise the regular one.
  const introUncertainText = yearlyPlan?.introUncertain ? tr('pw_intro_uncertain_year', 'İlk il {intro}; bu təklifə uyğun deyilsinizsə {regular}')
    .replace('{intro}', yearlyPlan.priceString).replace('{regular}', yearlyPlan.renewalPriceString) : null;
  const pricesMissing = isNative && !isLoading && !yearlyPlan && !monthlyPlan && !lifetimePkg;

  // Server-side funnel (anonymous daily counters, see premium-funnel.ts).
  useEffect(() => { funnelHit('paywall_shown', analyticsSource || feature || 'general'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = { cancelled: 'purchase_cancelled', failed: 'purchase_failed', pending: 'purchase_pending' } as const;
    const ev = map[purchaseStatus as keyof typeof map];
    if (ev) funnelHit(ev, analyticsSource || feature || 'general');
  }, [purchaseStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never leave the selected plan disabled: fall back to a plan the store can sell.
  useEffect(() => {
    if (!isNative || isLoading) return;
    const available: Record<PlanKey, boolean> = { yearly: !!yearlyPlan, monthly: !!monthlyPlan, lifetime: !!lifetimePkg };
    if (available[selected]) return;
    const next = (['yearly', 'monthly', 'lifetime'] as PlanKey[]).find(key => available[key]);
    if (next) setSelected(next);
  }, [isNative, isLoading, selected, !!yearlyPlan, !!monthlyPlan, !!lifetimePkg]);
  const savings = annualDiscount ? Math.round((1 - yearlyPlan!.price / yearlyPlan!.renewalPrice) * 100)
    : monthlyPrice > 0 ? Math.max(0, Math.round((1 - yearlyPrice / 12 / monthlyPrice) * 100)) : 0;

  // ── Xüsusiyyət siyahısı: mərhələyə uyğun, yalnız kodda real Premium olanlar (paywall-stage-copy) ──
  const featureList = useMemo(() => paywallFeatures(stage), [stage, language]);
  const proof = paywallSocialProof();

  const FEATURE_TINTS = [
  { bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)' },
  { bg: 'var(--a-pink-1)', ink: 'var(--a-berry-ink)' },
  { bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  { bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' }];


  // ── 3) Alış — düyməyə bağlanmış purchase(package) ──
  const handlePurchase = useCallback(async () => {
    if (!isNative || !isSupported) {
      if (onNonNativeCta) {onNonNativeCta();return;}
      toast({
        title: tr('pw_web_title', 'Premium mobil tətbiqdədir'),
        description: cfg.non_native_notice,
        variant: 'destructive'
      });
      return;
    }

    const pkg = selected === 'yearly' ? yearlyPkg : selected === 'monthly' ? monthlyPkg : lifetimePkg;
    const plan = selected === 'yearly' ? yearlyPlan : selected === 'monthly' ? monthlyPlan : null;
    if (!pkg || selected !== 'lifetime' && !plan) {
      toast({ title: tr('pw_no_product', 'Məhsul tapılmadı'), description: tr('pw_no_product_desc', 'Bir az sonra yenidən cəhd edin'), variant: 'destructive' });
      return;
    }

    const src = analyticsSource || feature || 'general';
    import('@/lib/analytics').then((m) => m.analytics.logPaywallClicked(src, selected)).catch(() => {});
    funnelHit('paywall_clicked', src); purchaseIntent(src, selected); funnelHit('purchase_started', src);
    const premium = { ownPremium, householdPremium };
    const ok = plan ? await purchaseExact(plan.pkg, plan.request, premium) : await purchaseByIdentifier(pkg.identifier, premium);
    if (ok) {
      toast({
        title: tr('pw_success_title', 'Premium aktivləşdirildi! 🎉'),
        description: tr('pw_success_desc', 'Bütün imkanlar açıldı — xoş istifadələr!')
      });
      onPurchased(selected);
    }
  }, [isNative, isSupported, selected, yearlyPkg, monthlyPkg, lifetimePkg, yearlyPlan, monthlyPlan, purchaseExact, purchaseByIdentifier, onPurchased, onNonNativeCta, toast, cfg.non_native_notice, feature, ownPremium, householdPremium]);

  const handleRestore = useCallback(async () => {
    funnelHit('restore_clicked', analyticsSource || feature || 'general');
    setRestoring(true);
    const outcome = await restorePurchasesDetailed();
    setRestoring(false);
    if (outcome.ok) {
      toast({ title: tr('pw_restored', 'Alışlar bərpa edildi ✓'), description: tr('pw_restored_desc', 'Premium abunəliyiniz aktivdir') });
      onPurchased('restore');
    } else if (outcome.failure === 'pending') {
      // Store restore succeeded, server confirmation pending: the alert + "refresh status" button cover it.
    } else if (outcome.failure === 'network' || outcome.failure === 'error' || outcome.failure === 'account') {
      toast({ title: tr('useinapppurchase_alislar_berpa_edile_bilmedi_33b266', 'Alışlar bərpa edilə bilmədi'), variant: 'destructive', description: outcome.failure === 'network'
        ? tr('restore_err_network', 'Bərpa alınmadı: mağaza ilə əlaqə yoxdur. İnternet bağlantısını yoxlayıb yenidən cəhd edin.')
        : outcome.failure === 'account' ? purchaseErrorMessage('REVENUECAT_ACCOUNT_MISMATCH') : purchaseErrorMessage('STORE_PROBLEM') });
    } else {
      toast({ title: tr('pw_restore_none', 'Alış tapılmadı'), description: tr('pw_restore_none_desc', 'Bu hesabla bağlı əvvəlki abunəlik yoxdur'), variant: 'destructive' });
    }
  }, [restorePurchasesDetailed, onPurchased, toast]);

  // Store payment done but the server has not confirmed yet: re-check instead of paying again.
  const handleRefreshStatus = useCallback(async () => {
    setRefreshing(true);
    const ok = await retryActivation();
    setRefreshing(false);
    if (ok) {
      toast({ title: tr('pw_success_title', 'Premium aktivləşdirildi! 🎉') });
      onPurchased('restore');
    }
  }, [retryActivation, onPurchased, toast]);

  const ctaText = text('premium_cta');

  const busy = isPurchasing || restoring;

  // ── Plan kartı ──
  const PlanCard = ({
    plan, label, priceMain, priceMainSuffix, sub, badge, icon, oldPrice, extra



  }: {plan: PlanKey;label: string;priceMain: string;priceMainSuffix?: string;sub: string;badge?: string;icon?: React.ReactNode;oldPrice?: string;extra?: React.ReactNode;}) => {
    const active = selected === plan;
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setSelected(plan)}
        aria-pressed={active}
        className="relative w-full text-start"
        style={{
          borderRadius: 20,
          padding: '14px 16px',
          background: active ? 'var(--a-surface)' : 'rgba(255,255,255,0.5)',
          border: active ? '2px solid var(--a-peach-2)' : '2px solid var(--a-line-strong)',
          boxShadow: active ? '0 16px 32px -18px rgba(217, 108, 74, 0.55)' : 'none',
          transition: 'all 0.2s'
        }}>

        {badge &&
        <span
          className="absolute -top-2.5 end-4"
          style={{
            background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)',
            fontSize: 9.5, fontWeight: 900, letterSpacing: '0.06em',
            padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 32px)', overflow: 'hidden', textOverflow: 'ellipsis',
            border: '1px solid var(--a-chip-overlay)',
            boxShadow: '0 6px 14px -6px rgba(217, 108, 74, 0.5)'
          }}>
            {badge}
          </span>
        }
        <div className="flex items-center gap-3">
          {/* Radio */}
          <span
            className="grid place-items-center shrink-0"
            style={{
              width: 22, height: 22, borderRadius: 999,
              background: active ? 'var(--a-peach-2)' : 'transparent',
              border: active ? 'none' : '2px solid var(--a-ink-faint)'
            }}>
            {active && <Check size={12} strokeWidth={3.5} style={{ color: '#fff' }} />}
          </span>

          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)', margin: 0 }}>
              {icon}{label}
            </p>
            <p style={{ fontSize: 10.5, color: 'var(--a-ink-soft)', margin: '2px 0 0' }}>{sub}</p>
            {extra}
          </div>

          <div className="text-end shrink-0">
            {oldPrice && <del className="block text-xs" style={{ color: 'var(--a-ink-soft)' }}><bdi>{oldPrice}</bdi></del>}
            <p style={{ fontSize: 19, fontWeight: 900, color: 'var(--a-ink)', letterSpacing: '-0.02em', margin: 0 }}>
              {priceMain}
              {priceMainSuffix && <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--a-ink-soft)' }}>{priceMainSuffix}</span>}
            </p>
          </div>
        </div>
      </motion.button>);
  };

  return (
    <div>
      <p className="mb-4 rounded-xl px-4 py-3 text-center text-sm font-bold" style={{ background: 'var(--a-surface)', color: 'var(--a-ink)' }}>
        {paywallHeadline(stage)}
      </p>
      {/* Xəta */}
      {error &&
      <div role="alert" className="text-center mb-3"
      style={{ background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', borderRadius: 14, padding: '9px 12px', fontSize: 12, fontWeight: 600 }}>
          {error}
          {purchaseStatus === 'pending' && isNative &&
          <button type="button" onClick={() => void handleRefreshStatus()} disabled={refreshing || busy}
          className="mt-2 mx-auto flex items-center justify-center gap-1.5 disabled:opacity-60"
          style={{ borderRadius: 999, padding: '7px 14px', background: 'var(--a-surface)', color: 'var(--a-ink)', fontSize: 12, fontWeight: 800, border: '1px solid var(--a-line-strong)' }}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {text('refresh_status')}
            </button>
          }
        </div>
      }

      {/* ── Xüsusiyyətlər (palitra tint-li) ── */}
      <div className={`grid grid-cols-2 gap-2 ${compact ? 'mb-3' : 'mb-4'}`}>
        {featureList.map((f, i) =>
        <motion.div
          key={`${f.title}-${i}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04 }}
          className="flex items-center gap-2"
          style={{ background: 'var(--a-surface)', borderRadius: 15, padding: '9px 11px', boxShadow: '0 8px 18px -14px rgba(217, 108, 74, 0.4)' }}>
            <span className="grid place-items-center shrink-0"
          style={{ width: 30, height: 30, borderRadius: 10, background: FEATURE_TINTS[i % 6].bg, fontSize: 14 }}>
              {f.icon}
            </span>
            <span className="line-clamp-2" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-ink)', lineHeight: 1.25 }}>{f.title}</span>
          </motion.div>
        )}
      </div>

      {/* ── Sosial sübut: yalnız real göstəricilər (App Store reytinqi və yükləmə sayı) ── */}
      <p data-testid="paywall-social-proof" className={`flex flex-wrap items-center justify-center gap-x-1.5 text-center ${compact ? 'mb-3' : 'mb-4'}`}
      style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
        <span>{proof.rating}</span>
        <span aria-hidden>·</span>
        <span>{proof.downloads}</span>
      </p>

      {/* ── Plan kartları ── */}
      {isLoading && isNative ?
      <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--a-ink-soft)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('pw_loading_prices', 'Qiymətlər yüklənir...')}</span>
        </div> :

      <div className={`space-y-2.5 ${compact ? 'mb-3' : 'mb-4'} pt-1.5`}>
          <PlanCard
          plan="yearly"
          label={cfg.yearly_label}
          priceMain={yearlyStr}
          priceMainSuffix={cfg.yearly_total_suffix}
          oldPrice={annualDiscount ? yearlyPlan!.renewalPriceString : undefined}
          sub={isNative && !yearlyPlan ? text('store_unavailable') : introUncertainText ? introUncertainText : annualDiscount ? text('first_year', { price: yearlyStr }) : `${yearlyPerMonth}${cfg.yearly_suffix} · ${tr('pw_billed_yearly', 'ildə bir dəfə ödənilir')}`}
          badge={isNative && !yearlyPlan ? undefined : cfg.savings_badge.replace('{percent}', String(savings))}
          extra={<QcPremiumEarnLine plan="yearly" />} />

          <PlanCard
          plan="monthly"
          label={cfg.monthly_label}
          priceMain={monthlyStr}
          priceMainSuffix={cfg.monthly_suffix}
          sub={isNative && !monthlyPlan ? text('store_unavailable') : tr('pw_flexible', 'Çevik — istənilən ay dayandır')}
          extra={<QcPremiumEarnLine plan="monthly" />} />

          {lifetimePkg &&
        <PlanCard
          plan="lifetime"
          label={tr('pw_lifetime', 'Ömürlük')}
          priceMain={lifetimeStr}
          sub={tr('pw_lifetime_sub', 'Bir dəfə ödə — həmişəlik sənin')}
          icon={<InfinityIcon size={14} style={{ color: 'var(--a-accent-ink)' }} />} />
        }
        </div>
      }

      {/* Offerings did not load (store/network): retry instead of a dead paywall */}
      {isNative && !isLoading && (offeringsFailed || pricesMissing) &&
      <div className={`flex flex-col items-center gap-2 ${compact ? 'mb-3' : 'mb-4'}`}>
          <span className="text-center" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr('pw_prices_failed', 'Qiymətləri yükləmək alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.')}</span>
          <button type="button" onClick={() => void reloadOfferings()} disabled={busy}
          className="flex items-center gap-1.5 disabled:opacity-60"
          style={{ borderRadius: 999, padding: '8px 16px', background: 'var(--a-surface)', color: 'var(--a-ink)', fontSize: 12.5, fontWeight: 800, border: '1px solid var(--a-line-strong)' }}>
            <RefreshCw size={13} />
            {tr('paymenterror_yeniden_cehd_et_d273ac', 'Yenidən cəhd et')}
          </button>
        </div>
      }

      {/* ── CTA (shine effektli) ── */}
      <motion.button
        onClick={handlePurchase}
        disabled={busy || isLoading && isNative || isNative && purchaseStatus === 'pending' || isNative && selected !== 'lifetime' && !(selected === 'yearly' ? yearlyPlan : monthlyPlan)}
        whileTap={{ scale: busy ? 1 : 0.98 }}
        className="relative w-full overflow-hidden"
        style={{
          height: 56, borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer',
          background: 'linear-gradient(135deg, var(--a-peach-2), #e86a4c)',
          color: '#fff', fontSize: 15.5, fontWeight: 800,
          boxShadow: '0 18px 36px -12px rgba(217, 108, 74, 0.65)',
          opacity: busy || isLoading && isNative ? 0.65 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}
        aria-label={busy ? cfg.purchasing_text : ctaText}>

        {/* Shine sweep */}
        {!busy &&
        <motion.span
          aria-hidden
          className="absolute top-0 bottom-0"
          style={{ width: 60, background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.45), transparent)', transform: 'skewX(-20deg)' }}
          initial={{ insetInlineStart: '-20%' }}
          animate={{ insetInlineStart: '120%' }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.2, ease: 'easeInOut', repeatDelay: 1.4 }} />
        }
        {busy ?
        <><Loader2 size={17} className="animate-spin" /> {cfg.purchasing_text}</> :

        <><Crown size={17} strokeWidth={2.2} /> {ctaText}</>
        }
      </motion.button>

      {/* QayğıCash: pay the selected plan with bonus — off by default, shown only when the server enables it for this plan and platform */}
      {selected !== 'lifetime' && <QaygiCashPremiumOption plan={selected} onDone={() => onPurchased('qaygicash')} style={{ marginTop: 10 }} />}

      {/* In-app Epoint card payment (admin switch in_app_epoint: country + platform) */}
      {selected !== 'lifetime' && <EpointPayOption plan={selected} source={analyticsSource || feature || 'general'} onPremium={() => onPurchased('epoint')} style={{ marginTop: 10 }} />}

      {selected === 'yearly' && yearlyPlan && <p className="text-center mt-2 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
        {introUncertainText ?? text('charged_today', { price: yearlyPlan.priceString })} {text('renewal_year', { price: yearlyPlan.renewalPriceString })}
      </p>}
      {selected === 'monthly' && monthlyPlan && <p className="text-center mt-2 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
        {text('charged_today', { price: monthlyPlan.priceString })} {text('renewal_month', { price: monthlyPlan.renewalPriceString })}
      </p>}

      {/* ── Başqası ödəsin? (həyat yoldaşı / ailə üzvü linklə ödəyir) — native + flag ── */}
      {isNative && <SponsorEntry onSelf={() => void handlePurchase()} />}

      {/* ── Zəmanət sırası ── */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        <Shield size={12} style={{ color: 'var(--a-green-ink)' }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{cfg.cancel_notice}</span>
      </div>

      {/* ── Bərpa + Legal ── */}
      <div className="flex items-center justify-center gap-2 mt-2.5 flex-wrap">
        {isNative && isSupported &&
        <>
            <button
            onClick={handleRestore}
            disabled={busy}
            className="flex items-center gap-1 disabled:opacity-50"
            style={{ fontSize: 10.5, color: 'var(--a-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={11} className={restoring ? 'animate-spin' : ''} />
              {cfg.restore_text}
            </button>
            <span style={{ fontSize: 10.5, color: 'var(--a-ink-faint)' }}>•</span>
          </>
        }
        <a href="https://anacan.az/az/istifade-sertleri/" target="_blank" rel="noopener noreferrer"
        className="underline" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{cfg.terms_label}</a>
        <span style={{ fontSize: 10.5, color: 'var(--a-ink-faint)' }}>•</span>
        <a href="https://anacan.az/az/mexfilik-siyaseti/" target="_blank" rel="noopener noreferrer"
        className="underline" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{cfg.privacy_label}</a>
      </div>

      {/* Web qeydi */}
      {!isNative && cfg.non_native_notice &&
      <p className="text-center mt-2 flex items-center justify-center gap-1" style={{ fontSize: 10, color: 'var(--a-ink-soft)' }}>
          <Sparkles size={11} /> {cfg.non_native_notice}
        </p>
      }
    </div>);

};

export default PaywallCore;
