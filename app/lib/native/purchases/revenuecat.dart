// Ported from: src/lib/revenuecat.ts, src/lib/iap.ts (constants only; the module itself is dead code)
//
// Store SDK access for the paywalls. The SDK sits behind [PurchasesSdk] (Capacitor-shaped JSON maps, so
// `app/lib/domain/billing/onboarding_billing.dart` reads packages exactly like the TypeScript): the real
// implementation is `RevenueCatFlutterSdk` (purchases_flutter / purchases_ui_flutter), tests use
// `FakePurchasesSdk`.

import 'dart:async';

import '../../domain/billing/onboarding_billing.dart' show PaidPurchaseRequest, isoPeriod, optionHasTrial, validatePaidPurchase;
import 'purchase_errors.dart';

/// `RC_BUILD_MARKER` (shown on the web RevenueCat debug page; kept for log parity).
const String rcBuildMarker = '2026-11-25-purchase-recovery-v4';

/// Versioned offering: this build sells the packages of `pricing_2026`, falling back to `current`.
const String rcOfferingId = 'pricing_2026';

/// `RC_PRODUCTS`.
abstract final class RcProducts {
  static const monthly = 'monthly';
  static const yearly = 'yearly';
  static const lifetime = 'lifetime';
}

/// `IAP_PRODUCTS` / `IAP_PLANS` (src/lib/iap.ts): store product ids and Google base plans.
abstract final class IapProducts {
  static const premiumMonthly = 'com.atlasoon.anacan.premium.monthly';
  static const premiumYearly = 'com.atlasoon.anacan.premium.yearly';
  static const monthlyPlan = 'monthly-plan';
  static const yearlyPlan = 'yearly-plan';
  static const appId = 'com.atlasoon.anacan';
}

/// `REVENUECAT_CONFIG`. Keys come from `--dart-define` (see the purchases README):
/// `ANACAN_RC_ANDROID_API_KEY` (goog_…), `ANACAN_RC_IOS_API_KEY` (appl_…), `ANACAN_RC_FALLBACK_API_KEY`.
class RevenueCatConfig {
  const RevenueCatConfig({
    this.androidApiKey = const String.fromEnvironment('ANACAN_RC_ANDROID_API_KEY'),
    this.iosApiKey = const String.fromEnvironment('ANACAN_RC_IOS_API_KEY'),
    this.apiKey = const String.fromEnvironment('ANACAN_RC_FALLBACK_API_KEY'),
    this.entitlementId = 'Anacan LLC Pro',
  });
  final String androidApiKey;
  final String iosApiKey;

  /// Fallback used when the platform key is not set.
  final String apiKey;
  final String entitlementId;
}

/// `RC_NATIVE_TIMEOUT_MS`: a hung store/plugin call must never keep a paywall spinner up forever.
const Duration rcNativeTimeout = Duration(milliseconds: 15000);

/// `withNativeTimeout(promise, ms, label)`: rejects with `Error(label)` when the bridge hangs.
Future<T> withNativeTimeout<T>(Future<T> future, [Duration timeout = rcNativeTimeout, String label = 'RC_NATIVE_TIMEOUT']) =>
    future.timeout(timeout, onTimeout: () => throw LabeledTimeoutException(label));

/// Android Google Play change modes (PRORATION_MODE values).
const int prorationImmediateWithTimeProration = 1;
const int prorationDeferred = 6;

class GoogleProductChange {
  const GoogleProductChange({required this.oldProductIdentifier, required this.prorationMode});
  final String oldProductIdentifier;
  final int prorationMode;

  @override
  bool operator ==(Object other) =>
      other is GoogleProductChange && other.oldProductIdentifier == oldProductIdentifier && other.prorationMode == prorationMode;
  @override
  int get hashCode => Object.hash(oldProductIdentifier, prorationMode);
}

/// `PAYWALL_RESULT` values.
abstract final class PaywallResultCode {
  static const notPresented = 'NOT_PRESENTED';
  static const cancelled = 'CANCELLED';
  static const error = 'ERROR';
  static const purchased = 'PURCHASED';
  static const restored = 'RESTORED';
}

