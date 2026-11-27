// Ported from: (no React suite for the Aptek UI; src/lib/aptek-pricing.test.ts and src/lib/aptek-offers.test.ts are
// ported in test/domain/aptek/aptek_test.dart). Covers useAptek.ts (aptekErrorKey, cart, place_aptek_order) and the
// AptekEntry / AptekScreen flows against a fake backend. Copy renders as its ui-copy key here (no dictionaries).
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/aptek/aptek_data.dart';
import 'package:anacan/features/commerce/aptek/aptek_entry.dart';
import 'package:anacan/features/commerce/aptek/aptek_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../support.dart';

Map<String, dynamic> product(
  String id, {
  String? sku,
  String name = 'Butulka',
  num price = 12,
  String kind = 'bottles',
  List<String> tags = const [],
  int? minAge,
  bool own = false,
}) => {
  'id': id, 'sku': sku, 'name': name, 'description': null, 'category': 'bottles', 'price': price, 'original_price': null, //
  'image_url': 'https://img/$id.png', 'images': null, 'brand': 'Philips', 'kind': kind, 'min_age_months': minAge, 'tags': tags,
  'sales_count': 10, 'stock': 5, 'cashback_own': own,
};

FakeCommerceBackend _backend({Map<String, Object?>? config, Object? orderResult, Object? orderError}) {
  final b = FakeCommerceBackend(
    onRpc: (fn, params) {
      if (fn == 'get_aptek_config') {
        return DbResult<Object?>(
          data:
              config ??
              {
                'enabled': true,
                'countries': ['AZ'],
                'placements': <String, Object?>{},
                'bundles': <Object?>[],
              },
        );
      }
      if (fn == 'place_aptek_order') return orderError != null ? DbResult<Object?>(error: orderError) : DbResult<Object?>(data: orderResult);
      return const DbResult<Object?>(data: null);
    },
  );
  b.products = [
    product('a1', sku: '1', name: 'Anti-colic bottle', tags: ['anti_colic'], minAge: 0, own: true),
    product('a2', sku: '2', name: 'Silicone cup', kind: 'cups', minAge: 6),
  ];
  return b;
}

