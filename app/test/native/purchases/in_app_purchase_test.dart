// Ported from: src/hooks/useInAppPurchase.activation.test.tsx, src/hooks/useInAppPurchase.azure.test.tsx
// (+ extra branches: cancellation, confirmation arriving on a later attempt)
import 'dart:async';

import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

Map<String, Object?> monthlyPackage() => {
      'identifier': r'$rc_monthly',
      'packageType': 'MONTHLY',
      'product': {'identifier': 'com.atlasoon.anacan.premium.monthly', 'price': 3.99, 'priceString': r'$3.99', 'currencyCode': 'USD'},
    };

class Harness {
  Harness({this.azure = false, this.azureEnabled = false, this.azureBackend = false}) {
    sdk.onGetAppUserId = () => user;
    sdk.onGetOfferings = () => {
          'all': {
            'pricing_2026': {'availablePackages': [monthlyPackage()]},
          },
          'current': null,
        };
    sdk.onPurchasePackage = (_) => customerInfoWith(entitlement: const {'periodType': 'NORMAL'});
    sdk.onRestore = () => customerInfoWith(entitlement: const {});
    sdk.onPresentPaywall = () => PaywallResultCode.purchased;
    rc = RevenueCatService(
      sdk: sdk,
      env: RevenueCatEnvironment(
        platform: 'ios',
        isNative: true,
        azurePreview: azure,
        azureRevenueCatEnabled: azureEnabled,
        sessionUserId: () async => user,
        config: const RevenueCatConfig(iosApiKey: 'appl_fixture', androidApiKey: 'goog_fixture', apiKey: 'x'),
      ),
    );
  }

  final bool azure, azureEnabled, azureBackend;
  final FakePurchasesSdk sdk = FakePurchasesSdk();
  late final RevenueCatService rc;
  final RecordingAnalyticsSink analytics = RecordingAnalyticsSink();
  FutureOr<EntitlementSyncResponse> Function() sync = () => const EntitlementSyncResponse(data: {'isPro': false});
  int syncCalls = 0, refreshCalls = 0;
  final List<Set<String>> invalidations = [];

  InAppPurchaseController make() => InAppPurchaseController(InAppPurchaseDeps(
        rc: rc,
        syncEntitlement: () async {
          syncCalls++;
          return sync();
        },
        refreshProfile: () async => refreshCalls++,
        invalidateRoots: invalidations.add,
        analytics: analytics,
        azureBackend: azureBackend,
      ));
}

/// Runs [future] while advancing fake time until it completes.
Future<T> settle<T>(WidgetTester tester, Future<T> future, {Duration step = const Duration(milliseconds: 500), int max = 60}) async {
  var done = false;
  late T value;
  Object? error;
  unawaited(future.then((v) {
    value = v;
    done = true;
  }, onError: (Object e) {
    error = e;
    done = true;
  }));
  for (var i = 0; i < max && !done; i++) {
    await tester.pump(step);
  }
  if (error != null) throw error!;
  expect(done, isTrue, reason: 'future did not complete');
  return value;
}

Future<InAppPurchaseController> ready(WidgetTester tester, Harness h, [String? who = user]) async {
  final c = h.make();
  await settle(tester, c.bindUser(who));
  expect(c.isLoading, isFalse);
  h.syncCalls = 0;
  h.refreshCalls = 0;
  return c;
}