/// The RevenueCat SDK surface used by the app. Values are the Capacitor plugin's JSON shapes:
/// offerings `{all: {id: {identifier, availablePackages: [pkg]}}, current: {...}}`, packages
/// `{identifier, packageType: 'ANNUAL'|'MONTHLY'|…, product: {identifier, price, priceString, currencyCode,
/// subscriptionPeriod, introPrice, defaultOption, subscriptionOptions}}`, customer info
/// `{entitlements: {active: {id: {store, productIdentifier, productPlanIdentifier, willRenew, expirationDate, periodType}}}}`.
/// Failures throw [PurchasesSdkException].
abstract interface class PurchasesSdk {
  Future<void> setLogLevelWarn();
  Future<void> configure({required String apiKey, String? appUserId});
  Future<void> enableAdServicesAttributionTokenCollection();
  Future<void> logIn(String appUserId);
  Future<void> logOut();
  Future<String> getAppUserId();
  Future<Map<String, Object?>?> getCustomerInfo();
  Future<Map<String, Object?>?> getOfferings();

  /// `Purchases.getProducts({productIdentifiers})` (subscriptions): product maps (`identifier`, `priceString`, …).
  Future<List<Map<String, Object?>>> getProducts(List<String> productIdentifiers);

  /// product id → `INTRO_ELIGIBILITY_STATUS` (0 unknown, 1 ineligible, 2 eligible, 3 no offer).
  Future<Map<String, int>> checkTrialOrIntroductoryPriceEligibility(List<String> productIdentifiers);

  /// Returns the customer info after the purchase.
  Future<Map<String, Object?>?> purchasePackage(Map<String, Object?> package);

  /// Android only. Returns the customer info after the purchase.
  Future<Map<String, Object?>?> purchaseSubscriptionOption(Map<String, Object?> option, {GoogleProductChange? change});
  Future<Map<String, Object?>?> restorePurchases();

  /// A [PaywallResultCode].
  Future<String> presentPaywall({bool displayCloseButton = true});
  Future<void> presentCustomerCenter();
}

/// Runtime facts `revenuecat.ts` reads from Capacitor and the backend config.
class RevenueCatEnvironment {
  const RevenueCatEnvironment({
    required this.platform,
    required this.isNative,
    this.pluginAvailable = true,
    this.uiPluginAvailable = true,
    this.azurePreview = false,
    this.azureRevenueCatEnabled = false,
    this.sessionUserId,
    this.config = const RevenueCatConfig(),
  });

  /// 'ios' | 'android' | 'web'
  final String platform;
  final bool isNative;

  /// `Capacitor.isPluginAvailable('Purchases')`.
  final bool pluginAvailable;

  /// `Capacitor.isPluginAvailable('RevenueCatUI')`.
  final bool uiPluginAvailable;

  /// `isAzureBackend()`.
  final bool azurePreview;

  /// `VITE_AZURE_REVENUECAT_ENABLED === 'true'` (`ANACAN_AZURE_REVENUECAT_ENABLED`).
  final bool azureRevenueCatEnabled;

  /// `supabase.auth.getSession()` user id (Azure identity check); null = no session / error.
  final Future<String?> Function()? sessionUserId;
  final RevenueCatConfig config;
}

class RcEntitlementCheck {
  const RcEntitlementCheck({this.isPro = false, this.expiresAt, this.productId, this.willRenew = false, this.periodType, this.store});
  final bool isPro;
  final String? expiresAt;
  final String? productId;
  final bool willRenew;

  /// 'TRIAL' | 'INTRO' | 'NORMAL'
  final String? periodType;
  final String? store;
}

class PremiumPurchaseContext {
  const PremiumPurchaseContext({required this.ownPremium, required this.householdPremium});
  final bool ownPremium;
  final bool householdPremium;

  @override
  bool operator ==(Object other) => other is PremiumPurchaseContext && other.ownPremium == ownPremium && other.householdPremium == householdPremium;
  @override
  int get hashCode => Object.hash(ownPremium, householdPremium);
}

class RcPurchaseResult {
  const RcPurchaseResult({required this.success, this.customerInfo, this.error});
  final bool success;
  final Map<String, Object?>? customerInfo;
  final String? error;

  @override
  bool operator ==(Object other) => other is RcPurchaseResult && other.success == success && other.error == error && other.customerInfo == customerInfo;
  @override
  int get hashCode => Object.hash(success, error);
  @override
  String toString() => 'RcPurchaseResult(success: $success, error: $error)';
}

