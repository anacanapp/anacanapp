// Ported from: src/lib/partner-shop.test.ts
//
// `oliviaImportRows` / `rossmannImportRows` are admin-panel code (web only); the rows are rebuilt here from the
// bundled catalog JSON the same way, so the catalog checks still run and the storefront cases use real rows.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/commerce/partner_shop/partner_catalog.g.dart';
import 'package:anacan/features/commerce/partner_shop/partner_shop.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> catalog(String slug) => jsonDecode(File('../src/data/$slug-products.json').readAsStringSync()) as Map<String, dynamic>;

/// `oliviaImportRows()` / `rossmannImportRows()`.
List<Map<String, Object?>> importRows(String slug) => [
  for (final p in (catalog(slug)['products'] as List).cast<Map<String, dynamic>>())
    {
      'name': p['name'],
      'description': (p['why'] as Map)[(p['collections'] as List).first],
      'price': '${p['price']}',
      'original_price': p['original_price'] != null ? '${p['original_price']}' : '',
      'image_url': p['image'],
      'source_url': p['url'],
      'sku': p['sku'],
      'tags': p['collections'],
      'listed': true,
    },
];

const Map<String, Object?> olivia = {
  'id': 'p1', 'slug': 'olivia', 'name': 'Olivia', 'logo_url': '/partners/olivia/logo.png', 'icon_url': '/partners/olivia/icon.png', //
  'website_url': 'https://olivia.az', 'brand_color': '#9B16D9', 'status': 'admin_only',
};