void main() {
  group('useAptek', () {
    test('maps checkout RPC errors to copy keys', () {
      expect(aptekErrorKey(const PostgrestException(message: 'APTEK_BAD_COUPON')), 'coupon_invalid');
      expect(aptekErrorKey({'message': 'x APTEK_OUT_OF_STOCK y'}), 'err_stock');
      expect(aptekErrorKey({'message': 'APTEK_BAD_PHONE'}), 'err_phone');
      expect(aptekErrorKey({'message': 'APTEK_BAD_ADDRESS'}), 'err_address');
      expect(aptekErrorKey({'message': 'APTEK_DISABLED'}), 'err_disabled');
      expect(aptekErrorKey(Exception('boom')), 'err_generic');
    });

    test('maps product rows like the hook (numbers, images fallback, tags, cashback_own)', () {
      final p = AptekProduct.fromRow({...product('x'), 'price': '4.5', 'original_price': '6', 'images': <Object?>[], 'cashback_own': 'yes'});
      expect(p.price, 4.5);
      expect(p.originalPrice, 6);
      expect(p.images, ['https://img/x.png']);
      expect(p.cashbackOwn, false);
      expect(discountPct(p), 25);
    });

    test('formats AZN without decimals for whole amounts', () {
      expect(formatAzn(12, 'az'), '12\u00a0₼');
      expect(formatAzn(12.5, 'az'), '12,50\u00a0₼');
    });
  });

  group('AptekEntry', () {
    screenTest('search shows product hits and opens the product page', (tester) async {
      final backend = _backend();
      final opened = <String>[];
      var closed = 0;
      await pumpApp(
        tester,
        AptekSearchResults(query: 'bottle', close: () => closed++, onOpen: opened.add),
        overrides: commerceOverrides(backend),
      );
      await tester.pumpAndSettle();
      expect(find.text('Anti-colic bottle'), findsOneWidget);
      expect(find.text('Silicone cup'), findsNothing);
      await tester.tap(find.text('Anti-colic bottle'));
      expect(closed, 1);
      expect(opened, ['aptek/p:a1']);
    });

    screenTest('search is hidden when the placement is switched off', (tester) async {
      final backend = _backend(
        config: {
          'enabled': true,
          'countries': ['AZ'],
          'placements': {'search': false},
        },
      );
      await pumpApp(
        tester,
        AptekSearchResults(query: 'bottle', close: () {}, onOpen: (_) {}),
        overrides: commerceOverrides(backend),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('aptek-search-results')), findsNothing);
    });

    screenTest('home card offers anti-colic products for a 2-month-old and opens the store', (tester) async {
      final backend = _backend();
      final opened = <String>[];
      await pumpApp(
        tester,
        AptekHomeCard(stage: 'mommy', babyMonths: 2, babyName: 'Aylin', onOpen: opened.add),
        overrides: commerceOverrides(backend),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('aptek-offer')), findsOneWidget);
      expect(find.text('offer_colic_t'), findsOneWidget);
      expect(find.text('Anti-colic bottle'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('aptek-see-store')));
      expect(opened, ['aptek']);
    });

    screenTest('home card is hidden when the store is not available', (tester) async {
      final backend = _backend(config: {'enabled': false});
      await pumpApp(tester, const AptekHomeCard(stage: 'bump'), overrides: commerceOverrides(backend));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('aptek-offer')), findsNothing);
      expect(find.byKey(const ValueKey('aptek-banner')), findsNothing);
    });
  });

  group('AptekScreen', () {
    screenTest('adds a product, checks out and places the order', (tester) async {
      final backend = _backend(orderResult: {'order_id': 'o1', 'order_number': 'AP-1001', 'total': 15});
      await pumpApp(
        tester,
        AptekScreen(onBack: () {}, initialScreen: 'aptek/p:a1'),
        overrides: commerceOverrides(backend),
        scroll: false,
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('aptek-product-name')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('aptek-add-to-cart')));
      await tester.pumpAndSettle();
      expect(backend.cartRows.single['product_id'], 'a1');
      await tester.tap(find.byKey(const ValueKey('aptek-cart-button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('aptek-line-a1')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('aptek-checkout')));
      await tester.pumpAndSettle();
      // Validation first.
      await tester.tap(find.byKey(const ValueKey('aptek-place-order')));
      await tester.pumpAndSettle();
      expect(find.text('err_phone'), findsOneWidget);
      expect(find.text('err_address'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('aptek-address')), 'Bakı, Nizami küç. 10');
      await tester.enterText(find.byKey(const ValueKey('aptek-phone')), '+994 50 123 45 67');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('aptek-place-order')));
      await tester.pumpAndSettle();
      final call = backend.rpcCalls.firstWhere((c) => c.$1 == 'place_aptek_order');
      expect(call.$2!['p_items'], [
        {'product_id': 'a1', 'quantity': 1},
      ]);
      expect(call.$2!['p_payment'], 'card_on_delivery');
      expect(call.$2!['p_slot'], 'today_evening');
      expect(call.$2!['p_phone'], '+994 50 123 45 67');
      expect(call.$2!.containsKey('p_cashback'), false);
      expect(find.text('success_text'), findsOneWidget);
    });

    screenTest('shows the server error of a failed order', (tester) async {
      final backend = _backend(orderError: const PostgrestException(message: 'APTEK_OUT_OF_STOCK'));
      backend.cartRows = [
        {'id': 'c1', 'product_id': 'a2', 'quantity': 2},
      ];
      await pumpApp(
        tester,
        AptekScreen(onBack: () {}, initialScreen: 'aptek/cart'),
        overrides: commerceOverrides(backend),
        scroll: false,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('aptek-checkout')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('aptek-address')), 'Bakı, Nizami küç. 10');
      await tester.enterText(find.byKey(const ValueKey('aptek-phone')), '+994501234567');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('aptek-place-order')));
      await tester.pumpAndSettle();
      expect(find.text('err_stock'), findsOneWidget);
    });
  });
}
