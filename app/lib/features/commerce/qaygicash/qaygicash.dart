// Ported from: src/lib/qaygicash.ts
//
// QayğıCash — Anacan's bonus (cashback) programme. Client-side types, parsing and preview math.
// The ledger lives on the server (migration 20261106150000_qaygicash); every number here is a preview
// and the server re-checks it (max share of an order, minimum, available balance) when an order is placed.
// All amounts are integer minor units (qəpik).
import 'dart:convert';
import 'dart:math' as math;

import '../../../core/i18n/i18n.dart';
import '../../../core/i18n/generated/intl_data.g.dart' show kNumberSymbols;
import '../../../domain/js_compat.dart' show jsNumberToString, jsRound;
import '../../../state/local_store.dart';
import '../commerce_backend.dart' show errorText;
import 'qc_intl.g.dart';

/// Brand name: never translated.
const String qcBrand = 'QayğıCash';

/// 'premium_yearly' | 'premium_monthly' | 'book' | 'cake' | 'own_shop' | 'partner' | 'affiliate'
typedef QcEarnChannel = String;

/// 'aptek' | 'cake' | 'book'
typedef QcRedeemChannel = String;

/// 'monthly' | 'yearly'
typedef QcPremiumPlan = String;

/// 'ios' | 'android' | 'web'
typedef QcPlatform = String;

class QcPlanRedeem {
  const QcPlanRedeem({required this.enabled, this.priceMinor});
  final bool enabled;
  final int? priceMinor;

  @override
  bool operator ==(Object other) => other is QcPlanRedeem && other.enabled == enabled && other.priceMinor == priceMinor;
  @override
  int get hashCode => Object.hash(enabled, priceMinor);
  @override
  String toString() => 'QcPlanRedeem($enabled, $priceMinor)';
}

class QcPremiumRedeem {
  const QcPremiumRedeem({required this.enabled, required this.monthly, required this.yearly, required this.platforms});
  final bool enabled;
  final QcPlanRedeem monthly;
  final QcPlanRedeem yearly;
  final Map<String, bool> platforms;

  QcPlanRedeem plan(QcPremiumPlan plan) => plan == 'yearly' ? yearly : monthly;
}

/// `QcWalletResult`: `{enabled: false}` or a [QcWallet].
class QcWalletResult {
  const QcWalletResult._(this.enabled);
  final bool enabled;

  @override
  bool operator ==(Object other) => other is QcWalletResult && other is! QcWallet && this is! QcWallet && other.enabled == enabled;
  @override
  int get hashCode => enabled.hashCode;
  @override
  String toString() => '{enabled: $enabled}';
}

/// `QC_DISABLED`.
const QcWalletResult qcDisabled = QcWalletResult._(false);

class QcWallet extends QcWalletResult {
  const QcWallet({
    required this.status,
    required this.country,
    required this.currency,
    required this.availableMinor,
    required this.pendingMinor,
    required this.expiring30dMinor,
    required this.nextExpiryAt,
    required this.debtMinor,
    required this.rates,
    required this.holdDaysPhysical,
    required this.holdDaysDigital,
    required this.expiryMonths,
    required this.maxRedeemPct,
    required this.minRedeemMinor,
    required this.redeemChannels,
    required this.termsVersion,
    required this.premiumRedeem,
    this.premiumBaseMinor = const {},
  }) : super._(true);

  /// 'live' | 'paused'
  final String status;
  final String country;
  final String currency;
  final int availableMinor;
  final int pendingMinor;
  final int expiring30dMinor;
  final String? nextExpiryAt;
  final int debtMinor;

  /// Basis points per earn channel (500 = 5 %).
  final Map<String, int> rates;
  final int holdDaysPhysical;
  final int holdDaysDigital;
  final int expiryMonths;
  final int maxRedeemPct;
  final int minRedeemMinor;
  final List<String> redeemChannels;
  final int termsVersion;
  final QcPremiumRedeem premiumRedeem;

