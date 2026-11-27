// Ported from: src/components/partner-shop/PartnerShop.tsx
//
// Partner storefront: PartnerShopSection sits at the top of the existing Mağaza screen; PartnerHomeCard is the
// stage-aware home promo. What appears is decided on the server (shop_storefront_v1): partners in admin_only/paused
// status are visible to admins and their own members only. Every image carries the partner's small icon; the
// product sheet says "by <logo>". Checkout is phase 1: the basket opens each product on the partner's site with
// Anacan UTM parameters.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../domain/cycle/cycle_utils.dart' show getNextPeriodDate;
import '../../../domain/js_compat.dart' show differenceInCalendarDays;
import '../../../shell/shell.dart' show PushNavIntent, shellProvider;
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../settings/ui/settings_ui.dart' show toasts;
import '../common/commerce_ui.dart';
import 'partner_shop.dart';
import 'partner_shop_data.dart';

/// `window.open(url, '_blank')` → the system browser (overridable in tests).
final partnerExternalOpenerProvider = Provider<void Function(String url)>(
  (ref) =>
      (url) => unawaited(launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).then((_) {}, onError: (Object _) {})),
);

String _fmtDay(String iso) {
  try {
    final d = DateTime.parse(iso).toLocal();
    return formatIntlDateTemplate('az', 'dm', d);
  } catch (_) {
    return '';
  }
}

/// Stage of the signed-in user from the stores (the shop screen has no dashboard props).
final shopStageProvider = Provider.autoDispose<ShopStageInput>((ref) {
  final profile = ref.watch(authProfileProvider);
  final store = ref.watch(userStoreProvider);
  final lifeStage = store.lifeStage;
  final children = ref.watch(childrenProvider);
  final child = children.selectedChild;
  final age = child == null ? null : getChildAge(child);
  int? daysUntilPeriod;
  if (lifeStage == 'flow' && store.lastPeriodDate != null) {
    try {
      daysUntilPeriod = differenceInCalendarDays(getNextPeriodDate(store.lastPeriodDate!, store.cycleLength), DateTime.now());
    } catch (_) {
      daysUntilPeriod = null;
    }
  }
  return ShopStageInput(
    lifeStage: lifeStage,
    pregnancyWeek: lifeStage == 'bump' ? store.getPregnancyData()?.currentWeek : null,
    babyMonths: lifeStage == 'mommy' ? age?.months : null,
    daysUntilPeriod: daysUntilPeriod,
    recovering: profile?.lossRecoveryActive == true,
  );
});

Color _hex(String hex) {
  final h = hex.replaceFirst('#', '');
  final v = int.tryParse(h.length == 6 ? 'FF$h' : h, radix: 16);
  return Color(v ?? 0xFF8A2BE2);
}

/// Small partner mark in the corner of a product image, so mixed brands stay recognisable.
class _PartnerMark extends StatelessWidget {
  const _PartnerMark({required this.partner, this.size = 18});
  final ShopPartner? partner;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = partner;
    if (p == null) return const SizedBox.shrink();
    return PositionedDirectional(
      bottom: 6,
      end: 6,
      child: Semantics(
        container: true,
        label: p.name,
        child: Container(
          width: size,
          height: size,
          clipBehavior: Clip.antiAlias,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0x0D000000)),
            boxShadow: const [BoxShadow(offset: Offset(0, 1), blurRadius: 2, color: Color(0x0D000000))],
          ),
          child: p.iconUrl != null
              ? CommerceImage(p.iconUrl!, width: size, height: size)
              : Text(
                  p.name.isEmpty ? '' : p.name.substring(0, 1),
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _hex(p.brandColor)),
                ),
        ),
      ),
    );
  }
}

/// "by `logo`" line of the product sheet.
class ByPartner extends StatelessWidget {
  const ByPartner({super.key, required this.partner});
  final ShopPartner? partner;

  @override
  Widget build(BuildContext context) {
    final p = partner;
    if (p == null) return const SizedBox.shrink();
    final s = context.tokens.shadcn;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('by', style: TextStyle(fontSize: 12, color: s.mutedForeground)),
        const SizedBox(width: 6),
        if (p.logoUrl != null)
          Semantics(
            container: true,
            image: true,
            label: p.name,
            child: SizedBox(height: 14, child: CommerceImage(p.logoUrl!, fit: BoxFit.contain, height: 14)),
          )
        else
          Text(
            p.name,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _hex(p.brandColor)),
          ),
      ],
    );
  }
}

