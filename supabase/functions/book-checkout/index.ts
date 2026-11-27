// book-checkout — starts an Epoint card payment for printable PDF books from inside the app.
// The signed-in person picks books; the price is computed here from the bundle tiers (never from
// the client), already-owned books are refused, and access is granted only by the signed
// Epoint result callback (epoint-result).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireUser } from '../_shared/auth.ts';
import { bookOrderTotal, bookUnitPrice, MAX_BOOKS_PER_ORDER } from '../_shared/book-pricing.ts';
import { epointConfig, epointLanguage, epointRequest, isCheckoutUrl } from '../_shared/epoint.ts';
import { LANGUAGE_CODES } from '../_shared/languages.ts';
import { qcErrorCode } from '../_shared/qaygicash.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const APP = 'https://app.anacan.az';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  // The shop asks whether card payment is live (Epoint keys present and enabled).
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const config = await epointConfig(admin);
  if (req.method === 'GET') return json(200, { ready: config.ready, provider: 'epoint' });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!config.ready) return json(503, { error: 'payments_unavailable' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch { return json(400, { error: 'invalid_payload' }); }
  const ids = Array.isArray(body.book_ids) ? [...new Set(body.book_ids.filter((id): id is string => typeof id === 'string' && /^[0-9]m?_[0-9]{2}$/.test(id)))] : [];
  if (ids.length < 1 || ids.length > MAX_BOOKS_PER_ORDER || ids.length !== (body.book_ids as unknown[]).length) return json(400, { error: 'invalid_books' });
  const language = typeof body.language === 'string' && (LANGUAGE_CODES as readonly string[]).includes(body.language) ? body.language : 'az';

  const userId = auth.user.id;
  const { data: books } = await admin.from('book_catalog').select('id').in('id', ids).eq('active', true);
  if ((books?.length ?? 0) !== ids.length) return json(400, { error: 'unknown_books' });
  const { data: owned } = await admin.from('book_entitlements').select('book_id').eq('user_id', userId).in('book_id', ids);
  if (owned?.length) return json(409, { error: 'already_owned', book_ids: owned.map(row => row.book_id) });

  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await admin.from('book_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= 10) return json(429, { error: 'too_many_requests' });

  const { data: account } = await admin.auth.admin.getUserById(userId);
  const email = (account?.user?.email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'no_email' });

  const unit = bookUnitPrice(ids.length), total = bookOrderTotal(ids.length);
  // QayğıCash (optional): limits are enforced by qc_reserve (max share of the order, min, balance).
  const totalMinor = Math.round(total * 100);
  const wanted = typeof body.cashback === 'number' && Number.isFinite(body.cashback) ? Math.round(body.cashback * 100) : 0;
  const cashbackMinor = wanted > 0 && wanted < totalMinor ? wanted : 0;
  if (wanted !== 0 && cashbackMinor === 0) return json(400, { error: 'invalid_cashback' });
  const amount = (totalMinor - cashbackMinor) / 100;
  const { data: order, error } = await admin.from('book_orders')
    .insert({ user_id: userId, email, book_ids: ids, unit_price: unit, amount, cashback_used: cashbackMinor / 100, language,
      // Builds with the consent checkbox send it; older builds do not (recorded when present).
      ...(body.consent === 'digital-delivery-v1' ? { consent_at: new Date().toISOString(), consent_version: 'digital-delivery-v1' } : {}) })
    .select('id').single();
  if (error || !order) return json(500, { error: 'order_not_saved' });
  if (cashbackMinor > 0) {
    const { error: qcError } = await admin.rpc('qc_reserve_book_v1',
      { p_user: userId, p_order_id: order.id, p_amount_minor: cashbackMinor, p_total_minor: totalMinor });
    if (qcError) {
      await admin.from('book_orders').update({ status: 'failed', provider_status: 'cashback_refused', updated_at: new Date().toISOString() }).eq('id', order.id);
      return json(409, { error: qcErrorCode(qcError) ?? 'QC_NOT_AVAILABLE' });
    }
  }

  try {
    const { ok, result } = await epointRequest(config, 'request', {
      amount: amount.toFixed(2), currency: 'AZN', language: epointLanguage(language), order_id: order.id,
      description: `Anacan — ${ids.length} PDF kitab`,
      success_redirect_url: `${APP}/payment/success?kind=books&order=${order.id}`,
      error_redirect_url: `${APP}/payment/error?kind=books&order=${order.id}`,
    });
    const url = typeof result.redirect_url === 'string' ? result.redirect_url : '';
    if (!ok || result.status !== 'success' || !isCheckoutUrl(url)) throw new Error('epoint_no_url');
    await admin.from('book_orders').update({ provider_transaction: typeof result.transaction === 'string' ? result.transaction : null, updated_at: new Date().toISOString() }).eq('id', order.id);
    return json(200, { checkout_url: url, order_id: order.id, amount, unit_price: unit, cashback: cashbackMinor / 100 });
  } catch (e) {
    console.error('[book-checkout] create failed:', e instanceof Error ? e.message : 'unknown');
    await admin.from('book_orders').update({ status: 'failed', provider_status: 'request_failed', updated_at: new Date().toISOString() }).eq('id', order.id);
    return json(502, { error: 'checkout_unavailable' });
  }
});
