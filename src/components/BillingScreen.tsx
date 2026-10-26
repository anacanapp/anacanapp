import { useState, useEffect } from 'react';
import { useInAppPurchase } from '@/hooks/useInAppPurchase';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, CheckCircle,
  XCircle, AlertTriangle, Loader2, RotateCcw,
  CreditCard, Calendar, TrendingUp,
  Lock, ChevronRight, RefreshCw,
  Gift, LayoutGrid, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { PremiumModal } from '@/components/PremiumModal';
import { CancellationReasonDialog } from '@/components/CancellationReasonDialog';
import { useBillingConfig } from '@/hooks/usePaywallConfig';
import { usePremiumConfig } from '@/hooks/usePremiumConfig';
import { getPlatform, isNativePlatform, REVENUECAT_CONFIG } from '@/lib/revenuecat';
import { getDynamicIcon } from '@/lib/dynamicIcon';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";

interface PaymentEntry {
  productId: string;
  date: string;
  type: 'original' | 'renewal' | 'next';
  willRenew?: boolean;
}

interface BillingScreenProps {
  onBack: () => void;
}

const BillingScreen = ({ onBack }: BillingScreenProps) => {
  useScrollToTop();

  const { profile } = useAuth();
  const { isPremium, subscription, isCancelled, cancelledButActive, loading: isLoading } = useSubscription();
  const { toast } = useToast();
  const config = useBillingConfig();
  const { features: dbFeatures } = usePremiumConfig();
  const { showCustomerCenter, isSupported: isIAPSupported, restorePurchases } = useInAppPurchase();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showCancelReasonDialog, setShowCancelReasonDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  // Real, store-accurate price string (məs. "€3.99", "₼6.99") — RevenueCat-dan
  // aktiv entitlement-in real product-una görə çəkilir. Hardcode "$3.99"/"$29.99"
  // (aşağı, planPrice-da) yalnız bu hələ yüklənməyibsə/native olmayan platformada
  // fallback kimi qalır.
  const [realPriceString, setRealPriceString] = useState<string | null>(null);
  // Aktiv məhsulun RC identifikatoru — Android-də Play Store-un abunəlik
  // idarəetmə səhifəsinə düzgün SKU ilə yönləndirmək üçün (bax handleCancelSubscription).
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const isAndroidNative = isNativePlatform() && getPlatform() === 'android';

  const fetchPaymentHistory = async () => {
    if (!isNativePlatform()) return;
    setLoadingPayments(true);
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.getCustomerInfo();
      const entries: PaymentEntry[] = [];
      const allPurchases = (customerInfo as any).allPurchaseDatesByProduct || {};
      const allExpirations = (customerInfo as any).allExpirationDatesByProduct || {};
      const activeEntitlements = customerInfo.entitlements?.active || {};

      // Aktiv Pro entitlement-in real product-undan DƏQİQ qiyməti çək (istifadəçinin
      // real ödədiyi valyuta/məbləğ — country/promo-ya görə fərqli ola bilər).
      const proEntitlement = activeEntitlements[REVENUECAT_CONFIG.ENTITLEMENT_ID];
      if (proEntitlement?.productIdentifier) {
        setActiveProductId(proEntitlement.productIdentifier);
        try {
          const { products } = await Purchases.getProducts({
            productIdentifiers: [proEntitlement.productIdentifier]
          });
          if (products?.[0]?.priceString) {
            setRealPriceString(products[0].priceString);
          }
        } catch (priceErr) {
          console.error('Failed to load real product price:', priceErr);
        }
      }

      const original = (customerInfo as any).originalPurchaseDate;
      if (original) {
        entries.push({ productId: 'original', date: original, type: 'original' });
      }

      Object.entries(allPurchases).forEach(([productId, date]) => {
        if (!date) return;
        if (original && new Date(date as string).getTime() === new Date(original).getTime()) return;
        entries.push({ productId, date: date as string, type: 'renewal' });
      });

      Object.values(activeEntitlements).forEach((ent: any) => {
        if (ent?.expirationDate && ent.willRenew) {
          entries.push({
            productId: ent.productIdentifier || 'next',
            date: ent.expirationDate,
            type: 'next',
            willRenew: true
          });
        }
      });

      entries.sort((a, b) => {
        if (a.type === 'next' && b.type !== 'next') return -1;
        if (b.type === 'next' && a.type !== 'next') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setPayments(entries);
    } catch (err) {
      console.error('Failed to load payment history:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  // DÜZƏLİŞ: əvvəllər bura düz platform-ləğvinə keçirdi (yalnız bir native
  // `confirm()` xəbərdarlığı ilə) — istifadəçinin NİYƏ ləğv etdiyi heç vaxt
  // soruşulmurdu/qeydə alınmırdı. İndi əvvəlcə səliqəli bir "niyə gedirsiniz?"
  // popup göstərilir (CancellationReasonDialog) — səbəb `subscription_
  // cancellations`-a yazılır (admin panelində tam görünür), sonra YALNIZ
  // bundan sonra əsl platform-ləğv axını davam edir. "Keç" seçsə də axın
  // pozulmur — sadəcə səbəb yazılmır.
  const handleCancelSubscription = () => {
    setShowCancelReasonDialog(true);
  };

  const proceedWithPlatformCancel = async () => {
    if (isIAPSupported && !isAndroidNative) {
      setIsCanceling(true);
      await showCustomerCenter();
      setIsCanceling(false);
      return;
    }
    // Android: TƏTBİQ ÖZÜ abunəliyi ləğv edə bilməz (yalnız Google Play).
    // Əvvəllər bura sadəcə DB sətrini "cancelled" edirdi — Play Store-da real
    // abunəlik davam edir, istifadəçi ödənişi almağa davam edirdi, tətbiq isə
    // "ləğv edilib" göstərirdi. İndi birbaşa Play Store-un öz abunəlik idarəetmə
    // səhifəsinə yönləndirir (Google-ın da tələb etdiyi düzgün üsul).
    if (isAndroidNative) {
      const pkg = 'com.atlasoon.anacan';
      const url = activeProductId ?
      `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(activeProductId)}&package=${pkg}` :
      `https://play.google.com/store/account/subscriptions?package=${pkg}`;
      window.open(url, '_system');
      return;
    }
    // Native olmayan (web) — real store yoxdur, sadəcə dəstək ünvanına yönləndir.
    toast({ title: tr("billingscreen_error", "Error"), description: tr("billingscreen_cancel_error", "Failed to cancel subscription."), variant: 'destructive' });
  };

  const handleRestoreSubscription = async () => {
    setIsRestoring(true);
    // Real RevenueCat restore (Store-dan) + server-side sync-revenuecat-entitlement
    // (əvvəllər useSubscription().restoreSubscription() heç bir yoxlama olmadan
    // sadəcə DB status-unu "active" edirdi — real yoxlama YOX idi).
    const success = await restorePurchases();
    toast(success ?
      { title: tr("billingscreen_restore_success", "Subscription Restored"), description: tr("billingscreen_restore_success_desc", "Your Premium subscription is active again.") } :
      { title: tr("billingscreen_error", "Error"), description: tr("billingscreen_restore_error", "Failed to restore subscription."), variant: 'destructive' }
    );
    setIsRestoring(false);
  };

  const hasPremiumSub = subscription && (subscription.plan_type === 'premium' || subscription.plan_type === 'premium_plus');
  const isPremiumPlus = subscription?.plan_type === 'premium_plus';
  const planName = !hasPremiumSub && !isPremium ? config.free_plan_name : isPremiumPlus ? config.premium_yearly_name : config.premium_monthly_name;
  // Mümkünsə RevenueCat-dan çəkilən REAL qiymət (real valyuta/məbləğ) göstərilir;
  // yalnız hələ yüklənməyibsə (native olmayan platforma, ya da fetch uğursuz olub)
  // fallback olaraq "rəsmi" pricing_2026 dəyərləri göstərilir.
  const planPrice = !hasPremiumSub && !isPremium ? '$0' : realPriceString || (isPremiumPlus ? '$29.99' : '$3.99');
  const planPeriod = !hasPremiumSub && !isPremium ? '' : isPremiumPlus ? tr("common_per_year", "/year") : tr("common_per_month", "/month");

  const renderIcon = (iconName: string, className: string) => {
    const IconComp = getDynamicIcon(iconName, Sparkles);
    return <IconComp className={className} />;
  };

  const isFreeUser = !hasPremiumSub && !isPremium;
  const allFeaturesList = dbFeatures.filter((f) => f.is_included_premium);

  return (
    <div className="a-scope safe-top min-h-screen pb-safe overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 py-2.5 flex items-center gap-3"
      style={{ background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
        <motion.button
          onClick={onBack}
          className="a-icon-btn"
          whileTap={{ scale: 0.95 }}
          aria-label={tr("common_geri", "Geri")}
        >
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </motion.button>
        <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{tr("billingscreen_title", "My Subscription")}</h1>
      </div>

      <div className="px-4 py-4 space-y-3.5 max-w-lg mx-auto">

        {/* Status Card */}
        <div style={{
          background: 'var(--a-surface)',
          borderRadius: 'var(--a-radius-md)',
          padding: 18,
          boxShadow: 'var(--a-card-shadow)',
          border: isPremium ? '1.5px solid var(--a-peach-2)' : '1.5px solid transparent'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{
                borderRadius: 14,
                background: isPremium ? 'var(--a-grad-peach)' : 'var(--a-surface-soft)',
                color: isPremium ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)'
              }}>
                <Crown size={19} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--a-ink)' }}>{planName}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPremium && !isCancelled ? (
                    <span className="flex items-center gap-1"
                    style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#63bd8b' }} />
                      {config.active_badge}
                    </span>
                  ) : isCancelled && isPremium ? (
                    <span className="flex items-center gap-1"
                    style={{ background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {config.cancelled_badge}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--a-ink-soft)' }}>{tr("billingscreen_status_free", "Current Status: Free")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-end gap-1 mb-1">
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--a-ink)' }}>{planPrice}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink-soft)', marginBottom: 6 }}>{planPeriod}</span>
          </div>

          {isFreeUser && (
            <Button
              onClick={() => setShowPremiumModal(true)}
              className="w-full mt-4 h-12 rounded-full text-white font-bold border-0 hover:opacity-95"
              style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}
            >
              <Crown className="w-4 h-4 me-2" />
              {tr("billingscreen_upgrade_btn", "Upgrade to Premium")}
            </Button>
          )}
        </div>

        {/* Subscription Details (Compact Grid) */}
        {isPremium && subscription && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col justify-center" style={{ background: 'var(--a-surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--a-card-shadow)' }}>
              <p className="flex items-center gap-1 mb-1" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--a-ink-soft)' }}>
                <Calendar className="w-3 h-3" /> {config.start_date_label}
              </p>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>
                {format(new Date(subscription.started_at), 'd MMM yyyy', { locale: getCurrentDateLocale() })}
              </p>
            </div>

            {subscription.expires_at && (
              <div className="flex flex-col justify-center" style={{ background: 'var(--a-surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--a-card-shadow)' }}>
                <p className="flex items-center gap-1 mb-1" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--a-ink-soft)' }}>
                  {isCancelled ? <AlertTriangle className="w-3 h-3" style={{ color: 'var(--a-yellow-ink)' }} /> : <TrendingUp className="w-3 h-3" style={{ color: 'var(--a-accent-ink)' }} />}
                  {isCancelled ? config.expiry_label : config.renewal_label}
                </p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: isCancelled ? 'var(--a-yellow-ink)' : 'var(--a-ink)' }}>
                  {format(new Date(subscription.expires_at), 'd MMM yyyy', { locale: getCurrentDateLocale() })}
                </p>
              </div>
            )}

            <div className="col-span-2 flex gap-2" style={{ background: 'var(--a-surface)', borderRadius: 18, padding: 8, boxShadow: 'var(--a-card-shadow)' }}>
              {isCancelled ? (
                <Button onClick={handleRestoreSubscription} disabled={isRestoring} className="w-full h-11 rounded-full text-white font-bold text-sm border-0 hover:opacity-95" style={{ background: '#63bd8b' }}>
                  {isRestoring ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RotateCcw className="w-4 h-4 me-2" />}
                  {config.restore_cta}
                </Button>
              ) : subscription?.plan_type === 'premium' ? (
                <>
                  <Button onClick={() => setShowPremiumModal(true)} className="flex-1 h-11 rounded-full font-bold text-sm border-0 hover:opacity-90" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                    <Crown className="w-4 h-4 me-1.5" /> {tr("billingscreen_upgrade", "Upgrade")}
                  </Button>
                  <Button onClick={handleCancelSubscription} disabled={isCanceling} variant="ghost" className="flex-1 h-11 rounded-full font-bold text-sm" style={{ color: 'var(--a-ink-soft)' }}>
                    {isCanceling ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <XCircle className="w-4 h-4 me-1.5" />} {config.cancel_cta}
                  </Button>
                </>
              ) : (
                <Button onClick={handleCancelSubscription} disabled={isCanceling} variant="ghost" className="w-full h-11 rounded-full font-bold text-sm" style={{ color: 'var(--a-ink-soft)' }}>
                  {isCanceling ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <XCircle className="w-4 h-4 me-2" />} {config.cancel_cta}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Compact Premium Tools Showcase */}
        <div className="overflow-hidden" style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--a-line)', background: 'var(--a-surface-soft)' }}>
            <h3 className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-ink)' }}>
              <LayoutGrid size={15} style={{ color: 'var(--a-accent-ink)' }} />
              {tr("billingscreen_premium_features", "Premium Features")}
            </h3>
          </div>

          <div className="p-2 grid grid-cols-1 gap-1">
            {allFeaturesList.map((f, i) => {
              // The hook has already resolved server and source-bound copy.
              // A second fallback here could replace it with English or AZ.
              const feat = f;
              const text = f.title;
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl transition-colors">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ borderRadius: 10, background: 'var(--a-peach-1)' }}>
                    {feat ? <span className="text-sm">{feat.icon}</span> : renderIcon((f as any).icon, 'w-4 h-4')}
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-ink)' }}>{text}</p>
                  </div>
                  {!isPremium ? (
                    <Lock className="w-3.5 h-3.5 shrink-0 me-1" style={{ color: 'var(--a-ink-faint)' }} />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 me-1" style={{ color: '#63bd8b' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Payment History */}
        {isPremium && subscription && payments.length > 0 && (
          <div style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', padding: 16, boxShadow: 'var(--a-card-shadow)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-ink)' }}>
                <CreditCard size={15} style={{ color: 'var(--a-accent-ink)' }} />
                {config.payment_title}
              </h3>
              <button onClick={fetchPaymentHistory} disabled={loadingPayments} className="p-1.5 rounded-full transition-colors" aria-label={tr("billingscreen_refresh", "Yenilə")}>
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPayments ? 'animate-spin' : ''}`} style={{ color: loadingPayments ? 'var(--a-peach-2)' : 'var(--a-ink-soft)' }} />
              </button>
            </div>

            <div className="relative ps-5 space-y-4 ms-1.5" style={{ borderLeft: '1px solid var(--a-line-strong)' }}>
              {payments.map((p, i) => {
                const isNext = p.type === 'next';
                const isOriginal = p.type === 'original';
                const isYearly = p.productId.toLowerCase().includes('year') || p.productId.toLowerCase().includes('annual');

                const label = isOriginal ? tr("billingscreen_first_purchase", "First Purchase") :
                              isNext ? tr("billingscreen_next_renewal", "Next Renewal") :
                              tr("billingscreen_auto_renewal", "Auto Renewal");

                return (
                  <div key={`${p.productId}-${p.date}-${i}`} className="relative">
                    <div className="absolute -start-[25px] top-1 w-2.5 h-2.5 rounded-full"
                    style={{ background: isNext ? '#ffc94d' : 'var(--a-peach-2)', boxShadow: '0 0 0 2px var(--a-surface)' }} />
                    <div className="flex justify-between items-start">
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-ink)' }}>
                          {isYearly ? tr("billingscreen_annual_premium", "Annual Premium") : tr("billingscreen_monthly_premium", "Monthly Premium")}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--a-ink-soft)' }}>{format(new Date(p.date), 'd MMM yyyy', { locale: getCurrentDateLocale() })} · {label}</p>
                      </div>
                      <div className="uppercase"
                      style={{
                        padding: '2px 7px', borderRadius: 7, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
                        background: isNext ? 'var(--a-yellow-1)' : 'var(--a-green-1)',
                        color: isNext ? 'var(--a-yellow-ink)' : 'var(--a-green-ink)'
                      }}>
                        {isNext ? tr("billingscreen_scheduled", "Scheduled") : config.paid_label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isIAPSupported && !isAndroidNative && (
              <button
                onClick={async () => { await showCustomerCenter(); fetchPaymentHistory(); }}
                className="w-full mt-4 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5"
                style={{ background: 'var(--a-surface-soft)', fontSize: 12, fontWeight: 700, color: 'var(--a-accent-ink)' }}
              >
                {tr("billingscreen_open_in_store", "View in App Store")}
                <ChevronRight className="rtl:rotate-180 w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Footer Support */}
        <div className="text-center pt-2 pb-6">
          <p className="flex items-center justify-center gap-1.5" style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>
            <Gift className="w-3.5 h-3.5" />
            {tr("billingscreen_need_help", "Need help?")} <a href={`mailto:${config.support_email}`} style={{ color: 'var(--a-accent-ink)', fontWeight: 700 }}>{config.support_email}</a>
          </p>
        </div>
      </div>

      <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
      <CancellationReasonDialog
        isOpen={showCancelReasonDialog}
        onClose={() => setShowCancelReasonDialog(false)}
        onProceed={proceedWithPlatformCancel}
        planType={subscription?.plan_type}
        wasTrial={subscription?.is_trial}
      />
    </div>
  );
};

export default BillingScreen;
