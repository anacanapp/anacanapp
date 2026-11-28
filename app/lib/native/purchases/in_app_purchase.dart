// Ported from: src/hooks/useInAppPurchase.ts
//
// One controller per signed-in account (the hook's state + effects). Store purchases are confirmed only by
// the server: `sync-revenuecat-entitlement` reads RevenueCat's REST API with the secret key and writes
// `subscriptions` / `profiles`; Premium unlocks after that answer says isPro. A store success without that
// confirmation is "pending" (never a second payment), deferred/Ask-to-Buy payments are "pending" too.

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/i18n/tr.dart';
import '../../domain/billing/onboarding_billing.dart' show PaidPurchaseRequest, isoPeriod;
import 'purchase_analytics.dart';
import 'purchase_errors.dart';
import 'revenuecat.dart';

/// `SYNC_TIMEOUT_MS`: the server confirmation must not keep a paywall spinner forever.
const Duration syncTimeout = Duration(milliseconds: 10000);

/// Retry delays of the confirmation after a purchase/restore (RevenueCat's REST API may lag a fresh purchase).
const List<int> syncDelaysMs = [0, 1500, 3000, 6000];

/// Query roots refreshed after a server confirmation (badges and shared entitlement queries).
const Set<String> entitlementSyncRoots = {
  'premium-access-v1', 'subscription', 'household-premium', 'community-feed', 'group-posts', 'post-comments', 'single-post',
  'user-posts', 'community-connections', 'public-profile', 'community-profile', 'community-profile-card', 'chat-authors-v2',
};

Object? _get(Object? obj, String key) => obj is Map ? obj[key] : null;
bool _truthy(Object? v) => v != null && v != false && v != '' && !(v is num && (v == 0 || v.isNaN));
String _str(Object? v) => _truthy(v) ? '$v' : '';

/// `RCPackage`: the mapped package fields plus `_raw` (the SDK package used for the purchase).
/// The map itself is what `annualStorePlan` / `standardStorePlan` read, so `StorePlan.pkg` is this map.
extension type RcPackage(Map<String, Object?> js) {
  String get identifier => _str(js['identifier']);
  String get packageType => _str(js['packageType']);
  Map<String, Object?> get product => (js['product'] as Map?)?.cast<String, Object?>() ?? const {};
  String get productIdentifier => _str(product['identifier']);
  double get price => (product['price'] as num?)?.toDouble() ?? 0;
  String get priceString => _str(product['priceString']);
  String get currencyCode => _str(product['currencyCode']);
  Map<String, Object?> get raw => (js['_raw'] as Map?)?.cast<String, Object?>() ?? js;
}

/// `mapPackage` of reloadOfferings: base-plan price on Android, store price otherwise.
RcPackage mapRcPackage(Object? pkg) {
  final product = _get(pkg, 'product');
  final defaultOption = _get(product, 'defaultOption');
  final options = _get(product, 'subscriptionOptions');
  Object? basePrice;
  if (options is List) {
    for (final option in options) {
      if (_truthy(_get(option, 'isBasePlan'))) {
        basePrice = _get(_get(option, 'fullPricePhase'), 'price');
        break;
      }
    }
  }
  final micros = _get(basePrice, 'amountMicros');
  final tags = _get(defaultOption, 'tags');
  return RcPackage({
    'identifier': _get(pkg, 'identifier'),
    'packageType': _get(pkg, 'packageType'),
    'product': {
      'identifier': _truthy(_get(product, 'identifier')) ? _get(product, 'identifier') : '',
      'title': _truthy(_get(product, 'title')) ? _get(product, 'title') : '',
      'description': _truthy(_get(product, 'description')) ? _get(product, 'description') : '',
      'priceString': _truthy(_get(basePrice, 'formatted')) ? _get(basePrice, 'formatted') : (_truthy(_get(product, 'priceString')) ? _get(product, 'priceString') : ''),
      'price': _truthy(basePrice) ? (micros is num ? micros / 1e6 : double.nan) : (_truthy(_get(product, 'price')) ? _get(product, 'price') : 0),
      'currencyCode': _truthy(_get(basePrice, 'currencyCode'))
          ? _get(basePrice, 'currencyCode')
          : (_truthy(_get(product, 'currencyCode')) ? _get(product, 'currencyCode') : ''),
      'defaultOptionId': _truthy(_get(defaultOption, 'id')) ? _get(defaultOption, 'id') : null,
      'defaultOptionHasFreeTrial': _truthy(_get(defaultOption, 'freePhase')),
      'defaultOptionTrialPeriod': isoPeriod(_get(_get(defaultOption, 'freePhase'), 'billingPeriod')),
      'defaultOptionTags': tags is List ? List<Object?>.of(tags) : const <Object?>[],
      'subscriptionOptions': options is List
          ? [
              for (final option in options)
                {
                  'id': _truthy(_get(option, 'id')) ? _get(option, 'id') : '',
                  'isBasePlan': _truthy(_get(option, 'isBasePlan')),
                  'tags': _get(option, 'tags') is List ? List<Object?>.of(_get(option, 'tags') as List) : const <Object?>[],
                  'hasFreeTrial': _truthy(_get(option, 'freePhase')),
                  'trialPeriod': isoPeriod(_get(_get(option, 'freePhase'), 'billingPeriod')),
                  'fullPricePeriod': isoPeriod(_get(_get(option, 'fullPricePhase'), 'billingPeriod')),
                },
            ]
          : const <Object?>[],
    },
    '_raw': pkg,
  });
}

