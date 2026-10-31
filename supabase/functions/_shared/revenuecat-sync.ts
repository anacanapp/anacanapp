import { createClient } from 'npm:@supabase/supabase-js@2';

export const ENTITLEMENT_ID = 'Anacan LLC Pro';

type Failure = 'no_secret_key' | 'rc_api_error' | 'invalid_user' | 'invalid_store_event' | 'sandbox_entitlement'
  | 'db_write_failed' | 'unknown_product' | 'transfer_requires_reconciliation';
export interface SyncResult {
  ok: boolean;
  reason?: Failure;
  rcStatus?: number;
  rcDetail?: string;
  isPro?: boolean;
  planType?: string;
  status?: string;
  expiresAt?: string | null;
  productId?: string | null;
  willRenew?: boolean;
  periodType?: string | null;
  isTrial?: boolean;
  cancellationRecorded?: boolean;
  sandbox?: boolean;
  transferredUsers?: number;
}

interface RCSubscription {
  refunded_at?: string | null;
  purchase_date?: string | null;
  period_type?: 'normal' | 'trial' | 'intro';
  unsubscribe_detected_at?: string | null;
  is_sandbox?: boolean;
  grace_period_expires_date?: string | null;
}
interface RCSubscriberResponse {
  request_date_ms?: number;
  subscriber: {
    entitlements: Record<string, { expires_date: string | null; product_identifier: string }>;
    subscriptions?: Record<string, RCSubscription>;
    non_subscriptions?: Record<string, RCSubscription[]>;
  };
}
// Only pass the authenticated RevenueCat webhook's actual body.event, not a
// client receipt. The unchanged legacy caller passes no event and logs separately;
// it must pass event.id AND remove its separate insert to use this deduplication.
export interface RevenueCatStoreEvent {
  id?: unknown;
  app_user_id?: unknown;
  type?: unknown;
  cancel_reason?: unknown;
  expiration_reason?: unknown;
  environment?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANONYMOUS = /^\$RCAnonymousID:[A-Za-z0-9_-]{1,128}$/;
const validEventId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 128 && !/[\x00-\x1f\x7f]/.test(value);
interface EntitlementState {
  user_id: string; plan_type: string; status: string; expires_at: string | null; is_trial: boolean;
  cancelled_at: string | null; confirm_referral: boolean; cancellation_event_id: string | null;
  cancellation_reason: string | null; product_id: string | null; environment: 'SANDBOX' | 'PRODUCTION'; observed_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// ── Web purchases (Dodo Payments, Duzelis73) ─────────────────────────────────────────────
// Premium bought on anacan.az is merged into the same state, so a store sync never removes it.
interface WebEntitlement { plan: string; expires_at: string | null; cancel_at_period_end: boolean }

async function webEntitlement(userId: string): Promise<WebEntitlement | null> {
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });
    // Links purchases whose email Google/Apple verified for this account, then reads the best active one.
    await admin.rpc('web_subscription_link_user_v1', { p_user_id: userId });
    const { data, error } = await admin.rpc('web_entitlement_v1', { p_user_id: userId });
    const row = Array.isArray(data) ? data[0] : data;
    return !error && isRecord(row) && row.active === true ? row as unknown as WebEntitlement : null;
  } catch { return null; }
}

function withWeb(state: EntitlementState, web: WebEntitlement | null): EntitlementState {
  if (!web) return state;
  const webEnd = web.expires_at ? Date.parse(web.expires_at) : Number.POSITIVE_INFINITY;
  const storeEnd = state.expires_at ? Date.parse(state.expires_at) : 0;
  const storeActive = state.plan_type !== 'free';
  if (storeActive && storeEnd >= webEnd) return state;
  return { ...state, plan_type: web.plan === 'yearly' ? 'premium_plus' : 'premium',
    status: web.cancel_at_period_end ? 'cancelled' : 'active', expires_at: web.expires_at,
    is_trial: false, cancelled_at: web.cancel_at_period_end ? state.cancelled_at ?? new Date().toISOString() : null,
    confirm_referral: false, product_id: `dodo:${web.plan}`, environment: 'PRODUCTION' };
}

