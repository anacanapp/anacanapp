// Ported from: src/lib/chat-media.ts
//
// Audit-2 finding #1: the chat-media bucket is private (signed URLs only). Direct-message and AI-chat photos /
// voice notes are reached through createSignedUrl at render time. Legacy rows stored a full public URL that 404s
// once the bucket is private, so the object path (everything after `/chat-media/`) is extracted and re-signed.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shell/links/js_url.dart';
import 'chat_backend.dart';

const String _bucket = 'chat-media';

/// Signed-URL lifetime. Long enough to read a thread, short enough to limit sharing.
const int kChatMediaSignedTtlSeconds = 60 * 60;

class _SignedCacheEntry {
  const _SignedCacheEntry(this.url, this.expiresAt);
  final String url;

  /// Local-clock ms at which the cached url is refused and re-signed.
  final int expiresAt;
}

// In-memory, per object path: each path is signed once per TTL window.
final Map<String, _SignedCacheEntry> _signedCache = {};

String? _sanitizeObjectPath(String raw) {
  final clean = raw.replaceFirst(RegExp(r'^/+'), '');
  if (clean.isEmpty || clean.contains(r'\') || clean.contains('\u0000')) return null;
  if (clean.split('/').any((part) => part.isEmpty || part == '.' || part == '..')) return null;
  return clean;
}

/// Normalizes a stored chat-media value to its storage object path: a bare object path (new rows) or a full
/// http(s) public/sign URL embedding `/chat-media/<path>` (legacy rows). Null for anything else.
String? chatMediaObjectPath(String? stored) {
  if (stored == null) return null;
  final value = stored.trim();
  if (value.isEmpty) return null;
  if (RegExp(r'^[a-z][a-z0-9+.-]*:', caseSensitive: false).hasMatch(value)) {
    final url = JsUrl.parse(value);
    if (url == null) return null;
    if (url.protocol != 'http:' && url.protocol != 'https:') return null;
    final match = RegExp(r'/chat-media/(.+)$').firstMatch(url.pathname);
    if (match == null) return null;
    String decoded;
    try {
      decoded = Uri.decodeComponent(match[1]!);
    } catch (_) {
      return null;
    }
    return _sanitizeObjectPath(decoded);
  }
  return _sanitizeObjectPath(value);
}

/// Creates (or reuses a cached) signed URL for a stored chat-media value; null when the value is not a
/// chat-media object or signing fails.
Future<String?> signChatMediaUrl(ChatBackend backend, String? stored,
    {int ttlSeconds = kChatMediaSignedTtlSeconds, int Function()? now}) async {
  final path = chatMediaObjectPath(stored);
  if (path == null) return null;
  final at = (now ?? () => DateTime.now().millisecondsSinceEpoch)();
  final cached = _signedCache[path];
  if (cached != null && cached.expiresAt > at) return cached.url;
  String url;
  try {
    url = await backend.signedUrl(_bucket, path, ttlSeconds);
  } catch (_) {
    return null;
  }
  if (url.isEmpty) return null;
  // Re-sign a minute before the real expiry so an on-screen image never 404s.
  final safeTtlMs = (ttlSeconds - 60 < 1 ? 1 : ttlSeconds - 60) * 1000;
  _signedCache[path] = _SignedCacheEntry(url, at + safeTtlMs);
  return url;
}

/// Test-only / logout cleanup: drop every cached signed URL.
void clearChatMediaSignedCache() => _signedCache.clear();

/// `useChatMediaSrc(stored, ttl)`: local `blob:` / `data:` previews as they are, everything else signed (cached
/// per path) and re-resolved when [stored] changes.
class ChatMediaSrc extends ConsumerStatefulWidget {
  const ChatMediaSrc({super.key, required this.stored, required this.builder, this.ttlSeconds = kChatMediaSignedTtlSeconds});
  final String? stored;
  final int ttlSeconds;
  final Widget Function(BuildContext context, String? src) builder;

  @override
  ConsumerState<ChatMediaSrc> createState() => _ChatMediaSrcState();
}

bool _isPreview(String value) => RegExp(r'^(blob:|data:)', caseSensitive: false).hasMatch(value);

class _ChatMediaSrcState extends ConsumerState<ChatMediaSrc> {
  String? _src;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    final stored = widget.stored?.trim();
    _src = stored != null && _isPreview(stored) ? stored : null;
    _resolve();
  }

  @override
  void didUpdateWidget(ChatMediaSrc oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stored != widget.stored || oldWidget.ttlSeconds != widget.ttlSeconds) _resolve();
  }

  void _resolve() {
    final generation = ++_generation;
    final value = widget.stored?.trim();
    // Called from initState / didUpdateWidget: a build follows, so plain assignments suffice.
    if (value == null || value.isEmpty) {
      _src = null;
      return;
    }
    if (_isPreview(value)) {
      _src = value;
      return;
    }
    _src = null;
    signChatMediaUrl(ref.read(chatBackendProvider), value, ttlSeconds: widget.ttlSeconds).then((url) {
      if (mounted && generation == _generation) setState(() => _src = url);
    }, onError: (Object _) {
      if (mounted && generation == _generation) setState(() => _src = null);
    });
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _src);
}
