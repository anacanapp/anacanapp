// Ported from: src/components/BillingScreen.tsx (`Purchases.getCustomerInfo()`, `Purchases.getProducts()`,
//              `getPlatform()`)
//
// The store reads the billing screen makes. React called the SDK directly; here they go through
// [RevenueCatService], which only reads once the SDK is bound to the signed-in account: before `configure`
// the native iOS SDK stops the process (`fatalError`), which closed the app when a Premium user (who never
// opened a paywall) opened "My Subscription".
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../native/purchases/purchases_providers.dart';
import '../../native/purchases/revenuecat.dart';
import '../../native/purchases/subscription.dart' show refetchSubscription;

abstract interface class BillingStoreReader {
  /// Capacitor-shaped customer info, or null.
  Future<Map<String, Object?>?> customerInfo();

  /// Store price string ("₼6.99") of [productId], or null.
  Future<String?> priceString(String productId);
}

class SdkBillingStoreReader implements BillingStoreReader {
  SdkBillingStoreReader(this.rc);
  final RevenueCatService rc;

  @override
  Future<Map<String, Object?>?> customerInfo() => rc.readCustomerInfo();

  @override
  Future<String?> priceString(String productId) => rc.readPriceString(productId);
}

final billingStoreReaderProvider = Provider<BillingStoreReader>((ref) => SdkBillingStoreReader(ref.watch(revenueCatServiceProvider)));

/// `useSubscription().refetch` (subscription row, usage, entitlement, household).
final billingRefetchSubscriptionProvider = Provider<Future<void> Function(WidgetRef ref)>((ref) => refetchSubscription);

/// `getPlatform()`: 'ios' | 'android' | 'web' (web = no store SDK).
final billingPlatformProvider = Provider<String>((ref) => currentStorePlatform());