void main() {
  setUp(installTestI18n);

  testWidgets('does not initialize an anonymous SDK or treat cached client Premium as server confirmation', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    expect(c.isPro, isFalse);
    expect(c.packages, hasLength(1));
    final configured = h.sdk.count('configure'), logIns = h.sdk.count('logIn');
    final anonymous = await ready(tester, h, null);
    expect(anonymous.isSupported, isFalse);
    expect(h.sdk.count('configure'), configured);
    expect(h.sdk.count('logIn'), logIns);
  });

  for (final mode in ['azure', 'production']) {
    testWidgets('$mode: store success with unconfirmed backend stays pending and never repeats the purchase', (tester) async {
      final h = Harness(azureBackend: mode == 'azure');
      final c = await ready(tester, h);
      expect(await settle(tester, c.purchaseMonthly()), isFalse);
      expect(c.isPro, isFalse);
      expect(c.error, contains('Premium təsdiqi gözlənilir'));
      expect(h.sdk.count('purchasePackage'), 1);
      expect(h.syncCalls, 4);
      expect(await settle(tester, c.purchaseMonthly()), isFalse);
      expect(h.sdk.count('purchasePackage'), 1);
    });
  }

  testWidgets('unlocks only after a successful authoritative sync', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    h.sync = () => const EntitlementSyncResponse(data: {'isPro': true});
    expect(await settle(tester, c.purchaseMonthly()), isTrue);
    expect(c.isPro, isTrue);
    expect(c.purchaseStatus, 'active');
    expect(h.sdk.count('purchasePackage'), 1);
    final roots = h.invalidations.last;
    expect(roots, containsAll(['community-feed', 'public-profile', 'community-profile-card', 'premium-access-v1']));
    expect(h.analytics.events.last.$1, 'premium_subscribed');
  });

  testWidgets('a confirmation that arrives on a later attempt unlocks the purchase', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    var n = 0;
    h.sync = () => EntitlementSyncResponse(data: {'isPro': ++n >= 3});
    expect(await settle(tester, c.purchaseMonthly()), isTrue);
    expect(h.syncCalls, 3);
    expect(c.purchaseStatus, 'active');
  });

  testWidgets('restore and native paywall success cannot bypass an unconfirmed server result', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    expect(await settle(tester, c.restorePurchases()), isFalse);
    expect(c.restoreFailure, 'pending');
    expect(await settle(tester, c.showPaywallSafe()), const RcPaywallResult(available: true, didPurchase: false));
    expect(c.isPro, isFalse);
  });

  testWidgets('a pending store payment is pending (localized), never a failure, and never shows raw codes', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    h.sdk.onPurchasePackage = (_) => customerInfoWith();
    expect(await settle(tester, c.purchaseMonthly()), isFalse);
    expect(c.purchaseStatus, 'pending');
    expect(c.error, contains('təsdiq gözləyir'));
    expect(h.syncCalls, 0);
  });

  testWidgets('a cancelled store sheet is cancelled, without an error', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    h.sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '1', userCancelled: true);
    expect(await settle(tester, c.purchaseMonthly()), isFalse);
    expect(c.purchaseStatus, 'cancelled');
    expect(c.error, isNull);
  });

  for (final code in ['REVENUECAT_ACCOUNT_MISMATCH', 'PURCHASE_OPTION_UNAVAILABLE', 'PURCHASE_PRICE_CHANGED', 'PREMIUM_SOURCE_NON_STORE']) {
    testWidgets('maps $code to a friendly message', (tester) async {
      final h = Harness();
      final c = await ready(tester, h);
      PremiumPurchaseContext? premium;
      switch (code) {
        case 'REVENUECAT_ACCOUNT_MISMATCH':
          h.sdk.onGetAppUserId = () => other;
        case 'PURCHASE_OPTION_UNAVAILABLE':
          h.sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '5');
        case 'PURCHASE_PRICE_CHANGED':
          h.sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(message: 'PURCHASE_PRICE_CHANGED');
        default:
          premium = const PremiumPurchaseContext(ownPremium: true, householdPremium: false);
      }
      await settle(tester, c.purchaseByIdentifier('monthly', premium));
      expect(c.purchaseStatus, 'failed');
      expect(c.error, isNotEmpty);
      expect(c.error, isNot(contains(code)));
    });
  }

  testWidgets('a hanging server sync cannot keep the paywall loading; offerings load in parallel', (tester) async {
    final h = Harness(azureBackend: true);
    h.sync = () => Completer<EntitlementSyncResponse>().future;
    final c = h.make();
    unawaited(c.bindUser(user));
    for (var i = 0; i < 5 && c.isLoading; i++) {
      await tester.pump(const Duration(milliseconds: 10));
    }
    expect(c.isLoading, isFalse);
    expect(c.packages, hasLength(1));
    expect(c.offeringsFailed, isFalse);
    await tester.pump(const Duration(seconds: 11)); // let the 10 s sync bound fire
  });

  testWidgets('retry re-initializes the store after a failed start and loads offerings', (tester) async {
    final h = Harness(azure: true, azureEnabled: true, azureBackend: true);
    var fail = true;
    h.sdk.onConfigure = (_, _) {
      if (fail) {
        fail = false;
        throw const PurchasesSdkException(message: 'store down');
      }
    };
    final c = h.make();
    await settle(tester, c.bindUser(user));
    expect(c.isSupported, isFalse);
    expect(c.offeringsFailed, isTrue);
    await settle(tester, c.reloadOfferings());
    expect(c.isSupported, isTrue);
    expect(c.packages, hasLength(1));
    expect(c.offeringsFailed, isFalse);
  });

  testWidgets('restore reports why nothing was restored', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    h.sdk.onRestore = () => throw const PurchasesSdkException(code: '10', message: 'Network error');
    expect(await settle(tester, c.restorePurchasesDetailed()), const RestoreOutcome(ok: false, failure: 'network'));
    h.sdk.onRestore = () => customerInfoWith();
    expect(await settle(tester, c.restorePurchasesDetailed()), const RestoreOutcome(ok: false, failure: 'none'));
  });

  testWidgets('restore with an entitlement confirmed by the server activates Premium', (tester) async {
    final h = Harness();
    final c = await ready(tester, h);
    h.sync = () => const EntitlementSyncResponse(data: {'isPro': true});
    expect(await settle(tester, c.restorePurchasesDetailed()), const RestoreOutcome(ok: true));
    expect(c.purchaseStatus, 'active');
  });

  testWidgets('keeps Azure native UI unsupported and never invokes the closed sync route, including explicit refresh/restore', (tester) async {
    final h = Harness(azure: true);
    final c = h.make();
    await settle(tester, c.bindUser('fixture-user'));
    expect(c.isSupported, isFalse);
    expect(c.packages, isEmpty);
    await settle(tester, c.refreshEntitlements());
    expect(await settle(tester, c.restorePurchases()), isFalse);
    expect(await settle(tester, c.showPaywallSafe()), const RcPaywallResult(available: false, didPurchase: false));
    await settle(tester, c.showCustomerCenter());
    expect(h.syncCalls, 0);
    expect(h.refreshCalls, 0);
  });
}
