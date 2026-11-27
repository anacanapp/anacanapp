// Ported from: src/lib/promo.ts (the parts entry/auth/promo.dart and app/deep_links.dart do not already port:
//              durations, error codes, FINAL_ERRORS, clearPendingPromo, fetchPromoCampaign, redeemPromo,
//              promoDurationLabel, promoErrorText)
//
// QR Premium campaigns (docs/PROMO_QR.md). A QR opens https://app.anacan.az/h/<CODE>; the code is kept on the
// device until the person is signed in, then promo-redeem grants the campaign's RevenueCat promotional Premium.
// The /h/<code> landing page itself stays on the web.
import '../../../state/local_store.dart';
import '../../settings/copy/feature_copy.dart' show FeatureText;
import '../commerce_backend.dart';

export '../../entry/auth/promo.dart' show kPendingPromoKey, kPromoCodeRe, normalizePromoCode, promoPendingEvents, readPendingPromo, savePendingPromo;

const List<String> promoDurations = ['weekly', 'monthly', 'two_month', 'three_month', 'six_month', 'yearly', 'lifetime'];

/// 'PROMO_NOT_FOUND' | 'PROMO_INACTIVE' | 'PROMO_NOT_STARTED' | 'PROMO_EXPIRED' | 'PROMO_FULL' | 'PROMO_ALREADY_USED'
/// | 'PROMO_NOT_NEW_USER' | 'PROMO_IN_PROGRESS' | 'premium_store_subscription_active' | 'grant_failed'
typedef PromoErrorCode = String;

const List<String> _errorCodes = [
  'PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_NOT_STARTED', 'PROMO_EXPIRED', 'PROMO_FULL', //
  'PROMO_ALREADY_USED', 'PROMO_NOT_NEW_USER', 'PROMO_IN_PROGRESS', 'premium_store_subscription_active', 'grant_failed',
];

/// Errors that will not change by trying again later: the saved code is dropped.
const Set<String> promoFinalErrors = {
  'PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_EXPIRED', 'PROMO_FULL', //
  'PROMO_ALREADY_USED', 'PROMO_NOT_NEW_USER', 'premium_store_subscription_active',
};

/// Shape of promo_campaign_public_v1: `state` is 'not_found' for an unknown code, else the campaign's live state.
class PromoCampaignPublic {
  const PromoCampaignPublic({required this.state, this.code, this.title, this.duration, this.eligibility, this.endsAt});
  final String state;
  final String? code;
  final String? title;
  final String? duration;
  final String? eligibility;
  final String? endsAt;
}

/// `{ok: true, duration, title, expires_at}` or `{ok: false, code}`.
class PromoResult {
  const PromoResult.ok({required this.duration, this.title, this.expiresAt}) : ok = true, code = null;
  const PromoResult.failed(this.code) : ok = false, duration = null, title = null, expiresAt = null;
  final bool ok;
  final String? duration;
  final String? title;
  final String? expiresAt;
  final PromoErrorCode? code;

  @override
  bool operator ==(Object other) =>
      other is PromoResult && other.ok == ok && other.duration == duration && other.title == title && other.expiresAt == expiresAt && other.code == code;
  @override
  int get hashCode => Object.hash(ok, duration, title, expiresAt, code);
  @override
  String toString() => ok ? '{ok: true, duration: $duration, title: $title, expires_at: $expiresAt}' : '{ok: false, code: $code}';
}

void clearPendingPromo(LocalStore store) {
  try {
    store.removeItem('anacan:promo-code');
  } catch (_) {}
}

PromoErrorCode promoErrorCode(Object? value) {
  String text;
  if (value is String) {
    text = value;
  } else if (value is Map) {
    final v = value['error'] ?? value['message'];
    text = v == null ? '' : '$v';
  } else if (value != null) {
    text = errorText(value);
  } else {
    text = '';
  }
  for (final code in _errorCodes) {
    if (text.contains(code)) return code;
  }
  return 'grant_failed';
}

Future<PromoCampaignPublic> fetchPromoCampaign(CommerceBackend backend, String code) async {
  final res = await backend.rpc('promo_campaign_public_v1', {'p_code': code});
  if (res.error != null) throw res.error!;
  final v = res.data;
  if (v is Map && v['state'] is String) {
    String? s(String k) => v[k] is String ? v[k] as String : null;
    return PromoCampaignPublic(
      state: v['state'] as String,
      code: s('code'),
      title: s('title'),
      duration: s('duration'),
      eligibility: s('eligibility'),
      endsAt: s('ends_at'),
    );
  }
  return const PromoCampaignPublic(state: 'not_found');
}

Future<PromoResult> redeemPromo(CommerceBackend backend, String code) async {
  try {
    final res = await backend.invoke('promo-redeem', {'code': code});
    final data = res.data;
    if (res.error == null && data is Map && data['ok'] == true && data['duration'] is String && (data['duration'] as String).isNotEmpty) {
      return PromoResult.ok(
        duration: data['duration'] as String,
        title: data['title'] is String ? data['title'] as String : null,
        expiresAt: data['expires_at'] is String ? data['expires_at'] as String : null,
      );
    }
    final body = functionErrorBody(res.error) ?? data;
    return PromoResult.failed(promoErrorCode(body ?? res.error));
  } catch (e) {
    return PromoResult.failed(promoErrorCode(e));
  }
}

String promoDurationLabel(FeatureText text, String? duration) {
  final v = text('d_$duration');
  return v != 'd_$duration' ? v : (duration ?? '');
}

String promoErrorText(FeatureText text, PromoErrorCode code) {
  switch (code) {
    case 'PROMO_ALREADY_USED':
      return text('err_used');
    case 'PROMO_NOT_NEW_USER':
      return text('err_new');
    case 'PROMO_FULL':
      return text('err_full');
    case 'PROMO_EXPIRED':
    case 'PROMO_INACTIVE':
      return text('err_expired');
    case 'PROMO_NOT_FOUND':
    case 'PROMO_NOT_STARTED':
      return text('err_not_found');
    case 'premium_store_subscription_active':
      return text('err_store');
    default:
      return text('err_failed');
  }
}

/// Query roots refreshed after a granted code.
const Set<String> promoPremiumRoots = {'premium-access-v1', 'subscription', 'household-premium'};
