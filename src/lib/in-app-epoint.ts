import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSetting } from '@/hooks/useAppSettings';
import { appLanguageLocale, readAppLanguage } from '@/lib/app-languages';
import { funnelHit, funnelPlatform, purchaseIntent } from '@/lib/premium-funnel';
import type { IepKey } from '@/lib/in-app-epoint-copy';

/**
 * In-app Epoint card payment for Premium (owner 2026-11-25).
 *
 * Shown inside the app paywall when app_settings.in_app_epoint enables the user's country (profiles.country_code,
 * falling back to the device locale region) and platform. The checkout is the anacan.az web subscription
 * (web-premium 'subscribe' with page 'app'): Epoint card registration with the first payment, renewing with the saved
 * card. The server prices it, refuses it while any Premium is active, re-checks the admin setting, and grants Premium
 * only from Epoint's signed callback. The app opens the payment page in the in-app browser when the native Browser
 * plugin is present (otherwise the system browser; on the web the page itself navigates) and, when the user comes back,
 * polls the Premium entitlement (get_premium_access_v1) for up to a minute.
 */

export type EpointPlan = 'monthly' | 'yearly';
export type AppPlatform = 'ios' | 'android' | 'web';
export interface InAppEpointSetting { enabled: boolean; countries: string[]; platforms: Record<AppPlatform, boolean> }
export interface EpointPlanPrice { price: number; was: number | null; pct: number | null; perMonth: number | null; usd: number | null }
export interface EpointOffer {
  paymentsReady: boolean;
  /** 'app': admin USD prices converted to AZN at the CBAR rate (in-app offer). */
  kind: 'app' | 'campaign' | 'standard' | null;
  rate: { value: number; date: string | null; source: string | null } | null;
  plans: Record<EpointPlan, EpointPlanPrice | null>;
  premium: { active: boolean; source: string | null };
}
export type InAppEpointStatus = 'idle' | 'starting' | 'redirected' | 'checking' | 'success' | 'timeout' | 'error';

// ── pure helpers (unit-tested) ─────────────────────────────────────────────────────────

/** Same reading as the server (web-premium-subscription.ts parseInAppEpoint): unreadable means off. */
export function parseInAppEpointSetting(raw: unknown): InAppEpointSetting {
  let value: unknown = raw;
  for (let i = 0; i < 2 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { value = null; } }
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const platforms = v.platforms && typeof v.platforms === 'object' ? v.platforms as Record<string, unknown> : {};
  const countries = Array.isArray(v.countries)
    ? [...new Set(v.countries.filter((c): c is string => typeof c === 'string').map(c => c.trim().toUpperCase()).filter(c => /^[A-Z]{2}$/.test(c)))]
    : [];
  return { enabled: v.enabled === true, countries,
    platforms: { android: platforms.android === true, ios: platforms.ios === true, web: platforms.web === true } };
}

export function isInAppEpointEligible(setting: InAppEpointSetting, country: string | null | undefined, platform: AppPlatform): boolean {
  const code = (country ?? '').trim().toUpperCase();
  return setting.enabled && setting.platforms[platform] === true && /^[A-Z]{2}$/.test(code) && setting.countries.includes(code);
}

