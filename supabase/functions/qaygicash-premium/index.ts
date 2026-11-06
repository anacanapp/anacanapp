// qaygicash-premium — Premium paid with QayğıCash bonus.
//
// Off unless the country's cashback_programs.premium_redeem enables it (master switch, plan, platform; admin).
// Flow: reserve the bonus (qc_premium_reserve_v1, price set by admin) → grant the RevenueCat promotional
// entitlement for one month / one year → commit the bonus and sync the entitlement like a store purchase.
// If RevenueCat refuses, the bonus is released. A person with an auto-renewing App Store / Google Play
// subscription is refused (a promotional grant runs alongside it, so the bonus would buy nothing).
// A running promotional / one-time / web pass is extended: the new period starts when it ends.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { ENTITLEMENT_ID, fetchRevenueCatSubscriber, syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';
import { qcErrorCode } from '../_shared/qaygicash.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretKey) return json(503, { error: 'not_configured' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 1024) return json(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch { return json(400, { error: 'invalid_payload' }); }
  const plan = body.plan === 'yearly' || body.plan === 'monthly' ? body.plan : null;
  const platform = body.platform === 'ios' || body.platform === 'android' || body.platform === 'web' ? body.platform : null;
  if (!plan || !platform) return json(400, { error: 'invalid_request' });

  const userId = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  // Where the new period starts: now, or the end of a running non-renewing Premium.
  const rc = await fetchRevenueCatSubscriber(userId);
  if (!rc.data) return json(503, { error: 'grant_failed' });
  const now = Date.now();
  let start = now;
  const ent = rc.data.subscriber.entitlements?.[ENTITLEMENT_ID];
  const entEnd = ent?.expires_date ? Date.parse(ent.expires_date) : null;
  if (ent && (entEnd === null || entEnd > now)) {
    if (entEnd === null) return json(409, { error: 'premium_store_subscription_active' }); // lifetime
    const sub = rc.data.subscriber.subscriptions?.[ent.product_identifier];
    const promo = ent.product_identifier.startsWith('rc_promo');
    if (!promo && sub && !sub.unsubscribe_detected_at && !sub.refunded_at) return json(409, { error: 'premium_store_subscription_active' });
    start = Math.max(start, entEnd);
  }
  const { data: web } = await admin.rpc('web_entitlement_v1', { p_user_id: userId });
  const webRow = Array.isArray(web) ? web[0] : web;
  if (webRow?.active === true && webRow.expires_at) start = Math.max(start, Date.parse(webRow.expires_at));

  const { data: reserved, error: reserveError } = await admin.rpc('qc_premium_reserve_v1',
    { p_user: userId, p_plan: plan, p_platform: platform });
  if (reserveError || !reserved?.order_id) {
    return json(409, { error: qcErrorCode(reserveError) ?? 'QC_NOT_AVAILABLE' });
  }
  const orderId = reserved.order_id as string;

  let granted = false;
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}/entitlements/${encodeURIComponent(ENTITLEMENT_ID)}/promotional`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: plan, start_time_ms: start }),
    });
    granted = response.ok;
    if (!granted) console.error('[qaygicash-premium] RevenueCat grant refused:', response.status);
  } catch (e) {
    console.error('[qaygicash-premium] RevenueCat grant failed:', e instanceof Error ? e.message.slice(0, 120) : 'unknown');
  }

  // After a grant the bonus must be committed, or the stale-reservation release would hand it back.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: finishError } = await admin.rpc('qc_premium_finish_v1',
      { p_order_id: orderId, p_success: granted, p_note: granted ? `rc promo ${plan}` : 'revenuecat grant failed' });
    if (!finishError) break;
    console.error(`[qaygicash-premium] finish failed (attempt ${attempt + 1}, order ${orderId}):`, finishError.message.slice(0, 120));
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  if (!granted) return json(502, { error: 'grant_failed' });

  const sync = await syncEntitlementForUser(userId);
  if (!sync.ok) console.error('[qaygicash-premium] entitlement sync failed:', sync.reason);
  return json(200, { ok: true, plan, expires_at: sync.expiresAt ?? null, price_minor: reserved.price_minor });
});
