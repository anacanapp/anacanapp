// Ported from: src/components/tools/affiliate/AffiliateProductCard.tsx
//
// A product card in the grid (square image) or the featured strip (256 wide, 144 high image): platform badge,
// discount, save heart, name, rating, price (or "Qiymətə bax →" / "Ətraflı"), price age.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show jsNumberToString, jsParseDate, jsRoundInt;
import '../../community/copy/community_copy.dart' show formatDistanceToNowSuffix;
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_ui.dart' show LucideFilled;
import 'affiliate_data.dart';

typedef AffiliateProduct = Map<String, dynamic>;

/// `product.name_az || product.name`.
String affiliateName(AffiliateProduct p) => '${p['name_az'] ?? ''}'.isNotEmpty ? '${p['name_az']}' : '${p['name'] ?? ''}';

num? _num(Object? v) => v is num ? v : null;

/// `{price}` as JS prints a number.
String affiliateNum(Object? v) => v is num ? jsNumberToString(v) : '${v ?? ''}';

/// The discount badge value, or null.
int? affiliateDiscount(AffiliateProduct p) {
  final price = _num(p['price']), original = _num(p['original_price']);
  if (original == null || original == 0 || price == null || price == 0 || original <= price) return null;
  return jsRoundInt((1 - price / original) * 100);
}

/// `formatDistanceToNow(price_updated_at, { addSuffix: true })`.
String? affiliatePriceAge(AffiliateProduct p) {
  final d = jsParseDate('${p['price_updated_at'] ?? ''}');
  return d == null ? null : formatDistanceToNowSuffix(d);
}

/// `platformStyles` (solid chips): (background, ink).
(Color, Color) _platform(ATokens a, Object? platform) => switch (platform) {
      'trendyol' => (a.peach2, const Color(0xFFFFFFFF)),
      // `ink: '#5a3d00'` (AffiliateProductCard.tsx literal)
      'amazon' => (a.yellow2, const Color(0xFF5A3D00)),
      'aliexpress' => (a.pink2, const Color(0xFFFFFFFF)),
      _ => (a.lineStrong, a.ink),
    };

/// The product image (`image_url`), or the 📦 placeholder.
Widget affiliateImage(String? url, {required double emojiSize, BoxFit fit = BoxFit.cover, String? semanticLabel}) {
  final empty = Center(child: Text('📦', style: TextStyle(fontSize: emojiSize, height: 1)));
  if (url == null || url.isEmpty) return empty;
  return Image.network(url, fit: fit, semanticLabel: semanticLabel, excludeFromSemantics: semanticLabel == null, errorBuilder: (_, _, _) => const SizedBox.expand());
}

class AffiliateProductCard extends ConsumerWidget {
  const AffiliateProductCard({super.key, required this.product, required this.onSelect, this.index = 0, this.featured = false});
  final AffiliateProduct product;
  final ValueChanged<AffiliateProduct> onSelect;
  final int index;
  final bool featured;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final p = product;
    final id = '${p['id'] ?? ''}';
    final isSaved = ref.watch(isAffiliateProductSavedQuery(id)).data ?? false;
    final discount = affiliateDiscount(p);
    final priceAge = affiliatePriceAge(p);
    final (pBg, pInk) = _platform(a, p['platform']);
    final store = '${p['store_name'] ?? ''}'.isNotEmpty ? '${p['store_name']}' : '${p['platform'] ?? ''}';
    final rating = _num(p['rating']) ?? 0;
    final reviews = _num(p['review_count']) ?? 0;
    final price = _num(p['price']);
    final original = _num(p['original_price']);
    final currency = '${p['currency'] ?? ''}';
    final hasOriginal = original != null && original != 0 && price != null && original > price;
    void toggle() => toggleAffiliateSaved(ref, context, id, saved: isSaved);

    Widget heart(double box, double icon) => Semantics(
          button: true,
          label: tr('a11y_save', 'Yadda saxla'),
          selected: isSaved,
          child: GestureDetector(
            key: ValueKey('affiliate-save-$id'),
            behavior: HitTestBehavior.opaque,
            onTap: toggle,
            child: Container(
              width: box,
              height: box,
              alignment: Alignment.center,
              // `rgba(255,255,255,0.92)` (AffiliateProductCard.tsx literal)
              decoration: BoxDecoration(color: isSaved ? a.pink2 : const Color(0xEBFFFFFF), shape: BoxShape.circle),
              child: isSaved ? LucideFilled(AIcons.heart, size: icon, color: const Color(0xFFFFFFFF)) : AIcon(AIcons.heart, size: icon, color: a.inkFaint),
            ),
          ),
        );
    Widget badge(String text, Color bg, Color ink, double size, EdgeInsets pad) => Container(
          padding: pad,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
          child: Text(text, maxLines: 1, style: px(size, weight: FontWeight.w700, color: ink, height: 1.5)),
        );

