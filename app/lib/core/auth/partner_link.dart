// Ported from: src/lib/partner-link.ts, src/integrations/supabase/backend-config.ts (isAzurePairingBackend)

import '../i18n/tr.dart';

/// `supabase.rpc(fn, params)`: returns `data`, throws the PostgREST error (or a transport error).
typedef RpcCall = Future<Object?> Function(String fn, [Map<String, dynamic>? params]);

final RegExp _secureCodePattern =
    RegExp(r'^ANACAN-(?:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}|[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$');

/// `isAzurePairingBackend()`: Google builds always pair through the RPCs; otherwise
/// `VITE_AZURE_PARTNER_PAIRING === 'true'` and (not source-first, or admitted to the managed realm).
bool isAzurePairingBackend({
  required String buildMode,
  required String azurePartnerPairing,
  required bool sourceFirst,
  required bool azure,
}) =>
    buildMode == 'google' || (azurePartnerPairing == 'true' && (!sourceFirst || azure));

class PartnerLinkError implements Exception {
  const PartnerLinkError(this.code);
  final String code;
  String get message => code;
  String get name => 'PartnerLinkError';
  @override
  String toString() => 'PartnerLinkError($code)';
}

/// Throws [PartnerLinkError] `INVALID_PARTNER_CODE` / `PARTNER_CODE_EXPIRED`.
String normalizeSecurePartnerCode(Object? value) {
  if (value is! String || value.length > 64) throw const PartnerLinkError('INVALID_PARTNER_CODE');
  final code = value.trim().toUpperCase();
  if (RegExp(r'^ANACAN-[A-Z0-9]{4}$').hasMatch(code)) throw const PartnerLinkError('PARTNER_CODE_EXPIRED');
  if (!_secureCodePattern.hasMatch(code)) throw const PartnerLinkError('INVALID_PARTNER_CODE');
  return code;
}

class PartnerLink {
  const PartnerLink({required this.rpc, required this.pairingEnabled});

  final RpcCall rpc;
  final bool pairingEnabled;

  Future<void> linkPartnerByCode(Object? value) async {
    if (!pairingEnabled) throw const PartnerLinkError('PAIRING_UNAVAILABLE');
    final code = normalizeSecurePartnerCode(value);
    final data = await rpc('link_partner_by_code', {'p_partner_code': code});
    // Expected rejections are returned, not raised, so the server's attempt counter commits.
    if (data is! Map || data['ok'] != true) {
      final reason = data is Map && data['error'] is String ? data['error'] as String : 'PAIRING_FAILED';
      throw PartnerLinkError(reason);
    }
  }

  /// Clears an old one-sided pointer only when the server confirms the link is not mutual.
  Future<bool> clearStaleOneSidedLink(String userId) async {
    try {
      final data = await rpc('get_user_linked_partner_id', {'_user_id': userId});
      if (data != null) return false;
    } catch (_) {
      return false;
    }
    try {
      await rpc('unlink_partners');
      return true;
    } catch (_) {
      return false;
    }
  }

  /// The owner-authenticated, rotated invitation code to share (`ensure_secure_partner_code`).
  Future<String> getPartnerCodeForSharing(String currentCode) async {
    if (!pairingEnabled) return currentCode;
    final data = await rpc('ensure_secure_partner_code');
    // Never share the cached invitation if rotation failed or the server is not migrated.
    if (data is! String || !_secureCodePattern.hasMatch(data)) throw const PartnerLinkError('PAIRING_UNAVAILABLE');
    return data;
  }
}

String? _codeOf(Object? error) {
  if (error is PartnerLinkError) return error.code;
  String? code, message;
  if (error is Map) {
    code = error['code']?.toString();
    message = error['message']?.toString();
  } else if (error != null) {
    try {
      final dynamic e = error;
      code = e.code?.toString();
      message = e.message?.toString();
    } catch (_) {}
  }
  return code == 'P0001' ? message : code;
}

String getPartnerLinkErrorMessage(Object? error) {
  switch (_codeOf(error)) {
    case 'PARTNER_CODE_EXPIRED':
      return tr('partner_pairing_old_invite',
          'This invitation is out of date. Ask your partner to share a new code from their profile.');
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
