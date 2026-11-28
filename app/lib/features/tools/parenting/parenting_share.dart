// Ported from: src/lib/parenting-share.ts
//
// Tərbiyə: send an SOS card or an article to the linked partner, or share it through the phone's share sheet. The
// partner gets an ordinary partner chat message (chat_send_message_v2 + push, the chat feature's send path): the
// title, a one-line summary and a link https://app.anacan.az/parenting/<kind>/<id>. His Tərbiyə screen lists the
// items she sent (readPartnerShares) and opens them directly; the link itself is routed by parseDeeplink.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../domain/js_compat.dart';
import '../../chat/data/chat.dart' as chat show sendPartnerMessage;
import '../../chat/data/chat_backend.dart' show chatBackendProvider;
import '../../chat/data/chat_push.dart' show chatPushSenderProvider;

/// 'sos' | 'article'
typedef ShareKind = String;

class ShareItem {
  const ShareItem({required this.kind, required this.id, required this.emoji, required this.title, required this.summary});
  final ShareKind kind;
  final String id;
  final String emoji;
  final String title;

  /// Article summary or the SOS card's moment.
  final String summary;
}

final RegExp _id = RegExp(r'^[a-z0-9-]{1,60}$');
const String parentingLinkBase = 'https://app.anacan.az/parenting';
final RegExp _link = RegExp(r'https://app\.anacan\.az/parenting/(sos|article)/([a-z0-9-]{1,60})(?![a-z0-9-])');

/// The in-app link of an item (also a universal link).
String parentingItemLink(ShareKind kind, String id) => '$parentingLinkBase/$kind/$id';

String _clip(String s, int max) => s.length > max ? '${s.substring(0, max - 1).trimRight()}…' : s;

/// The partner message: emoji + title, the summary, the "open in Tərbiyə" hint and the link.
String partnerShareText(ShareItem item, String hint) =>
    ['${item.emoji} ${_clip(item.title, 120)}', _clip(item.summary, 280), '', hint, parentingItemLink(item.kind, item.id)].join('\n');

/// The share-sheet text: title, summary and where it is from.
String plainShareText(ShareItem item, String footer) => ['${item.emoji} ${_clip(item.title, 120)}', _clip(item.summary, 400), '', footer].join('\n');

/// The item a partner message points to (null when the message is not a Tərbiyə share).
({ShareKind kind, String id})? parseParentingShare(String? content) {
  final m = content == null ? null : _link.firstMatch(content);
  return m != null && _id.hasMatch(m[2]!) ? (kind: m[1]!, id: m[2]!) : null;
}

class PartnerShare {
  const PartnerShare({required this.kind, required this.id, required this.messageId, required this.at, required this.read});
  final ShareKind kind;
  final String id;
  final String messageId;
  final String at;
  final bool read;

  @override
  bool operator ==(Object other) =>
      other is PartnerShare && other.kind == kind && other.id == id && other.messageId == messageId && other.at == at && other.read == read;
  @override
  int get hashCode => Object.hash(kind, id, messageId, at, read);
}

/// One entry per item (the newest message wins).
List<PartnerShare> dedupeShares(List<Map<String, dynamic>> rows, [int limit = 5]) {
  final seen = <String>{};
  final out = <PartnerShare>[];
  for (final r in rows) {
    final t = parseParentingShare(r['content'] as String?);
    if (t == null || seen.contains('${t.kind}:${t.id}')) continue;
    seen.add('${t.kind}:${t.id}');
    out.add(PartnerShare(kind: t.kind, id: t.id, messageId: '${r['id']}', at: '${r['created_at']}', read: r['is_read'] == true));
    if (out.length >= limit) break;
  }
  return out;
}

/// The server calls of the share feature (tests override).
abstract interface class ParentingShareRemote {
  /// `profiles.select('user_id').eq('id', profileId).maybeSingle()` → user id (null when unreadable).
  Future<String?> partnerUserId(String partnerProfileId);

  /// The chat send path (`sendPartnerMessage(actor, target, text)`).
  Future<void> sendPartnerMessage(String actor, String partnerUserId, String text);

  /// `partner_messages` text rows to [userId] containing the link base since [since], newest first, at most 20.
  Future<List<Map<String, dynamic>>> partnerShareRows(String userId, String since);

  /// `partner_messages.update({ is_read: true }).eq('id').eq('receiver_id')`.
  Future<void> markRead(String userId, String messageId);
}

class SupabaseParentingShareRemote implements ParentingShareRemote {
  SupabaseParentingShareRemote(this._ref);
  final Ref _ref;
  SupabaseClient get _client => _ref.read(supabaseClientProvider);

  @override
  Future<String?> partnerUserId(String partnerProfileId) async {
    final row = await _client.from('profiles').select('user_id').eq('id', partnerProfileId).maybeSingle();
    return row?['user_id'] as String?;
  }

  @override
  Future<void> sendPartnerMessage(String actor, String partnerUserId, String text) async {
    await chat.sendPartnerMessage(_ref.read(chatBackendProvider), _ref.read(chatPushSenderProvider), actor, partnerUserId, text);
  }

  @override
  Future<List<Map<String, dynamic>>> partnerShareRows(String userId, String since) async {
    final data = await _client
        .from('partner_messages')
        .select('id, content, created_at, is_read')
        .eq('receiver_id', userId)
        .eq('message_type', 'text')
        .like('content', '%$parentingLinkBase/%')
        .gte('created_at', since)
        .order('created_at', ascending: false)
        .limit(20);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<void> markRead(String userId, String messageId) =>
      _client.from('partner_messages').update({'is_read': true}).eq('id', messageId).eq('receiver_id', userId);
}

final parentingShareRemoteProvider = Provider<ParentingShareRemote>((ref) => SupabaseParentingShareRemote(ref), name: 'parentingShareRemoteProvider');

/// Send to the mother's linked partner: his user id from his profile, then the chat send path.
Future<bool> sendParentingToPartner(ParentingShareRemote db, ({String userId, String partnerProfileId}) actor, String text) async {
  String? partnerUserId;
  try {
    partnerUserId = await db.partnerUserId(actor.partnerProfileId);
  } catch (_) {
    partnerUserId = null;
  }
  if (partnerUserId == null || partnerUserId.isEmpty) return false;
  await db.sendPartnerMessage(actor.userId, partnerUserId, text);
  return true;
}

/// Items the mother sent to this partner (newest first, one row per item, last 60 days, at most [limit]).
Future<List<PartnerShare>> readPartnerShares(ParentingShareRemote db, String userId, {int limit = 5, int? now}) async {
  final since = jsToIsoString(DateTime.fromMillisecondsSinceEpoch((now ?? DomainClock.nowMs()) - 60 * 86400000));
  try {
    return dedupeShares(await db.partnerShareRows(userId, since), limit);
  } catch (_) {
    return const [];
  }
}

/// Mark the partner message read once he opened the item (best effort).
Future<void> markPartnerShareRead(ParentingShareRemote db, String userId, String messageId) async {
  try {
    await db.markRead(userId, messageId);
  } catch (_) {}
}
