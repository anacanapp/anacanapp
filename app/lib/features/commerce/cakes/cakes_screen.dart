// Ported from: src/components/CakesScreen.tsx, src/components/cakes/CakeDetailScreen.tsx,
//              src/components/cakes/CakeCartDrawer.tsx, src/components/cakes/CakeOrderForm.tsx,
//              src/components/cakes/cakes.css
//
// Cakes (AZ): catalogue, cake page, cart drawer and the order form. In-app cakes are paid by card only, through
// Epoint: cake-checkout prices the order on the server and returns the payment page (opened in the browser).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show addDays, addMonths, differenceInCalendarDays, formatYmd, parseIsoDateFns, pad2;
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../shell/shell.dart' show isCakesAvailable, scrollMemoryProvider;
import '../../../state/cake_cart_store.dart';
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../settings/ui/settings_ui.dart' show ALoader, toasts;
import '../commerce_backend.dart';
import '../common/commerce_ui.dart';
import '../qaygicash/qaygicash.dart';
import '../qaygicash/qaygicash_copy.dart' show qk;
import '../qaygicash/qaygicash_hooks.dart' show invalidateQaygiCash;
import '../qaygicash/qc_parts.dart';
import 'cakes_data.dart';

const String _partyPackage = 'party_package';

/// `openExternal(url)` of lib/books/api.ts (`window.open(url, '_blank')`) → the system browser.
final cakeCheckoutOpenerProvider = Provider<void Function(String url)>(
  (ref) =>
      (url) => unawaited(launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).then((_) {}, onError: (Object _) {})),
);

/// `trackEvent(name, params)` of useScreenAnalytics.
void _track(WidgetRef ref, String event, Map<String, Object?> params) {
  try {
    ref.read(analyticsSinkProvider).logEvent(event, params);
  } catch (_) {}
}

bool _secret(String label) => RegExp('gizli|secret', caseSensitive: false).hasMatch(label);

/// A `position: fixed` element of the cakes pages (`.ck-bar`): drawn in the route's overlay at [bottom] from the
/// window's bottom edge (above the bottom nav), so it works inside the shell's scroll view and inside a tool.
class _FixedBottom extends StatefulWidget {
  const _FixedBottom({required this.child, required this.bar});
  final Widget child;
  final Widget bar;

  @override
  State<_FixedBottom> createState() => _FixedBottomState();
}

class _FixedBottomState extends State<_FixedBottom> {
  final OverlayPortalController _portal = OverlayPortalController();

  @override
  void initState() {
    super.initState();
    _portal.show();
  }

  @override
  Widget build(BuildContext context) => OverlayPortal(
    controller: _portal,
    overlayChildBuilder: (ctx) {
      final bottom = MediaQuery.paddingOf(ctx).bottom;
      return Positioned(
        left: 0,
        right: 0,
        bottom: 72 + bottom,
        child: AScope(child: widget.bar),
      );
    },
    child: widget.child,
  );
}

/// `.ck-bar` chrome.
class _CkBar extends StatelessWidget {
  const _CkBar({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        color: a.surface.withValues(alpha: 0.94),
        border: Border(top: BorderSide(color: a.line)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 10), children[i]],
        ],
      ),
    );
  }
}

/// `.ck-cta` (52 high, coral, 15/900).
class _CkCta extends StatelessWidget {
  const _CkCta({required this.onTap, required this.child, this.ctaKey});
  final VoidCallback? onTap;
  final Widget child;
  final Key? ctaKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final body = PressScale.css(
      key: ctaKey,
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.6 : 1,
        child: Container(
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(16), boxShadow: a.coralShadow),
          child: DefaultTextStyle.merge(
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: a.onCoral),
            child: IconTheme.merge(
              data: IconThemeData(color: a.onCoral),
              child: child,
            ),
          ),
        ),
      ),
    );
    return Expanded(child: body);
  }
}

/// `.ck-iconbtn` (44, radius 14, surface, lift shadow) with an optional `.ck-badge`.
class _CkIconBtn extends StatelessWidget {
  const _CkIconBtn({required this.icon, required this.onTap, required this.label, this.badge = 0, this.glass = false, this.btnKey});
  final AIconData icon;
  final VoidCallback onTap;
  final String label;
  final int badge;
  final bool glass;
  final Key? btnKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        key: btnKey,
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: glass ? a.surface.withValues(alpha: 0.9) : a.surface,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: a.liftShadow,
                  ),
                  child: Center(
                    child: AIcon(icon, size: 18, strokeWidth: 2.2, color: a.ink, mirrorInRtl: icon == AIcons.arrowLeft),
                  ),
                ),
              ),
              if (badge > 0)
                PositionedDirectional(
                  top: -4,
                  end: -4,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 18),
                    height: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(9)),
                    child: Text(
                      '$badge',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: a.onCoral, height: 1),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `.ck-chip` (`.on`: deep; `.sm`).
class _CkChip extends StatelessWidget {
  const _CkChip({required this.label, required this.on, required this.onTap, this.small = false, this.expand = false});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final bool small;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: small ? const EdgeInsets.symmetric(horizontal: 11, vertical: 6) : const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          alignment: expand ? Alignment.center : null,
          decoration: BoxDecoration(
            color: on ? a.deep : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: on ? a.deep : a.line),
          ),
          child: Text(
            label,
            maxLines: 1,
            style: TextStyle(fontSize: small ? 12 : 13, fontWeight: FontWeight.w800, color: on ? a.onDeep : a.ink),
          ),
        ),
      ),
    );
  }
}

/// The 60px cake thumbnail of `.ck-row` (or a cake icon).
Widget _rowImage(BuildContext context, Map<String, dynamic> cake) {
  final a = context.a;
  final url = cake['image_url'];
  return url is String && url.isNotEmpty
      ? ClipRRect(borderRadius: BorderRadius.circular(14), child: CommerceImage(url, width: 60, height: 60))
      : Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(14)),
          child: Center(child: AIcon(AIcons.cake, size: 22, color: a.ink)),
        );
}

class CakesScreen extends ConsumerStatefulWidget {
  const CakesScreen({super.key, this.onBack, this.initialMonth});
  final VoidCallback? onBack;
  final int? initialMonth;

  @override
  ConsumerState<CakesScreen> createState() => _CakesScreenState();
}

