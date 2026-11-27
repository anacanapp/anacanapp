// Ported from: src/components/aptek/AptekScreen.tsx, src/styles/aptek.css (.ap-grid, .ap-banner, .ap-kinds,
//              .ap-gallery*, .ap-dots, .ap-pd-price, .ap-bar, .ap-line, .ap-sum, .ap-meter, .ap-slots, .ap-slot,
//              .ap-field, .ap-track, .ap-tstep, .ap-note)
//
// Anacan Aptek: store home, product list, product page, cart, checkout (cash / card on delivery, QayğıCash),
// success and orders. Views are a stack inside the screen (Android back pops one, then leaves the screen).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../domain/aptek/aptek_pricing.dart';
import '../../../shell/shell.dart' show BackLayer, backDispatcherProvider, initialAptekView;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../partner/ui/confetti.dart' show showCelebrateConfetti;
import '../../settings/ui/settings_ui.dart' show ShadSelect, toasts;
import '../../tools/hub/fold_text.dart' show foldQuery;
import '../commerce_backend.dart';
import '../common/commerce_ui.dart';
import '../qaygicash/qaygicash.dart';
import '../qaygicash/qaygicash_copy.dart' show qk;
import '../qaygicash/qc_parts.dart';
import 'aptek_data.dart';
import 'aptek_entry.dart' show AptekBanner;
import 'aptek_parts.dart';

const List<String> _kinds = ['bottles', 'cups', 'bowls', 'cutlery', 'appliances', 'food'];
const String _recentKey = 'anacan-aptek-recent';
const String _checkoutKey = 'anacan-aptek-checkout';

/// A view of the store's internal stack.
class AptekView {
  const AptekView(this.name, {this.id, this.kind, this.query, this.deals = false, this.number, this.qc});
  final String name; // home | list | product | cart | checkout | success | orders
  final String? id;
  final String? kind;
  final String? query;
  final bool deals;
  final String? number;
  final QcOrderNote? qc;
}

AptekView _initialView(String? screen) {
  final v = initialAptekView(screen);
  return AptekView(v.name, id: v.id);
}

// Coupon state is shared between cart and checkout through a module-level holder.
AptekCoupon? _sharedCoupon;

class AptekScreen extends ConsumerStatefulWidget {
  const AptekScreen({super.key, required this.onBack, this.initialScreen});
  final VoidCallback onBack;
  final String? initialScreen;

  @override
  ConsumerState<AptekScreen> createState() => _AptekScreenState();
}

class _AptekScreenState extends ConsumerState<AptekScreen> {
  late List<AptekView> _stack;
  final ScrollController _scroll = ScrollController();
  VoidCallback? _releaseBack;

  @override
  void initState() {
    super.initState();
    final first = _initialView(widget.initialScreen);
    _stack = first.name == 'home' ? [first] : [const AptekView('home'), first];
    _releaseBack = ref.read(backDispatcherProvider).push(() {
      _pop();
      return true;
    }, BackLayer.screen);
  }

  @override
  void dispose() {
    _releaseBack?.call();
    _scroll.dispose();
    super.dispose();
  }

  AptekView get _view => _stack.last;

