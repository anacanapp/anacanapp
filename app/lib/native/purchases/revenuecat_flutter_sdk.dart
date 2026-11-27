// Ported from: @revenuecat/purchases-capacitor + @revenuecat/purchases-capacitor-ui call sites in src/lib/revenuecat.ts
//
// [PurchasesSdk] on purchases_flutter 12 / purchases_ui_flutter 12. Typed SDK objects are converted to the
// Capacitor plugin's JSON shapes (both plugins serialise the same purchases-hybrid-common models), so the
// ported selection logic is unchanged. The typed object behind every package / subscription option map is
// remembered with an [Expando], so a purchase hands the SDK the exact object the paywall showed.
//
// Not verifiable without the stores: everything here talks to StoreKit / Play Billing through the native
// plugin. Unit tests run against FakePurchasesSdk.

import 'package:flutter/services.dart' show PlatformException;
import 'package:purchases_flutter/purchases_flutter.dart' as rc;
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart' as rcui;

import 'purchase_errors.dart';
import 'revenuecat.dart';

class RevenueCatFlutterSdk implements PurchasesSdk {
  final Expando<rc.Package> _packages = Expando<rc.Package>('rc.Package');
  final Expando<rc.SubscriptionOption> _options = Expando<rc.SubscriptionOption>('rc.SubscriptionOption');

