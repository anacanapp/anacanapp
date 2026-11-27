// Ported from: src/components/tools/market/useMarketInbox.ts
//
// Loads my market conversations (as buyer and as seller). There is no realtime subscription (the buyer chat never
// had one and marketplace_messages is not in a realtime publication), so the inbox refreshes on mount, when the app
// becomes visible again (resume), and after sending or opening a thread.
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart' show jsToIsoString;
import '../../../state/local_store.dart';
import 'market_db.dart';
import 'market_inbox.dart';

/// The WebView localStorage behind the "last seen" marks.
class LocalMarketStorage implements MarketStorage {
  const LocalMarketStorage(this.store);
  final LocalStore store;
  @override
  String? getItem(String key) => store.getItem(key);
  @override
  void setItem(String key, String value) => store.setItem(key, value);
}

/// `useMarketInbox(myId, blocked)`: owned by the market screen; call [dispose] with it.
class MarketInboxController extends ChangeNotifier {
  MarketInboxController({
    required this.db,
    required this.myId,
    required this.storage,
    required this.loadNames,
    Stream<void>? resumes,
  }) : seen = readSeenMap(myId, storage) {
    _resume = resumes?.listen((_) => unawaited(refresh()));
    unawaited(refresh());
  }

  final MarketDb db;
  final String? myId;
  final MarketStorage? storage;
  final Future<Map<String, String>> Function(List<String> userIds) loadNames;
  StreamSubscription<void>? _resume;

  List<MarketMessage> messages = [];
  Map<String, Map<String, dynamic>> listings = {};
  Map<String, String> names = {};
  Map<String, String> seen;
  bool loading = false;
  bool failed = false;
  int _seq = 0;
  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> refresh() async {
    final me = myId;
    if (me == null || me.isEmpty) {
      messages = [];
      _notify();
      return;
    }
    final run = ++_seq;
    loading = true;
    _notify();
    final rows = await loadMarketMessages(db, me);
    if (run != _seq || _disposed) return;
    loading = false;
    if (rows == null) {
      failed = true;
      _notify();
      return;
    }
    failed = false;
    messages = rows;
    _notify();
    final listingIds = {for (final m in rows) m.listingId}.toList();
    final people = {for (final m in rows) m.senderId == me ? m.receiverId : m.senderId}.toList();
    if (listingIds.isNotEmpty) {
      try {
        final r = await db.select(MarketQuery(
          'marketplace_listings',
          columns: 'id, user_id, title, images, category, is_free, price, status',
          filters: [inF('id', listingIds)],
        ));
        final data = r.data;
        if (run == _seq && data is List) {
          listings = {for (final l in data) if (l is Map) '${l['id']}': l.cast<String, dynamic>()};
          _notify();
        }
      } catch (_) {
        // titles fall back to a generic label
      }
    }
    if (people.isNotEmpty) {
      unawaited(loadNames(people).then((n) {
        if (run == _seq) {
          names = n;
          _notify();
        }
      }).catchError((Object _) {}));
    }
  }

  Map<String, String> get listingOwners => {for (final l in listings.values) '${l['id']}': '${l['user_id']}'};

  List<MarketConversation> conversations(Set<String> blocked) =>
      groupConversations(messages, myId, blocked: blocked, listingOwners: listingOwners, seen: seen);

  int unread(Set<String> blocked) => totalUnread(conversations(blocked));

  /// Marks a conversation read on the server (is_read) and on this device (last seen).
  void markRead(String listingId, String counterpartId, [String? lastAt]) {
    final me = myId;
    if (me == null || me.isEmpty) return;
    final key = '$listingId:$counterpartId';
    final at = lastAt ?? jsToIsoString(DateTime.now());
    final next = markSeen(seen, key, at);
    if (!identical(next, seen)) {
      seen = next;
      writeSeenMap(me, next, storage);
    }
    messages = [
      for (final m in messages)
        m.listingId == listingId && m.senderId == counterpartId && m.receiverId == me && m.isRead != true ? m.copyWith(isRead: true) : m,
    ];
    _notify();
    unawaited(markConversationRead(db, me, listingId, counterpartId));
  }

  @override
  void dispose() {
    _disposed = true;
    _resume?.cancel();
    super.dispose();
  }
}
