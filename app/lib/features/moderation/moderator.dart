// Ported from: src/lib/moderator.ts, src/lib/moderator-i18n.ts
//
// Moderation reasons / scopes, the 25-language moderator copy and the RPC error → message mapping.
import '../../core/i18n/i18n.dart';
import 'copy/moderator_copy.g.dart';

const List<String> moderatorReasons = <String>['advertising', 'spam', 'harassment', 'misinformation', 'privacy', 'inappropriate', 'impersonation', 'other'];
const List<String> moderatorScopes = <String>['community', 'post', 'story', 'comment', 'message', 'full'];

/// `moderatorText(key, language)`: the language's own string, else English (else the key).
String moderatorText(String key, [String? language]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = kModeratorCopyAll[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return kModeratorCopyAll['en']?[key] ?? key;
}

/// `moderatorReason(value, language, body)`: unknown reasons read as 'other'.
String moderatorReason(String? value, [String? language, bool body = false]) {
  final reason = moderatorReasons.contains(value) ? value : 'other';
  return moderatorText('reason_$reason${body ? '_body' : ''}', language);
}

/// `` `${value?.code || ''} ${value?.message || ''}` `` (a plain string has neither field).
String _errorText(Object? error) {
  if (error == null || error is String) return ' ';
  if (error is Map) return '${error['code'] ?? ''} ${error['message'] ?? ''}';
  final dynamic e = error;
  Object? code;
  Object? message;
  try {
    code = e.code;
  } catch (_) {}
  try {
    message = e.message;
  } catch (_) {}
  return '${code ?? ''} ${message ?? ''}';
}

/// `moderatorError(error, language)`.
String moderatorError(Object? error, [String? language]) {
  final message = _errorText(error);
  bool has(String pattern) => RegExp(pattern).hasMatch(message);
  final key = has('PGRST202|42883')
      ? 'unavailable'
      : has('PROTECTED_ACCOUNT')
          ? 'protected_account'
          : has('ADMIN_DECISION')
              ? 'admin_decision'
              : has('CONFLICT|40001|ALREADY_ASSIGNED')
                  ? 'conflict'
                  : has('NETWORK_NOT_READY')
                      ? 'ip_unavailable'
                      : has('IP_OBSERVATION_REQUIRED')
                          ? 'ip_no_observation'
                          : has('SIGNUP_NETWORK_RESTRICTED|REGISTRATION_IP_UNAVAILABLE')
                              ? 'signup_restricted'
                              : has('MODERATOR_REQUIRED|MODERATOR_AUTH_REQUIRED')
                                  ? 'moderator_required'
                                  : has('STORY_EXPIRED')
                                      ? 'restore_expired_story'
                                      : has('COMMENTS_LOCKED')
                                          ? 'comments_closed'
                                          : has('APP_RESTRICTED')
                                              ? 'full_restricted'
                                              : has('ACTIVITY_RESTRICTED|COMMUNITY_RESTRICTED')
                                                  ? 'restriction_notice'
                                                  : 'error';
  return moderatorText(key, language);
}
