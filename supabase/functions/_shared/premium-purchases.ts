// Server-side purchase log for the Premium funnel (premium_purchases, migration 20261125150000).
// One row per paid period start: store purchase or renewal (revenuecat-sync), Epoint web-subscription charge
// (web-premium-subscription → applyChargeResult) and promotional grants. The database attributes the row to the
// user's latest buy tap (premium_purchase_intents, 48 h) and keeps it idempotent on provider_ref.
// Recording never fails or delays the caller's own result: errors are logged without user data and swallowed.

export type PurchaseProvider = 'app_store' | 'play_store' | 'epoint' | 'promo' | 'other';
export type PurchasePlan = 'monthly' | 'yearly' | 'lifetime' | 'other';

export interface PurchaseFact {
  provider: PurchaseProvider;
  productId: string | null;
  plan: PurchasePlan;
  amount: number | null;
  currency: string | null;
  providerRef: string;
  kind: 'initial' | 'renewal';
  platform?: 'ios' | 'android' | 'web' | null;
  purchasedAt?: string | null;
}

/** RevenueCat `store` → provider (promotional grants count as promo, never as a sale). */
export function storeProvider(store: unknown, productId: string | null): PurchaseProvider {
  if (productId?.startsWith('rc_promo')) return 'promo';
  if (store === 'app_store' || store === 'mac_app_store') return 'app_store';
  if (store === 'play_store') return 'play_store';
  if (store === 'promotional') return 'promo';
  return 'other';
}

/** Plan from the product id (com.atlasoon.anacan.premium.yearly, rc_promo_…_monthly, …) and product kind. */
export function planFromProduct(productId: string | null, kind?: 'subscription' | 'lifetime' | null): PurchasePlan {
  if (kind === 'lifetime') return 'lifetime';
  const id = (productId ?? '').toLowerCase();
  if (/(yearly|annual|year|_12m|p1y)/.test(id)) return 'yearly';
  if (/(monthly|month|_1m|p1m)/.test(id)) return 'monthly';
  if (/lifetime/.test(id)) return 'lifetime';
  return 'other';
}

interface RcSubscriptionFacts {
  store?: unknown; purchase_date?: unknown; original_purchase_date?: unknown; store_transaction_id?: unknown;
  period_type?: unknown; is_sandbox?: unknown; price?: unknown;
}

/**
 * The purchase a RevenueCat subscriber snapshot shows for the active entitlement, or null when there is nothing to
 * log: sandbox, trial, no purchase date, or a purchase older than `maxAgeMs` (a sync of an old subscriber must not log
 * a historical sale as new). A renewal is a purchase whose date differs from the original purchase date.
 */
export function storePurchaseFact(productId: string | null, sub: RcSubscriptionFacts | undefined | null,
  kind: 'subscription' | 'lifetime' | null, now = Date.now(), maxAgeMs = 7 * 86400_000): PurchaseFact | null {
  if (!productId || !sub || sub.is_sandbox === true || sub.period_type === 'trial') return null;
  const purchased = typeof sub.purchase_date === 'string' ? Date.parse(sub.purchase_date) : NaN;
  if (!Number.isFinite(purchased) || purchased > now + 300_000 || now - purchased > maxAgeMs) return null;
  const original = typeof sub.original_purchase_date === 'string' ? Date.parse(sub.original_purchase_date) : NaN;
  const renewal = Number.isFinite(original) && Math.abs(purchased - original) > 60_000;
  const provider = storeProvider(sub.store, productId);
  const transaction = typeof sub.store_transaction_id === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(sub.store_transaction_id)
    ? sub.store_transaction_id : null;
  const price = sub.price && typeof sub.price === 'object' ? sub.price as { amount?: unknown; currency?: unknown } : null;
  const amount = typeof price?.amount === 'number' && Number.isFinite(price.amount) && price.amount >= 0 ? price.amount : null;
  const currency = typeof price?.currency === 'string' && /^[A-Z]{3}$/.test(price.currency) ? price.currency : null;
  return {
    provider, productId: productId.slice(0, 160), plan: planFromProduct(productId, kind), amount, currency,
    providerRef: transaction ? `rc:${transaction}` : `rc:${productId.slice(0, 120)}:${new Date(purchased).toISOString()}`,
    kind: renewal ? 'renewal' : 'initial', platform: null, purchasedAt: new Date(purchased).toISOString(),
  };
}

export interface RpcClient { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }> }

export async function recordPremiumPurchase(admin: RpcClient, userId: string, fact: PurchaseFact): Promise<void> {
  try {
    const { error } = await admin.rpc('premium_purchase_record_v1', {
      p_user: userId, p_provider: fact.provider, p_product: fact.productId, p_plan: fact.plan, p_amount: fact.amount,
      p_currency: fact.currency, p_provider_ref: fact.providerRef, p_kind: fact.kind, p_platform: fact.platform ?? null,
      p_purchased_at: fact.purchasedAt ?? null,
    });
    if (error) console.error('[premium-purchases] record failed:', String(error.code ?? 'db'));
  } catch {
    console.error('[premium-purchases] record failed: exception');
  }
}
