/**
 * Firebase Analytics + Internal Analytics integration for Anacan app
 * Dual-tracks to Firebase Analytics AND internal database
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { isAnalyticsAllowed, isAttributionAllowed } from './privacyConsent';

// Firebase Analytics for web
let firebaseAnalytics: any = null;
let webAnalyticsHandle: { analytics: any; logEvent: any; setUserId: any; setUserProperties: any } | null = null;
// Bir dəfə "konfiqurasiya yoxdur/init alınmadı" nəticəsi çıxsa, bunu keşləyirik —
// əvvəllər hər tək analytics çağırışında (hər ekran keçidi, hər hadisə) firebase/app
// və firebase/analytics YENİDƏN dinamik import olunur və konsola xəbərdarlıq yazılırdı.
let webAnalyticsAttempted = false;

// Initialize Firebase for web (lazy loaded, attempted only once per session)
const initWebAnalytics = async () => {
  if (webAnalyticsHandle) return webAnalyticsHandle;
  if (webAnalyticsAttempted) return null;
  webAnalyticsAttempted = true;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAnalytics, logEvent: firebaseLogEvent, setUserId: firebaseSetUserId, setUserProperties: firebaseSetUserProps } = await import('firebase/analytics');
    
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    };
    
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('[Firebase Analytics] Web app not configured — set VITE_FIREBASE_* in .env (see .env.example). Native Android/iOS tracking is unaffected.');
      return null;
    }
    
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firebaseAnalytics = getAnalytics(app);
    
    console.log('Firebase Analytics initialized for web');
    webAnalyticsHandle = { analytics: firebaseAnalytics, logEvent: firebaseLogEvent, setUserId: firebaseSetUserId, setUserProperties: firebaseSetUserProps };
    return webAnalyticsHandle;
  } catch (error) {
    console.warn('Firebase Analytics initialization failed:', error);
    return null;
  }
};

// Analytics events types
export type AnalyticsEvent = 
  | 'page_view'
  | 'screen_view'
  | 'login'
  | 'sign_up'
  | 'tool_opened'
  | 'tool_used'
  | 'blog_read'
  | 'blog_liked'
  | 'blog_saved'
  | 'community_post_created'
  | 'community_post_liked'
  | 'ai_chat_started'
  | 'ai_chat_message'
  | 'partner_linked'
  | 'premium_subscribed'
  | 'premium_trial_started'
  | 'purchase'
  | 'premium_cancelled'
  | 'premium_paywall_shown'
  | 'premium_paywall_clicked'
  | 'notification_received'
  | 'notification_clicked'
  | 'water_logged'
  | 'symptom_logged'
  | 'weight_logged'
  | 'kick_counted'
  | 'contraction_timed'
  | 'meal_logged'
  | 'exercise_completed'
  | 'baby_photo_generated'
  | 'shopping_item_added'
  | 'appointment_created'
  | 'mood_logged'
  | 'cry_analyzed'
  | 'poop_analyzed'
  | 'fairy_tale_generated'
  | 'breathing_exercise_done'
  | 'white_noise_played'
  | 'horoscope_viewed'
  | 'recipe_viewed'
  | 'name_searched'
  | 'baby_growth_logged'
  | 'place_viewed'
  | 'product_viewed'
  | 'books_store_viewed'
  | 'book_viewed'
  | 'book_added_to_cart'
  | 'book_removed_from_cart'
  | 'books_collection_added'
  | 'books_checkout_started'
  | 'books_checkout_unavailable'
  | 'books_purchase_confirmed'
  | 'book_downloaded'
  | 'books_reco_clicked'
  | 'qc_wallet_view'
  | 'qc_redeem_toggle'
  | 'qc_redeem_commit'
  | 'qc_premium_redeem'
  | 'recap_opened'
  | 'recap_completed'
  | 'recap_exported'
  | 'recap_shared'
  | 'custom_event';

export interface AnalyticsParams {
  [key: string]: string | number | boolean | undefined;
}

// Event category mapping
const EVENT_CATEGORIES: Record<string, string> = {
  login: 'auth', sign_up: 'auth',
  tool_opened: 'tools', tool_used: 'tools',
  blog_read: 'content', blog_liked: 'content', blog_saved: 'content',
  community_post_created: 'community', community_post_liked: 'community',
  ai_chat_started: 'ai', ai_chat_message: 'ai',
  premium_subscribed: 'premium', premium_cancelled: 'premium',
  premium_trial_started: 'premium', purchase: 'premium',
  premium_paywall_shown: 'premium', premium_paywall_clicked: 'premium',
  water_logged: 'health', symptom_logged: 'health', weight_logged: 'health',
  kick_counted: 'health', contraction_timed: 'health', meal_logged: 'health',
  exercise_completed: 'health', mood_logged: 'health', baby_growth_logged: 'health',
  baby_photo_generated: 'tools', cry_analyzed: 'tools', poop_analyzed: 'tools',
  fairy_tale_generated: 'tools', breathing_exercise_done: 'tools',
  white_noise_played: 'tools', horoscope_viewed: 'tools',
  recipe_viewed: 'content', name_searched: 'tools',
  place_viewed: 'content', product_viewed: 'content',
  books_store_viewed: 'commerce', book_viewed: 'commerce', book_added_to_cart: 'commerce', book_removed_from_cart: 'commerce', books_collection_added: 'commerce', books_checkout_started: 'commerce', books_checkout_unavailable: 'commerce', books_purchase_confirmed: 'commerce', book_downloaded: 'commerce', books_reco_clicked: 'commerce',
  qc_wallet_view: 'commerce', qc_redeem_toggle: 'commerce', qc_redeem_commit: 'commerce', qc_premium_redeem: 'commerce',
  recap_opened: 'recap', recap_completed: 'recap', recap_exported: 'recap', recap_shared: 'recap',
  shopping_item_added: 'tools', appointment_created: 'tools',
  partner_linked: 'social',
  screen_view: 'navigation', page_view: 'navigation',
  notification_received: 'notification', notification_clicked: 'notification',
};

// Internal DB tracking - fire and forget, non-blocking
const trackInternal = async (eventName: string, params?: AnalyticsParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile info for enrichment
    const { data: profile } = await supabase
      .from('profiles')
      .select('life_stage, is_premium')
      .eq('user_id', user.id)
      .single();

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_name: eventName,
      event_category: EVENT_CATEGORIES[eventName] || 'general',
      event_data: params || {},
      platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web',
      life_stage: profile?.life_stage || null,
      is_premium: profile?.is_premium || false,
    });
  } catch {
    // Silent fail - analytics should never break the app
  }
};

/**
 * Log an analytics event - triple tracks to Firebase + internal DB + Mixpanel
 */
