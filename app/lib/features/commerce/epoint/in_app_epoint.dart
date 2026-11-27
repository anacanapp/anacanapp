// Ported from: src/lib/in-app-epoint.ts
//
// In-app Epoint card payment for Premium (owner 2026-11-25).
//
// Shown inside the app paywall when app_settings.in_app_epoint enables the user's country (profiles.country_code,
// falling back to the device locale region) and platform. The checkout is the anacan.az web subscription
// (web-premium 'subscribe' with page 'app'): Epoint card registration with the first payment, renewing with the saved
// card. The server prices it, refuses it while any Premium is active, re-checks the admin setting, and grants Premium
// only from Epoint's signed callback. The app opens the payment page (see [CheckoutPageOpener]) and, when the user
// comes back, polls the Premium entitlement (get_premium_access_v1) for up to a minute.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/i18n.dart';
import '../../../state/local_store.dart';
import '../commerce_backend.dart';

/// 'monthly' | 'yearly'
typedef EpointPlan = String;

/// 'ios' | 'android' | 'web'
typedef AppPlatform = String;

class InAppEpointSetting {
  const InAppEpointSetting({required this.enabled, required this.countries, required this.platforms});
  final bool enabled;
  final List<String> countries;
  final Map<String, bool> platforms;

  @override
  bool operator ==(Object other) =>
      other is InAppEpointSetting && other.enabled == enabled && listEquals(other.countries, countries) && mapEquals(other.platforms, platforms);
  @override
  int get hashCode => Object.hash(enabled, Object.hashAll(countries), platforms['android'], platforms['ios'], platforms['web']);
  @override
  String toString() => '{enabled: $enabled, countries: $countries, platforms: $platforms}';
}

class EpointPlanPrice {
  const EpointPlanPrice({required this.price, this.was, this.pct, this.perMonth, this.usd});
  final double price;
  final double? was;
  final double? pct;
  final double? perMonth;
  final double? usd;

  @override
  bool operator ==(Object other) =>
      other is EpointPlanPrice && other.price == price && other.was == was && other.pct == pct && other.perMonth == perMonth && other.usd == usd;
  @override
  int get hashCode => Object.hash(price, was, pct, perMonth, usd);
  @override
  String toString() => '{price: $price, was: $was, pct: $pct, perMonth: $perMonth, usd: $usd}';
}

class EpointRate {
  const EpointRate({required this.value, this.date, this.source});
  final double value;
  final String? date;
  final String? source;

  @override
  bool operator ==(Object other) => other is EpointRate && other.value == value && other.date == date && other.source == source;
  @override
  int get hashCode => Object.hash(value, date, source);
}

class EpointOffer {
  const EpointOffer({required this.paymentsReady, this.kind, this.rate, required this.plans, required this.premiumActive, this.premiumSource});
  final bool paymentsReady;

  /// 'app' (admin USD prices converted to AZN at the CBAR rate), 'campaign', 'standard' or null.
  final String? kind;
  final EpointRate? rate;
  final Map<String, EpointPlanPrice?> plans;
  final bool premiumActive;
  final String? premiumSource;
}

/// 'idle' | 'starting' | 'redirected' | 'checking' | 'success' | 'timeout' | 'error'
typedef InAppEpointStatus = String;

// ── pure helpers (unit-tested) ─────────────────────────────────────────────────────────

/// Same reading as the server (web-premium-subscription.ts parseInAppEpoint): unreadable means off.
InAppEpointSetting parseInAppEpointSetting(Object? raw) {
  Object? value = raw;
  for (var i = 0; i < 2 && value is String; i++) {
    try {
      value = jsonDecode(value);
    } catch (_) {
      value = null;
    }
  }
  final v = value is Map ? value : const {};
  final platforms = v['platforms'] is Map ? v['platforms'] as Map : const {};
  final countries = <String>[];
  final raws = v['countries'];
  if (raws is List) {
    for (final c in raws) {
      if (c is! String) continue;
      final code = c.trim().toUpperCase();
      if (RegExp(r'^[A-Z]{2}$').hasMatch(code) && !countries.contains(code)) countries.add(code);
    }
  }
  return InAppEpointSetting(
    enabled: v['enabled'] == true,
    countries: countries,
    platforms: {'android': platforms['android'] == true, 'ios': platforms['ios'] == true, 'web': platforms['web'] == true},
  );
}

