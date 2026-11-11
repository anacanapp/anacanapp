// web-premium — anacan.az web subscriptions (monthly / yearly Premium paid by card through Epoint, renewing).
// Signed-in users only (Bearer user JWT from the anacan.az login). POST {action, ...}:
//   status                       → campaign (server prices), current Premium (store / web), subscription, cards, charges
//   subscribe {plan}             → Epoint card-registration-with-pay (first payment + saved card), returns redirect_url;
//                                  refused while any Premium is active
//   add_card                     → Epoint card-registration (no payment), returns redirect_url
//   remove_card {card} / set_default_card {card}
//   cancel / resume              → stop renewals (Premium stays until the period ends) / undo before the period ends
//   change_plan {plan}           → applies from the next renewal, at the price locked at signup
//   charges                      → payment history
// Payments become effective only through the signed Epoint callback (epoint-payment) or get-status, never via the
// redirect back to the site. The Epoint card_id is never returned to the browser.
// The functions router replaces non-2xx bodies, so outcomes the page must show are answered 200 {ok:false, error}.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { WEBSITE_ORIGINS } from '../_shared/dodo.ts';
import { EPOINT_CARD_ID, epointAmount, epointConfig, epointRequest, isCheckoutUrl } from '../_shared/epoint.ts';
import { ENTITLEMENT_ID, fetchRevenueCatSubscriber, syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';
import { sendWebPremiumEmail } from '../_shared/web-premium-email.ts';
import { CABINET_PAGE, CAMPAIGN_PAGE, campaignView, isPlan, rpcErrorCode, type Campaign } from '../_shared/web-premium-subscription.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['status', 'subscribe', 'add_card', 'remove_card', 'set_default_card', 'cancel', 'resume', 'change_plan', 'charges'] as const;
type Action = typeof ACTIONS[number];
const LIVE = ['active', 'past_due', 'cancelled'];

function corsFor(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && WEBSITE_ORIGINS.includes(origin) ? origin : WEBSITE_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  };
}

// Per-user request budget (per isolate): 30 actions a minute; card checkouts are also limited in the database.
const recent = new Map<string, number[]>();
function allow(userId: string, now = Date.now()): boolean {
  const list = (recent.get(userId) ?? []).filter(at => now - at < 60_000);
  if (list.length >= 30) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 5000) for (const [key, value] of recent) if (!value.some(at => now - at < 60_000)) recent.delete(key);
  return true;
}

interface PremiumState { active: boolean; source: 'web_subscription' | 'web_pass' | 'store' | 'promotional' | null; store?: string | null;
  plan?: string | null; expires_at?: string | null; renews?: boolean }