  /// Base the store Premium bonus is computed on (rule fixed_base_minor); falls back to [qcPremiumBaseMinor].
  final Map<String, int> premiumBaseMinor;

  QcWallet copyWith({
    String? status,
    int? availableMinor,
    int? pendingMinor,
    int? debtMinor,
    Map<String, int>? rates,
    List<String>? redeemChannels,
    QcPremiumRedeem? premiumRedeem,
  }) => QcWallet(
    status: status ?? this.status,
    country: country,
    currency: currency,
    availableMinor: availableMinor ?? this.availableMinor,
    pendingMinor: pendingMinor ?? this.pendingMinor,
    expiring30dMinor: expiring30dMinor,
    nextExpiryAt: nextExpiryAt,
    debtMinor: debtMinor ?? this.debtMinor,
    rates: rates ?? this.rates,
    holdDaysPhysical: holdDaysPhysical,
    holdDaysDigital: holdDaysDigital,
    expiryMonths: expiryMonths,
    maxRedeemPct: maxRedeemPct,
    minRedeemMinor: minRedeemMinor,
    redeemChannels: redeemChannels ?? this.redeemChannels,
    termsVersion: termsVersion,
    premiumRedeem: premiumRedeem ?? this.premiumRedeem,
    premiumBaseMinor: premiumBaseMinor,
  );

  @override
  bool operator ==(Object other) => identical(this, other);
  @override
  int get hashCode => identityHashCode(this);
}

/// 'earn' | 'redeem'
class QcHistoryItem {
  const QcHistoryItem({
    required this.id,
    required this.type,
    required this.channel,
    this.sourceType,
    required this.amountMinor,
    this.remainingMinor,
    this.rateBp,
    required this.status,
    required this.at,
    this.availableAt,
    this.expiresAt,
  });
  final String id;
  final String type;
  final String channel;
  final String? sourceType;
  final int amountMinor;
  final int? remainingMinor;
  final int? rateBp;
  final String status;
  final String at;
  final String? availableAt;
  final String? expiresAt;
}

/// Premium earns on a fixed local base (App Store / Google Play prices differ per storefront).
const Map<String, int> qcPremiumBaseMinor = {'yearly': 2699, 'monthly': 399};

/// Slider step: 0,10 ₼.
const int qcStepMinor = 10;

/// JS `Number(x)` for a string, then `Math.trunc` when finite, else [fallback].
int _int(Object? value, [int fallback = 0]) {
  num? n;
  if (value is String) {
    final t = value.trim();
    n = t.isEmpty ? 0 : num.tryParse(t);
  } else if (value is num) {
    n = value;
  } else if (value is bool) {
    n = null;
  }
  return n != null && n.isFinite ? n.truncate() : fallback;
}

Map<String, Object?> _obj(Object? value) {
  var v = value;
  if (v is String) {
    try {
      v = jsonDecode(v);
    } catch (_) {
      v = null;
    }
  }
  return v is Map ? v.map((k, val) => MapEntry('$k', val)) : <String, Object?>{};
}

