// partner-conversion — receives order reports from partner stores (Olivia first) so Anacan can measure every sale it
// brings, also when the order is placed on the partner's own website (cooperation model V2).
//
// Two callers, one endpoint (POST /functions/v1/partner-conversion):
//   • Browser pixel: public/sdk/anacan-partner.js on the partner's thank-you page. No secret; the Origin header must be
//     the partner's website (checked in SQL). Can only create an order once, always as status "pending".
//   • Partner server: "Authorization: Bearer sk_…" (secret created by the owner in the partner panel). Can create orders
//     and update amount and status (pending, confirmed, delivered, cancelled, returned). This is the reliable path.
// Body: {"key":"pk_…","order":{"order_id","total","currency","items":[{sku,name,quantity,price}],"click","coupon","status","test","ordered_at"}}
// The key may also come as ?key=…. All checks and the attribution (click inside the window or an Anacan coupon) run in
// public.shop_partner_conversion_v1 (service_role only). The secret itself never leaves this function: only its sha256.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MAX_BODY = 16_384;

function corsHeaders(origin: string | null) {
  return {
    // Any partner site may call; the SQL side decides whether the origin belongs to the key's partner.
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const STATUS_BY_ERROR: Record<string, number> = {
  invalid_key: 400, unknown_key: 404, invalid_secret: 401, origin_not_allowed: 403, partner_paused: 409,
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });

  // navigator.sendBeacon posts text/plain, so the body is read as text whatever the content type says.
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'payload_too_large' });
    body = raw ? JSON.parse(raw) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    return reply(400, { ok: false, error: 'invalid_json' });
  }

  const url = new URL(req.url);
  const key = typeof body.key === 'string' ? body.key : url.searchParams.get('key');
  if (!key || !/^pk_[a-f0-9]{32}$/.test(key)) return reply(400, { ok: false, error: 'invalid_key' });

  const auth = req.headers.get('authorization') || '';
  const bearer = /^Bearer\s+(sk_[a-f0-9]{64})\s*$/i.exec(auth)?.[1] ?? null;
  if (auth && /^Bearer\s+sk_/i.test(auth) && !bearer) return reply(401, { ok: false, error: 'invalid_secret' });
  const secretHash = bearer ? await sha256Hex(bearer) : null;

  // Accept {order:{…}} or the order fields at the top level.
  const order = (body.order && typeof body.order === 'object' && !Array.isArray(body.order) ? body.order : body) as Record<string, unknown>;
  const { key: _k, order: _o, ...flat } = order as Record<string, unknown>;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('shop_partner_conversion_v1', {
    p_key: key, p_secret_sha256: secretHash, p_origin: bearer ? null : origin, p_order: flat,
  });
  if (error) {
    console.error('[partner-conversion] rpc failed', error.code);
    return reply(500, { ok: false, error: 'server_error' });
  }
  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok === false) return reply(STATUS_BY_ERROR[String(result.error)] ?? 400, result);
  return reply(200, result);
});
