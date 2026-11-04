// epoint-result — Epoint "result URL" callback (configure it in the Epoint cabinet:
// https://api.anacan.az/functions/v1/epoint-result). The signature is verified on the raw `data`,
// the payment is re-checked with get-status and the amount must equal the order. Only then are the
// books granted, a download token is minted (its hash stored) and the e-mail with links is sent.
// Repeated callbacks for a paid order are acknowledged without changes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { decodeData, epointConfig, epointRequest, verify } from '../_shared/epoint.ts';
import { sendBooksEmail } from '../_shared/book-email.ts';

const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const PUBLIC_FUNCTIONS = Deno.env.get('BOOKS_PUBLIC_FUNCTIONS_URL') || 'https://api.anacan.az/functions/v1';
const COVERS = Deno.env.get('BOOKS_PUBLIC_COVERS_URL') || 'https://api.anacan.az/storage/v1/object/public/book-covers';
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const config = epointConfig();
  if (!config.ready) return reply(503, { error: 'payments_unavailable' });
  const raw = await req.text();
  if (raw.length > 32_000) return reply(413, { error: 'payload_too_large' });
  const form = new URLSearchParams(raw);
  const data = form.get('data') || '', signature = form.get('signature') || '';
  if (!data || !signature || !(await verify(data, signature, config.privateKey))) return reply(401, { error: 'invalid_signature' });
  const payload = decodeData(data);
  const orderId = typeof payload?.order_id === 'string' && /^[0-9a-f-]{36}$/.test(payload.order_id) ? payload.order_id : null;
  if (!payload || !orderId) return reply(400, { error: 'invalid_payload' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: order } = await admin.from('book_orders').select('id,user_id,email,book_ids,amount,status').eq('id', orderId).maybeSingle();
  if (!order) return reply(404, { error: 'order_not_found' });
  if (order.status === 'paid') return reply(200, { received: true, duplicate: true });
  const now = new Date().toISOString();

  if (payload.status !== 'success') {
    await admin.from('book_orders').update({ status: 'failed', provider_status: String(payload.status ?? 'unknown').slice(0, 40), updated_at: now }).eq('id', orderId).eq('status', 'pending');
    return reply(200, { received: true });
  }
  // Never trust the callback alone: ask Epoint for the order's status and compare the amount.
  const { result: status } = await epointRequest('get-status', { order_id: orderId });
  const paidAmount = Number(status.amount ?? payload.amount);
  if (status.status !== 'success' || !Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.amount)) > 0.001) {
    console.error('[epoint-result] status mismatch for order', orderId);
    return reply(409, { error: 'payment_not_confirmed' });
  }

  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const { data: updated } = await admin.from('book_orders').update({
    status: 'paid', paid_at: now, updated_at: now, provider_status: 'success', download_token_hash: await sha256(token),
    provider_transaction: typeof payload.transaction === 'string' ? payload.transaction : null,
  }).eq('id', orderId).eq('status', 'pending').select('id');
  if (!updated?.length) return reply(200, { received: true, duplicate: true });
  const grants = (order.book_ids as string[]).map(bookId => ({ user_id: order.user_id, book_id: bookId, order_id: orderId }));
  const { error: grantError } = await admin.from('book_entitlements').upsert(grants, { onConflict: 'user_id,book_id', ignoreDuplicates: true });
  if (grantError) { console.error('[epoint-result] grant failed'); return reply(500, { error: 'grant_failed' }); }

  const { data: books } = await admin.from('book_catalog').select('id,title,cover_path').in('id', order.book_ids as string[]).order('sort_order');
  const sent = await sendBooksEmail({ userId: order.user_id, to: order.email, orderId, token, functionsUrl: PUBLIC_FUNCTIONS,
    books: (books ?? []).map(book => ({ id: book.id, title: book.title, cover: `${COVERS}/${String(book.cover_path).replace(/^covers\//, '')}` })) });
  if (sent) await admin.from('book_orders').update({ email_sent_at: new Date().toISOString() }).eq('id', orderId);
  return reply(200, { received: true });
});
