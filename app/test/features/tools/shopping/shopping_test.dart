// Ported from: src/hooks/useShoppingItems.push.test.tsx, src/components/tools/ToolIconButtons.a11y.test.tsx
//              (ShoppingList case)
import 'dart:ui' show Tristate;

import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/features/tools/shopping/shopping_data.dart';
import 'package:anacan/features/tools/shopping/shopping_list.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

class _RecordingPush implements ChatPushSender {
  final List<SendPushPayload> sent = [];
  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    sent.add(payload);
    return const SendPushResult(ok: true, sent: 1);
  }
}

const partnerId = '22222222-2222-4222-8222-222222222222';

Map<String, dynamic> item(String id, String name, bool checked) =>
    {'id': id, 'user_id': testUserId, 'partner_id': null, 'name': name, 'quantity': 1, 'is_checked': checked, 'priority': 'medium', 'added_by': null, 'created_at': '2026-11-08T08:00:00Z'};

void main() {
  toolTest('binds a shopping push to the item row returned by the insert', (tester) async {
    final push = _RecordingPush();
    final h = HealthHarness(
      profile: {'name': 'Actor', 'life_stage': 'mommy', 'linked_partner_id': '33333333-3333-4333-8333-333333333333'},
      tables: {
        'profiles': [
          {'id': '33333333-3333-4333-8333-333333333333', 'user_id': partnerId},
        ],
      },
    );
    await h.pump(tester, ShoppingList(onBack: () {}), extra: [chatPushSenderProvider.overrideWithValue(push)]);
    final container = ProviderScope.containerOf(tester.element(find.byType(ShoppingList)));
    final result = await container.read(shoppingItemsProvider.notifier).addItem(name: 'Milk');
    await settle(tester);

    final inserted = h.db.rows('shopping_items').single;
    expect(result.data?['id'], inserted['id']);
    expect(inserted['partner_id'], partnerId);
    expect(push.sent, hasLength(1));
    expect(push.sent.single.userId, partnerId);
    expect(push.sent.single.data, {'type': 'shopping_list', 'context': 'partner', 'interactionId': inserted['id']});

    // Max once a day.
    await container.read(shoppingItemsProvider.notifier).addItem(name: 'Bread');
    expect(push.sent, hasLength(1));
  });

  group('tool icon buttons have accessible names', () {
    toolTest('ShoppingList: back, add, toggle and delete buttons are named', (tester) async {
      final h = HealthHarness(tables: {
        'shopping_items': [item('a', 'Bez', false), item('b', 'Süd', true)],
      });
      await h.pump(tester, ShoppingList(onBack: () {}));
      expect(find.bySemanticsLabel('Geri'), findsWidgets);
      expect(semanticsWidget('Əlavə et'), findsOneWidget);
      expect(tester.getSemantics(semanticsWidget('Bez')).flagsCollection.isToggled, Tristate.isFalse);
      expect(semanticsWidget('Sil'), findsNWidgets(1));

      await tester.tap(find.textContaining('Alınmış məhsullar'));
      await settle(tester);
      expect(tester.getSemantics(semanticsWidget('Süd')).flagsCollection.isToggled, Tristate.isTrue);
      expect(semanticsWidget('Sil'), findsNWidgets(2));
    });
  });

  toolTest('toggling an item moves it to the bought section', (tester) async {
    final h = HealthHarness(tables: {
      'shopping_items': [item('a', 'Bez', false)],
    });
    await h.pump(tester, ShoppingList(onBack: () {}));
    await tester.tap(semanticsWidget('Bez'));
    await settle(tester);
    expect(h.db.rows('shopping_items').single['is_checked'], isTrue);
    expect(find.textContaining('Alınmış məhsullar (1)'), findsOneWidget);
  });
}
