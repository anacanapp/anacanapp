// Ported from: src/App.tsx (`initRevenueCat()` at startup, <PremiumEntitlementMonitor/>), the module singletons of
// src/lib/revenuecat.ts / src/lib/premium-funnel.ts, and the dependencies useInAppPurchase.ts takes from
// useAuth / useQueryClient / supabase.
//
// Riverpod wiring of the purchases layer. Every paywall widget owns its own [InAppPurchaseController] (one
// hook instance per mounted paywall, as in React) built from [inAppPurchaseDepsProvider]; the store SDK binding
// ([RevenueCatService]) is shared by the process.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../core/net/backend_client.dart' show BootstrapOpened;
import '../../core/net/backend_providers.dart';
import '../../core/net/build_config.dart';
import '../../state/user_store.dart';
import 'in_app_purchase.dart';
import 'premium_funnel.dart';
import 'purchase_analytics.dart';
import 'revenuecat.dart';
import 'revenuecat_flutter_sdk.dart';

/// 'ios' | 'android' | 'web' of this build.
String currentStorePlatform() {
  if (kIsWeb) return 'web';
  return switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'web',
  };
}

/// The store SDK. Override with a FakePurchasesSdk in tests.
final purchasesSdkProvider = Provider<PurchasesSdk>((ref) => RevenueCatFlutterSdk());

final revenueCatEnvironmentProvider = Provider<RevenueCatEnvironment>((ref) {
  final platform = currentStorePlatform();
  final result = ref.watch(backendBootstrapProvider).value;
  final azure = result is BootstrapOpened && result.backend.azure;
  return RevenueCatEnvironment(
    platform: platform,
    isNative: platform != 'web',
    azurePreview: azure,
    azureRevenueCatEnabled: BuildConfig.fromEnvironment.azureRevenueCatEnabled == 'true',
    sessionUserId: () async => ref.read(supabaseClientProvider).auth.currentSession?.user.id,
  );
});

/// `revenuecat.ts` module state (Azure binding epoch): one per process.
final revenueCatServiceProvider = Provider<RevenueCatService>(
    (ref) => RevenueCatService(sdk: ref.watch(purchasesSdkProvider), env: ref.watch(revenueCatEnvironmentProvider)));

/// Analytics port for paywalls/purchases/onboarding; the app root overrides it once analytics is ported.
final analyticsSinkProvider = Provider<AnalyticsSink>((ref) => const NoopAnalyticsSink());

/// `premium-funnel.ts` module (throttle state is per process).
final premiumFunnelProvider = Provider<PremiumFunnel>((ref) => PremiumFunnel(
      rpc: (name, args) => ref.read(dbProvider).rpc<Object?>(name, params: args),
      platform: currentStorePlatform,
      lifeStage: () => ref.read(userStoreProvider).lifeStage,
    ));

final inAppPurchaseDepsProvider = Provider<InAppPurchaseDeps>((ref) {
  final result = ref.watch(backendBootstrapProvider).value;
  return InAppPurchaseDeps(
    rc: ref.watch(revenueCatServiceProvider),
    syncEntitlement: () async {
      final res = await ref.read(dbProvider).invoke('sync-revenuecat-entitlement');
      return EntitlementSyncResponse(data: res.data, error: res.error);
    },
    refreshProfile: () => ref.read(authControllerProvider.notifier).refreshProfile(),
    invalidateRoots: (roots) => unawaited(ref
        .read(queryClientProvider)
        .invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && roots.contains('${q.queryKey.first}'))),
    analytics: ref.watch(analyticsSinkProvider),
    azureBackend: result is BootstrapOpened && result.backend.azure,
  );
});

/// `initRevenueCat().catch(console.error)` at app start (App.tsx): anonymous configure on Source/store builds;
/// the account is bound by the paywalls with logIn (Azure waits for an authenticated UUID).
Future<void> bootstrapRevenueCat(ProviderContainer container) async {
  try {
    await container.read(revenueCatServiceProvider).initRevenueCat();
  } catch (_) {}
}

/// `useInAppPurchase()` for a [ConsumerStatefulWidget]: creates the controller, binds the signed-in user (and
/// re-binds when it changes), disposes it with the widget. Rebuild on [purchases] changes with a
/// [ListenableBuilder].
mixin InAppPurchaseHost<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  late final InAppPurchaseController purchases = InAppPurchaseController(ref.read(inAppPurchaseDepsProvider));

  @override
  void initState() {
    super.initState();
    unawaited(purchases.bindUser(ref.read(authUserProvider)?.id));
    ref.listenManual(authUserProvider.select((u) => u?.id), (_, next) => unawaited(purchases.bindUser(next)));
  }

  @override
  void dispose() {
    purchases.dispose();
    super.dispose();
  }
}

/// Builds with the controller of [InAppPurchaseHost] (shorthand for ListenableBuilder).
class PurchasesBuilder extends StatelessWidget {
  const PurchasesBuilder({super.key, required this.controller, required this.builder});
  final InAppPurchaseController controller;
  final Widget Function(BuildContext context, InAppPurchaseController purchases) builder;
  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: controller, builder: (context, _) => builder(context, controller));
}
