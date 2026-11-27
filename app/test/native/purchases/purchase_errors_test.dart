// Ported from: src/lib/purchase-errors.test.ts
import 'package:anacan/domain/billing/onboarding_billing.dart' show PurchaseError;
import 'package:anacan/native/purchases/purchase_errors.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

void main() {
  setUp(installTestI18n);

  group('RevenueCat error classification', () {
    test('reads string error codes (RC PURCHASES_ERROR_CODE)', () {
      expect(classifyPurchaseError({'code': '1', 'message': 'Purchase was cancelled.'}), 'USER_CANCELLED');
      expect(classifyPurchaseError({'code': '20', 'message': 'The payment is pending.'}), 'PURCHASE_PENDING');
      expect(classifyPurchaseError({'code': '10'}), 'STORE_NETWORK');
      expect(classifyPurchaseError({'code': '35'}), 'STORE_NETWORK');
      expect(classifyPurchaseError({'code': '6'}), 'ALREADY_OWNED');
      expect(classifyPurchaseError({'code': '7'}), 'RECEIPT_IN_USE');
      expect(classifyPurchaseError({'code': '2'}), 'STORE_PROBLEM');
    });
    test('still accepts numeric codes and the userCancelled flag', () {
      expect(classifyPurchaseError({'code': 1}), 'USER_CANCELLED');
      expect(classifyPurchaseError({'code': 20}), 'PURCHASE_PENDING');
      expect(classifyPurchaseError(const PurchasesSdkException(userCancelled: true, code: '0')), 'USER_CANCELLED');
    });
    test('detects pending payments, not as failures', () {
      expect(isPendingPurchase({'code': '20'}), isTrue);
      expect(isPendingPurchase({'readableErrorCode': 'PAYMENT_PENDING'}), isTrue);
      expect(isPendingPurchase({'code': '0'}), isFalse);
    });
    test('maps internal validation errors thrown as Error(message)', () {
      expect(classifyPurchaseError(const PurchaseError('PURCHASE_PRICE_CHANGED')), 'PURCHASE_PRICE_CHANGED');
      expect(classifyPurchaseError(const PurchaseError('PURCHASE_OPTION_UNAVAILABLE')), 'PURCHASE_OPTION_UNAVAILABLE');
      expect(classifyPurchaseError('REVENUECAT_ACCOUNT_MISMATCH'), 'REVENUECAT_ACCOUNT_MISMATCH');
      expect(classifyPurchaseError(Exception('Some English SDK message')), 'UNKNOWN');
      expect(classifyPurchaseError(Exception('The Internet connection appears to be offline.')), 'STORE_NETWORK');
    });
  });

  group('localized purchase messages', () {
    for (final code in [
      'REVENUECAT_ACCOUNT_MISMATCH', 'PURCHASE_OPTION_UNAVAILABLE', 'PURCHASE_PRICE_CHANGED', 'PURCHASE_PENDING', 'STORE_NETWORK', //
      'PREMIUM_SOURCE_NON_STORE', 'PREMIUM_SOURCE_HOUSEHOLD', 'PREMIUM_MANAGED_ELSEWHERE', 'UNKNOWN', 'Purchase failed', null,
    ]) {
      test('never shows the raw code $code', () {
        final text = purchaseErrorMessage(code);
        expect(text, isNotEmpty);
        if (code != null) expect(text, isNot(contains(code)));
        expect(RegExp(r'[A-Z]{3,}_[A-Z_]+').hasMatch(text), isFalse);
        expect(text, isNot(contains('—')));
      });
    }
  });

  group('store purchase guard', () {
    test('allows a first purchase and a same-store plan change', () {
      expect(premiumSourceKind(platform: 'android', ownPremium: false, householdPremium: false), 'none');
      expect(
          premiumSourceKind(
              platform: 'android', ownPremium: true, householdPremium: false, storeEntitlement: const StoreEntitlementInfo(store: 'PLAY_STORE', productIdentifier: 'monthly')),
          'store_same');
      expect(
          premiumSourceKind(
              platform: 'ios', ownPremium: true, householdPremium: false, storeEntitlement: const StoreEntitlementInfo(store: 'APP_STORE', productIdentifier: 'monthly')),
          'store_same');
      expect(storePurchaseBlock('none'), isNull);
      expect(storePurchaseBlock('store_same'), isNull);
    });
    test('blocks web/promo, household and the other platform store', () {
      expect(storePurchaseBlock(premiumSourceKind(platform: 'ios', ownPremium: true, householdPremium: false)), 'PREMIUM_SOURCE_NON_STORE');
      expect(
          storePurchaseBlock(premiumSourceKind(
              platform: 'ios', ownPremium: true, householdPremium: false, storeEntitlement: const StoreEntitlementInfo(store: 'PROMOTIONAL', productIdentifier: 'rc_promo_x'))),
          'PREMIUM_SOURCE_NON_STORE');
      expect(storePurchaseBlock(premiumSourceKind(platform: 'android', ownPremium: false, householdPremium: true)), 'PREMIUM_SOURCE_HOUSEHOLD');
      expect(
          storePurchaseBlock(premiumSourceKind(
              platform: 'android', ownPremium: true, householdPremium: false, storeEntitlement: const StoreEntitlementInfo(store: 'APP_STORE', productIdentifier: 'y'))),
          'PREMIUM_MANAGED_ELSEWHERE');
    });
    test('strips the Google base plan from product identifiers', () {
      expect(googleSubscriptionId('com.atlasoon.anacan.premium.monthly:monthly-plan'), 'com.atlasoon.anacan.premium.monthly');
      expect(googleSubscriptionId(null), isNull);
    });
  });
}
