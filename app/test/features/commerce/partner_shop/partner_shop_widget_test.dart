// Ported from: src/components/partner-shop/PartnerShop.test.tsx
import 'package:anacan/features/commerce/partner_shop/partner_shop.dart';
import 'package:anacan/features/commerce/partner_shop/partner_shop_data.dart';
import 'package:anacan/features/commerce/partner_shop/partner_shop_ui.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';
import 'partner_shop_test.dart' show catalog, importRows, olivia;

class _Tracker extends ShopTracker {
  _Tracker() : super(() => FakeCommerceBackend());
  final List<(List<String>, String, String)> events = [];
  @override
  void event(List<String> ids, String event, String placement) => events.add((ids, event, placement));
  @override
  void impressions(List<String> ids, String placement) {}
}

Storefront _store() {
  final rows = importRows('olivia');
  return storefrontFromRpc({
    'partners': [olivia],
    'products': [
      for (var i = 0; i < rows.length; i++) {...rows[i], 'id': 'p$i', 'partner_id': 'p1', 'sales_count': 100 - i},
    ],
  });
}

List<Override> _overrides(_Tracker tracker, {bool visible = true, ShopStageInput stage = const ShopStageInput(lifeStage: 'bump', pregnancyWeek: 35)}) => [
  ...commerceOverrides(FakeCommerceBackend(), isAdmin: true),
  partnerStorefrontProvider.overrideWithValue(StorefrontView(data: visible ? _store() : Storefront.empty)),
  shopTrackerProvider.overrideWithValue(tracker),
  shopStageProvider.overrideWithValue(stage),
  partnerExternalOpenerProvider.overrideWithValue((_) {}),
];

void main() {
  group('Partner storefront', () {
    screenTest('shows the hospital bag hero at week 35, partner marks and adds the whole bundle', (tester) async {
      final tracker = _Tracker();
      await pumpApp(tester, const PartnerShopSection(), overrides: _overrides(tracker));
      await tester.pump();
      expect(find.text('Xəstəxana çantası bir yerdə'), findsOneWidget);
      expect(find.text('Olivia ilə'), findsOneWidget);
      expect(find.bySemanticsLabel('Olivia').evaluate().length, greaterThan(3));
      await tester.tap(find.text('Hamısını səbətə at'));
      await tester.pump();
      expect(find.text('Səbətdədir ✓'), findsOneWidget);
      final bag = (catalog('olivia')['collections'] as Map)['bag'] as List;
      expect(find.bySemanticsLabel('Partnyor səbəti, ${bag.length} məhsul'), findsOneWidget);
      expect(tracker.events.any((e) => e.$2 == 'bundle' && e.$3 == 'shop_hero'), true);
    });

    screenTest('product sheet says "by" with the partner logo and opens the partner site', (tester) async {
      final tracker = _Tracker();
      await pumpApp(tester, const PartnerShopSection(), overrides: _overrides(tracker));
      await tester.pump();
      await tester.tap(find.bySemanticsLabel(RegExp('Butterfly Maxi Thick')).first);
      await tester.pumpAndSettle();
      expect(find.text('by'), findsOneWidget);
      expect(find.bySemanticsLabel('Olivia'), findsWidgets);
      expect(find.text('Olivia saytında bax'), findsOneWidget);
    });

    screenTest('renders nothing when the server returns no partner products', (tester) async {
      final tracker = _Tracker();
      await pumpApp(
        tester,
        const Column(
          children: [
            PartnerShopSection(),
            PartnerHomeCard(lifeStage: 'mommy', babyMonths: 7),
          ],
        ),
        overrides: _overrides(tracker, visible: false),
      );
      await tester.pump();
      expect(find.byType(Text), findsNothing);
    });

    screenTest('home card follows the baby age and opens the shop', (tester) async {
      final tracker = _Tracker();
      final opened = <String>[];
      await pumpApp(
        tester,
        PartnerHomeCard(lifeStage: 'mommy', babyMonths: 7, onOpen: opened.add),
        overrides: _overrides(tracker),
      );
      await tester.pump();
      await tester.tap(find.text('İlk diş vaxtı'));
      expect(opened, ['shop']);
    });
  });
}
