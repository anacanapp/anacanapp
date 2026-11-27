// Ported from: (no React suite for the cakes screens) src/components/cakes/cakeUi.ts helpers and the
// CakesScreen / CakeOrderForm flows (quick add, card-only Epoint checkout through cake-checkout).
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/baby/hooks/use_children.dart' show ChildrenView, childrenProvider;
import 'package:anacan/features/commerce/cakes/cakes_data.dart';
import 'package:anacan/features/commerce/cakes/cakes_screen.dart';
import 'package:anacan/state/cake_cart_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import '../support.dart';

Map<String, dynamic> cake(String id, {String category = 'month', int? month = 1, num price = 35, bool custom = false, String? milestone}) => {
  'id': id, 'name': 'Bento $id', 'description': '10–11 sm, ~400 q, 1–3 nəfərlik. Vanil krem.', 'price': price, //
  'image_url': 'https://img/$id.jpg', 'images': <Object?>[], 'category': category, 'month_number': month, 'milestone_type': milestone,
  'milestone_label': null, 'is_active': true, 'sort_order': 1, 'has_custom_fields': custom, 'custom_field_labels': custom ? ['Ad'] : <Object?>[],
};

List<Override> _overrides(FakeCommerceBackend backend, List<String> opened) => commerceOverrides(
  backend,
  extra: [
    childrenProvider.overrideWith((ref) => const ChildrenView(children: [], selectedChild: null, loading: false, loadError: false)),
    cakeCheckoutOpenerProvider.overrideWithValue(opened.add),
  ],
);

void main() {
  group('cakeUi', () {
    test('reads size, weight and servings from the description and keeps the story', () {
      final specs = cakeSpecs('10–11 sm, ~400 q, 1–3 nəfərlik. Vanil krem.');
      expect((specs.size, specs.weight, specs.people), ('10–11 sm', '~400 q', '1–3'));
      expect(cakeStory('10–11 sm, ~400 q, 1–3 nəfərlik. Vanil krem.'), 'Vanil krem.');
      expect(cakeSpecs(null).size, isNull);
    });

    test('categories, quick add, money and bento detection', () {
      expect(categoryOf(Cake({'category': 'weird'})), 'milestone');
      expect(canQuickAdd(Cake(cake('a'))), true);
      expect(canQuickAdd(Cake(cake('b', custom: true))), false);
      expect(cakeMoney(35), '35 ₼');
      expect(cakeMoney(35.5), '35.50 ₼');
      expect(isBento(Cake(cake('c', category: 'milestone'))), true);
      expect(isBento(Cake({...cake('d', category: 'family'), 'name': 'Ad günü'})), false);
    });
  });

  group('CakesScreen', () {
    screenTest('quick add puts a cake without required fields in the cart', (tester) async {
      final backend = FakeCommerceBackend()..cakeRows = [cake('a'), cake('b', category: 'family', month: null, custom: true)];
      final opened = <String>[];
      late WidgetRef captured;
      await pumpApp(
        tester,
        Consumer(
          builder: (context, ref, _) {
            captured = ref;
            return const CakesScreen();
          },
        ),
        overrides: _overrides(backend, opened),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('cake-add-a')));
      await tester.pump();
      expect(captured.read(cakeCartProvider).totalItems, 1);
      // A cake with required fields opens its page instead.
      await tester.ensureVisible(find.byKey(const ValueKey('cake-add-b')));
      await tester.tap(find.byKey(const ValueKey('cake-add-b')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('cake-detail-name')), findsOneWidget);
      expect(captured.read(cakeCartProvider).totalItems, 1);
      await tester.pump(const Duration(seconds: 2));
    });

    screenTest('the order form pays by card through cake-checkout and clears the cart', (tester) async {
      final backend = FakeCommerceBackend(onInvoke: (_, _) => const DbResult<Object?>(data: {'checkout_url': 'https://epoint.az/pay/1'}));
      final opened = <String>[];
      var success = 0;
      late WidgetRef captured;
      await pumpApp(
        tester,
        Consumer(
          builder: (context, ref, _) {
            captured = ref;
            return CakeOrderForm(onBack: () {}, onSuccess: (_) => success++, now: () => DateTime(2026, 11, 27, 10));
          },
        ),
        overrides: _overrides(backend, opened),
      );
      captured.read(cakeCartProvider.notifier).addToCart(cake('a'), 2, {'Dad': 'Vanil'});
      await tester.pumpAndSettle();
      // Missing name → destructive toast, nothing sent.
      await tester.ensureVisible(find.byKey(const ValueKey('ck-submit')));
      await tester.tap(find.byKey(const ValueKey('ck-submit')));
      await tester.pump();
      expect(backend.invokeCalls, isEmpty);
      expect(find.text('Müştəri adı tələb olunur'), findsOneWidget);
      // Let the toast close (it sits over the button).
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('ck-cname')), 'Leyla');
      await tester.enterText(find.byKey(const ValueKey('ck-phone')), '+994501234567');
      await tester.enterText(find.byKey(const ValueKey('ck-addr')), 'Bakı');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const ValueKey('ck-submit')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ck-submit')));
      await tester.pumpAndSettle();
      final body = backend.invokeCalls.single.$2! as Map<String, Object?>;
      expect(backend.invokeCalls.single.$1, 'cake-checkout');
      expect(body['items'], [
        {
          'cake_id': 'a',
          'qty': 2,
          'photo_box': false,
          'fields': {'Dad': 'Vanil'},
        },
      ]);
      expect(body['delivery_date'], '2026-11-29');
      expect(body['slot'], '10:00–13:00');
      expect(body['mode'], 'delivery');
      expect(body.containsKey('cashback'), false);
      expect(opened, ['https://epoint.az/pay/1']);
      expect(captured.read(cakeCartProvider).items, isEmpty);
      expect(success, 1);
    });

    screenTest('a refused card payment keeps the cart', (tester) async {
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) => const DbResult<Object?>(error: FunctionException(status: 503, details: {'error': 'payments_unavailable'}), status: 503),
      );
      final opened = <String>[];
      late WidgetRef captured;
      await pumpApp(
        tester,
        Consumer(
          builder: (context, ref, _) {
            captured = ref;
            return CakeOrderForm(onBack: () {}, onSuccess: (_) {});
          },
        ),
        overrides: _overrides(backend, opened),
      );
      captured.read(cakeCartProvider.notifier).addToCart(cake('a'), 1, const {});
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ck-mode-pickup')));
      await tester.pump();
      await tester.enterText(find.byKey(const ValueKey('ck-cname')), 'Leyla');
      await tester.enterText(find.byKey(const ValueKey('ck-phone')), '+994501234567');
      await tester.ensureVisible(find.byKey(const ValueKey('ck-submit')));
      await tester.tap(find.byKey(const ValueKey('ck-submit')));
      await tester.pumpAndSettle();
      expect(find.text('Kartla ödəniş müvəqqəti əlçatan deyil. Bir az sonra yenidən yoxlayın.'), findsOneWidget);
      expect(opened, isEmpty);
      expect(captured.read(cakeCartProvider).items, hasLength(1));
    });
  });
}
