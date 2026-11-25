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
import { getPlatform, isNativePlatform, openStoreSubscriptions, REVENUECAT_CONFIG } from '@/lib/revenuecat';
import { premiumSourceKind, purchaseErrorMessage, storePurchaseBlock } from '@/lib/purchase-errors';
import { fetchWebPremiumState, openWebPremiumCabinet, setWebPremiumRenewal, type WebPremiumState } from '@/lib/web-premium-client';
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
  const { isPremium, ownPremium, householdPremium, subscription, isCancelled: rowCancelled, loading: isLoading, refetch: refetchSubscription } = useSubscription();
  const { toast } = useToast();
  const config = useBillingConfig();
  const { features: dbFeatures } = usePremiumConfig();
  const { showCustomerCenter, isSupported: isIAPSupported, restorePurchasesDetailed } = useInAppPurchase();
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
  // RevenueCat entitlement store of the active Premium (APP_STORE / PLAY_STORE / PROMOTIONAL ...):
  // cancel, resume and upgrade go to the place that actually bills the user.
  const [activeStore, setActiveStore] = useState<string | null | undefined>(undefined);
  const [webState, setWebState] = useState<WebPremiumState | null>(null);
  const [webBusy, setWebBusy] = useState(false);
  const platform = getPlatform();
  const isAndroidNative = isNativePlatform() && platform === 'android';

  const loadWebState = async () => { setWebState(await fetchWebPremiumState()); };
  useEffect(() => {
    // Premium bought on anacan.az (Epoint) is not visible to the store SDK.
    if (ownPremium) void loadWebState();
  }, [ownPremium]);
  const isWebSubscription = webState?.active === true && webState.source === 'web_subscription';
  const householdOnly = householdPremium && !ownPremium;
  const isCancelled = rowCancelled || (isWebSubscription && !webState?.renews);
  // Promotional / one-time web passes have nothing that renews: no cancel button.
  const nothingRenews = !isWebSubscription && (activeStore === 'PROMOTIONAL' || webState?.source === 'promotional' || webState?.source === 'web_pass');
  const storeKind: 'ios' | 'android' | null = activeStore === 'APP_STORE' || activeStore === 'MAC_APP_STORE' ? 'ios'
    : activeStore === 'PLAY_STORE' ? 'android' : null;

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
      setActiveStore((proEntitlement as { store?: string } | undefined)?.store ?? null);
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

  const openStoreManagement = async (store: 'ios' | 'android') => {
    // iOS: RevenueCat Customer Center when available, otherwise Apple's subscriptions page.
    if (store === 'ios' && isIAPSupported && platform === 'ios' && await showCustomerCenter()) return;
    openStoreSubscriptions(store, activeProductId);
  };

  const changeWebRenewal = async (action: 'cancel' | 'resume') => {
    if (action === 'cancel' && !window.confirm(tr('billing_web_cancel_confirm', 'Avtomatik yenilənmə dayandırılsın? Premium ödənilmiş dövrün sonuna qədər aktiv qalacaq.'))) return;
    setWebBusy(true);
    try {
      const result = await setWebPremiumRenewal(action);
      if (result === 'ok') {
        toast({ title: action === 'cancel'
          ? tr('billing_web_cancel_done', 'Avtomatik yenilənmə dayandırıldı. Premium ödənilmiş dövrün sonuna qədər aktivdir.')
          : tr('billing_web_resume_done', 'Avtomatik yenilənmə yenidən aktivdir.') });
        await Promise.all([loadWebState(), refetchSubscription()]);
      } else if (result === 'refused') {
        // The server keeps subscription management on anacan.az: open the cabinet there.
        openWebPremiumCabinet();
      } else {
        toast({ title: tr('billingscreen_error', 'Error'), description: tr('billing_action_failed', 'Əməliyyat alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin.'), variant: 'destructive' });
      }
    } finally { setWebBusy(false); }
  };

  const proceedWithPlatformCancel = async () => {
    // Cancel where the subscription is billed. The app itself never marks a store
    // subscription cancelled (Duzelis33): the store/anacan.az decides, sync follows.
    if (isWebSubscription) { await changeWebRenewal('cancel'); return; }
    const store = storeKind ?? (platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : null);
    if (store) {
      setIsCanceling(true);
      try { await openStoreManagement(store); } finally { setIsCanceling(false); }
      return;
    }
    // Web app without a store: subscriptions bought on anacan.az are managed in its cabinet.
    openWebPremiumCabinet();
  };

  const handleRestoreSubscription = async () => {
    setIsRestoring(true);
    try {
      // Cancelled anacan.az subscription: undo the cancellation before the period ends.
      if (isWebSubscription) { await changeWebRenewal('resume'); return; }
      // Cancelled store subscription: only the store can turn renewal back on.
      // Never claim it was re-enabled from here; open the store's management page.
      if (storeKind) {
        await openStoreManagement(storeKind);
        toast({ title: tr('billing_store_resume_hint', 'Avtomatik yenilənməni mağazanın abunəlik səhifəsində yenidən aktiv edin.') });
        return;
      }
      // Unknown source: real store restore + server-side sync (never a local status flip).
      const outcome = await restorePurchasesDetailed();
      toast(outcome.ok ?
        { title: tr("billingscreen_restore_success", "Subscription Restored"), description: tr("billingscreen_restore_success_desc", "Your Premium subscription is active again.") } :
        { title: tr("billingscreen_error", "Error"), variant: 'destructive', description: outcome.failure === 'network'
          ? tr('restore_err_network', 'Bərpa alınmadı: mağaza ilə əlaqə yoxdur. İnternet bağlantısını yoxlayıb yenidən cəhd edin.')
          : outcome.failure === 'pending' ? purchaseErrorMessage('PURCHASE_PENDING')
          : tr('pw_restore_none_desc', 'Bu hesabla bağlı əvvəlki abunəlik yoxdur') }
      );
    } finally { setIsRestoring(false); }
  };

  // Upgrade: a store purchase must not duplicate Premium billed elsewhere (anacan.az, promo,
  // household, the other platform's store). Android plan changes replace the old Play plan.
  const handleUpgrade = () => {
    const block = storePurchaseBlock(premiumSourceKind({ platform, ownPremium, householdPremium,
      storeEntitlement: isWebSubscription ? null : activeStore === undefined ? undefined : activeStore ? { store: activeStore, productIdentifier: activeProductId } : null }));
    if (block) { toast({ title: purchaseErrorMessage(block) }); return; }
    setShowPremiumModal(true);
  };

  const hasPremiumSub = subscription && (subscription.plan_type === 'premium' || subscription.plan_type === 'premium_plus');
  const isPremiumPlus = subscription?.plan_type === 'premium_plus';
  const planName = householdOnly ? tr('billing_household_active', 'Ailə Premium-u (partnyorunuzun abunəliyi)')
    : !hasPremiumSub && !isPremium ? config.free_plan_name : isPremiumPlus ? config.premium_yearly_name : config.premium_monthly_name;
  // Only the real store price (RevenueCat, the user's currency) is shown. No hardcoded
  // USD fallback: an unknown price is left out rather than shown wrong.
  const planPrice = householdOnly || (!hasPremiumSub && !isPremium) ? '' : realPriceString || '';
  const planPeriod = !planPrice ? '' : isPremiumPlus ? tr("common_per_year", "/year") : tr("common_per_month", "/month");
  // Wait for the entitlement before presenting the account as Free.
  const statusLoading = isLoading && !isPremium;

  const renderIcon = (iconName: string, className: string) => {
    const IconComp = getDynamicIcon(iconName, Sparkles);
    return <IconComp className={className} />;
  };

  const isFreeUser = !statusLoading && !hasPremiumSub && !isPremium;
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
                  ) : statusLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--a-ink-soft)' }} aria-hidden />
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--a-ink-soft)' }}>{tr("billingscreen_status_free", "Current Status: Free")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {planPrice && <div className="flex items-end gap-1 mb-1">
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--a-ink)' }}><bdi>{planPrice}</bdi></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink-soft)', marginBottom: 6 }}>{planPeriod}</span>
          </div>}

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
        {ownPremium && subscription && (
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
                <Button onClick={handleRestoreSubscription} disabled={isRestoring || webBusy} className="w-full h-11 rounded-full text-white font-bold text-sm border-0 hover:opacity-95" style={{ background: '#63bd8b' }}>
                  {isRestoring || webBusy ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RotateCcw className="w-4 h-4 me-2" />}
                  {storeKind && !isWebSubscription ? tr('billing_manage_in_store', 'Mağazada idarə et') : config.restore_cta}
                </Button>
              ) : subscription?.plan_type === 'premium' ? (
                <>
                  <Button onClick={handleUpgrade} className="flex-1 h-11 rounded-full font-bold text-sm border-0 hover:opacity-90" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                    <Crown className="w-4 h-4 me-1.5" /> {tr("billingscreen_upgrade", "Upgrade")}
                  </Button>
                  {!nothingRenews && <Button onClick={handleCancelSubscription} disabled={isCanceling || webBusy} variant="ghost" className="flex-1 h-11 rounded-full font-bold text-sm" style={{ color: 'var(--a-ink-soft)' }}>
                    {isCanceling ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <XCircle className="w-4 h-4 me-1.5" />} {config.cancel_cta}
                  </Button>}
                </>
              ) : nothingRenews ? null : (
                <Button onClick={handleCancelSubscription} disabled={isCanceling || webBusy} variant="ghost" className="w-full h-11 rounded-full font-bold text-sm" style={{ color: 'var(--a-ink-soft)' }}>
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
        {ownPremium && subscription && payments.length > 0 && (
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