/// 'idle' | 'cancelled' | 'failed' | 'pending' | 'active'
typedef PurchaseStatus = String;

/// RestoreFailure | 'unavailable' | 'pending'
typedef RestoreFailureReason = String;

class RestoreOutcome {
  const RestoreOutcome({required this.ok, this.failure});
  final bool ok;
  final RestoreFailureReason? failure;
  @override
  bool operator ==(Object other) => other is RestoreOutcome && other.ok == ok && other.failure == failure;
  @override
  int get hashCode => Object.hash(ok, failure);
  @override
  String toString() => 'RestoreOutcome(ok: $ok, failure: $failure)';
}

/// The answer of `functions.invoke('sync-revenuecat-entitlement')`.
class EntitlementSyncResponse {
  const EntitlementSyncResponse({this.data, this.error});
  final Object? data;
  final Object? error;
}

class InAppPurchaseDeps {
  const InAppPurchaseDeps({
    required this.rc,
    required this.syncEntitlement,
    required this.refreshProfile,
    required this.invalidateRoots,
    this.analytics = const NoopAnalyticsSink(),
    this.azureBackend = false,
  });

  final RevenueCatService rc;

  /// `supabase.functions.invoke('sync-revenuecat-entitlement')` (no body).
  final Future<EntitlementSyncResponse> Function() syncEntitlement;

  /// `useAuth().refreshProfile`.
  final Future<void> Function() refreshProfile;

  /// `queryClient.invalidateQueries({ predicate: roots.has(queryKey[0]) })`.
  final void Function(Set<String> roots) invalidateRoots;
  final AnalyticsSink analytics;

  /// `isAzureBackend()`: offerings and the first sync load together.
  final bool azureBackend;
}

class InAppPurchaseController extends ChangeNotifier {
  InAppPurchaseController(this.deps);

  final InAppPurchaseDeps deps;
  RevenueCatService get _rc => deps.rc;

  List<RcPackage> packages = const [];
  Map<String, List<RcPackage>> offerings = const {};
  Map<String, int> introEligibility = const {};
  bool isLoading = true;
  bool isPurchasing = false;
  String? error;
  bool isSupported = false;
  bool isPro = false;
  PurchaseStatus purchaseStatus = 'idle';

  /// Offerings could not be loaded (store/network); the paywall offers a retry.
  bool offeringsFailed = false;

  /// Why the last restore found nothing.
  RestoreFailureReason? restoreFailure;

  String? _user;
  String? _initializedFor;
  bool _purchaseLock = false;
  bool _disposed = false;
  bool _started = false;

  String? get userId => _user;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  /// The hook's `[user?.id]` effect: call with the signed-in user id (null when signed out).
  Future<void> bindUser(String? userId) {
    if (_started && userId == _user) return _ready;
    _started = true;
    _user = userId;
    return _ready = _init();
  }

  Future<void> _ready = Future<void>.value();

  /// Completes when the latest [bindUser] finished (store SDK configured and bound to the account, or given up).
  Future<void> get ready => _ready;