/// Normalises qaygicash_wallet_v1. Anything unexpected hides the programme.
QcWalletResult parseWallet(Object? raw) {
  final w = _obj(raw);
  if (w['enabled'] != true) return qcDisabled;
  final rates = <String, int>{for (final e in _obj(w['rates']).entries) e.key: math.max(0, _int(e.value))};
  final pr = _obj(w['premium_redeem']);
  QcPlanRedeem plan(Object? p) {
    final o = _obj(p);
    return QcPlanRedeem(enabled: o['enabled'] == true, priceMinor: o['price_minor'] == null ? null : _int(o['price_minor']));
  }

  final platforms = _obj(pr['platforms']);
  final base = _obj(w['premium_base_minor']);
  final channels = w['redeem_channels'];
  String str(Object? v, String fallback) => v == null || v == '' || v == false || v == 0 ? fallback : (v is String ? v : '$v');
  return QcWallet(
    status: w['status'] == 'paused' ? 'paused' : 'live',
    country: str(w['country'], ''),
    currency: str(w['currency'], 'AZN'),
    availableMinor: math.max(0, _int(w['available_minor'])),
    pendingMinor: math.max(0, _int(w['pending_minor'])),
    expiring30dMinor: math.max(0, _int(w['expiring_30d_minor'])),
    nextExpiryAt: w['next_expiry_at'] is String ? w['next_expiry_at'] as String : null,
    debtMinor: math.max(0, _int(w['debt_minor'])),
    rates: rates,
    holdDaysPhysical: math.max(0, _int(w['hold_days_physical'], 14)),
    holdDaysDigital: math.max(0, _int(w['hold_days_digital'], 7)),
    expiryMonths: math.max(1, _int(w['expiry_months'], 12)),
    maxRedeemPct: math.min(100, math.max(0, _int(w['max_redeem_pct'], 30))),
    minRedeemMinor: math.max(1, _int(w['min_redeem_minor'], 100)),
    redeemChannels: [
      if (channels is List)
        for (final c in channels)
          if (c == 'aptek' || c == 'cake' || c == 'book') c as String,
    ],
    termsVersion: math.max(1, _int(w['terms_version'], 1)),
    premiumRedeem: QcPremiumRedeem(
      enabled: pr['enabled'] == true,
      monthly: plan(pr['monthly']),
      yearly: plan(pr['yearly']),
      platforms: {'ios': platforms['ios'] == true, 'android': platforms['android'] == true, 'web': platforms['web'] == true},
    ),
    premiumBaseMinor: {if (_int(base['yearly']) > 0) 'yearly': _int(base['yearly']), if (_int(base['monthly']) > 0) 'monthly': _int(base['monthly'])},
  );
}

List<QcHistoryItem> parseHistory(Object? raw) {
  var value = raw;
  if (value is String) {
    try {
      value = jsonDecode(value);
    } catch (_) {
      value = null;
    }
  }
  if (value is! List) return const [];
  String jsStr(Object? v) => v is num ? jsNumberToString(v) : '$v';
  return [
    for (final r in value.map(_obj))
      if ((r['type'] == 'earn' || r['type'] == 'redeem') && r['at'] is String)
        QcHistoryItem(
          id: r['id'] != null ? jsStr(r['id']) : '${r['type']}-${r['at']}',
          type: r['type'] as String,
          channel: r['channel'] == null || r['channel'] == '' ? '' : jsStr(r['channel']),
          sourceType: r['source_type'] is String ? r['source_type'] as String : null,
          amountMinor: math.max(0, _int(r['amount_minor'])),
          remainingMinor: r['remaining_minor'] == null ? null : math.max(0, _int(r['remaining_minor'])),
          rateBp: r['rate_bp'] == null ? null : _int(r['rate_bp']),
          status: r['status'] == null || r['status'] == '' ? '' : jsStr(r['status']),
          at: r['at'] as String,
          availableAt: r['available_at'] is String ? r['available_at'] as String : null,
          expiresAt: r['expires_at'] is String ? r['expires_at'] as String : null,
        ),
  ];
}

// ── Money and numbers ────────────────────────────────────────────────────────────────────

String _lang(String? language) => normalizeAppLanguage(language == null || language.isEmpty ? currentLanguage() : language);

/// 134 → "1,34 ₼" (locale digits and separators, always two decimals).
String formatQc(num minor, [String? language]) =>
    '${formatIntlNumber(_lang(language), jsRound(minor) / 100, maximumFractionDigits: 2, minimumFractionDigits: 2)}\u00a0₼';