/// 'none' | 'network' | 'account' | 'error'
typedef RestoreFailure = String;

class RcRestoreResult {
  const RcRestoreResult({required this.success, this.customerInfo, this.reason});
  final bool success;
  final Map<String, Object?>? customerInfo;
  final RestoreFailure? reason;
}

class RcPaywallResult {
  const RcPaywallResult({required this.didPurchase, required this.available});
  final bool didPurchase;
  final bool available;

  @override
  bool operator ==(Object other) => other is RcPaywallResult && other.didPurchase == didPurchase && other.available == available;
  @override
  int get hashCode => Object.hash(didPurchase, available);
  @override
  String toString() => 'RcPaywallResult(available: $available, didPurchase: $didPurchase)';
}

final RegExp _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);

Object? _get(Object? obj, String key) => obj is Map ? obj[key] : null;
bool _truthy(Object? v) => v != null && v != false && v != '' && !(v is num && (v == 0 || v.isNaN));

/// The module state of `revenuecat.ts` (Azure binding epoch) plus every exported function.
class RevenueCatService {
  RevenueCatService({required this.sdk, required this.env});

  final PurchasesSdk sdk;
  final RevenueCatEnvironment env;

  bool _azureConfigured = false;
  String? _azureUserId;
  int _azureEpoch = 0;
  Future<void> _azureBinding = Future<void>.value();

  RevenueCatConfig get config => env.config;
  String get entitlementId => env.config.entitlementId;

  /// Source/store builds retain RevenueCat; Azure activation is an explicit preview opt-in.
  bool get enabled => !env.azurePreview || env.azureRevenueCatEnabled;

  Future<bool> _currentAzureIdentity() async {
    if (!env.azurePreview) return true;
    final bound = _azureUserId;
    if (bound == null) return false;
    try {
      return await env.sessionUserId?.call() == bound;
    } catch (_) {
      return false;
    }
  }

  String _apiKey() {
    final c = env.config;
    if (env.platform == 'android' && c.androidApiKey.isNotEmpty && !c.androidApiKey.startsWith('goog_REPLACE')) return c.androidApiKey;
    if (env.platform == 'ios' && c.iosApiKey.isNotEmpty && !c.iosApiKey.startsWith('appl_REPLACE')) return c.iosApiKey;
    return c.apiKey;
  }

  bool get isNativePlatform => env.isNative;

  bool hasRevenueCatPlugin() => enabled && env.isNative && env.pluginAvailable;

  /// RevenueCat native paywall UI (iOS and Android).
  bool canUseNativePaywallUI() => enabled && (!env.azurePreview || _azureUserId != null) && env.isNative && env.uiPluginAvailable;

  bool hasRevenueCatUIPlugin() => canUseNativePaywallUI();

  /// 'ios' | 'android' | 'web'
  String getPlatform() => env.platform == 'ios' || env.platform == 'android' ? env.platform : 'web';

  /// Apple Ads attribution (AdServices), iOS only; an older plugin without it is skipped.
  Future<void> _enableAppleAdsAttribution() async {
    if (env.platform != 'ios') return;
    try {
      await sdk.enableAdServicesAttributionTokenCollection();
    } catch (_) {}
  }

  /// Initialize the SDK. Call once at app startup on native platforms.
  Future<void> initRevenueCat([String? appUserId]) async {
    if (!enabled || !hasRevenueCatPlugin()) return;
    if (env.azurePreview) {
      if (appUserId == null || !_uuid.hasMatch(appUserId)) return;
      final epoch = _azureEpoch;
      final bind = _azureBinding.then((_) async {
        if (epoch != _azureEpoch || _azureUserId == appUserId) return;
        if (!_azureConfigured) {
          await sdk.setLogLevelWarn();
          await sdk.configure(apiKey: _apiKey(), appUserId: appUserId);
          _azureConfigured = true;
          await _enableAppleAdsAttribution();
        } else {
          await sdk.logIn(appUserId);
        }
        if (epoch == _azureEpoch) _azureUserId = appUserId;
      });
      _azureBinding = bind.then((_) {}, onError: (Object _) {});
      try {
        await bind;
      } catch (_) {
        throw const LabeledTimeoutException('REVENUECAT_INITIALIZATION_UNAVAILABLE');
      }
      return;
    }
    try {
      await sdk.setLogLevelWarn();
      await sdk.configure(apiKey: _apiKey(), appUserId: (appUserId == null || appUserId.isEmpty) ? null : appUserId);
      await _enableAppleAdsAttribution();
    } catch (_) {
      // console.error('[RevenueCat] init error')
    }
  }

