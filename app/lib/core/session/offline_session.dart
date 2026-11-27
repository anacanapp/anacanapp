// Ported from: src/lib/offline-session.ts
//
// Offline session restore.
//
// When the app opens with an expired access token and no usable network, the SDK keeps
// the stored session (the refresh failed with a retryable network error) but has no
// usable session. The app must not treat that as a logout: it opens read-only on the
// stored account (cached children, timers, last data, offline outbox) and refreshes once
// the network is back.
//
// A real invalid refresh token is different: gotrue removes the stored session and
// emits SIGNED_OUT, so [readStoredSession] then returns null and the normal logout path
// runs. The stored value read here is the supabase_flutter persisted-session JSON
// (`Session.toJson()`), held by SessionStore.

import 'dart:convert';

/// The JS SDK treats a session as expired this long before `expires_at`.
/// (gotrue Dart uses a 10 s margin for its own refresh decision.)
const Duration sessionExpiryMargin = Duration(milliseconds: 90000);

/// Online but slow: open on the stored account if the SDK has not answered by then.
const Duration offlineRestoreGrace = Duration(milliseconds: 2500);

/// A persisted session that names an account and can be refreshed later.
class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.userId,
    required this.raw,
  });

  final String accessToken;
  final String refreshToken;

  /// Unix seconds.
  final num expiresAt;
  final String userId;
  final Map<String, dynamic> raw;
}

StoredSession? parseStoredSession(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  try {
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic>) return null;
    final access = value['access_token'], refresh = value['refresh_token'], expiresAt = value['expires_at'];
    if (access is! String || refresh is! String || refresh.isEmpty) return null;
    if (expiresAt is! num) return null;
    final user = value['user'];
    if (user is! Map) return null;
    final id = user['id'];
    if (id is! String || id.isEmpty) return null;
    if (user['__isUserNotAvailableProxy'] == true) return null;
    return StoredSession(accessToken: access, refreshToken: refresh, expiresAt: expiresAt, userId: id, raw: value);
  } catch (_) {
    return null;
  }
}

/// The session the SDK persisted (kept after a retryable refresh failure), or null.
Future<StoredSession?> readStoredSession(Future<String?> Function()? read) async {
  if (read == null) return null;
  try {
    return parseStoredSession(await read());
  } catch (_) {
    return null;
  }
}

bool isSessionExpired(num? expiresAt, {DateTime? now}) {
  if (expiresAt == null) return true;
  final nowMs = (now ?? DateTime.now()).millisecondsSinceEpoch;
  return expiresAt * 1000 - nowMs < sessionExpiryMargin.inMilliseconds;
}