class _Price extends StatelessWidget {
  const _Price({required this.p, this.big = false});
  final PartnerProduct p;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: formatManat(p.price)),
          if (p.originalPrice != null && p.originalPrice! > p.price)
            TextSpan(
              text: ' ${formatManat(p.originalPrice!)}',
              style: TextStyle(fontSize: big ? 14 : 10, fontWeight: FontWeight.w500, color: s.mutedForeground, decoration: TextDecoration.lineThrough),
            ),
        ],
      ),
      style: TextStyle(fontSize: big ? 20 : 14, fontWeight: FontWeight.w900, color: s.foreground, fontFeatures: tabularFigures),
    );
  }
}

class _QtyControl extends ConsumerWidget {
  const _QtyControl({required this.id, required this.placement, this.compact = false});
  final String id;
  final String placement;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(partnerBasketProvider);
    final basket = ref.read(partnerBasketProvider.notifier);
    final q = basket.qty(id);
    final size = compact ? 28.0 : 32.0;
    final s = context.tokens.shadcn;
    if (q == 0) {
      return Semantics(
        button: true,
        label: tr('partnershop_add_to_basket', 'Səbətə at'),
        child: GestureDetector(
          key: ValueKey('shop-add-$id'),
          onTap: () {
            basket.set(id, 1);
            ref.read(shopTrackerProvider).event([id], 'add', placement);
            toasts(context).success(tr('partnershop_added_to_basket', 'Səbətə əlavə olundu'), duration: const Duration(milliseconds: 1200));
          },
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: s.gradientPrimary, borderRadius: BorderRadius.circular(8)),
            child: const AIcon(AIcons.plus, size: 16, color: Color(0xFFFFFFFF)),
          ),
        ),
      );
    }
    return Container(
      decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            button: true,
            label: tr('partnershop_decrease', 'Azalt'),
            child: GestureDetector(
              onTap: () => basket.set(id, q - 1),
              child: SizedBox(
                width: size,
                height: size,
                child: Center(child: AIcon(AIcons.minus, size: 14, color: s.primary)),
              ),
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 14),
            child: Text(
              '$q',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: s.foreground, fontFeatures: tabularFigures),
            ),
          ),
          Semantics(
            button: true,
            label: tr('partnershop_increase', 'Artır'),
            child: GestureDetector(
              onTap: () => basket.set(id, q + 1),
              child: SizedBox(
                width: size,
                height: size,
                child: Center(child: AIcon(AIcons.plus, size: 14, color: s.primary)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.p, required this.partner, required this.col, required this.placement, required this.onOpen});
  final PartnerProduct p;
  final ShopPartner? partner;
  final ShopCollection? col;
  final String placement;
  final void Function(PartnerProduct p) onOpen;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final off = shopDiscount(p);
    final why = (col != null ? p.why[col] : null) ?? (p.why.values.isEmpty ? '' : p.why.values.first);
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: s.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: s.border.withValues(alpha: 0.5)),
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                button: true,
                label: p.name,
                child: GestureDetector(
                  onTap: () => onOpen(p),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(8)),
                      child: Stack(
                        children: [
                          if (p.image != null)
                            Center(
                              child: FractionallySizedBox(widthFactor: 0.86, heightFactor: 0.86, child: CommerceImage(p.image!, fit: BoxFit.contain)),
                            ),
                          _PartnerMark(partner: partner),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: () => onOpen(p),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 30,
                      child: Text(
                        p.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, height: 1.25, color: s.foreground),
                      ),
                    ),
                    const SizedBox(height: 2),
                    SizedBox(
                      height: 28,
                      child: Text.rich(
                        TextSpan(
                          children: [
                            if (p.campaign != null)
                              TextSpan(
                                text: '${p.campaign!.title} · ',
                                style: TextStyle(fontWeight: FontWeight.w700, color: s.primary),
                              ),
                            TextSpan(text: why),
                          ],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 10.5, height: 1.35, color: s.mutedForeground),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(child: _Price(p: p)),
                  const SizedBox(width: 4),
                  _QtyControl(id: p.id, placement: placement, compact: true),
                ],
              ),
            ],
          ),
          if (off > 0)
            PositionedDirectional(
              top: 4,
              start: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(6)),
                child: Text(
                  '-$off%',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The `Sheet` of PartnerShop.tsx (bottom, rounded-t-3xl, grabber + X, black/40 backdrop, max 88vh).
Future<void> _showShopSheet(BuildContext context, {required String label, required WidgetBuilder builder}) => showGeneralDialog<void>(
  context: context,
  barrierDismissible: true,
  barrierLabel: label,
  barrierColor: const Color(0x66000000),
  transitionDuration: Duration.zero,
  pageBuilder: (ctx, _, _) {
    final s = ctx.tokens.shadcn;
    final mq = MediaQuery.of(ctx);
    return Align(
      alignment: Alignment.bottomCenter,
      child: Semantics(
        scopesRoute: true,
        explicitChildNodes: true,
        namesRoute: true,
        label: label,
        child: Container(
          width: double.infinity,
          constraints: BoxConstraints(maxHeight: mq.size.height * 0.88),
          decoration: BoxDecoration(
            color: s.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(16, 12, 16, mq.padding.bottom + 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 32,
                  child: Stack(
                    children: [
                      Align(
                        alignment: Alignment.topCenter,
                        child: Container(
                          width: 40,
                          height: 6,
                          decoration: BoxDecoration(color: s.border, borderRadius: BorderRadius.circular(999)),
                        ),
                      ),
                      PositionedDirectional(
                        top: -2,
                        end: 0,
                        child: Semantics(
                          button: true,
                          label: tr('partnershop_close', 'Bağla'),
                          child: GestureDetector(
                            onTap: () => Navigator.of(ctx).pop(),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                              child: Center(child: AIcon(AIcons.x, size: 16, color: s.foreground)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                builder(ctx),
              ],
            ),
          ),
        ),
      ),
    );
  },
);

class _ProductSheet extends ConsumerWidget {
  const _ProductSheet({required this.p, required this.partner, required this.col, required this.placement});
  final PartnerProduct p;
  final ShopPartner? partner;
  final ShopCollection? col;
  final String placement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(partnerBasketProvider);
    final basket = ref.read(partnerBasketProvider.notifier);
    final s = context.tokens.shadcn;
    final off = shopDiscount(p);
    final why = (col != null ? p.why[col] : null) ?? (p.why.values.isEmpty ? null : p.why.values.first);
    final q = basket.qty(p.id);
    final white = const Color(0xFFFFFFFF);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        AspectRatio(
          aspectRatio: 5 / 4,
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(16)),
            child: Stack(
              children: [
                if (p.image != null)
                  Center(
                    child: FractionallySizedBox(widthFactor: 0.7, heightFactor: 0.85, child: CommerceImage(p.image!, fit: BoxFit.contain)),
                  ),
                _PartnerMark(partner: partner, size: 26),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: ByPartner(partner: partner),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Price(p: p, big: true),
              if (off > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                  child: Text(
                    '-$off%',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: s.primary),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            p.name,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, height: 1.375, color: s.foreground),
          ),
        ),
        if (p.campaign != null)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: s.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                AIcon(AIcons.tag, size: 16, color: s.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: p.campaign!.title,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(text: ' · ${formatTr('partnershop_until', '{date} tarixinə qədər', {'date': _fmtDay(p.campaign!.endsAt)})}'),
                      ],
                    ),
                    style: TextStyle(fontSize: 12.5, color: s.foreground),
                  ),
                ),
              ],
            ),
          ),
        if (why != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${tr('partnershop_why_for_you', 'Niyə sənə:')} ',
                    style: TextStyle(fontWeight: FontWeight.w700, color: s.primary),
                  ),
                  TextSpan(text: why),
                ],
              ),
              style: TextStyle(fontSize: 13, color: s.foreground),
            ),
          ),
        GestureDetector(
          key: const ValueKey('shop-sheet-add'),
          onTap: () {
            basket.set(p.id, q + 1);
            ref.read(shopTrackerProvider).event([p.id], 'add', placement);
            toasts(context).success(tr('partnershop_added_to_basket', 'Səbətə əlavə olundu'), duration: const Duration(milliseconds: 1200));
            Navigator.of(context).pop();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: s.gradientPrimary, borderRadius: BorderRadius.circular(16)),
            child: Text(
              q != 0
                  ? formatTr('partnershop_in_basket_add_one', 'Səbətdə {count} ədəd · bir dənə də at', {'count': q})
                  : tr('partnershop_add_to_basket', 'Səbətə at'),
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: white),
            ),
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          key: const ValueKey('shop-sheet-site'),
          onTap: () =>
              ref.read(partnerExternalOpenerProvider)(ref.read(shopTrackerProvider).visitLink(p.id, p.url, placement, '${placement}_${col ?? 'product'}')),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: s.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: s.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  partner != null
                      ? formatTr('partnershop_view_on_partner_site', '{partner} saytında bax', {'partner': partner!.name})
                      : tr('partnershop_view_on_site', 'Saytda bax'),
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: s.foreground),
                ),
                const SizedBox(width: 8),
                AIcon(AIcons.externalLink, size: 16, color: s.foreground),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          formatTr('partnershop_fulfilled_by', 'Məhsul, qiymət və çatdırılma {partner} tərəfindəndir.', {
            'partner': partner?.name ?? tr('partnershop_partner_lower', 'partnyor'),
          }),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: s.mutedForeground),
        ),
      ],
    );
  }
}