export const logEvent = async (eventName: AnalyticsEvent, params?: AnalyticsParams): Promise<void> => {
  // Both channels are opt-in (Məxfilik → Razılıq): analytics feeds Firebase/internal stats,
  // attribution feeds Meta App Events. Without consent nothing is recorded.
  const analytics = isAnalyticsAllowed(), attribution = isAttributionAllowed();
  if (attribution) {
    import('@/lib/facebook-events').then(({ logFacebookEvent }) => {
      logFacebookEvent(eventName, params as Record<string, any>);
    }).catch(() => {});
  }
  if (!analytics) return;
  // Internal usage reporting is independent of optional third-party SDK errors.
  void trackInternal(eventName, params);
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.logEvent({
        name: eventName,
        params: params as Record<string, any> || {},
      });
    } else {
      const webAnalytics = await initWebAnalytics();
      if (webAnalytics) {
        webAnalytics.logEvent(webAnalytics.analytics, eventName, params);
      }
    }

    // Mixpanel tracking (non-blocking; currently a no-op)
    import('@/lib/mixpanel').then(({ trackMixpanelEvent }) => {
      trackMixpanelEvent(eventName, params as Record<string, any>);
    }).catch(() => {});

    if (import.meta.env.DEV) {
      console.log(`📊 Analytics: ${eventName}`, params);
    }
  } catch (error) {
    console.warn('Failed to log analytics event:', error);
  }
};

/**
 * Set user ID for analytics
 */
export const setUserId = async (userId: string | null): Promise<void> => {
  if (userId && !isAnalyticsAllowed()) return;
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.setUserId({ userId: userId || '' });
    } else {
      const webAnalytics = await initWebAnalytics();
      if (webAnalytics) {
        webAnalytics.setUserId(webAnalytics.analytics, userId);
      }
    }
  } catch (error) {
    console.warn('Failed to set analytics user ID:', error);
  }
};

/**
 * Set user properties
 */
export const setUserProperties = async (properties: Record<string, string>): Promise<void> => {
  if (!isAnalyticsAllowed()) return;
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      for (const [key, value] of Object.entries(properties)) {
        await FirebaseAnalytics.setUserProperty({ key, value });
      }
    } else {
      const webAnalytics = await initWebAnalytics();
      if (webAnalytics) {
        webAnalytics.setUserProperties(webAnalytics.analytics, properties);
      }
    }
  } catch (error) {
    console.warn('Failed to set analytics user properties:', error);
  }
};

/**
 * Log screen view
 * Native-də GA4-ün RƏSMİ screen reporting-i üçün setCurrentScreen çağırılır
 * (əvvəllər yalnız custom screen_view eventi gedirdi → GA4 "Screens" hesabatı boş qalırdı).
 * screen_view eventi Mixpanel/internal DB üçün saxlanılır.
 */
