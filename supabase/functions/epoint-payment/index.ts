import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyBookPaymentResult, isBookOrder } from '../_shared/book-result.ts';
import { applyWebCakeResult, isWebCakeOrder } from '../_shared/web-cake-result.ts';
import { applyWebPremiumResult, isWebPremiumOrder } from '../_shared/web-premium-result.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reference = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

class PaymentError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PaymentError(400, 'invalid_payment_payload');
  }
  return value as Record<string, unknown>;
}

function amount(value: unknown): string {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || !/^(0|[1-9]\d{0,4})(\.\d{1,2})?$/.test(String(value))) {
    throw new PaymentError(400, 'invalid_amount');
  }
  const [whole, fraction = ''] = String(value).split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 1 || cents > 1_000_000) throw new PaymentError(400, 'invalid_amount');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

async function limitedText(message: Request | Response): Promise<string> {
  const reader = message.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 32_768) {
        await reader.cancel();
        throw new PaymentError(413, 'payment_payload_too_large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function encodeData(value: unknown): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
}

// Preserve Epoint's source contract: base64(SHA-1(privateKey + data + privateKey)).
async function createSignature(privateKey: string, data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(privateKey + data + privateKey));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function sameSignature(expected: string, supplied: string): boolean {
  if (!/^[A-Za-z0-9+/]{27}=$/.test(supplied)) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

function httpsUrl(value: unknown, provider = false): string {
  if (typeof value !== 'string' || value.length > 2048) throw new PaymentError(400, 'invalid_redirect');
  let url: URL;
  try { url = new URL(value); } catch { throw new PaymentError(400, 'invalid_redirect'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    // Epoint returns its acquiring bank's page (e.g. ecomm.pashabank.az), so any .az host is a valid provider page.
    || (provider && url.hostname !== 'epoint.az' && !url.hostname.endsWith('.az'))) {
    throw new PaymentError(400, 'invalid_redirect');
  }
  return url.href;
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const actions = new URL(req.url).searchParams.getAll('action');
    const action = actions.length === 0 ? 'create' : actions[0];
    if (actions.length > 1 || !['create', 'callback', 'status', 'refund'].includes(action)) {
      throw new PaymentError(400, 'unsupported_payment_action');
    }
    const backendUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!backendUrl || !serviceKey || (action !== 'callback' && !anonKey)) {
      throw new PaymentError(503, 'payment_not_configured');
    }
    const admin = createClient(backendUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let userId: string | null = null;
    let isAdmin = false;
    if (action !== 'callback') {
      const authorization = req.headers.get('Authorization') || '';
      if (!/^Bearer [^\s,]+$/.test(authorization)) throw new PaymentError(401, 'unauthorized');
      const token = authorization.slice(7);
      if (token === serviceKey || token === anonKey) throw new PaymentError(401, 'unauthorized');
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user || !uuid.test(data.user.id) || data.user.role !== 'authenticated' || data.user.is_anonymous) {
        throw new PaymentError(401, 'unauthorized');
      }
      userId = data.user.id;
      if (action === 'refund' || action === 'status') {
        const role = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
        if (role.error) throw new PaymentError(503, 'payment_database_unavailable');
        isAdmin = !!role.data;
        if (action === 'refund' && !isAdmin) throw new PaymentError(403, 'admin_required');
      }
    }

    const settingsResult = await admin.from('app_settings').select('key, value')
      .in('key', ['epoint_public_key', 'epoint_private_key', 'epoint_mode']);
    if (settingsResult.error) throw new PaymentError(503, 'payment_database_unavailable');
    const settings: Record<string, string> = {};
    for (const setting of settingsResult.data || []) {
      let value: unknown = setting.value;
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { /* Plain text is also stored by the source admin UI. */ }
      }
      if (typeof value === 'string' && value.trim() && !['null', 'undefined'].includes(value.trim())) {
        settings[setting.key] = value.trim();
      }
    }
    const publicKey = settings.epoint_public_key;
    const privateKey = settings.epoint_private_key;
    // Test/unconfigured merchants never create sessions, settle real orders, or refund.
    if (!publicKey || !privateKey || settings.epoint_mode !== 'live') {
      throw new PaymentError(503, 'payment_merchant_not_live');
    }

    async function rpc(name: string, parameters: Record<string, unknown>) {
      const { data, error } = await admin.rpc(name, parameters);
      if (error) {
        const status = { PT400: 400, PT403: 403, PT404: 404, PT409: 409 }[error.code as string] || 503;
        throw new PaymentError(status, status === 503 ? 'payment_database_unavailable' : 'payment_contract_rejected');
      }
      if (!data || typeof data !== 'object' || typeof data.changed !== 'boolean') {
        throw new PaymentError(503, 'payment_database_unavailable');
      }
      return data;
    }

    async function provider(path: 'request' | 'get-status' | 'reverse', payload: Record<string, unknown>) {
      try {
        const data = encodeData({ public_key: publicKey, ...payload });
        const signature = await createSignature(privateKey, data);
        const response = await fetch(`https://epoint.az/api/1/${path}`, {
          // Epoint sits behind Cloudflare, which rejects requests without a client User-Agent (error 1010).
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'Anacan/1.0 (+https://anacan.az)' },
          body: new URLSearchParams({ data, signature }).toString(), redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error('provider_http_error');
        return record(JSON.parse(await limitedText(response)));
      } catch { throw new PaymentError(502, 'payment_provider_unavailable'); }
    }

    function verifyProviderBinding(result: Record<string, unknown>, transaction: Record<string, unknown>) {
      try {
        if (result.transaction !== transaction.epoint_transaction || result.order_id !== transaction.order_id
          || result.currency !== 'AZN' || result.currency !== transaction.currency
          || amount(result.amount) !== amount(transaction.amount)
          || (result.public_key !== undefined && result.public_key !== publicKey)) throw new Error('binding_mismatch');
      } catch { throw new PaymentError(502, 'payment_provider_binding_mismatch'); }
    }

    const text = await limitedText(req);
    if (action === 'callback') {
      if (req.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') {
        throw new PaymentError(415, 'invalid_callback_encoding');
      }
      const form = new URLSearchParams(text);
      const data = form.get('data');
      const signature = form.get('signature');
      if (form.getAll('data').length !== 1 || form.getAll('signature').length !== 1 || !data || !signature
        || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        throw new PaymentError(400, 'invalid_callback_payload');
      }
      if (!sameSignature(await createSignature(privateKey, data), signature)) {
        throw new PaymentError(403, 'invalid_callback_signature');
      }
      let result: Record<string, unknown>;
      try {
        result = record(JSON.parse(new TextDecoder('utf-8', { fatal: true })
          .decode(Uint8Array.from(atob(data), (character) => character.charCodeAt(0)))));
      } catch { throw new PaymentError(400, 'invalid_callback_payload'); }
      // Printable-book orders share this merchant Result URL; they have their own order table.
      if (await isBookOrder(admin, result.order_id)) {
        const outcome = await applyBookPaymentResult(admin, { ready: true, merchantLive: true, booksEnabled: true, publicKey, privateKey }, result);
        if (outcome === 'not_confirmed' || outcome === 'grant_failed') throw new PaymentError(outcome === 'not_confirmed' ? 409 : 503, 'book_payment_' + outcome);
        return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
      }
      // Cake orders from the anacan.az web shop (no payment_transactions row).
      if (await isWebCakeOrder(admin, result.order_id)) {
        const outcome = await applyWebCakeResult(admin, { ready: true, merchantLive: true, booksEnabled: true, publicKey, privateKey }, result);
        if (outcome === 'not_confirmed') throw new PaymentError(409, 'cake_payment_not_confirmed');
        return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
      }
      // Premium passes from the anacan.az funnel (web_premium_orders; fixed-term web subscription on success).
      if (await isWebPremiumOrder(admin, result.order_id)) {
        const outcome = await applyWebPremiumResult(admin, { ready: true, merchantLive: true, booksEnabled: true, publicKey, privateKey }, result);
        if (outcome === 'not_confirmed' || outcome === 'grant_failed') throw new PaymentError(outcome === 'not_confirmed' ? 409 : 503, 'premium_payment_' + outcome);
        return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
      }
      if (typeof result.order_id !== 'string' || !reference.test(result.order_id)
        || typeof result.transaction !== 'string' || !reference.test(result.transaction)
        || !['success', 'failed', 'error'].includes(result.status as string) || result.currency !== 'AZN'
        || (result.public_key !== undefined && result.public_key !== publicKey)) {
        throw new PaymentError(400, 'invalid_callback_payload');
      }
      await rpc('azure_epoint_transition', {
        p_order_id: result.order_id, p_transaction: result.transaction,
        p_amount: amount(result.amount), p_currency: result.currency,
        p_transition: result.status === 'success' ? 'success' : 'failed',
      });
      // No raw callback/card/bank fields are stored or logged. A DB error never ACKs.
      return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
    }

    let body: Record<string, unknown>;
    try { body = record(JSON.parse(text)); } catch { throw new PaymentError(400, 'invalid_payment_payload'); }
    if (body.currency !== undefined && body.currency !== 'AZN') throw new PaymentError(400, 'unsupported_currency');

    if (action === 'create') {
      if (!['shop', 'cake', 'album'].includes(body.orderType as string)) throw new PaymentError(400, 'unsupported_order_type');
      if (typeof body.orderReferenceId !== 'string' || !uuid.test(body.orderReferenceId)) {
        throw new PaymentError(400, 'order_reference_required');
      }
      const successUrl = httpsUrl(body.successUrl ?? new URL('/payment/success', backendUrl).href);
      const errorUrl = httpsUrl(body.errorUrl ?? new URL('/payment/error', backendUrl).href);
      const checkout = await rpc('azure_epoint_checkout', {
        p_user_id: userId, p_order_type: body.orderType, p_reference_id: body.orderReferenceId,
        p_expected_amount: amount(body.amount), p_currency: 'AZN',
      });
      if (!checkout.changed) {
        if (checkout.status !== 'processing' || !checkout.transaction || !checkout.redirect_url) {
          throw new PaymentError(409, 'payment_already_attempted_reconcile_before_retry');
        }
        return json({ success: true, redirectUrl: httpsUrl(checkout.redirect_url, true), transactionId: checkout.id, orderId: checkout.order_id });
      }
      // The RPC returns the DB-derived total, never the caller's order ID/description/price.
      const result = await provider('request', {
        amount: amount(checkout.amount), currency: checkout.currency, language: 'az', order_id: checkout.order_id,
        description: `Anacan ${body.orderType} order`, success_redirect_url: successUrl, error_redirect_url: errorUrl,
      });
      if (result.status !== 'success' || typeof result.transaction !== 'string' || !reference.test(result.transaction)) {
        throw new PaymentError(502, 'payment_provider_request_rejected');
      }
      let redirectUrl: string;
      try { redirectUrl = httpsUrl(result.redirect_url, true); } catch { throw new PaymentError(502, 'payment_provider_request_rejected'); }
      await rpc('azure_epoint_transition', {
        p_order_id: checkout.order_id, p_transaction: result.transaction, p_amount: checkout.amount,
        p_currency: checkout.currency, p_transition: 'register', p_redirect_url: redirectUrl,
      });
      return json({ success: true, redirectUrl, transactionId: checkout.id, orderId: checkout.order_id });
    }

    if (typeof body.transaction !== 'string' || !reference.test(body.transaction) || body.transaction.startsWith('TEST-')) {
      throw new PaymentError(400, 'invalid_transaction');
    }
    const stored = await admin.from('payment_transactions')
      .select('user_id, order_id, amount, currency, status, epoint_transaction, epoint_contract_version')
      .eq('epoint_transaction', body.transaction).maybeSingle();
    if (stored.error) throw new PaymentError(503, 'payment_database_unavailable');
    if (!stored.data || (!isAdmin && stored.data.user_id !== userId)) throw new PaymentError(404, 'payment_not_found');
    const transaction = stored.data;
    if (transaction.epoint_contract_version !== 1 || transaction.currency !== 'AZN') {
      throw new PaymentError(409, 'legacy_payment_requires_reconciliation');
    }
    if (action === 'refund' && (transaction.status !== 'success' || amount(body.amount) !== amount(transaction.amount))) {
      throw new PaymentError(409, 'only_full_settled_refunds_supported');
    }
    const current = await provider('get-status', { transaction: body.transaction });
    verifyProviderBinding(current, transaction);
    if (action === 'status') {
      if (!['processing', 'success', 'failed', 'error', 'returned'].includes(current.status as string)) {
        throw new PaymentError(502, 'unsupported_provider_state');
      }
      return json({ status: current.status, transaction: body.transaction, orderId: transaction.order_id,
        amount: amount(transaction.amount), currency: transaction.currency });
    }
    if (current.status !== 'success') throw new PaymentError(409, 'provider_payment_not_refundable');
    const parameters = { p_order_id: transaction.order_id, p_transaction: body.transaction,
      p_amount: amount(transaction.amount), p_currency: 'AZN' };
    const claim = await rpc('azure_epoint_transition', { ...parameters, p_transition: 'refund_pending' });
    if (!claim.changed) throw new PaymentError(409, 'refund_already_attempted');
    // Exactly one reversal attempt. Timeout, rejection, or failed persistence leaves
    // refund_pending for operator reconciliation, never an automatic reverse retry.
    const reversed = await provider('reverse', { transaction: body.transaction, amount: parameters.p_amount, currency: 'AZN' });
    if (reversed.status !== 'success') throw new PaymentError(502, 'refund_requires_reconciliation');
    const after = await provider('get-status', { transaction: body.transaction });
    verifyProviderBinding(after, transaction);
    if (after.status !== 'returned') throw new PaymentError(502, 'refund_requires_reconciliation');
    await rpc('azure_epoint_transition', { ...parameters, p_transition: 'returned' });
    return json({ status: 'success', transaction: body.transaction, amount: parameters.p_amount, currency: 'AZN' });
  } catch (error) {
    // Fixed codes only: never reflect provider responses, DB errors, keys, or user/card data.
    if (error instanceof PaymentError) return json({ error: error.code }, error.status);
    return json({ error: 'payment_internal_error' }, 503);
  }
});
