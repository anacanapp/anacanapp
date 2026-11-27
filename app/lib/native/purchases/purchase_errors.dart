// Ported from: src/lib/purchase-errors.ts
//
// Stable purchase outcome codes. Raw SDK messages (English) and internal codes never reach the UI;
// every surface maps a code with [purchaseErrorMessage].

import '../../core/i18n/tr.dart';
import '../../domain/billing/onboarding_billing.dart' show PurchaseError;

/// `PurchaseErrorCode` string union.
abstract final class PurchaseErrorCode {
  static const userCancelled = 'USER_CANCELLED';
  static const purchasePending = 'PURCHASE_PENDING';
  static const storeNetwork = 'STORE_NETWORK';
  static const storeProblem = 'STORE_PROBLEM';
  static const alreadyOwned = 'ALREADY_OWNED';
  static const receiptInUse = 'RECEIPT_IN_USE';
  static const purchaseNotAllowed = 'PURCHASE_NOT_ALLOWED';
  static const purchaseOptionUnavailable = 'PURCHASE_OPTION_UNAVAILABLE';
  static const purchasePriceChanged = 'PURCHASE_PRICE_CHANGED';
  static const revenueCatAccountMismatch = 'REVENUECAT_ACCOUNT_MISMATCH';
  static const premiumSourceNonStore = 'PREMIUM_SOURCE_NON_STORE';
  static const premiumSourceHousehold = 'PREMIUM_SOURCE_HOUSEHOLD';
  static const premiumManagedElsewhere = 'PREMIUM_MANAGED_ELSEWHERE';
  static const billingUnavailable = 'BILLING_UNAVAILABLE';
  static const unknown = 'UNKNOWN';
}

const Set<String> _internal = {
  'USER_CANCELLED', 'PURCHASE_PENDING', 'STORE_NETWORK', 'STORE_PROBLEM', 'ALREADY_OWNED', 'RECEIPT_IN_USE',
  'PURCHASE_NOT_ALLOWED', 'PURCHASE_OPTION_UNAVAILABLE', 'PURCHASE_PRICE_CHANGED', 'REVENUECAT_ACCOUNT_MISMATCH', 'PREMIUM_SOURCE_NON_STORE',
  'PREMIUM_SOURCE_HOUSEHOLD', 'PREMIUM_MANAGED_ELSEWHERE', 'BILLING_UNAVAILABLE', 'UNKNOWN', //
};

/// RevenueCat PURCHASES_ERROR_CODE values are strings ("1", "20", ...).
const Map<String, String> _rcCodes = {
  '1': 'USER_CANCELLED',
  '2': 'STORE_PROBLEM',
  '3': 'PURCHASE_NOT_ALLOWED',
  '4': 'STORE_PROBLEM',
  '5': 'PURCHASE_OPTION_UNAVAILABLE',
  '6': 'ALREADY_OWNED',
  '7': 'RECEIPT_IN_USE',
  '10': 'STORE_NETWORK',
  '13': 'RECEIPT_IN_USE',
  '15': 'STORE_PROBLEM',
  '18': 'PURCHASE_OPTION_UNAVAILABLE',
  '20': 'PURCHASE_PENDING',
  '32': 'STORE_NETWORK',
  '35': 'STORE_NETWORK',
};

/// An error thrown by the store SDK, in the shape the Capacitor plugin rejected with
/// (`{ code, message, readableErrorCode, userCancelled }`). The Flutter adapter converts
/// `PlatformException`s from purchases_flutter into this.
class PurchasesSdkException implements Exception {
  const PurchasesSdkException({this.code, this.message, this.readableErrorCode, this.userCancelled});
  final Object? code;
  final String? message;
  final String? readableErrorCode;
  final bool? userCancelled;

  @override
  String toString() => 'PurchasesSdkException(code: $code, readable: $readableErrorCode)';
}

/// `new Error(label)` of `withNativeTimeout` / `withTimeout`.
class LabeledTimeoutException implements Exception {
  const LabeledTimeoutException(this.message);
  final String message;
  @override
  String toString() => message;
}

final RegExp _networkText = RegExp(r'network|offline|internet|timed? ?out', caseSensitive: false);

/// Classify anything thrown by the SDK / validation into a stable code.
String classifyPurchaseError(Object? error) {
  if (error is String) return _internal.contains(error) ? error : 'UNKNOWN';
  if (error == null) return 'UNKNOWN';
  Object? code;
  Object? userCancelled;
  Object? message;
  Object? readable;
  if (error is PurchasesSdkException) {
    code = error.code;
    userCancelled = error.userCancelled;
    message = error.message;
    readable = error.readableErrorCode;
  } else if (error is Map) {
    code = error['code'];
    userCancelled = error['userCancelled'];
    message = error['message'];
    readable = error['readableErrorCode'];
  } else if (error is PurchaseError) {
    message = error.message;
  } else if (error is LabeledTimeoutException) {
    message = error.message;
  } else {
    // `new Error(text)`: the message is the text of the error.
    message = _messageOf(error);
  }
  if (userCancelled == true) return 'USER_CANCELLED';
  final text = message is String ? message : '';
  if (_internal.contains(text)) return text;
  final codeText = code == null ? '' : (code is num && code == code.roundToDouble() ? '${code.toInt()}' : '$code');
  final mapped = _rcCodes[codeText];
  if (mapped != null) return mapped;
  final readableText = readable is String ? readable : '';
  if (readableText == 'PURCHASE_CANCELLED') return 'USER_CANCELLED';
  if (readableText == 'PAYMENT_PENDING') return 'PURCHASE_PENDING';
  if (_networkText.hasMatch(text)) return 'STORE_NETWORK';
  return 'UNKNOWN';
}

