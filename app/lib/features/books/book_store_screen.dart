// Ported from: src/components/books/BookStoreScreen.tsx (BookStoreScreen, BookDetail, CartSheet, MyBooks, PrintGuide),
//              src/components/books/books.css
//
// PDF activity-book store: hero, the child's age row, bundle tiers, age / topic filters, age collection, the grid,
// cart bar and sheets, checkout (Epoint card page in the browser; admin free test while payments are off) and
// "Kitablarım" with downloads. "Uşaqla oyun" hands a book id over through [pendingBookOpenProvider].
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart' show Rows;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../state/user_store.dart';
import '../baby/hooks/use_children.dart' show ChildrenView, childrenProvider;
import '../baby/models/child.dart' show getChildAge;
import '../settings/ui/settings_ui.dart' show ATopbar, px, toasts;
import '../tools/play_together/play_together_tool.dart' show pendingBookOpenProvider;
import 'books_api.dart';
import 'books_catalog.dart';
import 'books_qaygicash.dart';
import 'books_widgets.dart';

const List<int> _tiers = [1, 3, 5, 10];

/// `['books-payments-ready']`.
final booksPaymentsReadyQuery = queryProvider<bool>((ref) {
  final api = ref.watch(booksApiProvider);
  return QueryOptions<bool>(queryKey: const ['books-payments-ready'], staleTime: const Duration(seconds: 60), queryFn: (_) => api.paymentsReady());
}, name: 'booksPaymentsReadyQuery');

/// `['my-books', user?.id]` (refetched on every app resume).
final myBooksQuery = queryProvider<Rows>((ref) {
  final api = ref.watch(booksApiProvider);
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<Rows>(
    queryKey: ['my-books', userId],
    enabled: userId != null,
    refetchOnWindowFocus: RefetchOn.always,
    codec: QueryCodecs.rows,
    queryFn: (_) async => [for (final b in await api.myBooks()) b.toRow()],
  );
}, name: 'myBooksQuery');

class BookStoreScreen extends ConsumerStatefulWidget {
  const BookStoreScreen({super.key, required this.onBack, this.initialTab = 'store'});
  final VoidCallback onBack;

  /// `'store' | 'mine'`.
  final String initialTab;

  @override
  ConsumerState<BookStoreScreen> createState() => _BookStoreScreenState();
}

class _BookStoreScreenState extends ConsumerState<BookStoreScreen> {
  late String _tab = widget.initialTab;
  String _age = 'all';
  String _topic = 'all';
  late List<String> _cart = readBooksCart(ref.read(booksLocalStoreProvider));
  String? _pendingDetailId;
  Book? _detail;
  bool _cartOpen = false;
  bool _busy = false;
  bool _agePicked = false;
  bool _consent = false;
  Set<String> _ownedIds = const {};
  BooksQcState _qcState = const BooksQcState();

  String get _language => normalizeAppLanguage(ref.read(userStoreProvider).language);
  String t(String key, [Map<String, Object?> vars = const {}]) => booksText(key, ref.read(userStoreProvider).language, vars);

  void _log(String name, Map<String, Object?> params) => ref.read(analyticsSinkProvider).logEvent(name, params);

  @override
  void initState() {
    super.initState();
    // "Uşaqla oyun" opens the store on one book (read once).
    _pendingDetailId = ref.read(pendingBookOpenProvider).take();
    final childAge = _childAge(ref.read(childrenProvider));
    if (childAge != null) _age = childAge;
    _log('books_store_viewed', {'tab': widget.initialTab, 'child_age': childAge ?? 'none'});
  }

  String? _childAge(ChildrenView view) {
    final child = view.selectedChild;
    return child == null ? null : bookAgeForMonths(getChildAge(child).months);
  }

  void _setCart(List<String> next) {
    _cart = next;
    writeBooksCart(ref.read(booksLocalStoreProvider), next);
  }

  void _onOwned(Set<String> owned) {
    if (owned.length == _ownedIds.length && owned.containsAll(_ownedIds)) return;
    _ownedIds = owned;
    final store = ref.read(booksLocalStoreProvider);
    final pending = PendingBooks.read(store);
    if (pending != null && pending.ids.isNotEmpty && pending.ids.every(owned.contains)) {
      _log('books_purchase_confirmed', {'order_id': pending.orderId, 'book_count': pending.ids.length, 'value': pending.value, 'currency': 'AZN'});
      PendingBooks.clear(store);
      final qc = ref.read(booksQaygiCashProvider);
      final qcState = _qcState;
      if ((pending.qcEarn ?? 0) > 0 && qcState.hasWallet) {
        final toast = qc.earnedToast(pending.qcEarn!, qcState.holdDaysDigital, _language);
        if (toast != null && mounted) toasts(context).success(toast.$1, description: toast.$2);
      }
      if ((pending.qcEarn ?? 0) != 0 || (pending.qcUsed ?? 0) != 0) qc.invalidate(ref);
    }
    // Books bought on another device or just paid for leave the cart.
    if (owned.isNotEmpty) _setCart(_cart.where((id) => !owned.contains(id)).toList());
  }

  void _toggle(String id) {
    final adding = !_cart.contains(id);
    _log(adding ? 'book_added_to_cart' : 'book_removed_from_cart',
        {'book_id': id, 'cart_size': _cart.length + (adding ? 1 : -1), 'value': bookUnitPrice(_cart.length + 1), 'currency': 'AZN'});
    setState(() => _setCart(_cart.contains(id) ? _cart.where((x) => x != id).toList() : [..._cart, id]));
  }

