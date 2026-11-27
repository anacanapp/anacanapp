// Ported from: src/lib/chat-media.ts
//
// The chat-media bucket is private (signed URLs only). Direct-message and AI-chat photos are reached through
// createSignedUrl at render time. Legacy rows stored a full getPublicUrl string that 404s once the bucket is
// private, so the object path (everything after `/chat-media/`) is extracted and re-signed. New rows store the
// bare object path. (Shared with the chat feature: import it from here.)
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/db.dart';

const String kChatMediaBucket = 'chat-media';

/// Signed-URL lifetime. Long enough to read a thread, short enough to limit sharing.
const int kChatMediaSignedTtlSeconds = 60 * 60;

class _SignedCacheEntry {
  const _SignedCacheEntry(this.url, this.expiresAt);
  final String url;

  /// Local-clock ms at which the cached url is refused and re-signed.
  final int expiresAt;
}

// In-memory, per object path: each path is signed once per TTL window instead of on every build.
final Map<String, _SignedCacheEntry> _signedCache = {};

String? _sanitizeObjectPath(String raw) {
  final clean = raw.replaceFirst(RegExp(r'^/+'), '');
  if (clean.isEmpty || clean.contains(r'\') || clean.contains('\u0000')) return null;
  final parts = clean.split('/');
  if (parts.any((p) => p.isEmpty || p == '.' || p == '..')) return null;
  return clean;
}

/// `new URL(value).pathname` with dot segments resolved (the WHATWG parser does this).
String _normalizedPath(Uri url) => url.normalizePath().path;

/// Normalize a stored chat-media value to its storage object path (bare path or an http(s) URL that embeds
/// `/chat-media/<path>`). Null for anything else (blob:/data: previews, foreign URLs, junk).
String? chatMediaObjectPath(String? stored) {
  if (stored == null) return null;
  final value = stored.trim();
  if (value.isEmpty) return null;
  if (RegExp(r'^[a-z][a-z0-9+.-]*:', caseSensitive: false).hasMatch(value)) {
    final url = Uri.tryParse(value);
    if (url == null) return null;
    if (url.scheme != 'http' && url.scheme != 'https') return null;
    if (url.host.isEmpty) return null;
    final match = RegExp(r'/chat-media/(.+)$').firstMatch(_normalizedPath(url));
    if (match == null) return null;
    String decoded;
    try {
      decoded = Uri.decodeComponent(match.group(1)!);
    } catch (_) {
      return null;
    }
    return _sanitizeObjectPath(decoded);
  }
  return _sanitizeObjectPath(value);
}

/// `supabase.storage.from(bucket).createSignedUrl(path, ttl)`; null on failure.
typedef ChatMediaSigner = Future<String?> Function(String bucket, String path, int ttlSeconds);

/// Create (or reuse a cached) signed URL for a stored chat-media value; null when the value is not a chat-media
/// object or signing fails.
Future<String?> signChatMediaUrl(ChatMediaSigner signer, String? stored,
    {int ttlSeconds = kChatMediaSignedTtlSeconds, int Function()? nowMs}) async {
  final path = chatMediaObjectPath(stored);
  if (path == null) return null;
  final now = (nowMs ?? () => DateTime.now().millisecondsSinceEpoch)();
  final cached = _signedCache[path];
  if (cached != null && cached.expiresAt > now) return cached.url;
  String? url;
  try {
    url = await signer(kChatMediaBucket, path, ttlSeconds);
  } catch (_) {
    url = null;
  }
  if (url == null || url.isEmpty) return null;
  // Re-sign a minute before the real expiry so an on-screen image never 404s.
  final safeTtlMs = ((ttlSeconds - 60) < 1 ? 1 : ttlSeconds - 60) * 1000;
  _signedCache[path] = _SignedCacheEntry(url, now + safeTtlMs);
  return url;
}

/// Test-only / logout cleanup: drop every cached signed URL.
void clearChatMediaSignedCache() => _signedCache.clear();

final chatMediaSignerProvider = Provider<ChatMediaSigner>((ref) {
  return (bucket, path, ttl) async {
    try {
      return await ref.read(dbProvider).signedUrl(bucket, path, ttl);
    } catch (_) {
      return null;
    }
  };
});

/// `useChatMediaSrc(stored)`: the signed URL of a stored value (null while signing / on failure).
final chatMediaSrcProvider = FutureProvider.autoDispose.family<String?, String>((ref, stored) async {
  final value = stored.trim();
  if (value.isEmpty) return null;
  return signChatMediaUrl(ref.read(chatMediaSignerProvider), value);
});