  void _toTop() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(0);
    });
  }

  void _push(AptekView v) {
    setState(() => _stack = [..._stack, v]);
    _toTop();
  }

  void _pop() {
    if (_stack.length > 1) {
      setState(() => _stack = _stack.sublist(0, _stack.length - 1));
      _toTop();
    } else {
      widget.onBack();
    }
  }

  void _reset(AptekView v) {
    setState(() => _stack = v.name == 'home' ? [v] : [const AptekView('home'), v]);
    _toTop();
  }

  List<String> _readRecent() {
    final v = ref.read(localStoreProvider).readJson(_recentKey);
    return v is List ? [for (final x in v) '$x'] : <String>[];
  }

  void _openProduct(AptekProduct p) {
    final recent = _readRecent().where((id) => id != p.id).toList();
    ref.read(localStoreProvider).writeJson(_recentKey, [p.id, ...recent].take(12).toList());
    _push(AptekView('product', id: p.id));
  }

  void _setQty(AptekCart cart, String id, int n) {
    final wasEmpty = cart.quantityOf(id) == 0;
    final toast = toasts(context);
    unawaited(
      cart.setQuantity(id, n).catchError((Object _) {
        toast.error(ap('err_generic'));
      }),
    );
    if (wasEmpty && n > 0) toast.success(ap('added'), duration: const Duration(milliseconds: 1500));
  }

  void _addBundle(AptekCart cart, List<AptekProduct> products, List<String> skus) {
    unawaited(HapticFeedback.mediumImpact());
    final toast = toasts(context);
    for (final sku in skus) {
      AptekProduct? p;
      for (final x in products) {
        if (x.sku == sku) {
          p = x;
          break;
        }
      }
      if (p != null && cart.quantityOf(p.id) == 0) {
        unawaited(
          cart.setQuantity(p.id, 1).catchError((Object _) {
            toast.error(ap('err_generic'));
          }),
        );
      }
    }
    toast.success(ap('added'), duration: const Duration(milliseconds: 1500));
  }

  Widget _shell(String title, {List<Widget> actions = const [], required List<Widget> children, Widget? bar}) {
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    A3TopBar(title: title, onBack: _pop, actions: actions, titleKey: const ValueKey('aptek-title')),
                    ...children,
                  ],
                ),
              ),
            ),
            ?bar,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ref.watch(isAdminProvider);
    final availability = ref.watch(aptekAvailableProvider);
    final config = availability.config;
    final productsQ = ref.watch(aptekProductsQuery);
    final products = productsQ.data ?? const <AptekProduct>[];
    final isLoading = productsQ.isLoading;
    final cart = ref.watch(aptekCartProvider);
    final byId = {for (final p in products) p.id: p};
    final a = context.a;

    if (!availability.available) {
      return _shell(
        ap('title'),
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 48),
            child: Column(
              children: [
                const CommerceMascot(stage: 'mommy', width: 110),
                const SizedBox(height: 6),
                Text(
                  ap('err_disabled'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w700, color: a.ink),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final view = _view;
    final c = _Common(
      products: products,
      byId: byId,
      cart: cart,
      config: config,
      openProduct: _openProduct,
      setQty: (id, n) => _setQty(cart, id, n),
      addBundle: (skus) => _addBundle(cart, products, skus),
      push: _push,
      recent: _readRecent,
    );
    final title = view.name == 'cart'
        ? ap('cart_title')
        : view.name == 'checkout'
        ? ap('checkout')
        : view.name == 'orders'
        ? ap('my_orders')
        : ap('title');
    final showCart = !(view.name == 'cart' || view.name == 'checkout' || view.name == 'success');
    final actions = [
      if (showCart)
        A3IconButton(
          buttonKey: const ValueKey('aptek-cart-button'),
          icon: AIcons.shoppingBag,
          label: ap('cart_n', {'n': cart.count}),
          count: cart.count,
          onTap: () => _push(const AptekView('cart')),
        ),
    ];
    final head = <Widget>[
      if (isAdmin && config?.enabled != true)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _Note(
            child: Text.rich(
              TextSpan(
                children: [
                  WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: AIcon(AIcons.info, size: 14, color: a.inkSoft),
                  ),
                  TextSpan(text: ' ${ap('admin_preview')}'),
                ],
              ),
            ),
          ),
        ),
      if (isLoading)
        _Grid(
          children: [
            for (var i = 0; i < 4; i++)
              Opacity(
                opacity: 0.5,
                child: Container(
                  height: 250,
                  decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
                ),
              ),
          ],
        ),
    ];

    switch (view.name) {
      case 'list':
        return _shell(
          title,
          actions: actions,
          children: [
            ...head,
            if (!isLoading) _ProductList(key: ValueKey('list-${_stack.length}'), c: c, initial: view),
          ],
        );
      case 'product':
        final p = byId[view.id];
        return _shell(
          title,
          actions: actions,
          children: [
            ...head,
            if (!isLoading) _ProductPage(key: ValueKey('product-${view.id}'), c: c, id: view.id ?? ''),
          ],
          bar: !isLoading && p != null ? _ProductBar(key: ValueKey('bar-${view.id}'), c: c, p: p) : null,
        );
      case 'cart':
        return _CartView(
          c: c,
          shell: (children, bar) => _shell(title, actions: actions, children: [...head, ...children], bar: bar),
          onCheckout: () => _push(const AptekView('checkout')),
        );
      case 'checkout':
        return _CheckoutView(
          c: c,
          shell: (children, bar) => _shell(title, actions: actions, children: [...head, ...children], bar: bar),
          onDone: (number, qc) {
            showCelebrateConfetti(context);
            _reset(AptekView('success', number: number, qc: qc));
          },
        );
      case 'success':
        return _shell(
          title,
          actions: actions,
          children: [
            ...head,
            _SuccessView(
              number: view.number ?? '',
              qc: view.qc,
              onOrders: () => _reset(const AptekView('orders')),
              onHome: () => _reset(const AptekView('home')),
            ),
          ],
        );
      case 'orders':
        return _shell(
          title,
          actions: actions,
          children: [
            ...head,
            _OrdersView(byId: byId),
          ],
        );
      default:
        return _shell(
          title,
          actions: actions,
          children: [
            ...head,
            if (!isLoading) _StoreHome(c: c),
          ],
        );
    }
  }
}

class _Common {
  const _Common({
    required this.products,
    required this.byId,
    required this.cart,
    required this.config,
    required this.openProduct,
    required this.setQty,
    required this.addBundle,
    required this.push,
    required this.recent,
  });
  final List<AptekProduct> products;
  final Map<String, AptekProduct> byId;
  final AptekCart cart;
  final AptekConfig? config;
  final void Function(AptekProduct p) openProduct;
  final void Function(String id, int n) setQty;
  final void Function(List<String> skus) addBundle;
  final void Function(AptekView v) push;
  final List<String> Function() recent;
}

class _Note extends StatelessWidget {
  const _Note({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontSize: 13, height: 1.45, color: a.inkSoft),
        child: child,
      ),
    );
  }
}

/// `.ap-grid`: two columns, gap 10.
class _Grid extends StatelessWidget {
  const _Grid({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final w = (c.maxWidth - 10) / 2;
      final rows = <Widget>[];
      for (var i = 0; i < children.length; i += 2) {
        rows.add(
          Padding(
            padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(width: w, child: children[i]),
                  const SizedBox(width: 10),
                  SizedBox(width: w, child: i + 1 < children.length ? children[i + 1] : null),
                ],
              ),
            ),
          ),
        );
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
    },
  );
}

