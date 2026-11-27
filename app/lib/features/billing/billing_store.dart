// Ported from: src/components/BillingScreen.tsx (`Purchases.getCustomerInfo()`, `Purchases.getProducts()`,
//              `getPlatform()`)
//
// The store reads the billing screen makes directly on the SDK (not through the paywall controller).
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
  SdkBillingStoreReader(this.sdk);
  final PurchasesSdk sdk;

  @override
  Future<Map<String, Object?>?> customerInfo() => sdk.getCustomerInfo();

  @override
  Future<String?> priceString(String productId) async {
    final products = await sdk.getProducts(<String>[productId]);
    if (products.isEmpty) return null;
    final price = products.first['priceString'];
    return price is String ? price : null;
  }
}

final billingStoreReaderProvider = Provider<BillingStoreReader>((ref) => SdkBillingStoreReader(ref.watch(purchasesSdkProvider)));

/// `useSubscription().refetch` (subscription row, usage, entitlement, household).
final billingRefetchSubscriptionProvider = Provider<Future<void> Function(WidgetRef ref)>((ref) => refetchSubscription);

/// `getPlatform()`: 'ios' | 'android' | 'web' (web = no store SDK).
final billingPlatformProvider = Provider<String>((ref) => currentStorePlatform());
