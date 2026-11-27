// Ported from: (no vitest file for SecondHandMarket.tsx) — behaviour checks of the port: listings (active only,
// category, search, blocked sellers hidden), creating a pending listing with uploaded images, contacting a seller,
// reporting and blocking, and the inbox (unread badge, opening a thread marks it read, replying).
import 'dart:typed_data';

import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/tools/baby_album/image_compress.dart';
import 'package:anacan/features/tools/market/market_db.dart';
import 'package:anacan/features/tools/market/second_hand_market.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more_support/more_harness.dart';
import 'support/fake_market_db.dart';

Map<String, dynamic> listing(String id, {String userId = 's1', String title = 'Uşaq arabası', String category = 'stroller', bool free = false, num price = 120, String status = 'active', String created = '2026-11-20T10:00:00Z'}) => {
      'id': id,
      'user_id': userId,
      'title': title,
      'description': 'Az işlənib',
      'category': category,
      'condition': 'good',
      'price': price,
      'is_free': free,
      'age_range': '0-3 ay',
      'images': <String>[],
      'location_city': 'Bakı',
      'status': status,
      'created_at': created,
    };

void main() {
  late MoreToolsHarness h;
  late FakeMarketDb db;
  late List<UploadFile> picks;
  setUpAll(ensureDateLocales);

  setUp(() {
    h = MoreToolsHarness();
    db = FakeMarketDb();
    picks = [];
    db.tables['marketplace_listings'] = [
      listing('L1'),
      listing('L2', title: 'Bodi dəsti', category: 'clothing', free: true, price: 0, created: '2026-11-21T10:00:00Z'),
      listing('L3', userId: 's2', title: 'Gizli', status: 'pending'),
    ];
    h.extra.addAll([
      marketDbProvider.overrideWithValue(db),
      marketProfileNamesProvider.overrideWithValue((ids) async => {for (final id in ids) id: 'Ad $id'}),
      marketImagePickerProvider.overrideWithValue(() async => picks),
      marketNowProvider.overrideWithValue(() => 1700000000000),
    ]);
  });

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> open(WidgetTester tester) async {
    await h.pump(tester, SecondHandMarket(onBack: () {}));
    await settle(tester);
  }

  Finder key(String k) => find.byKey(ValueKey(k));

  testWidgets('lists the active listings newest first, filters by category and search', (tester) async {
    await open(tester);
    expect(key('market-listing-L1'), findsOneWidget);
    expect(key('market-listing-L2'), findsOneWidget);
    expect(key('market-listing-L3'), findsNothing);
    expect(db.calls, anyElement(equals(['eq', 'status', 'active'])));
    await tester.tap(key('market-cat-clothing'));
    await settle(tester);
    expect(key('market-listing-L1'), findsNothing);
    expect(key('market-listing-L2'), findsOneWidget);
    await tester.tap(key('market-cat-all'));
    await settle(tester);
    await tester.enterText(key('market-search'), 'araba');
    await settle(tester);
    expect(key('market-listing-L1'), findsOneWidget);
    expect(key('market-listing-L2'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('creates a pending listing with the uploaded images', (tester) async {
    picks = [UploadFile(bytes: Uint8List.fromList([1, 2, 3]), name: 'photo.jpg', type: 'image/jpeg')];
    await open(tester);
    await tester.tap(key('market-create-open'));
    await settle(tester);
    // An empty title is refused.
    await tester.tap(key('market-form-submit'));
    await settle(tester);
    expect(find.text('Başlıq daxil edin'), findsOneWidget);
    await tester.tap(key('market-add-image'));
    await settle(tester);
    expect(db.uploads, ['community-media/u1/1700000000000-0.jpg']);
    await tester.enterText(key('market-form-title'), 'Oyuncaq ayı');
    await tester.tap(key('market-form-cat-toys'));
    await tester.tap(key('market-form-paid'));
    await settle(tester);
    await tester.enterText(key('market-form-price'), '15');
    await tester.tap(key('market-form-submit'));
    await settle(tester);
    final (table, row) = db.inserted.single;
    expect(table, 'marketplace_listings');
    expect(row['title'], 'Oyuncaq ayı');
    expect(row['category'], 'toys');
    expect(row['price'], 15);
    expect(row['is_free'], false);
    expect(row['status'], 'pending');
    expect(row['user_id'], 'u1');
    expect(row['images'], ['https://cdn.test/community-media/u1/1700000000000-0.jpg']);
    expect(key('market-form-submit'), findsNothing);
    expect(find.text('Elan yaradıldı və təsdiq üçün göndərildi'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('contacts the seller from the detail and sends a message', (tester) async {
    await open(tester);
    await tester.tap(key('market-listing-L1'));
    await settle(tester);
    expect(find.text('Az işlənib'), findsOneWidget);
    await tester.tap(key('market-contact-open'));
    await settle(tester);
    expect(find.text('Satıcıya mesaj göndərin'), findsOneWidget);
    await tester.enterText(key('market-thread-input'), '  Hələ satılır?  ');
    await tester.pump();
    await tester.tap(key('market-thread-send'));
    await settle(tester);
    final (table, row) = db.inserted.single;
    expect(table, 'marketplace_messages');
    expect(row, {'listing_id': 'L1', 'sender_id': 'u1', 'receiver_id': 's1', 'content': 'Hələ satılır?'});
    expect(find.text('Hələ satılır?'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('reports a listing and blocks its seller (the listing disappears)', (tester) async {
    await open(tester);
    await tester.tap(key('market-listing-L1'));
    await settle(tester);
    await tester.tap(key('market-report-open'));
    await settle(tester);
    await tester.tap(key('market-reason-scam'));
    await tester.pump();
    await tester.tap(key('market-report-send'));
    await settle(tester);
    final (table, row) = db.inserted.single;
    expect(table, 'market_reports');
    expect(row['target_type'], 'listing');
    expect(row['listing_id'], 'L1');
    expect(row['reported_user_id'], isNull);
    expect(find.text('Şikayətiniz göndərildi. Moderatorlar baxacaq.'), findsOneWidget);
    expect(key('market-report-send'), findsNothing);
    await tester.tap(key('market-block-open'));
    await settle(tester);
    await tester.tap(key('market-block-confirm'));
    await settle(tester);
    expect(db.inserted.last.$1, 'market_blocks');
    expect(db.inserted.last.$2, {'blocker_id': 'u1', 'blocked_id': 's1'});
    expect(key('market-contact-open'), findsNothing);
    expect(key('market-listing-L1'), findsNothing);
    expect(find.text('İstifadəçi bloklandı'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('the inbox shows unread conversations; opening one marks it read and a reply is sent', (tester) async {
    db.tables['marketplace_messages'] = [
      {'id': 'm1', 'listing_id': 'L1', 'sender_id': 'b1', 'receiver_id': 'u1', 'content': 'Salam', 'is_read': false, 'created_at': '2026-11-26T10:00:00Z'},
      {'id': 'm2', 'listing_id': 'L1', 'sender_id': 'b1', 'receiver_id': 'u1', 'content': 'Var?', 'is_read': false, 'created_at': '2026-11-26T10:01:00Z'},
    ];
    db.tables['marketplace_listings']!.add(listing('L9', userId: 'u1', title: 'Mənim arabam', status: 'active'));
    db.tables['marketplace_messages']!.first['listing_id'] = 'L9';
    db.tables['marketplace_messages']!.last['listing_id'] = 'L9';
    await open(tester);
    expect(key('market-inbox-badge'), findsOneWidget);
    await tester.tap(key('market-tab-inbox'));
    await settle(tester);
    expect(key('market-conv-L9:b1'), findsOneWidget);
    expect(find.textContaining('Ad b1'), findsWidgets);
    await tester.tap(key('market-conv-L9:b1'));
    await settle(tester);
    expect(db.calls, anyElement(equals(['update', {'is_read': true}])));
    expect(h.store.getItem('anacan.market.inbox.seen.v1:u1'), contains('L9:b1'));
    expect(key('market-inbox-badge'), findsNothing);
    await tester.enterText(key('market-thread-input'), 'Bəli, var');
    await tester.pump();
    await tester.tap(key('market-thread-send'));
    await settle(tester);
    expect(db.inserted.single.$2, {'listing_id': 'L9', 'sender_id': 'u1', 'receiver_id': 'b1', 'content': 'Bəli, var'});
    await h.finish(tester);
  });
}
