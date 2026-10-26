/**
 * Facebook / Meta App Events wrapper
 *
 * Native (iOS/Android) üçün Meta SDK-na real `AppEvents` göndərir
 * (Meta Ads Manager-də konversiya optimizasiyası üçün istifadə olunur).
 * Web-də heç nə etmir — Meta web pikseli ayrıca quraşdırılmalıdır.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// IMPORTANT: Capacitor plugin proxies can be treated as thenables if they cross
// async/promise boundaries. Keep plugin lookup synchronous and only await real
// native method calls like `logEvent()` or `setAdvertiserTrackingEnabled()`.
// NOTE: We lazy-require the plugin so that any module-load error
// (missing native class, SDK init issue) cannot crash the JS bundle.
let fbPlugin: any | null = null;
let pluginLookupAttempted = false;
let initialized = false;
const isAndroid = Capacitor.getPlatform() === 'android';
const isIos = Capacitor.getPlatform() === 'ios';

const getPlugin = (): any | null => {
  if (!Capacitor.isNativePlatform()) return null;
  if (fbPlugin) return fbPlugin;
  if (pluginLookupAttempted) return null;
  pluginLookupAttempted = true;

  // Android: lokal FbEvents plugini (köhnə "capacitor-facebook-events"
  // Android-də crash-lərə görə söndürülüb → eventlər tam itirdi; bu, fix-dir)
  if (isAndroid) {
    try {
      fbPlugin = registerPlugin<any>('FbEvents');
      return fbPlugin;
    } catch (e) {
      console.warn('[fb-events] android plugin not available:', e);
      return null;
    }
  }

  // iOS: mövcud capacitor-facebook-events plugini (işləyir)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('capacitor-facebook-events');
    fbPlugin = mod?.FacebookEvents ?? null;
    return fbPlugin;
  } catch (e) {
    console.warn('[fb-events] plugin not available:', e);
    return null;
  }
};

/**
 * iOS ATT (App Tracking Transparency) icazəsi verildikdən sonra çağırılır.
 * Bu olmadan Meta reklam atribusiyası limit olur.
 */
export const setFacebookAdvertiserTracking = async (enabled: boolean) => {
  const p = getPlugin();
  if (!p) return;
  try {
    await p.setAdvertiserTrackingEnabled({ enabled });
  } catch (e) {
    console.warn('[fb-events] setAdvertiserTrackingEnabled failed', e);
  }
};

/**
 * Daxili event adlarını Facebook standart event adlarına çevirir.
 * Standart adlar Meta Ads Manager-də konversiya kampaniyaları üçün istifadə olunur.
 * Tanınmayan eventlər custom event kimi öz adı ilə göndərilir.
 */
const EVENT_MAP: Record<string, string> = {
  sign_up: 'fb_mobile_complete_registration',
  login: 'fb_mobile_login',
  premium_subscribed: 'Subscribe',
  premium_trial_started: 'StartTrial',
  purchase: 'fb_mobile_purchase',
  premium_paywall_shown: 'fb_mobile_initiated_checkout',
  premium_paywall_clicked: 'fb_mobile_add_payment_info',
  premium_cancelled: 'CancelSubscription',
  tool_opened: 'fb_mobile_content_view',
  tool_used: 'fb_mobile_activate_app',
  ai_chat_started: 'StartChat',
  ai_chat_message: 'SendChatMessage',
  blog_read: 'fb_mobile_content_view',
  community_post_created: 'fb_mobile_achievement_unlocked',
  partner_linked: 'fb_mobile_complete_registration',
  baby_photo_generated: 'GenerateContent',
  fairy_tale_generated: 'GenerateContent',
  appointment_created: 'fb_mobile_schedule',
  shopping_item_added: 'fb_mobile_add_to_cart',
};

/**
 * Sanitize params: Facebook params yalnız string/number/bool qəbul edir, undefined-ləri sil.
 */
const cleanParams = (params?: Record<string, any>) => {
  if (!params) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') {
      try { out[k] = JSON.stringify(v).slice(0, 200); } catch { /* skip */ }
    } else {
      out[k] = v;
    }
  }
  return out;
};

/**
 * Bütün analytics eventlərini Facebook-a da log edir (paralel olaraq).
 * Səssiz fail — analytics heç vaxt app-ı sındırmamalıdır.
 */
export const logFacebookEvent = async (eventName: string, params?: Record<string, any>) => {
  const p = getPlugin();
  if (!p) return;
  try {
    const fbEvent = EVENT_MAP[eventName] || eventName;
    const cleaned = cleanParams(params);

    // Purchase/Subscribe/StartTrial üçün _valueToSum və fb_currency vacibdir
    // (Meta value-based optimization yalnız bununla işləyir)
    const monetary = params?.price ?? params?.value;
    if (['premium_subscribed', 'purchase', 'premium_trial_started'].includes(eventName) &&
    monetary && !cleaned._valueToSum) {
      cleaned._valueToSum = Number(monetary);
      cleaned.fb_currency = params?.currency || 'USD';
    }

    await p.logEvent({ event: fbEvent, params: cleaned });
  } catch (e) {
    // sakitcə uğursuz ol
  }
};

/**
 * App start zamanı çağırılır — pluginin yüklənməsini "isti" tutur.
 */
export const initFacebookEvents = () => {
  if (initialized) return;
  initialized = true;
  if (!Capacitor.isNativePlatform()) return;
  // Defer plugin lookup + ATT prompt so it doesn't block app boot or race the
  // native bridge. Apple recommends asking AFTER the app is visible.
  setTimeout(async () => {
    try { getPlugin(); } catch { /* silent */ }

    // ATT yalnız iOS anlayışıdır — Android-də advertiser ID manifest ilə idarə olunur
    if (!isIos) return;
    try {
      const { AppTrackingTransparency } = await import('capacitor-plugin-app-tracking-transparency');
      const status = await AppTrackingTransparency.getStatus();
      let finalStatus = status.status;
      if (finalStatus === 'notDetermined') {
        const res = await AppTrackingTransparency.requestPermission();
        finalStatus = res.status;
      }
      const granted = finalStatus === 'authorized';
      await setFacebookAdvertiserTracking(granted);
      console.log('[ATT] status =', finalStatus, 'fb tracking =', granted);
    } catch (e) {
      console.warn('[ATT] request failed', e);
    }
  }, 2000);
};
