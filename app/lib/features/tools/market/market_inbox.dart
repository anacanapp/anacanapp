// Ported from: src/lib/marketInbox.ts
//
// Second-hand market inbox: both sides of a listing conversation (buyer and seller).
//
// public.marketplace_messages (listing_id, sender_id, receiver_id, content, is_read, created_at) RLS:
//   SELECT when auth.uid() is sender or receiver, INSERT when auth.uid() is the sender,
//   UPDATE when auth.uid() is the receiver (used to set is_read). So the seller can read and reply with the existing
//   policies; no migration is needed.
//
// A conversation is one listing plus one counterpart. Unread = messages addressed to me with is_read not true AND
// newer than the per-device "last seen" mark of that conversation. The local mark keeps the badge correct when the
// is_read update fails (offline, old backend), and is_read keeps it correct across devices.
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart' show jsDateParseMs, jsSortInPlace, jsSorted;
import 'market_db.dart';
import 'market_safety.dart';

@immutable
class MarketMessage {
  const MarketMessage({
    required this.id,
    required this.listingId,
    required this.senderId,
    required this.receiverId,
    required this.content,
    this.isRead,
    required this.createdAt,
  });
  final String id;
  final String listingId;
  final String senderId;
  final String receiverId;
  final String content;
  final bool? isRead;
  final String createdAt;

  factory MarketMessage.fromRow(Map<String, dynamic> r) => MarketMessage(
        id: '${r['id'] ?? ''}',
        listingId: '${r['listing_id'] ?? ''}',
        senderId: '${r['sender_id'] ?? ''}',
        receiverId: '${r['receiver_id'] ?? ''}',
        content: '${r['content'] ?? ''}',
        isRead: r['is_read'] as bool?,
        createdAt: '${r['created_at'] ?? ''}',
      );

  MarketMessage copyWith({bool? isRead}) =>
      MarketMessage(id: id, listingId: listingId, senderId: senderId, receiverId: receiverId, content: content, isRead: isRead ?? this.isRead, createdAt: createdAt);
}

/// 'buyer' | 'seller'
typedef MarketRole = String;

class MarketConversation {
  MarketConversation({
    required this.key,
    required this.listingId,
    required this.counterpartId,
    required this.role,
    required this.last,
    this.unread = 0,
    this.count = 0,
  });
  final String key;
  final String listingId;
  final String counterpartId;

  /// My side in this conversation: 'seller' when I own the listing.
  final MarketRole role;
  MarketMessage last;
  int unread;
  int count;
}

/// Hard cap on how many recent messages the inbox loads (newest first).
const int marketInboxLimit = 500;
const String _seenStoragePrefix = 'anacan.market.inbox.seen.v1:';
const int _seenMaxEntries = 300;

String conversationKey(String listingId, String counterpartId) => '$listingId:$counterpartId';

String counterpartOf(MarketMessage m, String myId) => m.senderId == myId ? m.receiverId : m.senderId;

int _ts(String iso) => jsDateParseMs(iso) ?? 0;

bool isUnreadForMe(MarketMessage m, String myId, [String? seenAt]) {
  if (m.receiverId != myId || m.senderId == myId || m.isRead == true) return false;
  return seenAt == null || seenAt.isEmpty || _ts(m.createdAt) > _ts(seenAt);
}

/// Groups my messages into conversations (listing + counterpart), newest first.
/// [listingOwners] maps listing id to its owner; a listing I cannot see is never mine (my own listings are always
/// readable), so I am the buyer there. Conversations with blocked users are left out.
List<MarketConversation> groupConversations(
  List<MarketMessage> messages,
  String? myId, {
  Set<String> blocked = const {},
  Map<String, String> listingOwners = const {},
  Map<String, String> seen = const {},
}) {
  if (myId == null || myId.isEmpty) return [];
  final map = <String, MarketConversation>{};
  for (final m in messages) {
    if (m.senderId != myId && m.receiverId != myId) continue;
    final counterpartId = counterpartOf(m, myId);
    if (counterpartId.isEmpty || counterpartId == myId || blocked.contains(counterpartId)) continue;
    final key = conversationKey(m.listingId, counterpartId);
    final conv = map.putIfAbsent(
      key,
      () => MarketConversation(key: key, listingId: m.listingId, counterpartId: counterpartId, role: listingOwners[m.listingId] == myId ? 'seller' : 'buyer', last: m),
    );
    conv.count += 1;
    if (_ts(m.createdAt) >= _ts(conv.last.createdAt)) conv.last = m;
    if (isUnreadForMe(m, myId, seen[key])) conv.unread += 1;
  }
  return jsSorted(map.values, (MarketConversation a, MarketConversation b) => _ts(b.last.createdAt) - _ts(a.last.createdAt));
}

