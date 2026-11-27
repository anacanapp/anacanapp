// Ported from: src/lib/marketSafety.test.ts
import 'package:anacan/features/tools/market/market_db.dart';
import 'package:anacan/features/tools/market/market_safety.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_market_db.dart';

const me = 'me-1';
const seller = 'seller-1';

FakeMarketDb fakeClient([MarketResult result = const MarketResult()]) => FakeMarketDb(result: result);

void main() {
  group('buildMarketReport', () {
    test('builds a listing report without a reported user (the server fills the owner)', () {
      expect(
        buildMarketReport(me, const MarketReportInput(target: 'listing', listingId: 'l1', reportedUserId: seller, reason: 'scam', note: '  fake  ')),
        {'reporter_id': me, 'target_type': 'listing', 'listing_id': 'l1', 'reported_user_id': null, 'reason': 'scam', 'note': 'fake'},
      );
    });
    test('requires listing and user for a conversation, and refuses self reports or unknown reasons', () {
      expect(buildMarketReport(me, const MarketReportInput(target: 'conversation', listingId: 'l1', reason: 'spam')), isNull);
      expect(buildMarketReport(me, const MarketReportInput(target: 'user', reportedUserId: me, reason: 'spam')), isNull);
      expect(buildMarketReport(me, const MarketReportInput(target: 'user', reportedUserId: seller, reason: 'nope')), isNull);
      expect(buildMarketReport('', const MarketReportInput(target: 'user', reportedUserId: seller, reason: 'spam')), isNull);
      final row = buildMarketReport(me, const MarketReportInput(target: 'conversation', listingId: 'l1', reportedUserId: seller, reason: 'harassment', note: ''))!;
      expect(row['target_type'], 'conversation');
      expect(row['note'], isNull);
    });
    test('caps the note at 500 characters', () {
      expect(buildMarketReport(me, MarketReportInput(target: 'user', reportedUserId: seller, reason: 'other', note: 'x' * 900))?['note'], hasLength(500));
    });
    test('reports the conversation only once a message exists', () {
      expect(reportTargetForContact(0), 'user');
      expect(reportTargetForContact(3), 'conversation');
    });
  });

  group('submitMarketReport', () {
    const input = MarketReportInput(target: 'user', reportedUserId: seller, reason: 'spam');
    test('inserts into market_reports', () async {
      final f = fakeClient();
      expect(await submitMarketReport(f, me, input), 'sent');
      expect(f.calls[0], ['from', 'market_reports']);
      expect(f.calls[1][0], 'insert');
    });
    test('maps a duplicate pending report, a missing table and other errors', () async {
      expect(await submitMarketReport(fakeClient(const MarketResult(error: MarketDbError(code: '23505'))), me, input), 'duplicate');
      expect(await submitMarketReport(fakeClient(const MarketResult(error: MarketDbError(code: 'PGRST205'))), me, input), 'unavailable');
      expect(await submitMarketReport(fakeClient(const MarketResult(error: MarketDbError(code: '500'))), me, input), 'failed');
      expect(await submitMarketReport(FakeMarketDb(throwOnCall: Exception('offline')), me, input), 'failed');
    });
  });

  group('blocks', () {
    test('loads the blocked ids and fails quietly to an empty set', () async {
      final ok = fakeClient(const MarketResult(data: [{'blocked_id': 'a'}, {'blocked_id': 'b'}]));
      expect((await loadMarketBlocks(ok, me)).toList(), ['a', 'b']);
      expect(ok.calls, anyElement(equals(['eq', 'blocker_id', me])));
      expect(await loadMarketBlocks(fakeClient(const MarketResult(error: MarketDbError(code: '42P01'))), me), isEmpty);
      expect(await loadMarketBlocks(fakeClient(), null), isEmpty);
    });
    test('blocks (idempotent on duplicate) and never blocks oneself', () async {
      expect(await blockMarketUser(fakeClient(), me, seller), true);
      expect(await blockMarketUser(fakeClient(const MarketResult(error: MarketDbError(code: '23505'))), me, seller), true);
      expect(await blockMarketUser(fakeClient(const MarketResult(error: MarketDbError(code: '42501'))), me, seller), false);
      expect(await blockMarketUser(fakeClient(), me, me), false);
    });
    test('unblocks by blocker and blocked id', () async {
      final f = fakeClient();
      expect(await unblockMarketUser(f, me, seller), true);
      expect(f.calls, [
        ['from', 'market_blocks'],
        ['delete'],
        ['eq', 'blocker_id', me],
        ['eq', 'blocked_id', seller],
      ]);
    });
    test('hides blocked sellers listings (never my own) and blocked senders messages', () {
      final blocked = {seller};
      final listings = [
        {'id': '1', 'user_id': seller},
        {'id': '2', 'user_id': 'x'},
        {'id': '3', 'user_id': me},
      ];
      String owner(Map<String, String> l) => l['user_id']!;
      expect(visibleListings(listings, blocked, me, owner).map((l) => l['id']), ['2', '3']);
      expect(identical(visibleListings(listings, <String>{}, me, owner), listings), true);
      expect(visibleMessages([{'sender_id': seller}, {'sender_id': me}], blocked, (Map<String, String> m) => m['sender_id']!), [{'sender_id': me}]);
    });
    test('recognises the server block refusal', () {
      expect(isMarketBlockedError(const MarketDbError(code: '42501', message: 'MARKET_BLOCKED')), true);
      expect(isMarketBlockedError(const MarketDbError(code: '42501', message: 'new row violates row-level security')), false);
      expect(isMarketBlockedError(null), false);
    });
  });
}
