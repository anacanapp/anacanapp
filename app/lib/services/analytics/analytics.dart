// Ported from: src/lib/analytics.ts, src/lib/mixpanel.ts (disabled stub: no calls are made),
//              the applyPrivacyConsent half of src/lib/privacyConsent.ts (SDK side of a decision)
//
// `logEvent` tracks to Firebase Analytics, the internal `analytics_events` table and (with attribution consent)
// Meta / TikTok. Both channels are opt-in: analytics feeds Firebase and the internal table, attribution feeds
// Meta/TikTok. Firebase is a native SDK behind [FirebaseAnalyticsPlatform]; the default is React's "not
// configured" branch (nothing sent), the internal table and the consent gates work as in React. Mixpanel is a
// no-op in React (mixpanel.ts header) and is not called here.
import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/data/privacy_consent.dart';
import 'customerio.dart';
import 'facebook_events.dart';
import 'tiktok_events.dart';

/// `EVENT_CATEGORIES`.
const Map<String, String> kAnalyticsEventCategories = {
  'login': 'auth', 'sign_up': 'auth',
  'tool_opened': 'tools', 'tool_used': 'tools',
  'blog_read': 'content', 'blog_liked': 'content', 'blog_saved': 'content',
  'community_post_created': 'community', 'community_post_liked': 'community',
  'ai_chat_started': 'ai', 'ai_chat_message': 'ai',
  'premium_subscribed': 'premium', 'premium_cancelled': 'premium',
  'premium_trial_started': 'premium', 'purchase': 'premium',
  'premium_paywall_shown': 'premium', 'premium_paywall_clicked': 'premium',
  'water_logged': 'health', 'symptom_logged': 'health', 'weight_logged': 'health',
  'kick_counted': 'health', 'contraction_timed': 'health', 'meal_logged': 'health',
  'exercise_completed': 'health', 'mood_logged': 'health', 'baby_growth_logged': 'health',
  'baby_photo_generated': 'tools', 'cry_analyzed': 'tools', 'poop_analyzed': 'tools',
  'fairy_tale_generated': 'tools', 'breathing_exercise_done': 'tools',
  'white_noise_played': 'tools', 'horoscope_viewed': 'tools',
  'recipe_viewed': 'content', 'name_searched': 'tools',
  'place_viewed': 'content', 'product_viewed': 'content',
  'books_store_viewed': 'commerce', 'book_viewed': 'commerce', 'book_added_to_cart': 'commerce', 'book_removed_from_cart': 'commerce',
  'books_collection_added': 'commerce', 'books_checkout_started': 'commerce', 'books_checkout_unavailable': 'commerce',
  'books_purchase_confirmed': 'commerce', 'book_downloaded': 'commerce', 'books_reco_clicked': 'commerce',
  'qc_wallet_view': 'commerce', 'qc_redeem_toggle': 'commerce', 'qc_redeem_commit': 'commerce', 'qc_premium_redeem': 'commerce',
  'recap_opened': 'recap', 'recap_completed': 'recap', 'recap_exported': 'recap', 'recap_shared': 'recap',
  'shopping_item_added': 'tools', 'appointment_created': 'tools',
  'partner_linked': 'social',
  'screen_view': 'navigation', 'page_view': 'navigation',
  'notification_received': 'notification', 'notification_clicked': 'notification',
};

/// `AnalyticsParams` values are string | number | boolean | undefined; undefined (null here) never leaves the
/// app (JSON.stringify / the Firebase SDK drop it).
Map<String, Object> cleanAnalyticsParams(Map<String, Object?>? params) =>
    {for (final e in (params ?? const <String, Object?>{}).entries) if (e.value != null) e.key: e.value!};

/// `@capacitor-firebase/analytics` (native). Default: [NoFirebaseAnalytics].
abstract interface class FirebaseAnalyticsPlatform {
  Future<void> logEvent(String name, Map<String, Object> params);
  Future<void> setUserId(String? userId);
  Future<void> setUserProperty(String key, String value);

  /// `setCurrentScreen` (GA4 "Screens" report).
  Future<void> setCurrentScreen(String screenName, String screenClass);

  /// Consent Mode v2 (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`).
  Future<void> setConsent({required bool analyticsStorage, required bool adStorage, required bool adUserData, required bool adPersonalization});
  Future<void> setEnabled(bool enabled);
}

/// Firebase not configured / SDK unavailable: nothing is collected.
class NoFirebaseAnalytics implements FirebaseAnalyticsPlatform {
  const NoFirebaseAnalytics();
  @override
  Future<void> logEvent(String name, Map<String, Object> params) async {}
  @override
  Future<void> setUserId(String? userId) async {}
  @override
  Future<void> setUserProperty(String key, String value) async {}
  @override
  Future<void> setCurrentScreen(String screenName, String screenClass) async {}
  @override
  Future<void> setConsent({required bool analyticsStorage, required bool adStorage, required bool adUserData, required bool adPersonalization}) async {}
  @override
  Future<void> setEnabled(bool enabled) async {}
}