int totalUnread(List<MarketConversation> conversations) => conversations.fold(0, (sum, c) => sum + c.unread);

/// The thread between me and one counterpart about one listing, oldest first, blocked senders hidden.
List<MarketMessage> threadMessages(List<MarketMessage> messages, String listingId, String counterpartId, String myId, [Set<String> blocked = const {}]) {
  final thread = messages
      .where((m) => m.listingId == listingId && ((m.senderId == myId && m.receiverId == counterpartId) || (m.senderId == counterpartId && m.receiverId == myId)))
      .toList();
  return jsSortInPlace(visibleMessages(thread, blocked, (MarketMessage m) => m.senderId).toList(), (MarketMessage a, MarketMessage b) => _ts(a.createdAt) - _ts(b.createdAt));
}

/// One-line preview of the last message.
String previewText(String content, [int max = 80]) {
  final flat = content.replaceAll(RegExp(r'\s+'), ' ').trim();
  return flat.length > max ? '${flat.substring(0, max - 1)}…' : flat;
}

// ── Per-device "last seen" marks (localStorage, best effort) ──

/// `Pick<Storage, 'getItem' | 'setItem'>`.
abstract interface class MarketStorage {
  String? getItem(String key);
  void setItem(String key, String value);
}

Map<String, String> readSeenMap(String? userId, MarketStorage? storage) {
  if (userId == null || userId.isEmpty || storage == null) return {};
  try {
    final raw = storage.getItem(_seenStoragePrefix + userId);
    final parsed = raw != null && raw.isNotEmpty ? jsonDecode(raw) : null;
    if (parsed is! Map) return {};
    return {for (final e in parsed.entries) if (e.value is String) '${e.key}': e.value as String};
  } catch (_) {
    return {};
  }
}

/// Marks a conversation seen up to [at] (never moves backwards); keeps the newest 300 marks.
Map<String, String> markSeen(Map<String, String> seen, String key, String at) {
  final current = seen[key];
  if (current != null && current.isNotEmpty && _ts(current) >= _ts(at)) return seen;
  final next = {...seen, key: at};
  if (next.length <= _seenMaxEntries) return next;
  final entries = jsSorted(next.entries, (MapEntry<String, String> a, MapEntry<String, String> b) => _ts(b.value) - _ts(a.value));
  return {for (final e in entries.take(_seenMaxEntries)) e.key: e.value};
}

void writeSeenMap(String? userId, Map<String, String> seen, MarketStorage? storage) {
  if (userId == null || userId.isEmpty || storage == null) return;
  try {
    storage.setItem(_seenStoragePrefix + userId, jsonEncode(seen));
  } catch (_) {
    // private mode / quota
  }
}

// ── Server calls (client injected so they stay testable) ──

Future<List<MarketMessage>?> loadMarketMessages(MarketDb client, String myId) async {
  try {
    final r = await client.select(MarketQuery(
      'marketplace_messages',
      columns: 'id, listing_id, sender_id, receiver_id, content, is_read, created_at',
      or: 'sender_id.eq.$myId,receiver_id.eq.$myId',
      order: (column: 'created_at', ascending: false),
      limit: marketInboxLimit,
    ));
    final data = r.data;
    if (r.error != null || data is! List) return null;
    return [for (final row in data) if (row is Map) MarketMessage.fromRow(row.cast<String, dynamic>())];
  } catch (_) {
    return null;
  }
}

/// Sets is_read on the counterpart's messages to me in this conversation (RLS: receiver may update).
Future<bool> markConversationRead(MarketDb client, String myId, String listingId, String counterpartId) async {
  try {
    final r = await client.update(
      'marketplace_messages',
      {'is_read': true},
      [eqF('listing_id', listingId), eqF('sender_id', counterpartId), eqF('receiver_id', myId)],
      or: 'is_read.is.null,is_read.eq.false',
    );
    return r.error == null;
  } catch (_) {
    return false;
  }
}