  /// Identify the user (after login).
  Future<void> identifyUser(String appUserId) async {
    if (!enabled || !hasRevenueCatPlugin()) return;
    if (env.azurePreview) return initRevenueCat(appUserId);
    try {
      await sdk.logIn(appUserId);
    } catch (_) {}
  }

  /// Log out (after logout). Azure: no anonymous customer; billing stays closed until the next UUID binds.
  Future<void> logOutRevenueCat() async {
    if (env.azurePreview) {
      _azureEpoch++;
      _azureUserId = null;
      return;
    }
    if (!enabled || !hasRevenueCatPlugin()) return;
    try {
      await sdk.logOut();
    } catch (_) {}
  }

  /// The Pro entitlement as the SDK sees it (instant UI hint only; never written to the database).
  Future<RcEntitlementCheck> checkEntitlement() async {
    if (!enabled || !hasRevenueCatPlugin() || !await _currentAzureIdentity()) return const RcEntitlementCheck();
    try {
      final info = await sdk.getCustomerInfo();
      final entitlement = _get(_get(_get(info, 'entitlements'), 'active'), entitlementId);
      if (_truthy(entitlement)) {
        String? s(String k) => _truthy(_get(entitlement, k)) ? '${_get(entitlement, k)}' : null;
        return RcEntitlementCheck(
          isPro: true,
          expiresAt: s('expirationDate'),
          productId: s('productIdentifier'),
          willRenew: _get(entitlement, 'willRenew') == true,
          periodType: s('periodType'),
          store: s('store'),
        );
      }
      return const RcEntitlementCheck();
    } catch (_) {
      return const RcEntitlementCheck();
    }
  }

  /// Offerings; null when they could not be loaded (a hung bridge counts as failed).
  Future<Map<String, Object?>?> getOfferings() async {
    if (!enabled || !hasRevenueCatPlugin() || !await _currentAzureIdentity()) return null;
    try {
      final result = await withNativeTimeout(sdk.getOfferings(), rcNativeTimeout, 'RC_OFFERINGS_TIMEOUT');
      final wrapped = result?['offerings'];
      return wrapped is Map<String, Object?> ? wrapped : result;
    } catch (_) {
      return null;
    }
  }

  /// Unknown eligibility never enables a discounted StoreKit purchase.
  Future<Map<String, int>> getIntroEligibility(List<String> productIdentifiers) async {
    if (!enabled || !hasRevenueCatPlugin() || env.platform != 'ios' || productIdentifiers.isEmpty || !await _currentAzureIdentity()) {
      return {};
    }
    try {
      return await sdk.checkTrialOrIntroductoryPriceEligibility(productIdentifiers);
    } catch (_) {
      return {};
    }
  }

  /// Google Play free-trial option of a package (kept from the TypeScript for parity; no caller buys it).
  static Object? findFreeTrialOption(Object? pkg) {
    final options = _get(_get(pkg, 'product'), 'subscriptionOptions');
    if (options is! List || options.isEmpty) return null;
    for (final o in options) {
      if (_truthy(_get(o, 'freePhase')) && !_truthy(_get(o, 'isBasePlan'))) return o;
    }
    for (final o in options) {
      if (_truthy(_get(o, 'freePhase'))) return o;
    }
    return null;
  }

  StoreEntitlementInfo? _activeStoreEntitlementFrom(Object? customerInfo) {
    final entitlement = _get(_get(_get(customerInfo, 'entitlements'), 'active'), entitlementId);
    if (!_truthy(entitlement)) return null;
    String? s(String k) => _truthy(_get(entitlement, k)) ? '${_get(entitlement, k)}' : null;
    return StoreEntitlementInfo(
      store: s('store'),
      productIdentifier: s('productIdentifier'),
      productPlanIdentifier: s('productPlanIdentifier'),
      willRenew: _truthy(_get(entitlement, 'willRenew')),
      expirationDate: s('expirationDate'),
    );
  }