/** Region of a BCP 47 tag ('az-AZ' → 'AZ', 'az-Latn-AZ' → 'AZ'); null without one. */
export function localeRegion(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const parts = tag.replace(/_/g, '-').split('-').slice(1);
  const region = parts.find(part => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
}

/** The profile country, else the device locale region. */
export function resolveCountry(profileCountry: string | null | undefined, deviceLocale?: string | null): string | null {
  const own = (profileCountry ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(own)) return own;
  return localeRegion(deviceLocale ?? (typeof navigator !== 'undefined' ? navigator.language : null));
}

const planPrice = (value: unknown, usdValue?: unknown): EpointPlanPrice | null => {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const price = Number(v.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const was = v.was == null ? null : Number(v.was);
  const pct = v.pct == null ? null : Number(v.pct);
  const perMonth = v.per_month == null ? null : Number(v.per_month);
  return { price, was: Number.isFinite(was) && was! > price ? was : null, pct: Number.isFinite(pct) ? pct : null,
    perMonth: Number.isFinite(perMonth) ? perMonth : null,
    usd: typeof usdValue === 'number' && Number.isFinite(usdValue) && usdValue > 0 ? usdValue : null };
};

/** web-premium 'status' answer → what the paywall shows (server prices only). */
export function parseEpointStatus(data: unknown): EpointOffer | null {
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) return null;
  const d = data as Record<string, unknown>;
  const offer = d.offer && typeof d.offer === 'object' ? d.offer as Record<string, unknown> : {};
  const plans = offer.active === true && offer.plans && typeof offer.plans === 'object' ? offer.plans as Record<string, unknown> : {};
  const premium = d.premium && typeof d.premium === 'object' ? d.premium as Record<string, unknown> : {};
  const usd = offer.usd && typeof offer.usd === 'object' ? offer.usd as Record<string, unknown> : {};
  const rate = Number(offer.rate);
  return {
    paymentsReady: d.payments_ready === true,
    kind: offer.kind === 'app' || offer.kind === 'campaign' || offer.kind === 'standard' ? offer.kind : null,
    rate: Number.isFinite(rate) && rate > 0 ? { value: rate, date: typeof offer.rate_date === 'string' ? offer.rate_date : null,
      source: typeof offer.rate_source === 'string' ? offer.rate_source : null } : null,
    plans: { monthly: planPrice(plans.monthly, usd.monthly), yearly: planPrice(plans.yearly, usd.yearly) },
    premium: { active: premium.active === true, source: typeof premium.source === 'string' ? premium.source : null },
  };
}

/** Error code of a web-premium answer → copy key. Store Premium gets its own message. */
export function epointErrorKey(code: string | null | undefined, premiumSource?: string | null): IepKey {
  switch (code) {
    case 'premium_active': return premiumSource === 'store' ? 'iep_err_premium_store' : 'iep_err_premium_active';
    case 'payments_unavailable': return 'iep_err_payments_unavailable';
    case 'too_many_attempts': case 'rate_limited': return 'iep_err_too_many_attempts';
    case 'checkout_unavailable': case 'app_checkout_disabled': case 'invalid_plan': return 'iep_err_checkout_unavailable';
    default: return 'iep_err_generic';
  }
}

/** Price as the paywall shows it: "4,99 ₼" in the app language's number format. */
export function formatAzn(amount: number, language: string = readAppLanguage()): string {
  let locale = 'az-AZ';
  try { locale = appLanguageLocale(language); } catch { /* default */ }
  try {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ₼`;
  } catch { return `${amount.toFixed(2)} ₼`; }
}

/** Polls `check` until it is true or the time is up. */
export async function pollUntil(check: () => Promise<boolean>, opts: { timeoutMs?: number; intervalMs?: number; cancelled?: () => boolean;
  sleep?: (ms: number) => Promise<void>; now?: () => number } = {}): Promise<boolean> {
  const { timeoutMs = 60_000, intervalMs = 3_000, cancelled = () => false, now = Date.now } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const deadline = now() + timeoutMs;
  while (!cancelled()) {
    if (await check().catch(() => false)) return true;
    if (now() + intervalMs > deadline) return false;
    await sleep(intervalMs);
  }
  return false;
}

// ── server calls ───────────────────────────────────────────────────────────────────────

async function invokeWebPremium(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase.functions.invoke('web-premium', { body });
    if (!error && data && typeof data === 'object') return data as Record<string, unknown>;
    let parsed: unknown = null;
    try { parsed = await (error as { context?: { json?: () => Promise<unknown> } } | null)?.context?.json?.(); } catch { /* not JSON */ }
    return parsed && typeof parsed === 'object' ? { ok: false, ...(parsed as Record<string, unknown>) } : null;
  } catch { return null; }
}

export async function fetchEpointOffer(): Promise<EpointOffer | null> {
  // page 'app': the in-app offer (admin USD prices converted to AZN by the server), not the website campaign.
  return parseEpointStatus(await invokeWebPremium({ action: 'status', page: 'app' }));
}

export type CheckoutStart = { ok: true; url: string } | { ok: false; error: string; premiumSource: string | null };

export async function requestEpointCheckout(plan: EpointPlan, platform: AppPlatform, language: string): Promise<CheckoutStart> {
  const data = await invokeWebPremium({ action: 'subscribe', plan, page: 'app', consent: 'premium-autorenew-v1', platform, language });
  if (data?.ok === true && typeof data.redirect_url === 'string' && /^https:\/\//.test(data.redirect_url)) return { ok: true, url: data.redirect_url };
  const premium = data?.premium && typeof data.premium === 'object' ? data.premium as { source?: unknown } : null;
  return { ok: false, error: typeof data?.error === 'string' ? data.error : 'unavailable',
    premiumSource: typeof premium?.source === 'string' ? premium.source : null };
}

/** Own Premium as get_premium_access_v1 answers it (the same RPC usePremiumEntitlement reads). */
export async function hasOwnPremium(userId: string): Promise<boolean> {
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    'get_premium_access_v1', { p_user_id: userId });
  const access = data as { protocol?: string; userId?: string; own?: { active?: boolean } } | null;
  return !error && access?.protocol === 'anacan-premium-access-v1' && access.userId === userId && access.own?.active === true;
}

// ── opening the payment page ───────────────────────────────────────────────────────────

interface BrowserPlugin {
  open(options: { url: string; presentationStyle?: 'fullscreen' | 'popover' }): Promise<void>;
  addListener(event: 'browserFinished', listener: () => void): Promise<PluginListenerHandle>;
}
// Resolves to @capacitor/browser's native plugin when a build includes it; otherwise isPluginAvailable is false.
const Browser = registerPlugin<BrowserPlugin>('Browser');

/** 'in_app' (Browser plugin), 'external' (system browser) or 'same_tab' (web). */
export async function openCheckoutPage(url: string, onClosed?: () => void): Promise<'in_app' | 'external' | 'same_tab'> {
  if (!Capacitor.isNativePlatform()) {
    window.location.assign(url);
    return 'same_tab';
  }
  if (Capacitor.isPluginAvailable('Browser')) {
    try {
      if (onClosed) {
        const handle = await Browser.addListener('browserFinished', () => { void handle.remove(); onClosed(); });
      }
      await Browser.open({ url, presentationStyle: 'fullscreen' });
      return 'in_app';
    } catch { /* fall through to the system browser */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return 'external';
}

// A checkout that left the app (the WebView may be reloaded meanwhile): the next mount resumes checking.
const PENDING_KEY = 'anacan_iep_pending_v1';
const PENDING_MS = 30 * 60_000;
function markPending(userId: string) { try { localStorage.setItem(PENDING_KEY, JSON.stringify({ userId, at: Date.now() })); } catch { /* private mode */ } }
function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ } }
export function pendingCheckout(userId: string | null | undefined, now = Date.now()): boolean {
  if (!userId) return false;
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') as { userId?: string; at?: number } | null;
    return value?.userId === userId && typeof value.at === 'number' && now - value.at < PENDING_MS;
  } catch { return false; }
}

/** Same roots the store purchase sync and QayğıCash Premium refresh. */
const PREMIUM_ROOTS = new Set(['premium-access-v1', 'subscription', 'household-premium', 'community-feed', 'group-posts', 'post-comments',
  'single-post', 'user-posts', 'community-connections', 'public-profile', 'community-profile', 'community-profile-card', 'chat-authors-v2']);

// ── hook ───────────────────────────────────────────────────────────────────────────────

export interface UseInAppEpoint {
  /** Admin setting allows this user (country + platform), the merchant is live, there is a price and no Premium. */
  available: boolean;
  /** Country + platform pass the admin setting (prices may still be loading). */
  eligible: boolean;
  offer: EpointOffer | null;
  /** Where the user's current Premium comes from ('store', 'web_subscription', 'web_pass', 'promotional') or null. */
  activeSource: string | null;
  status: InAppEpointStatus;
  /** Copy key of the last error / timeout message, if any. */
  messageKey: IepKey | null;
  startCheckout: (plan: EpointPlan) => Promise<void>;
  /** Re-run the entitlement check (after a timeout). */
  checkAgain: () => void;
  priceLabel: (plan: EpointPlan) => string | null;
}

export function useInAppEpoint(source = 'paywall'): UseInAppEpoint {
  const { user, profile } = useAuth();
  const client = useQueryClient();
  const userId = user?.id ?? null;
  const rawSetting = useAppSetting('in_app_epoint');
  const setting = useMemo(() => parseInAppEpointSetting(rawSetting), [rawSetting]);
  const platform = funnelPlatform();
  const country = resolveCountry((profile as { country_code?: string | null } | null)?.country_code);
  const eligible = !!userId && isInAppEpointEligible(setting, country, platform);

  const offerQuery = useQuery({
    queryKey: ['in-app-epoint-offer', userId], enabled: eligible, staleTime: 60_000, retry: false,
    queryFn: fetchEpointOffer,
  });
  const offer = eligible ? offerQuery.data ?? null : null;
  const [status, setStatus] = useState<InAppEpointStatus>('idle');
  const [messageKey, setMessageKey] = useState<IepKey | null>(null);
  const busy = useRef(false), polling = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const poll = useCallback(async () => {
    if (!userId || polling.current) return;
    polling.current = true;
    if (mounted.current) { setStatus('checking'); setMessageKey(null); }
    const active = await pollUntil(() => hasOwnPremium(userId), { cancelled: () => !mounted.current });
    polling.current = false;
    void client.invalidateQueries({ predicate: ({ queryKey }) => PREMIUM_ROOTS.has(String(queryKey[0])) || queryKey[0] === 'in-app-epoint-offer' });
    if (!mounted.current) return;
    // Either way the automatic check is over; "check again" stays available after a timeout.
    clearPending();
    if (active) { setStatus('success'); setMessageKey(null); }
    else { setStatus('timeout'); setMessageKey('iep_timeout'); }
  }, [userId, client]);

  // Back from the payment page: app resume, tab visible again, or a reload while a checkout was pending.
  useEffect(() => {
    if (!userId) return;
    if (pendingCheckout(userId)) void poll();
    const onVisible = () => { if (document.visibilityState === 'visible' && pendingCheckout(userId)) void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    let handle: PluginListenerHandle | null = null, cancelled = false;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(async ({ App }) => {
        const h = await App.addListener('resume', () => { if (pendingCheckout(userId)) void poll(); });
        if (cancelled) void h.remove(); else handle = h;
      }).catch(() => { /* resume listener is best effort; visibilitychange covers it */ });
    }
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); void handle?.remove(); };
  }, [userId, poll]);

  const startCheckout = useCallback(async (plan: EpointPlan) => {
    if (!userId || busy.current || !eligible) return;
    busy.current = true;
    setStatus('starting'); setMessageKey(null);
    funnelHit('epoint_started', source);
    purchaseIntent(source, plan);
    try {
      const result = await requestEpointCheckout(plan, platform, readAppLanguage());
      if (result.ok !== true) {
        const failure = result as Extract<CheckoutStart, { ok: false }>;
        setStatus('error');
        setMessageKey(epointErrorKey(failure.error, failure.premiumSource));
        if (failure.error === 'premium_active') void client.invalidateQueries({ queryKey: ['in-app-epoint-offer', userId] });
        return;
      }
      markPending(userId);
      setStatus('redirected');
      await openCheckoutPage(result.url, () => { void poll(); });
    } catch {
      setStatus('error'); setMessageKey('iep_err_generic');
    } finally { busy.current = false; }
  }, [userId, eligible, source, platform, client, poll]);

  const checkAgain = useCallback(() => { void poll(); }, [poll]);
  const priceLabel = useCallback((plan: EpointPlan) => {
    const value = offer?.plans[plan];
    return value ? formatAzn(value.price) : null;
  }, [offer]);

  const available = eligible && !!offer && offer.paymentsReady && !offer.premium.active && !!(offer.plans.monthly || offer.plans.yearly);
  return { available, eligible, offer, activeSource: offer?.premium.active ? offer.premium.source : null, status, messageKey,
    startCheckout, checkAgain, priceLabel };
}