class _BasketSheet extends ConsumerWidget {
  const _BasketSheet({required this.products, required this.partners});
  final List<PartnerProduct> products;
  final Map<String, ShopPartner> partners;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(partnerBasketProvider);
    final s = context.tokens.shadcn;
    final lines = [
      for (final p in products)
        if ((items[p.id] ?? 0) > 0) (p: p, q: items[p.id]!),
    ];
    final ids = <String>[];
    for (final l in lines) {
      if (!ids.contains(l.p.partnerId)) ids.add(l.p.partnerId);
    }
    final total = lines.fold<double>(0, (a, l) => a + l.p.price * l.q);
    final old = lines.fold<double>(0, (a, l) => a + (l.p.originalPrice ?? l.p.price) * l.q);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            tr('partnershop_basket', 'Səbət'),
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: s.foreground),
          ),
        ),
        if (lines.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(
              tr('partnershop_basket_empty', 'Səbət boşdur. Məhsul əlavə et.'),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: s.mutedForeground),
            ),
          )
        else ...[
          for (final id in ids) ...[
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: ByPartner(partner: partners[id]),
            ),
            for (final l in lines.where((l) => l.p.partnerId == id))
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: s.border.withValues(alpha: 0.5)),
                      ),
                      child: l.p.image != null ? CommerceImage(l.p.image!, fit: BoxFit.contain) : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l.p.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: s.foreground),
                          ),
                          GestureDetector(
                            onTap: () => ref.read(partnerExternalOpenerProvider)(ref.read(shopTrackerProvider).visitLink(l.p.id, l.p.url, 'basket', 'basket')),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Flexible(
                                  child: Text(
                                    '${formatManat(l.p.price)} · ${formatTr('partnershop_buy_on_partner_site', '{partner} saytında al', {'partner': partners[id]?.name ?? tr('partnershop_partner_cap', 'Partnyor')})}',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.primary),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                AIcon(AIcons.externalLink, size: 12, color: s.primary),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _QtyControl(id: l.p.id, placement: 'basket', compact: true),
                  ],
                ),
              ),
            const SizedBox(height: 16),
          ],
          Container(
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: s.border)),
            ),
            child: Column(
              children: [
                if (old > total)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // text-emerald-700 (Tailwind literal)
                      Text(tr('partnershop_discount', 'Endirim'), style: const TextStyle(fontSize: 14, color: Color(0xFF047857))),
                      Text(
                        '−${formatManat(old - total)}',
                        style: const TextStyle(fontSize: 14, color: Color(0xFF047857), fontFeatures: tabularFigures),
                      ),
                    ],
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      tr('partnershop_total', 'Cəmi'),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: s.foreground),
                    ),
                    Text(
                      formatManat(total),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: s.foreground, fontFeatures: tabularFigures),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            tr('partnershop_phase_one_note', 'Birinci mərhələ: sifariş partnyorun saytında tamamlanır. Hər məhsulun yanındakı düymə onun səhifəsini açır.'),
            style: TextStyle(fontSize: 11, color: s.mutedForeground),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => ref.read(partnerBasketProvider.notifier).clear(),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: s.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: s.border),
              ),
              child: Text(
                tr('partnershop_clear_basket', 'Səbəti boşalt'),
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: s.foreground),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Fires impressions once per id list + placement (`useImpressions`).
class _Impressions extends ConsumerStatefulWidget {
  const _Impressions({required this.ids, required this.placement, required this.child});
  final List<String> ids;
  final String placement;
  final Widget child;

