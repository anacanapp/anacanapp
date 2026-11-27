// Ported from: src/lib/email-verification.ts, src/pages/Index.tsx (e-mail gate cache key)
//
// E-mail verification for new e-mail/password accounts. The server decides whether a code is
// required; any failure to ask is "not required" so a network problem never locks a person out.

import 'package:supabase_flutter/supabase_flutter.dart';

/// `anacan_email_verified_v1:<uid>` = '1' (LocalStore) once verified or answered not required.
String emailVerifiedCacheKey(String userId) => 'anacan_email_verified_v1:$userId';

/// Index decides "not required" when the server has not answered within this time.
const Duration emailGateDecisionTimeout = Duration(seconds: 4);

class EmailVerificationState {
  const EmailVerificationState({this.required = false, this.verified = false, this.email, this.answered = false});
  final bool required;
  final bool verified;
  final String? email;

  /// False when the server could not be asked (then nothing should be remembered).
  final bool answered;
}

Future<EmailVerificationState> fetchEmailVerificationState(SupabaseClient client) async {
  try {
    final data = await client.rpc<Object?>('email_verification_state_v1');
    if (data is! Map) return const EmailVerificationState();
    return EmailVerificationState(
      required: data['required'] == true,
      verified: data['verified'] == true,
      email: data['email'] is String ? data['email'] as String : null,
      answered: true,
    );
  } catch (_) {
    return const EmailVerificationState();
  }
}

/// 'wrong_code' | 'expired' | 'too_many' | 'rate_limited' | 'send_failed'.
class VerificationResult {
  const VerificationResult({required this.ok, this.error, this.retryIn, this.premium = false});
  final bool ok;
  final String? error;
  final num? retryIn;
  final bool premium;
}

Future<VerificationResult> _call(SupabaseClient client, Map<String, Object?> body) async {
  Object? payload;
  try {
    final response = await client.functions.invoke('email-verification', body: body);
    payload = response.data;
  } on FunctionException catch (error) {
    payload = error.details;
  } catch (_) {
    return const VerificationResult(ok: false, error: 'send_failed');
  }
  if (payload is Map && (payload['verified'] == true || payload['sent'] == true)) {
    return VerificationResult(
      ok: true,
      retryIn: payload['retry_in'] is num ? payload['retry_in'] as num : null,
      premium: payload['premium'] == true,
    );
  }
  const known = ['wrong_code', 'expired', 'too_many', 'rate_limited'];
  final error = payload is Map ? payload['error'] : null;
  return VerificationResult(
    ok: false,
    error: known.contains(error) ? error as String : 'send_failed',
    retryIn: payload is Map && payload['retry_in'] is num ? payload['retry_in'] as num : null,
  );
}

Future<VerificationResult> sendVerificationCode(SupabaseClient client, String language) =>
    _call(client, {'action': 'send', 'language': language});

Future<VerificationResult> confirmVerificationCode(SupabaseClient client, String code, String language) =>
    _call(client, {'action': 'confirm', 'code': code, 'language': language});