/// `trackInternal(eventName, params)`: one `analytics_events` row (fire and forget).
abstract interface class InternalAnalyticsTracker {
  Future<void> track(String eventName, String category, Map<String, Object> params);
}

class NoInternalAnalytics implements InternalAnalyticsTracker {
  const NoInternalAnalytics();
  @override
  Future<void> track(String eventName, String category, Map<String, Object> params) async {}
}

/// The Supabase implementation: signed-in user, `profiles.life_stage / is_premium` enrichment, insert.
class SupabaseInternalAnalytics implements InternalAnalyticsTracker {
  SupabaseInternalAnalytics({required this.client, required this.platform});
  final SupabaseClient Function() client;

  /// `Capacitor.isNativePlatform() ? getPlatform() : 'web'`.
  final String platform;

  @override
  Future<void> track(String eventName, String category, Map<String, Object> params) async {
    try {
      final supabase = client();
      final user = supabase.auth.currentUser;
      if (user == null) return;
      Map<String, dynamic>? profile;
      try {
        profile = await supabase.from('profiles').select('life_stage, is_premium').eq('user_id', user.id).single();
      } catch (_) {
        profile = null;
      }
      final lifeStage = profile?['life_stage'];
      await supabase.from('analytics_events').insert({
        'user_id': user.id,
        'event_name': eventName,
        'event_category': category,
        'event_data': params,
        'platform': platform,
        'life_stage': lifeStage is String && lifeStage.isNotEmpty ? lifeStage : null,
        'is_premium': profile?['is_premium'] == true,
      });
    } catch (_) {
      // Silent fail - analytics should never break the app.
    }
  }
}

/// `analytics` (src/lib/analytics.ts).
class AnalyticsService {
  AnalyticsService({
    required this.consent,
    this.firebase = const NoFirebaseAnalytics(),
    this.internal = const NoInternalAnalytics(),
    this.facebook,
    this.tiktok,
    this.customerIo,
    int Function()? now,
  }) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  /// `getPrivacyConsent()` at call time.
  final PrivacyConsent Function() consent;
  final FirebaseAnalyticsPlatform firebase;
  final InternalAnalyticsTracker internal;
  final FacebookEvents? facebook;
  final TikTokEvents? tiktok;
  final CustomerIoTracking? customerIo;
  final int Function() _now;

  /// `logEvent(eventName, params)`.
  Future<void> logEvent(String eventName, [Map<String, Object?>? params]) async {
    final c = consent();
    if (c.attribution) {
      unawaited(facebook?.logEvent(eventName, params).catchError((Object _) {}));
      unawaited(tiktok?.logEvent(eventName, params).catchError((Object _) {}));
    }
    if (!c.analytics) return;
    final clean = cleanAnalyticsParams(params);
    // Internal usage reporting is independent of optional third-party SDK errors.
    unawaited(internal.track(eventName, kAnalyticsEventCategories[eventName] ?? 'general', clean).catchError((Object _) {}));
    try {
      await firebase.logEvent(eventName, clean);
    } catch (_) {}
  }

  /// `setUserId(userId)`.
  Future<void> setUserId(String? userId) async {
    if (userId != null && !consent().analytics) return;
    try {
      await firebase.setUserId(userId ?? '');
    } catch (_) {}
  }

  /// `setUserProperties(properties)`.
  Future<void> setUserProperties(Map<String, String> properties) async {
    if (!consent().analytics) return;
    try {
      for (final e in properties.entries) {
        await firebase.setUserProperty(e.key, e.value);
      }
    } catch (_) {}
  }

  /// `logScreenView(screenName, screenClass)`: Customer.io screen, GA4 current screen, `screen_view` event.
  Future<void> logScreenView(String screenName, [String? screenClass]) async {
    if (!consent().analytics) return;
    unawaited(customerIo?.screen(screenName, screenClass).catchError((Object _) {}));
    try {
      await firebase.setCurrentScreen(screenName, screenClass ?? screenName);
    } catch (_) {}
    await logEvent('screen_view', {'screen_name': screenName, 'screen_class': screenClass ?? screenName});
  }

  Future<void> logLogin(String method) => logEvent('login', {'method': method});
  Future<void> logSignUp(String method) => logEvent('sign_up', {'method': method});
  Future<void> logToolOpened(String toolId, [String? toolName]) => logEvent('tool_opened', {'tool_id': toolId, 'tool_name': toolName});

