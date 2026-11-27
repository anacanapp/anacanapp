// Ported from: src/lib/marketInbox.test.ts
import 'package:anacan/features/tools/market/market_inbox.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_market_db.dart';

const me = 'me';
int _n = 0;

MarketMessage msg({String? id, String listingId = 'L1', String senderId = 'b1', String receiverId = me, String content = 'salam', Object? isRead = false, String createdAt = '2026-11-08T10:00:00Z'}) =>
    MarketMessage(id: id ?? 'm${++_n}', listingId: listingId, senderId: senderId, receiverId: receiverId, content: content, isRead: isRead as bool?, createdAt: createdAt);

class MemoryStorage implements MarketStorage {
  final Map<String, String> store = {};
  @override
  String? getItem(String key) => store[key];
  @override
  void setItem(String key, String value) => store[key] = value;
}

class BrokenStorage implements MarketStorage {
  @override
  String? getItem(String key) => throw Exception('denied');
  @override
  void setItem(String key, String value) => throw Exception('denied');
}

void main() {
  group('groupConversations', () {
    final messages = [
      // I sell L1; two buyers wrote to me
      msg(listingId: 'L1', senderId: 'b1', receiverId: me, createdAt: '2026-11-08T10:00:00Z'),
      msg(listingId: 'L1', senderId: me, receiverId: 'b1', createdAt: '2026-11-08T10:05:00Z', content: 'Bəli, var'),
      msg(listingId: 'L1', senderId: 'b1', receiverId: me, createdAt: '2026-11-08T10:06:00Z'),
      msg(listingId: 'L1', senderId: 'b2', receiverId: me, createdAt: '2026-11-08T09:00:00Z', isRead: true),
      // I buy on L9 (listing not visible to me any more)
      msg(listingId: 'L9', senderId: me, receiverId: 's9', createdAt: '2026-11-08T11:00:00Z'),
      msg(listingId: 'L9', senderId: 's9', receiverId: me, createdAt: '2026-11-08T11:30:00Z', isRead: null),
      // not mine at all
      msg(listingId: 'L5', senderId: 'x', receiverId: 'y'),
    ];
    const owners = {'L1': me};

    test('groups by listing + counterpart, newest first, with role and unread', () {
      final convs = groupConversations(messages, me, listingOwners: owners);
      expect(convs.map((c) => c.key), ['L9:s9', 'L1:b1', 'L1:b2']);
      final [buy, sell1, sell2] = convs;
      expect(buy.role, 'buyer');
      expect(buy.unread, 1);
      expect(sell1.role, 'seller');
      expect(sell1.count, 3);
      expect(sell1.unread, 2);
      expect(sell1.last.createdAt, '2026-11-08T10:06:00Z');
      expect(sell2.unread, 0);
      expect(totalUnread(convs), 3);
    });

    test('hides conversations with blocked users', () {
      final convs = groupConversations(messages, me, listingOwners: owners, blocked: {'b1'});
      expect(convs.map((c) => c.key), ['L9:s9', 'L1:b2']);
    });

    test('uses the per-device last-seen mark when is_read was not updated', () {
      final seen = {conversationKey('L1', 'b1'): '2026-11-08T10:00:00Z'};
      final convs = groupConversations(messages, me, listingOwners: owners, seen: seen);
      expect(convs.firstWhere((c) => c.key == 'L1:b1').unread, 1);
    });

    test('returns nothing without a user', () {
      expect(groupConversations(messages, null), isEmpty);
    });
  });

  group('isUnreadForMe', () {
    test('never counts my own messages', () {
      expect(isUnreadForMe(msg(senderId: me, receiverId: 'b1'), me), false);
    });
    test('respects is_read and the seen mark', () {
      expect(isUnreadForMe(msg(isRead: true), me), false);
      expect(isUnreadForMe(msg(), me, '2026-11-08T10:00:00Z'), false);
      expect(isUnreadForMe(msg(), me, '2026-11-08T09:59:59Z'), true);
    });
  });

  group('threadMessages', () {
    test('returns only that pair on that listing, oldest first, blocked senders hidden', () {
      final list = [
        msg(id: 'a', senderId: 'b1', createdAt: '2026-11-08T10:06:00Z'),
        msg(id: 'b', senderId: me, receiverId: 'b1', createdAt: '2026-11-08T10:01:00Z'),
        msg(id: 'c', senderId: 'b2'),
        msg(id: 'd', listingId: 'L2', senderId: 'b1'),
      ];
      expect(threadMessages(list, 'L1', 'b1', me).map((m) => m.id), ['b', 'a']);
      expect(threadMessages(list, 'L1', 'b1', me, {'b1'}).map((m) => m.id), ['b']);
    });
  });

  group('seen map', () {
    test('never moves backwards and round-trips through storage', () {
      final storage = MemoryStorage();
      var seen = markSeen({}, 'L1:b1', '2026-11-08T10:06:00Z');
      expect(identical(markSeen(seen, 'L1:b1', '2026-11-08T09:00:00Z'), seen), true);
      seen = markSeen(seen, 'L1:b1', '2026-11-08T11:00:00Z');
      writeSeenMap(me, seen, storage);
      expect(readSeenMap(me, storage), {'L1:b1': '2026-11-08T11:00:00Z'});
      expect(readSeenMap('other', storage), isEmpty);
    });
    test('survives broken storage', () {
      final storage = BrokenStorage();
      expect(readSeenMap(me, storage), isEmpty);
      expect(() => writeSeenMap(me, {}, storage), returnsNormally);
    });
  });

  group('markConversationRead', () {
    test('updates only the counterpart messages to me', () async {
      final client = FakeMarketDb();
      expect(await markConversationRead(client, me, 'L1', 'b1'), true);
      expect(client.calls.first, ['from', 'marketplace_messages']);
      expect(client.calls.sublist(1), [
        ['update', {'is_read': true}],
        ['eq', 'listing_id', 'L1'],
        ['eq', 'sender_id', 'b1'],
        ['eq', 'receiver_id', me],
        ['or', 'is_read.is.null,is_read.eq.false'],
      ]);
    });
  });

  test('previewText flattens and trims', () {
    expect(previewText('  a\n\n b '), 'a b');
    expect(previewText('x' * 100, 10), '${'x' * 9}…');
  });
}