  @override
  ConsumerState<_Impressions> createState() => _ImpressionsState();
}

class _ImpressionsState extends ConsumerState<_Impressions> {
  String? _key;

  void _track() {
    final key = '${widget.ids.join(',')}|${widget.placement}';
    if (key == _key) return;
    _key = key;
    if (widget.ids.isNotEmpty) ref.read(shopTrackerProvider).impressions(widget.ids, widget.placement);
  }

  @override
  void initState() {
    super.initState();
    _track();
  }

  @override
  void didUpdateWidget(_Impressions oldWidget) {
    super.didUpdateWidget(oldWidget);
    _track();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _ProductGrid extends StatelessWidget {
  const _ProductGrid({required this.items, required this.partners, this.col, required this.placement, required this.onOpen});
  final List<PartnerProduct> items;
  final Map<String, ShopPartner> partners;
  final ShopCollection? col;
  final String placement;
  final void Function(PartnerProduct p, ShopCollection? c) onOpen;

  @override
  Widget build(BuildContext context) => _Impressions(
    ids: [for (final p in items) p.id],
    placement: placement,
    child: LayoutBuilder(
      builder: (context, c) {
        final w = (c.maxWidth - 8) / 2;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in items)
              SizedBox(
                width: w,
                child: _ProductCard(p: p, partner: partners[p.partnerId], col: col, placement: placement, onOpen: (x) => onOpen(x, col)),
              ),
          ],
        );
      },
    ),
  );
}

