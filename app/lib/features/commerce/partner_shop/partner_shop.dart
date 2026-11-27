// Ported from: src/lib/partner-shop.ts (the bundled catalogs of src/lib/olivia-catalog.ts / rossmann-catalog.ts
//              only for their curated "why" lines: partner_catalog.g.dart)
//
// Partner stores inside Mağaza (owner 2026-11-16/17). Olivia.az is the first partner; more brands can be added.
// Server side (supabase/migrations/20261117090000_shop_partners.sql):
//  - products.partner_id links a product to its partner; partner rows stay is_active = false;
//  - shop_storefront_v1 returns a partner's listed, in-stock products to everyone when the partner is live and only
//    to admins and the partner's own members while it is admin_only/paused (Olivia is admin_only now);
//  - shop_partner_track_v1 records impressions/opens/adds/site clicks for the partner panel (/partner).
// Phase 1 sells on the partner's own site: buttons open the product page with Anacan UTM parameters.
import 'dart:convert';
import 'dart:math' as math;

import '../../../domain/js_compat.dart' show jsNumberToString, jsRound;
import '../../stories/stories.dart' show azOrdinal;
import 'partner_catalog.g.dart';

/// 'bag' | 'pregnant' | 'newmom' | 'baby' | 'kid' | 'cycle' | 'gift'
typedef ShopCollection = String;

const List<String> shopCollections = ['bag', 'pregnant', 'newmom', 'baby', 'kid', 'cycle', 'gift'];

const Map<String, String> shopCollectionLabel = {
  'bag': 'Xəstəxana çantası',
  'pregnant': 'Hamiləlik',
  'newmom': 'Yeni ana',
  'baby': 'Körpə 0-12 ay',
  'kid': 'Uşaq 1-6 yaş',
  'cycle': 'Dövr',
  'gift': 'Hədiyyə',
};

class ShopPartner {
  const ShopPartner({
    required this.id,
    required this.slug,
    required this.name,
    this.logoUrl,
    this.iconUrl,
    this.websiteUrl,
    this.brandColor = '#8A2BE2',
    this.status = 'admin_only',
  });
  final String id;
  final String slug;
  final String name;
  final String? logoUrl;
  final String? iconUrl;
  final String? websiteUrl;
  final String brandColor;

  /// 'admin_only' | 'live' | 'paused'
  final String status;
}

class ShopCampaign {
  const ShopCampaign({required this.id, required this.title, required this.discountPct, required this.endsAt});
  final String id;
  final String title;
  final double discountPct;
  final String endsAt;
}

/// A storefront product: price is what the user pays now (campaign applied), originalPrice the struck-through one.
class PartnerProduct {
  const PartnerProduct({
    required this.id,
    required this.partnerId,
    this.sku,
    required this.name,
    this.description,
    required this.price,
    this.originalPrice,
    this.image,
    required this.url,
    required this.collections,
    required this.why,
    required this.sort,
    this.stock,
    this.campaign,
  });
  final String id;
  final String partnerId;
  final String? sku;
  final String name;
  final String? description;
  final double price;
  final double? originalPrice;
  final String? image;
  final String url;
  final List<String> collections;
  final Map<String, String> why;
  final double sort;
  final double? stock;
  final ShopCampaign? campaign;
}

class Storefront {
  const Storefront({required this.partners, required this.products});
  final Map<String, ShopPartner> partners;
  final List<PartnerProduct> products;

  static const Storefront empty = Storefront(partners: {}, products: []);
}

String _str(Object? v) => v == null ? '' : (v is num ? jsNumberToString(v) : '$v');

/// `Number(x)` for null / '' → null.
double? _num(Object? v) {
  if (v == null || v == '') return null;
  if (v is num) return v.toDouble();
  if (v is bool) return v ? 1 : 0;
  if (v is String) return double.tryParse(v.trim()) ?? double.nan;
  return double.nan;
}

/// `x || fallback` on a string column.
String? _orNull(Object? v) => v is String && v.isNotEmpty ? v : null;

ShopPartner partnerFromRow(Map<String, Object?> r) => ShopPartner(
  id: _str(r['id']),
  slug: _orNull(r['slug']) ?? '',
  name: _orNull(r['name']) ?? '',
  logoUrl: _orNull(r['logo_url']),
  iconUrl: _orNull(r['icon_url']),
  websiteUrl: _orNull(r['website_url']),
  brandColor: r['brand_color'] is String ? r['brand_color'] as String : '#8A2BE2',
  status: r['status'] == 'live' || r['status'] == 'paused' ? r['status'] as String : 'admin_only',
);

