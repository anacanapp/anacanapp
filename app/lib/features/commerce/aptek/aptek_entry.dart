// Ported from: src/components/aptek/AptekEntry.tsx, src/styles/aptek.css (.ap-banner)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../domain/aptek/aptek_offers.dart';
import '../../../shell/shell.dart' show PushNavIntent, shellProvider;
import '../../settings/ui/settings_ui.dart' show toasts;
import '../../tools/hub/fold_text.dart' show foldQuery;
import '../common/commerce_ui.dart';
import 'aptek_data.dart';
import 'aptek_parts.dart';

/// Opens an Aptek screen from places that have no navigation prop (tool screens).
void openAptekScreen(WidgetRef ref, String screen) => ref.read(shellProvider.notifier).dispatchPushEvent(PushNavIntent(screen: screen));

/// Top-bar cart shortcut; renders nothing when the store isn't available.
class AptekCartButton extends ConsumerWidget {
  const AptekCartButton({super.key, required this.onOpen});
  final void Function(String screen) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(aptekAvailableProvider).available) return const SizedBox.shrink();
    final cart = ref.watch(aptekCartProvider);
    return A3IconButton(icon: AIcons.shoppingBag, label: ap('cart_n', {'n': cart.count}), count: cart.count, onTap: () => onOpen('aptek/cart'));
  }
}

/// `ap-banner`: the store banner (home and store home).
class AptekBanner extends StatelessWidget {
  const AptekBanner({super.key, required this.eyebrow, required this.count, required this.freeMin, required this.stage, this.onTap, this.mascotWidth = 88});
  final String eyebrow;
  final int count;
  final num freeMin;
  final String stage;
  final VoidCallback? onTap;
  final double mascotWidth;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final body = Container(
      constraints: const BoxConstraints(minHeight: 120),
      padding: const EdgeInsetsDirectional.fromSTEB(18, 16, 12, 16),
      decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(22)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(eyebrow.toUpperCase(), style: context.aText.a3Eyebrow.copyWith(color: a.greenInk)),
                const SizedBox(height: 4),
                Text(
                  ap('hero_title'),
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.36, color: a.ink),
                ),
                const SizedBox(height: 4),
                Text(ap('hero_meta', {'n': count, 'free': freeMin}), style: context.aText.a3Meta),
              ],
            ),
          ),
          const SizedBox(width: 8),
          CommerceMascot(stage: stage, width: mascotWidth),
          if (onTap != null) ...[const SizedBox(width: 8), AIcon(AIcons.chevronRight, size: 18, color: a.ink, mirrorInRtl: true)],
        ],
      ),
    );
    if (onTap == null) return body;
    return Semantics(
      button: true,
      child: GestureDetector(key: const ValueKey('aptek-banner'), behavior: HitTestBehavior.opaque, onTap: onTap, child: body),
    );
  }
}

/// Home placement: a contextual offer for the baby's age / pregnancy, or the store banner when the placement is
/// switched off. Formula is never offered here.
class AptekHomeCard extends ConsumerWidget {
  const AptekHomeCard({super.key, required this.stage, this.babyMonths, this.babyName, this.context, this.onOpen});

  /// 'bump' | 'mommy' | 'flow'
  final String stage;
  final num? babyMonths;
  final String? babyName;

  /// Overrides the age-based context (e.g. 'bag' from the hospital bag).
  final OfferContext? context;
  final void Function(String screen)? onOpen;

  @override
  Widget build(BuildContext ctx, WidgetRef ref) {
    final availability = ref.watch(aptekAvailableProvider);
    final available = availability.available;
    final config = availability.config;
    final products = ref.watch(aptekProductsQuery).data ?? const <AptekProduct>[];
    final cart = ref.watch(aptekCartProvider);
    if (!available || products.isEmpty || stage == 'flow') return const SizedBox.shrink();
    void open(String screen) => onOpen != null ? onOpen!(screen) : openAptekScreen(ref, screen);

    final offerCtx = context ?? homeOfferContext(stage, babyMonths);
    final list = offerCtx != null && config?.placements['home'] != false
        ? offerProducts<AptekProduct>(offerCtx, products, config?.placements, babyMonths)
        : const <AptekProduct>[];
    void setQty(String id, int n) {
      final wasEmpty = cart.quantityOf(id) == 0;
      final toast = toasts(ctx);
      unawaited(
        cart.setQuantity(id, n).catchError((Object _) {
          toast.error(ap('err_generic'));
        }),
      );
      if (wasEmpty && n > 0) toast.success(ap('added'), duration: const Duration(milliseconds: 1500));
    }

    if (offerCtx != null && list.isNotEmpty) {
      return AptekOfferCard(
        title: ap('offer_${offerCtx}_t'),
        why: ap('offer_${offerCtx}_why', {'name': babyName ?? '', 'n': babyMonths ?? 0}),
        products: list,
        qtyOf: cart.quantityOf,
        onQty: setQty,
        onOpenProduct: (p) => open('aptek/p:${p.id}'),
        onOpenStore: () => open('aptek'),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: AptekBanner(
        eyebrow: '${ap('title')} · ${ap('with_partner')}',
        count: products.length,
        freeMin: config?.freeShippingMin ?? 30,
        stage: stage,
        onTap: () => open('aptek'),
      ),
    );
  }
}

/// `fold(v)`: lower-case, NFD, combining marks removed (the tools hub's `foldQuery` produces the query).
String aptekFold(String v) => foldQuery(v);

/// Product hits for the global search sheet.
class AptekSearchResults extends ConsumerWidget {
  const AptekSearchResults({super.key, required this.query, required this.onOpen, required this.close});
  final String query;
  final void Function(String screen) onOpen;
  final VoidCallback close;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final availability = ref.watch(aptekAvailableProvider);
    final products = ref.watch(aptekProductsQuery).data ?? const <AptekProduct>[];
    if (!availability.available || query.isEmpty || availability.config?.placements['search'] == false) return const SizedBox.shrink();
    final hits = products.where((p) => aptekFold('${p.name} ${p.brand ?? ''}').contains(query)).take(4).toList();
    if (hits.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    return Padding(
      key: const ValueKey('aptek-search-results'),
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(ap('products_title').toUpperCase(), style: context.aText.a3Eyebrow),
          const SizedBox(height: 12),
          A3Card(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: A3Divided(
              children: [
                for (final p in hits)
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      key: ValueKey('aptek-hit-${p.id}'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        close();
                        onOpen('aptek/p:${p.id}');
                      },
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 52),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              AptekThumb(small: true, src: p.images.isEmpty ? null : p.images.first),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontWeight: FontWeight.w600, color: a.ink),
                                    ),
                                    Text(formatAzn(p.price), style: context.aText.a3Meta.copyWith(fontFeatures: tabularFigures)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