export const logScreenView = async (screenName: string, screenClass?: string): Promise<void> => {
  if (!isAnalyticsAllowed()) return;
  void import('./customerio').then(({ customerIo }) => customerIo.screen(screenName, screenClass)).catch(() => {});
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.setCurrentScreen({
        screenName,
        screenClassOverride: screenClass || screenName,
      });
    } catch (error) {
      console.warn('setCurrentScreen failed:', error);
    }
  }

  await logEvent('screen_view', {
    screen_name: screenName,
    screen_class: screenClass || screenName,
  });
};

// Convenience methods for common events
export const analytics = {
  logEvent,
  setUserId,
  setUserProperties,
  logScreenView,
  
  // Auth events
  logLogin: (method: string) => logEvent('login', { method }),
  logSignUp: (method: string) => logEvent('sign_up', { method }),
  
  // Tool events
  logToolOpened: (toolId: string, toolName?: string) => logEvent('tool_opened', { tool_id: toolId, tool_name: toolName }),
  logToolUsed: (toolId: string, action: string, itemId?: string) =>
    logEvent('tool_used', itemId ? { tool_id: toolId, action, item_id: itemId } : { tool_id: toolId, action }),
  
  // Blog events
  logBlogRead: (postId: string, category: string) => logEvent('blog_read', { post_id: postId, category }),
  logBlogLiked: (postId: string) => logEvent('blog_liked', { post_id: postId }),
  logBlogSaved: (postId: string) => logEvent('blog_saved', { post_id: postId }),
  
  // Community events
  logPostCreated: (groupId?: string) => logEvent('community_post_created', { group_id: groupId }),
  logPostLiked: (postId: string) => logEvent('community_post_liked', { post_id: postId }),
  
  // AI events
  logAIChatStarted: (chatType: string) => logEvent('ai_chat_started', { chat_type: chatType }),
  logAIChatMessage: (chatType: string) => logEvent('ai_chat_message', { chat_type: chatType }),
  
  // Health tracking events
  logWaterIntake: (glasses: number) => logEvent('water_logged', { glasses }),
  logSymptom: (symptoms: string[]) => logEvent('symptom_logged', { symptom_count: symptoms.length }),
  logWeight: (_weight: number) => logEvent('weight_logged'), // values stay on the device/server, never in analytics
  logKickCount: (_count: number) => logEvent('kick_counted'),
  logContraction: (_durationSec: number) => logEvent('contraction_timed'),
  logMeal: (mealType: string, _calories: number) => logEvent('meal_logged', { meal_type: mealType }),
  logExercise: (exerciseId: string, durationMin: number) => logEvent('exercise_completed', { exercise_id: exerciseId, duration_min: durationMin }),
  logMood: (_moodValue: number) => logEvent('mood_logged'),
  logBabyGrowth: () => logEvent('baby_growth_logged'),
  
  // Feature events
  logBabyPhotoGenerated: (style: string) => logEvent('baby_photo_generated', { style }),
  logShoppingItemAdded: () => logEvent('shopping_item_added'),
  logAppointmentCreated: (type: string) => logEvent('appointment_created', { appointment_type: type }),
  logCryAnalyzed: () => logEvent('cry_analyzed'),
  logPoopAnalyzed: () => logEvent('poop_analyzed'),
  logFairyTaleGenerated: () => logEvent('fairy_tale_generated'),
  logBreathingExercise: (exerciseId: string) => logEvent('breathing_exercise_done', { exercise_id: exerciseId }),
  logWhiteNoisePlayed: (soundId: string) => logEvent('white_noise_played', { sound_id: soundId }),
  logHoroscopeViewed: () => logEvent('horoscope_viewed'),
  logRecipeViewed: (recipeId: string) => logEvent('recipe_viewed', { recipe_id: recipeId }),
  logNameSearched: (_query: string) => logEvent('name_searched'),
  logPlaceViewed: (placeId: string) => logEvent('place_viewed', { place_id: placeId }),
  logProductViewed: (productId: string) => logEvent('product_viewed', { product_id: productId }),
  
  // Premium events
  // price/currency ötürülsə: (1) FB Subscribe _valueToSum alır,
  // (2) GA4 standart 'purchase' eventi də göndərilir (value-based optimization + gəlir hesabatı)
  logPremiumSubscribed: (plan: string, price?: number, currency?: string) => {
    void logEvent('premium_subscribed', { plan, price, currency });
    if (price && price > 0) {
      void logEvent('purchase', {
        value: price,
        currency: currency || 'USD',
        item_id: plan,
        transaction_id: `sub_${Date.now()}`
      });
    }
  },
  logTrialStarted: (plan: string, price?: number, currency?: string) =>
  logEvent('premium_trial_started', { plan, price, currency }),
  logPremiumCancelled: () => logEvent('premium_cancelled'),
  logPaywallShown: (source: string) => logEvent('premium_paywall_shown', { source }),
  logPaywallClicked: (source: string, plan: string) => logEvent('premium_paywall_clicked', { source, plan }),
  logPartnerLinked: () => logEvent('partner_linked'),
};

export default analytics;