export async function fetchRevenueCatSubscriber(appUserId: string): Promise<{
  data: RCSubscriberResponse | null;
  debugReason?: 'no_secret_key' | 'rc_api_error';
  debugStatus?: number;
  observedAt?: string;
}> {
  const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretKey) return { data: null, debugReason: 'no_secret_key' };
  try {
    const startedAt = Date.now();
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { data: null, debugReason: 'rc_api_error', debugStatus: response.status };
    const data: unknown = await response.json();
    if (!isRecord(data) || !isRecord(data.subscriber) || !isRecord(data.subscriber.entitlements)
      || (data.subscriber.subscriptions !== undefined && !isRecord(data.subscriber.subscriptions))
      || (data.subscriber.non_subscriptions !== undefined && !isRecord(data.subscriber.non_subscriptions))
      || (data.request_date_ms !== undefined && (typeof data.request_date_ms !== 'number' || !Number.isFinite(data.request_date_ms)
        || data.request_date_ms < 946684800000 || data.request_date_ms > Date.now() + 300000))) {
      return { data: null, debugReason: 'rc_api_error' };
    }
    return { data: data as unknown as RCSubscriberResponse, observedAt: new Date(
      typeof data.request_date_ms === 'number' ? data.request_date_ms : startedAt).toISOString() };
  } catch { return { data: null, debugReason: 'rc_api_error' }; }
}

function productConfiguration(productId: string): { plan: 'premium' | 'premium_plus'; kind: 'subscription' | 'lifetime' } | null {
  try {
    const raw = Deno.env.get('REVENUECAT_PRODUCT_PLANS_JSON');
    if (!raw || raw.length > 16384) return null;
    const map = JSON.parse(raw);
    if (!isRecord(map) || !Object.hasOwn(map, productId)) return null;
    const value = map[productId];
    if (!isRecord(value) || !['premium', 'premium_plus'].includes(value.plan as string)
      || !['subscription', 'lifetime'].includes(value.kind as string)) return null;
    return value as { plan: 'premium' | 'premium_plus'; kind: 'subscription' | 'lifetime' };
  } catch { return null; }
}