  Future<void> _init() async {
    final owner = _user;
    packages = const [];
    offerings = const {};
    introEligibility = const {};
    purchaseStatus = 'idle';
    offeringsFailed = false;
    restoreFailure = null;
    _initializedFor = null;
    if (!_rc.isNativePlatform || owner == null) {
      isSupported = false;
      isLoading = false;
      _emit();
      return;
    }
    if (!_rc.hasRevenueCatPlugin()) {
      isSupported = false;
      isLoading = false;
      _emit();
      return;
    }
    _emit();
    try {
      await withNativeTimeout(_rc.initRevenueCat(owner), rcNativeTimeout);
      await withNativeTimeout(_rc.identifyUser(owner), rcNativeTimeout);
      if (_user != owner) return;
      _initializedFor = owner;
      isSupported = true;
      _emit();
      // Instant UI hint only; the database is written by the server sync.
      await _rc.checkEntitlement();
      // Sync on every start/login (renewals, cancellations), in parallel with the offerings.
      final sync = syncWithDatabase().catchError((Object _) => false);
      if (deps.azureBackend) {
        await Future.wait<Object?>([sync, reloadOfferings()]);
      } else {
        await reloadOfferings();
      }
    } catch (_) {
      if (_user == owner) offeringsFailed = true;
      error = tr('useinapppurchase_odenis_sistemi_yuklene_bilmedi_90af92', 'Ödəniş sistemi yüklənə bilmədi');
    } finally {
      if (_user == owner) isLoading = false;
      _emit();
    }
  }

  /// Reload offerings; re-initializes the store SDK first when the earlier start failed.
  Future<void> reloadOfferings() async {
    final owner = _user;
    if (owner == null || !_rc.isNativePlatform || !_rc.hasRevenueCatPlugin()) return;
    isLoading = true;
    _emit();
    try {
      if (_initializedFor != owner) {
        try {
          await withNativeTimeout(_rc.initRevenueCat(owner), rcNativeTimeout);
          await withNativeTimeout(_rc.identifyUser(owner), rcNativeTimeout);
        } catch (_) {
          if (_user == owner) {
            offeringsFailed = true;
            error = tr('useinapppurchase_odenis_sistemi_yuklene_bilmedi_90af92', 'Ödəniş sistemi yüklənə bilmədi');
          }
          return;
        }
        if (_user != owner) return;
        _initializedFor = owner;
        isSupported = true;
        error = null;
      }
      final loaded = await withNativeTimeout(_rc.getOfferings(), rcNativeTimeout);
      if (_user != owner) return;
      final allRaw = _get(loaded, 'all');
      final all = <String, List<RcPackage>>{};
      if (allRaw is Map) {
        for (final entry in allRaw.entries) {
          final list = _get(entry.value, 'availablePackages');
          all['${entry.key}'] = list is List ? [for (final p in list) mapRcPackage(p)] : <RcPackage>[];
        }
      }
      final currentList = _get(_get(loaded, 'current'), 'availablePackages');
      final active = (all[rcOfferingId]?.isNotEmpty ?? false)
          ? all[rcOfferingId]!
          : (currentList is List ? [for (final p in currentList) mapRcPackage(p)] : <RcPackage>[]);
      final introProducts = <String>{
        for (final pkg in all.values.expand((l) => l))
          if (_truthy(_get(_get(pkg.raw, 'product'), 'introPrice'))) pkg.productIdentifier,
      }.toList();
      final eligibility = introProducts.isNotEmpty ? await _rc.getIntroEligibility(introProducts) : <String, int>{};
      if (_user != owner) return;
      offerings = all;
      packages = active;
      introEligibility = eligibility;
      offeringsFailed = loaded == null || active.isEmpty;
    } catch (_) {
      if (_user == owner) offeringsFailed = true;
    } finally {
      if (_user == owner) isLoading = false;
      _emit();
    }
  }