class _CakesScreenState extends ConsumerState<CakesScreen> {
  /// 'all' | category key | month number (int).
  late Object _filter = widget.initialMonth ?? 'all';
  Cake? _selected;
  bool _showCheckout = false;
  bool _showSuccess = false;
  QcOrderNote? _orderQc;
  String? _justAdded;
  Timer? _justAddedTimer;

  @override
  void dispose() {
    _justAddedTimer?.cancel();
    super.dispose();
  }

  void _scrollTop() {
    try {
      ref.read(scrollMemoryProvider).scrollToTop();
    } catch (_) {}
  }

  void _set(VoidCallback fn) {
    setState(fn);
    _scrollTop();
  }

  void _open(Cake cake, String source) {
    _track(ref, 'cake_viewed', {'cake_id': cake.id, 'category': cake.category, 'source': source});
    _set(() => _selected = cake);
  }

  void _quickAdd(Cake cake) {
    if (!canQuickAdd(cake)) {
      _open(cake, 'quick_add');
      return;
    }
    ref.read(cakeCartProvider.notifier).addToCart(cake.row, 1, const {});
    _track(ref, 'cake_added_to_cart', {'cake_id': cake.id, 'category': cake.category, 'source': 'card', 'value': cake.price});
    setState(() => _justAdded = cake.id);
    _justAddedTimer?.cancel();
    _justAddedTimer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted && _justAdded == cake.id) setState(() => _justAdded = null);
    });
    toasts(context).show(title: tr('cakedetailscreen_sebete_elave_edildi_e0f576', 'Səbətə əlavə edildi! 🎂'), description: cake.name);
  }

  void _openCart() => unawaited(showCakeCart(context, onCheckout: () => _set(() => _showCheckout = true)));

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final storeCountry = ref.watch(userStoreProvider.select((s) => s.countryCode));
    final profileCountry = ref.watch(authProfileProvider.select((p) => p?.countryCode));
    final isAdmin = ref.watch(isAdminProvider);
    // Defence in depth: this tool is for Azerbaijan only (whatever the entry point).
    final cakesOk = isAdmin || isCakesAvailable(profileCountry != null && profileCountry.isNotEmpty ? profileCountry : storeCountry, language);
    final q = ref.watch(cakesQuery);
    final cakes = q.data ?? const <Cake>[];
    final loading = q.data == null && !q.isError;
    final totalItems = ref.watch(cakeCartProvider.select((s) => s.totalItems));
    final child = ref.watch(childrenProvider).selectedChild;
    final a = context.a;

    if (!cakesOk) return const SizedBox.shrink();

    if (_showSuccess) {
      return AScope(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  margin: const EdgeInsets.only(bottom: 22),
                  decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(30)),
                  child: const Center(child: AIcon(AIcons.check, size: 44, strokeWidth: 3, color: Color(0xFFFFFFFF))),
                ),
                Text(
                  tr('cakesscreen_sifarisiniz_qebul_edildi_ae5b9e', 'Sifarişiniz qəbul edildi!'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, height: 1.15, color: a.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('cakesscreen_tezlikle_sizinle_elaqe_saxlanilacaq_806311', 'Tezliklə sizinlə əlaqə saxlanılacaq'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, height: 1.5, color: a.inkSoft),
                ),
                const SizedBox(height: 18),
                QcSuccessNote(note: _orderQc),
                if (_orderQc != null) const SizedBox(height: 18),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: Row(
                    children: [
                      _CkCta(
                        ctaKey: const ValueKey('cakes-back-to-list'),
                        onTap: () => _set(() {
                          _showSuccess = false;
                          _orderQc = null;
                          _showCheckout = false;
                          _selected = null;
                        }),
                        child: Text(tr('cakesscreen_tortlara_qayit_c533c2', 'Tortlara qayıt')),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_showCheckout) {
      return CakeOrderForm(
        onBack: () => _set(() => _showCheckout = false),
        onSuccess: (qc) => _set(() {
          _orderQc = qc;
          _showSuccess = true;
        }),
      );
    }

    final selected = _selected;
    if (selected != null) {
      return CakeDetailScreen(key: ValueKey('cake-${selected.id}'), cake: selected, onBack: () => _set(() => _selected = null), onOpenCart: _openCart);
    }

    final present = cakeCategoryOrder.where((k) => cakes.any((c) => categoryOf(c) == k)).toList();
    Cake? partyPackage;
    for (final c in cakes) {
      if (c.milestoneType == _partyPackage) {
        partyPackage = c;
        break;
      }
    }
    final f = _filter;
    final list = f is int
        ? cakes.where((c) => c.category == 'month' && c.monthNumber == f).toList()
        : f == 'all'
        ? cakes
        : cakes.where((c) => categoryOf(c) == f).toList();

    // The child's next month birthday: the monthly cake for it and how many days are left.
    ({int month, Cake cake, int days, String name})? nextMonth;
    if (child != null && child.birthDate.isNotEmpty) {
      final months = getChildAge(child).months;
      if (months >= 0 && months < 12) {
        final month = months + 1;
        Cake? cake;
        for (final c in cakes) {
          if (c.category == 'month' && c.monthNumber == month) {
            cake = c;
            break;
          }
        }
        final birth = parseIsoDateFns(child.birthDate);
        if (cake != null && birth != null) {
          final days = differenceInCalendarDays(addMonths(birth, month), DateTime.now());
          nextMonth = (month: month, cake: cake, days: days < 0 ? 0 : days, name: child.name.isNotEmpty ? child.name : tr('cakesscreen_baby', 'Körpəniz'));
        }
      }
    }

    Widget card(Cake cake, {double? width}) {
      final body = Container(
        key: ValueKey('cake-card-${cake.id}'),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [BoxShadow(offset: Offset(0, 10), blurRadius: 24, spreadRadius: -18, color: Color.fromRGBO(0, 0, 0, 0.45))], // cakes.css literal
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              button: true,
              label: cake.name,
              child: GestureDetector(
                onTap: () => _open(cake, 'card'),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: ColoredBox(color: a.surfaceSoft, child: cake.imageUrl != null ? CommerceImage(cake.imageUrl!) : null),
                      ),
                      PositionedDirectional(
                        top: 8,
                        start: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: a.surface.withValues(alpha: 0.92), borderRadius: BorderRadius.circular(999)),
                          child: Text(
                            cake.category == 'month' && cake.monthNumber != null && cake.monthNumber != 0
                                ? cakeMonthLabel(cake.monthNumber!, language)
                                : cake.milestoneLabel ?? categoryShort(categoryOf(cake)),
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: a.coralText),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    cake.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, height: 1.25, color: a.ink),
                  ),
                  const SizedBox(height: 6),
                  QcProductBadge(channel: 'cake', priceMinor: toMinor(cake.price)),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        cakeMoney(cake.price),
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: a.coralText),
                      ),
                      Semantics(
                        button: true,
                        label: tr('cakesscreen_add_to_cart', 'Səbətə əlavə et'),
                        child: GestureDetector(
                          key: ValueKey('cake-add-${cake.id}'),
                          onTap: () => _quickAdd(cake),
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(11)),
                            child: Center(
                              child: _justAdded == cake.id
                                  ? AIcon(AIcons.check, size: 16, strokeWidth: 3, color: a.onCoral)
                                  : AIcon(AIcons.plus, size: 17, strokeWidth: 2.6, color: a.onCoral),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
      return width == null ? body : SizedBox(width: width, child: body);
    }

    Widget grid(List<Cake> items, {double top = 4}) => Padding(
      padding: EdgeInsets.fromLTRB(18, top, 18, 0),
      child: LayoutBuilder(
        builder: (context, c) {
          final w = (c.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [for (final cake in items) card(cake, width: w)]);
        },
      ),
    );

    Widget chips(List<Widget> children, {double top = 14}) => SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: EdgeInsets.fromLTRB(18, top, 18, 2),
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 8), children[i]],
        ],
      ),
    );

    Widget head(String key, {Widget? link, double bottom = 10}) => Padding(
      padding: EdgeInsets.fromLTRB(18, 20, 18, bottom),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  categoryLabel(key),
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: a.ink),
                ),
                const SizedBox(height: 2),
                Text(categorySub(key), style: TextStyle(fontSize: 12.5, color: a.inkSoft)),
              ],
            ),
          ),
          ?link,
        ],
      ),
    );

    final monthMode = f == 'month' || f is int;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(18, 14, 18, 10),
          child: Row(
            children: [
              if (widget.onBack != null) ...[
                _CkIconBtn(icon: AIcons.arrowLeft, label: tr('common_back', 'Geri'), onTap: widget.onBack!),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr('cakesscreen_eyebrow_brand', 'Anacan tortları').toUpperCase(),
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.92, color: a.coralText),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tr('cakesscreen_title_v3', 'Hər ayın tortu'),
                      style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900, height: 1.15, color: a.ink),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _CkIconBtn(
                btnKey: const ValueKey('cakes-cart'),
                icon: AIcons.shoppingBag,
                label: tr('cakesscreen_cart', 'Səbət'),
                badge: totalItems,
                onTap: _openCart,
              ),
            ],
          ),
        ),
        if (loading)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              children: [
                Container(
                  height: 230,
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(26)),
                ),
                const SizedBox(height: 12),
                LayoutBuilder(
                  builder: (context, c) {
                    final w = (c.maxWidth - 12) / 2;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        for (var i = 0; i < 4; i++)
                          Container(
                            width: w,
                            height: w * 4 / 3,
                            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20)),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          )
        else ...[
          if (f == 'all' && nextMonth != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: GestureDetector(
                key: const ValueKey('cakes-next-month'),
                onTap: () {
                  _track(ref, 'cake_next_month_clicked', {'month': nextMonth!.month, 'days': nextMonth.days});
                  _open(nextMonth.cake, 'next_month');
                },
                child: Container(
                  height: 230,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(26)),
                  child: Stack(
                    children: [
                      if (nextMonth.cake.imageUrl != null) Positioned.fill(child: CommerceImage(nextMonth.cake.imageUrl!)),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          // linear-gradient(transparent, rgba(40, 15, 10, .74)) (cakes.css literal)
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x00280F0A), Color.fromRGBO(40, 15, 10, 0.74)],
                            ),
                          ),
                          child: DefaultTextStyle.merge(
                            style: const TextStyle(color: Color(0xFFFFFFFF)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                                  decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                                  child: Text(
                                    nextMonth.days == 0
                                        ? tr('cakesscreen_next_today', 'Bu gün')
                                        : tr('cakesscreen_next_days', '{n} gün qalıb').replaceAll('{n}', '${nextMonth.days}'),
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFFFFFFF)),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  nextMonth.month == 12
                                      ? tr('cakesscreen_next_year', '{name} 1 yaşını qeyd edir').replaceAll('{name}', nextMonth.name)
                                      : tr(
                                          'cakesscreen_next_month',
                                          '{name} {m} aylıq olur',
                                        ).replaceAll('{name}', nextMonth.name).replaceAll('{m}', '${nextMonth.month}'),
                                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, height: 1.2),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Opacity(
                                        opacity: 0.92,
                                        child: Text(
                                          '${nextMonth.cake.name} · ${cakeMoney(nextMonth.cake.price)}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                      decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(999)),
                                      // .ck-hero-cta { color: #c4262e } (cakes.css literal)
                                      child: Text(
                                        tr('cakesscreen_order_now', 'Sifariş et'),
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFFC4262E)),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Semantics(
            label: tr('cakesscreen_categories', 'Kateqoriyalar'),
            child: chips([
              _CkChip(label: tr('cakesscreen_hamisi_plain', 'Hamısı'), on: f == 'all', onTap: () => _set(() => _filter = 'all')),
              for (final key in present)
                _CkChip(label: categoryShort(key), on: f == key || (key == 'month' && f is int), onTap: () => _set(() => _filter = key)),
            ]),
          ),
          if (monthMode)
            chips(top: 8, [
              for (var m = 1; m <= 12; m++)
                _CkChip(small: true, label: cakeMonthLabel(m, language), on: f == m, onTap: () => _set(() => _filter = f == m ? 'month' : m)),
            ]),
          if (f == 'all' && partyPackage != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
              child: GestureDetector(
                key: const ValueKey('cakes-party'),
                onTap: () => _open(partyPackage!, 'promo'),
                child: Container(
                  padding: const EdgeInsetsDirectional.fromSTEB(10, 10, 14, 10),
                  decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(22)),
                  child: Row(
                    children: [
                      partyPackage.imageUrl != null
                          ? ClipRRect(borderRadius: BorderRadius.circular(14), child: CommerceImage(partyPackage.imageUrl!, width: 64, height: 64))
                          : AIcon(AIcons.gift, size: 28, color: a.ink),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${partyPackage.name} · ${cakeMoney(partyPackage.price)}',
                              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: a.ink),
                            ),
                            const SizedBox(height: 2),
                            Text(tr('cakesscreen_party_sub', '2 kq tort, smash cake, 6 kapkeyk, topper'), style: TextStyle(fontSize: 12.5, color: a.inkSoft)),
                          ],
                        ),
                      ),
                      AIcon(AIcons.chevronRight, size: 18, color: a.coralText, mirrorInRtl: true),
                    ],
                  ),
                ),
              ),
            ),
          if (f == 'all')
            for (final key in present) ...[
              head(
                key,
                link: GestureDetector(
                  onTap: () => _set(() => _filter = key),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        tr('cakesscreen_see_all_n', 'Hamısı · {n}').replaceAll('{n}', '${cakes.where((c) => categoryOf(c) == key).length}'),
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: a.coralText),
                      ),
                      const SizedBox(width: 2),
                      AIcon(AIcons.chevronRight, size: 15, color: a.coralText, mirrorInRtl: true),
                    ],
                  ),
                ),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, cake) in cakes.where((c) => categoryOf(c) == key).indexed) ...[
                        if (i > 0) const SizedBox(width: 12),
                        card(cake, width: 152),
                      ],
                    ],
                  ),
                ),
              ),
            ]
          else ...[
            if (f is String) head(f, bottom: 6),
            if (list.isNotEmpty)
              grid(list, top: f is int ? 14 : 4)
            else
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22)),
                child: Text(
                  tr('cakesscreen_bu_kateqoriyada_tort_tapilmadi_330a9b', 'Bu kateqoriyada tort tapılmadı'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: a.inkSoft),
                ),
              ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: Row(
              children: [
                AIcon(AIcons.truck, size: 16, strokeWidth: 2, color: a.inkSoft),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tr('cakesscreen_delivery_note', 'Bakı daxili çatdırılma · sifariş ən azı 48 saat qabaqcadan'),
                    style: TextStyle(fontSize: 12, color: a.inkSoft),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 140),
      ],
    );

    final page = AScope(
      child: ColoredBox(color: a.bg, child: content),
    );
    if (totalItems <= 0) return page;
    return _FixedBottom(
      bar: _CkBar(
        children: [
          _CkCta(
            ctaKey: const ValueKey('cakes-view-cart'),
            onTap: _openCart,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AIcon(AIcons.shoppingBag, size: 18, strokeWidth: 2.2, color: a.onCoral),
                const SizedBox(width: 8),
                Text('${tr('cakesscreen_view_cart', 'Səbətə bax')} · $totalItems'),
              ],
            ),
          ),
        ],
      ),
      child: page,
    );
  }
}