async function stateForUser(userId: string, storeEvent?: RevenueCatStoreEvent): Promise<{ result: SyncResult; state?: EntitlementState }> {
  let eventId: string | null = null;
  let reason: string | null = null;
  if (storeEvent?.type === 'CANCELLATION' || storeEvent?.type === 'EXPIRATION') {
    const suppliedReason = storeEvent.type === 'CANCELLATION' ? storeEvent.cancel_reason : storeEvent.expiration_reason;
    if (storeEvent.app_user_id !== userId || !validEventId(storeEvent.id)
      || typeof suppliedReason !== 'string' || !/^[A-Z_]{1,80}$/.test(suppliedReason)) {
      return { result: { ok: false, reason: 'invalid_store_event' } };
    }
    eventId = storeEvent.id;
    reason = `store_${suppliedReason.toLowerCase()}`;
  }

  // Provider truth is always fetched server-side, even when a webhook/event or
  // client-triggered restore initiated this call. Receipt fields never grant access.
  const rcResult = await fetchRevenueCatSubscriber(userId);
  const web = await webEntitlement(userId);
  if (!rcResult.data) {
    if (!web || storeEvent) return { result: { ok: false, reason: rcResult.debugReason, rcStatus: rcResult.debugStatus } };
    const state = withWeb({ user_id: userId, plan_type: 'free', status: 'expired', expires_at: null, is_trial: false, cancelled_at: null,
      confirm_referral: false, cancellation_event_id: null, cancellation_reason: null, product_id: null, environment: 'PRODUCTION',
      observed_at: new Date().toISOString() }, web);
    return { result: { ok: true, isPro: true, planType: state.plan_type, status: state.status, expiresAt: state.expires_at,
      productId: state.product_id, willRenew: !web.cancel_at_period_end, periodType: 'normal', isTrial: false }, state };
  }
  const rc = rcResult.data;
  const entitlement = rc.subscriber.entitlements[ENTITLEMENT_ID];
  if (entitlement !== undefined && (!isRecord(entitlement)
    || typeof entitlement.product_identifier !== 'string' || !entitlement.product_identifier.trim()
    || !(entitlement.expires_date === null || (typeof entitlement.expires_date === 'string'
      && Number.isFinite(Date.parse(entitlement.expires_date)))))) {
    return { result: { ok: false, reason: 'rc_api_error' } };
  }
  const productId = entitlement?.product_identifier || null;
  const product = productId ? productConfiguration(productId) : null;
  if (productId && !product) return { result: { ok: false, reason: 'unknown_product' } };
  const purchases = productId ? rc.subscriber.non_subscriptions?.[productId] : undefined;
  if (purchases !== undefined && !Array.isArray(purchases)) return { result: { ok: false, reason: 'rc_api_error' } };
  const sub = productId ? rc.subscriber.subscriptions?.[productId] ?? purchases?.at(-1) : undefined;
  if (entitlement && (!sub || (product?.kind === 'subscription' && entitlement.expires_date === null))) {
    return { result: { ok: false, reason: 'rc_api_error' } };
  }
  if (sub !== undefined && (!sub || typeof sub !== 'object' || Array.isArray(sub)
    || (sub.period_type !== undefined && !['normal', 'trial', 'intro'].includes(sub.period_type))
    || (sub.is_sandbox !== undefined && typeof sub.is_sandbox !== 'boolean')
    || (sub.unsubscribe_detected_at != null && (typeof sub.unsubscribe_detected_at !== 'string'
      || !Number.isFinite(Date.parse(sub.unsubscribe_detected_at))))
    || (sub.grace_period_expires_date != null && (typeof sub.grace_period_expires_date !== 'string'
      || !Number.isFinite(Date.parse(sub.grace_period_expires_date)))))) {
    return { result: { ok: false, reason: 'rc_api_error' } };
  }
  const sandbox = sub?.is_sandbox === true || (!entitlement && storeEvent?.environment === 'SANDBOX');
  if (sandbox && Deno.env.get('REVENUECAT_ALLOW_SANDBOX') !== 'true') return { result: { ok: false, reason: 'sandbox_entitlement' } };
  const expiry = entitlement?.expires_date === null ? null : Math.max(Date.parse(entitlement?.expires_date || ''),
    sub?.grace_period_expires_date ? Date.parse(sub.grace_period_expires_date) : 0);
  if (sub?.refunded_at != null && (!Number.isFinite(Date.parse(sub.refunded_at)) || typeof sub.refunded_at !== 'string')
    || sub?.purchase_date != null && (!Number.isFinite(Date.parse(sub.purchase_date)) || typeof sub.purchase_date !== 'string')) return { result: { ok: false, reason: 'rc_api_error' } };
  const refunded = !!sub?.refunded_at && (!sub.purchase_date || Date.parse(sub.refunded_at) >= Date.parse(sub.purchase_date));
  const isPro = !!entitlement && !refunded && (expiry === null || expiry > Date.now());
  const willRenew = isPro && product?.kind === 'subscription' && !sub?.unsubscribe_detected_at;
  const periodType = sub?.period_type || null;
  const isTrial = isPro && periodType === 'trial';
  const planType = isPro ? product!.plan : 'free';
  const status = !isPro ? 'expired' : sub?.unsubscribe_detected_at ? 'cancelled' : 'active';
  let expiresAt: string | null = null;
  if (isPro) {
    if (expiry !== null) expiresAt = new Date(expiry).toISOString();
    else {
      const lifetime = new Date();
      lifetime.setUTCFullYear(lifetime.getUTCFullYear() + 100);
      expiresAt = lifetime.toISOString();
    }
  }

  const storeState: EntitlementState = { user_id: userId, plan_type: planType, status, expires_at: expiresAt,
    is_trial: isTrial, cancelled_at: sub?.unsubscribe_detected_at ? new Date(sub.unsubscribe_detected_at).toISOString() : null,
    confirm_referral: isPro && periodType === 'normal' && !sandbox && storeEvent?.type !== 'TRANSFER',
    cancellation_event_id: eventId, cancellation_reason: reason, product_id: productId,
    environment: sandbox ? 'SANDBOX' : 'PRODUCTION', observed_at: rcResult.observedAt! };
  const state = withWeb(storeState, web);
  if (state !== storeState) {
    return { result: { ok: true, isPro: true, planType: state.plan_type, status: state.status, expiresAt: state.expires_at,
      productId: state.product_id, willRenew: !web!.cancel_at_period_end, periodType: 'normal', isTrial: false, sandbox: false,
      cancellationRecorded: eventId !== null }, state };
  }
  return { result: { ok: true, isPro, planType, status, expiresAt, productId, willRenew, periodType, isTrial, sandbox,
    cancellationRecorded: eventId !== null }, state };
}