  Future<T> _call<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on PlatformException catch (e) {
      final details = e.details;
      String? s(String k) => details is Map && details[k] != null ? '${details[k]}' : null;
      throw PurchasesSdkException(
        code: e.code,
        message: e.message ?? s('message'),
        readableErrorCode: s('readableErrorCode') ?? s('readable_error_code'),
        userCancelled: details is Map && details['userCancelled'] == true,
      );
    }
  }

  @override
  Future<void> setLogLevelWarn() => _call(() => rc.Purchases.setLogLevel(rc.LogLevel.warn));

  /// The Capacitor app configured the SDK again on every paywall mount (harmless there). purchases_flutter
  /// would build a new native instance each time, so a second configure binds the account with logIn instead.
  @override
  Future<void> configure({required String apiKey, String? appUserId}) => _call(() async {
        if (await rc.Purchases.isConfigured) {
          if (appUserId != null) await rc.Purchases.logIn(appUserId);
          return;
        }
        await rc.Purchases.configure(rc.PurchasesConfiguration(apiKey)..appUserID = appUserId);
      });

  @override
  Future<void> enableAdServicesAttributionTokenCollection() => _call(rc.Purchases.enableAdServicesAttributionTokenCollection);

  @override
  Future<void> logIn(String appUserId) => _call(() => rc.Purchases.logIn(appUserId));

  @override
  Future<void> logOut() => _call(rc.Purchases.logOut);

  @override
  Future<String> getAppUserId() => _call(() => rc.Purchases.appUserID);

  @override
  Future<Map<String, Object?>?> getCustomerInfo() async => customerInfoJson(await _call(rc.Purchases.getCustomerInfo));

  @override
  Future<Map<String, Object?>?> getOfferings() async {
    final offerings = await _call(rc.Purchases.getOfferings);
    return {
      'all': {for (final e in offerings.all.entries) e.key: _offering(e.value)},
      'current': offerings.current == null ? null : _offering(offerings.current!),
    };
  }

  @override
  Future<Map<String, int>> checkTrialOrIntroductoryPriceEligibility(List<String> productIdentifiers) async {
    final result = await _call(() => rc.Purchases.checkTrialOrIntroductoryPriceEligibility(productIdentifiers));
    return {for (final e in result.entries) e.key: e.value.status.index};
  }

  @override
  Future<Map<String, Object?>?> purchasePackage(Map<String, Object?> package) async {
    final typed = _packages[package];
    if (typed == null) throw const PurchasesSdkException(code: '5', message: 'PURCHASE_OPTION_UNAVAILABLE');
    final result = await _call(() => rc.Purchases.purchase(rc.PurchaseParams.package(typed)));
    return customerInfoJson(result.customerInfo);
  }

  @override
  Future<Map<String, Object?>?> purchaseSubscriptionOption(Map<String, Object?> option, {GoogleProductChange? change}) async {
    final typed = _options[option];
    if (typed == null) throw const PurchasesSdkException(code: '5', message: 'PURCHASE_OPTION_UNAVAILABLE');
    final changeInfo = change == null
        ? null
        : rc.StoreProductChangeInfo(
            change.oldProductIdentifier,
            replacementMode: switch (change.prorationMode) {
              1 => rc.StoreReplacementMode.withTimeProration,
              2 => rc.StoreReplacementMode.chargeProratedPrice,
              3 => rc.StoreReplacementMode.withoutProration,
              5 => rc.StoreReplacementMode.chargeFullPrice,
              6 => rc.StoreReplacementMode.deferred,
              _ => null,
            },
          );
    final result = await _call(() => rc.Purchases.purchase(rc.PurchaseParams.subscriptionOption(typed, productChangeInfo: changeInfo)));
    return customerInfoJson(result.customerInfo);
  }

  @override
  Future<Map<String, Object?>?> restorePurchases() async => customerInfoJson(await _call(rc.Purchases.restorePurchases));

  @override
  Future<List<Map<String, Object?>>> getProducts(List<String> productIdentifiers) async {
    final products = await _call(() => rc.Purchases.getProducts(productIdentifiers));
    return [for (final p in products) _product(p)];
  }

  @override
  Future<String> presentPaywall({bool displayCloseButton = true}) async {
    final result = await _call(() => rcui.RevenueCatUI.presentPaywall(displayCloseButton: displayCloseButton));
    return switch (result) {
      rcui.PaywallResult.notPresented => PaywallResultCode.notPresented,
      rcui.PaywallResult.cancelled => PaywallResultCode.cancelled,
      rcui.PaywallResult.error => PaywallResultCode.error,
      rcui.PaywallResult.purchased => PaywallResultCode.purchased,
      rcui.PaywallResult.restored => PaywallResultCode.restored,
    };
  }

  @override
  Future<void> presentCustomerCenter() => _call(rcui.RevenueCatUI.presentCustomerCenter);

  // ── JSON conversion (purchases-hybrid-common field names) ──

  Map<String, Object?> _offering(rc.Offering o) => {
        'identifier': o.identifier,
        'serverDescription': o.serverDescription,
        'availablePackages': [for (final p in o.availablePackages) _package(p)],
      };

  Map<String, Object?> _package(rc.Package p) {
    final map = <String, Object?>{
      'identifier': p.identifier,
      'packageType': packageTypeName(p.packageType),
      'product': _product(p.storeProduct),
      'offeringIdentifier': p.presentedOfferingContext.offeringIdentifier,
    };
    _packages[map] = p;
    return map;
  }

  Map<String, Object?> _product(rc.StoreProduct p) => {
        'identifier': p.identifier,
        'title': p.title,
        'description': p.description,
        'price': p.price,
        'priceString': p.priceString,
        'currencyCode': p.currencyCode,
        'subscriptionPeriod': p.subscriptionPeriod,
        'productCategory': p.productCategory == rc.ProductCategory.subscription ? 'SUBSCRIPTION' : 'NON_SUBSCRIPTION',
        'introPrice': p.introductoryPrice == null
            ? null
            : {
                'price': p.introductoryPrice!.price,
                'priceString': p.introductoryPrice!.priceString,
                'period': p.introductoryPrice!.period,
                'cycles': p.introductoryPrice!.cycles,
                'periodUnit': p.introductoryPrice!.periodUnit.name.toUpperCase(),
                'periodNumberOfUnits': p.introductoryPrice!.periodNumberOfUnits,
              },
        'defaultOption': p.defaultOption == null ? null : _option(p.defaultOption!),
        'subscriptionOptions': p.subscriptionOptions == null ? null : [for (final o in p.subscriptionOptions!) _option(o)],
      };

  Map<String, Object?> _option(rc.SubscriptionOption o) {
    final map = <String, Object?>{
      'id': o.id,
      'storeProductId': o.storeProductId,
      'productId': o.productId,
      'pricingPhases': [for (final ph in o.pricingPhases) _phase(ph)],
      'tags': List<String>.of(o.tags),
      'isBasePlan': o.isBasePlan,
      'billingPeriod': _period(o.billingPeriod),
      'isPrepaid': o.isPrepaid,
      'fullPricePhase': o.fullPricePhase == null ? null : _phase(o.fullPricePhase!),
      'freePhase': o.freePhase == null ? null : _phase(o.freePhase!),
      'introPhase': o.introPhase == null ? null : _phase(o.introPhase!),
      'installmentsInfo': o.installmentsInfo == null
          ? null
          : {
              'commitmentPaymentsCount': o.installmentsInfo!.commitmentPaymentsCount,
              'renewalCommitmentPaymentsCount': o.installmentsInfo!.renewalCommitmentPaymentsCount,
            },
    };
    _options[map] = o;
    return map;
  }

  static Map<String, Object?>? _period(rc.Period? p) =>
      p == null ? null : {'unit': p.unit.name.toUpperCase(), 'value': p.value, 'iso8601': p.iso8601};

  static Map<String, Object?> _phase(rc.PricingPhase ph) => {
        'billingPeriod': _period(ph.billingPeriod),
        'recurrenceMode': switch (ph.recurrenceMode) {
          rc.RecurrenceMode.infiniteRecurring => 1,
          rc.RecurrenceMode.finiteRecurring => 2,
          rc.RecurrenceMode.nonRecurring => 3,
          rc.RecurrenceMode.unknown => 0,
          null => null,
        },
        'billingCycleCount': ph.billingCycleCount,
        'price': {'formatted': ph.price.formatted, 'amountMicros': ph.price.amountMicros, 'currencyCode': ph.price.currencyCode},
        'offerPaymentMode': ph.offerPaymentMode?.name,
      };
}