/// `.a3-search` pill with an input.
class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.controller, this.onSubmitted, this.onChanged, this.trailing, this.placeholder, this.icon = true, this.fieldKey});
  final TextEditingController controller;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final Widget? trailing;
  final String? placeholder;
  final bool icon;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      height: 50,
      margin: const EdgeInsets.only(bottom: 14),
      padding: EdgeInsetsDirectional.only(start: 16, end: trailing != null ? 4 : 16),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), boxShadow: a.cardShadow),
      child: Row(
        children: [
          if (icon) ...[AIcon(AIcons.search, size: 18, color: a.inkSoft), const SizedBox(width: 10)],
          Expanded(
            child: CommerceTextField(
              fieldKey: fieldKey,
              controller: controller,
              bare: true,
              placeholder: placeholder ?? ap('search_placeholder'),
              textInputAction: TextInputAction.search,
              onSubmitted: onSubmitted,
              onChanged: onChanged,
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
        ],
      ),
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({required this.title, required this.items, required this.c, this.onMore});
  final String title;
  final List<AptekProduct> items;
  final _Common c;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return ASection(
      title: title,
      linkLabel: onMore != null ? ap('filter_all') : null,
      onLink: onMore,
      child: A3Rail(
        children: [
          for (final p in items)
            AptekProductCard(variant: 'rail', product: p, qty: c.cart.quantityOf(p.id), onOpen: () => c.openProduct(p), onQty: (n) => c.setQty(p.id, n)),
        ],
      ),
    );
  }
}

class _StoreHome extends StatefulWidget {
  const _StoreHome({required this.c});
  final _Common c;

  @override
  State<_StoreHome> createState() => _StoreHomeState();
}

class _StoreHomeState extends State<_StoreHome> {
  final TextEditingController _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final a = context.a;
    final deals = c.products.where((p) => discountPct(p) > 0).toList();
    final recent = [
      for (final id in c.recent())
        if (c.byId[id] != null) c.byId[id]!,
    ];
    final pct = c.config?.bundleDiscountPct ?? 10;
    final kinds = _kinds.where((k) => c.products.any((p) => p.kind == k)).toList();
    const tones = ['c-blue', 'c-green', 'c-peach', 'c-lav', 'c-yellow', 'c-pink'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SearchBox(
          fieldKey: const ValueKey('aptek-home-search'),
          controller: _q,
          onSubmitted: (v) {
            if (v.trim().isNotEmpty) c.push(AptekView('list', query: v.trim()));
          },
        ),
        AptekBanner(eyebrow: ap('with_partner'), count: c.products.length, freeMin: c.config?.freeShippingMin ?? 30, stage: 'mommy', mascotWidth: 92),
        ASection(
          title: ap('categories'),
          child: LayoutBuilder(
            builder: (context, box) {
              final w = (box.maxWidth - 16) / 3;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < kinds.length; i++)
                    GestureDetector(
                      key: ValueKey('aptek-kind-${kinds[i]}'),
                      onTap: () => c.push(AptekView('list', kind: kinds[i])),
                      child: Container(
                        width: w,
                        constraints: const BoxConstraints(minHeight: 96),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
                        child: Stack(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                A3IcoSq(
                                  tone: tones[i % 6],
                                  padding: const EdgeInsets.all(3),
                                  child: () {
                                    final first = c.products.where((p) => p.kind == kinds[i]).firstOrNull;
                                    return first != null && first.images.isNotEmpty
                                        ? CommerceImage(first.images.first, fit: BoxFit.contain)
                                        : const SizedBox.shrink();
                                  }(),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  ap('kind_${kinds[i]}'),
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.25, color: a.ink),
                                ),
                              ],
                            ),
                            PositionedDirectional(
                              top: 0,
                              end: 0,
                              child: Text(
                                '${c.products.where((p) => p.kind == kinds[i]).length}',
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, fontFeatures: tabularFigures),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        if (c.config != null && c.config!.bundles.isNotEmpty)
          ASection(
            title: ap('bundles_title'),
            trailing: A3Chip('−${formatIntlNumber(currentLanguage(), pct)}%', tone: 'ac'),
            child: A3Rail(
              children: [
                for (final b in c.config!.bundles)
                  AptekBundleCard(
                    wide: true,
                    bundle: b,
                    products: c.products,
                    pct: pct,
                    inCart: (id) => c.cart.quantityOf(id) > 0,
                    onAddAll: () => c.addBundle(b.skus),
                    onOpenProduct: c.openProduct,
                  ),
              ],
            ),
          ),
        _Rail(title: ap('bestsellers'), items: c.products.take(10).toList(), c: c, onMore: () => c.push(const AptekView('list'))),
        _Rail(title: ap('deals'), items: deals.take(10).toList(), c: c, onMore: () => c.push(const AptekView('list', deals: true))),
        _Rail(title: ap('recently_viewed'), items: recent, c: c),
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: GestureDetector(
            key: const ValueKey('aptek-orders-link'),
            onTap: () => c.push(const AptekView('orders')),
            child: A3Card(
              child: Row(
                children: [
                  A3IcoSq(
                    tone: 'c-peach',
                    child: AIcon(AIcons.package, size: 16, color: a.peachInk),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      ap('my_orders'),
                      style: TextStyle(fontWeight: FontWeight.w600, color: a.ink),
                    ),
                  ),
                  AIcon(AIcons.chevronRight, size: 16, color: a.ink, mirrorInRtl: true),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Text(ap('source_note'), textAlign: TextAlign.center, style: context.aText.a3Meta),
        ),
      ],
    );
  }
}

class _ProductList extends ConsumerStatefulWidget {
  const _ProductList({super.key, required this.c, required this.initial});
  final _Common c;
  final AptekView initial;

  @override
  ConsumerState<_ProductList> createState() => _ProductListState();
}

class _ProductListState extends ConsumerState<_ProductList> {
  late String _kind = widget.initial.kind ?? 'all';
  late final TextEditingController _query = TextEditingController(text: widget.initial.query ?? '');
  bool _anti = false;
  bool _forAge = false;
  String _sort = 'pop';

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final child = ref.watch(childrenProvider).selectedChild;
    final months = lifeStage == 'mommy' && child != null ? getChildAge(child).months : null;
    final q = foldQuery(_query.text);
    var list = c.products
        .where(
          (p) =>
              (_kind == 'all' || p.kind == _kind) &&
              (!widget.initial.deals || discountPct(p) > 0) &&
              (!_anti || p.tags.contains('anti_colic')) &&
              (!_forAge || months == null || p.minAgeMonths == null || p.minAgeMonths! <= months) &&
              (q.isEmpty || foldQuery('${p.name} ${p.brand ?? ''}').contains(q)),
        )
        .toList();
    if (_sort == 'asc') list = _stable(list, (a, b) => a.price.compareTo(b.price));
    if (_sort == 'desc') list = _stable(list, (a, b) => b.price.compareTo(a.price));
    final kinds = ['all', ..._kinds.where((k) => c.products.any((p) => p.kind == k))];
    final a = context.a;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SearchBox(fieldKey: const ValueKey('aptek-list-search'), controller: _query, onChanged: (_) => setState(() {})),
        _Chips(
          children: [
            for (final k in kinds) _ChipButton(label: k == 'all' ? ap('filter_all') : ap('kind_$k'), on: _kind == k, onTap: () => setState(() => _kind = k)),
          ],
        ),
        const SizedBox(height: 8),
        _Chips(
          children: [
            _ChipButton(label: ap('filter_anti'), on: _anti, onTap: () => setState(() => _anti = !_anti)),
            if (months != null) _ChipButton(label: ap('filter_age'), on: _forAge, onTap: () => setState(() => _forAge = !_forAge)),
            SizedBox(
              width: 170,
              child: ShadSelect<String>(
                fieldKey: const ValueKey('aptek-sort'),
                value: _sort,
                height: 36,
                radius: 999,
                background: a.surface,
                borderColor: a.line,
                textColor: a.inkSoft,
                options: [('pop', Text(ap('sort_pop'))), ('asc', Text(ap('sort_price_asc'))), ('desc', Text(ap('sort_price_desc')))],
                onChanged: (v) => setState(() => _sort = v),
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(0, 12, 0, 8),
          child: Text(ap('products_n', {'n': list.length}), style: context.aText.a3Meta),
        ),
        if (list.isNotEmpty)
          _Grid(
            children: [
              for (final p in list) AptekProductCard(product: p, qty: c.cart.quantityOf(p.id), onOpen: () => c.openProduct(p), onQty: (n) => c.setQty(p.id, n)),
            ],
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(
              ap('nothing_found'),
              textAlign: TextAlign.center,
              style: TextStyle(color: a.ink),
            ),
          ),
      ],
    );
  }
}

List<T> _stable<T>(List<T> list, int Function(T a, T b) cmp) {
  final indexed = [for (var i = 0; i < list.length; i++) (i, list[i])];
  indexed.sort((x, y) {
    final d = cmp(x.$2, y.$2);
    return d != 0 ? d : x.$1.compareTo(y.$1);
  });
  return [for (final e in indexed) e.$2];
}

/// `.a3-chips`: horizontal scroll bleeding into the 20px gutter.
class _Chips extends StatelessWidget {
  const _Chips({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => A3Rail(gap: 8, children: children);
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({required this.label, required this.on, required this.onTap});
  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? a.ink : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: on ? a.ink : a.line),
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: on ? a.bg : a.inkSoft),
          ),
        ),
      ),
    );
  }
}

