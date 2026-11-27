// Ported from: (no vitest file for AffiliateProducts.tsx / useAffiliateProducts.ts) — behaviour checks of the port:
// the stage filter, featured strip, categories and search, saving / unsaving with the saved count, the saved list,
// the product page (discount, pros / cons, specifications, store link, share) and the "Tezliklə" switch.
import 'package:anacan/core/data/app_settings.dart' show appSettingProvider;
import 'package:anacan/features/tools/affiliate/affiliate_data.dart';
import 'package:anacan/features/tools/affiliate/affiliate_products.dart';
import 'package:anacan/features/tools/health_common/health_common.dart' show healthLinkLauncherProvider;
import 'package:anacan/features/tools/media_common/media_ports.dart' show mediaShareProvider;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more_support/more_harness.dart';

Map<String, dynamic> product(String id, {String category = 'baby_gear', bool featured = false, num? price = 50, num? original, String name = 'Uşaq arabası'}) => {
      'id': id,
      'name': '$name $id',
      'name_az': null,
      'description': 'Yüngül və rahat',
      'category': category,
      'price': price,
      'original_price': original,
      'currency': 'AZN',
      'affiliate_url': 'https://shop.test/$id',
      'platform': 'trendyol',
      'image_url': null,
      'images': <String>[],
      'video_url': null,
      'store_name': null,
      'rating': 4.4,
      'review_count': 12,
      'review_summary': 'Valideynlər bəyənir',
      'life_stages': ['mommy'],
      'is_featured': featured,
      'is_active': true,
      'price_updated_at': null,
      'specifications': {'Çəki': '7 kq'},
      'pros': ['Yüngül'],
      'cons': ['Bahalı'],
      'tags': ['araba'],
    };

class FakeAffiliateDb implements AffiliateDb {
  List<Map<String, dynamic>> rows = [];
  final Set<String> savedIds = {};
  final List<String> calls = [];

  @override
  Future<List<Map<String, dynamic>>> products(String? lifeStage) async {
    calls.add('products:$lifeStage');
    return [for (final r in rows) Map<String, dynamic>.of(r)];
  }

  @override
  Future<List<Map<String, dynamic>>> saved(String userId) async => [
        for (final id in savedIds) {'id': 's-$id', 'created_at': '2026-11-27T10:00:00Z', 'product': rows.firstWhere((r) => r['id'] == id)},
      ];

  @override
  Future<bool> isSaved(String userId, String productId) async => savedIds.contains(productId);

  @override
  Future<void> save(String userId, String productId) async {
    calls.add('save:$userId:$productId');
    savedIds.add(productId);
  }

  @override
  Future<void> unsave(String userId, String productId) async {
    calls.add('unsave:$userId:$productId');
    savedIds.remove(productId);
  }
}

void main() {
  late MoreToolsHarness h;
  late FakeAffiliateDb db;
  late List<Uri> launched;
  late List<String?> shared;
  late bool enabled;

  setUp(() {
    h = MoreToolsHarness();
    enabled = true;
    db = FakeAffiliateDb()
      ..rows = [
        product('p1', featured: true, original: 80),
        product('p2', category: 'health', name: 'Termometr', price: null),
        product('p3', category: 'health', name: 'Krem'),
      ];
    launched = [];
    shared = [];
    h.extra.addAll([
      affiliateDbProvider.overrideWithValue(db),
      appSettingProvider('affiliate_section_enabled').overrideWith((ref) => enabled),
      healthLinkLauncherProvider.overrideWithValue((uri) async => launched.add(uri)),
      mediaShareProvider.overrideWithValue(({text, title, url}) async {
        shared.add(url);
        return true;
      }),
    ]);
  });

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Finder key(String k) => find.byKey(ValueKey(k));

  testWidgets('lists products with the featured strip, category tabs and search', (tester) async {
    await h.pump(tester, AffiliateProducts(onBack: () {}));
    await settle(tester);
    expect(key('affiliate-featured-p1'), findsOneWidget);
    expect(key('affiliate-card-p1'), findsOneWidget);
    expect(key('affiliate-card-p2'), findsOneWidget);
    expect(tester.widget<Text>(key('affiliate-count')).data, '(3)');
    expect(find.text('-38%'), findsWidgets);
    expect(find.text('Ətraflı'), findsOneWidget);
    await tester.ensureVisible(key('affiliate-cat-health'));
    await tester.tap(key('affiliate-cat-health'));
    await settle(tester);
    expect(key('affiliate-featured-p1'), findsNothing);
    expect(key('affiliate-card-p1'), findsNothing);
    expect(tester.widget<Text>(key('affiliate-count')).data, '(2)');
    await tester.ensureVisible(key('affiliate-cat-all'));
    await tester.tap(key('affiliate-cat-all'));
    await tester.enterText(key('affiliate-search'), 'krem');
    await settle(tester);
    expect(find.text('Axtarış nəticələri'), findsOneWidget);
    expect(key('affiliate-card-p3'), findsOneWidget);
    expect(key('affiliate-card-p2'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('saves and unsaves a product and shows it in the saved list', (tester) async {
    await h.pump(tester, AffiliateProducts(onBack: () {}));
    await settle(tester);
    await tester.tap(find.descendant(of: key('affiliate-card-p3'), matching: key('affiliate-save-p3')));
    await settle(tester);
    expect(db.calls, contains('save:u1:p3'));
    expect(find.text('Yadda saxlanıldı'), findsOneWidget);
    expect(key('affiliate-saved-count'), findsOneWidget);
    // The Radix toast sits over the top bar until it closes (5 s).
    await tester.pump(const Duration(seconds: 6));
    await tester.tap(key('affiliate-saved-open'));
    await settle(tester);
    expect(find.text('Saxlanılmış məhsullar'), findsOneWidget);
    expect(key('affiliate-card-p3'), findsOneWidget);
    await tester.tap(find.descendant(of: key('affiliate-card-p3'), matching: key('affiliate-save-p3')));
    await settle(tester);
    expect(db.calls, contains('unsave:u1:p3'));
    expect(find.text('Hələ heç nə saxlanmayıb'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('the product page shows details, opens the store and shares the link', (tester) async {
    await h.pump(tester, AffiliateProducts(onBack: () {}));
    await settle(tester);
    await tester.tap(key('affiliate-card-p1'));
    await settle(tester);
    expect(find.text('Məhsul haqqında'), findsWidgets);
    expect(find.text('Yüngül'), findsOneWidget);
    expect(find.text('Bahalı'), findsOneWidget);
    expect(find.text('7 kq'), findsOneWidget);
    expect(find.text('"Valideynlər bəyənir"'), findsOneWidget);
    await tester.tap(key('affiliate-go'));
    await tester.tap(key('affiliate-go-inline'));
    await tester.pump();
    expect(launched, [Uri.parse('https://shop.test/p1'), Uri.parse('https://shop.test/p1')]);
    await tester.tap(key('affiliate-share'));
    await settle(tester);
    expect(shared, ['https://shop.test/p1']);
    expect(find.text('Paylaşıldı!'), findsOneWidget);
    await tester.tap(key('affiliate-save-bar'));
    await settle(tester);
    expect(db.calls, contains('save:u1:p1'));
    expect(find.text('Saxlanıldı'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('shows "Tezliklə" when the section is switched off', (tester) async {
    enabled = false;
    await h.pump(tester, AffiliateProducts(onBack: () {}));
    await settle(tester);
    expect(find.text('Tezliklə'), findsOneWidget);
    expect(key('affiliate-card-p1'), findsNothing);
    await h.finish(tester);
  });
}
