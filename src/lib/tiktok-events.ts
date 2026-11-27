/**
 * TikTok Business SDK (App Events) wrapper, native only (packages/tiktok-events).
 *
 * Same rules as Meta (facebook-events.ts):
 * - Nothing reaches TikTok without the person's attribution consent (Məxfilik → Razılıq). Without it the SDK is
 *   never initialized, so install/launch auto-events are not sent either.
 * - Only the marketing/conversion events below are mapped. Health records (weight, mood, symptoms, kicks, cycle
 *   data...) are never sent.
 * - The ATT prompt is asked by the app (facebook-events.ts), never by the TikTok SDK.
 * Credentials live in the native plugin config staged from the private .env.tiktok.local
 * (scripts/native/tiktok-native-config.mjs); JS never sees them.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAttributionAllowed } from './privacyConsent';

type Props = Record<string, string | number | boolean>;
interface TikTokEventsPlugin {
  start(options: { tracking: boolean; debug?: boolean }): Promise<{ started: boolean; reason?: string }>;
  setEnabled(options: { enabled: boolean }): Promise<void>;
  track(options: { event: string; properties?: Props }): Promise<void>;
  identify(options: { externalId: string }): Promise<void>;
  logout(): Promise<void>;
}

let plugin: TikTokEventsPlugin | null = null;
let started = false;
let startPromise: Promise<boolean> | null = null;
let pendingIdentity: string | null = null;
const isIos = Capacitor.getPlatform() === 'ios';

const getPlugin = (): TikTokEventsPlugin | null => {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('TikTokEvents')) return null;
  if (!plugin) { try { plugin = registerPlugin<TikTokEventsPlugin>('TikTokEvents'); } catch { return null; } }
  return plugin;
};

/** Internal analytics event → TikTok standard event. Anything not listed is not sent. The generic `purchase`
 * event is left out on purpose: it is fired together with premium_subscribed, which already carries the value. */
export const TIKTOK_EVENT_MAP: Record<string, string> = {
  sign_up: 'Registration',
  login: 'Login',
  premium_trial_started: 'StartTrial',
  premium_subscribed: 'Subscribe',
  premium_paywall_clicked: 'AddPaymentInfo',
  books_checkout_started: 'Checkout',
  books_purchase_confirmed: 'Purchase',
  book_added_to_cart: 'AddToCart',
  book_viewed: 'ViewContent',
  name_searched: 'Search',
};
const MONETARY = new Set(['premium_trial_started', 'premium_subscribed', 'books_checkout_started', 'books_purchase_confirmed', 'book_added_to_cart']);

/** Flat, non-personal properties only: value/currency for revenue events, ids/types for content events. */
export function tiktokProperties(eventName: string, params?: Record<string, unknown>): Props {
  const out: Props = {};
  if (!params) return out;
  const value = Number(params.price ?? params.value ?? params.amount);
  if (MONETARY.has(eventName) && Number.isFinite(value) && value > 0) {
    out.value = value;
    out.currency = typeof params.currency === 'string' && /^[A-Z]{3}$/.test(params.currency) ? params.currency : 'USD';
  }
  const id = params.book_id ?? params.product_id ?? params.plan;
  if (typeof id === 'string' || typeof id === 'number') out.content_id = String(id).slice(0, 100);
  if (eventName.startsWith('book')) out.content_type = 'product';
  else if (eventName.startsWith('premium')) out.content_type = 'subscription';
  return out;
}

async function ensureStarted(): Promise<boolean> {
  if (started) return true;
  if (!isAttributionAllowed()) return false;
  const p = getPlugin();
  if (!p) return false;
  if (!startPromise) {
    startPromise = (async () => {
      let tracking = false;
      if (isIos) {
        try {
          const { AppTrackingTransparency } = await import('capacitor-plugin-app-tracking-transparency');
          tracking = (await AppTrackingTransparency.getStatus()).status === 'authorized';
        } catch { /* ATT plugin unavailable: limited attribution */ }
      }
      try {
        const r = await p.start({ tracking });
        started = r.started;
      } catch { started = false; }
      if (started && pendingIdentity) { try { await p.identify({ externalId: pendingIdentity }); } catch { /* silent */ } }
      startPromise = null;
      return started;
    })();
  }
  return startPromise;
}

/** Called from analytics.logEvent for every event; silently ignores unmapped events and missing consent. */
export async function logTikTokEvent(eventName: string, params?: Record<string, unknown>): Promise<void> {
  const event = TIKTOK_EVENT_MAP[eventName];
  if (!event || !isAttributionAllowed()) return;
  if (!(await ensureStarted())) return;
  try { await getPlugin()?.track({ event, properties: tiktokProperties(eventName, params) }); } catch { /* silent */ }
}

/** Applies the attribution choice (called after the Meta/ATT step in privacyConsent.applyPrivacyConsent). */
export async function applyTikTokConsent(allowed: boolean): Promise<void> {
  const p = getPlugin();
  if (!p) return;
  if (allowed) { await ensureStarted(); return; }
  if (started) {
    try { await p.logout(); await p.setEnabled({ enabled: false }); } catch { /* silent */ }
    started = false;
  }
}

/** Signed-in user id (pseudonymous Anacan account id, no email/phone) for TikTok's cross-device matching. */
export async function setTikTokIdentity(userId: string | null): Promise<void> {
  const p = getPlugin();
  if (!p) return;
  if (!userId) {
    pendingIdentity = null;
    if (started) { try { await p.logout(); } catch { /* silent */ } }
    return;
  }
  if (pendingIdentity === userId && started) return;
  pendingIdentity = userId;
  if (!isAttributionAllowed() || !(await ensureStarted())) return;
  try { await p.identify({ externalId: userId }); } catch { /* silent */ }
}

/** Test hook. */
export function __resetTikTokForTests() { plugin = null; started = false; startPromise = null; pendingIdentity = null; }