bool isInAppEpointEligible(InAppEpointSetting setting, String? country, AppPlatform platform) {
  final code = (country ?? '').trim().toUpperCase();
  return setting.enabled && setting.platforms[platform] == true && RegExp(r'^[A-Z]{2}$').hasMatch(code) && setting.countries.contains(code);
}

/// Region of a BCP 47 tag ('az-AZ' → 'AZ', 'az-Latn-AZ' → 'AZ'); null without one.
String? localeRegion(String? tag) {
  if (tag == null || tag.isEmpty) return null;
  final parts = tag.replaceAll('_', '-').split('-').skip(1);
  for (final part in parts) {
    if (RegExp(r'^[A-Za-z]{2}$').hasMatch(part)) return part.toUpperCase();
  }
  return null;
}

/// The profile country, else the device locale region.
String? resolveCountry(String? profileCountry, [String? deviceLocale]) {
  final own = (profileCountry ?? '').trim().toUpperCase();
  if (RegExp(r'^[A-Z]{2}$').hasMatch(own)) return own;
  return localeRegion(deviceLocale ?? PlatformDispatcher.instance.locale.toLanguageTag());
}

double? _number(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.trim()) ?? (v.trim().isEmpty ? 0 : null);
  if (v is bool) return v ? 1 : 0;
  return null;
}

EpointPlanPrice? _planPrice(Object? value, [Object? usdValue]) {
  if (value is! Map) return null;
  final price = _number(value['price']);
  if (price == null || !price.isFinite || price <= 0) return null;
  final was = value['was'] == null ? null : _number(value['was']);
  final pct = value['pct'] == null ? null : _number(value['pct']);
  final perMonth = value['per_month'] == null ? null : _number(value['per_month']);
  return EpointPlanPrice(
    price: price,
    was: was != null && was.isFinite && was > price ? was : null,
    pct: pct != null && pct.isFinite ? pct : null,
    perMonth: perMonth != null && perMonth.isFinite ? perMonth : null,
    usd: usdValue is num && usdValue.isFinite && usdValue > 0 ? usdValue.toDouble() : null,
  );
}

/// web-premium 'status' answer → what the paywall shows (server prices only).
EpointOffer? parseEpointStatus(Object? data) {
  if (data is! Map || data['ok'] != true) return null;
  final offer = data['offer'] is Map ? data['offer'] as Map : const {};
  final plans = offer['active'] == true && offer['plans'] is Map ? offer['plans'] as Map : const {};
  final premium = data['premium'] is Map ? data['premium'] as Map : const {};
  final usd = offer['usd'] is Map ? offer['usd'] as Map : const {};
  final rate = _number(offer['rate']);
  final kind = offer['kind'];
  return EpointOffer(
    paymentsReady: data['payments_ready'] == true,
    kind: kind == 'app' || kind == 'campaign' || kind == 'standard' ? kind as String : null,
    rate: rate != null && rate.isFinite && rate > 0
        ? EpointRate(
            value: rate,
            date: offer['rate_date'] is String ? offer['rate_date'] as String : null,
            source: offer['rate_source'] is String ? offer['rate_source'] as String : null,
          )
        : null,
    plans: {'monthly': _planPrice(plans['monthly'], usd['monthly']), 'yearly': _planPrice(plans['yearly'], usd['yearly'])},
    premiumActive: premium['active'] == true,
    premiumSource: premium['source'] is String ? premium['source'] as String : null,
  );
}

