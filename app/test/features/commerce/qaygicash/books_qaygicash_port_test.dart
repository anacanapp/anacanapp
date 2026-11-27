// Ported from: (no React suite) the BookStoreScreen QayğıCash call sites, through the books feature's port.
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/books/books_qaygicash.dart';
import 'package:anacan/features/commerce/qaygicash/books_qaygicash_port.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

void main() {
  screenTest('the book store reads the wallet, the redeem range and the earned toast through the port', (tester) async {
    final backend = FakeCommerceBackend(onRpc: (fn, _) => DbResult<Object?>(data: fn == 'qaygicash_wallet_v1' ? walletFixture() : const <Object?>[]));
    late BooksQcState state;
    late BooksQaygiCash port;
    await pumpApp(
      tester,
      Consumer(
        builder: (context, ref, _) {
          port = ref.watch(booksQaygiCashProvider);
          state = port.watch(ref, 1000);
          return Column(children: [if (state.showRedeem) port.redeemRow(context, 1000)!, port.earnBox(context, 106) ?? const SizedBox()]);
        },
      ),
      overrides: [...commerceOverrides(backend), booksQaygiCashProvider.overrideWith(CommerceBooksQaygiCash.new)],
    );
    await tester.pumpAndSettle();
    expect((state.hasWallet, state.showRedeem, state.amount, state.bookRateBp, state.holdDaysDigital), (true, true, 300, 500, 7));
    expect(find.byKey(const ValueKey('qc-redeem')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('qc-redeem-switch')));
    await tester.pump();
    expect(state.amount, 0);
    expect(find.textContaining('Ödənişdən 7 gün sonra hazır olur.'), findsOneWidget);
    expect(port.errorText('QC_INSUFFICIENT'), 'Balansında kifayət qədər hazır bonus yoxdur.');
    expect(port.earnedToast(134, 7, 'az')!.$1, 'Bu sifarişdən +1,34\u00a0₼ QayğıCash qazanırsan');
  });
}