/// Signed amount for history and summary rows: "+1,34 ₼" / "−1,34 ₼".
String formatQcSigned(num minor, [String? language]) {
  if (minor == 0) return formatQc(0, language);
  return '${minor > 0 ? '+' : '−'}${formatQc(minor.abs(), language)}';
}

/// 500 bp → "5%", 250 bp → "2,5%".
String formatRate(num bp, [String? language]) {
  final lang = _lang(language);
  final (prefix, suffix) = kQcPercentAffixes[lang] ?? kQcPercentAffixes['en']!;
  return '$prefix${formatIntlNumber(lang, bp / 100, maximumFractionDigits: 1)}$suffix';
}

/// Short date ("20 noy"); the year is added when it is not the current one.
String formatQcDate(Object at, [String? language, DateTime? now]) {
  final DateTime? d = at is DateTime ? at : (at is String ? jsParseIso(at) : null);
  if (d == null) return '';
  final local = d.toLocal();
  final lang = _lang(language);
  final (dm, dmy, months) = kQcShortDates[lang] ?? kQcShortDates['en']!;
  final template = local.year != (now ?? DateTime.now()).year ? dmy : dm;
  final zero = (kNumberSymbols[lang] ?? kNumberSymbols['en']!).$4;
  String digits(String text) =>
      zero == '0' ? text : text.replaceAllMapped(RegExp('[0-9]'), (m) => String.fromCharCode(zero.codeUnitAt(0) + m[0]!.codeUnitAt(0) - 48));
  return template.replaceAll('{d}', digits('${local.day}')).replaceAll('{M}', months[local.month - 1]).replaceAll('{y}', digits('${local.year}'));
}

/// `new Date(string)` for server timestamps (date-only → UTC midnight, else ISO date-time); null when invalid.
DateTime? jsParseIso(String value) {
  final dateOnly = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (dateOnly != null) return DateTime.utc(int.parse(dateOnly[1]!), int.parse(dateOnly[2]!), int.parse(dateOnly[3]!));
  return DateTime.tryParse(value);
}

int toMinor(num azn) => jsRound((azn.isNaN ? 0 : azn) * 100).toInt();
double toAzn(num minor) => jsRound(minor) / 100;

// ── Earning ──────────────────────────────────────────────────────────────────────────────

/// Bonus for a paid amount: floor(amount × rate), never more than the rate (same rounding as the server).
int earnPreview(num amountMinor, int? rateBp) {
  if (rateBp == null || rateBp <= 0 || !(amountMinor > 0)) return 0;
  return ((amountMinor.floor() * rateBp) / 10000).floor();
}

int rateOf(QcWalletResult? wallet, QcEarnChannel channel) => wallet is QcWallet ? wallet.rates[channel] ?? 0 : 0;

/// Premium bonus preview on the fixed base (yearly 26,99, monthly 3,99).
int premiumEarnMinor(QcWalletResult? wallet, QcPremiumPlan plan) {
  final base = wallet is QcWallet ? wallet.premiumBaseMinor[plan] : null;
  return earnPreview(base ?? qcPremiumBaseMinor[plan]!, rateOf(wallet, plan == 'yearly' ? 'premium_yearly' : 'premium_monthly'));
}

class AptekEarnLine {
  const AptekEarnLine({required this.priceMinor, required this.quantity, required this.own});
  final int priceMinor;
  final int quantity;
  final bool own;
}

/// Aptek: only Anacan-brand (cashback_own) lines earn, on their share of what is paid for goods
/// (bundle/coupon discounts and the bonus used are spread over all lines; delivery excluded).
/// Mirrors qc_orders_status: base = floor(own × (subtotal − discount − bonus) / subtotal).
int aptekEarnMinor(List<AptekEarnLine> lines, int discountMinor, int usedMinor, int? rateBp) {
  if (rateBp == null || rateBp == 0) return 0;
  final subtotal = lines.fold<int>(0, (s, l) => s + l.priceMinor * l.quantity);
  final own = lines.fold<int>(0, (s, l) => s + (l.own ? l.priceMinor * l.quantity : 0));
  if (subtotal <= 0 || own <= 0) return 0;
  final paid = math.max(subtotal - math.max(0, discountMinor) - math.max(0, usedMinor), 0);
  return earnPreview(((own * paid) / subtotal).floor(), rateBp);
}