class _ProductPage extends StatefulWidget {
  const _ProductPage({super.key, required this.c, required this.id});
  final _Common c;
  final String id;

  @override
  State<_ProductPage> createState() => _ProductPageState();
}

class _ProductPageState extends State<_ProductPage> {
  int _slide = 0;

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final p = c.byId[widget.id];
    final a = context.a;
    if (p == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(ap('nothing_found'), textAlign: TextAlign.center),
      );
    }
    final off = discountPct(p);
    AptekBundle? bundle;
    for (final b in c.config?.bundles ?? const <AptekBundle>[]) {
      if (p.sku != null && b.skus.contains(p.sku)) {
        bundle = b;
        break;
      }
    }
    final similar = c.products.where((x) => x.id != p.id && x.kind == p.kind).take(8).toList();
    final isFormula = p.tags.contains('infant_formula');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: aptekImageBg(context), borderRadius: BorderRadius.circular(24), boxShadow: a.cardShadow),
          child: AspectRatio(
            aspectRatio: 1,
            child: Stack(
              children: [
                PageView(
                  onPageChanged: (i) => setState(() => _slide = i),
                  children: [
                    for (final src in p.images)
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: CommerceImage(src, fit: BoxFit.contain),
                      ),
                  ],
                ),
                if (off > 0) PositionedDirectional(top: 14, start: 14, child: aptekOffBadge(off, fontSize: 13)),
                if (p.images.length > 1)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 12,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < p.images.length; i++)
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.symmetric(horizontal: 2.5),
                            width: i == _slide ? 18 : 6,
                            height: 6,
                            decoration: BoxDecoration(color: i == _slide ? a.coralStrong : const Color(0x2E000000), borderRadius: BorderRadius.circular(3)),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (p.brand != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(p.brand!, style: context.aText.a3Eyebrow),
                ),
              Text(
                p.name,
                key: const ValueKey('aptek-product-name'),
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.4, color: a.ink),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                crossAxisAlignment: WrapCrossAlignment.end,
                children: [
                  Text(
                    formatAzn(p.price),
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.84, color: a.ink, fontFeatures: tabularFigures),
                  ),
                  if (off > 0 && p.originalPrice != null)
                    Text(
                      formatAzn(p.originalPrice!),
                      style: TextStyle(fontSize: 15, color: a.inkSoft, decoration: TextDecoration.lineThrough, decorationColor: a.inkSoft),
                    ),
                ],
              ),
              if (p.cashbackOwn)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: QcProductBadge(channel: 'own_shop', priceMinor: toMinor(p.price), fontSize: 12),
                ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  A3Chip('${ap('age')}: ${ageLabel(p.minAgeMonths)}'),
                  if (p.volume != null) A3Chip('${ap('volume')}: ${p.volume}'),
                  if (p.tags.contains('anti_colic')) A3Chip(ap('filter_anti'), tone: 'ok'),
                  if (p.salesCount > 0) A3Chip(ap('sold_n', {'n': p.salesCount})),
                ],
              ),
              if (isFormula)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: _Note(child: Text(ap('formula_note'))),
                ),
              if (p.description != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(p.description!, style: TextStyle(height: 1.55, color: a.ink)),
                ),
            ],
          ),
        ),
        if (bundle != null)
          ASection(
            title: ap('bought_together'),
            child: AptekBundleCard(
              bundle: bundle,
              products: c.products,
              pct: c.config?.bundleDiscountPct ?? 10,
              inCart: (id) => c.cart.quantityOf(id) > 0,
              onAddAll: () => c.addBundle(bundle!.skus),
              onOpenProduct: c.openProduct,
            ),
          ),
        _Rail(title: ap('kind_${p.kind ?? 'bottles'}'), items: similar, c: c),
      ],
    );
  }
}