  void _addMany(List<String> ids) {
    _log('books_collection_added', {'age': _age, 'count': ids.length});
    setState(() => _setCart({..._cart, ...ids.where((id) => !_ownedIds.contains(id))}.toList()));
  }

  void _openDetail(Book book) {
    _log('book_viewed', {'book_id': book.id, 'age': book.age, 'topic': book.topic});
    setState(() => _detail = book);
  }

  Future<void> _checkout({required bool ready, required BooksQcState qc, required int bookRate}) async {
    if (_cart.isEmpty || _busy) return;
    final api = ref.read(booksApiProvider);
    final toast = toasts(context);
    final user = ref.read(authUserProvider);
    final isAdmin = ref.read(isAdminProvider);
    final client = ref.read(queryClientProvider);
    final qcPort = ref.read(booksQaygiCashProvider);
    final email = user?.email;
    if (!ready && isAdmin && email != null && email.isNotEmpty) {
      // Preview mode: card payments are off, so an admin gets the books for free to try "Kitablarım" and the e-mail.
      setState(() => _busy = true);
      try {
        final ids = _cart;
        if (await api.adminTestGrant(ids, email)) {
          if (!mounted) return;
          setState(() {
            _setCart(const []);
            _cartOpen = false;
            _tab = 'mine';
          });
          await client.invalidateQueries(queryKey: const ['my-books']);
          toast.success('Admin test: ${ids.length} kitab Kitablarım-a əlavə olundu, linklər e-poçta göndərildi.');
        } else {
          toast.error(t('pay_error'));
        }
      } finally {
        if (mounted) setState(() => _busy = false);
      }
      return;
    }
    if (!ready) {
      _log('books_checkout_unavailable', {'book_count': _cart.length});
      toast.message(t('pay_soon'));
      return;
    }
    setState(() => _busy = true);
    try {
      final orderMinor = toMinor(bookOrderTotal(_cart.length));
      final result = await api.startCheckout(_cart, _language, cashback: qc.amount > 0 ? toAzn(qc.amount) : null);
      if (!mounted) return;
      switch (result) {
        case BookCheckoutStarted(:final url, :final orderId, :final amount, :final cashback):
          final value = amount ?? toAzn(orderMinor - qc.amount);
          final used = cashback != null ? toMinor(cashback) : qc.amount;
          _log('books_checkout_started', {'order_id': orderId, 'book_count': _cart.length, 'value': value, 'currency': 'AZN'});
          if (used > 0) qcPort.track('qc_redeem_commit', {'channel': 'book', 'amount_minor': used});
          PendingBooks(orderId: orderId, ids: _cart, value: value, qcEarn: earnPreview(toMinor(value), bookRate), qcUsed: used).write(ref.read(booksLocalStoreProvider));
          if (used > 0) await qcPort.invalidate(ref);
          await api.openExternal(url);
          toast.message(t('pay_waiting'));
          if (mounted) setState(() => _cartOpen = false);
        case BookCheckoutFailed(:final reason, :final owned, :final code):
          if (reason == 'qaygicash') {
            await qcPort.invalidate(ref);
            toast.error(qcPort.errorText(code) ?? t('pay_error'));
          } else if (reason == 'owned') {
            setState(() => _setCart(_cart.where((id) => !owned.contains(id)).toList()));
            await client.invalidateQueries(queryKey: const ['my-books']);
            toast.message(t('pay_owned'));
          } else if (reason == 'unavailable') {
            _log('books_checkout_unavailable', {'book_count': _cart.length});
            toast.message(t('pay_soon'));
          } else {
            toast.error(t('pay_error'));
          }
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final dark = context.tokens.isDark;
    ref.watch(userStoreProvider.select((s) => s.language));
    final catalogAsync = ref.watch(bookCatalogProvider);
    final catalog = catalogAsync.value;
    final children = ref.watch(childrenProvider);
    final selectedChild = children.selectedChild;
    final childAge = _childAge(children);
    if (childAge != null && !_agePicked && _age != childAge) _age = childAge;
    final ready = ref.watch(booksPaymentsReadyQuery).data ?? false;
    final ownedQuery = ref.watch(myBooksQuery);
    final owned = [for (final r in ownedQuery.data ?? const <Map<String, dynamic>>[]) '${r['book_id']}'];
    final ownedSet = owned.toSet();
    if (!(ownedSet.length == _ownedIds.length && ownedSet.containsAll(_ownedIds))) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _onOwned(ownedSet));
      });
    }
    if (_pendingDetailId != null && catalog != null) {
      final book = catalog.findBook(_pendingDetailId!);
      _pendingDetailId = null;
      _detail = book;
    }
    final qcPort = ref.watch(booksQaygiCashProvider);
    final orderMinor = toMinor(bookOrderTotal(_cart.length));
    final qc = qcPort.watch(ref, orderMinor);
    _qcState = qc;
    final bookRate = qc.bookRateBp;
    final qcEarn = earnPreview(orderMinor - qc.amount, bookRate);
    final isAdmin = ref.watch(isAdminProvider);
    final books = catalog?.books ?? const <Book>[];
    final visible = books.where((b) => (_age == 'all' || b.age == _age) && (_topic == 'all' || b.topic == _topic)).toList();
    final collection = _age != 'all' ? books.where((b) => b.age == _age && !ownedSet.contains(b.id)).toList() : const <Book>[];
    String ageLabel(String age) => t('age_$age');

    final store = <Widget>[
      _hero(context),
      if (childAge != null && selectedChild != null)
        _Section(
          head: Row(children: [
            Expanded(child: Text(t('for_child', {'name': selectedChild.name}), style: _h2(context))),
            const SizedBox(width: 10),
            _AgePill(age: childAge, label: ageLabel(childAge)),
          ]),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(children: [
              for (final book in books.where((b) => b.age == childAge)) ...[
                GestureDetector(
                  key: ValueKey('book-rail-${book.id}'),
                  onTap: () => _openDetail(book),
                  child: SizedBox(
                    width: 104,
                    child: Stack(children: [
                      BookCover(book.id, width: 104, radius: 12, shadow: const [BoxShadow(color: Color(0x80501E14), offset: Offset(0, 10), blurRadius: 20, spreadRadius: -14)]),
                      if (ownedSet.contains(book.id) || _cart.contains(book.id))
                        Positioned(left: 6, bottom: 6, child: _Flag(text: ownedSet.contains(book.id) ? t('owned') : t('added'), own: ownedSet.contains(book.id))),
                    ]),
                  ),
                ),
                const SizedBox(width: 10),
              ],
            ]),
          ),
        ),
      _Section(
        head: Text(t('bundles_title'), style: _h2(context)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Transform.translate(offset: const Offset(0, -2), child: Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t('bundles_body'), style: px(12, color: a.inkSoft)))),
          Padding(
            padding: const EdgeInsets.only(top: 9),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < _tiers.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: _tier(context, _tiers[i], i)),
              ],
            ]),
          ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(children: [
              _Chip(
                key: const ValueKey('books-age-all'),
                label: t('age_all'),
                on: _age == 'all',
                onTap: () => setState(() {
                  _agePicked = true;
                  _age = 'all';
                }),
              ),
              for (final age in kBookAges) ...[
                const SizedBox(width: 6),
                _Chip(
                  key: ValueKey('books-age-$age'),
                  label: ageLabel(age),
                  on: _age == age,
                  onColor: bookTint(age, dark: dark).solid,
                  inkColor: bookTint(age, dark: dark).ink,
                  onTap: () => setState(() {
                    _agePicked = true;
                    _age = age;
                  }),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(children: [
              _Chip(key: const ValueKey('books-topic-all'), label: t('topic_all'), on: _topic == 'all', soft: true, onTap: () => setState(() => _topic = 'all')),
              for (final topic in kBookTopics) ...[
                const SizedBox(width: 6),
                _Chip(key: ValueKey('books-topic-$topic'), label: t('topic_$topic'), on: _topic == topic, soft: true, onTap: () => setState(() => _topic = topic)),
              ],
            ]),
          ),
        ]),
      ),
      if (_age != 'all' && _topic == 'all' && collection.length >= 3) _collection(context, collection, ageLabel(_age)),
      _Section(
        head: Row(children: [
          Expanded(child: Text(t('results', {'n': visible.length}), style: _h2(context))),
          const SizedBox(width: 10),
          Flexible(child: Text(t('language_note'), textAlign: TextAlign.end, style: px(10.5, color: a.inkSoft))),
        ]),
        child: LayoutBuilder(builder: (context, c) {
          final w = (c.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 14, children: [
            for (final book in visible) SizedBox(width: w, child: _card(context, book, ownedSet.contains(book.id), qcPort)),
          ]);
        }),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 6),
        child: Text('${t('personal_use')} · ${t('language_note')}', textAlign: TextAlign.center, style: px(11, color: a.inkSoft)),
      ),
    ];

    final body = ColoredBox(
      color: a.bg,
      child: SingleChildScrollView(
        key: const ValueKey('books-scroll'),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 160),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ATopbar(onBack: widget.onBack, eyebrow: t('store_eyebrow'), title: t('store_title')),
          _tabs(context, owned.length),
          if (_tab == 'store')
            ...store
          else
            _MyBooks(owned: owned, loading: ownedQuery.isLoading, catalog: catalog, t: t, onBrowse: () => setState(() => _tab = 'store'), log: _log),
        ]),
      ),
    );

    final detail = _detail;
    final next = nextBookTier(_cart.length);
    return Stack(children: [
      Positioned.fill(child: body),
      Positioned(
        left: 12,
        right: 12,
        bottom: 14 + MediaQuery.paddingOf(context).bottom,
        child: AnimatedSlide(
          duration: const Duration(milliseconds: 250),
          offset: _tab == 'store' && _cart.isNotEmpty && !_cartOpen ? Offset.zero : const Offset(0, 3),
          child: _tab == 'store' && _cart.isNotEmpty && !_cartOpen
              ? Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 456),
                    child: _cartBar(context, next),
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ),
      if (detail != null)
        Positioned.fill(
          child: _BookDetail(
            book: detail,
            owned: ownedSet.contains(detail.id),
            inCart: _cart.contains(detail.id),
            price: bookUnitPrice(math.max(1, _cart.length + (_cart.contains(detail.id) ? 0 : 1))),
            t: t,
            qc: qcPort,
            onToggle: () => _toggle(detail.id),
            onClose: () => setState(() => _detail = null),
            onMine: () => setState(() {
              _detail = null;
              _tab = 'mine';
            }),
          ),
        ),
      if (_cartOpen)
        Positioned.fill(
          child: _cartSheet(context, catalog: catalog, ready: ready, adminTest: !ready && isAdmin, qc: ready ? qc : const BooksQcState(), qcEarn: ready ? qcEarn : 0, qcPort: qcPort, bookRate: bookRate),
        ),
    ]);
  }

  TextStyle _h2(BuildContext context) => px(16, weight: FontWeight.w800, color: context.a.ink, ls: -0.01);

  Widget _tabs(BuildContext context, int ownedCount) {
    final a = context.a;
    final dark = context.tokens.isDark;
    Widget tab(String id, AIconData icon, String label, {Widget? badge}) {
      final on = _tab == id;
      return Expanded(
        child: Semantics(
          selected: on,
          button: true,
          child: GestureDetector(
            key: ValueKey('books-tab-$id'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _tab = id),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: on ? a.surface : null,
                borderRadius: BorderRadius.circular(12),
                // 0 6px 16px -10px rgba(120, 50, 40, .35) (books.css .bk-tabs button.on; none in dark)
                boxShadow: on && !dark ? const [BoxShadow(color: Color(0x59783228), offset: Offset(0, 6), blurRadius: 16, spreadRadius: -10)] : null,
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                AIcon(icon, size: 15, color: on ? a.ink : a.inkSoft),
                const SizedBox(width: 6),
                Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w700, color: on ? a.ink : a.inkSoft))),
                if (badge != null) ...[const SizedBox(width: 6), badge],
              ]),
            ),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(0, 4, 0, 14),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        tab('store', AIcons.shoppingBag, t('tab_store')),
        const SizedBox(width: 6),
        tab(
          'mine',
          AIcons.library,
          t('tab_mine'),
          badge: ownedCount > 0
              ? Container(
                  constraints: const BoxConstraints(minWidth: 20),
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                  child: Text('$ownedCount', style: px(11, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                )
              : null,
        ),
      ]),
    );
  }

  Widget _hero(BuildContext context) {
    final dark = context.tokens.isDark;
    const white = Color(0xFFFFFFFF);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        // linear-gradient(140deg, #FF6B6B, #FF5A5F 45%, #F2706A); dark: #D9474C, #C73A40 50%, #B8444A (books.css .bk-hero)
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark ? const [Color(0xFFD9474C), Color(0xFFC73A40), Color(0xFFB8444A)] : const [Color(0xFFFF6B6B), Color(0xFFFF5A5F), Color(0xFFF2706A)],
          stops: dark ? const [0, 0.5, 1] : const [0, 0.45, 1],
        ),
      ),
      child: Stack(children: [
        // radial-gradient(circle at 85% 10%, rgba(255,255,255,.25) (dark .16), transparent 40%)
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.7, -0.8),
                radius: 0.8,
                colors: [dark ? const Color(0x29FFFFFF) : const Color(0x40FFFFFF), const Color(0x00FFFFFF)],
                stops: const [0, 0.5],
              ),
            ),
          ),
        ),
        LayoutBuilder(builder: (context, c) {
          final width = c.maxWidth;
          return Stack(children: [
            Positioned(
              right: -4,
              top: 46,
              width: width * 0.4,
              height: 150,
              child: ExcludeSemantics(
                child: Stack(clipBehavior: Clip.none, children: [
                  for (final (i, id) in const ['6m_05', '3_05', '5_05'].indexed)
                    Positioned(
                      right: i * 30.0,
                      top: i * 8.0,
                      child: Transform.rotate(
                        angle: (i - 1) * -7 * math.pi / 180,
                        child: BookCover(
                          id,
                          width: 78,
                          radius: 10,
                          border: Border.all(color: const Color(0xB3FFFFFF), width: 2),
                          shadow: const [BoxShadow(color: Color(0x8C3C0A0A), offset: Offset(0, 14), blurRadius: 26, spreadRadius: -12)],
                        ),
                      ),
                    ),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                FractionallySizedBox(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: 0.58,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: const Color(0x38FFFFFF), borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.sparkles, size: 12, color: white),
                        const SizedBox(width: 5),
                        Flexible(child: Text(t('hero_badge'), style: px(10.5, weight: FontWeight.w800, color: white))),
                      ]),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(0, 10, 0, 6),
                      child: Text(t('hero_title'), style: px(22, weight: FontWeight.w800, color: white, height: 1.1, ls: -0.02)),
                    ),
                    Opacity(opacity: 0.93, child: Text(t('hero_body'), style: px(12.5, color: white, height: 1.45))),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final key in const ['benefit_1', 'benefit_2', 'benefit_3'])
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(color: const Color(0xF2FFFFFF), borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          // #B3262C (books.css .bk-benefits span)
                          const AIcon(AIcons.check, size: 12, color: Color(0xFFB3262C)),
                          const SizedBox(width: 4),
                          Text(t(key), style: px(11, weight: FontWeight.w700, color: const Color(0xFFB3262C))),
                        ]),
                      ),
                  ]),
                ),
              ]),
            ),
          ]);
        }),
      ]),
    );
  }

  Widget _tier(BuildContext context, int count, int index) {
    final a = context.a;
    final dark = context.tokens.isDark;
    final unit = bookUnitPrice(count);
    final pct = ((1 - unit / kBookBasePrice) * 100).round();
    final active = _cart.length >= count && (count == 10 || _cart.length < _tiers[index + 1]);
    final hot = count == 5, best = count == 10;
    final ring = active || hot ? Border.all(color: a.coral, width: 2) : Border.all(color: dark ? const Color(0x14FFFFFF) : a.line, width: 1.5);
    return Stack(clipBehavior: Clip.none, alignment: Alignment.topCenter, children: [
      Container(
        key: ValueKey('books-tier-$count'),
        padding: const EdgeInsets.fromLTRB(6, 14, 6, 10),
        decoration: BoxDecoration(color: active ? a.coralSoft : a.surface, borderRadius: BorderRadius.circular(18), border: ring),
        child: Column(children: [
          Text(t('bundle_n', {'n': count}), textAlign: TextAlign.center, style: px(12, weight: FontWeight.w700, color: a.inkSoft)),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 3, 0, 1),
            child: FittedBox(fit: BoxFit.scaleDown, child: Text(formatAzn(bookOrderTotal(count)), style: px(17, weight: FontWeight.w800, color: a.ink, ls: -0.02))),
          ),
          Text(t('per_book', {'price': formatAzn(unit)}), textAlign: TextAlign.center, style: px(10, color: a.inkSoft)),
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: pct > 0 ? BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999)) : null,
            child: Text(pct > 0 ? t('save', {'pct': pct}) : '\u00a0', style: px(10, weight: FontWeight.w800, color: a.greenInk)),
          ),
        ]),
      ),
      if (hot || best)
        Positioned(
          top: -9,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            // .bk-tier.best em: #1C7A4D
            decoration: BoxDecoration(color: best ? const Color(0xFF1C7A4D) : a.coral, borderRadius: BorderRadius.circular(999)),
            child: Text(hot ? t('popular') : t('best'), softWrap: false, style: px(9.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
          ),
        ),
    ]);
  }

  Widget _collection(BuildContext context, List<Book> collection, String ageLabel) {
    final a = context.a;
    final tint = bookTint(_age, dark: context.tokens.isDark);
    const offsets = [(0.0, 10.0, -8.0), (10.0, 4.0, -3.0), (20.0, 2.0, 3.0), (28.0, 6.0, 8.0)];
    final total = bookOrderTotal({..._cart, ...collection.map((b) => b.id)}.length);
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(22)),
      child: Row(children: [
        SizedBox(
          width: 92,
          height: 108,
          child: Stack(children: [
            for (var i = 0; i < collection.length && i < 4; i++)
              Positioned(
                left: offsets[i].$1,
                top: offsets[i].$2,
                child: Transform.rotate(
                  angle: offsets[i].$3 * math.pi / 180,
                  child: BookCover(collection[i].id, width: 64, radius: 8, shadow: const [BoxShadow(color: Color(0x73000000), offset: Offset(0, 8), blurRadius: 16, spreadRadius: -10)]),
                ),
              ),
          ]),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('collection_title', {'age': ageLabel}), style: px(14.5, weight: FontWeight.w800, color: tint.ink)),
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 2, 0, 10),
              child: Text(collection.length == 10 ? t('collection_body') : t('results', {'n': collection.length}), style: px(11.5, color: a.inkSoft)),
            ),
            GestureDetector(
              key: const ValueKey('books-collection-add'),
              onTap: () => _addMany([for (final b in collection) b.id]),
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: tint.solid, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const AIcon(AIcons.plus, size: 14, color: Color(0xFFFFFFFF)),
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text('${t('collection_cta')} · ${formatAzn(total)}',
                        softWrap: false, overflow: TextOverflow.fade, style: px(11.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _card(BuildContext context, Book book, bool own, BooksQaygiCash qcPort) {
    final a = context.a;
    final dark = context.tokens.isDark;
    final added = _cart.contains(book.id);
    final badge = own ? null : qcPort.productBadge(context, toMinor(bookUnitPrice(math.max(1, _cart.length + (added ? 0 : 1)))));
    return Container(
      key: ValueKey('book-card-${book.id}'),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: dark ? const Color(0x14FFFFFF) : a.line),
        // 0 10px 24px -20px rgba(80, 30, 20, .45) (books.css .bk-card)
        boxShadow: const [BoxShadow(color: Color(0x73501E14), offset: Offset(0, 10), blurRadius: 24, spreadRadius: -20)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(
          button: true,
          label: book.title,
          child: GestureDetector(onTap: () => _openDetail(book), child: BookCover(book.id, radius: 14)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(book.title, style: px(13, weight: FontWeight.w800, color: a.ink, height: 1.25)),
            Padding(padding: const EdgeInsets.only(top: 2), child: Text(t('pages', {'n': book.pages}), style: px(11, color: a.inkSoft))),
            ?badge,
          ]),
        ),
        if (own)
          Container(
            height: 36,
            decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              AIcon(AIcons.check, size: 13, color: a.greenInk),
              const SizedBox(width: 5),
              Text(t('owned'), style: px(12.5, weight: FontWeight.w800, color: a.greenInk)),
            ]),
          )
        else
          Semantics(
            button: true,
            toggled: added,
            child: GestureDetector(
              key: ValueKey('book-add-${book.id}'),
              onTap: () => _toggle(book.id),
              child: Container(
                height: 36,
                decoration: BoxDecoration(color: added ? a.coral : a.coralSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(added ? AIcons.check : AIcons.plus, size: 14, color: added ? const Color(0xFFFFFFFF) : a.coralText),
                  const SizedBox(width: 5),
                  Text(added ? t('added') : formatAzn(bookUnitPrice(math.max(1, _cart.length + 1))),
                      style: px(13, weight: FontWeight.w800, color: added ? const Color(0xFFFFFFFF) : a.coralText)),
                ]),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _cartBar(BuildContext context, ({int add, double unit})? next) {
    final a = context.a;
    const white = Color(0xFFFFFFFF);
    return Semantics(
      button: true,
      child: GestureDetector(
        key: const ValueKey('books-cartbar'),
        onTap: () => setState(() => _cartOpen = true),
        child: Container(
          padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 10, 10),
          decoration: BoxDecoration(
            color: a.deep,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0x14FFFFFF)),
            // 0 18px 40px -16px rgba(40, 10, 10, .6) (books.css .bk-cartbar)
            boxShadow: const [BoxShadow(color: Color(0x99280A0A), offset: Offset(0, 18), blurRadius: 40, spreadRadius: -16)],
          ),
          child: Row(children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(12)),
              child: Text('${_cart.length}', style: px(16, weight: FontWeight.w800, color: white)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(formatAzn(bookOrderTotal(_cart.length)), style: px(15, weight: FontWeight.w800, color: white)),
                Opacity(
                  opacity: 0.8,
                  child: Text(
                    next != null ? t('cart_next', {'n': next.add, 'price': formatAzn(next.unit)}) : t('cart_best'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: px(11, color: white),
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 12),
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(12)),
              // #2E2A2B (books.css .bk-cartbar-cta)
              child: Text(t('cart_title'), style: px(13, weight: FontWeight.w800, color: const Color(0xFF2E2A2B))),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _cartSheet(BuildContext context,
      {required BookCatalog? catalog, required bool ready, required bool adminTest, required BooksQcState qc, required int qcEarn, required BooksQaygiCash qcPort, required int bookRate}) {
    final a = context.a;
    final count = _cart.length;
    final total = bookOrderTotal(count);
    final saved = ((count * kBookBasePrice - total) * 100).round() / 100;
    final next = nextBookTier(count);
    final progress = math.min(1.0, count / 10);
    final summary = qc.amount != 0 ? qcPort.summaryLine(context, qc.amount) : null;
    final earn = count > 0 ? qcPort.earnBox(context, qcEarn) : null;
    final redeem = count > 0 && qc.hasWallet && qc.showRedeem ? qcPort.redeemRow(context, toMinor(total)) : null;
    final canPay = count > 0 && !_busy && (adminTest || _consent);
    return BooksSheet(
      label: t('cart_title'),
      onClose: () => setState(() => _cartOpen = false),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(top: 4, end: 40),
          child: Text('${t('cart_title')} · ${t('cart_count', {'n': count})}', style: px(21, weight: FontWeight.w800, color: a.ink, ls: -0.02)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(6, 18, 6, 26),
          child: LayoutBuilder(builder: (context, c) {
            return SizedBox(
              height: 8,
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned.fill(
                  child: Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: c.maxWidth * progress,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          // linear-gradient(90deg, #FF8D89, #FF5A5F) (books.css .bk-ladder-bar i)
                          gradient: const LinearGradient(colors: [Color(0xFFFF8D89), Color(0xFFFF5A5F)]),
                        ),
                      ),
                    ),
                  ),
                ),
                for (final step in _tiers)
                  Positioned(
                    left: c.maxWidth * step / 10 - (step == 10 ? 0.9 : 0.5) * 44,
                    top: -6,
                    width: 44,
                    child: Column(children: [
                      Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: count >= step ? a.coral : a.surface,
                          shape: BoxShape.circle,
                          border: count >= step ? null : Border.all(color: a.line, width: 2),
                        ),
                        child: Text('$step', style: px(10, weight: FontWeight.w700, color: count >= step ? const Color(0xFFFFFFFF) : a.inkSoft, height: 1)),
                      ),
                      Padding(padding: const EdgeInsets.only(top: 3), child: Text(formatAzn(bookUnitPrice(step)), softWrap: false, style: px(9.5, color: a.inkSoft))),
                    ]),
                  ),
              ]),
            );
          }),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(12)),
          child: Text(next != null ? t('cart_next', {'n': next.add, 'price': formatAzn(next.unit)}) : t('cart_best'), style: px(12.5, weight: FontWeight.w700, color: a.coralText)),
        ),
        if (count == 0)
          Padding(padding: const EdgeInsets.only(top: 12), child: Text(t('cart_empty'), style: px(12, color: a.inkSoft)))
        else
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(children: [
              for (final id in _cart)
                if (catalog?.findBook(id) case final book?)
                  Container(
                    key: ValueKey('books-cart-$id'),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
                    child: Row(children: [
                      BookCover(id, width: 40, radius: 6),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(book.title, style: px(13, color: a.ink)),
                          Text('${t('age_${book.age}')} · ${t('pages', {'n': book.pages})}', style: px(11, color: a.inkSoft)),
                        ]),
                      ),
                      const SizedBox(width: 10),
                      Text(formatAzn(bookUnitPrice(count)), style: px(12.5, weight: FontWeight.w800, color: a.ink)),
                      const SizedBox(width: 10),
                      Semantics(
                        button: true,
                        label: t('cart_remove'),
                        child: GestureDetector(
                          onTap: () => setState(() => _setCart(_cart.where((x) => x != id).toList())),
                          child: Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                            child: AIcon(AIcons.x, size: 14, color: a.ink),
                          ),
                        ),
                      ),
                    ]),
                  ),
            ]),
          ),
        if (redeem != null) Padding(padding: const EdgeInsets.only(top: 12), child: redeem),
        ?summary,
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('cart_unit', {'price': formatAzn(bookUnitPrice(math.max(1, count)))}), style: px(12, color: a.inkSoft)),
                if (saved > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(t('cart_saved', {'amount': formatAzn(saved)}), style: px(12, weight: FontWeight.w800, color: a.ok)),
                  ),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(t('cart_total'), style: px(12, color: a.inkSoft)),
              Text(formatAzn(toAzn(toMinor(total) - qc.amount)), key: const ValueKey('books-cart-total'), style: px(24, weight: FontWeight.w800, color: a.ink, ls: -0.02)),
            ]),
          ]),
        ),
        if (earn != null) Padding(padding: const EdgeInsets.only(top: 10), child: earn),
        if (count > 0 && !adminTest)
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 12, 0, 2),
            child: GestureDetector(
              key: const ValueKey('books-consent'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _consent = !_consent),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Semantics(
                  checked: _consent,
                  child: Container(
                    width: 18,
                    height: 18,
                    margin: const EdgeInsets.only(top: 1),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      // accent-color: #ff5a5f (books.css .bk-consent input)
                      color: _consent ? const Color(0xFFFF5A5F) : a.surface,
                      borderRadius: BorderRadius.circular(3),
                      border: Border.all(color: _consent ? const Color(0xFFFF5A5F) : a.lineStrong, width: 1.5),
                    ),
                    child: _consent ? const AIcon(AIcons.check, size: 12, color: Color(0xFFFFFFFF), strokeWidth: 3) : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tr('books_consent_digital',
                        'PDF kitabların ödənişdən dərhal sonra çatdırılmasına razıyam və bununla 14 günlük imtina hüququmu itirdiyimi təsdiqləyirəm. İstifadə şərtləri ilə razıyam.'),
                    style: px(12.5, color: a.inkSoft, height: 1.45),
                  ),
                ),
              ]),
            ),
          ),
        BooksPrimaryButton(
          buttonKey: const ValueKey('books-checkout'),
          onTap: canPay ? () => _checkout(ready: ready, qc: qc, bookRate: bookRate) : null,
          children: [
            _busy ? booksSpinner(16, const Color(0xFFFFFFFF)) : const AIcon(AIcons.shoppingBag, size: 16, color: Color(0xFFFFFFFF)),
            Text(t('checkout')),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text(
            adminTest ? 'Admin test rejimi: ödəniş qoşulmayıb, kitablar pulsuz sizin hesaba əlavə olunacaq.' : t('pay_note'),
            textAlign: TextAlign.center,
            style: px(11.5, color: a.inkSoft, height: 1.45),
          ),
        ),
      ]),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.head, required this.child});
  final Widget head;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Padding(padding: const EdgeInsets.only(bottom: 8), child: head), child]),
      );
}

