// Ported from: src/components/aptek/AptekParts.tsx, src/styles/aptek.css (.ap-card, .ap-img, .ap-off, .ap-body,
//              .ap-name, .ap-foot, .ap-price, .ap-add, .ap-qty, .ap-bundle, .ap-bthumbs, .ap-bplus, .ap-bprice,
//              .ap-offer, .ap-thumb)
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../../../domain/aptek/aptek_pricing.dart' show AptekBundle;
import '../common/commerce_ui.dart';
import '../qaygicash/qaygicash.dart' show toMinor;
import '../qaygicash/qc_parts.dart' show QcProductBadge;
import 'aptek_data.dart';

/// `.ap-img` / `.ap-thumb` white background (aptek.css literal; `.dark` uses #fdfaf8).
Color aptekImageBg(BuildContext context) => context.tokens.brightness == Brightness.dark ? const Color(0xFFFDFAF8) : const Color(0xFFFFFFFF);

class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.value, required this.onChanged, this.small = false});
  final int value;
  final ValueChanged<int> onChanged;
  final bool small;

  void _step(int d) {
    HapticFeedback.lightImpact();
    onChanged((value + d).clamp(0, 20));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget btn(AIconData icon, String label, VoidCallback? onTap, Key key) => Semantics(
      button: true,
      label: label,
      enabled: onTap != null,
      child: GestureDetector(
        key: key,
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: small ? 30 : 44,
          height: small ? 32 : 44,
          child: Center(
            child: AIcon(icon, size: small ? 15 : 18, color: onTap == null ? a.coralText.withValues(alpha: 0.4) : a.coralText),
          ),
        ),
      ),
    );
    return Container(
      height: small ? 36 : 50,
      padding: EdgeInsets.all(small ? 2 : 3),
      decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(small ? 12 : 14)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          btn(AIcons.minus, ap('qty_minus'), () => _step(-1), const ValueKey('qty-minus')),
          ConstrainedBox(
            constraints: BoxConstraints(minWidth: small ? 16 : 22),
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: small ? 13.5 : 15, fontWeight: FontWeight.w700, color: a.ink, fontFeatures: tabularFigures),
            ),
          ),
          const SizedBox(width: 2),
          btn(AIcons.plus, ap('qty_plus'), value >= 20 ? null : () => _step(1), const ValueKey('qty-plus')),
        ],
      ),
    );
  }
}

/// 'rail' | 'small' | null.
class AptekProductCard extends StatelessWidget {
  const AptekProductCard({super.key, required this.product, required this.qty, required this.onOpen, required this.onQty, this.variant, this.width});
  final AptekProduct product;
  final int qty;
  final VoidCallback onOpen;
  final ValueChanged<int> onQty;
  final String? variant;

  /// Explicit width (`.ap-offer .ap-card.small`: half the rail).
  final double? width;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final off = discountPct(product);
    final w =
        width ??
        (variant == 'rail'
            ? 158.0
            : variant == 'small'
            ? 136.0
            : null);
    final card = Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            button: true,
            label: product.name,
            child: GestureDetector(
              key: ValueKey('ap-open-${product.id}'),
              onTap: onOpen,
              child: AspectRatio(
                aspectRatio: 1,
                child: Container(
                  color: aptekImageBg(context),
                  padding: const EdgeInsets.all(10),
                  child: Stack(
                    children: [
                      if (product.images.isNotEmpty) Positioned.fill(child: CommerceImage(product.images.first, fit: BoxFit.contain)),
                      if (off > 0) PositionedDirectional(top: -2, start: -2, child: _OffBadge(off: off)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: a.line)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: onOpen,
                  child: SizedBox(
                    height: (variant == 'small' ? 12.5 : 13.5) * 1.3 * 2,
                    child: Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: variant == 'small' ? 12.5 : 13.5, fontWeight: FontWeight.w500, height: 1.3, color: a.ink),
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Text(ageLabel(product.minAgeMonths), style: context.aText.a3Meta),
                // QayğıCash: only Anacan-brand products earn; partner products show nothing in lists.
                if (product.cashbackOwn)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: QcProductBadge(channel: 'own_shop', priceMinor: toMinor(product.price)),
                  ),
                const SizedBox(height: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 36),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              formatAzn(product.price),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.32,
                                height: 1.15,
                                color: a.ink,
                                fontFeatures: tabularFigures,
                              ),
                            ),
                            if (off > 0 && product.originalPrice != null)
                              Text(
                                formatAzn(product.originalPrice!),
                                style: TextStyle(
                                  fontSize: 12,
                                  height: 1.15,
                                  color: a.inkSoft,
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor: a.inkSoft,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (qty > 0)
                        QtyStepper(small: true, value: qty, onChanged: onQty)
                      else
                        Semantics(
                          button: true,
                          label: '${ap('add_to_cart')}: ${product.name}',
                          child: PressScale.css(
                            key: ValueKey('ap-add-${product.id}'),
                            scale: 0.88,
                            onTap: () {
                              HapticFeedback.lightImpact();
                              onQty(1);
                            },
                            child: Container(
                              width: 36,
                              height: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: a.coralStrong, borderRadius: BorderRadius.circular(12)),
                              child: AIcon(AIcons.plus, size: 18, color: a.onCoral),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    return w == null ? card : SizedBox(width: w, child: card);
  }
}

class _OffBadge extends StatelessWidget {
  const _OffBadge({required this.off, this.fontSize = 11.5});
  final int off;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      constraints: const BoxConstraints(minHeight: 22),
      padding: const EdgeInsets.symmetric(horizontal: 7),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: a.coralStrong, borderRadius: BorderRadius.circular(8)),
      child: Text(
        '−$off%',
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w700, color: a.onCoral, fontFeatures: tabularFigures),
      ),
    );
  }
}

/// `.ap-off` badge (used on the product page with 13px text).
Widget aptekOffBadge(int off, {double fontSize = 11.5}) => _OffBadge(off: off, fontSize: fontSize);

/// `.ap-thumb` (76; `.sm` 52).
class AptekThumb extends StatelessWidget {
  const AptekThumb({super.key, this.src, this.small = false, this.size, this.onTap, this.label});
  final String? src;
  final bool small;
  final double? size;
  final VoidCallback? onTap;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final d = size ?? (small ? 52.0 : 76.0);
    final box = Container(
      width: d,
      height: d,
      padding: EdgeInsets.all(small ? 4 : 6),
      decoration: BoxDecoration(
        color: aptekImageBg(context),
        borderRadius: BorderRadius.circular(small ? 12 : 16),
        boxShadow: [BoxShadow(color: a.line, spreadRadius: 1)],
      ),
      child: src == null ? null : CommerceImage(src!, fit: BoxFit.contain),
    );
    if (onTap == null) return box;
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(onTap: onTap, child: box),
    );
  }
}