/// `.ap-bar`: surface bar pinned under the scroller (top line + soft shadow).
class _Bar extends StatelessWidget {
  const _Bar({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(20, 10, 20, 12 + bottom),
      decoration: BoxDecoration(
        color: a.surface,
        // 0 -1px 0 var(--a-line), 0 -8px 24px -16px rgba(122, 60, 48, 0.3) (aptek.css literal)
        boxShadow: [
          BoxShadow(color: a.line, offset: const Offset(0, -1)),
          const BoxShadow(color: Color.fromRGBO(122, 60, 48, 0.3), offset: Offset(0, -8), blurRadius: 24, spreadRadius: -16),
        ],
      ),
      child: child,
    );
  }
}

class _ProductBar extends StatefulWidget {
  const _ProductBar({super.key, required this.c, required this.p});
  final _Common c;
  final AptekProduct p;

  @override
  State<_ProductBar> createState() => _ProductBarState();
}

class _ProductBarState extends State<_ProductBar> {
  int _qty = 1;

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final p = widget.p;
    final inCart = c.cart.quantityOf(p.id);
    return _Bar(
      child: Row(
        children: [
          if (inCart > 0) ...[
            QtyStepper(value: inCart, onChanged: (n) => c.setQty(p.id, n)),
            const SizedBox(width: 10),
            Expanded(
              child: AButton(variant: AButtonVariant.accent, onPressed: () => c.push(const AptekView('cart')), child: Text(ap('cart_n', {'n': c.cart.count}))),
            ),
          ] else ...[
            QtyStepper(value: _qty, onChanged: (n) => setState(() => _qty = n < 1 ? 1 : n)),
            const SizedBox(width: 10),
            Expanded(
              child: AButton(
                key: const ValueKey('aptek-add-to-cart'),
                variant: AButtonVariant.accent,
                leading: const AIcon(AIcons.shoppingBag, size: 18),
                onPressed: () {
                  unawaited(HapticFeedback.mediumImpact());
                  c.setQty(p.id, _qty);
                },
                child: Text('${ap('add_to_cart')} · ${formatAzn(p.price * _qty)}', maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.totals, this.cashbackMinor = 0, required this.language});
  final AptekTotals totals;
  final int cashbackMinor;
  final String language;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget line(String label, String value, {bool ok = false, bool total = false}) => Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        padding: EdgeInsets.only(top: total ? 10 : 0),
        decoration: total
            ? BoxDecoration(
                border: Border(top: BorderSide(color: a.line)),
              )
            : null,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: total ? 17 : 14.5, color: total ? a.ink : a.inkSoft),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: total ? 17 : 14.5,
                fontWeight: total ? FontWeight.w800 : FontWeight.w600,
                color: ok ? a.greenInk : a.ink,
                fontFeatures: tabularFigures,
              ),
            ),
          ],
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line(ap('subtotal'), formatAzn(totals.subtotal)),
        if (totals.bundleDiscount > 0) line(ap('bundle_discount'), '−${formatAzn(totals.bundleDiscount)}', ok: true),
        if (totals.couponDiscount > 0) line(ap('coupon_discount'), '−${formatAzn(totals.couponDiscount)}', ok: true),
        line(ap('shipping'), totals.shipping != 0 ? formatAzn(totals.shipping) : ap('free')),
        if (cashbackMinor > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: QcSummaryLine(amount: cashbackMinor),
          ),
        line(ap('total'), formatAzn(toAzn(toMinor(totals.total) - cashbackMinor)), total: true),
      ],
    );
  }
}

typedef _ShellBuilder = Widget Function(List<Widget> children, Widget? bar);

class _CartView extends ConsumerStatefulWidget {
  const _CartView({required this.c, required this.shell, required this.onCheckout});
  final _Common c;
  final _ShellBuilder shell;
  final VoidCallback onCheckout;

  @override
  ConsumerState<_CartView> createState() => _CartViewState();
}