class _AgePill extends StatelessWidget {
  const _AgePill({required this.age, required this.label});
  final String age;
  final String label;
  @override
  Widget build(BuildContext context) {
    final tint = bookTint(age, dark: context.tokens.isDark);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: px(11, weight: FontWeight.w800, color: tint.ink)),
    );
  }
}

class _Flag extends StatelessWidget {
  const _Flag({required this.text, required this.own});
  final String text;
  final bool own;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      // .bk-flag.own: --a-green-ink (dark: #1C7A4D)
      decoration: BoxDecoration(color: own ? (context.tokens.isDark ? const Color(0xFF1C7A4D) : a.greenInk) : a.coral, borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: px(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
    );
  }
}

/// `.bk-chips button` (+ `.soft`, `.on`, age tints).
class _Chip extends StatelessWidget {
  const _Chip({super.key, required this.label, required this.on, required this.onTap, this.soft = false, this.onColor, this.inkColor});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final bool soft;
  final Color? onColor;
  final Color? inkColor;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final dark = context.tokens.isDark;
    final Color bg;
    final Color fg;
    if (on) {
      bg = soft ? a.deep : (onColor ?? a.coral);
      fg = soft ? a.onDeep : const Color(0xFFFFFFFF);
    } else {
      bg = a.surface;
      fg = inkColor ?? (soft ? a.inkSoft : a.ink);
    }
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: soft ? 30 : 34,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(999),
            border: on ? null : Border.all(color: dark ? const Color(0x14FFFFFF) : a.line, width: 1.5),
          ),
          child: Text(label, style: px(soft ? 12 : 12.5, weight: soft ? FontWeight.w700 : FontWeight.w800, color: fg)),
        ),
      ),
    );
  }
}