/// `PACKAGE_TYPE` names of the Capacitor plugin.
String packageTypeName(rc.PackageType type) => switch (type) {
      rc.PackageType.annual => 'ANNUAL',
      rc.PackageType.monthly => 'MONTHLY',
      rc.PackageType.lifetime => 'LIFETIME',
      rc.PackageType.sixMonth => 'SIX_MONTH',
      rc.PackageType.threeMonth => 'THREE_MONTH',
      rc.PackageType.twoMonth => 'TWO_MONTH',
      rc.PackageType.weekly => 'WEEKLY',
      rc.PackageType.custom => 'CUSTOM',
      rc.PackageType.unknown => 'UNKNOWN',
    };

/// RevenueCat `STORE` names.
String storeName(rc.Store store) => switch (store) {
      rc.Store.appStore => 'APP_STORE',
      rc.Store.macAppStore => 'MAC_APP_STORE',
      rc.Store.playStore => 'PLAY_STORE',
      rc.Store.stripe => 'STRIPE',
      rc.Store.promotional => 'PROMOTIONAL',
      rc.Store.unknownStore => 'UNKNOWN_STORE',
      rc.Store.amazon => 'AMAZON',
      rc.Store.rcBilling => 'RC_BILLING',
      rc.Store.paddle => 'PADDLE',
      rc.Store.testStore => 'TEST_STORE',
      rc.Store.externalStore => 'EXTERNAL',
      rc.Store.galaxy => 'GALAXY',
    };

/// Customer info → `{entitlements: {active: {...}, all: {...}}, activeSubscriptions, originalAppUserId,
/// originalPurchaseDate, allPurchaseDates, allExpirationDates}`.
Map<String, Object?> customerInfoJson(rc.CustomerInfo info) {
  Map<String, Object?> entitlement(rc.EntitlementInfo e) => {
        'identifier': e.identifier,
        'isActive': e.isActive,
        'willRenew': e.willRenew,
        'periodType': e.periodType.name.toUpperCase(),
        'store': storeName(e.store),
        'productIdentifier': e.productIdentifier,
        'productPlanIdentifier': e.productPlanIdentifier,
        'expirationDate': e.expirationDate,
        'latestPurchaseDate': e.latestPurchaseDate,
        'originalPurchaseDate': e.originalPurchaseDate,
        'isSandbox': e.isSandbox,
      };
  return {
    'entitlements': {
      'active': {for (final e in info.entitlements.active.entries) e.key: entitlement(e.value)},
      'all': {for (final e in info.entitlements.all.entries) e.key: entitlement(e.value)},
    },
    'activeSubscriptions': List<String>.of(info.activeSubscriptions),
    'originalAppUserId': info.originalAppUserId,
    'originalPurchaseDate': info.originalPurchaseDate,
    'allPurchaseDates': Map<String, String?>.of(info.allPurchaseDates),
    'allExpirationDates': Map<String, String?>.of(info.allExpirationDates),
  };
}