  bool _isPro(Object? customerInfo) => _truthy(_get(_get(_get(customerInfo, 'entitlements'), 'active'), entitlementId));

  /// Paid purchases only. Android buys the explicit paid option / base plan; a failed offer never falls
  /// back to a different price. A purchase that would duplicate Premium from another source is refused;
  /// an Android plan change replaces the active Play subscription (googleProductChangeInfo).
  Future<RcPurchaseResult> purchasePackage(
    Map<String, Object?> packageToPurchase, [
    PaidPurchaseRequest? selection,
    String? expectedUserId,
    PremiumPurchaseContext? premium,
  ]) async {
    if (!enabled || !hasRevenueCatPlugin() || !await _currentAzureIdentity()) {
      return const RcPurchaseResult(success: false, error: 'BILLING_UNAVAILABLE');
    }
    try {
      Map<String, Object?>? customerInfo;
      if (expectedUserId != null && expectedUserId.isNotEmpty && await sdk.getAppUserId() != expectedUserId) {
        return const RcPurchaseResult(success: false, error: 'REVENUECAT_ACCOUNT_MISMATCH');
      }
      final platform = env.platform;
      StoreEntitlementInfo? current;
      try {
        current = _activeStoreEntitlementFrom(await sdk.getCustomerInfo());
      } catch (_) {
        current = unreadEntitlement;
      }
      final kind = premiumSourceKind(
        platform: getPlatform(),
        ownPremium: premium?.ownPremium ?? false,
        householdPremium: premium?.householdPremium ?? false,
        storeEntitlement: current,
      );
      final blocked = storePurchaseBlock(kind);
      if (blocked != null) return RcPurchaseResult(success: false, error: blocked);

      final selectedOption = selection != null ? validatePaidPurchase(packageToPurchase, selection, platform) : null;
      final product = _get(packageToPurchase, 'product');
      final options = _get(product, 'subscriptionOptions');
      if (platform == 'android' && options is List) {
        Object? option = selectedOption;
        if (option == null) {
          for (final item in options) {
            if (_truthy(_get(item, 'isBasePlan')) && !optionHasTrial(item)) {
              option = item;
              break;
            }
          }
        }
        if (option == null) return const RcPurchaseResult(success: false, error: 'PURCHASE_OPTION_UNAVAILABLE');
        GoogleProductChange? change;
        final currentProduct = identical(current, unreadEntitlement) ? null : current?.productIdentifier;
        if (kind == 'store_same' && currentProduct != null && currentProduct.isNotEmpty) {
          final oldProduct = googleSubscriptionId(currentProduct)!;
          final parts = '${_get(product, 'identifier') ?? ''}'.split(':');
          final newProduct = parts[0];
          final newBasePlan = parts.length > 1 ? parts[1] : null;
          final currentParts = currentProduct.split(':');
          final oldBasePlan = (current!.productPlanIdentifier != null && current.productPlanIdentifier!.isNotEmpty)
              ? current.productPlanIdentifier
              : (currentParts.length > 1 && currentParts[1].isNotEmpty ? currentParts[1] : null);
          if (oldProduct == newProduct && (newBasePlan == null || newBasePlan.isEmpty || oldBasePlan == null || oldBasePlan == newBasePlan)) {
            return const RcPurchaseResult(success: false, error: 'ALREADY_OWNED');
          }
          final toAnnual = const ['P1Y', 'P12M'].contains(isoPeriod(_get(_get(option, 'fullPricePhase'), 'billingPeriod')) ?? '');
          change = GoogleProductChange(
            oldProductIdentifier: oldProduct,
            prorationMode: toAnnual ? prorationImmediateWithTimeProration : prorationDeferred,
          );
        }
        // The SDK adapter maps the exact option object back to its native option, so it is passed as is.
        customerInfo = await sdk.purchaseSubscriptionOption(option is Map<String, Object?> ? option : Map<String, Object?>.from(option as Map),
            change: change);
      } else {
        final intro = _get(product, 'introPrice');
        if (platform == 'ios' && _truthy(intro)) {
          final id = '${_get(product, 'identifier')}';
          final eligibility = await getIntroEligibility([id]);
          final status = eligibility[id];
          final introPrice = _num(_get(intro, 'price'));
          final paidIntro = introPrice > 0;
          // A free trial is never started implicitly. A paid introductory price is allowed when eligible, or
          // when eligibility is unknown and the user was shown both prices ("first year X, otherwise Y").
          final allowed = !paidIntro
              ? status == 1
              : selection?.paidIntro == true
                  ? status == 2 || selection?.introUncertain == true
                  : status == 1 || selection?.introUncertain == true;
          if (!allowed) return const RcPurchaseResult(success: false, error: 'PURCHASE_OPTION_UNAVAILABLE');
        }
        if (platform == 'android' && optionHasTrial(_get(product, 'defaultOption'))) {
          return const RcPurchaseResult(success: false, error: 'PURCHASE_OPTION_UNAVAILABLE');
        }
        customerInfo = await sdk.purchasePackage(packageToPurchase);
      }
      // A finished store call without the entitlement (deferred / Ask to Buy) is pending, not failed.
      return _isPro(customerInfo)
          ? RcPurchaseResult(success: true, customerInfo: customerInfo)
          : RcPurchaseResult(success: false, customerInfo: customerInfo, error: 'PURCHASE_PENDING');
    } catch (err) {
      return RcPurchaseResult(success: false, error: classifyPurchaseError(err));
    }
  }