class _CartViewState extends ConsumerState<_CartView> {
  late final TextEditingController _code = TextEditingController(
    text: () {
      final v = ref.read(localStoreProvider).readJson(_checkoutKey);
      return v is Map && v['coupon'] is String ? v['coupon'] as String : '';
    }(),
  );
  AptekCoupon? _coupon;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _apply(num subtotal) async {
    final found = await fetchAptekCoupon(ref.read(commerceBackendProvider), _code.text);
    final problem = couponProblem(found, subtotal);
    if (!mounted) return;
    setState(() {
      _error = problem;
      _coupon = problem != null ? null : found;
      _sharedCoupon = _coupon;
    });
    if (problem == null) {
      unawaited(HapticFeedback.mediumImpact());
      final store = ref.read(localStoreProvider);
      final saved = store.readJson(_checkoutKey);
      store.writeJson(_checkoutKey, {...(saved is Map ? Map<String, Object?>.from(saved) : const {}), 'coupon': _code.text.trim().toUpperCase()});
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final a = context.a;
    final language = currentLanguage();
    final totals = aptekTotals(c.cart.lines, c.config, _coupon);
    final free = c.config?.freeShippingMin ?? 30;
    if (c.cart.lines.isEmpty) {
      return widget.shell([
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: Column(
            children: [
              const CommerceMascot(stage: 'mommy', width: 110),
              const SizedBox(height: 6),
              Text(
                ap('cart_empty'),
                style: TextStyle(fontWeight: FontWeight.w700, color: a.ink),
              ),
              const SizedBox(height: 6),
              Text(ap('cart_empty_sub'), textAlign: TextAlign.center, style: context.aText.a3Meta),
              const SizedBox(height: 6),
              AButton(variant: AButtonVariant.accent, onPressed: () => c.push(const AptekView('list')), child: Text(ap('go_shopping'))),
            ],
          ),
        ),
      ], null);
    }
    return widget.shell(
      [
        A3Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  AIcon(AIcons.truck, size: 16, color: a.ink),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      totals.toFreeShipping > 0 ? ap('to_free', {'amount': formatAzn(totals.toFreeShipping)}) : ap('free_reached'),
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                height: 6,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: a.line, borderRadius: BorderRadius.circular(6)),
                alignment: AlignmentDirectional.centerStart,
                child: FractionallySizedBox(
                  widthFactor: ((free - totals.toFreeShipping) / free).clamp(0, 1).toDouble(),
                  child: Container(
                    decoration: BoxDecoration(color: a.green2, borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: A3Card(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: A3Divided(
              children: [
                for (final l in c.cart.lines)
                  Padding(
                    key: ValueKey('aptek-line-${l.productId}'),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AptekThumb(src: l.product.images.isEmpty ? null : l.product.images.first, label: l.product.name, onTap: () => c.openProduct(l.product)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                l.product.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.3, color: a.ink),
                              ),
                              QcLineBonus(channel: 'own_shop', amountMinor: toMinor(l.product.price * l.quantity), own: l.product.cashbackOwn),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  QtyStepper(small: true, value: l.quantity, onChanged: (n) => c.setQty(l.productId, n)),
                                  Text(
                                    formatAzn(l.product.price * l.quantity),
                                    style: TextStyle(fontWeight: FontWeight.w700, color: a.ink, fontFeatures: tabularFigures),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SearchBox(
                fieldKey: const ValueKey('aptek-coupon'),
                controller: _code,
                icon: false,
                placeholder: ap('coupon_placeholder'),
                onChanged: (_) => setState(() {
                  _coupon = null;
                  _error = null;
                  _sharedCoupon = null;
                }),
                onSubmitted: (_) => unawaited(_apply(totals.subtotal)),
                trailing: AButton(
                  key: const ValueKey('aptek-coupon-apply'),
                  variant: AButtonVariant.soft,
                  size: AButtonSize.sm,
                  onPressed: _code.text.trim().isEmpty ? null : () => unawaited(_apply(totals.subtotal)),
                  child: Text(ap('apply')),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(ap(_error!), style: context.aText.a3Meta.copyWith(color: a.bad)),
                ),
              if (_coupon != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(ap('coupon_applied', {'code': _coupon!.code}), style: context.aText.a3Meta.copyWith(color: a.greenInk)),
                ),
              A3Card(
                child: _Summary(totals: totals, language: language),
              ),
            ],
          ),
        ),
      ],
      _Bar(
        child: AButton(
          key: const ValueKey('aptek-checkout'),
          variant: AButtonVariant.accent,
          block: true,
          onPressed: widget.onCheckout,
          child: Text('${ap('checkout')} · ${formatAzn(totals.total)}'),
        ),
      ),
    );
  }
}

class _CheckoutView extends ConsumerStatefulWidget {
  const _CheckoutView({required this.c, required this.shell, required this.onDone});
  final _Common c;
  final _ShellBuilder shell;
  final void Function(String orderNumber, QcOrderNote? qc) onDone;

  @override
  ConsumerState<_CheckoutView> createState() => _CheckoutViewState();
}

class _CheckoutViewState extends ConsumerState<_CheckoutView> {
  late final Map<String, Object?> _saved = () {
    final v = ref.read(localStoreProvider).readJson(_checkoutKey);
    return v is Map ? Map<String, Object?>.from(v) : <String, Object?>{};
  }();
  late final TextEditingController _address = TextEditingController(text: _s(_saved['address']));
  late final TextEditingController _phone = TextEditingController(
    text: _s(_saved['phone']).isNotEmpty ? _s(_saved['phone']) : _s(ref.read(authProfileProvider)?['phone']),
  );
  late final TextEditingController _name = TextEditingController(
    text: _s(_saved['name']).isNotEmpty ? _s(_saved['name']) : (ref.read(authProfileProvider)?.name ?? ''),
  );
  final TextEditingController _notes = TextEditingController();
  late String _slot = (widget.c.config?.slots ?? const <String>[]).firstOrNull ?? '';
  String _payment = 'card_on_delivery';
  bool _touched = false;
  bool _pending = false;
  final QcRedeemController _qc = QcRedeemController();

  static String _s(Object? v) => v is String ? v : '';

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
    _address.dispose();
    _phone.dispose();
    _name.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool get _phoneOk => RegExp(r'^\+?[0-9][0-9 ()-]{6,19}$').hasMatch(_phone.text.trim());
  bool get _addressOk => _address.text.trim().length >= 5;

  Future<void> _submit(QcRedeemState qc, int earn) async {
    setState(() => _touched = true);
    final c = widget.c;
    if (!_phoneOk || !_addressOk || _slot.isEmpty || c.cart.lines.isEmpty) return;
    final store = ref.read(localStoreProvider);
    store.writeJson(_checkoutKey, {..._saved, 'address': _address.text.trim(), 'phone': _phone.text.trim(), 'name': _name.text.trim()});
    final toast = toasts(context);
    setState(() => _pending = true);
    try {
      final res = await placeAptekOrder(
        backend: ref.read(commerceBackendProvider),
        client: ref.read(queryClientProvider),
        backendUrl: ref.read(commerceBackendUrlProvider),
        uid: ref.read(authUserProvider)?.id,
        input: PlaceOrderInput(
          items: [
            for (final l in c.cart.lines) {'product_id': l.productId, 'quantity': l.quantity},
          ],
          coupon: _sharedCoupon?.code,
          slot: _slot,
          payment: _payment,
          address: {'line': _address.text.trim(), if (_name.text.trim().isNotEmpty) 'name': _name.text.trim()},
          phone: _phone.text.trim(),
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          cashback: qc.amount > 0 ? toAzn(qc.amount) : null,
        ),
      );
      _sharedCoupon = null;
      store.writeJson(_checkoutKey, {'address': _address.text.trim(), 'phone': _phone.text.trim(), 'name': _name.text.trim()});
      final used = res.cashback != null ? toMinor(res.cashback!) : qc.amount;
      if (used > 0) qcTrack(ref, 'qc_redeem_commit', {'channel': 'aptek', 'amount_minor': used});
      widget.onDone(res.orderNumber, QcOrderNote(earnMinor: earn, usedMinor: used, digital: false));
    } catch (e) {
      final code = qcErrorCode(e);
      toast.error(code != null ? qk(qcErrorKey(code)) : ap(aptekErrorKey(e)));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final a = context.a;
    final language = currentLanguage();
    final slots = c.config?.slots ?? const <String>[];
    final totals = aptekTotals(c.cart.lines, c.config, _sharedCoupon);
    // QayğıCash: up to max % of the goods after discounts (delivery excluded); Anacan-brand lines earn on their paid share.
    final discountMinor = toMinor(totals.bundleDiscount + totals.couponDiscount);
    final qc = qcRedeemState(ref, _qc, 'aptek', toMinor(totals.subtotal) - discountMinor);
    final earn = aptekEarnMinor(
      [for (final l in c.cart.lines) AptekEarnLine(priceMinor: toMinor(l.product.price), quantity: l.quantity, own: l.product.cashbackOwn)],
      discountMinor,
      qc.amount,
      rateOf(qc.wallet, 'own_shop'),
    );
    final payTotal = toAzn(toMinor(totals.total) - qc.amount);
    final label = context.aText.a3FieldLabel;
    Widget field(String title, Widget input) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: label),
        const SizedBox(height: 6),
        input,
      ],
    );
    Widget slotButton(String value, Widget child, bool checked, VoidCallback onTap, Key key) => Semantics(
      checked: checked,
      inMutuallyExclusiveGroup: true,
      child: GestureDetector(
        key: key,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: checked ? a.coralSoft : a.surface,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: checked ? a.coralStrong : a.line, spreadRadius: checked ? 2 : 1)],
          ),
          child: DefaultTextStyle.merge(
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink),
            child: child,
          ),
        ),
      ),
    );
    Widget grid2(List<Widget> items) => LayoutBuilder(
      builder: (context, box) {
        final w = (box.maxWidth - 8) / 2;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final i in items) SizedBox(width: w, child: i)],
        );
      },
    );
    final error = TextStyle(color: a.bad);
    return widget.shell(
      [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ap('address_title'), style: context.aText.a3SecTitle),
            const SizedBox(height: 12),
            field(
              ap('address_title'),
              CommerceTextField(
                fieldKey: const ValueKey('aptek-address'),
                controller: _address,
                placeholder: ap('address_placeholder'),
                minLines: 2,
                maxLines: 4,
                minHeight: 72,
                invalid: _touched && !_addressOk,
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(height: 12),
            field(ap('name_label'), CommerceTextField(fieldKey: const ValueKey('aptek-name'), controller: _name, onChanged: (_) => setState(() {}))),
            const SizedBox(height: 12),
            field(
              ap('phone_label'),
              CommerceTextField(
                fieldKey: const ValueKey('aptek-phone'),
                controller: _phone,
                placeholder: '+994 50 000 00 00',
                keyboardType: TextInputType.phone,
                invalid: _touched && !_phoneOk,
                onChanged: (_) => setState(() {}),
              ),
            ),
            if (_touched && !_phoneOk)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(ap('err_phone'), style: context.aText.a3Meta.merge(error)),
              ),
            if (_touched && !_addressOk)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(ap('err_address'), style: context.aText.a3Meta.merge(error)),
              ),
          ],
        ),
        ASection(
          title: ap('slot_title'),
          child: grid2([for (final s in slots) slotButton(s, Text(ap('slot_$s')), _slot == s, () => setState(() => _slot = s), ValueKey('aptek-slot-$s'))]),
        ),
        ASection(
          title: ap('payment_title'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              grid2([
                slotButton(
                  'card_on_delivery',
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AIcon(AIcons.creditCard, size: 18, color: a.ink),
                      const SizedBox(height: 2),
                      Text(ap('pay_card')),
                    ],
                  ),
                  _payment == 'card_on_delivery',
                  () => setState(() => _payment = 'card_on_delivery'),
                  const ValueKey('aptek-pay-card'),
                ),
                slotButton(
                  'cash',
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AIcon(AIcons.banknote, size: 18, color: a.ink),
                      const SizedBox(height: 2),
                      Text(ap('pay_cash')),
                    ],
                  ),
                  _payment == 'cash',
                  () => setState(() => _payment = 'cash'),
                  const ValueKey('aptek-pay-cash'),
                ),
              ]),
              const SizedBox(height: 12),
              CommerceTextField(
                fieldKey: const ValueKey('aptek-notes'),
                controller: _notes,
                placeholder: ap('notes_placeholder'),
                minLines: 2,
                maxLines: 4,
                minHeight: 72,
                inputFormatters: [LengthLimitingTextInputFormatter(500)],
              ),
            ],
          ),
        ),
        if (qc.wallet != null && qc.limits.show)
          Padding(
            padding: const EdgeInsets.only(top: 24),
            child: QcRedeemRow(state: qc),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 24),
          child: A3Card(
            child: _Summary(totals: totals, cashbackMinor: qc.amount, language: language),
          ),
        ),
        if (earn > 0)
          Padding(
            padding: const EdgeInsets.only(top: 24),
            child: QcEarnBox(amount: earn),
          ),
      ],
      _Bar(
        child: AButton(
          key: const ValueKey('aptek-place-order'),
          variant: AButtonVariant.accent,
          block: true,
          onPressed: _pending || c.cart.lines.isEmpty ? null : () => unawaited(_submit(qc, earn)),
          child: Text(_pending ? ap('placing') : ap('place_order', {'amount': formatAzn(payTotal)})),
        ),
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.number, required this.qc, required this.onOrders, required this.onHome});
  final String number;
  final QcOrderNote? qc;
  final VoidCallback onOrders;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          const CommerceMascot(stage: 'mommy', pose: 'welcome', width: 130),
          const SizedBox(height: 10),
          Text(
            ap('success_title'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: a.ink),
          ),
          const SizedBox(height: 10),
          Text(ap('success_text', {'number': number}), textAlign: TextAlign.center, style: context.aText.a3Meta),
          const SizedBox(height: 10),
          QcSuccessNote(note: qc),
          const SizedBox(height: 10),
          AButton(key: const ValueKey('aptek-success-orders'), variant: AButtonVariant.accent, onPressed: onOrders, child: Text(ap('my_orders'))),
          const SizedBox(height: 10),
          AButton(variant: AButtonVariant.ghost, onPressed: onHome, child: Text(ap('go_shopping'))),
        ],
      ),
    );
  }
}

