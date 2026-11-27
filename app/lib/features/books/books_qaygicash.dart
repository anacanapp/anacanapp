// Ported from: src/lib/qaygicash.ts (toMinor, toAzn, earnPreview), src/components/books/BookStoreScreen.tsx (the
//              QcParts / useQcRedeem / useQaygiCashWallet / invalidateQaygiCash / qk(qcErrorKey) call sites)
//
// The book store's seam to QayğıCash (not ported yet). Default: no wallet — no badge, no redeem row, no earn box,
// nothing redeemed; QayğıCash checkout errors show the generic payment error. The QayğıCash feature overrides
// [booksQaygiCashProvider] (docs/flutter/WIRING.md).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `toMinor(azn)`.
int toMinor(num azn) => (azn * 100).round();

/// `toAzn(minor)`.
double toAzn(num minor) => minor.round() / 100;

/// `earnPreview(amountMinor, rateBp)`: floor(amount × rate) (basis points).
int earnPreview(num amountMinor, num? rateBp) {
  if (rateBp == null || rateBp <= 0 || !(amountMinor > 0)) return 0;
  return (amountMinor.floor() * rateBp / 10000).floor();
}

/// `useQcRedeem('book', goodsMinor)` / wallet state as the store needs it.
@immutable
class BooksQcState {
  const BooksQcState({this.hasWallet = false, this.showRedeem = false, this.amount = 0, this.bookRateBp = 0, this.holdDaysDigital = 0});

  /// `qc.wallet` is loaded.
  final bool hasWallet;

  /// `qc.wallet && qc.limits.show` (the redeem row shows).
  final bool showRedeem;

  /// Bonus applied to this order (minor units; 0 when off).
  final int amount;

  /// `rateOf(wallet, 'book')`.
  final int bookRateBp;

  /// `wallet.hold_days_digital`.
  final int holdDaysDigital;
}

abstract interface class BooksQaygiCash {
  /// Watched in build: the redeem state for an order of [goodsMinor].
  BooksQcState watch(WidgetRef ref, int goodsMinor);

  /// `<QcProductBadge channel="book" priceMinor />`.
  Widget? productBadge(BuildContext context, int priceMinor, {double? fontSize});

  /// `<QcRedeemRow state />` (only called while [BooksQcState.showRedeem]).
  Widget? redeemRow(BuildContext context, int goodsMinor);

  /// `<QcSummaryLine amount />`.
  Widget? summaryLine(BuildContext context, int amountMinor);

  /// `<QcEarnBox amount digital />`.
  Widget? earnBox(BuildContext context, int amountMinor);

  /// `qcTrack(event, params)`.
  void track(String event, Map<String, Object?> params);

  /// `invalidateQaygiCash(client)`.
  Future<void> invalidate(WidgetRef ref);

  /// `qk(qcErrorKey(code))`; null = use the store's generic error.
  String? errorText(String? code);

  /// Success toast after a confirmed purchase with a bonus: `(title, description)`.
  (String, String)? earnedToast(int earnMinor, int holdDaysDigital, String language);
}

class NoBooksQaygiCash implements BooksQaygiCash {
  const NoBooksQaygiCash();
  @override
  BooksQcState watch(WidgetRef ref, int goodsMinor) => const BooksQcState();
  @override
  Widget? productBadge(BuildContext context, int priceMinor, {double? fontSize}) => null;
  @override
  Widget? redeemRow(BuildContext context, int goodsMinor) => null;
  @override
  Widget? summaryLine(BuildContext context, int amountMinor) => null;
  @override
  Widget? earnBox(BuildContext context, int amountMinor) => null;
  @override
  void track(String event, Map<String, Object?> params) {}
  @override
  Future<void> invalidate(WidgetRef ref) async {}
  @override
  String? errorText(String? code) => null;
  @override
  (String, String)? earnedToast(int earnMinor, int holdDaysDigital, String language) => null;
}

final booksQaygiCashProvider = Provider<BooksQaygiCash>((ref) => const NoBooksQaygiCash(), name: 'booksQaygiCashProvider');
