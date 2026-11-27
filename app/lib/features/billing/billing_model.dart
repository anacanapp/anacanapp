// Ported from: src/components/BillingScreen.tsx (fetchPaymentHistory, the derived subscription state, handleUpgrade)
//
// Pure logic of the billing screen, kept apart from the widget so it can be tested without a store.
import '../../native/purchases/purchase_errors.dart';
import '../../native/purchases/web_premium_client.dart';

/// 'original' | 'renewal' | 'next'
typedef PaymentEntryType = String;

class PaymentEntry {
  const PaymentEntry({required this.productId, required this.date, required this.type, this.willRenew});
  final String productId;
  final String date;
  final PaymentEntryType type;
  final bool? willRenew;

  bool get isYearly {
    final id = productId.toLowerCase();
    return id.contains('year') || id.contains('annual');
  }

  @override
  bool operator ==(Object other) =>
      other is PaymentEntry && other.productId == productId && other.date == date && other.type == type && other.willRenew == willRenew;
  @override
  int get hashCode => Object.hash(productId, date, type, willRenew);
  @override
  String toString() => 'PaymentEntry($productId, $date, $type)';
}

/// What `fetchPaymentHistory` learns from one `getCustomerInfo()`.
class PaymentHistory {
  const PaymentHistory({required this.entries, this.activeStore, this.activeProductId});
  final List<PaymentEntry> entries;

  /// RevenueCat `store` of the active Premium entitlement (null: no active entitlement).
  final String? activeStore;
  final String? activeProductId;
}

int _ms(String date) => DateTime.tryParse(date)?.millisecondsSinceEpoch ?? 0;

/// `fetchPaymentHistory` minus the price lookup. [customerInfo] is the Capacitor-shaped JSON of
/// `revenuecat_flutter_sdk.dart` (`entitlements.active`, `originalPurchaseDate`, `allPurchaseDates`).
PaymentHistory paymentHistoryFrom(Map<String, Object?> customerInfo, {required String entitlementId}) {
  Map<String, Object?> map(Object? v) => v is Map ? Map<String, Object?>.from(v) : const <String, Object?>{};
  final entitlements = map(customerInfo['entitlements']);
  final active = map(entitlements['active']);
  final pro = active[entitlementId];
  final proMap = pro is Map ? map(pro) : null;
  final productId = proMap?['productIdentifier'];

  final entries = <PaymentEntry>[];
  final original = customerInfo['originalPurchaseDate'];
  final originalDate = original is String && original.isNotEmpty ? original : null;
  if (originalDate != null) entries.add(PaymentEntry(productId: 'original', date: originalDate, type: 'original'));

  // React read `allPurchaseDatesByProduct`, a key the plugin's CustomerInfo does not define, so renewals never
  // showed; the SDK field is `allPurchaseDates` (docs/flutter/PARITY_FIXES.md).
  map(customerInfo['allPurchaseDates']).forEach((id, date) {
    if (date is! String || date.isEmpty) return;
    if (originalDate != null && _ms(date) == _ms(originalDate)) return;
    entries.add(PaymentEntry(productId: id, date: date, type: 'renewal'));
  });

  for (final ent in active.values) {
    if (ent is! Map) continue;
    final expiration = ent['expirationDate'];
    if (expiration is String && expiration.isNotEmpty && ent['willRenew'] == true) {
      final id = ent['productIdentifier'];
      entries.add(PaymentEntry(productId: id is String && id.isNotEmpty ? id : 'next', date: expiration, type: 'next', willRenew: true));
    }
  }

  sortPaymentEntries(entries);
  final store = proMap?['store'];
  return PaymentHistory(
    entries: entries,
    activeStore: store is String ? store : null,
    activeProductId: productId is String && productId.isNotEmpty ? productId : null,
  );
}

/// Scheduled renewals first, then newest first.
void sortPaymentEntries(List<PaymentEntry> entries) {
  entries.sort((a, b) {
    if (a.type == 'next' && b.type != 'next') return -1;
    if (b.type == 'next' && a.type != 'next') return 1;
    return _ms(b.date).compareTo(_ms(a.date));
  });
}

/// The derived state of `BillingScreen`.
class BillingState {
  BillingState({
    required this.subscription,
    required this.isPremium,
    required this.ownPremium,
    required this.householdPremium,
    required this.rowCancelled,
    required this.loading,
    required this.platform,
    this.webState,
    this.storeRead = false,
    this.activeStore,
    this.activeProductId,
    this.realPriceString,
  });

  /// `subscriptions` row (display only).
  final Map<String, dynamic>? subscription;
  final bool isPremium;
  final bool ownPremium;
  final bool householdPremium;
  final bool rowCancelled;
  final bool loading;

  /// 'ios' | 'android' | 'web'
  final String platform;
  final WebPremiumState? webState;

  /// false while `activeStore` is still `undefined` (customer info not read, or not native).
  final bool storeRead;
  final String? activeStore;
  final String? activeProductId;
  final String? realPriceString;

  bool get isWebSubscription => webState?.active == true && webState?.source == 'web_subscription';
  bool get householdOnly => householdPremium && !ownPremium;
  bool get isCancelled => rowCancelled || (isWebSubscription && webState?.renews != true);

  /// Promotional / one-time web passes have nothing that renews: no cancel button.
  bool get nothingRenews =>
      !isWebSubscription && ((storeRead && activeStore == 'PROMOTIONAL') || webState?.source == 'promotional' || webState?.source == 'web_pass');

  /// 'ios' | 'android' | null: where the active Premium is billed.
  String? get storeKind {
    if (!storeRead) return null;
    if (activeStore == 'APP_STORE' || activeStore == 'MAC_APP_STORE') return 'ios';
    if (activeStore == 'PLAY_STORE') return 'android';
    return null;
  }

  String? get planType => subscription?['plan_type'] as String?;
  bool get hasPremiumSub => subscription != null && (planType == 'premium' || planType == 'premium_plus');
  bool get isPremiumPlus => planType == 'premium_plus';

  /// Wait for the entitlement before presenting the account as Free.
  bool get statusLoading => loading && !isPremium;
  bool get isFreeUser => !statusLoading && !hasPremiumSub && !isPremium;

  /// Only the real store price (the user's currency) is shown; an unknown price is left out.
  String get planPrice => householdOnly || (!hasPremiumSub && !isPremium) ? '' : (realPriceString ?? '');

  /// The store to open for cancel: where it is billed, else this device's store, else none (web cabinet).
  String? get cancelStore => storeKind ?? (platform == 'ios' ? 'ios' : platform == 'android' ? 'android' : null);

  /// `handleUpgrade`: a purchase must not duplicate Premium billed elsewhere. Returns the block code or null.
  String? upgradeBlock() {
    final StoreEntitlementInfo? entitlement = isWebSubscription
        ? null
        : !storeRead
            ? unreadEntitlement
            : activeStore != null && activeStore!.isNotEmpty
                ? StoreEntitlementInfo(store: activeStore, productIdentifier: activeProductId)
                : null;
    return storePurchaseBlock(premiumSourceKind(
      platform: platform,
      ownPremium: ownPremium,
      householdPremium: householdPremium,
      storeEntitlement: entitlement,
    ));
  }
}