PartnerProduct productFromRow(Map<String, Object?> r, [ShopPartner? partner]) {
  final tags = r['tags'] is List ? (r['tags'] as List) : const [];
  final collections = [
    for (final t in tags)
      if (t is String && shopCollections.contains(t)) t,
  ];
  final base = _num(r['price']) ?? 0;
  final listedOld = _num(r['original_price']);
  final c = r['campaign'] is Map ? Map<String, Object?>.from(r['campaign'] as Map) : null;
  final campaign = c == null
      ? null
      : ShopCampaign(
          id: _str(c['id']),
          title: _orNull(c['title']) ?? (c['title'] == null ? '' : _str(c['title'])),
          discountPct: (_num(c['discount_pct']) ?? 0).isNaN ? 0 : (_num(c['discount_pct']) ?? 0),
          endsAt: _orNull(c['ends_at']) ?? '',
        );
  final price = campaign != null && c?['price'] != null ? (_num(c!['price']) ?? 0) : base;
  final strike = campaign != null ? math.max(base, listedOld ?? 0) : listedOld;
  final description = r['description'] is String && (r['description'] as String).isNotEmpty ? r['description'] as String : null;
  // Curated (bundled) rows keep their per-collection "why" lines until the partner rewrites the description.
  final sku = r['sku'];
  final known = partner != null && sku is String ? (kCuratedPartnerCatalog[partner.slug] ?? const {})[sku] : null;
  final Map<String, String> why;
  if (known != null && (description == null || description == known.$2[known.$1.first])) {
    why = known.$2;
  } else if (description != null) {
    why = {
      for (final k in collections.isNotEmpty ? collections : const ['baby']) k: description,
    };
  } else {
    why = const {};
  }
  final sort = _num(r['sales_count']);
  return PartnerProduct(
    id: _str(r['id']),
    partnerId: r['partner_id'] == null || r['partner_id'] == '' ? '' : _str(r['partner_id']),
    sku: _orNull(r['sku']),
    name: r['name'] == null || r['name'] == '' ? '' : _str(r['name']),
    description: description,
    price: price,
    originalPrice: strike != null && strike != 0 && strike > price ? strike : null,
    image: _orNull(r['image_url']),
    url: _orNull(r['source_url']) ?? partner?.websiteUrl ?? 'https://anacan.az/',
    collections: collections,
    why: why,
    sort: sort == null || sort.isNaN ? 0 : sort,
    stock: _num(r['stock']),
    campaign: campaign,
  );
}

/// Partner lookup that survives any cached shape (a map, an array of partners or [id, partner] entries). Never
/// throws. (React restored plain objects from the persisted cache; here the storefront is rebuilt from the RPC
/// JSON, so this only normalises raw JSON.)
Map<String, ShopPartner> asPartnerMap(Object? value) {
  if (value is Map<String, ShopPartner>) return value;
  final map = <String, ShopPartner>{};
  void add(Object? key, Object? partner) {
    if (partner is ShopPartner) {
      map[partner.id] = partner;
      return;
    }
    if (partner is! Map) return;
    final id = partner['id'] ?? key;
    if (id != null && id != '') map[_str(id)] = partnerFromRow(Map<String, Object?>.from(partner));
  }

  if (value is List) {
    for (final item in value) {
      if (item is List && item.length >= 2) {
        add(item[0], item[1]);
      } else {
        add(null, item);
      }
    }
  } else if (value is Map) {
    value.forEach(add);
  }
  return map;
}

Storefront storefrontFromRpc(Object? data) {
  final d = data is Map ? data : const {};
  List<Object?> rows(Object? v) => v is List ? v : const [];
  final partners = <String, ShopPartner>{};
  for (final p in rows(d['partners'])) {
    if (p is! Map) continue;
    final x = partnerFromRow(Map<String, Object?>.from(p));
    partners[x.id] = x;
  }
  final products = <PartnerProduct>[];
  for (final p in rows(d['products'])) {
    if (p is! Map) continue;
    final row = Map<String, Object?>.from(p);
    final product = productFromRow(row, partners[_str(row['partner_id'])]);
    if (partners.containsKey(product.partnerId)) products.add(product);
  }
  return Storefront(partners: partners, products: products);
}

int shopDiscount(PartnerProduct p) => p.originalPrice != null && p.originalPrice! > p.price ? jsRound((1 - p.price / p.originalPrice!) * 100).toInt() : 0;

String formatManat(num n) => '${n.toStringAsFixed(2).replaceFirst('.', ',')} ₼';

/// Random click token for sales tracking (anacan_click), made on the device and registered with
/// shop_partner_click_v1.
String newClickToken([math.Random? random]) {
  final r = random ?? math.Random.secure();
  final bytes = List<int>.generate(18, (_) => r.nextInt(256));
  return base64Url.encode(bytes).replaceAll(RegExp(r'=+$'), '');
}

