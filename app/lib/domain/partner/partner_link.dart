// Ported from: src/lib/partner-link.ts (code validation, server answer interpretation and error copy; the RPC
// calls themselves belong to the backend client)

import '../js_compat.dart';

final RegExp _secureCodePattern = RegExp(r'^ANACAN-(?:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}|[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$');

class PartnerLinkError implements Exception {
  const PartnerLinkError(this.code);
  final String code;
  String get message => code;
  @override
  String toString() => 'PartnerLinkError: $code';
}

/// Trims and upper-cases a 6/8-character secure code; throws PARTNER_CODE_EXPIRED for the old 4-character
/// codes and INVALID_PARTNER_CODE for anything else (including non-strings and >64 characters).
String normalizeSecurePartnerCode(Object? value) {
  if (value is! String || value.length > 64) throw const PartnerLinkError('INVALID_PARTNER_CODE');
  final code = value.trim().toUpperCase();
  if (RegExp(r'^ANACAN-[A-Z0-9]{4}$').hasMatch(code)) throw const PartnerLinkError('PARTNER_CODE_EXPIRED');
  if (!_secureCodePattern.hasMatch(code)) throw const PartnerLinkError('INVALID_PARTNER_CODE');
  return code;
}

bool isSecurePartnerCode(Object? value) => value is String && _secureCodePattern.hasMatch(value);

/// link_partner_by_code answer: success only for an object with `ok: true`; otherwise its string `error`
/// becomes the error code (PAIRING_FAILED when there is none).
void checkLinkPartnerResult(Object? data) {
  if (data is Map && data['ok'] == true) return;
  final reason = data is Map && data['error'] is String ? data['error'] as String : 'PAIRING_FAILED';
  throw PartnerLinkError(reason);
}

/// ensure_secure_partner_code answer: never share a stale or malformed code.
String checkSharedPartnerCode(Object? data) {
  if (!isSecurePartnerCode(data)) throw const PartnerLinkError('PAIRING_UNAVAILABLE');
  return data as String;
}

/// User-facing message for an error with a `code` (and `message` when the code is P0001). Unknown server
/// details are never shown.
String getPartnerLinkErrorMessage(Object? error, {Tr tr = azTr}) {
  String? code;
  if (error is PartnerLinkError) {
    code = error.code;
  } else if (error is Map) {
    code = error['code'] == 'P0001' ? error['message'] as String? : error['code'] as String?;
  }
  switch (code) {
    case 'PARTNER_CODE_EXPIRED':
      return tr('partner_pairing_old_invite', 'This invitation is out of date. Ask your partner to share a new code from their profile.');
    case 'INVALID_PARTNER_CODE':
      return tr('partner_pairing_invalid_invite', 'Check the invitation code or ask your partner to share a new one.');
    case 'PAIRING_SELF_LINK':
      return tr('partner_pairing_self', "You cannot link your account to itself. Enter your partner's invitation code.");
    case 'PAIRING_CONFLICT':
      return tr('partner_pairing_conflict',
          'An account already has a partner link. Unlink the existing relationship first. Inconsistent links require support.');
    case 'PAIRING_RATE_LIMITED':
      return tr('partner_pairing_rate_limit', 'Too many pairing attempts. Please wait 15 minutes before trying again.');
    case 'NOT_AUTHENTICATED':
      return tr('partner_pairing_sign_in', 'Confirm your email if required, then sign in and retry pairing.');
    case 'PAIRING_ACCOUNT_CHANGED':
      return tr('partner_pairing_account_changed', 'Sign in to the account you registered before retrying this invitation.');
    case 'PROFILE_NOT_READY':
      return tr('partner_pairing_profile_pending', 'Your profile is not ready yet. Retry pairing shortly; do not register again.');
    case 'PAIRING_RETRY':
    case '40001':
      return tr('partner_pairing_changed', 'The partner link changed during this request. Please try again.');
    case 'PAIRING_UNAVAILABLE':
    case '42501':
    case 'PGRST202':
      return tr('partner_pairing_unavailable', 'Secure partner linking is not available right now. Please try again later.');
    default:
      return tr('partner_pairing_failed', 'Partner linking failed. Check your connection and retry.');
  }
}