class CakeDetailScreen extends ConsumerStatefulWidget {
  const CakeDetailScreen({super.key, required this.cake, required this.onBack, required this.onOpenCart});
  final Cake cake;
  final VoidCallback onBack;
  final VoidCallback onOpenCart;

  @override
  ConsumerState<CakeDetailScreen> createState() => _CakeDetailScreenState();
}

class _CakeDetailScreenState extends ConsumerState<CakeDetailScreen> {
  int _quantity = 1;
  final Map<String, TextEditingController> _fields = {};
  String _flavor = cakeFlavors.first;
  bool _photoBox = false;
  int _image = 0;

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _add(int extra, double unit, bool showCustom) {
    final cake = widget.cake;
    final fields = <String, String>{
      cakeFlavorField: _flavor,
      if (showCustom)
        for (final e in _fields.entries)
          if (e.value.text.isNotEmpty) e.key: e.value.text,
    };
    if (extra != 0) fields[CakePhotoBox.field] = CakePhotoBox.value;
    ref.read(cakeCartProvider.notifier).addToCart(cake.row, _quantity, fields, extra);
    _track(ref, 'cake_added_to_cart', {
      'cake_id': cake.id, 'category': cake.category, 'source': 'detail', 'value': unit * _quantity, 'photo_box': extra != 0, 'flavor': _flavor, //
    });
    toasts(context).show(title: tr('cakedetailscreen_sebete_elave_edildi_e0f576', 'Səbətə əlavə edildi! 🎂'), description: '${cake.name} x$_quantity');
    widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    final cake = widget.cake;
    final a = context.a;
    final totalItems = ref.watch(cakeCartProvider.select((s) => s.totalItems));
    final images = [if (cake.imageUrl != null) cake.imageUrl!, ...cake.images.where((i) => i != cake.imageUrl)];
    final labels = cake.customFieldLabels ?? const <String>[];
    final showCustom = cake.hasCustomFields && labels.isNotEmpty;
    final specs = cakeSpecs(cake.description);
    final story = cakeStory(cake.description);
    final offerBox = isBento(cake);
    final extra = offerBox && _photoBox ? CakePhotoBox.extra : 0;
    final unit = cake.price + extra;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final height = MediaQuery.sizeOf(context).height;

    final gallery = LayoutBuilder(
      builder: (context, c) {
        final side = c.maxWidth < height * 0.62 ? c.maxWidth : height * 0.62;
        return GestureDetector(
          onHorizontalDragEnd: (d) {
            final v = d.primaryVelocity ?? 0;
            if (v.abs() < 50 || images.length < 2) return;
            final forward = rtl ? v > 0 : v < 0;
            setState(() => _image = forward ? (_image + 1) % images.length : (_image - 1 + images.length) % images.length);
          },
          child: Container(
            height: side,
            color: a.surfaceSoft,
            child: Stack(
              children: [
                if (images.isNotEmpty) Positioned.fill(child: CommerceImage(_photoBox && offerBox ? CakePhotoBox.image : images[_image])),
                Positioned(
                  top: MediaQuery.paddingOf(context).top + 12,
                  left: 16,
                  right: 16,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _CkIconBtn(glass: true, icon: AIcons.arrowLeft, label: tr('common_back', 'Geri'), onTap: widget.onBack),
                      _CkIconBtn(
                        btnKey: const ValueKey('cake-detail-cart'),
                        glass: true,
                        icon: AIcons.shoppingBag,
                        label: tr('cakesscreen_cart', 'Səbət'),
                        badge: totalItems,
                        onTap: widget.onOpenCart,
                      ),
                    ],
                  ),
                ),
                if (images.length > 1 && !_photoBox)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 34,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < images.length; i++)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            child: Semantics(
                              button: true,
                              label: '${i + 1}',
                              child: GestureDetector(
                                onTap: () => setState(() => _image = i),
                                child: Container(
                                  width: i == _image ? 18 : 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: i == _image ? const Color(0xFFFFFFFF) : const Color(0x99FFFFFF),
                                    borderRadius: BorderRadius.circular(3),
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
          ),
        );
      },
    );

    Widget spec(String value, String label) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 9),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink),
            ),
            Text(label, style: TextStyle(fontSize: 12, color: a.inkSoft)),
          ],
        ),
      ),
    );
    final ckLabel = TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: a.ink);
    final sheet = Transform.translate(
      offset: const Offset(0, -24),
      child: Container(
        constraints: BoxConstraints(minHeight: height * 0.4),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 190),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${categoryLabel(categoryOf(cake))}${cake.category != 'month' && cake.milestoneLabel != null ? ' · ${cake.milestoneLabel}' : ''}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: a.coralText),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        cake.name,
                        key: const ValueKey('cake-detail-name'),
                        style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, height: 1.2, color: a.ink),
                      ),
                      const SizedBox(height: 6),
                      QcProductBadge(channel: 'cake', priceMinor: toMinor(cake.price), fontSize: 12),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  cakeMoney(cake.price),
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: a.coralText),
                ),
              ],
            ),
            if (specs.size != null || specs.weight != null || specs.people != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  for (final (i, s) in [
                    if (specs.size != null) spec(specs.size!, tr('cakedetail_size', 'ölçü')),
                    if (specs.weight != null) spec(specs.weight!, tr('cakedetail_weight', 'çəki')),
                    if (specs.people != null) spec(specs.people!, tr('cakedetail_people', 'nəfərlik')),
                  ].indexed) ...[if (i > 0) const SizedBox(width: 8), s],
                ],
              ),
            ],
            if (story.isNotEmpty) ...[const SizedBox(height: 16), Text(story, style: TextStyle(fontSize: 14, height: 1.5, color: a.inkSoft))],
            const SizedBox(height: 16),
            Text(tr('cakedetail_flavor', 'Dad'), style: ckLabel),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [for (final fl in cakeFlavors) _CkChip(label: fl, on: _flavor == fl, onTap: () => setState(() => _flavor = fl))],
            ),
            if (showCustom)
              for (final (i, label) in labels.indexed) ...[
                const SizedBox(height: 16),
                Text(label, style: ckLabel),
                const SizedBox(height: 8),
                CommerceTextField(
                  fieldKey: ValueKey('ck-field-$i'),
                  controller: _fields.putIfAbsent(label, TextEditingController.new),
                  obscure: _secret(label),
                  radius: 14,
                  fontSize: 15,
                  borderColor: a.lineStrong,
                  focusColor: a.coral,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                ),
              ],
            if (offerBox) ...[
              const SizedBox(height: 16),
              Semantics(
                button: true,
                toggled: _photoBox,
                child: GestureDetector(
                  key: const ValueKey('cake-photo-box'),
                  onTap: () => setState(() => _photoBox = !_photoBox),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _photoBox ? a.coralSoft : a.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: _photoBox ? a.coral : a.line, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(borderRadius: BorderRadius.circular(12), child: const CommerceImage(CakePhotoBox.image, width: 56, height: 56)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tr('cakedetail_photo_box', 'Foto qutusuna çevir'),
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink),
                              ),
                              Text(
                                tr('cakedetail_photo_box_sub', 'Bento + 6 kapkeyk bir pəncərəli qutuda'),
                                style: TextStyle(fontSize: 12.5, color: a.inkSoft),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          '+${cakeMoney(CakePhotoBox.extra)}',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: _photoBox ? a.coral : null,
                            borderRadius: BorderRadius.circular(7),
                            border: Border.all(color: _photoBox ? a.coral : a.lineStrong, width: 2),
                          ),
                          child: _photoBox ? const Center(child: AIcon(AIcons.check, size: 14, strokeWidth: 3, color: Color(0xFFFFFFFF))) : null,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );

    return _FixedBottom(
      bar: _CkBar(
        children: [
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: a.line),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(
                  button: true,
                  label: '−',
                  child: GestureDetector(
                    onTap: () => setState(() => _quantity = _quantity - 1 < 1 ? 1 : _quantity - 1),
                    child: SizedBox(
                      width: 36,
                      height: 44,
                      child: Center(child: AIcon(AIcons.minus, size: 16, strokeWidth: 2.4, color: a.ink)),
                    ),
                  ),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 18),
                  child: Text(
                    '$_quantity',
                    key: const ValueKey('cake-qty'),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w900, color: a.ink),
                  ),
                ),
                Semantics(
                  button: true,
                  label: '+',
                  child: GestureDetector(
                    key: const ValueKey('cake-qty-plus'),
                    onTap: () => setState(() => _quantity = _quantity + 1 > 10 ? 10 : _quantity + 1),
                    child: SizedBox(
                      width: 36,
                      height: 44,
                      child: Center(child: AIcon(AIcons.plus, size: 16, strokeWidth: 2.4, color: a.ink)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          _CkCta(
            ctaKey: const ValueKey('cake-detail-add'),
            onTap: () => _add(extra, unit, showCustom),
            child: Text('${tr('cakedetail_add', 'Səbətə əlavə et')} · ${cakeMoney(unit * _quantity)}'),
          ),
        ],
      ),
      child: AScope(
        child: ColoredBox(
          color: a.bg,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [gallery, sheet]),
        ),
      ),
    );
  }
}