async function commitStates(states: EntitlementState[], event?: RevenueCatStoreEvent): Promise<boolean> {
  try {
    const backendUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!backendUrl || !serviceKey) return false;
    const admin = createClient(backendUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc('azure_apply_revenuecat_states', {
      p_states: states, p_event_id: event?.id ?? null, p_event_type: event?.type ?? null,
    });
    // Missing rows, subscription/profile/referral/cancellation write failures all
    // roll back together. Never acknowledge success after a partial DB write.
    return !error && data === true;
  } catch { return false; }
}

export async function syncEntitlementForUser(userId: string, storeEvent?: RevenueCatStoreEvent): Promise<SyncResult> {
  if (!UUID.test(userId)) return { ok: false, reason: 'invalid_user' };
  if (storeEvent && (!validEventId(storeEvent.id) || typeof storeEvent.type !== 'string'
    || !/^[A-Z_]{1,80}$/.test(storeEvent.type) || storeEvent.app_user_id !== userId)) return { ok: false, reason: 'invalid_store_event' };
  const outcome = await stateForUser(userId, storeEvent);
  if (!outcome.result.ok || !outcome.state) return outcome.result;
  if (!await commitStates([outcome.state], storeEvent)) return { ok: false, reason: 'db_write_failed' };
  return outcome.result;
}

export async function syncRevenueCatTransfer(event: RevenueCatStoreEvent): Promise<SyncResult> {
  if (event.type !== 'TRANSFER' || !validEventId(event.id) || Deno.env.get('REVENUECAT_RESTORE_POLICY') !== 'TRANSFER_TO_NEW_ID') {
    return { ok: false, reason: 'transfer_requires_reconciliation' };
  }
  const sides = [event.transferred_from, event.transferred_to];
  if (sides.some(side => !Array.isArray(side) || !side.length || side.length > 16
    || side.some(id => typeof id !== 'string' || (!UUID.test(id) && !ANONYMOUS.test(id))))) {
    return { ok: false, reason: 'transfer_requires_reconciliation' };
  }
  const ids = [...new Set((sides as string[][]).flat().filter(id => UUID.test(id)).map(id => id.toLowerCase()))].sort();
  if (ids.length > 16) return { ok: false, reason: 'transfer_requires_reconciliation' };
  // Anonymous identities have no Anacan UUID/row to grant or revoke. They are
  // never guessed/remapped to a user; a later identified event syncs that UUID.
  if (!ids.length) return { ok: true, transferredUsers: 0 };
  const states: EntitlementState[] = [];
  for (let offset = 0; offset < ids.length; offset += 4) {
    const outcomes = await Promise.all(ids.slice(offset, offset + 4).map(id => stateForUser(id, event)));
    for (const outcome of outcomes) {
      if (!outcome.result.ok || !outcome.state) return outcome.result;
      states.push(outcome.state);
    }
  }
  if (!await commitStates(states, event)) return { ok: false, reason: 'db_write_failed' };
  return { ok: true, transferredUsers: states.length };
}