/// Partner product link with Anacan attribution (phase 1: the sale happens on the partner's site).
String partnerLink(String url, String campaign, [String? click]) {
  try {
    final u = Uri.parse(url);
    if (!u.hasScheme || !u.hasAuthority || u.host.isEmpty) return 'https://anacan.az/';
    final pairs = <(String, String)>[
      for (final part in u.query.split('&'))
        if (part.isNotEmpty)
          (Uri.decodeQueryComponent(part.split('=').first), Uri.decodeQueryComponent(part.contains('=') ? part.substring(part.indexOf('=') + 1) : '')),
    ];
    void set(String k, String v) {
      final i = pairs.indexWhere((p) => p.$1 == k);
      pairs.removeWhere((p) => p.$1 == k);
      if (i == -1) {
        pairs.add((k, v));
      } else {
        pairs.insert(i, (k, v));
      }
    }

    set('utm_source', 'anacan');
    set('utm_medium', 'app');
    final c = campaign.replaceAll(RegExp(r'[^a-z0-9_-]', caseSensitive: false), '_');
    final cut = c.length > 60 ? c.substring(0, 60) : c;
    set('utm_campaign', cut.isEmpty ? 'shop' : cut);
    if (click != null && RegExp(r'^[A-Za-z0-9_-]{20,64}$').hasMatch(click)) set('anacan_click', click);
    final query = pairs.map((p) => '${Uri.encodeQueryComponent(p.$1)}=${Uri.encodeQueryComponent(p.$2)}').join('&');
    return u.replace(query: query, path: u.path.isEmpty ? '/' : u.path).toString();
  } catch (_) {
    return 'https://anacan.az/';
  }
}

class ShopStageInput {
  const ShopStageInput({this.lifeStage, this.pregnancyWeek, this.babyMonths, this.daysUntilPeriod, this.recovering = false});
  final String? lifeStage;
  final int? pregnancyWeek;
  final int? babyMonths;
  final int? daysUntilPeriod;
  final bool recovering;
}

class ShopHero {
  const ShopHero({required this.collection, required this.eyebrow, required this.title, required this.text, this.lead});
  final ShopCollection collection;
  final String eyebrow;
  final String title;
  final String text;

  /// SKU shown first in the hero thumbnails.
  final String? lead;
}

typedef ShopPlan = ({ShopHero hero, List<String> order});

/// The stage decides the hero and the order of collections. Loss recovery gets nothing.
ShopPlan? shopPlan(ShopStageInput input) {
  if (input.recovering) return null;
  final week = input.pregnancyWeek;
  final months = input.babyMonths;
  if (input.lifeStage == 'bump') {
    if (week != null && week >= 32) {
      return (
        hero: ShopHero(
          collection: 'bag',
          eyebrow: '$week${azOrdinal(week)} həftə üçün',
          title: 'Xəstəxana çantası bir yerdə',
          text: 'Doğuşdan sonra ana və körpə üçün lazım olan baxım məhsulları.',
        ),
        order: const ['bag', 'pregnant', 'baby', 'gift'],
      );
    }
    return (
      hero: ShopHero(
        collection: 'pregnant',
        eyebrow: week != null && week != 0 ? '$week${azOrdinal(week)} həftə' : 'Hamiləlik',
        title: 'Qarın böyüyür, dəri quruyur',
        text: 'Ətirsiz nəmləndiricilər və hamiləlik ləkələrinə qarşı SPF 50+.',
        lead: '00-00001286',
      ),
      order: const ['pregnant', 'bag', 'gift'],
    );
  }
  if (input.lifeStage == 'mommy') {
    if (months != null && months >= 12) {
      return (
        hero: const ShopHero(
          collection: 'kid',
          eyebrow: 'Uşaq baxımı',
          title: 'Diş, saç və günəş',
          text: 'Uşaq diş məcunları, asan daranan şampunlar və uşaq SPF 50+.',
        ),
        order: const ['kid', 'newmom', 'gift'],
      );
    }
    if (months != null && months >= 2 && months <= 6) {
      return (
        hero: const ShopHero(
          collection: 'newmom',
          eyebrow: 'Sənin üçün',
          title: 'Doğuşdan sonra saç tökülməsi',
          text: 'Çox vaxt 3-4-cü ayda artır və keçicidir. Saç baxımı və yuxusuz gecələr üçün patçlar.',
          lead: '00-10025971',
        ),
        order: const ['newmom', 'baby', 'gift'],
      );
    }
    if (months != null && months >= 5) {
      return (
        hero: ShopHero(
          collection: 'baby',
          eyebrow: '$months aylıq körpə üçün',
          title: 'İlk diş vaxtı',
          text: '0+ diş fırçası və körpənin gündəlik baxımı.',
          lead: '00-00012835',
        ),
        order: const ['baby', 'newmom', 'gift'],
      );
    }
    return (
      hero: const ShopHero(
        collection: 'baby',
        eyebrow: 'Körpə baxımı',
        title: 'Hər gün lazım olanlar',
        text: 'Nəm salfet, bezaltı krem, körpə yağı və şampun.',
      ),
      order: const ['baby', 'newmom', 'gift'],
    );
  }
  final d = input.daysUntilPeriod;
  return (
    hero: ShopHero(
      collection: 'cycle',
      eyebrow: d != null && d >= 0 && d <= 5 ? (d == 0 ? 'Aybaşı bu gün' : 'Aybaşına $d gün qalıb') : 'Dövr',
      title: 'Bezlərin var?',
      text: 'Gündüz, gecə və gündəlik bezlər bir yerdə.',
    ),
    order: const ['cycle', 'gift'],
  );
}
