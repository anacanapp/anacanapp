// Ported from: src/lib/facebook-events.ts
//
// Meta App Events. Natively the app talks to the Meta SDK through a plugin (Android: local `FbEvents`, iOS:
// `capacitor-facebook-events`); [FacebookEventsPlugin] is that surface and is null until the native step adds it
// (React's "plugin not available" branch: nothing is sent). Only the marketing/conversion events of
// [kFacebookEventMap] reach Meta, and only with attribution consent; health records never do.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tracking_transparency.dart';

abstract interface class FacebookEventsPlugin {
  Future<void> logEvent({required String event, required Map<String, Object> params});

  /// iOS (after the ATT answer).
  Future<void> setAdvertiserTrackingEnabled(bool enabled);

  /// Android (older native builds may not have it).
  Future<void> setConsent(bool enabled);
}

/// Internal event → Meta standard event.
const Map<String, String> kFacebookEventMap = {
  'sign_up': 'fb_mobile_complete_registration',
  'login': 'fb_mobile_login',
  'premium_subscribed': 'Subscribe',
  'premium_trial_started': 'StartTrial',
  'purchase': 'fb_mobile_purchase',
  'premium_paywall_shown': 'fb_mobile_initiated_checkout',
  'premium_paywall_clicked': 'fb_mobile_add_payment_info',
  'premium_cancelled': 'CancelSubscription',
  'tool_opened': 'fb_mobile_content_view',
  'tool_used': 'fb_mobile_activate_app',
  'ai_chat_started': 'StartChat',
  'ai_chat_message': 'SendChatMessage',
  'blog_read': 'fb_mobile_content_view',
  'community_post_created': 'fb_mobile_achievement_unlocked',
  'partner_linked': 'fb_mobile_complete_registration',
  'baby_photo_generated': 'GenerateContent',
  'fairy_tale_generated': 'GenerateContent',
  'appointment_created': 'fb_mobile_schedule',
  'shopping_item_added': 'fb_mobile_add_to_cart',
  'book_viewed': 'fb_mobile_content_view',
  'book_added_to_cart': 'fb_mobile_add_to_cart',
  'books_checkout_started': 'fb_mobile_initiated_checkout',
  'books_purchase_confirmed': 'fb_mobile_purchase',
};

const List<String> _monetaryEvents = ['premium_subscribed', 'purchase', 'premium_trial_started', 'books_purchase_confirmed', 'books_checkout_started'];

/// `cleanParams`: only string/number/bool; nulls dropped; objects as JSON (≤ 200 chars).
Map<String, Object> facebookCleanParams(Map<String, Object?>? params) {
  final out = <String, Object>{};
  if (params == null) return out;
  for (final entry in params.entries) {
    final v = entry.value;
    if (v == null) continue;
    if (v is Map || v is List) {
      try {
        final text = jsonEncode(v);
        out[entry.key] = text.length > 200 ? text.substring(0, 200) : text;
      } catch (_) {}
    } else {
      out[entry.key] = v;
    }
  }
  return out;
}

bool _truthy(Object? v) => v != null && v != false && v != 0 && v != '' && !(v is double && v.isNaN);

class FacebookEvents {
  FacebookEvents({
    required this.plugin,
    required this.attributionAllowed,
    required this.platform,
    this.trackingTransparency = const UnavailableTrackingTransparency(),
  });

  /// Null = not a native build with the plugin.
  final FacebookEventsPlugin? plugin;
  final bool Function() attributionAllowed;

  /// `ios` | `android` | `web`.
  final String platform;
  final TrackingTransparency trackingTransparency;
  bool _activationLogged = false;

  bool get _native => platform == 'ios' || platform == 'android';

  /// `setFacebookAdvertiserTracking(enabled)`.
  Future<void> setAdvertiserTracking(bool enabled) async {
    final p = plugin;
    if (p == null) return;
    try {
      await p.setAdvertiserTrackingEnabled(enabled);
    } catch (_) {}
  }

  /// `logFacebookEvent(eventName, params)`: silent; attribution consent required.
  Future<void> logEvent(String eventName, [Map<String, Object?>? params]) async {
    if (!attributionAllowed()) return;
    if (eventName != 'fb_mobile_activate_app' && !kFacebookEventMap.containsKey(eventName)) return;
    final p = plugin;
    if (p == null) return;
    try {
      final fbEvent = kFacebookEventMap[eventName] ?? eventName;
      final cleaned = facebookCleanParams(params);
      final monetary = params?['price'] ?? params?['value'];
      if (_monetaryEvents.contains(eventName) && _truthy(monetary) && !_truthy(cleaned['_valueToSum'])) {
        cleaned['_valueToSum'] = monetary is num ? monetary : (num.tryParse('$monetary') ?? double.nan);
        final currency = params?['currency'];
        cleaned['fb_currency'] = _truthy(currency) ? currency! : 'USD';
      }
      await p.logEvent(event: fbEvent, params: cleaned);
    } catch (_) {}
  }

  /// `applyFacebookConsent(allowed, fromUser)`: ATT on iOS only after the in-app opt-in, Android consent switch,
  /// and the once-per-launch activation event (auto-logging is disabled natively).
  Future<void> applyConsent(bool allowed, {bool fromUser = false}) async {
    if (!_native) return;
    var tracking = false;
    final ios = platform == 'ios';
    if (allowed && ios) {
      try {
        var status = await trackingTransparency.getStatus();
        if (status == 'notDetermined' && fromUser) status = await trackingTransparency.requestPermission();
        tracking = status == 'authorized';
      } catch (_) {}
    }
    if (ios) await setAdvertiserTracking(allowed && tracking);
    if (platform == 'android') {
      try {
        await plugin?.setConsent(allowed);
      } catch (_) {}
    }
    if (allowed && !_activationLogged) {
      _activationLogged = true;
      await logEvent('fb_mobile_activate_app');
    }
  }
}

/// The Meta plugin (null until the native step: `facebook_app_events` or a port of the FbEvents plugin).
final facebookEventsPluginProvider = Provider<FacebookEventsPlugin?>((ref) => null);