String _messageOf(Object error) {
  final raw = error.toString();
  // `Exception: text` / `StateError: Bad state: text` keep the text after the prefix.
  final m = RegExp(r'^(?:Exception|Bad state|StateError|FormatException): (.*)$', dotAll: true).firstMatch(raw);
  return m?.group(1) ?? raw;
}

bool isPendingPurchase(Object? error) => classifyPurchaseError(error) == 'PURCHASE_PENDING';

/// Localized, user-facing text for a purchase code. Never returns the raw code.
String purchaseErrorMessage(String? code) {
  switch (code) {
    case 'PURCHASE_PENDING':
      return tr('purchase_pending_payment', 'Ödəniş mağazada təsdiq gözləyir. Təsdiqdən sonra Premium avtomatik açılacaq. Yenidən ödəniş etməyin.');
    case 'STORE_NETWORK':
      return tr('purchase_err_network', 'İnternet bağlantısı zəifdir və ya yoxdur. Bağlantını yoxlayıb yenidən cəhd edin.');
    case 'ALREADY_OWNED':
      return tr('purchase_err_already_owned', 'Bu abunəlik artıq mağaza hesabınızdadır. Alışları bərpa edin.');
    case 'RECEIPT_IN_USE':
      return tr('purchase_err_receipt_other_account', 'Bu mağaza alışı başqa Anacan hesabına bağlıdır. Həmin hesabla daxil olun və ya dəstəyə yazın.');
    case 'REVENUECAT_ACCOUNT_MISMATCH':
      return tr('purchase_err_account_mismatch', 'Mağaza hesabı bu Anacan hesabı ilə uyğun gəlmir. Tətbiqdən çıxıb yenidən daxil olun və yenidən cəhd edin.');
    case 'PURCHASE_OPTION_UNAVAILABLE':
    case 'PURCHASE_PRICE_CHANGED':
      return tr('purchase_err_offer_changed', 'Mağazadakı təklif və ya qiymət dəyişib. Qiymətləri yeniləyib yenidən cəhd edin.');
    case 'PREMIUM_SOURCE_NON_STORE':
      return tr('purchase_block_non_store', 'Premium-unuz artıq aktivdir (sayt abunəliyi və ya hədiyyə). Təkrar ödəniş olmasın deyə mağazadan alış bağlıdır.');
    case 'PREMIUM_SOURCE_HOUSEHOLD':
      return tr('purchase_block_household', 'Premium artıq ailə üzvünüzün abunəliyi ilə aktivdir. Ayrıca alış lazım deyil.');
    case 'PREMIUM_MANAGED_ELSEWHERE':
      return tr('purchase_block_other_store', 'Abunəliyiniz başqa mağazada (App Store və ya Google Play) aktivdir. Dəyişikliyi həmin mağazada edin.');
    case 'PURCHASE_NOT_ALLOWED':
    case 'STORE_PROBLEM':
    case 'BILLING_UNAVAILABLE':
      return tr('purchase_err_store', 'Mağaza hazırda alışı tamamlaya bilmədi. Bir az sonra yenidən cəhd edin.');
    default:
      return tr('useinapppurchase_alis_tamamlana_bilmedi_yeniden_8c3980', 'Alış tamamlana bilmədi. Yenidən cəhd edin.');
  }
}

/// 'none' | 'store_same' | 'store_other' | 'non_store' | 'household'
typedef PremiumSourceKind = String;

class StoreEntitlementInfo {
  const StoreEntitlementInfo({this.store, this.productIdentifier, this.productPlanIdentifier, this.willRenew, this.expirationDate});

  /// RevenueCat entitlement `store`, e.g. APP_STORE, PLAY_STORE, PROMOTIONAL.
  final String? store;
  final String? productIdentifier;
  final String? productPlanIdentifier;
  final bool? willRenew;
  final String? expirationDate;
}

/// Sentinel for "could not be read" (`undefined` in the TypeScript).
const StoreEntitlementInfo unreadEntitlement = StoreEntitlementInfo(store: '\u0000unread');

PremiumSourceKind premiumSourceKind({
  required String platform,
  required bool ownPremium,
  required bool householdPremium,

  /// Active RevenueCat entitlement, null when none; [unreadEntitlement] when it could not be read.
  StoreEntitlementInfo? storeEntitlement,
}) {
  final unread = identical(storeEntitlement, unreadEntitlement);
  final store = unread ? null : storeEntitlement?.store;
  if (store == 'APP_STORE' || store == 'MAC_APP_STORE') return platform == 'ios' ? 'store_same' : 'store_other';
  if (store == 'PLAY_STORE') return platform == 'android' ? 'store_same' : 'store_other';
  if (!unread && storeEntitlement != null && store != null && store.isNotEmpty) return 'non_store';
  // Own Premium without a store entitlement: anacan.az (Epoint) or a promotional grant.
  if (ownPremium) return 'non_store';
  if (householdPremium) return 'household';
  return 'none';
}

String? storePurchaseBlock(PremiumSourceKind kind) {
  if (kind == 'non_store') return 'PREMIUM_SOURCE_NON_STORE';
  if (kind == 'household') return 'PREMIUM_SOURCE_HOUSEHOLD';
  if (kind == 'store_other') return 'PREMIUM_MANAGED_ELSEWHERE';
  return null;
}

/// Google Play product id without the base plan suffix ("product:base-plan" → "product").
String? googleSubscriptionId(String? identifier) {
  if (identifier == null || identifier.isEmpty) return null;
  final head = identifier.split(':')[0];
  return head.isEmpty ? null : head;
}
