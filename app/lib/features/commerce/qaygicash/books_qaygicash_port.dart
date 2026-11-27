// Ported from: src/components/books/BookStoreScreen.tsx (its QcParts / useQcRedeem / useQaygiCashWallet /
//              invalidateQaygiCash / qcTrack / qk(qcErrorKey) / earned-bonus toast call sites),
//              src/components/qaygicash/qaygicash.css (.books .qc-badge, .books .qc-sum-line, .books .qc-redeem)
//
// The book store's QayğıCash port (`booksQaygiCashProvider` of features/books) on this feature's wallet and parts.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../books/books_qaygicash.dart';
import 'qaygicash.dart';
import 'qaygicash_copy.dart';
import 'qaygicash_hooks.dart';
import 'qc_parts.dart';

/// `useQcRedeem('book', …)` switch/slider state of the store (one store screen at a time).
class _BooksRedeem extends Notifier<({bool on, int? chosen})> {
  @override
  ({bool on, int? chosen}) build() => (on: true, chosen: null);

  void toggle() => state = (on: !state.on, chosen: state.chosen);
  void setAmount(int minor) => state = (on: state.on, chosen: minor);
}

final _booksRedeemProvider = NotifierProvider.autoDispose<_BooksRedeem, ({bool on, int? chosen})>(_BooksRedeem.new);

QcRedeemState _state(WidgetRef ref, int goodsMinor) {
  final wallet = ref.watch(qcWalletProvider).wallet;
  final st = ref.watch(_booksRedeemProvider);
  final limits = redeemLimits(wallet, 'book', goodsMinor);
  final usable = limits.show && limits.block == null;
  final amount = usable && st.on ? (st.chosen == null ? limits.max : clampRedeem(st.chosen!, limits.min, limits.max)) : 0;
  return QcRedeemState(
    wallet: wallet,
    limits: limits,
    channel: 'book',
    on: usable && st.on,
    amount: amount,
    toggle: () {
      final next = !ref.read(_booksRedeemProvider).on;
      ref.read(_booksRedeemProvider.notifier).toggle();
      qcTrack(ref, 'qc_redeem_toggle', {'channel': 'book', 'on': next});
    },
    setAmount: (minor) => ref.read(_booksRedeemProvider.notifier).setAmount(minor),
  );
}

class CommerceBooksQaygiCash implements BooksQaygiCash {
  CommerceBooksQaygiCash(this._ref);
  final Ref _ref;

  @override
  BooksQcState watch(WidgetRef ref, int goodsMinor) {
    final s = _state(ref, goodsMinor);
    final w = s.wallet;
    return BooksQcState(
      hasWallet: w != null,
      showRedeem: w != null && s.limits.show,
      amount: s.amount,
      bookRateBp: rateOf(w, 'book'),
      holdDaysDigital: w?.holdDaysDigital ?? 0,
    );
  }

  @override
  Widget? productBadge(BuildContext context, int priceMinor, {double? fontSize}) => Padding(
    padding: const EdgeInsets.only(top: 5),
    child: QcProductBadge(channel: 'book', priceMinor: priceMinor, fontSize: fontSize ?? 10),
  );

  @override
  Widget? redeemRow(BuildContext context, int goodsMinor) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Consumer(builder: (context, ref, _) => QcRedeemRow(state: _state(ref, goodsMinor), bordered: true)),
  );

  @override
  Widget? summaryLine(BuildContext context, int amountMinor) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: QcSummaryLine(amount: amountMinor, fontSize: 14),
  );

  @override
  Widget? earnBox(BuildContext context, int amountMinor) => amountMinor > 0
      ? Padding(
          padding: const EdgeInsets.only(top: 10),
          child: QcEarnBox(amount: amountMinor, digital: true),
        )
      : null;

  @override
  void track(String event, Map<String, Object?> params) {
    try {
      _ref.read(analyticsSinkProvider).logEvent(event, params);
    } catch (_) {}
  }

  @override
  Future<void> invalidate(WidgetRef ref) => invalidateQaygiCash(ref.read(queryClientProvider));

  @override
  String? errorText(String? code) => qk(qcErrorKey(code));

  @override
  (String, String)? earnedToast(int earnMinor, int holdDaysDigital, String language) => (
    qf('qc_success_earn', {'amount': '+${formatQc(earnMinor, language)}'}),
    qf('qc_success_date', {'date': formatQcDate(availableFrom(holdDaysDigital), language)}),
  );
}