  /// The single trusted write path: the server reads RevenueCat itself. With [expectPro] a fresh purchase that
  /// RevenueCat has not seen yet is retried (0 / 1.5 / 3 / 6 s) instead of being recorded as free.
  Future<bool> syncWithDatabase({bool expectPro = false}) async {
    final owner = _user;
    if (!_rc.enabled || owner == null) return false;
    final maxAttempts = expectPro ? 4 : 1;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (syncDelaysMs[attempt] > 0) await Future<void>.delayed(Duration(milliseconds: syncDelaysMs[attempt]));
      if (_user != owner) return false;
      try {
        final response = await deps.syncEntitlement().timeout(syncTimeout, onTimeout: () => throw const LabeledTimeoutException('SYNC_TIMEOUT'));
        if (_user != owner) return false;
        if (response.error != null) continue;
        final value = _get(response.data, 'isPro');
        if (value is bool) {
          isPro = value;
          _emit();
        }
        await deps.refreshProfile();
        if (value is bool) deps.invalidateRoots(entitlementSyncRoots);
        if (!expectPro || value == true) return value == true;
      } catch (_) {
        // next attempt
      }
    }
    return false;
  }

  /// `purchaseExact(pkg, selection, premium)`: [pkg] is a [RcPackage] (or the `StorePlan.pkg` map).
  Future<bool> purchaseExact(Object pkg, PaidPurchaseRequest? selection, [PremiumPurchaseContext? premium]) =>
      _executePurchase(RcPackage((pkg as Map).cast<String, Object?>()), selection, premium);

  Future<bool> _executePurchase(RcPackage pkg, PaidPurchaseRequest? selection, PremiumPurchaseContext? premium) async {
    final owner = _user;
    if (owner == null || _purchaseLock || purchaseStatus == 'pending') return false;
    _purchaseLock = true;
    isPurchasing = true;
    purchaseStatus = 'idle';
    error = null;
    _emit();
    try {
      await _rc.identifyUser(owner);
      if (_user != owner) return false;
      final result = await _rc.purchasePackage(pkg.raw, selection, owner, premium);
      if (_user != owner) return false;
      if (result.error == 'USER_CANCELLED') {
        error = null;
        purchaseStatus = 'cancelled';
        return false;
      }
      if (result.error == 'PURCHASE_PENDING') {
        // Deferred / pending store payment: the user refreshes the status instead of paying again.
        purchaseStatus = 'pending';
        error = purchaseErrorMessage('PURCHASE_PENDING');
        return false;
      }
      if (result.success) {
        final entitlement = _get(_get(_get(result.customerInfo, 'entitlements'), 'active'), _rc.entitlementId);
        final confirmed = await syncWithDatabase(expectPro: true);
        if (_user != owner) return false;
        if (!confirmed) {
          purchaseStatus = 'pending';
          error = tr('useiap_activation_pending',
              'Mağaza əməliyyatı alındı, Premium təsdiqi gözlənilir. Yenidən ödəniş etməyin; bir qədər sonra bərpanı sınayın.');
          return false;
        }
        isPro = true;
        purchaseStatus = 'active';
        try {
          if (_get(entitlement, 'periodType') == 'TRIAL') {
            deps.analytics.logTrialStarted(pkg.identifier, pkg.price, pkg.currencyCode);
          } else {
            deps.analytics.logPremiumSubscribed(pkg.identifier, selection?.price ?? pkg.price, selection?.currency ?? pkg.currencyCode);
          }
        } catch (_) {}
        return true;
      }
      error = purchaseErrorMessage(result.error);
      purchaseStatus = 'failed';
      return false;
    } catch (err) {
      if (_user != owner) return false;
      final code = classifyPurchaseError(err);
      if (code == 'USER_CANCELLED') {
        error = null;
        purchaseStatus = 'cancelled';
        return false;
      }
      if (code == 'PURCHASE_PENDING') {
        purchaseStatus = 'pending';
        error = purchaseErrorMessage(code);
        return false;
      }
      purchaseStatus = 'failed';
      error = purchaseErrorMessage(code);
      return false;
    } finally {
      _purchaseLock = false;
      if (_user == owner) isPurchasing = false;
      _emit();
    }
  }

  /// Re-check the server confirmation of a store payment instead of paying again.
  Future<bool> retryActivation() async {
    if (_purchaseLock) return false;
    _purchaseLock = true;
    isPurchasing = true;
    _emit();
    try {
      final confirmed = await syncWithDatabase(expectPro: true);
      purchaseStatus = confirmed ? 'active' : 'pending';
      if (confirmed) error = null;
      return confirmed;
    } finally {
      _purchaseLock = false;
      isPurchasing = false;
      _emit();
    }
  }

  static const Map<String, String> _typeMap = {'monthly': 'MONTHLY', 'yearly': 'ANNUAL', 'lifetime': 'LIFETIME'};

  Future<bool> purchaseByIdentifier(String identifier, [PremiumPurchaseContext? premium]) {
    RcPackage? pkg;
    for (final p in packages) {
      if (p.identifier == identifier ||
          p.productIdentifier.contains(identifier) ||
          (_typeMap[identifier] != null && p.packageType == _typeMap[identifier]) ||
          (identifier == 'yearly' && p.productIdentifier.contains('annual'))) {
        pkg = p;
        break;
      }
    }
    if (pkg == null) {
      error = tr('useinapppurchase_mehsul_tapilmadi_ff5957', 'Məhsul tapılmadı');
      _emit();
      return Future.value(false);
    }
    return _executePurchase(pkg, null, premium);
  }

  Future<bool> purchaseMonthly() => purchaseByIdentifier(RcProducts.monthly);
  Future<bool> purchaseYearly() => purchaseByIdentifier(RcProducts.yearly);
  Future<bool> purchaseLifetime() => purchaseByIdentifier(RcProducts.lifetime);

  /// Restore with the reason when nothing was restored.
  Future<RestoreOutcome> restorePurchasesDetailed() async {
    final owner = _user;
    if (owner == null) return const RestoreOutcome(ok: false, failure: 'unavailable');
    isLoading = true;
    error = null;
    restoreFailure = null;
    _emit();
    try {
      await _rc.identifyUser(owner);
      if (_user != owner) return const RestoreOutcome(ok: false, failure: 'account');
      final result = await _rc.restorePurchases(owner);
      if (_user != owner) return const RestoreOutcome(ok: false, failure: 'account');
      if (!result.success) {
        final failure = result.reason ?? 'unavailable';
        restoreFailure = failure;
        return RestoreOutcome(ok: false, failure: failure);
      }
      final confirmed = await syncWithDatabase(expectPro: true);
      if (!confirmed) {
        purchaseStatus = 'pending';
        error = tr('useiap_activation_pending',
            'Mağaza əməliyyatı alındı, Premium təsdiqi gözlənilir. Yenidən ödəniş etməyin; bir qədər sonra bərpanı sınayın.');
        restoreFailure = 'pending';
        return const RestoreOutcome(ok: false, failure: 'pending');
      }
      isPro = true;
      purchaseStatus = 'active';
      return const RestoreOutcome(ok: true);
    } catch (err) {
      final failure = classifyPurchaseError(err) == 'STORE_NETWORK' ? 'network' : 'error';
      restoreFailure = failure;
      error = tr('useinapppurchase_alislar_berpa_edile_bilmedi_33b266', 'Alışlar bərpa edilə bilmədi');
      return RestoreOutcome(ok: false, failure: failure);
    } finally {
      isLoading = false;
      _emit();
    }
  }

  Future<bool> restorePurchases() async => (await restorePurchasesDetailed()).ok;

  Future<bool> showPaywall() async {
    final result = await _rc.presentPaywall();
    if (!result.available) return false;
    if (result.didPurchase) {
      final confirmed = await syncWithDatabase(expectPro: true);
      if (!confirmed) return false;
      isPro = true;
      _emit();
      return true;
    }
    return false;
  }

  Future<RcPaywallResult> showPaywallSafe() async {
    final result = await _rc.presentPaywall();
    if (result.available && result.didPurchase) {
      final confirmed = await syncWithDatabase(expectPro: true);
      if (!confirmed) return const RcPaywallResult(available: true, didPurchase: false);
      isPro = true;
      _emit();
    }
    return result;
  }

  /// false when the Customer Center could not be shown (the caller opens the store page).
  Future<bool> showCustomerCenter() async {
    final presented = await _rc.presentCustomerCenter();
    if (presented) await refreshEntitlements();
    return presented;
  }

  Future<void> refreshEntitlements() async {
    await _rc.checkEntitlement();
    await syncWithDatabase();
  }

  @visibleForTesting
  bool get purchaseLocked => _purchaseLock;
}
