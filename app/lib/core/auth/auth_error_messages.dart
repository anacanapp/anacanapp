// Ported from: src/components/AuthScreen.tsx (getSignupErrorMessage, getLoginErrorMessage),
// src/lib/moderator.ts (isModeratorSignupError)
//
// Error → message mapping of the e-mail sign-up / sign-in forms, with the same i18n keys.
// The moderator copy (`moderatorError`, 25-language module) belongs to the moderation feature; it is
// injected through [moderatorSignupMessage].

import 'package:supabase_flutter/supabase_flutter.dart' show AuthException, AuthRetryableFetchException;

import '../i18n/tr.dart';

({String code, String message}) _parts(Object? error) {
  if (error == null) return (code: '', message: '');
  if (error is AuthException) return (code: error.code ?? '', message: error.message);
  if (error is Map) return (code: '${error['code'] ?? ''}', message: '${error['message'] ?? ''}');
  if (error is String) return (code: '', message: error);
  try {
    final dynamic e = error;
    final Object? message = e.message;
    Object? code;
    try {
      code = e.code;
    } catch (_) {}
    return (code: code?.toString() ?? '', message: message?.toString() ?? '');
  } catch (_) {
    return (code: '', message: '');
  }
}

/// `isModeratorSignupError(error)`.
bool isModeratorSignupError(Object? error) =>
    RegExp('MODERATOR_(SIGNUP_NETWORK_RESTRICTED|REGISTRATION_IP_UNAVAILABLE)', caseSensitive: false)
        .hasMatch(_parts(error).message);

/// The moderator feature's `moderatorError(error, language)`; null → the generic fallbacks below.
String Function(Object? error)? moderatorSignupMessage;

/// supabase-js reports a dropped request as "Failed to fetch"; gotrue-dart as
/// [AuthRetryableFetchException] (any transport failure, incl. the 15 s auth timeout).
bool _isNetwork(Object? error, String msg) =>
    error is AuthRetryableFetchException ||
    msg.contains('fetch') ||
    msg.contains('network request failed') ||
    msg.contains('networkerror');

/// `getSignupErrorMessage(error)`.
String getSignupErrorMessage(Object? error) {
  if (isModeratorSignupError(error) && moderatorSignupMessage != null) return moderatorSignupMessage!(error);
  final p = _parts(error);
  final code = p.code, msg = p.message.toLowerCase();
  if (_isNetwork(error, msg)) {
    return tr('auth_connection_unavailable', 'Serverə qoşulmaq mümkün olmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
  }
  if (code == 'weak_password' || msg.contains('weak') || msg.contains('pwned')) {
    return tr('authscreen_sifre_cox_zeifdir_ve_ya_sizdir_e88929',
        'Şifrə çox zəifdir və ya sızdırılmış şifrələr siyahısındadır. Daha güclü, unikal bir şifrə seçin (ən azı 8 simvol, böyük/kiçik hərf, rəqəm və simvol).');
  }
  if (code == 'user_already_exists' ||
      code == 'email_exists' ||
      msg.contains('already registered') ||
      msg.contains('already exists') ||
      msg.contains('user already')) {
    return tr('authscreen_bu_e_mail_artiq_qeydiyyatdan_k_9e529d',
        'Bu e-mail artıq qeydiyyatdan keçib. Giriş edin və ya şifrəni unutmusunuzsa bərpa edin.');
  }
  if (code == 'invalid_email' || msg.contains('invalid email') || msg.contains('email address')) {
    return tr('authscreen_e_mail_unvani_duzgun_deyil_ae6d26', 'E-mail ünvanı düzgün deyil.');
  }
  if (code == 'over_email_send_rate_limit' || msg.contains('rate limit')) {
    return tr('authscreen_cox_sayda_cehd_edildi_bir_az_s_782c25', 'Çox sayda cəhd edildi. Bir az sonra yenidən cəhd edin.');
  }
  if (msg.contains('password') && msg.contains('characters')) {
    return tr('authscreen_sifre_en_azi_6_simvoldan_ibare_8dd3e4', 'Şifrə ən azı 6 simvoldan ibarət olmalıdır.');
  }
  return p.message.isNotEmpty
      ? p.message
      : tr('authscreen_qeydiyyat_zamani_xeta_bas_verd_100ebf', 'Qeydiyyat zamanı xəta baş verdi. Yenidən cəhd edin.');
}

/// `getLoginErrorMessage(error)`.
String getLoginErrorMessage(Object? error) {
  final p = _parts(error);
  final code = p.code, msg = p.message.toLowerCase();
  if (_isNetwork(error, msg)) {
    return tr('auth_connection_unavailable', 'Serverə qoşulmaq mümkün olmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
  }
  if (code == 'invalid_credentials' || msg.contains('invalid login credentials')) {
    return tr('authscreen_e_mail_ve_ya_sifre_yanlisdir_1ef792', 'E-mail və ya şifrə yanlışdır.');
  }
  if (msg.contains('email not confirmed') || msg.contains('not confirmed')) {
    return tr('authscreen_e_mail_tesdiqlenmeyib_50f146', 'E-mail təsdiqlənməyib.');
  }
  if (msg.contains('rate limit') || code == 'over_request_rate_limit') {
    return tr('authscreen_cox_sayda_cehd_edildi_bir_az_s_ff5fd3', 'Çox sayda cəhd edildi. Bir az sonra yenidən yoxlayın.');
  }
  return p.message.isNotEmpty
      ? p.message
      : tr('authscreen_giris_zamani_xeta_bas_verdi_ye_1c654e', 'Giriş zamanı xəta baş verdi. Yenidən cəhd edin.');
}