/// `<CakeCartDrawer open onClose onCheckout />`.
Future<void> showCakeCart(BuildContext context, {required VoidCallback onCheckout}) => showGeneralDialog<void>(
  context: context,
  barrierDismissible: true,
  barrierLabel: tr('cakesscreen_cart', 'Səbət'),
  barrierColor: const Color.fromRGBO(20, 10, 8, 0.5), // CakeCartDrawer literal
  transitionDuration: Duration.zero,
  pageBuilder: (ctx, _, _) => Align(
    alignment: Alignment.bottomCenter,
    child: CakeCartSheet(
      onClose: () => Navigator.of(ctx).pop(),
      onCheckout: () {
        Navigator.of(ctx).pop();
        onCheckout();
      },
    ),
  ),
);

class CakeCartSheet extends ConsumerWidget {
  const CakeCartSheet({super.key, required this.onClose, required this.onCheckout});
  final VoidCallback onClose;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cakeCartProvider);
    final actions = ref.read(cakeCartProvider.notifier);
    final a = context.a;
    final mq = MediaQuery.of(context);
    final items = cart.items;
    return AScope(
      child: Semantics(
        scopesRoute: true,
        explicitChildNodes: true,
        namesRoute: true,
        label: tr('cakesscreen_cart', 'Səbət'),
        child: Container(
          key: const ValueKey('cake-cart-sheet'),
          constraints: BoxConstraints(maxHeight: mq.size.height * 0.86),
          decoration: BoxDecoration(
            color: a.bg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                  child: Container(
                    width: 40,
                    height: 5,
                    decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(3)),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${tr('cakesscreen_cart', 'Səbət')}${cart.totalItems > 0 ? ' · ${cart.totalItems}' : ''}',
                        style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, height: 1.15, color: a.ink),
                      ),
                    ),
                    _CkIconBtn(icon: AIcons.x, label: tr('common_close', 'Bağla'), onTap: onClose),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                  child: items.isEmpty
                      ? Container(
                          margin: const EdgeInsets.only(top: 8, bottom: 20),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
                          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22)),
                          child: Column(
                            children: [
                              AIcon(AIcons.shoppingBag, size: 34, color: a.coralText),
                              const SizedBox(height: 10),
                              Text(tr('cakecartdrawer_sebet_bosdur_ff5b34', 'Səbət boşdur'), style: TextStyle(fontSize: 14, color: a.inkSoft)),
                            ],
                          ),
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final (index, item) in items.indexed) ...[
                              if (index > 0) const SizedBox(height: 10),
                              Container(
                                key: ValueKey('cake-cart-line-$index'),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20)),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _rowImage(context, item.cake),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.stretch,
                                        children: [
                                          Text(
                                            '${item.cake['name'] ?? ''}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink),
                                          ),
                                          () {
                                            final details = [
                                              for (final e in item.customFields.entries)
                                                if (e.value.isNotEmpty) _secret(e.key) ? '${e.key}: ••••' : e.value,
                                            ].join(' · ');
                                            return details.isEmpty
                                                ? const SizedBox.shrink()
                                                : Text(
                                                    details,
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: TextStyle(fontSize: 12, color: a.inkSoft),
                                                  );
                                          }(),
                                          const SizedBox(height: 6),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Container(
                                                height: 36,
                                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                                decoration: BoxDecoration(
                                                  borderRadius: BorderRadius.circular(12),
                                                  border: Border.all(color: a.line),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    GestureDetector(
                                                      key: ValueKey('cake-cart-minus-$index'),
                                                      onTap: () => actions.updateQuantity(index, item.quantity - 1),
                                                      child: SizedBox(
                                                        width: 30,
                                                        height: 32,
                                                        child: Center(child: AIcon(AIcons.minus, size: 14, color: a.ink)),
                                                      ),
                                                    ),
                                                    Text(
                                                      '${item.quantity}',
                                                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: a.ink),
                                                    ),
                                                    GestureDetector(
                                                      key: ValueKey('cake-cart-plus-$index'),
                                                      onTap: () => actions.updateQuantity(index, item.quantity + 1),
                                                      child: SizedBox(
                                                        width: 30,
                                                        height: 32,
                                                        child: Center(child: AIcon(AIcons.plus, size: 14, color: a.ink)),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Text(
                                                cakeMoney(cakeUnitPrice(item) * item.quantity),
                                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: a.ink),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    Semantics(
                                      button: true,
                                      label: tr('common_delete', 'Sil'),
                                      child: GestureDetector(
                                        key: ValueKey('cake-cart-remove-$index'),
                                        onTap: () => actions.removeItem(index),
                                        child: Padding(
                                          padding: const EdgeInsets.all(4),
                                          child: AIcon(AIcons.trash2, size: 17, color: a.inkSoft),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                ),
              ),
              if (items.isNotEmpty)
                Container(
                  padding: EdgeInsets.fromLTRB(18, 12, 18, mq.padding.bottom + 88),
                  decoration: BoxDecoration(
                    color: a.surface,
                    border: Border(top: BorderSide(color: a.line)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(tr('cakecartdrawer_cemi_fbbec6', 'Cəmi:'), style: TextStyle(fontSize: 16, color: a.inkSoft)),
                          Text(
                            cakeMoney(cart.totalPrice),
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: a.ink),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _CkCta(
                            ctaKey: const ValueKey('cake-cart-checkout'),
                            onTap: onCheckout,
                            child: Text('${tr('cakecartdrawer_checkout', 'Sifarişə keç')} · ${cakeMoney(cart.totalPrice)}'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class CakeOrderForm extends ConsumerStatefulWidget {
  const CakeOrderForm({super.key, required this.onBack, required this.onSuccess, this.now});
  final VoidCallback onBack;

  /// Called after the order is placed; carries the QayğıCash note for the success screen.
  final void Function(QcOrderNote? qc) onSuccess;

  /// Clock (tests).
  final DateTime Function()? now;

  @override
  ConsumerState<CakeOrderForm> createState() => _CakeOrderFormState();
}

class _CakeOrderFormState extends ConsumerState<CakeOrderForm> {
  static const List<String> _slots = ['10:00–13:00', '14:00–18:00'];
  late final DateTime _today = widget.now?.call() ?? DateTime.now();
  // Orders need 48 hours: the first day offered is the day after tomorrow.
  late final List<DateTime> _days = [for (var i = 0; i < 12; i++) addDays(_today, i + 2)];
  String _mode = 'delivery';
  late String _slot = _slots.first;
  late String _date = formatYmd(_days.first);
  final TextEditingController _customer = TextEditingController();
  final TextEditingController _child = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _address = TextEditingController();
  final TextEditingController _notes = TextEditingController();
  bool _submitting = false;
  final QcRedeemController _qc = QcRedeemController();

  @override
  void initState() {
    super.initState();
    _qc.addListener(_changed);
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    _qc.removeListener(_changed);
    _qc.dispose();
    for (final c in [_customer, _child, _phone, _address, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(QcRedeemState qc, int totalMinor, int cakeRate) async {
    final toast = toasts(context);
    void fail(String description) => toast.show(title: tr('cakeorderform_xeta_3cdbb6', 'Xəta'), description: description, destructive: true);
    final items = ref.read(cakeCartProvider).items;
    if (_customer.text.trim().isEmpty) return fail(tr('cakeorderform_musteri_adi_teleb_olunur_fc1733', 'Müştəri adı tələb olunur'));
    if (_phone.text.trim().isEmpty) return fail(tr('cakeorderform_elaqe_nomresi_teleb_olunur_1c55b7', 'Əlaqə nömrəsi tələb olunur'));
    if (_mode == 'delivery' && _address.text.trim().isEmpty) return fail(tr('cakeorderform_address_required', 'Çatdırılma ünvanını yazın'));
    if (items.isEmpty) return fail(tr('cakeorderform_sebet_bosdur_ff5b34', 'Səbət boşdur'));
    setState(() => _submitting = true);
    final client = ref.read(queryClientProvider);
    try {
      // Card only, through Epoint (cake-checkout prices the order on the server and returns the payment page).
      final used = qc.amount;
      final res = await ref.read(commerceBackendProvider).invoke('cake-checkout', {
        'items': [
          for (final item in items)
            {'cake_id': '${item.cake['id']}', 'qty': item.quantity, 'photo_box': (item.extraPrice ?? 0) > 0, 'fields': item.customFields},
        ],
        'customer_name': _customer.text.trim(),
        'child_name': _child.text.trim(),
        'contact_phone': _phone.text.trim(),
        'delivery_date': _date,
        'slot': _slot,
        'mode': _mode,
        'delivery_address': _address.text.trim(),
        'notes': _notes.text.trim(),
        'language': currentLanguage(),
        if (used > 0) 'cashback': toAzn(used),
      });
      final data = res.data;
      final url = res.error == null && data is Map && data['checkout_url'] is String ? data['checkout_url'] as String : null;
      if (url == null) {
        final body = functionErrorBody(res.error);
        final code = body is Map && body['error'] is String ? body['error'] as String : '';
        if (RegExp(r'^QC_[A-Z_]+$').hasMatch(code)) {
          unawaited(invalidateQaygiCash(client));
          toast.show(title: qk(qcErrorKey(code)), destructive: true);
        } else if (code == 'payments_unavailable') {
          toast.show(title: tr('cake_card_unavailable', 'Kartla ödəniş müvəqqəti əlçatan deyil. Bir az sonra yenidən yoxlayın.'), destructive: true);
        } else {
          fail(tr('cakeorderform_sifaris_gonderile_bilmedi_52b41e', 'Sifariş göndərilə bilmədi'));
        }
        return;
      }
      if (used > 0) {
        qcTrack(ref, 'qc_redeem_commit', {'channel': 'cake', 'amount_minor': used});
        unawaited(invalidateQaygiCash(client));
      }
      ref.read(cakeCheckoutOpenerProvider)(url);
      ref.read(cakeCartProvider.notifier).clearCart();
      toast.show(title: tr('cake_pay_opened', 'Ödəniş səhifəsi açıldı. Ödənişdən sonra sifarişiniz təsdiqlənəcək. 🎂'));
      widget.onSuccess(QcOrderNote(earnMinor: earnPreview(totalMinor - used, cakeRate), usedMinor: used, digital: false));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final cart = ref.watch(cakeCartProvider);
    final items = cart.items;
    // QayğıCash: up to max % of the order, reserved by cake-checkout; the card is charged the rest and the cake earns on it.
    final totalMinor = toMinor(cart.totalPrice);
    final qc = qcRedeemState(ref, _qc, 'cake', totalMinor);
    final cakeRate = rateOf(qc.wallet, 'cake');
    final earn = earnPreview(totalMinor - qc.amount, cakeRate);
    final netTotal = toAzn(totalMinor - qc.amount);
    final weekdays = [
      tr('wd_sun', 'B.'), tr('wd_mon', 'B.e.'), tr('wd_tue', 'Ç.a.'), tr('wd_wed', 'Ç.'), tr('wd_thu', 'C.a.'), tr('wd_fri', 'C.'), tr('wd_sat', 'Ş.'), //
    ];
    final label = TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: a.ink);
    Widget field(String text, Widget input) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(text, style: label),
        const SizedBox(height: 8),
        input,
      ],
    );
    CommerceTextField input(TextEditingController c, String key, {String? placeholder, TextInputType? keyboard, bool multiline = false}) => CommerceTextField(
      fieldKey: ValueKey(key),
      controller: c,
      placeholder: placeholder,
      keyboardType: keyboard,
      minLines: multiline ? 3 : null,
      maxLines: multiline ? 6 : 1,
      minHeight: multiline ? 84 : 48,
      radius: 14,
      fontSize: 15,
      borderColor: a.lineStrong,
      focusColor: a.coral,
      padding: multiline ? const EdgeInsets.symmetric(horizontal: 14, vertical: 12) : const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );
    final picked = parseIsoDateFns(_date) ?? _days.first;
    final gap = const SizedBox(height: 18);

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
                child: Row(
                  children: [
                    _CkIconBtn(icon: AIcons.arrowLeft, label: tr('common_back', 'Geri'), onTap: widget.onBack),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${items.length} ${tr('cakeorderform_cakes_n', 'tort')} · ${cakeMoney(cart.totalPrice)}'.toUpperCase(),
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.92, color: a.coralText),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tr('cakeorderform_title_v3', 'Sifariş'),
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, height: 1.15, color: a.ink),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (i, item) in items.indexed) ...[
                      if (i > 0) const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20)),
                        child: Row(
                          children: [
                            _rowImage(context, item.cake),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${item.cake['name'] ?? ''}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink),
                                  ),
                                  Text(
                                    [
                                      'x${item.quantity}',
                                      for (final e in item.customFields.entries)
                                        if (e.value.isNotEmpty) _secret(e.key) ? '••••' : e.value,
                                    ].join(' · '),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 12, color: a.inkSoft),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              cakeMoney(cakeUnitPrice(item) * item.quantity),
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: a.ink),
                            ),
                          ],
                        ),
                      ),
                    ],
                    gap,
                    Text(tr('cakeorderform_when', 'Nə vaxt?'), style: label),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final (i, d) in _days.indexed) ...[
                            if (i > 0) const SizedBox(width: 8),
                            () {
                              final value = formatYmd(d);
                              final on = _date == value;
                              return Semantics(
                                selected: on,
                                button: true,
                                child: GestureDetector(
                                  key: ValueKey('ck-day-$value'),
                                  onTap: () => setState(() => _date = value),
                                  child: Container(
                                    width: 62,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      color: on ? a.deep : a.surface,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: on ? a.deep : a.line),
                                    ),
                                    child: Column(
                                      children: [
                                        Text(
                                          '${d.day}',
                                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: on ? a.onDeep : a.ink),
                                        ),
                                        Text(weekdays[d.weekday % 7], style: TextStyle(fontSize: 11.5, color: on ? a.onDeep : a.ink)),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }(),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        for (final (i, value) in _slots.indexed) ...[
                          if (i > 0) const SizedBox(width: 8),
                          Expanded(
                            child: _CkChip(label: value, on: _slot == value, expand: true, onTap: () => setState(() => _slot = value)),
                          ),
                        ],
                      ],
                    ),
                    gap,
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16)),
                      child: Row(
                        children: [
                          for (final (i, m) in const ['delivery', 'pickup'].indexed) ...[
                            if (i > 0) const SizedBox(width: 4),
                            Expanded(
                              child: GestureDetector(
                                key: ValueKey('ck-mode-$m'),
                                onTap: () => setState(() => _mode = m),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: _mode == m ? a.coral : null, borderRadius: BorderRadius.circular(12)),
                                  child: Text(
                                    m == 'delivery' ? tr('cakeorderform_mode_delivery', 'Çatdırılma') : tr('cakeorderform_mode_pickup', 'Özüm götürəcəm'),
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _mode == m ? a.onCoral : a.ink),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (_mode == 'delivery') ...[
                      gap,
                      field(
                        tr('cakeorderform_catdirilma_unvani_5cec99', 'Çatdırılma ünvanı'),
                        input(_address, 'ck-addr', placeholder: tr('cakeorderform_unvani_daxil_edin_b8da41', 'Ünvanı daxil edin')),
                      ),
                    ],
                    gap,
                    field(
                      tr('cakeorderform_musteri_adi_e9554d', 'Müştəri adı *'),
                      input(_customer, 'ck-cname', placeholder: tr('cakeorderform_adinizi_daxil_edin_bd2b57', 'Adınızı daxil edin')),
                    ),
                    const SizedBox(height: 14),
                    field(
                      tr('cakeorderform_elaqe_nomresi_feb8b9', 'Əlaqə nömrəsi *'),
                      input(_phone, 'ck-phone', placeholder: '+994 XX XXX XX XX', keyboard: TextInputType.phone),
                    ),
                    const SizedBox(height: 14),
                    field(
                      tr('cakeorderform_usagin_adi_80632b', 'Uşağın adı'),
                      input(_child, 'ck-child', placeholder: tr('cakeorderform_korpenin_adi_8a4e9e', 'Körpənin adı')),
                    ),
                    const SizedBox(height: 14),
                    field(
                      tr('cakeorderform_elave_qeydler_c98a42', 'Əlavə qeydlər'),
                      input(
                        _notes,
                        'ck-notes',
                        placeholder: tr('cakeorderform_xususi_istekler_allergiya_ve_s_49d429', 'Xüsusi istəklər, allergiya və s.'),
                        multiline: true,
                      ),
                    ),
                    gap,
                    Text(tr('cakeorderform_odenis_usulu_b9d87a', 'Ödəniş üsulu'), style: label),
                    const SizedBox(height: 8),
                    Semantics(
                      selected: true,
                      enabled: false,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: a.coralSoft,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: a.coral, width: 1.5),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: a.coral, width: 5),
                              ),
                            ),
                            const SizedBox(width: 12),
                            AIcon(AIcons.creditCard, size: 24, color: a.coralText),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tr('cake_pay_card', 'Kartla ödəniş'),
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink),
                                  ),
                                  Row(
                                    children: [
                                      AIcon(AIcons.lock, size: 11, color: a.inkSoft),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: Text(
                                          tr('cake_pay_card_sub', 'Epoint ilə təhlükəsiz onlayn ödəniş'),
                                          style: TextStyle(fontSize: 12, color: a.inkSoft),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (qc.wallet != null && qc.limits.show) ...[gap, QcRedeemRow(state: qc)],
                    gap,
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final item in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text('${item.cake['name'] ?? ''} x${item.quantity}', style: TextStyle(fontSize: 14, color: a.inkSoft)),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(cakeMoney(cakeUnitPrice(item) * item.quantity), style: TextStyle(fontSize: 14, color: a.ink)),
                                ],
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    _mode == 'delivery' ? tr('cakeorderform_mode_delivery', 'Çatdırılma') : tr('cakeorderform_mode_pickup', 'Özüm götürəcəm'),
                                    style: TextStyle(fontSize: 14, color: a.inkSoft),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text('${pad2(picked.day)}.${pad2(picked.month)} · $_slot', style: TextStyle(fontSize: 14, color: a.ink)),
                              ],
                            ),
                          ),
                          if (qc.amount > 0)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: QcSummaryLine(amount: qc.amount, fontSize: 14),
                            ),
                          Container(
                            padding: const EdgeInsets.only(top: 8),
                            decoration: BoxDecoration(
                              border: Border(top: BorderSide(color: a.lineStrong)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  tr('cakeorderform_cemi_fbbec6', 'Cəmi:'),
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: a.ink),
                                ),
                                Text(
                                  cakeMoney(netTotal),
                                  key: const ValueKey('ck-total'),
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: a.ink),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (earn > 0) ...[gap, QcEarnBox(amount: earn)],
                    gap,
                    Row(
                      children: [
                        _CkCta(
                          ctaKey: const ValueKey('ck-submit'),
                          onTap: _submitting ? null : () => unawaited(_submit(qc, totalMinor, cakeRate)),
                          child: _submitting
                              ? ALoader(size: 18, color: a.onCoral)
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    AIcon(AIcons.creditCard, size: 18, strokeWidth: 2.2, color: a.onCoral),
                                    const SizedBox(width: 8),
                                    Flexible(
                                      child: Text(
                                        '${tr('cake_pay_and_order', 'Ödə və sifariş ver')} · ${cakeMoney(netTotal)}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ],
                    ),
                    gap,
                    Text(
                      tr('cakeorderform_fine', 'Sifariş ən azı 48 saat qabaqcadan qəbul olunur. Qənnadı təsdiqləyəndə sizə zəng edəcək.'),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: a.inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
