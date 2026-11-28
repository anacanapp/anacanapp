// Ported from: src/lib/tiktok-events.ts, packages/tiktok-events/index.d.ts (plugin surface)
//
// TikTok Business SDK (App Events), native only. Nothing reaches TikTok without attribution consent: without it
// the SDK is never started. Only the conversion events of [kTikTokEventMap] are sent; health records never are.
// The ATT prompt is asked by the app (facebook_events.dart), never by the TikTok SDK. Credentials stay in the
// native plugin configuration. [TikTokEventsPlugin] is null until the native step ports packages/tiktok-events.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tracking_transparency.dart';

typedef TikTokProps = Map<String, Object>;

abstract interface class TikTokEventsPlugin {
  /// Initializes the SDK once (credentials from the native config) or re-enables tracking.
  Future<({bool started, String? reason})> start({required bool tracking, bool debug = false});
  Future<void> setEnabled(bool enabled);
  Future<void> track({required String event, TikTokProps? properties});
  Future<void> identify(String externalId);
  Future<void> logout();
}

/// Internal analytics event → TikTok standard event. The generic `purchase` event is left out on purpose: it is
/// fired together with `premium_subscribed`, which already carries the value.
const Map<String, String> kTikTokEventMap = {
  'sign_up': 'Registration',
  'login': 'Login',
  'premium_trial_started': 'StartTrial',
  'premium_subscribed': 'Subscribe',
  'premium_paywall_clicked': 'AddPaymentInfo',
  'books_checkout_started': 'Checkout',
  'books_purchase_confirmed': 'Purchase',
  'book_added_to_cart': 'AddToCart',
  'book_viewed': 'ViewContent',
  'name_searched': 'Search',
};

const Set<String> _monetary = {'premium_trial_started', 'premium_subscribed', 'books_checkout_started', 'books_purchase_confirmed', 'book_added_to_cart'};

/// `Number(value)`.
num _jsNumber(Object? value) {
  if (value == null) return double.nan;
  if (value is num) return value;
  if (value is bool) return value ? 1 : 0;
  final text = '$value'.trim();
  if (text.isEmpty) return 0;
  return num.tryParse(text) ?? double.nan;
}

/// Flat, non-personal properties only: value/currency for revenue events, ids/types for content events.
TikTokProps tiktokProperties(String eventName, [Map<String, Object?>? params]) {
  final out = <String, Object>{};
  if (params == null) return out;
  final raw = params['price'] ?? params['value'] ?? params['amount'];
  final value = _jsNumber(raw);
  if (_monetary.contains(eventName) && value.isFinite && value > 0) {
    out['value'] = value;
    final currency = params['currency'];
    out['currency'] = currency is String && RegExp(r'^[A-Z]{3}$').hasMatch(currency) ? currency : 'USD';
  }
  final id = params['book_id'] ?? params['product_id'] ?? params['plan'];
  if (id is String || id is num) {
    final text = id is double && id == id.truncateToDouble() && id.isFinite ? id.toInt().toString() : '$id';
    out['content_id'] = text.length > 100 ? text.substring(0, 100) : text;
  }
  if (eventName.startsWith('book')) {
    out['content_type'] = 'product';
  } else if (eventName.startsWith('premium')) {
    out['content_type'] = 'subscription';
  }
  return out;
}

class TikTokEvents {
  TikTokEvents({
    required this.plugin,
    required this.attributionAllowed,
    required this.platform,
    this.trackingTransparency = const UnavailableTrackingTransparency(),
  });

  /// Null = not native or the plugin is missing (`getPlugin()` → null).
  final TikTokEventsPlugin? plugin;
  final bool Function() attributionAllowed;
  final String platform;
  final TrackingTransparency trackingTransparency;

  bool _started = false;
  Future<bool>? _startFuture;
  String? _pendingIdentity;

  bool get started => _started;

  Future<bool> _ensureStarted() async {
    if (_started) return true;
    if (!attributionAllowed()) return false;
    final p = plugin;
    if (p == null) return false;
    return _startFuture ??= () async {
      var tracking = false;
      if (platform == 'ios') {
        try {
          tracking = await trackingTransparency.getStatus() == 'authorized';
        } catch (_) {/* ATT plugin unavailable: limited attribution */}
      }
      try {
        final r = await p.start(tracking: tracking);
        _started = r.started;
      } catch (_) {
        _started = false;
      }
      final identity = _pendingIdentity;
      if (_started && identity != null) {
        try {
          await p.identify(identity);
        } catch (_) {}
      }
      _startFuture = null;
      return _started;
    }();
  }

  /// `logTikTokEvent`: silently ignores unmapped events and missing consent.
  Future<void> logEvent(String eventName, [Map<String, Object?>? params]) async {
    final event = kTikTokEventMap[eventName];
    if (event == null || !attributionAllowed()) return;
    if (!await _ensureStarted()) return;
    try {
      await plugin?.track(event: event, properties: tiktokProperties(eventName, params));
    } catch (_) {}
  }

  /// `applyTikTokConsent(allowed)` (after the Meta / ATT step).
  Future<void> applyConsent(bool allowed) async {
    final p = plugin;
    if (p == null) return;
    if (allowed) {
      await _ensureStarted();
      return;
    }
    if (_started) {
      try {
        await p.logout();
        await p.setEnabled(false);
      } catch (_) {}
      _started = false;
    }
  }

  /// `setTikTokIdentity(userId)`: the pseudonymous account id (no e-mail / phone).
  Future<void> setIdentity(String? userId) async {
    final p = plugin;
    if (p == null) return;
    if (userId == null) {
      _pendingIdentity = null;
      if (_started) {
        try {
          await p.logout();
        } catch (_) {}
      }
      return;
    }
    if (_pendingIdentity == userId && _started) return;
    _pendingIdentity = userId;
    if (!attributionAllowed() || !await _ensureStarted()) return;
    try {
      await p.identify(userId);
    } catch (_) {}
  }
}

/// The TikTok plugin (null until the native step ports packages/tiktok-events).
final tiktokEventsPluginProvider = Provider<TikTokEventsPlugin?>((ref) => null);
