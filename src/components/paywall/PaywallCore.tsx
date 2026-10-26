import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Loader2, RefreshCw, Shield, Sparkles, Star, Infinity as InfinityIcon } from 'lucide-react';
import { useInAppPurchase, type RCPackage } from '@/hooks/useInAppPurchase';
import { usePaywallConfig } from '@/hooks/usePaywallConfig';
import { usePremiumConfig } from '@/hooks/usePremiumConfig';
import { getPlatform, isNativePlatform } from '@/lib/revenuecat';
import { annualStorePlan, standardStorePlan } from '@/lib/onboarding-billing';
import { onboardingText } from '@/lib/onboarding-i18n';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';
import { followupText } from '@/lib/followup-i18n';
import { appLanguageLocale } from '@/lib/app-languages';

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
  feature?: string;
  /** Uğurlu alışdan sonra çağırılır */
  onPurchased: (planId: string) => void;
  /** Web/dəstəklənməyən platformada CTA davranışı (funnel: davam et). Yoxdursa toast göstərilir. */
  onNonNativeCta?: () => void;
  /** Funnel üçün bir az sıx rejim */
  compact?: boolean;
}

const currencySign = (code?: string) =>
code === 'AZN' ? '₼' : code === 'USD' ? '$' : code === 'EUR' ? '€' : code ? `${code} ` : '$';