// deno-lint-ignore no-explicit-any
async function premiumState(admin: any, userId: string, subscription: Record<string, unknown> | null): Promise<PremiumState> {
  const now = Date.now();
  if (subscription && LIVE.includes(subscription.status as string) && Date.parse(String(subscription.current_period_end)) > now) {
    return { active: true, source: 'web_subscription', plan: subscription.plan as string, expires_at: subscription.current_period_end as string,
      renews: subscription.cancel_at_period_end !== true };
  }
  const { data: web } = await admin.rpc('web_entitlement_v1', { p_user_id: userId });
  const row = Array.isArray(web) ? web[0] : web;
  if (row?.active === true) {
    const ours = String(row.provider_subscription_id ?? '').startsWith('epoint_sub_');
    return { active: true, source: ours ? 'web_subscription' : 'web_pass', plan: row.plan, expires_at: row.expires_at, renews: false };
  }
  const { data: stored } = await admin.from('subscriptions').select('plan_type,status,expires_at').eq('user_id', userId)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!stored || stored.plan_type === 'free' || (stored.expires_at && Date.parse(stored.expires_at) <= now)) return { active: false, source: null };
  // Which store sells it (App Store / Google Play / promotional) — only for the message; the database row decides.
  let store: string | null = null;
  try {
    const rc = await fetchRevenueCatSubscriber(userId);
    const entitlement = rc.data?.subscriber.entitlements?.[ENTITLEMENT_ID];
    if (entitlement) {
      const sub = rc.data?.subscriber.subscriptions?.[entitlement.product_identifier] as { store?: unknown } | undefined;
      store = typeof sub?.store === 'string' ? sub.store : entitlement.product_identifier.startsWith('rc_promo') ? 'promotional' : null;
    }
  } catch { /* the message falls back to "in the app store" */ }
  return { active: true, source: store === 'promotional' ? 'promotional' : 'store', store, plan: stored.plan_type,
    expires_at: stored.expires_at, renews: stored.status === 'active' && store !== 'promotional' };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsFor(origin);
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  const ok = (body: Record<string, unknown> = {}) => reply(200, { ok: true, ...body });
  const fail = (error: string, extra: Record<string, unknown> = {}) => reply(200, { ok: false, error, ...extra });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (origin && !WEBSITE_ORIGINS.includes(origin)) return reply(403, { error: 'origin_not_allowed' });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const auth = await requireUser(req);
  if (auth.error) return new Response(await auth.error.text(), { status: auth.error.status, headers });
  const userId = auth.user.id;

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply(413, { error: 'payload_too_large' });
    body = raw ? JSON.parse(raw) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch { return reply(400, { error: 'invalid_payload' }); }
  const action = (ACTIONS as readonly string[]).includes(body.action as string) ? body.action as Action : null;
  if (!action) return reply(400, { error: 'invalid_action' });
  if (!allow(userId)) return fail('rate_limited');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const sync = async () => {
    const result = await syncEntitlementForUser(userId).catch(() => ({ ok: false, reason: 'exception' }));
    if (!result.ok) console.error('[web-premium] entitlement sync failed:', result.reason);
  };

  try {
    if (action === 'status') {
      const [{ data: campaign }, { data: account, error }, { data: testOffer }] = await Promise.all([
        admin.rpc('web_premium_campaign_v1'), admin.rpc('web_premium_account_v1', { p_user: userId }),
        admin.rpc('web_premium_test_offer_v1', { p_user: userId })]);
      if (error || !account) return reply(503, { error: 'database_unavailable' });
      const config = await epointConfig(admin);
      return ok({
        campaign: campaignView((campaign ?? { active: false }) as Campaign), payments_ready: config.merchantLive,
        // Admin-only tiny-price offer for end-to-end card tests (null for everyone else).
        test_offer: testOffer && typeof testOffer === 'object' ? testOffer : null,
        premium: await premiumState(admin, userId, account.subscription), subscription: account.subscription,
        cards: account.cards ?? [], charges: account.charges ?? [], email: auth.user.email ?? null,
      });
    }

    if (action === 'charges') {
      const { data, error } = await admin.rpc('web_premium_charges_json', { p_user: userId, p_limit: 100 });
      if (error) return reply(503, { error: 'database_unavailable' });
      return ok({ charges: data ?? [] });
    }

    if (action === 'subscribe' || action === 'add_card') {
      const test = action === 'subscribe' && body.test === true;
      const plan = action === 'subscribe' ? (isPlan(body.plan) ? body.plan : null) : null;
      if (action === 'subscribe' && !plan) return reply(400, { error: 'invalid_plan' });
      const config = await epointConfig(admin);
      if (!config.merchantLive) return fail('payments_unavailable');
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await admin.from('epoint_saved_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
      if ((count ?? 0) >= 6) return fail('too_many_attempts');

      let chargeId: string | null = null;
      let payload: Record<string, unknown>;
      if (action === 'subscribe') {
        const { data: account } = await admin.rpc('web_premium_account_v1', { p_user: userId });
        const premium = await premiumState(admin, userId, account?.subscription ?? null);
        // The admin test may run on an account that already has store Premium; a live web subscription still blocks it (RPC).
        if (premium.active && !(test && premium.source !== 'web_subscription')) return fail('premium_active', { premium });
        const { data: start, error } = test
          ? await admin.rpc('web_premium_subscribe_test_start_v1', { p_user: userId })
          : await admin.rpc('web_premium_subscribe_start_v1', { p_user: userId, p_plan: plan });
        if (error || !start?.charge_id) return fail(rpcErrorCode(error) ?? 'database_unavailable');
        chargeId = start.charge_id as string;
        // Compliance evidence: the page sends the consent it showed (auto-renew + saved card + terms) next to the button.
        if (body.consent === 'premium-autorenew-v1') {
          const { data: ch } = await admin.from('web_premium_charges').select('subscription_id').eq('id', chargeId).maybeSingle();
          if (ch?.subscription_id) await admin.from('web_premium_subscriptions')
            .update({ consent_at: new Date().toISOString(), consent_version: 'premium-autorenew-v1' }).eq('id', ch.subscription_id).is('consent_at', null);
        }
        payload = {
          language: 'az', amount: epointAmount(Number(start.amount)), currency: 'AZN', order_id: chargeId,
          description: `Anacan Premium — ${start.plan === 'monthly' ? 'aylıq' : 'illik'} abunəlik${test ? ' (test)' : ''}`,
          success_redirect_url: `${CAMPAIGN_PAGE}?odenis=ugurlu`, error_redirect_url: `${CAMPAIGN_PAGE}?odenis=xeta`,
        };
      } else {
        payload = { language: 'az', description: 'Anacan Premium — kartın yadda saxlanması',
          success_redirect_url: `${CABINET_PAGE}?kart=ok`, error_redirect_url: `${CABINET_PAGE}?kart=xeta` };
      }

      const path = action === 'subscribe' ? 'card-registration-with-pay' : 'card-registration';
      const answer = await epointRequest(config, path, payload).catch(() => ({ ok: false, httpStatus: 0, result: {} as Record<string, unknown> }));
      const url = answer.result.redirect_url;
      const cardId = answer.result.card_id;
      const giveUp = async () => {
        // Provider answer only (no keys, card or customer data): http status, Epoint status/message, redirect host.
        console.error('[web-premium] epoint rejected:', JSON.stringify({ path, http: answer.httpStatus, status: answer.result.status ?? null,
          message: typeof answer.result.message === 'string' ? answer.result.message.slice(0, 120) : null,
          host: typeof url === 'string' ? url.split('/')[2] ?? null : null }));
        if (chargeId) await admin.rpc('web_premium_charge_failed_v1', { p_charge: chargeId, p_error: 'checkout_unavailable' });
        return fail('checkout_unavailable');
      };
      if (!answer.ok || answer.result.status !== 'success' || !isCheckoutUrl(url) || typeof cardId !== 'string' || !EPOINT_CARD_ID.test(cardId)) {
        return await giveUp();
      }
      const { error: cardError } = await admin.rpc('web_premium_card_pending_v1', {
        p_user: userId, p_card_id: cardId, p_purpose: action === 'subscribe' ? 'subscribe' : 'add_card', p_charge: chargeId });
      if (cardError) return await giveUp();
      if (chargeId && typeof answer.result.transaction === 'string') {
        await admin.from('web_premium_charges').update({ provider_transaction: answer.result.transaction.slice(0, 128), updated_at: new Date().toISOString() })
          .eq('id', chargeId).eq('status', 'pending');
      }
      return ok({ redirect_url: url });
    }

    if (action === 'remove_card' || action === 'set_default_card') {
      if (typeof body.card !== 'string' || !UUID.test(body.card)) return reply(400, { error: 'invalid_card' });
      const { data, error } = await admin.rpc(action === 'remove_card' ? 'web_premium_remove_card_v1' : 'web_premium_set_default_card_v1',
        { p_user: userId, p_card: body.card });
      if (error) return fail(rpcErrorCode(error) ?? 'database_unavailable');
      return ok({ cards: data ?? [] });
    }

    if (action === 'change_plan') {
      if (!isPlan(body.plan)) return reply(400, { error: 'invalid_plan' });
      const { data, error } = await admin.rpc('web_premium_change_plan_v1', { p_user: userId, p_plan: body.plan });
      if (error) return fail(rpcErrorCode(error) ?? 'database_unavailable');
      return ok({ subscription: data });
    }

    // cancel / resume
    const { data, error } = await admin.rpc(action === 'cancel' ? 'web_premium_cancel_v1' : 'web_premium_resume_v1', { p_user: userId });
    if (error) return fail(rpcErrorCode(error) ?? 'database_unavailable');
    await sync();
    if (action === 'cancel' && data) {
      await sendWebPremiumEmail('cancelled', { userId, to: auth.user.email, plan: data.plan, amount: Number(data.price), periodEnd: data.current_period_end });
    }
    return ok({ subscription: data });
  } catch (e) {
    console.error('[web-premium] failed:', action, e instanceof Error ? e.message.slice(0, 80) : 'unknown');
    return reply(503, { error: 'unavailable' });
  }
});