List<PartnerProduct> _byCollection(List<PartnerProduct> products, ShopCollection c) {
  final list = [
    for (final p in products)
      if (p.collections.contains(c)) p,
  ];
  _stableSortDesc(list);
  return list;
}

void _stableSortDesc(List<PartnerProduct> list) {
  final indexed = [for (var i = 0; i < list.length; i++) (i, list[i])];
  indexed.sort((a, b) {
    final d = b.$2.sort.compareTo(a.$2.sort);
    return d != 0 ? d : a.$1.compareTo(b.$1);
  });
  list
    ..clear()
    ..addAll(indexed.map((e) => e.$2));
}

/// Storefront block at the top of the Mağaza screen. Renders nothing when the server returns no partner products.
class PartnerShopSection extends ConsumerStatefulWidget {
  const PartnerShopSection({super.key});

  @override
  ConsumerState<PartnerShopSection> createState() => _PartnerShopSectionState();
}

class _PartnerShopSectionState extends ConsumerState<PartnerShopSection> {
  late String _col = ref.read(shopCollectionHandoffProvider).take() ?? 'for';
  final TextEditingController _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _openProduct(PartnerProduct p, ShopCollection? c, Map<String, ShopPartner> partners) {
    ref.read(shopTrackerProvider).event([p.id], 'open', 'shop');
    unawaited(
      _showShopSheet(
        context,
        label: p.name,
        builder: (_) => _ProductSheet(p: p, partner: partners[p.partnerId], col: c, placement: 'shop'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stage = ref.watch(shopStageProvider);
    final view = ref.watch(partnerStorefrontProvider);
    final products = view.data?.products ?? const <PartnerProduct>[];
    final partners = asPartnerMap(view.data?.partners);
    ref.watch(partnerBasketProvider);
    final basket = ref.read(partnerBasketProvider.notifier);
    final plan = shopPlan(stage);
    if (view.isLoading || products.isEmpty || plan == null) return const SizedBox.shrink();
    final s = context.tokens.shadcn;
    final byCol = {for (final c in shopCollections) c: _byCollection(products, c)};
    final partnerList = [
      for (final p in partners.values)
        if (products.any((x) => x.partnerId == p.id)) p,
    ];
    final preview = partnerList.any((p) => p.status != 'live');
    final order = [...plan.order, ...shopCollections.where((c) => !plan.order.contains(c))].where((c) => byCol[c]!.isNotEmpty).toList();
    final heroItems = byCol[plan.hero.collection]!;
    final lead = plan.hero.lead != null ? heroItems.where((p) => p.sku == plan.hero.lead).firstOrNull : null;
    final thumbs = (lead != null ? [lead, ...heroItems.where((p) => p != lead)] : heroItems).take(5).toList();
    final heroMissing = [
      for (final p in heroItems)
        if (basket.qty(p.id) == 0) p,
    ];
    String fold(String v) => v.toLowerCase();
    final q = _query.text.trim();
    final hits = q.isNotEmpty
        ? [
            for (final p in products)
              if (fold('${p.name} ${p.description ?? ''} ${partners[p.partnerId]?.name ?? ''}').contains(fold(q))) p,
          ]
        : const <PartnerProduct>[];
    void open(PartnerProduct p, ShopCollection? c) => _openProduct(p, c, partners);
    const white = Color(0xFFFFFFFF);

    return Semantics(
      container: true,
      label: tr('partnershop_partner_shops', 'Partnyor mağazaları'),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: s.card,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: s.border.withValues(alpha: 0.6)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              for (final p in partnerList.take(3))
                                if (p.iconUrl != null)
                                  Padding(
                                    padding: const EdgeInsetsDirectional.only(end: 6),
                                    child: ClipRRect(borderRadius: BorderRadius.circular(4), child: CommerceImage(p.iconUrl!, width: 16, height: 16)),
                                  ),
                              Text(
                                partnerList.length == 1
                                    ? formatTr('partnershop_with_partner', '{partner} ilə', {'partner': partnerList.first.name})
                                    : tr('partnershop_partner_shops', 'Partnyor mağazaları'),
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.foreground),
                              ),
                            ],
                          ),
                        ),
                        if (preview)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            // bg-amber-500/15 text-amber-700 (Tailwind literals)
                            decoration: BoxDecoration(color: const Color(0x26F59E0B), borderRadius: BorderRadius.circular(999)),
                            child: Text(
                              tr('partnershop_preview_admin', 'Önizləmə · yalnız admin'),
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFB45309)),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Semantics(
                    button: true,
                    excludeSemantics: true,
                    label: formatTr('partnershop_basket_count', 'Partnyor səbəti, {count} məhsul', {'count': basket.count}),
                    child: GestureDetector(
                      key: const ValueKey('shop-basket'),
                      onTap: () => unawaited(
                        _showShopSheet(
                          context,
                          label: tr('partnershop_partner_basket', 'Partnyor səbəti'),
                          builder: (_) => _BasketSheet(products: products, partners: partners),
                        ),
                      ),
                      child: SizedBox(
                        width: 36,
                        height: 36,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Positioned.fill(
                              child: Container(
                                decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                                child: Center(child: AIcon(AIcons.shoppingBag, size: 18, color: s.primary)),
                              ),
                            ),
                            if (basket.count > 0)
                              PositionedDirectional(
                                top: -4,
                                end: -4,
                                child: Container(
                                  constraints: const BoxConstraints(minWidth: 16),
                                  height: 16,
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(999)),
                                  child: Text(
                                    '${basket.count}',
                                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: white),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Semantics(
                label: tr('partnershop_search_aria', 'Partnyor məhsullarında axtar'),
                textField: true,
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
                  child: EditableTextField(
                    controller: _query,
                    placeholder: tr('partnershop_search_placeholder', 'Axtar: salfet, krem, bez...'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),
            ),
            if (q.isNotEmpty)
              hits.isNotEmpty
                  ? _ProductGrid(items: hits, partners: partners, placement: 'search', onOpen: open)
                  : Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        formatTr('partnershop_not_found', '"{query}" tapılmadı.', {'query': q}),
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 14, color: s.mutedForeground),
                      ),
                    )
            else ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(gradient: s.gradientPrimary, borderRadius: BorderRadius.circular(16)),
                child: DefaultTextStyle.merge(
                  style: const TextStyle(color: white),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Opacity(
                        opacity: 0.9,
                        child: Text(cssUpperText(plan.hero.eyebrow), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                      ),
                      const SizedBox(height: 4),
                      Text(plan.hero.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, height: 1.25)),
                      const SizedBox(height: 4),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 220),
                        child: Opacity(opacity: 0.95, child: Text(plan.hero.text, style: const TextStyle(fontSize: 12))),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          for (final p in thumbs)
                            Padding(
                              padding: const EdgeInsetsDirectional.only(end: 6),
                              child: Container(
                                width: 40,
                                height: 40,
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(8)),
                                child: p.image != null ? CommerceImage(p.image!, fit: BoxFit.contain) : null,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            formatTr('partnershop_product_count', '{count} məhsul', {'count': heroItems.length}),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                          if (plan.hero.collection == 'bag')
                            GestureDetector(
                              key: const ValueKey('shop-hero-bundle'),
                              onTap: heroMissing.isEmpty
                                  ? null
                                  : () {
                                      basket.addMany([for (final p in heroMissing) p.id]);
                                      ref.read(shopTrackerProvider).event([for (final p in heroMissing) p.id], 'bundle', 'shop_hero');
                                      toasts(context)
                                          .success(tr('partnershop_bundle_added', 'Dəst səbətə əlavə olundu'), duration: const Duration(milliseconds: 1400));
                                    },
                              child: Opacity(
                                opacity: heroMissing.isEmpty ? 0.8 : 1,
                                child: _HeroButton(
                                  label: heroMissing.isNotEmpty
                                      ? tr('partnershop_add_all', 'Hamısını səbətə at')
                                      : tr('partnershop_in_basket_check', 'Səbətdədir ✓'),
                                ),
                              ),
                            )
                          else
                            GestureDetector(
                              onTap: () => setState(() => _col = plan.hero.collection),
                              child: _HeroButton(label: tr('partnershop_view', 'Bax')),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Semantics(
                  label: tr('partnershop_categories', 'Kateqoriyalar'),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final c in ['for', ...order])
                          Padding(
                            padding: const EdgeInsetsDirectional.only(end: 6),
                            child: Semantics(
                              button: true,
                              selected: _col == c,
                              child: GestureDetector(
                                onTap: () => setState(() => _col = c),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    gradient: _col == c ? s.gradientPrimary : null,
                                    color: _col == c ? null : s.card,
                                    borderRadius: BorderRadius.circular(8),
                                    border: _col == c ? null : Border.all(color: s.border.withValues(alpha: 0.5)),
                                  ),
                                  child: Text(
                                    c == 'for' ? tr('partnershop_for_you', 'Sənin üçün') : shopCollectionLabel[c]!,
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _col == c ? white : s.mutedForeground),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (_col == 'for')
                for (final c in plan.order.where((c) => byCol[c]!.isNotEmpty))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                shopCollectionLabel[c]!,
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: s.foreground),
                              ),
                              GestureDetector(
                                onTap: () => setState(() => _col = c),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      tr('partnershop_all', 'Hamısı'),
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.primary),
                                    ),
                                    AIcon(AIcons.chevronRight, size: 12, color: s.primary, mirrorInRtl: true),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        _ProductGrid(items: byCol[c]!.take(4).toList(), partners: partners, col: c, placement: 'shop_for', onOpen: open),
                      ],
                    ),
                  )
              else
                _ProductGrid(items: byCol[_col] ?? const [], partners: partners, col: _col, placement: 'shop_$_col', onOpen: open),
            ],
            const SizedBox(height: 12),
            Text(
              tr('partnershop_prices_note', 'Qiymətləri partnyorlar idarə edir və dəyişə bilər. Sifariş partnyorun saytında tamamlanır.'),
              style: TextStyle(fontSize: 10.5, color: s.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(999)),
    child: Text(
      label,
      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: context.tokens.shadcn.primary),
    ),
  );
}