const PaywallCore = ({ feature, onPurchased, onNonNativeCta, compact = false }: PaywallCoreProps) => {
  const { toast } = useToast();
  const cfg = usePaywallConfig();
  const language = useUserStore(state => state.language);
  const text = (key: Parameters<typeof onboardingText>[1], values?: Record<string, string | number>) => onboardingText(language, key, values);
  const { features: dbFeatures } = usePremiumConfig();
  const {
    packages, isLoading, isPurchasing, error, isSupported,
    purchaseByIdentifier, purchaseExact, introEligibility, restorePurchases
  } = useInAppPurchase();

  const isNative = isNativePlatform();
  const [selected, setSelected] = useState<PlanKey>('yearly');
  const [restoring, setRestoring] = useState(false);

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
  const sign = currencySign(yearlyPkg?.product.currencyCode || monthlyPkg?.product.currencyCode);
  const monthlyPrice = monthlyPlan?.price ?? monthlyPkg?.product.price ?? 3.99;
  const yearlyPrice = yearlyPlan?.price ?? yearlyPkg?.product.price ?? 29.99;
  const monthlyStr = isNative && !monthlyPlan ? '—' : monthlyPlan?.priceString || monthlyPkg?.product.priceString || `${sign}${monthlyPrice.toFixed(2)}`;
  const yearlyStr = isNative && !yearlyPlan ? '—' : yearlyPlan?.priceString || yearlyPkg?.product.priceString || `${sign}${yearlyPrice.toFixed(2)}`;
  const annualDiscount = !!yearlyPlan && yearlyPlan.price < yearlyPlan.renewalPrice;
  const lifetimeStr = lifetimePkg?.product.priceString || '';
  const yearlyPerMonth = `${sign}${(yearlyPrice / 12).toFixed(2)}`;
  const savings = annualDiscount ? Math.round((1 - yearlyPlan!.price / yearlyPlan!.renewalPrice) * 100)
    : monthlyPrice > 0 ? Math.max(0, Math.round((1 - yearlyPrice / 12 / monthlyPrice) * 100)) : 0;

  // ── Xüsusiyyət siyahısı (DB → kurasiya olunmuş fallback) ──
  const FALLBACK_FEATURES = [
  { icon: '🤖', title: tr('pw_feat_ai', 'Limitsiz Dr. Anacan AI') },
  { icon: '🛠️', title: tr('pw_feat_tools', 'Bütün alətlərə tam giriş') },
  { icon: '📄', title: tr('pw_feat_reports', 'Həkim üçün PDF hesabatlar') },
  { icon: '💑', title: tr('pw_feat_household', 'Partnyorla ortaq Premium') },
  { icon: '🎵', title: tr('pw_feat_sounds', 'Yuxu səsləri və meditasiya') },
  { icon: '🚫', title: tr('pw_feat_noads', 'Tam reklamsız təcrübə') }];

  const featureList = useMemo(() => {
    const db = dbFeatures.
    filter((f) => f.is_included_premium).
    slice(0, 6).
    map((f) => ({ icon: f.icon || '✨', title: f.title }));
    return db.length >= 4 ? db : FALLBACK_FEATURES;
  }, [dbFeatures, language]);

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

    import('@/lib/analytics').then((m) => m.analytics.logPaywallClicked(feature || 'general', selected)).catch(() => {});
    const ok = plan ? await purchaseExact(plan.pkg, plan.request) : await purchaseByIdentifier(pkg.identifier);
    if (ok) {
      toast({
        title: tr('pw_success_title', 'Premium aktivləşdirildi! 🎉'),
        description: tr('pw_success_desc', 'Bütün imkanlar açıldı — xoş istifadələr!')
      });
      onPurchased(selected);
    }
  }, [isNative, isSupported, selected, yearlyPkg, monthlyPkg, lifetimePkg, yearlyPlan, monthlyPlan, purchaseExact, purchaseByIdentifier, onPurchased, onNonNativeCta, toast, cfg.non_native_notice, feature]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) {
      toast({ title: tr('pw_restored', 'Alışlar bərpa edildi ✓'), description: tr('pw_restored_desc', 'Premium abunəliyiniz aktivdir') });
      onPurchased('restore');
    } else {
      toast({ title: tr('pw_restore_none', 'Alış tapılmadı'), description: tr('pw_restore_none_desc', 'Bu hesabla bağlı əvvəlki abunəlik yoxdur'), variant: 'destructive' });
    }
  }, [restorePurchases, onPurchased, toast]);

  const ctaText = text('premium_cta');

  const busy = isPurchasing || restoring;

  // ── Plan kartı ──
  const PlanCard = ({
    plan, label, priceMain, priceMainSuffix, sub, badge, icon, oldPrice



  }: {plan: PlanKey;label: string;priceMain: string;priceMainSuffix?: string;sub: string;badge?: string;icon?: React.ReactNode;oldPrice?: string;}) => {
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
        {text('remove_ads_premium')}
      </p>
      {/* Xəta */}
      {error &&
      <div role="alert" className="text-center mb-3"
      style={{ background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', borderRadius: 14, padding: '9px 12px', fontSize: 12, fontWeight: 600 }}>
          {error}
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

      {/* ── Sosial sübut ── */}
      <div className={`flex items-center justify-center gap-1 ${compact ? 'mb-3' : 'mb-4'}`}>
        {[1, 2, 3, 4, 5].map((i) =>
        <Star key={i} size={13} style={{ fill: '#ffc94d', color: '#ffc94d' }} />
        )}
        <span className="ms-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
          {followupText('social_proof', language, { count: new Intl.NumberFormat(appLanguageLocale(language)).format(10000) })}
        </span>
      </div>

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
          sub={isNative && !yearlyPlan ? text('store_unavailable') : annualDiscount ? text('first_year', { price: yearlyStr }) : `${yearlyPerMonth}${cfg.yearly_suffix} · ${tr('pw_billed_yearly', 'ildə bir dəfə ödənilir')}`}
          badge={isNative && !yearlyPlan ? undefined : cfg.savings_badge.replace('{percent}', String(savings))} />

          <PlanCard
          plan="monthly"
          label={cfg.monthly_label}
          priceMain={monthlyStr}
          priceMainSuffix={cfg.monthly_suffix}
          sub={isNative && !monthlyPlan ? text('store_unavailable') : tr('pw_flexible', 'Çevik — istənilən ay dayandır')} />

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

      {/* ── CTA (shine effektli) ── */}
      <motion.button
        onClick={handlePurchase}
        disabled={busy || isLoading && isNative || isNative && selected !== 'lifetime' && !(selected === 'yearly' ? yearlyPlan : monthlyPlan)}
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

      {selected === 'yearly' && yearlyPlan && <p className="text-center mt-2 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
        {text('charged_today', { price: yearlyPlan.priceString })} {text('renewal_year', { price: yearlyPlan.renewalPriceString })}
      </p>}

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
        <a href="https://anacanapp.lovable.app/legal/terms_of_service" target="_blank" rel="noopener noreferrer"
        className="underline" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{cfg.terms_label}</a>
        <span style={{ fontSize: 10.5, color: 'var(--a-ink-faint)' }}>•</span>
        <a href="https://anacanapp.lovable.app/legal/privacy_policy" target="_blank" rel="noopener noreferrer"
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
