// Ported from: src/lib/revenuecat.azure.test.ts, src/lib/revenuecat.timeout.test.ts
import 'dart:async';

import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const keys = RevenueCatConfig(androidApiKey: 'goog_fixture', iosApiKey: 'appl_fixture', apiKey: 'test_fixture');

late FakePurchasesSdk sdk;
String? session;

RevenueCatService service({String platform = 'ios', bool azure = false, bool azureEnabled = false}) => RevenueCatService(
      sdk: sdk,
      env: RevenueCatEnvironment(
        platform: platform,
        isNative: true,
        azurePreview: azure,
        azureRevenueCatEnabled: azureEnabled,
        sessionUserId: () async => session,
        config: keys,
      ),
    );

Map<String, Object?> pro() => customerInfoWith(entitlement: const {});

void main() {
  setUp(() {
    installTestI18n();
    sdk = FakePurchasesSdk();
    session = user;
  });

  for (final platform in ['ios', 'android']) {
    test('keeps every RevenueCat SDK entry point closed on Azure native $platform', () async {
      final rc = service(platform: platform, azure: true);
      expect(rc.enabled, isFalse);
      expect(rc.hasRevenueCatPlugin(), isFalse);
      expect(rc.canUseNativePaywallUI(), isFalse);
      await rc.initRevenueCat('fixture-user');
      await rc.identifyUser('fixture-user');
      await rc.logOutRevenueCat();
      expect((await rc.checkEntitlement()).isPro, isFalse);
      expect(await rc.getOfferings(), isNull);
      expect((await rc.purchasePackage({'identifier': 'fixture-package'})).success, isFalse);
      expect((await rc.restorePurchases()).success, isFalse);
      expect(await rc.presentPaywall(), const RcPaywallResult(didPurchase: false, available: false));
      await rc.presentCustomerCenter();
      expect(sdk.calls, isEmpty);
    });
  }

  test('preserves SDK configuration, identity and purchase calls in source production builds', () async {
    final rc = service();
    expect(rc.enabled, isTrue);
    expect(rc.hasRevenueCatPlugin(), isTrue);
    await rc.initRevenueCat('fixture-user');
    await rc.identifyUser('fixture-user');
    expect(sdk.callsOf('configure').single.args, ['appl_fixture', 'fixture-user']);
    expect(sdk.callsOf('logIn').single.args, ['fixture-user']);
    sdk.onPurchasePackage = (_) => pro();
    expect((await rc.purchasePackage({'identifier': 'fixture-package'})).success, isTrue);
    expect(sdk.callsOf('purchasePackage').single.args.single, {'identifier': 'fixture-package'});
  });

  test('explicit Azure activation waits for an authenticated UUID and coalesces repeated initialization', () async {
    final rc = service(azure: true, azureEnabled: true);
    expect(rc.enabled, isTrue);
    await rc.initRevenueCat();
    await rc.initRevenueCat('not-a-uuid');
    expect(sdk.count('configure'), 0);
    await Future.wait([rc.initRevenueCat(user), rc.identifyUser(user), rc.initRevenueCat(user)]);
    expect(sdk.callsOf('configure').single.args, ['appl_fixture', user]);
    expect(sdk.callsOf('setLogLevel').single.args, ['WARN']);
    expect(sdk.count('logIn'), 0);
  });

  test('Azure purchase/restore/paywall never operate on a different or signed-out account', () async {
    final rc = service(azure: true, azureEnabled: true);
    await rc.initRevenueCat(user);
    for (final s in [null, other]) {
      session = s;
      expect((await rc.purchasePackage({'identifier': 'fixture'})).success, isFalse);
      expect((await rc.restorePurchases()).success, isFalse);
      expect((await rc.presentPaywall()).available, isFalse);
      await rc.presentCustomerCenter();
    }
    for (final m in ['purchasePackage', 'restorePurchases', 'presentPaywall', 'presentCustomerCenter']) {
      expect(sdk.count(m), 0, reason: m);
    }
  });

  test('Azure logout does not create an anonymous customer; next UUID is explicitly rebound', () async {
    final rc = service(azure: true, azureEnabled: true);
    await rc.initRevenueCat(user);
    await rc.logOutRevenueCat();
    expect(rc.canUseNativePaywallUI(), isFalse);
    expect(sdk.count('logOut'), 0);
    await rc.identifyUser(other);
    expect(sdk.count('configure'), 1);
    expect(sdk.callsOf('logIn').single.args, [other]);
  });

  test('a late SDK initialization cannot reopen billing after logout', () async {
    final finish = Completer<void>();
    sdk.onConfigure = (_, _) => finish.future;
    final rc = service(azure: true, azureEnabled: true);
    final starting = rc.initRevenueCat(user);
    await pumpEventQueue();
    expect(sdk.count('configure'), 1);
    await rc.logOutRevenueCat();
    finish.complete();
    await starting;
    expect(rc.canUseNativePaywallUI(), isFalse);
  });

  test('Android buys the paid base plan instead of the free-trial default and never falls back after an offer error', () async {
    final rc = service(platform: 'android');
    final paid = <String, Object?>{
      'id': 'yearly-plan',
      'isBasePlan': true,
      'pricingPhases': [
        {'price': {'amountMicros': 19990000}},
      ],
    };
    final trial = <String, Object?>{
      'id': 'yearly-plan:trial',
      'isBasePlan': false,
      'freePhase': <String, Object?>{},
      'pricingPhases': [
        {'price': {'amountMicros': 0}},
      ],
    };
    final pkg = <String, Object?>{
      'product': {'identifier': 'yearly:yearly-plan', 'defaultOption': trial, 'subscriptionOptions': [trial, paid]},
    };
    sdk.onPurchaseOption = (_, _) => pro();
    expect((await rc.purchasePackage(pkg)).success, isTrue);
    final call = sdk.callsOf('purchaseSubscriptionOption').single;
    expect(identical(call.args[0], paid), isTrue);
    expect(call.args[1], isNull);
    expect(sdk.count('purchasePackage'), 0);
    sdk.onPurchaseOption = (_, _) => throw const PurchasesSdkException(code: 'OFFER_UNAVAILABLE');
    expect((await rc.purchasePackage(pkg)).success, isFalse);
    expect(sdk.count('purchasePackage'), 0);
  });

  test('StoreKit refuses an automatic free trial and rechecks eligibility before a paid introductory purchase', () async {
    final rc = service();
    final intro = <String, Object?>{'price': 0};
    final pkg = <String, Object?>{
      'product': {'identifier': 'yearly.offer', 'price': 19.99, 'currencyCode': 'USD', 'introPrice': intro},
    };
    sdk.onEligibility = (_) => {'yearly.offer': 2};
    expect((await rc.purchasePackage(pkg)).success, isFalse);
    expect(sdk.count('purchasePackage'), 0);
    intro['price'] = 14.99;
    const request = PaidPurchaseRequest(productId: 'yearly.offer', price: 14.99, currency: 'USD', paidIntro: true);
    sdk.onEligibility = (_) => {'yearly.offer': 1};
    expect((await rc.purchasePackage(pkg, request)).success, isFalse);
    expect(sdk.count('purchasePackage'), 0);
    sdk.onEligibility = (_) => {'yearly.offer': 2};
    sdk.onPurchasePackage = (_) => pro();
    expect((await rc.purchasePackage(pkg, request)).success, isTrue);
    expect(sdk.count('purchasePackage'), 1);
  });

  test('Source purchase and restore reject a stale RevenueCat account binding', () async {
    final rc = service();
    sdk.onGetAppUserId = () => other;
    expect((await rc.purchasePackage({'identifier': 'fixture-package'}, null, user)).success, isFalse);
    expect((await rc.restorePurchases(user)).success, isFalse);
    expect((await rc.purchasePackage({'identifier': 'fixture-package'}, null, user)).error, 'REVENUECAT_ACCOUNT_MISMATCH');
    expect((await rc.restorePurchases(user)).reason, 'account');
    expect(sdk.count('purchasePackage'), 0);
    expect(sdk.count('restorePurchases'), 0);
  });

  test('treats RevenueCat string code "20" as a pending payment and "1" as a cancellation', () async {
    final rc = service();
    sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '20', message: 'The payment is pending.');
    expect(await rc.purchasePackage({'identifier': 'fixture'}), const RcPurchaseResult(success: false, error: 'PURCHASE_PENDING'));
    sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '1', message: 'Purchase was cancelled.');
    expect(await rc.purchasePackage({'identifier': 'fixture'}), const RcPurchaseResult(success: false, error: 'USER_CANCELLED'));
    sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '0', message: 'English SDK text');
    expect((await rc.purchasePackage({'identifier': 'fixture'})).error, 'UNKNOWN');
    // Store call finished without the entitlement (Ask to Buy / deferred): pending, not failed.
    sdk.onPurchasePackage = (_) => customerInfoWith();
    expect((await rc.purchasePackage({'identifier': 'fixture'})).error, 'PURCHASE_PENDING');
  });

  test('StoreKit sells the yearly plan when intro eligibility is unknown and the user saw both prices', () async {
    final rc = service();
    final pkg = <String, Object?>{
      'product': {'identifier': 'yearly', 'price': 29.99, 'currencyCode': 'USD', 'introPrice': {'price': 19.99}},
    };
    sdk.onEligibility = (_) => throw StateError('lookup failed');
    sdk.onPurchasePackage = (_) => pro();
    expect((await rc.purchasePackage(pkg, const PaidPurchaseRequest(productId: 'yearly', price: 29.99, currency: 'USD'))).error, 'PURCHASE_OPTION_UNAVAILABLE');
    expect((await rc.purchasePackage(pkg, const PaidPurchaseRequest(productId: 'yearly', price: 29.99, currency: 'USD', introUncertain: true))).success, isTrue);
    expect(sdk.count('purchasePackage'), 1);
  });

  test('Android plan change replaces the active Play subscription instead of billing twice', () async {
    final rc = service(platform: 'android');
    final yearly = <String, Object?>{
      'id': 'yearly-plan',
      'isBasePlan': true,
      'fullPricePhase': {
        'billingPeriod': {'iso8601': 'P1Y'},
      },
      'pricingPhases': [
        {'price': {'amountMicros': 29990000}},
      ],
    };
    final pkg = <String, Object?>{
      'product': {'identifier': 'premium.yearly:yearly-plan', 'subscriptionOptions': [yearly]},
    };
    sdk.onGetCustomerInfo = () => customerInfoWith(entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'premium.monthly', 'productPlanIdentifier': 'monthly-plan'});
    sdk.onPurchaseOption = (_, _) => pro();
    expect((await rc.purchasePackage(pkg, null, null, const PremiumPurchaseContext(ownPremium: true, householdPremium: false))).success, isTrue);
    final call = sdk.callsOf('purchaseSubscriptionOption').single;
    expect(identical(call.args[0], yearly), isTrue);
    expect(call.args[1], const GoogleProductChange(oldProductIdentifier: 'premium.monthly', prorationMode: 1));
  });

  for (final (name, entitlement, premium, error) in [
    ('web/promo own Premium without a store entitlement', null, const PremiumPurchaseContext(ownPremium: true, householdPremium: false), 'PREMIUM_SOURCE_NON_STORE'),
    ('household Premium', null, const PremiumPurchaseContext(ownPremium: false, householdPremium: true), 'PREMIUM_SOURCE_HOUSEHOLD'),
    (
      'an App Store subscription on Android',
      <String, Object?>{'store': 'APP_STORE', 'productIdentifier': 'yearly'},
      const PremiumPurchaseContext(ownPremium: true, householdPremium: false),
      'PREMIUM_MANAGED_ELSEWHERE'
    ),
  ]) {
    test('refuses a store purchase that would double charge: $name', () async {
      final rc = service(platform: 'android');
      sdk.onGetCustomerInfo = () => customerInfoWith(entitlement: entitlement);
      final pkg = <String, Object?>{
        'product': {
          'identifier': 'premium.yearly:yearly-plan',
          'subscriptionOptions': [
            {'id': 'yearly-plan', 'isBasePlan': true, 'pricingPhases': [<String, Object?>{}]},
          ],
        },
      };
      expect(await rc.purchasePackage(pkg, null, null, premium), RcPurchaseResult(success: false, error: error));
      expect(sdk.count('purchaseSubscriptionOption'), 0);
    });
  }

  test('restore distinguishes nothing to restore from a network failure', () async {
    final rc = service();
    sdk.onRestore = () => customerInfoWith();
    expect((await rc.restorePurchases()).reason, 'none');
    sdk.onRestore = () => throw const PurchasesSdkException(code: '10', message: 'Network error');
    expect((await rc.restorePurchases()).reason, 'network');
  });

  group('withNativeTimeout', () {
    test('resolves with the value when the bridge call finishes in time', () async {
      expect(await withNativeTimeout(Future.value('offerings'), const Duration(seconds: 1)), 'offerings');
    });
    testWidgets('rejects with the given label when the bridge call hangs', (tester) async {
      Object? error;
      unawaited(withNativeTimeout(Completer<String>().future, const Duration(milliseconds: 10), 'RC_OFFERINGS_TIMEOUT').catchError((Object e) {
        error = e;
        return '';
      }));
      await tester.pump(const Duration(milliseconds: 20));
      expect('$error', 'RC_OFFERINGS_TIMEOUT');
    });
    test('exposes a ~15s default budget', () => expect(rcNativeTimeout, const Duration(milliseconds: 15000)));
  });
}
