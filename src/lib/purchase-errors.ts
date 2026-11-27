import { tr } from '@/lib/tr';

/**
 * Stable purchase outcome codes. Raw SDK messages (English) and internal codes never
 * reach the UI; every surface maps a code with `purchaseErrorMessage`.
 */
export type PurchaseErrorCode =
  | 'USER_CANCELLED'
  | 'PURCHASE_PENDING'
  | 'STORE_NETWORK'
  | 'STORE_PROBLEM'
  | 'ALREADY_OWNED'
  | 'RECEIPT_IN_USE'
  | 'PURCHASE_NOT_ALLOWED'
  | 'PURCHASE_OPTION_UNAVAILABLE'
  | 'PURCHASE_PRICE_CHANGED'
  | 'REVENUECAT_ACCOUNT_MISMATCH'
  | 'PREMIUM_SOURCE_NON_STORE'
  | 'PREMIUM_SOURCE_HOUSEHOLD'
  | 'PREMIUM_MANAGED_ELSEWHERE'
  | 'BILLING_UNAVAILABLE'
  | 'UNKNOWN';

const INTERNAL = new Set<string>(['USER_CANCELLED', 'PURCHASE_PENDING', 'STORE_NETWORK', 'STORE_PROBLEM', 'ALREADY_OWNED', 'RECEIPT_IN_USE',
  'PURCHASE_NOT_ALLOWED', 'PURCHASE_OPTION_UNAVAILABLE', 'PURCHASE_PRICE_CHANGED', 'REVENUECAT_ACCOUNT_MISMATCH', 'PREMIUM_SOURCE_NON_STORE',
  'PREMIUM_SOURCE_HOUSEHOLD', 'PREMIUM_MANAGED_ELSEWHERE', 'BILLING_UNAVAILABLE', 'UNKNOWN']);

/**
 * RevenueCat PURCHASES_ERROR_CODE values are strings ("1", "20", ...). Older code
 * compared with numbers, so cancellations and pending payments were misread.
 */
const RC_CODES: Record<string, PurchaseErrorCode> = {
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

/** Classify anything thrown by the SDK / validation into a stable code. */
export function classifyPurchaseError(error: unknown): PurchaseErrorCode {
  const value = error as { code?: unknown; userCancelled?: unknown; message?: unknown; readableErrorCode?: unknown } | null | undefined;
  if (typeof error === 'string') return INTERNAL.has(error) ? error as PurchaseErrorCode : 'UNKNOWN';
  if (!value) return 'UNKNOWN';
  if (value.userCancelled === true) return 'USER_CANCELLED';
  const message = typeof value.message === 'string' ? value.message : '';
  if (INTERNAL.has(message)) return message as PurchaseErrorCode;
  const code = value.code === undefined || value.code === null ? '' : String(value.code);
  if (RC_CODES[code]) return RC_CODES[code];
  const readable = typeof value.readableErrorCode === 'string' ? value.readableErrorCode : '';
  if (readable === 'PURCHASE_CANCELLED') return 'USER_CANCELLED';
  if (readable === 'PAYMENT_PENDING') return 'PURCHASE_PENDING';
  if (/network|offline|internet|timed? ?out/i.test(message)) return 'STORE_NETWORK';
  return 'UNKNOWN';
}

export const isPendingPurchase = (error: unknown): boolean => classifyPurchaseError(error) === 'PURCHASE_PENDING';

/** Localized, user-facing text for a purchase code. Never returns the raw code. */
export function purchaseErrorMessage(code: string | null | undefined): string {
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

/** Store purchase guard: which active Premium source would a new store purchase duplicate? */
export type PremiumSourceKind = 'none' | 'store_same' | 'store_other' | 'non_store' | 'household';

export interface StoreEntitlementInfo {
  /** RevenueCat entitlement `store`, e.g. APP_STORE, PLAY_STORE, PROMOTIONAL. */
  store: string | null;
  productIdentifier: string | null;
  productPlanIdentifier?: string | null;
  willRenew?: boolean;
  expirationDate?: string | null;
}

export function premiumSourceKind(input: {
  platform: 'ios' | 'android' | 'web';
  ownPremium: boolean;
  householdPremium: boolean;
  /** Active RevenueCat entitlement, null when none; undefined when it could not be read. */
  storeEntitlement: StoreEntitlementInfo | null | undefined;
}): PremiumSourceKind {
  const store = input.storeEntitlement?.store ?? null;
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return input.platform === 'ios' ? 'store_same' : 'store_other';
  if (store === 'PLAY_STORE') return input.platform === 'android' ? 'store_same' : 'store_other';
  if (input.storeEntitlement && store) return 'non_store';
  // Own Premium without a store entitlement: anacan.az (Epoint) or a promotional grant.
  if (input.ownPremium) return 'non_store';
  if (input.householdPremium) return 'household';
  return 'none';
}

export function storePurchaseBlock(kind: PremiumSourceKind): PurchaseErrorCode | null {
  if (kind === 'non_store') return 'PREMIUM_SOURCE_NON_STORE';
  if (kind === 'household') return 'PREMIUM_SOURCE_HOUSEHOLD';
  if (kind === 'store_other') return 'PREMIUM_MANAGED_ELSEWHERE';
  return null;
}

/** Google Play product id without the base plan suffix ("product:base-plan" → "product"). */
export const googleSubscriptionId = (identifier: string | null | undefined): string | null =>
  identifier ? identifier.split(':')[0] || null : null;
