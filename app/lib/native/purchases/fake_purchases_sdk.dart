// Ported from: the vi.hoisted `mocks` of src/lib/revenuecat.azure.test.ts (Purchases / RevenueCatUI stand-in)
//
// Scriptable in-memory [PurchasesSdk] for tests and widget previews. Every call is recorded in [calls];
// each behaviour is a replaceable closure (return a value, a Future that never completes, or throw a
// [PurchasesSdkException]).

import 'dart:async';

import 'revenuecat.dart';

class FakeSdkCall {
  const FakeSdkCall(this.method, [this.args = const []]);
  final String method;
  final List<Object?> args;
  @override
  String toString() => '$method(${args.join(', ')})';
}

Map<String, Object?> customerInfoWith({String entitlementId = 'Anacan LLC Pro', Map<String, Object?>? entitlement}) => {
      'entitlements': {
        'active': {entitlementId: ?entitlement},
      },
    };

class FakePurchasesSdk implements PurchasesSdk {
  final List<FakeSdkCall> calls = [];

  FutureOr<void> Function()? onSetLogLevel;
  FutureOr<void> Function(String apiKey, String? appUserId)? onConfigure;
  FutureOr<void> Function(String appUserId)? onLogIn;
  FutureOr<void> Function()? onLogOut;
  FutureOr<String> Function() onGetAppUserId = () => '';
  FutureOr<Map<String, Object?>?> Function() onGetCustomerInfo = () => customerInfoWith();
  FutureOr<Map<String, Object?>?> Function() onGetOfferings = () => {'all': <String, Object?>{}, 'current': null};
  FutureOr<Map<String, int>> Function(List<String> ids) onEligibility = (_) => {};
  FutureOr<Map<String, Object?>?> Function(Map<String, Object?> pkg) onPurchasePackage = (_) => customerInfoWith(entitlement: const {});
  FutureOr<Map<String, Object?>?> Function(Map<String, Object?> option, GoogleProductChange? change) onPurchaseOption =
      (_, _) => customerInfoWith(entitlement: const {});
  FutureOr<Map<String, Object?>?> Function() onRestore = () => customerInfoWith();
  FutureOr<List<Map<String, Object?>>> Function(List<String> ids) onGetProducts = (_) => const [];
  FutureOr<String> Function() onPresentPaywall = () => PaywallResultCode.notPresented;
  FutureOr<void> Function()? onPresentCustomerCenter;

  int count(String method) => calls.where((c) => c.method == method).length;
  List<FakeSdkCall> callsOf(String method) => calls.where((c) => c.method == method).toList();

  @override
  Future<void> setLogLevelWarn() async {
    calls.add(const FakeSdkCall('setLogLevel', ['WARN']));
    await onSetLogLevel?.call();
  }

  @override
  Future<void> configure({required String apiKey, String? appUserId}) async {
    calls.add(FakeSdkCall('configure', [apiKey, appUserId]));
    await onConfigure?.call(apiKey, appUserId);
  }

  @override
  Future<void> enableAdServicesAttributionTokenCollection() async => calls.add(const FakeSdkCall('enableAdServicesAttributionTokenCollection'));

  @override
  Future<void> logIn(String appUserId) async {
    calls.add(FakeSdkCall('logIn', [appUserId]));
    await onLogIn?.call(appUserId);
  }

  @override
  Future<void> logOut() async {
    calls.add(const FakeSdkCall('logOut'));
    await onLogOut?.call();
  }

  @override
  Future<String> getAppUserId() async {
    calls.add(const FakeSdkCall('getAppUserID'));
    return onGetAppUserId();
  }

  @override
  Future<Map<String, Object?>?> getCustomerInfo() async {
    calls.add(const FakeSdkCall('getCustomerInfo'));
    return onGetCustomerInfo();
  }

  @override
  Future<Map<String, Object?>?> getOfferings() async {
    calls.add(const FakeSdkCall('getOfferings'));
    return onGetOfferings();
  }

  @override
  Future<Map<String, int>> checkTrialOrIntroductoryPriceEligibility(List<String> productIdentifiers) async {
    calls.add(FakeSdkCall('checkTrialOrIntroductoryPriceEligibility', [productIdentifiers]));
    return onEligibility(productIdentifiers);
  }

  @override
  Future<Map<String, Object?>?> purchasePackage(Map<String, Object?> package) async {
    calls.add(FakeSdkCall('purchasePackage', [package]));
    return onPurchasePackage(package);
  }

  @override
  Future<Map<String, Object?>?> purchaseSubscriptionOption(Map<String, Object?> option, {GoogleProductChange? change}) async {
    calls.add(FakeSdkCall('purchaseSubscriptionOption', [option, change]));
    return onPurchaseOption(option, change);
  }

  @override
  Future<List<Map<String, Object?>>> getProducts(List<String> productIdentifiers) async {
    calls.add(FakeSdkCall('getProducts', [productIdentifiers]));
    return onGetProducts(productIdentifiers);
  }

  @override
  Future<Map<String, Object?>?> restorePurchases() async {
    calls.add(const FakeSdkCall('restorePurchases'));
    return onRestore();
  }

  @override
  Future<String> presentPaywall({bool displayCloseButton = true}) async {
    calls.add(FakeSdkCall('presentPaywall', [displayCloseButton]));
    return onPresentPaywall();
  }

  @override
  Future<void> presentCustomerCenter() async {
    calls.add(const FakeSdkCall('presentCustomerCenter'));
    await onPresentCustomerCenter?.call();
  }
}