/// `BookDetail` sheet.
class _BookDetail extends StatelessWidget {
  const _BookDetail({required this.book, required this.owned, required this.inCart, required this.price, required this.t, required this.qc, required this.onToggle, required this.onClose, required this.onMine});
  final Book book;
  final bool owned;
  final bool inCart;
  final double price;
  final String Function(String key, [Map<String, Object?> vars]) t;
  final BooksQaygiCash qc;
  final VoidCallback onToggle;
  final VoidCallback onClose;
  final VoidCallback onMine;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final tint = bookTint(book.age, dark: context.tokens.isDark);
    final badge = owned ? null : qc.productBadge(context, toMinor(price), fontSize: 12);
    Widget tag(String text, {Color? bg, Color? fg}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: bg ?? a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: Text(text, style: px(11, weight: FontWeight.w800, color: fg ?? a.inkSoft)),
        );
    Widget h3(String text) => Padding(padding: const EdgeInsets.fromLTRB(0, 16, 0, 6), child: Text(text, style: px(13, weight: FontWeight.w800, color: a.ink)));
    return BooksSheet(
      label: book.title,
      onClose: onClose,
      footer: owned
          ? BooksPrimaryButton(buttonKey: const ValueKey('book-detail-mine'), onTap: onMine, children: [const AIcon(AIcons.library, size: 16, color: Color(0xFFFFFFFF)), Text(t('tab_mine'))])
          : BooksPrimaryButton(
              buttonKey: const ValueKey('book-detail-toggle'),
              ghost: inCart,
              onTap: onToggle,
              children: inCart
                  ? [AIcon(AIcons.check, size: 16, color: a.coralText), Text(t('added'))]
                  : [const AIcon(AIcons.plus, size: 16, color: Color(0xFFFFFFFF)), Text('${t('add')} · ${formatAzn(price)}')],
            ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(22)),
          child: Center(
            child: FractionallySizedBox(
              widthFactor: 0.58,
              child: BookCover(book.id, radius: 14, shadow: const [BoxShadow(color: Color(0x993C140A), offset: Offset(0, 22), blurRadius: 40, spreadRadius: -22)]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Wrap(spacing: 6, runSpacing: 6, children: [
            tag(t('age_${book.age}'), bg: tint.bg, fg: tint.ink),
            tag(t('topic_${book.topic}')),
            tag(t('print_meta', {'pages': book.pages})),
          ]),
        ),
        Padding(padding: const EdgeInsets.only(top: 10), child: Text(book.title, style: px(21, weight: FontWeight.w800, color: a.ink, ls: -0.02))),
        Padding(padding: const EdgeInsets.only(top: 2), child: Text(book.subtitle, style: px(13, color: a.inkSoft))),
        ?badge,
        h3(t('detail_skills')),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final skill in book.skills)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(999)),
              child: Text(skill, style: px(11.5, weight: FontWeight.w700, color: a.coralText)),
            ),
        ]),
        h3(t('detail_about')),
        Text(book.about, style: px(13, color: a.inkSoft, height: 1.55)),
        BooksPrintGuide(t: t),
      ]),
    );
  }
}