/// Error code of a web-premium answer → copy key. Store Premium gets its own message.
String epointErrorKey(String? code, [String? premiumSource]) {
  switch (code) {
    case 'premium_active':
      return premiumSource == 'store' ? 'iep_err_premium_store' : 'iep_err_premium_active';
    case 'payments_unavailable':
      return 'iep_err_payments_unavailable';
    case 'too_many_attempts':
    case 'rate_limited':
      return 'iep_err_too_many_attempts';
    case 'checkout_unavailable':
    case 'app_checkout_disabled':
    case 'invalid_plan':
      return 'iep_err_checkout_unavailable';
    default:
      return 'iep_err_generic';
  }
}

/// Price as the paywall shows it: "4,99 ₼" in the app language's number format.
String formatAzn(num amount, [String? language]) {
  final lang = language ?? currentLanguage();
  try {
    return '${formatIntlNumber(lang, amount, maximumFractionDigits: 2, minimumFractionDigits: 2)} ₼';
  } catch (_) {
    return '${amount.toStringAsFixed(2)} ₼';
  }
}

/// Polls [check] until it is true or the time is up.
Future<bool> pollUntil(
  Future<bool> Function() check, {
  int timeoutMs = 60000,
  int intervalMs = 3000,
  bool Function()? cancelled,
  Future<void> Function(int ms)? sleep,
  int Function()? now,
}) async {
  final clock = now ?? () => DateTime.now().millisecondsSinceEpoch;
  final wait = sleep ?? (ms) => Future<void>.delayed(Duration(milliseconds: ms));
  final isCancelled = cancelled ?? () => false;
  final deadline = clock() + timeoutMs;
  while (!isCancelled()) {
    bool ok;
    try {
      ok = await check();
    } catch (_) {
      ok = false;
    }
    if (ok) return true;
    if (clock() + intervalMs > deadline) return false;
    await wait(intervalMs);
  }
  return false;
}

// ── server calls ───────────────────────────────────────────────────────────────────────

Future<Map<String, Object?>?> invokeWebPremium(CommerceBackend backend, Map<String, Object?> body) async {
  try {
    final res = await backend.invoke('web-premium', body);
    if (res.error == null && res.data is Map) return Map<String, Object?>.from(res.data as Map);
    final parsed = functionErrorBody(res.error);
    return parsed is Map ? {'ok': false, ...Map<String, Object?>.from(parsed)} : null;
  } catch (_) {
    return null;
  }
}

/// page 'app': the in-app offer (admin USD prices converted to AZN by the server), not the website campaign.
Future<EpointOffer?> fetchEpointOffer(CommerceBackend backend) async => parseEpointStatus(await invokeWebPremium(backend, {'action': 'status', 'page': 'app'}));

/// `{ok: true, url}` or `{ok: false, error, premiumSource}`.
class CheckoutStart {
  const CheckoutStart.ok(this.url) : ok = true, error = null, premiumSource = null;
  const CheckoutStart.failed(this.error, this.premiumSource) : ok = false, url = null;
  final bool ok;
  final String? url;
  final String? error;
  final String? premiumSource;

  @override
  bool operator ==(Object other) =>
      other is CheckoutStart && other.ok == ok && other.url == url && other.error == error && other.premiumSource == premiumSource;
  @override
  int get hashCode => Object.hash(ok, url, error, premiumSource);
  @override
  String toString() => ok ? '{ok: true, url: $url}' : '{ok: false, error: $error, premiumSource: $premiumSource}';
}

Future<CheckoutStart> requestEpointCheckout(CommerceBackend backend, EpointPlan plan, AppPlatform platform, String language) async {
  final data = await invokeWebPremium(backend, {
    'action': 'subscribe',
    'plan': plan,
    'page': 'app',
    'consent': 'premium-autorenew-v1',
    'platform': platform,
    'language': language,
  });
  final redirect = data?['redirect_url'];
  if (data?['ok'] == true && redirect is String && redirect.startsWith('https://')) return CheckoutStart.ok(redirect);
  final premium = data?['premium'] is Map ? data!['premium'] as Map : null;
  return CheckoutStart.failed(
    data?['error'] is String ? data!['error'] as String : 'unavailable',
    premium?['source'] is String ? premium!['source'] as String : null,
  );
}