/// When a bonus earned now becomes spendable.
DateTime availableFrom(int holdDays, [DateTime? now]) => (now ?? DateTime.now()).add(Duration(milliseconds: math.max(0, holdDays) * 86400000));

// ── Spending ─────────────────────────────────────────────────────────────────────────────

/// Most bonus usable on goods worth goodsMinor: floor(goods × max %) and no more than the balance.
int maxRedeemMinor(num goodsMinor, QcWalletResult? wallet) {
  if (wallet is! QcWallet || !(goodsMinor > 0)) return 0;
  final cap = ((goodsMinor.floor() * wallet.maxRedeemPct) / 100).floor();
  return math.max(0, math.min(wallet.availableMinor, cap));
}

/// 'disabled' | 'paused' | 'channel' | 'balance' | 'order' | null
typedef RedeemBlock = String?;

class RedeemLimits {
  const RedeemLimits({required this.show, required this.block, required this.min, required this.max});
  final bool show;
  final RedeemBlock block;
  final int min;
  final int max;

  @override
  bool operator ==(Object other) => other is RedeemLimits && other.show == show && other.block == block && other.min == min && other.max == max;
  @override
  int get hashCode => Object.hash(show, block, min, max);
  @override
  String toString() => '{show: $show, block: $block, min: $min, max: $max}';
}

/// Whether the "Use QayğıCash" switch is offered for this order, and its range.
/// show=false hides the switch (programme off, paused, channel closed, balance under the minimum);
/// block='order' means the balance is enough but this order is too small for the minimum.
RedeemLimits redeemLimits(QcWalletResult? wallet, QcRedeemChannel channel, num goodsMinor) {
  if (wallet is! QcWallet) return const RedeemLimits(show: false, block: 'disabled', min: 0, max: 0);
  final min = wallet.minRedeemMinor;
  if (wallet.status != 'live') return RedeemLimits(show: false, block: 'paused', min: min, max: 0);
  if (!wallet.redeemChannels.contains(channel)) return RedeemLimits(show: false, block: 'channel', min: min, max: 0);
  if (wallet.availableMinor < min) return RedeemLimits(show: false, block: 'balance', min: min, max: 0);
  final max = maxRedeemMinor(goodsMinor, wallet);
  if (max < min) return RedeemLimits(show: true, block: 'order', min: min, max: 0);
  return RedeemLimits(show: true, block: null, min: min, max: max);
}

/// Keeps a chosen amount inside [min, max] on the 0,10 ₼ grid (max itself is always allowed).
int clampRedeem(int value, int min, int max, [int step = qcStepMinor]) {
  if (max < min || max <= 0) return 0;
  if (value >= max) return max;
  if (value <= min) return min;
  return math.min(max, min + jsRound((value - min) / step).toInt() * step);
}

// ── Premium with bonus ───────────────────────────────────────────────────────────────────

/// The "pay Premium with QayğıCash" option: off unless every server switch allows it on this platform.
({int price, bool affordable})? premiumRedeemOption(QcWalletResult? wallet, QcPremiumPlan plan, QcPlatform platform) {
  if (wallet is! QcWallet || wallet.status != 'live') return null;
  final pr = wallet.premiumRedeem;
  final p = pr.plan(plan);
  final price = p.priceMinor;
  if (!pr.enabled || !p.enabled || pr.platforms[platform] != true || price == null || price <= 0) return null;
  return (price: price, affordable: wallet.availableMinor >= price);
}

// ── Errors and statuses ──────────────────────────────────────────────────────────────────