  /// One 'session' per tool visit with the time spent (seconds, capped at 1 h).
  Future<void> logToolSession(String toolId, num seconds) =>
      logEvent('tool_used', {'tool_id': toolId, 'action': 'session', 'duration_s': seconds.round().clamp(0, 3600)});
  Future<void> logToolUsed(String toolId, String action, [String? itemId]) =>
      logEvent('tool_used', itemId != null && itemId.isNotEmpty ? {'tool_id': toolId, 'action': action, 'item_id': itemId} : {'tool_id': toolId, 'action': action});
  Future<void> logBlogRead(String postId, String category) => logEvent('blog_read', {'post_id': postId, 'category': category});
  Future<void> logBlogLiked(String postId) => logEvent('blog_liked', {'post_id': postId});
  Future<void> logBlogSaved(String postId) => logEvent('blog_saved', {'post_id': postId});
  Future<void> logPostCreated([String? groupId]) => logEvent('community_post_created', {'group_id': groupId});
  Future<void> logPostLiked(String postId) => logEvent('community_post_liked', {'post_id': postId});
  Future<void> logAIChatStarted(String chatType) => logEvent('ai_chat_started', {'chat_type': chatType});
  Future<void> logAIChatMessage(String chatType) => logEvent('ai_chat_message', {'chat_type': chatType});
  Future<void> logWaterIntake(num glasses) => logEvent('water_logged', {'glasses': glasses});
  Future<void> logSymptom(List<String> symptoms) => logEvent('symptom_logged', {'symptom_count': symptoms.length});

  /// Values stay on the device/server, never in analytics.
  Future<void> logWeight(num _) => logEvent('weight_logged');
  Future<void> logKickCount(num _) => logEvent('kick_counted');
  Future<void> logContraction(num _) => logEvent('contraction_timed');
  Future<void> logMeal(String mealType, num _) => logEvent('meal_logged', {'meal_type': mealType});
  Future<void> logExercise(String exerciseId, num durationMin) => logEvent('exercise_completed', {'exercise_id': exerciseId, 'duration_min': durationMin});
  Future<void> logMood(num _) => logEvent('mood_logged');
  Future<void> logBabyGrowth() => logEvent('baby_growth_logged');
  Future<void> logBabyPhotoGenerated(String style) => logEvent('baby_photo_generated', {'style': style});
  Future<void> logShoppingItemAdded() => logEvent('shopping_item_added');
  Future<void> logAppointmentCreated(String type) => logEvent('appointment_created', {'appointment_type': type});
  Future<void> logCryAnalyzed() => logEvent('cry_analyzed');
  Future<void> logPoopAnalyzed() => logEvent('poop_analyzed');
  Future<void> logFairyTaleGenerated() => logEvent('fairy_tale_generated');
  Future<void> logBreathingExercise(String exerciseId) => logEvent('breathing_exercise_done', {'exercise_id': exerciseId});
  Future<void> logWhiteNoisePlayed(String soundId) => logEvent('white_noise_played', {'sound_id': soundId});
  Future<void> logHoroscopeViewed() => logEvent('horoscope_viewed');
  Future<void> logRecipeViewed(String recipeId) => logEvent('recipe_viewed', {'recipe_id': recipeId});
  Future<void> logNameSearched(String _) => logEvent('name_searched');
  Future<void> logPlaceViewed(String placeId) => logEvent('place_viewed', {'place_id': placeId});
  Future<void> logProductViewed(String productId) => logEvent('product_viewed', {'product_id': productId});

  /// With a price: also GA4's standard `purchase` event (value-based optimisation, revenue report).
  void logPremiumSubscribed(String plan, [num? price, String? currency]) {
    unawaited(logEvent('premium_subscribed', {'plan': plan, 'price': price, 'currency': currency}));
    if (price != null && price > 0) {
      unawaited(logEvent('purchase', {
        'value': price,
        'currency': currency == null || currency.isEmpty ? 'USD' : currency,
        'item_id': plan,
        'transaction_id': 'sub_${_now()}',
      }));
    }
  }

  Future<void> logTrialStarted(String plan, [num? price, String? currency]) =>
      logEvent('premium_trial_started', {'plan': plan, 'price': price, 'currency': currency});
  Future<void> logPremiumCancelled() => logEvent('premium_cancelled');
  Future<void> logPaywallShown(String source) => logEvent('premium_paywall_shown', {'source': source});
  Future<void> logPaywallClicked(String source, String plan) => logEvent('premium_paywall_clicked', {'source': source, 'plan': plan});
  Future<void> logPartnerLinked() => logEvent('partner_linked');

  /// `applyPrivacyConsent(consent, fromUser)` (native SDK side): Firebase collection + Consent Mode v2, then
  /// Meta (ATT), then TikTok (after the ATT answer is known). Each step is optional and silent.
  Future<void> applyPrivacyConsent(PrivacyConsent decision, {bool fromUser = false}) async {
    try {
      await Future.wait([
        firebase.setConsent(
          analyticsStorage: decision.analytics,
          adStorage: decision.ads,
          adUserData: decision.ads,
          adPersonalization: decision.ads,
        ),
      ]);
      await firebase.setEnabled(decision.analytics);
    } catch (_) {}
    try {
      await facebook?.applyConsent(decision.attribution, fromUser: fromUser);
    } catch (_) {}
    try {
      await tiktok?.applyConsent(decision.attribution);
    } catch (_) {}
  }
}