    if (featured) {
      return FadeRise(
        dy: 0,
        dx: 20,
        delay: Duration(milliseconds: index * 100),
        child: Semantics(
          button: true,
          child: GestureDetector(
            key: ValueKey('affiliate-featured-$id'),
            behavior: HitTestBehavior.opaque,
            onTap: () => onSelect(p),
            child: Container(
              width: 256,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: a.line), boxShadow: a.cardShadow),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                SizedBox(
                  height: 144,
                  child: Stack(fit: StackFit.expand, children: [
                    DecoratedBox(decoration: BoxDecoration(gradient: a.illusGrad), child: affiliateImage(p['image_url'] as String?, emojiSize: 36, semanticLabel: affiliateName(p))),
                    PositionedDirectional(top: 8, start: 8, child: badge(store, pBg, pInk, 10, const EdgeInsets.symmetric(horizontal: 8, vertical: 2))),
                    if (discount != null) PositionedDirectional(top: 8, end: 40, child: badge('-$discount%', a.pink2, const Color(0xFFFFFFFF), 10, const EdgeInsets.symmetric(horizontal: 8, vertical: 2))),
                    PositionedDirectional(top: 8, end: 8, child: heart(28, 16)),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(affiliateName(p), maxLines: 2, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                    ),
                    if (rating > 0)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(children: [
                          LucideFilled(AIcons.star, size: 12, color: a.yellow2),
                          const SizedBox(width: 4),
                          Text(rating.toStringAsFixed(1), style: px(12, weight: FontWeight.w600, color: a.ink, height: 16 / 12)),
                          if (reviews > 0) ...[const SizedBox(width: 4), Text('(${affiliateNum(reviews)})', style: px(12, color: a.inkSoft, height: 16 / 12))],
                        ]),
                      ),
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          if (price != null && price != 0)
                            Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
                              Text('${affiliateNum(price)} $currency', style: px(18, weight: FontWeight.w700, color: a.accentInk, height: 28 / 18)),
                              if (hasOriginal)
                                Text('${affiliateNum(original)} $currency',
                                    style: px(12, color: a.inkFaint, height: 16 / 12).copyWith(decoration: TextDecoration.lineThrough)),
                            ])
                          else
                            Text(tr('affiliateproductcard_qiymete_bax_f5159c', 'Qiymətə bax →'), style: px(14, color: a.inkSoft, height: 20 / 14)),
                          if (priceAge != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(children: [
                                AIcon(AIcons.clock, size: 10, color: a.inkFaint),
                                const SizedBox(width: 4),
                                Flexible(child: Text(priceAge, style: px(10, color: a.inkFaint, height: 15 / 10))),
                              ]),
                            ),
                        ]),
                      ),
                      AIcon(AIcons.externalLink, size: 16, color: a.inkFaint),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      );
    }

    return FadeRise(
      delay: Duration(milliseconds: (index * 30).clamp(0, 300)),
      child: Semantics(
        button: true,
        child: GestureDetector(
          key: ValueKey('affiliate-card-$id'),
          behavior: HitTestBehavior.opaque,
          onTap: () => onSelect(p),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: a.line), boxShadow: a.cardShadow),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(fit: StackFit.expand, children: [
                  DecoratedBox(decoration: BoxDecoration(gradient: a.illusGrad), child: affiliateImage(p['image_url'] as String?, emojiSize: 30, semanticLabel: affiliateName(p))),
                  PositionedDirectional(top: 6, start: 6, child: badge(store, pBg, pInk, 8, const EdgeInsets.symmetric(horizontal: 6, vertical: 2))),
                  if (discount != null)
                    PositionedDirectional(bottom: 6, start: 6, child: badge('-$discount%', a.pink2, const Color(0xFFFFFFFF), 8, const EdgeInsets.symmetric(horizontal: 6, vertical: 2))),
                  PositionedDirectional(top: 6, end: 6, child: heart(24, 12)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 32),
                      child: Text(affiliateName(p), maxLines: 2, overflow: TextOverflow.ellipsis, style: px(12, weight: FontWeight.w600, color: a.ink, height: 16 / 12)),
                    ),
                  ),
                  if (rating > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(children: [
                        LucideFilled(AIcons.star, size: 10, color: a.yellow2),
                        const SizedBox(width: 4),
                        Text(rating.toStringAsFixed(1), style: px(10, color: a.ink, height: 15 / 10)),
                      ]),
                    ),
                  if (price != null && price != 0)
                    Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('${affiliateNum(price)} $currency', style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14)),
                      if (hasOriginal)
                        Text('${affiliateNum(original)} $currency', style: px(10, color: a.inkFaint, height: 15 / 10).copyWith(decoration: TextDecoration.lineThrough)),
                    ])
                  else
                    Row(children: [
                      Text(tr('affiliateproductcard_etrafli_b3a8e8', 'Ətraflı'), style: px(10, color: a.accentInk, height: 15 / 10)),
                      const SizedBox(width: 4),
                      AIcon(AIcons.externalLink, size: 10, color: a.accentInk),
                    ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