class AptekBundleCard extends StatelessWidget {
  const AptekBundleCard({
    super.key,
    required this.bundle,
    required this.products,
    required this.pct,
    required this.inCart,
    required this.onAddAll,
    required this.onOpenProduct,
    this.wide = false,
  });
  final AptekBundle bundle;
  final List<AptekProduct> products;
  final num pct;
  final bool Function(String productId) inCart;
  final VoidCallback onAddAll;
  final void Function(AptekProduct p) onOpenProduct;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final items = <AptekProduct>[];
    for (final sku in bundle.skus) {
      for (final p in products) {
        if (p.sku == sku) {
          items.add(p);
          break;
        }
      }
    }
    if (items.length != bundle.skus.length) return const SizedBox.shrink(); // a set with a missing product can't be completed
    final a = context.a;
    final sum = items.fold<num>(0, (s, p) => s + p.price);
    final done = items.every((p) => inCart(p.id));
    final title = ap('bundle_${bundle.id}_t');
    final (bg, _) = toneColors(context, bundle.tone ?? 'c-peach');
    final card = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(color: Color(0xB3FFFFFF), shape: BoxShape.circle),
                        child: const AIcon(AIcons.plus, size: 12, color: Color(0xFF2A2120)), // aptek.css literal
                      ),
                    ),
                  AptekThumb(src: items[i].images.isEmpty ? null : items[i].images.first, size: 68, label: items[i].name, onTap: () => onOpenProduct(items[i])),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: A3Chip(ap('bundle_save', {'pct': pct}), tone: 'ac'),
          ),
          const SizedBox(height: 4),
          Text(
            title.startsWith('bundle_') ? bundle.id : title,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: a.ink),
          ),
          const SizedBox(height: 4),
          Text(ap('bundle_${bundle.id}_d'), style: context.aText.a3Meta),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              Text(
                formatAzn((sum * (100 - pct)).round() / 100),
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: a.ink, fontFeatures: tabularFigures),
              ),
              Text(
                formatAzn(sum),
                style: TextStyle(fontSize: 12.5, color: a.inkSoft, decoration: TextDecoration.lineThrough, decorationColor: a.inkSoft),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AButton(
            variant: done ? AButtonVariant.soft : AButtonVariant.accent,
            size: AButtonSize.sm,
            block: true,
            onPressed: done ? null : onAddAll,
            leading: AIcon(done ? AIcons.check : AIcons.shoppingBag, size: 16),
            child: Text(done ? ap('bundle_done') : ap('bundle_add')),
          ),
        ],
      ),
    );
    return wide ? SizedBox(width: 286, child: card) : card;
  }
}

/// Contextual product suggestion card used outside the store (home, tools).
class AptekOfferCard extends StatelessWidget {
  const AptekOfferCard({
    super.key,
    required this.title,
    required this.why,
    required this.products,
    required this.qtyOf,
    required this.onQty,
    required this.onOpenProduct,
    required this.onOpenStore,
  });
  final String title;
  final String why;
  final List<AptekProduct> products;
  final int Function(String id) qtyOf;
  final void Function(String id, int n) onQty;
  final void Function(AptekProduct p) onOpenProduct;
  final VoidCallback onOpenStore;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    return Padding(
      key: const ValueKey('aptek-offer'),
      padding: const EdgeInsets.only(top: 24),
      child: Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: a.green2),
          boxShadow: a.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                A3IcoSq(
                  tone: 'c-green',
                  child: AIcon(AIcons.shoppingBag, size: 16, color: a.greenInk),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ap('title').toUpperCase(), style: context.aText.a3Eyebrow.copyWith(color: a.greenInk)),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          title,
                          style: TextStyle(fontWeight: FontWeight.w700, color: a.ink),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(why, style: context.aText.a3Meta),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, c) {
                // Two whole cards per view on the home offer card.
                final w = (c.maxWidth - 10) / 2;
                return A3Rail(
                  gutter: 14,
                  children: [
                    for (final p in products)
                      AptekProductCard(variant: 'small', width: w, product: p, qty: qtyOf(p.id), onOpen: () => onOpenProduct(p), onQty: (n) => onQty(p.id, n)),
                  ],
                );
              },
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: GestureDetector(
                  key: const ValueKey('aptek-see-store'),
                  onTap: onOpenStore,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(ap('see_store'), style: context.aText.a3Link),
                      const SizedBox(width: 2),
                      AIcon(AIcons.chevronRight, size: 14, color: a.coralText, mirrorInRtl: true),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
