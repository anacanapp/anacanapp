// Ported from: src/hooks/useQaygiCash.ts
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../commerce_backend.dart';
import 'qaygicash.dart';

const String qcWalletRoot = 'qaygicash-wallet';
const String qcHistoryRoot = 'qaygicash-history';

/// Refetches the wallet and history everywhere (after an order, a refund screen, Premium with bonus).
Future<void> invalidateQaygiCash(QueryClient client) =>
    client.invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && (q.queryKey.first == qcWalletRoot || q.queryKey.first == qcHistoryRoot));

/// The raw wallet query (`qaygicash_wallet_v1`).
final qcWalletQuery = queryProvider<QcWalletResult>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  return QueryOptions<QcWalletResult>(
    queryKey: [qcWalletRoot, ref.watch(commerceBackendUrlProvider), uid],
    enabled: uid != null,
    staleTime: const Duration(seconds: 60),
    refetchOnWindowFocus: RefetchOn.ifStale,
    retry: retryTimes(1),
    queryFn: (_) async {
      final res = await ref.read(commerceBackendProvider).rpc('qaygicash_wallet_v1');
      if (res.error != null) {
        // Not deployed on this backend yet → the programme simply stays hidden.
        if (RegExp('qaygicash_wallet_v1|PGRST202|42883').hasMatch(errorText(res.error))) return qcDisabled;
        throw res.error!;
      }
      return parseWallet(res.data);
    },
  );
}, name: 'qcWalletQuery');

/// `useQaygiCashWallet()`.
class QcWalletView {
  const QcWalletView({this.wallet, this.isLoading = false, this.isError = false, this.refetch});

  /// The wallet when the programme is available for this account; null otherwise (show nothing).
  final QcWallet? wallet;
  bool get enabled => wallet != null;
  final bool isLoading;
  final bool isError;
  final void Function()? refetch;
}

final qcWalletProvider = Provider.autoDispose<QcWalletView>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  final q = ref.watch(qcWalletQuery);
  final data = uid != null ? q.data : null;
  return QcWalletView(
    wallet: data is QcWallet ? data : null,
    isLoading: uid != null && q.isLoading,
    isError: q.isError,
    refetch: () => unawaited(ref.read(qcWalletQuery.notifier).refetch()),
  );
}, name: 'qcWalletProvider');

/// `useQaygiCashHistory(wallet.enabled)` as useQaygiCash() calls it (history loads once the wallet is enabled).
final qcHistoryQuery = queryProvider<List<QcHistoryItem>>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  final enabled = ref.watch(qcWalletProvider.select((v) => v.enabled));
  return QueryOptions<List<QcHistoryItem>>(
    queryKey: [qcHistoryRoot, ref.watch(commerceBackendUrlProvider), uid],
    enabled: uid != null && enabled,
    staleTime: const Duration(seconds: 60),
    refetchOnWindowFocus: RefetchOn.ifStale,
    queryFn: (_) async {
      final res = await ref.read(commerceBackendProvider).rpc('qaygicash_history_v1', {'p_limit': 60});
      if (res.error != null) throw res.error!;
      return parseHistory(res.data);
    },
  );
}, name: 'qcHistoryQuery');