String cssUpperText(String s) => s.toUpperCase();

/// Stage-aware home promo. Opens the Mağaza screen on the matching collection.
class PartnerHomeCard extends ConsumerWidget {
  const PartnerHomeCard({super.key, required this.lifeStage, this.pregnancyWeek, this.babyMonths, this.daysUntilPeriod, this.recovering = false, this.onOpen});
  final String? lifeStage;
  final int? pregnancyWeek;
  final int? babyMonths;
  final int? daysUntilPeriod;
  final bool recovering;
  final void Function(String screen)? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(partnerStorefrontProvider).data;
    final plan = shopPlan(
      ShopStageInput(lifeStage: lifeStage, pregnancyWeek: pregnancyWeek, babyMonths: babyMonths, daysUntilPeriod: daysUntilPeriod, recovering: recovering),
    );
    final items = plan == null ? const <PartnerProduct>[] : _byCollection(data?.products ?? const [], plan.hero.collection);
    final lead = plan?.hero.lead != null ? items.where((p) => p.sku == plan!.hero.lead).firstOrNull : null;
    final thumbs = (lead != null ? [lead, ...items.where((p) => p != lead)] : items).take(4).toList();
    final placement = 'home_${lifeStage ?? 'x'}';
    if (plan == null || items.isEmpty || data == null) {
      return const SizedBox.shrink();
    }
    final partnerById = asPartnerMap(data.partners);
    final ownerIds = <String>[];
    for (final p in items) {
      if (!ownerIds.contains(p.partnerId)) ownerIds.add(p.partnerId);
    }
    final owners = [
      for (final id in ownerIds)
        if (partnerById[id] != null) partnerById[id]!,
    ];
    final preview = owners.any((p) => p.status != 'live');
    final s = context.tokens.shadcn;
    void go() {
      ref.read(shopTrackerProvider).event([for (final p in thumbs) p.id], 'open', placement);
      ref.read(shopCollectionHandoffProvider).request(plan.hero.collection);
      if (onOpen != null) {
        onOpen!('shop');
      } else {
        ref.read(shellProvider.notifier).dispatchPushEvent(const PushNavIntent(screen: 'shop'));
      }
    }