/// `MyBooks`.
class _MyBooks extends StatefulWidget {
  const _MyBooks({required this.owned, required this.loading, required this.catalog, required this.t, required this.onBrowse, required this.log});
  final List<String> owned;
  final bool loading;
  final BookCatalog? catalog;
  final String Function(String key, [Map<String, Object?> vars]) t;
  final VoidCallback onBrowse;
  final void Function(String name, Map<String, Object?> params) log;
  @override
  State<_MyBooks> createState() => _MyBooksState();
}

class _MyBooksState extends State<_MyBooks> {
  String? _pending;

  Future<void> _download(BuildContext context, WidgetRef ref, String id) async {
    final toast = toasts(context);
    final api = ref.read(booksApiProvider);
    setState(() => _pending = id);
    try {
      final url = await api.downloadUrl(id);
      if (url != null) {
        widget.log('book_downloaded', {'book_id': id});
        await api.openExternal(url);
      } else {
        toast.error(widget.t('download_error'));
      }
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final dark = context.tokens.isDark;
    if (widget.loading) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 18), child: Center(child: booksSpinner(24, a.inkSoft)));
    }
    if (widget.owned.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 18),
        child: Column(children: [
          AIcon(AIcons.bookOpen, size: 34, color: a.inkSoft),
          const SizedBox(height: 8),
          Text(t('mine_empty_title'), textAlign: TextAlign.center, style: px(16, weight: FontWeight.w700, color: a.ink)),
          const SizedBox(height: 8),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 280), child: Text(t('mine_empty_body'), textAlign: TextAlign.center, style: px(13, color: a.inkSoft))),
          const SizedBox(height: 8),
          BooksPrimaryButton(onTap: widget.onBrowse, top: 4, children: [const AIcon(AIcons.shoppingBag, size: 16, color: Color(0xFFFFFFFF)), Text(t('tab_store'))]),
        ]),
      );
    }
    return Consumer(builder: (context, ref, _) {
      return Padding(
        padding: const EdgeInsets.only(top: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              AIcon(AIcons.mail, size: 14, color: a.inkSoft),
              const SizedBox(width: 6),
              Expanded(child: Text(t('email_note'), style: px(12, color: a.inkSoft))),
            ]),
          ),
          for (final id in widget.owned)
            if (widget.catalog?.findBook(id) case final book?)
              Container(
                key: ValueKey('my-book-$id'),
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: dark ? const Color(0x14FFFFFF) : a.line)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  BookCover(id, width: 64, radius: 8),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(book.title, style: px(14, weight: FontWeight.w800, color: a.ink)),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(0, 2, 0, 8),
                        child: Text('${t('age_${book.age}')} · ${t('print_meta', {'pages': book.pages})}', style: px(11.5, color: a.inkSoft)),
                      ),
                      GestureDetector(
                        key: ValueKey('my-book-download-$id'),
                        onTap: _pending == id ? null : () => _download(context, ref, id),
                        child: Container(
                          height: 34,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            _pending == id ? booksSpinner(14, const Color(0xFFFFFFFF)) : const AIcon(AIcons.download, size: 14, color: Color(0xFFFFFFFF)),
                            const SizedBox(width: 6),
                            Text(_pending == id ? t('downloading') : t('download'), style: px(12.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                          ]),
                        ),
                      ),
                    ]),
                  ),
                ]),
              ),
          BooksPrintGuide(t: t),
          Padding(padding: const EdgeInsets.fromLTRB(0, 18, 0, 6), child: Text(t('personal_use'), textAlign: TextAlign.center, style: px(11, color: a.inkSoft))),
        ]),
      );
    });
  }
}