const List<String> _steps = ['pending', 'confirmed', 'shipped', 'delivered'];

class _OrdersView extends ConsumerWidget {
  const _OrdersView({required this.byId});
  final Map<String, AptekProduct> byId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(aptekOrdersQuery);
    if (q.isLoading) return const SizedBox.shrink();
    final orders = q.data ?? const <AptekOrder>[];
    final a = context.a;
    if (orders.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          ap('orders_empty'),
          textAlign: TextAlign.center,
          style: TextStyle(color: a.ink),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var oi = 0; oi < orders.length; oi++) ...[
          if (oi > 0) const SizedBox(height: 12),
          () {
            final o = orders[oi];
            final step = o.status == 'processing' ? 1 : _steps.indexOf(o.status);
            final items = o.orderItems;
            return A3Card(
              key: ValueKey('aptek-order-${o.id}'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        o.orderNumber,
                        style: TextStyle(fontWeight: FontWeight.w700, color: a.ink, fontFeatures: tabularFigures),
                      ),
                      A3Chip(
                        ap('status_${o.status}'),
                        tone: o.status == 'cancelled'
                            ? 'bad'
                            : o.status == 'delivered'
                            ? 'ok'
                            : 'ac',
                      ),
                    ],
                  ),
                  if (o.status != 'cancelled') ...[
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < _steps.length; i++) ...[
                          if (i > 0) const SizedBox(width: 4),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Container(
                                  height: 5,
                                  decoration: BoxDecoration(color: i <= step ? a.coralStrong : a.line, borderRadius: BorderRadius.circular(5)),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  ap('status_${_steps[i]}'),
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, height: 1.25, color: i <= step ? a.ink : a.inkSoft),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      for (final it in items.take(4))
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 6),
                          child: AptekThumb(small: true, src: byId[it.productId]?.images.firstOrNull),
                        ),
                      const Spacer(),
                      Text(ap('items_n', {'n': items.fold<int>(0, (s, it) => s + it.quantity)}), style: context.aText.a3Meta),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(o.deliverySlot != null ? ap('slot_${o.deliverySlot}') : '', style: context.aText.a3Meta),
                      Text(
                        formatAzn(o.totalAmount),
                        style: TextStyle(fontWeight: FontWeight.w700, color: a.ink, fontFeatures: tabularFigures),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }(),
        ],
      ],
    );
  }
}