    final minPrice = items.map((p) => p.price).reduce((a, b) => a < b ? a : b);
    return _Impressions(
      ids: [for (final p in thumbs) p.id],
      placement: placement,
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Semantics(
          button: true,
          child: GestureDetector(
            key: const ValueKey('partner-home-card'),
            behavior: HitTestBehavior.opaque,
            onTap: go,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: s.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: s.border.withValues(alpha: 0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            if (owners.length == 1 && owners.first.iconUrl != null)
                              Padding(
                                padding: const EdgeInsetsDirectional.only(end: 6),
                                child: ClipRRect(borderRadius: BorderRadius.circular(4), child: CommerceImage(owners.first.iconUrl!, width: 16, height: 16)),
                              ),
                            Flexible(
                              child: Text(
                                cssUpperText(
                                  '${owners.length == 1 ? formatTr('partnershop_with_partner', '{partner} ilə', {'partner': owners.first.name}) : tr('partnershop_partners', 'Partnyorlar')} · ${plan.hero.eyebrow}',
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, letterSpacing: 0.5, color: s.primary),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (preview)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0x26F59E0B), borderRadius: BorderRadius.circular(999)),
                          child: Text(
                            tr('partnershop_preview', 'Önizləmə'),
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xFFB45309)),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    plan.hero.title,
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.375, color: s.foreground),
                  ),
                  const SizedBox(height: 2),
                  Text(plan.hero.text, style: TextStyle(fontSize: 12, color: s.mutedForeground)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      for (final p in thumbs)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 6),
                          child: Container(
                            width: 44,
                            height: 44,
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFFFF),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: s.border.withValues(alpha: 0.5)),
                            ),
                            child: Stack(
                              children: [
                                if (p.image != null) Positioned.fill(child: CommerceImage(p.image!, fit: BoxFit.contain)),
                                _PartnerMark(partner: partnerById[p.partnerId], size: 14),
                              ],
                            ),
                          ),
                        ),
                      // `ms-auto`: pushed to the end; the label shrinks instead of overflowing on narrow screens.
                      Expanded(
                        child: Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Flexible(
                                  child: Text(
                                    formatTr('partnershop_from_price', '{price}-dan', {'price': formatManat(minPrice)}),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: s.primary),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                AIcon(AIcons.chevronRight, size: 14, color: s.primary, mirrorInRtl: true),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