void main() {
  group('partner shop', () {
    test('imports the Olivia catalog with valid collections and unique SKUs', () {
      final rows = importRows('olivia');
      expect(rows, hasLength((catalog('olivia')['products'] as List).length));
      for (final r in rows) {
        expect(r['image_url'], matches(RegExp(r'^/olivia/[\w-]+\.webp$')));
        expect(r['source_url'], matches(RegExp(r'^https://')));
        expect((r['tags'] as List).isNotEmpty, true);
        expect((r['tags'] as List).every(shopCollections.contains), true);
      }
      final skus = rows.map((r) => r['sku']).toSet();
      expect(skus.length, rows.length);
      for (final list in (catalog('olivia')['collections'] as Map).values) {
        for (final s in list as List) {
          expect(skus.contains(s), true);
        }
      }
      // The bundled curated lines match the catalog.
      expect(kCuratedPartnerCatalog['olivia']!.length, rows.length);
    });

    test('imports the Rossmann catalog within the product form limits', () {
      final rows = importRows('rossmann');
      expect(rows.length, (catalog('rossmann')['products'] as List).length);
      expect(rows.length, greaterThan(150));
      for (final r in rows) {
        final name = r['name'] as String;
        expect(name.length, greaterThanOrEqualTo(2));
        expect(name.length, lessThanOrEqualTo(160));
        expect(double.parse(r['price'] as String), greaterThan(0));
        if ((r['original_price'] as String).isNotEmpty) expect(double.parse(r['original_price'] as String), greaterThan(double.parse(r['price'] as String)));
        expect(r['image_url'], matches(RegExp(r'^/rossmann/\d+\.webp$')));
        expect(r['source_url'], matches(RegExp(r'^https://rossmann\.az/mehsullar/')));
        expect((r['tags'] as List).isNotEmpty, true);
        expect((r['tags'] as List).every(shopCollections.contains), true);
      }
      expect(rows.map((r) => r['sku']).toSet().length, rows.length);
      for (final c in shopCollections) {
        expect(((catalog('rossmann')['collections'] as Map)[c] as List).length, greaterThan(0));
      }
      expect(kCuratedPartnerCatalog['rossmann']!.length, rows.length);
    });

    test('keeps the curated Rossmann lines per collection', () {
      final rossmann = {...olivia, 'id': 'p2', 'slug': 'rossmann', 'name': 'Rossmann', 'website_url': 'https://rossmann.az'};
      final item = (catalog('rossmann')['products'] as List).cast<Map<String, dynamic>>().firstWhere((p) => (p['collections'] as List).length > 1);
      final row = importRows('rossmann').firstWhere((r) => r['sku'] == item['sku']);
      final s = storefrontFromRpc({
        'partners': [rossmann],
        'products': [
          {...row, 'id': 'r1', 'partner_id': 'p2', 'sales_count': 1},
        ],
      });
      expect(s.products.first.why, Map<String, String>.from(item['why'] as Map));
    });

    test('picks the hero by stage and hides everything in loss recovery', () {
      expect(shopPlan(const ShopStageInput(lifeStage: 'bump', pregnancyWeek: 35))?.hero.collection, 'bag');
      expect(shopPlan(const ShopStageInput(lifeStage: 'bump', pregnancyWeek: 20))?.hero.collection, 'pregnant');
      expect(shopPlan(const ShopStageInput(lifeStage: 'bump', pregnancyWeek: 19))?.hero.eyebrow, '19-cu həftə');
      expect(shopPlan(const ShopStageInput(lifeStage: 'bump', pregnancyWeek: 36))?.hero.eyebrow, '36-cı həftə üçün');
      expect(shopPlan(const ShopStageInput(lifeStage: 'mommy', babyMonths: 3))?.hero.collection, 'newmom');
      expect(shopPlan(const ShopStageInput(lifeStage: 'mommy', babyMonths: 7))?.hero.collection, 'baby');
      expect(shopPlan(const ShopStageInput(lifeStage: 'mommy', babyMonths: 30))?.hero.collection, 'kid');
      expect(shopPlan(const ShopStageInput(lifeStage: 'flow', daysUntilPeriod: 2))?.hero.eyebrow, 'Aybaşına 2 gün qalıb');
      expect(shopPlan(const ShopStageInput(lifeStage: 'flow', recovering: true)), isNull);
    });

    test('maps storefront rows, keeps curated Olivia lines and applies campaigns', () {
      final s = storefrontFromRpc({
        'partners': [olivia],
        'products': [
          {
            'id': 'x',
            'partner_id': 'p1',
            'sku': '00-00010989',
            'name': 'Salfet',
            'description': 'Körpə üçün ilk paket',
            'price': '5.79',
            'original_price': '6.49', //
            'tags': ['bag', 'baby'], 'source_url': 'https://olivia.az/a', 'image_url': '/olivia/00-00010989.webp', 'sales_count': 51,
          },
          {
            'id': 'y', 'partner_id': 'p1', 'sku': 'n1', 'name': 'Yeni', 'description': 'Öz izahı', 'price': 10, 'original_price': null, 'tags': ['gift'], //
            'campaign': {'id': 'c', 'title': 'Payız', 'discount_pct': 20, 'price': 8, 'ends_at': '2026-12-01T00:00:00Z'},
          },
          {'id': 'z', 'partner_id': 'other', 'name': 'Başqa', 'price': 1, 'tags': <Object?>[]},
        ],
      });
      expect(s.products.map((p) => p.id).toList(), ['x', 'y']);
      final a = s.products[0];
      final b = s.products[1];
      expect(a.why['baby'], 'Gündəlik istifadə üçün, 0+');
      expect(a.originalPrice, 6.49);
      expect(b.price, 8);
      expect(b.originalPrice, 10);
      expect(b.campaign?.title, 'Payız');
      expect(b.why['gift'], 'Öz izahı');
      expect(s.partners['p1']?.iconUrl, '/partners/olivia/icon.png');
    });

    test('adds UTM to partner links', () {
      expect(partnerLink('https://olivia.az/a', 'home bag'), 'https://olivia.az/a?utm_source=anacan&utm_medium=app&utm_campaign=home_bag');
      expect(productFromRow({'id': 'q', 'partner_id': 'p', 'name': 'N', 'price': 1}).url, 'https://anacan.az/');
    });
  });
}
