// promo-redeem — Premium from a QR campaign code (Admin › QR kampaniyalar).
//
// Flow: reserve the redemption (promo_reserve_v1 checks the campaign: active, date window, use limit, new-account rule,
// one gifted campaign per person) → grant the RevenueCat promotional entitlement for the campaign's duration →
// finish the redemption and sync the entitlement like a store purchase, so the gift survives every later sync.
// A person with an auto-renewing App Store / Google Play subscription is refused (the gift would buy nothing).
// A running promotional / one-time / web pass is extended: the gift starts when it ends.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { ENTITLEMENT_ID, fetchRevenueCatSubscriber, syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

const DURATIONS = new Set(['weekly', 'monthly', 'two_month', 'three_month', 'six_month', 'yearly', 'lifetime']);
const KNOWN = ['PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_NOT_STARTED', 'PROMO_EXPIRED', 'PROMO_FULL', 'PROMO_ALREADY_USED',
  'PROMO_NOT_NEW_USER', 'PROMO_IN_PROGRESS'];
const promoError = (message: string | undefined) => KNOWN.find((k) => message?.includes(k)) ?? null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretKey) return json(503, { error: 'not_configured' });

  let code = '';
  try {
    const raw = await req.text();
    if (raw.length > 512) return json(413, { error: 'payload_too_large' });
    const body = JSON.parse(raw);
    code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  } catch { return json(400, { error: 'invalid_payload' }); }
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) return json(400, { error: 'PROMO_NOT_FOUND' });

  const userId = auth.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  // Where the gift starts: now, or the end of a running non-renewing Premium.
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

  const { data: reserved, error: reserveError } = await admin.rpc('promo_reserve_v1', { p_user: userId, p_code: code });
  if (reserveError || !reserved?.redemption_id) {
    const known = promoError(reserveError?.message);
    if (!known) console.error('[promo-redeem] reserve failed:', reserveError?.message?.slice(0, 160));
    return json(409, { error: known ?? 'grant_failed' });
  }
  const redemptionId = reserved.redemption_id as string;
  const duration = String(reserved.duration);
  if (!DURATIONS.has(duration)) {
    await admin.rpc('promo_finish_v1', { p_redemption: redemptionId, p_success: false, p_note: 'unknown duration' });
    return json(500, { error: 'grant_failed' });
  }

  let granted = false;
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}/entitlements/${encodeURIComponent(ENTITLEMENT_ID)}/promotional`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(duration === 'lifetime' ? { duration } : { duration, start_time_ms: start }),
    });
    granted = response.ok;
    if (!granted) console.error('[promo-redeem] RevenueCat grant refused:', response.status);
  } catch (e) {
    console.error('[promo-redeem] RevenueCat grant failed:', e instanceof Error ? e.message.slice(0, 120) : 'unknown');
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: finishError } = await admin.rpc('promo_finish_v1',
      { p_redemption: redemptionId, p_success: granted, p_note: granted ? `rc promo ${duration}` : 'revenuecat grant failed' });
    if (!finishError) break;
    console.error(`[promo-redeem] finish failed (attempt ${attempt + 1}):`, finishError.message.slice(0, 120));
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  if (!granted) return json(502, { error: 'grant_failed' });

  const sync = await syncEntitlementForUser(userId);
  if (!sync.ok) console.error('[promo-redeem] entitlement sync failed:', sync.reason);
  return json(200, { ok: true, duration, title: reserved.title ?? null, expires_at: sync.expiresAt ?? null });
});