  /// Restore purchases; [RcRestoreResult.reason] says why nothing was restored.
  Future<RcRestoreResult> restorePurchases([String? expectedUserId]) async {
    if (!enabled || !hasRevenueCatPlugin() || !await _currentAzureIdentity()) return const RcRestoreResult(success: false);
    try {
      if (expectedUserId != null && expectedUserId.isNotEmpty && await sdk.getAppUserId() != expectedUserId) {
        return const RcRestoreResult(success: false, reason: 'account');
      }
      final info = await sdk.restorePurchases();
      return _isPro(info)
          ? RcRestoreResult(success: true, customerInfo: info)
          : RcRestoreResult(success: false, customerInfo: info, reason: 'none');
    } catch (err) {
      final code = classifyPurchaseError(err);
      return RcRestoreResult(
        success: false,
        reason: code == 'STORE_NETWORK'
            ? 'network'
            : code == 'RECEIPT_IN_USE' || code == 'REVENUECAT_ACCOUNT_MISMATCH'
                ? 'account'
                : 'error',
      );
    }
  }

  /// RevenueCat native paywall. `available: false` → the caller keeps the custom paywall.
  Future<RcPaywallResult> presentPaywall() async {
    if (!canUseNativePaywallUI() || !await _currentAzureIdentity()) return const RcPaywallResult(didPurchase: false, available: false);
    try {
      final result = await sdk.presentPaywall(displayCloseButton: true);
      if (result == PaywallResultCode.notPresented) return const RcPaywallResult(didPurchase: false, available: false);
      return RcPaywallResult(didPurchase: result == PaywallResultCode.purchased || result == PaywallResultCode.restored, available: true);
    } catch (_) {
      return const RcPaywallResult(didPurchase: false, available: false);
    }
  }

  /// RevenueCat Customer Center; false when it could not be shown.
  Future<bool> presentCustomerCenter() async {
    if (!canUseNativePaywallUI() || !await _currentAzureIdentity()) return false;
    try {
      await sdk.presentCustomerCenter();
      return true;
    } catch (_) {
      return false;
    }
  }
}

double _num(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.trim()) ?? double.nan;
  if (v == null) return double.nan;
  return double.nan;
}

const String appleSubscriptionsUrl = 'https://apps.apple.com/account/subscriptions';
const String androidPackage = 'com.atlasoon.anacan';

/// Store subscription management page (cancel, resume, change plan) for [store] ('ios' | 'android').
String storeSubscriptionsUrl(String store, [String? productIdentifier]) {
  if (store == 'ios') return appleSubscriptionsUrl;
  final sku = googleSubscriptionId(productIdentifier);
  return sku != null
      ? 'https://play.google.com/store/account/subscriptions?sku=${Uri.encodeComponent(sku)}&package=$androidPackage'
      : 'https://play.google.com/store/account/subscriptions?package=$androidPackage';
}