const Map<String, String> _errorKeys = {
  'QC_INSUFFICIENT': 'qc_err_insufficient',
  'QC_ABOVE_MAX': 'qc_err_above_max',
  'QC_BELOW_MIN': 'qc_err_below_min',
  'QC_CHANNEL_CLOSED': 'qc_err_channel_closed',
  'QC_PAUSED': 'qc_err_paused',
  'QC_NOT_AVAILABLE': 'qc_err_not_available',
  'QC_ALREADY_APPLIED': 'qc_err_already_applied',
  'QC_ORDER_NOT_ELIGIBLE': 'qc_err_order_not_eligible',
  'QC_PREMIUM_CLOSED': 'qc_err_premium_closed',
  'not_configured': 'qc_err_premium_closed',
  'premium_store_subscription_active': 'qc_err_store_subscription',
};

/// The QC_* code (or a known premium error) in an RPC / edge-function error, else null.
String? qcErrorCode(Object? error) {
  if (error == null) return null;
  final text = errorText(error);
  final qc = RegExp(r'\bQC_[A-Z_]+\b').firstMatch(text)?[0];
  if (qc != null) return qc;
  if (RegExp('premium_store_subscription_active').hasMatch(text)) return 'premium_store_subscription_active';
  if (RegExp(r'\bnot_configured\b').hasMatch(text)) return 'not_configured';
  if (RegExp(r'\bgrant_failed\b').hasMatch(text)) return 'grant_failed';
  return null;
}

/// Translation key for an error code; unknown codes fall back to the generic message.
String qcErrorKey(String? code) => (code != null ? _errorKeys[code] : null) ?? 'qc_err_generic';

/// 'pending' | 'available' | 'used' | 'gone'
typedef QcTone = String;

/// Colour family of a history row: pending amber, available green, used blue, reversed/expired/returned grey.
QcTone historyTone({required String type, required String status}) {
  if (type == 'redeem') return status == 'released' ? 'gone' : 'used';
  if (status == 'pending') return 'pending';
  if (status == 'available') return 'available';
  return 'gone';
}

/// Copy key of a history row's status.
String historyStatusKey({required String type, required String status}) {
  if (type == 'redeem') {
    return status == 'released'
        ? 'qc_status_returned'
        : status == 'reserved'
        ? 'qc_status_reserved'
        : 'qc_status_used';
  }
  switch (status) {
    case 'pending':
      return 'qc_status_pending';
    case 'available':
      return 'qc_status_available';
    case 'expired':
      return 'qc_status_expired';
    default:
      return 'qc_status_reversed';
  }
}

const Set<String> _earnSources = {'premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'adjust'};
const Set<String> _redeemSources = {'aptek', 'cake', 'book', 'premium'};

/// Copy key of a history row's title.
String historyTitleKey({required String type, required String channel, String? sourceType}) {
  if (type == 'redeem') return _redeemSources.contains(channel) ? 'qc_hist_use_$channel' : 'qc_hist_use_other';
  if (sourceType == 'adjust') return 'qc_hist_earn_adjust';
  return _earnSources.contains(channel) ? 'qc_hist_earn_$channel' : 'qc_hist_earn_adjust';
}

/// Has the person ever had bonus activity (for the one-time intro vs the balance card).
bool hasQcActivity(QcWalletResult? wallet) => wallet is QcWallet && wallet.availableMinor + wallet.pendingMinor > 0;

const String _introKey = 'anacan_qc_intro_dismissed_v1:';

bool readIntroDismissed(LocalStore store, String? uid) {
  if (uid == null || uid.isEmpty) return true;
  try {
    return store.getItem(_introKey + uid) == '1';
  } catch (_) {
    return false;
  }
}

void writeIntroDismissed(LocalStore store, String? uid) {
  if (uid == null || uid.isEmpty) return;
  try {
    store.setItem(_introKey + uid, '1');
  } catch (_) {}
}