/// Own Premium as get_premium_access_v1 answers it (the same RPC the entitlement reads).
Future<bool> hasOwnPremium(CommerceBackend backend, String userId) async {
  final res = await backend.rpc('get_premium_access_v1', {'p_user_id': userId});
  final access = res.data;
  return res.error == null &&
      access is Map &&
      access['protocol'] == 'anacan-premium-access-v1' &&
      access['userId'] == userId &&
      access['own'] is Map &&
      (access['own'] as Map)['active'] == true;
}

// ── opening the payment page ───────────────────────────────────────────────────────────

/// Opens the Epoint page. React: Capacitor Browser plugin (SFSafariViewController / Custom Tabs, `browserFinished`
/// → poll) when present, else the system browser. Flutter: Android → url_launcher `inAppBrowserView` (Custom Tabs;
/// closing it resumes the activity, which starts the poll); iOS → `externalApplication` (Safari; coming back is an
/// app resume). url_launcher reports no "browser closed" event, so the resume is the only return signal.
abstract interface class CheckoutPageOpener {
  /// 'in_app' | 'external'.
  Future<String> open(String url);
}

/// The url_launcher mode tried first: the in-app browser (Custom Tabs) on Android, the system browser elsewhere.
LaunchMode checkoutLaunchMode(TargetPlatform platform, {bool web = kIsWeb}) =>
    !web && platform == TargetPlatform.android ? LaunchMode.inAppBrowserView : LaunchMode.externalApplication;

class UrlLauncherCheckoutOpener implements CheckoutPageOpener {
  const UrlLauncherCheckoutOpener();

  @override
  Future<String> open(String url) async {
    final uri = Uri.parse(url);
    if (checkoutLaunchMode(defaultTargetPlatform) == LaunchMode.inAppBrowserView) {
      try {
        if (await launchUrl(uri, mode: LaunchMode.inAppBrowserView)) return 'in_app';
      } catch (_) {
        // fall through to the system browser
      }
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
    return 'external';
  }
}

final checkoutPageOpenerProvider = Provider<CheckoutPageOpener>((ref) => const UrlLauncherCheckoutOpener());

// A checkout that left the app (the app may be restarted meanwhile): the next mount resumes checking.
const String kEpointPendingKey = 'anacan_iep_pending_v1';
const int _pendingMs = 30 * 60000;

void markEpointPending(LocalStore store, String userId, [int? now]) {
  try {
    store.writeJson(kEpointPendingKey, {'userId': userId, 'at': now ?? DateTime.now().millisecondsSinceEpoch});
  } catch (_) {}
}

void clearEpointPending(LocalStore store) {
  try {
    store.removeItem(kEpointPendingKey);
  } catch (_) {}
}

bool pendingCheckout(LocalStore store, String? userId, [int? now]) {
  if (userId == null || userId.isEmpty) return false;
  try {
    final value = store.readJson(kEpointPendingKey);
    final at = value is Map ? value['at'] : null;
    return value is Map && value['userId'] == userId && at is num && (now ?? DateTime.now().millisecondsSinceEpoch) - at < _pendingMs;
  } catch (_) {
    return false;
  }
}

/// Same roots the store purchase sync and QayğıCash Premium refresh.
const Set<String> epointPremiumRoots = {
  'premium-access-v1', 'subscription', 'household-premium', 'community-feed', 'group-posts', 'post-comments', //
  'single-post', 'user-posts', 'community-connections', 'public-profile', 'community-profile', 'community-profile-card', 'chat-authors-v2',
};
