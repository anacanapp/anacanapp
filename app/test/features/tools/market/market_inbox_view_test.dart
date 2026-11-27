// Ported from: src/components/tools/market/MarketInbox.test.tsx
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/tools/market/market_inbox.dart';
import 'package:anacan/features/tools/market/market_inbox_view.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more_support/more_harness.dart';

const me = 'me';
int _n = 0;
MarketMessage m({String listingId = 'L1', String senderId = 'b1', String receiverId = me, String content = 'Hələ satılır?', String createdAt = '2026-11-08T10:00:00'}) =>
    MarketMessage(id: 'x${++_n}', listingId: listingId, senderId: senderId, receiverId: receiverId, content: content, isRead: false, createdAt: createdAt);

void main() {
  late MoreToolsHarness h;
  setUpAll(ensureDateLocales);
  setUp(() => h = MoreToolsHarness());

  final messages = [
    m(createdAt: '2026-11-08T10:00:00'),
    m(createdAt: '2026-11-08T10:02:00', content: 'Bu gün götürə bilərəm'),
    m(listingId: 'L2', senderId: me, receiverId: 's2', content: 'Salam, ölçüsü?', createdAt: '2026-11-07T09:00:00'),
  ];
  final conversations = groupConversations(messages, me, listingOwners: {'L1': me});
  final listings = {
    'L1': <String, dynamic>{'id': 'L1', 'user_id': me, 'title': 'Uşaq arabası', 'images': <String>[], 'category': 'stroller', 'is_free': false, 'price': 120, 'status': 'active'},
  };

  Finder inRow(String key, Finder f) => find.descendant(of: find.byKey(ValueKey('market-conv-$key')), matching: f);

  testWidgets('lists seller and buyer conversations with preview, time and unread badge', (tester) async {
    final opened = <MarketConversation>[];
    await h.pump(
      tester,
      MarketInbox(
        conversations: conversations,
        listings: listings,
        names: const {'b1': 'Aynur', 's2': 'Leyla'},
        myId: me,
        loading: false,
        failed: false,
        onOpen: opened.add,
        onRetry: () {},
        now: DateTime(2026, 11, 8, 12),
      ),
    );
    final rows = find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key! as ValueKey).value}'.startsWith('market-conv-'));
    expect(rows, findsNWidgets(2));
    // newest first: my listing, a buyer wrote twice
    expect(tester.widget(rows.first).key, const ValueKey('market-conv-L1:b1'));
    expect(inRow('L1:b1', find.text('Uşaq arabası')), findsOneWidget);
    expect(inRow('L1:b1', find.text('Alıcı')), findsOneWidget);
    expect(inRow('L1:b1', find.textContaining('Aynur')), findsOneWidget);
    expect(inRow('L1:b1', find.text('Bu gün götürə bilərəm')), findsOneWidget);
    expect(inRow('L1:b1', find.text('10:02')), findsOneWidget);
    expect(tester.widget<Text>(find.descendant(of: find.byKey(const ValueKey('market-unread-badge')), matching: find.byType(Text))).data, '2');
    expect(find.bySemanticsLabel(RegExp('2 oxunmamış')), findsOneWidget);
    // listing I cannot see: generic title, I am the buyer, my own last message
    expect(inRow('L2:s2', find.text('Elan')), findsOneWidget);
    expect(inRow('L2:s2', find.text('Satıcı')), findsOneWidget);
    expect(inRow('L2:s2', find.text('Siz: Salam, ölçüsü?')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('market-conv-L2:s2')));
    expect(opened.single.listingId, 'L2');
    expect(opened.single.counterpartId, 's2');
    expect(opened.single.role, 'buyer');
    await h.finish(tester);
  });

  testWidgets('shows the empty state', (tester) async {
    await h.pump(tester, MarketInbox(conversations: const [], listings: const {}, names: const {}, myId: me, loading: false, failed: false, onOpen: (_) {}, onRetry: () {}));
    expect(find.text('Hələ mesaj yoxdur'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('offers a retry when loading failed', (tester) async {
    var retried = 0;
    await h.pump(tester, MarketInbox(conversations: const [], listings: const {}, names: const {}, myId: me, loading: false, failed: true, onOpen: (_) {}, onRetry: () => retried++));
    await tester.tap(find.text('Yenidən cəhd et'));
    expect(retried, 1);
    await h.finish(tester);
  });
}
