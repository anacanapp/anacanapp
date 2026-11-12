// anacan.az web subscriptions (monthly / yearly Premium, saved Epoint card, automatic renewal).
// Shared by web-premium (cabinet + subscribe), web-premium-renew (timer) and epoint-payment (signed Result URL).
// Payments are trusted only from a signed Epoint callback or Epoint get-status; redirect URLs never count.
// The Epoint card_id stays on the server: it is stored in epoint_saved_cards and sent only to Epoint.
import { EPOINT_CARD_ID, epointAmount, epointRequest, type EpointConfig } from './epoint.ts';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SITE = 'https://anacan.az';
export const CAMPAIGN_PAGE = `${SITE}/website/premium/kampaniya/index.html`;
export const CABINET_PAGE = `${SITE}/website/premium/hesab/index.html`;
/** Subscription at the normal price (outside campaigns). */
export const STANDARD_PAGE = `${SITE}/website/premium/abune/index.html`;
export const MAX_RENEWAL_ATTEMPTS = 3;

export type Plan = 'monthly' | 'yearly';
export const isPlan = (value: unknown): value is Plan => value === 'monthly' || value === 'yearly';

// ── Pure helpers (unit-tested in src/lib/web-premium-subscription.test.ts) ───────────────

/** Order / card references of an Epoint callback. Either may be missing (card-registration has no order_id). */
export function callbackKeys(payload: Record<string, unknown>): { orderId: string | null; cardId: string | null } {
  const orderId = typeof payload.order_id === 'string' && ORDER_ID.test(payload.order_id) ? payload.order_id.toLowerCase() : null;
  const cardId = typeof payload.card_id === 'string' && EPOINT_CARD_ID.test(payload.card_id) ? payload.card_id : null;
  return { orderId, cardId };
}

const cleanText = (value: unknown, max: number) => typeof value === 'string'
  ? value.replace(/[^\p{L}\p{N} *.\/_-]/gu, '').trim().slice(0, max) || null : null;

/** Display-only card fields from an Epoint answer (mask like 416973******1234, brand/holder name, expiry). */
export function cardFields(payload: Record<string, unknown>): { mask: string | null; name: string | null; expiry: string | null } {
  const rawExpiry = payload.card_expiry ?? payload.expiry ?? payload.card_exp;
  return {
    mask: cleanText(payload.card_mask ?? payload.pan, 32),
    name: cleanText(payload.card_name ?? payload.card_type ?? payload.card_brand, 64),
    expiry: typeof rawExpiry === 'string' && /^\d{2}\s*\/\s*\d{2,4}$/.test(rawExpiry.trim()) ? rawExpiry.replace(/\s/g, '') : null,
  };
}

/** Epoint get-status answer → what it means for a charge. */
export function chargeOutcome(status: unknown): 'paid' | 'failed' | 'pending' {
  if (status === 'success') return 'paid';
  if (status === 'failed' || status === 'error' || status === 'returned' || status === 'declined') return 'failed';
  return 'pending';
}

/** Amount equality in qəpik. */
export const sameAmount = (a: unknown, b: unknown) => {
  const x = Number(a), y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.round(x * 100) === Math.round(y * 100);
};

/** Discount in whole percent (24,99 vs 50,98 → 51). */
export function discountPct(price: number, was: number | null | undefined): number | null {
  if (!was || !(was > price) || !(price > 0)) return null;
  return Math.round((1 - price / was) * 100);
}

/** Yearly price per month, rounded down to the qəpik (24,99 → 2,08). */
export const perMonth = (yearly: number) => Math.floor((yearly / 12) * 100 + 1e-9) / 100;

