// Per-context setup: fake GoTrue session, seeded localStorage (session, zustand user store, theme, language),
// frozen clock, seeded Math.random and animation/caret/scrollbar neutralisation.
import { bakuDate } from './fixtures.mjs';

// resolveAuthStorage('https://api.anacan.az') => `sb-${hostname.split('.')[0]}-auth-token`
// (src/integrations/supabase/auth-storage-key.ts; non-source-first builds, no cutover flag).
export const AUTH_STORAGE_KEY = 'sb-api-auth-token';
export const FROZEN_TIME = '2026-11-20T09:00:00+04:00';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function buildSession(persona, nowMs) {
  if (!persona.signedIn) return { session: null, user: null };
  const u = persona.user;
  const iat = Math.floor(nowMs / 1000) - 600;
  const exp = iat + 400 * 24 * 3600; // far beyond the frozen clock: never refreshed during a run
  const user = {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, phone: '',
    email_confirmed_at: u.created_at, confirmed_at: u.created_at, last_sign_in_at: new Date(nowMs - 600_000).toISOString(),
    app_metadata: { provider: u.provider || 'email', providers: [u.provider || 'email'] },
    user_metadata: { name: u.name, ...(u.user_metadata || {}) },
    identities: [], created_at: u.created_at, updated_at: u.created_at, is_anonymous: false,
  };
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, iat, exp,
    session_id: '11111111-2222-4333-8444-555555555555', is_anonymous: false,
  })}.cmVmZXJlbmNlLXNob3RzLWZpeHR1cmU`;
  const session = {
    access_token: accessToken, token_type: 'bearer', expires_in: exp - iat, expires_at: exp,
    refresh_token: 'refshots-fixture-refresh', user,
  };
  return { session, user };
}

/** zustand persist payload for 'anacan-user-store' (src/store/userStore.ts partialize). */
export function buildUserStore(persona, lang) {
  const base = {
    isAuthenticated: false, isOnboarded: false, hasSeenIntro: false, hasCompletedFunnel: true,
    userId: null, email: null, name: null, role: 'woman', lifeStage: null, partnerCode: null, linkedPartnerId: null,
    lastPeriodDate: null, cycleLength: 28, periodLength: 5, dueDate: null, babyBirthDate: null, babyName: null,
    babyGender: null, babyCount: 1, multiplesType: null, deliveryType: null, language: lang, hasSelectedLanguage: false,
    countryCode: 'AZ',
  };
  if (persona.signedIn) {
    Object.assign(base, {
      isAuthenticated: true, isOnboarded: true, hasSeenIntro: true, hasSelectedLanguage: true,
      userId: persona.user.id, email: persona.user.email, name: persona.user.name,
    });
  }
  Object.assign(base, persona.store || {}, { language: lang });
  return { state: base, version: 0 };
}

export function buildLocalStorage(persona, { lang, theme, session, nowMs }) {
  const ls = {
    'anacan-user-store': JSON.stringify(buildUserStore(persona, lang)),
    theme,
    language: lang,
  };
  if (session) ls[AUTH_STORAGE_KEY] = JSON.stringify(session);
  if (persona.signedIn && persona.privacyDecided !== false) {
    ls.anacan_privacy_consent_v1 = JSON.stringify({ analytics: false, ads: false, attribution: false, decidedAt: new Date(nowMs - 86400_000 * 30).toISOString() });
  }
  if (persona.signedIn && persona.seenDefaults !== false) {
    // One-time prompts/tours an established user has already dismissed (keys: src/lib/migration-export.ts 'seen').
    const at = String(nowMs - 86400_000 * 7);
    Object.assign(ls, {
      anacan_partner_tour_v2: at,
      [`anacan_tour_v1_${persona.user.id}`]: 'done',
      'anacan.lockOffer.seenAt': at,
      'anacan.prompt.lastShownDay': bakuDate(nowMs),
      anacan_ai_warn_dismissed: '1',
      anacan_rating_done: '1',
      'anacan.review.firstOpenAt': at,
    });
  }
  for (const [k, v] of Object.entries(persona.localStorage || {})) {
    ls[k.replaceAll('{{user_id}}', persona.user?.id ?? '')] = typeof v === 'string' ? v.replaceAll('{{date}}', bakuDate(nowMs)) : JSON.stringify(v);
  }
  return ls;
}

const GRANTED = { receive: 'granted' };
export const NATIVE_STUBS = {
  FirebaseMessaging: { checkPermissions: GRANTED, requestPermissions: GRANTED, getToken: { token: 'refshots-fcm-token' }, deleteToken: {},
    removeAllDeliveredNotifications: {} },
  FirebaseAnalytics: { logEvent: {}, setConsent: {}, setCurrentScreen: {}, setEnabled: {}, setUserId: {}, setUserProperty: {} },
  PushNotifications: { checkPermissions: GRANTED, requestPermissions: GRANTED, register: {} },
  LocalNotifications: { checkPermissions: { display: 'granted' }, requestPermissions: { display: 'granted' }, schedule: { notifications: [] },
    getPending: { notifications: [] }, cancel: {}, areEnabled: { value: true } },
};

/** Runs in the page before any app script, on every navigation of the context. */
function initScript({ storage, seed, platform, nativeStubs }) {
  // Seed storage once per tab; reloads triggered by the app (language switch) keep in-app writes.
  try {
    if (!sessionStorage.getItem('__refshots_seeded')) {
      localStorage.clear();
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      sessionStorage.setItem('__refshots_seeded', '1');
    }
  } catch { /* storage blocked */ }
  // Present the page to @capacitor/core as the native app (Capacitor.isNativePlatform() === true, getPlatform()
  // === 'ios' | 'android'). Plugin calls then fall back to each plugin's web implementation, or reject with
  // "not implemented" for native-only plugins (AdMob, RevenueCat, push), which the app already tolerates.
  if (platform && platform !== 'web') {
    window.CapacitorCustomPlatform = { name: platform, plugins: {} };
    // A few native-only plugin methods get fixed answers through Capacitor's own plugin-header path
    // (cap.PluginHeaders + cap.nativePromise): notification permission granted, no pending reminders.
    const headers = Object.entries(nativeStubs).map(([name, methods]) => ({ name, methods: [...Object.keys(methods).map((m) => ({ name: m, rtype: 'promise' })),
      { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'removeAllListeners', rtype: 'promise' }] }));
    let callbackId = 0;
    window.Capacitor = { PluginHeaders: headers,
      nativePromise: (plugin, method) => Promise.resolve(JSON.parse(JSON.stringify(nativeStubs[plugin]?.[method] ?? {}))),
      nativeCallback: () => String(++callbackId) };
  }
  // Deterministic Math.random (mulberry32).
  let s = seed >>> 0;
  Math.random = function random() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Neutralise motion: CSS animations/transitions jump to their end state, caret and scrollbars hidden.
  const css = `*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;animation-iteration-count:1!important;
    transition-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important;overflow-anchor:none!important}
    *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
    *{scrollbar-width:none!important}`;
  const inject = () => {
    if (document.getElementById('__refshots_css')) return true;
    const parent = document.head || document.documentElement;
    if (!parent) return false;
    const style = document.createElement('style');
    style.id = '__refshots_css'; style.textContent = css;
    parent.appendChild(style);
    return true;
  };
  if (!inject()) new MutationObserver((_, obs) => { if (inject()) obs.disconnect(); }).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', inject, { once: true });
  // Track in-flight fetches so helpers can wait for the app to settle.
  window.__refshots = { inflight: 0, lastChange: performance.now() };
  const origFetch = window.fetch;
  window.fetch = function patchedFetch(...args) {
    const st = window.__refshots; st.inflight++; st.lastChange = performance.now();
    return origFetch.apply(this, args).finally(() => { st.inflight--; st.lastChange = performance.now(); });
  };
}

export async function setupContext(context, { persona, lang, theme, nowMs, session, platform }) {
  await context.clock.setFixedTime(new Date(nowMs));
  const storage = buildLocalStorage(persona, { lang, theme, session, nowMs });
  await context.addInitScript(initScript, { storage, seed: 20261120, platform, nativeStubs: NATIVE_STUBS });
}