/** Same period arithmetic as web_premium_charge_paid_v1 (calendar months; end of month clamps like PostgreSQL). */
export function periodEnd(start: Date, plan: Plan): Date {
  const months = plan === 'yearly' ? 12 : 1;
  const end = new Date(start.getTime());
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

/** Retry schedule of a failed renewal (24 h apart, then the subscription expires). */
export function renewalRetry(failedAttempts: number, now = Date.now()): { expire: boolean; nextChargeAt: Date | null } {
  return failedAttempts >= MAX_RENEWAL_ATTEMPTS ? { expire: true, nextChargeAt: null } : { expire: false, nextChargeAt: new Date(now + 24 * 3600_000) };
}

export interface CampaignPlan { price: number; was: number | null }
export interface Campaign { active: boolean; name?: string | null; starts_at?: string | null; ends_at?: string | null; plans?: Record<Plan, CampaignPlan> }

/** Campaign as the page shows it: prices, struck prices, discount and the yearly per-month price. */
export function campaignView(campaign: Campaign) {
  const plan = (p: Plan) => {
    const value = campaign.plans?.[p];
    if (!value) return null;
    return { price: Number(value.price), was: value.was == null ? null : Number(value.was), pct: discountPct(Number(value.price), value.was == null ? null : Number(value.was)),
      ...(p === 'yearly' ? { per_month: perMonth(Number(value.price)) } : {}) };
  };
  return { active: campaign.active === true, name: campaign.name ?? null, starts_at: campaign.starts_at ?? null, ends_at: campaign.ends_at ?? null,
    currency: 'AZN', plans: campaign.plans ? { monthly: plan('monthly'), yearly: plan('yearly') } : null };
}

/** The offer the page sells now (web_premium_offer_v1): campaign or standard price, in the campaign shape plus kind. */
export function offerView(offer: (Campaign & { kind?: string }) | null | undefined) {
  const value = offer ?? { active: false };
  return { ...campaignView(value), kind: value.active ? (value.kind === 'standard' ? 'standard' : 'campaign') : null };
}

/** Maps a database exception (RAISE 'WEB_PREMIUM_…') to a stable error code for the page. */
export function rpcErrorCode(error: { message?: string } | null | undefined): string | null {
  const match = /WEB_PREMIUM_[A-Z_]+/.exec(error?.message ?? '');
  return match ? match[0].slice('WEB_PREMIUM_'.length).toLowerCase() : null;
}

// ── Database + provider ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Which subscription row a signed callback belongs to: a charge (order_id = web_premium_charges.id), or a card
 * registration (card_id of a saved card). A card-registration-with-pay callback without order_id is mapped to its
 * pending initial charge. null → not a web subscription callback (the other dispatcher branches handle it).
 */
export async function findSubscriptionCallback(admin: Admin, payload: Record<string, unknown>):
  Promise<{ kind: 'charge'; chargeId: string } | { kind: 'card'; cardId: string } | null> {
  const { orderId, cardId } = callbackKeys(payload);
  if (orderId) {
    const { data } = await admin.from('web_premium_charges').select('id').eq('id', orderId).maybeSingle();
    if (data) return { kind: 'charge', chargeId: data.id };
  }
  if (cardId && !orderId) {
    const { data: card } = await admin.from('epoint_saved_cards').select('id,purpose').eq('card_id', cardId).maybeSingle();
    if (!card) return null;
    if (card.purpose === 'subscribe') {
      const { data: chargeId } = await admin.rpc('web_premium_charge_for_card_v1', { p_card_id: cardId });
      if (typeof chargeId === 'string') return { kind: 'charge', chargeId };
    }
    return { kind: 'card', cardId };
  }
  return null;
}

export type ChargeResult = 'paid' | 'duplicate' | 'failed' | 'pending' | 'not_found' | 'not_confirmed';
export interface ChargeApplied { result: ChargeResult; userId?: string; detail?: Record<string, unknown> }

/** get-status by order_id; the paid amount must equal the server price stored on the charge. */
export async function confirmCharge(config: EpointConfig, chargeId: string, expected: unknown): Promise<{ outcome: 'paid' | 'failed' | 'pending'; transaction: string | null; status: Record<string, unknown> }> {
  const { result } = await epointRequest(config, 'get-status', { order_id: chargeId });
  const outcome = chargeOutcome(result.status);
  if (outcome === 'paid' && result.amount !== undefined && !sameAmount(result.amount, expected)) {
    console.error('[web-premium] get-status amount differs from the charge');
    return { outcome: 'pending', transaction: null, status: result };
  }
  const transaction = typeof result.transaction === 'string' ? result.transaction.slice(0, 128) : null;
  return { outcome, transaction, status: result };
}

/** Applies a charge result: payload is the signed callback or an execute-pay answer (status only hints; get-status decides). */
export async function applyChargeResult(admin: Admin, config: EpointConfig, chargeId: string, payload: Record<string, unknown>): Promise<ChargeApplied> {
  const { data: charge } = await admin.from('web_premium_charges').select('id,amount,status,user_id,kind').eq('id', chargeId).maybeSingle();
  if (!charge) return { result: 'not_found' };
  if (charge.status === 'paid') return { result: 'duplicate', userId: charge.user_id };
  const confirmed = await confirmCharge(config, chargeId, charge.amount);
  const card = cardFields({ ...confirmed.status, ...payload });
  if (confirmed.outcome === 'paid') {
    const { data, error } = await admin.rpc('web_premium_charge_paid_v1', {
      p_charge: chargeId, p_amount: Number(charge.amount),
      p_transaction: confirmed.transaction ?? (typeof payload.transaction === 'string' ? payload.transaction.slice(0, 128) : null),
      p_mask: card.mask, p_card_name: card.name,
    });
    if (error) {
      console.error('[web-premium] charge_paid failed:', rpcErrorCode(error) ?? 'database');
      return { result: 'not_confirmed', userId: charge.user_id };
    }
    return { result: data?.changed === false ? 'duplicate' : 'paid', userId: charge.user_id, detail: data };
  }
  // A failure is final when Epoint says so: get-status failed, or a signed callback with a non-success status.
  const signedFailure = typeof payload.status === 'string' && payload.status !== 'success';
  if (confirmed.outcome === 'failed' || signedFailure) {
    const reason = typeof payload.message === 'string' ? payload.message : typeof confirmed.status.message === 'string' ? confirmed.status.message : 'declined';
    const { data } = await admin.rpc('web_premium_charge_failed_v1', { p_charge: chargeId, p_error: safeReason(reason) });
    return { result: 'failed', userId: charge.user_id, detail: data };
  }
  // "success" that get-status does not confirm yet: not acknowledged, so Epoint repeats the callback.
  return { result: payload.status === 'success' ? 'not_confirmed' : 'pending', userId: charge.user_id };
}

/** Provider message for the charge row (no card data: digits are dropped). */
const safeReason = (reason: string) => reason.replace(/[^\p{L} .,:_-]/gu, '').trim().slice(0, 120) || 'declined';

/** Card registration (add_card) result from the signed callback. */
export async function applyCardResult(admin: Admin, cardId: string, payload: Record<string, unknown>): Promise<{ changed: boolean; userId?: string; status?: string } | null> {
  const fields = cardFields(payload);
  const { data, error } = await admin.rpc('web_premium_card_result_v1', {
    p_card_id: cardId, p_success: payload.status === 'success', p_mask: fields.mask, p_card_name: fields.name, p_expiry: fields.expiry,
  });
  if (error) throw new Error('card_result_failed');
  return data ? { changed: data.changed === true, userId: data.user_id, status: data.status } : null;
}

/** Charges a saved card for a renewal charge (execute-pay), then confirms with get-status. */
export async function executeRenewal(admin: Admin, config: EpointConfig, claim: { charge_id: string; amount: number; plan: Plan; card_id: string }): Promise<ChargeApplied> {
  let answer: Record<string, unknown> = {};
  try {
    const { result } = await epointRequest(config, 'execute-pay', {
      language: 'az', card_id: claim.card_id, order_id: claim.charge_id, amount: epointAmount(Number(claim.amount)), currency: 'AZN',
      description: `Anacan Premium — ${claim.plan === 'yearly' ? 'illik' : 'aylıq'} abunəlik`,
    });
    answer = result;
  } catch {
    // Network error or timeout: the charge stays pending and is checked with get-status on the next run.
    return { result: 'pending' };
  }
  if (answer.status !== 'success') {
    // "User card not found" and declines answer without charging; get-status settles anything ambiguous.
    const confirmed = await confirmCharge(config, claim.charge_id, claim.amount).catch(() => null);
    if (confirmed?.outcome === 'paid') return await applyChargeResult(admin, config, claim.charge_id, { status: 'success' });
    if (confirmed?.outcome === 'pending' && answer.status === undefined) return { result: 'pending' };
    const reason = typeof answer.message === 'string' ? answer.message : 'declined';
    const { data } = await admin.rpc('web_premium_charge_failed_v1', { p_charge: claim.charge_id, p_error: safeReason(reason) });
    return { result: 'failed', detail: data };
  }
  return await applyChargeResult(admin, config, claim.charge_id, answer);
}
