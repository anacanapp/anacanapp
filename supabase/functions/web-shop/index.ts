// web-shop — anacan.az (Azerbaijani only) guest checkout for printable PDF books and cakes, paid with Epoint.
// GET  → { books: { ready }, cakes: { ready } } so the page can say when card payment is not live yet.
// POST → { kind: 'books' | 'cakes', … } creates the order with server-side prices and returns the Epoint
//        payment page. Orders are confirmed only by the signed Epoint callback (epoint-payment).
// A web order is linked to an existing Anacan account with the same e-mail, so bought books also appear
// in "Kitablarım" in the app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bookOrderTotal, bookUnitPrice, MAX_BOOKS_PER_ORDER } from '../_shared/book-pricing.ts';
import { epointConfig, epointRequest, isCheckoutUrl } from '../_shared/epoint.ts';
import { WEBSITE_ORIGINS } from '../_shared/dodo.ts';

const SITE = 'https://anacan.az';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FLAVORS = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
const SLOTS = ['10:00–13:00', '14:00–18:00'];
const PHOTO_BOX_EXTRA = 18;

function headersFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && WEBSITE_ORIGINS.includes(origin) ? origin : WEBSITE_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  };
}
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bakuDate = (offsetDays: number) => new Date(Date.now() + 4 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = headersFor(origin);
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (origin && !WEBSITE_ORIGINS.includes(origin)) return reply(403, { error: 'origin_not_allowed' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const config = await epointConfig(admin);
  const { data: cakeSetting } = await admin.from('app_settings').select('value').eq('key', 'cakes_web_payments_enabled').maybeSingle();
  const cakesEnabled = String(cakeSetting?.value ?? '').replace(/"/g, '') === 'true';
  const ready = { books: config.ready, cakes: config.merchantLive && cakesEnabled };
  if (req.method === 'GET') return reply(200, { books: { ready: ready.books }, cakes: { ready: ready.cakes } });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8192) return reply(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch { return reply(400, { error: 'invalid_payload' }); }

  const name = text(body.name, 80), email = text(body.email, 254).toLowerCase(), phone = text(body.phone, 24);
  if (name.length < 2) return reply(400, { error: 'invalid_name' });
  if (!EMAIL.test(email)) return reply(400, { error: 'invalid_email' });
  if (phone && !PHONE.test(phone)) return reply(400, { error: 'invalid_phone' });
  const kind = body.kind === 'books' || body.kind === 'cakes' ? body.kind : null;
  if (!kind) return reply(400, { error: 'invalid_kind' });
  if (!ready[kind]) return reply(503, { error: 'payments_unavailable' });

  // Same e-mail as an Anacan account → link the order to it.
  const { data: profile } = await admin.from('profiles').select('user_id').ilike('email', email).limit(1).maybeSingle();
  const userId: string | null = profile?.user_id ?? null;
  const since = new Date(Date.now() - 60 * 60_000).toISOString();

  if (kind === 'books') {
    const ids = Array.isArray(body.book_ids) ? [...new Set(body.book_ids.filter((id): id is string => typeof id === 'string' && /^[0-9]m?_[0-9]{2}$/.test(id)))] : [];
    if (ids.length < 1 || ids.length > MAX_BOOKS_PER_ORDER || ids.length !== (body.book_ids as unknown[]).length) return reply(400, { error: 'invalid_books' });
    const { data: books } = await admin.from('book_catalog').select('id').in('id', ids).eq('active', true);
    if ((books?.length ?? 0) !== ids.length) return reply(400, { error: 'unknown_books' });
    const { count } = await admin.from('book_orders').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since);
    if ((count ?? 0) >= 6) return reply(429, { error: 'too_many_requests' });
    const unit = bookUnitPrice(ids.length), amount = bookOrderTotal(ids.length);
    const { data: order, error } = await admin.from('book_orders').insert({
      user_id: userId, email, book_ids: ids, unit_price: unit, amount, language: 'az', channel: 'web', customer_name: name, customer_phone: phone || null,
    }).select('id').single();
    if (error || !order) return reply(500, { error: 'order_not_saved' });
    return await startPayment('book_orders', order.id, amount, `Anacan — ${ids.length} PDF kitab`, 'kitablar', { unit_price: unit });
  }

  // Cakes
  const items = Array.isArray(body.items) ? body.items.slice(0, 11) : [];
  if (items.length < 1 || items.length > 10) return reply(400, { error: 'invalid_items' });
  const cakeIds = [...new Set(items.map((item) => (item as Record<string, unknown>)?.cake_id).filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
  const { data: cakes } = await admin.from('cakes').select('id,name,price,category').in('id', cakeIds).eq('is_active', true);
  const byId = new Map((cakes || []).map((cake: { id: string }) => [cake.id, cake]));
  let total = 0;
  const lines: Record<string, unknown>[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const cake = byId.get(item?.cake_id as string) as { id: string; name: string; price: number; category: string } | undefined;
    const qty = Number(item?.qty);
    if (!cake || !Number.isInteger(qty) || qty < 1 || qty > 5) return reply(400, { error: 'invalid_items' });
    const flavor = FLAVORS.includes(item.flavor as string) ? item.flavor as string : FLAVORS[0];
    const bento = cake.category === 'month' || /bento/i.test(cake.name);
    const photoBox = item.photo_box === true && bento;
    const fields: Record<string, string> = {};
    if (item.fields && typeof item.fields === 'object') {
      for (const [key, value] of Object.entries(item.fields as Record<string, unknown>).slice(0, 4)) {
        const label = text(key, 40), v = text(value, 60);
        if (label && v) fields[label] = v;
      }
    }
    const unit = Number(cake.price) + (photoBox ? PHOTO_BOX_EXTRA : 0);
    total += unit * qty;
    lines.push({ cake_id: cake.id, name: cake.name, qty, unit_price: unit, flavor, photo_box: photoBox, fields });
  }
  total = Math.round(total * 100) / 100;
  const date = text(body.delivery_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < bakuDate(2) || date > bakuDate(60)) return reply(400, { error: 'invalid_date' });
  const slot = SLOTS.includes(body.slot as string) ? body.slot as string : SLOTS[0];
  const mode = body.mode === 'pickup' ? 'pickup' : 'delivery';
  const address = text(body.address, 200);
  if (mode === 'delivery' && address.length < 5) return reply(400, { error: 'invalid_address' });
  if (!phone) return reply(400, { error: 'invalid_phone' });
  const { count } = await admin.from('cake_orders').select('id', { count: 'exact', head: true }).eq('customer_email', email).gte('created_at', since);
  if ((count ?? 0) >= 5) return reply(429, { error: 'too_many_requests' });
  const summary = lines.map((line) => `${line.name} x${line.qty}`).join(', ');
  const modeLabel = mode === 'delivery' ? 'Çatdırılma' : 'Özüm götürəcəm';
  const flat: Record<string, string> = { payment_method: 'Kart (Epoint, sayt)', delivery_mode: modeLabel, delivery_slot: slot };
  for (const line of lines) {
    const prefix = String(line.name);
    flat[`${prefix} - Dad`] = String(line.flavor);
    if (line.photo_box) flat[`${prefix} - Əlavə`] = 'Foto qutusu (+6 kapkeyk)';
    for (const [k, v] of Object.entries(line.fields as Record<string, string>)) flat[`${prefix} - ${k}`] = v;
  }
  const { data: order, error } = await admin.from('cake_orders').insert({
    user_id: userId, channel: 'web', cake_id: lines[0].cake_id, customer_name: name, customer_email: email, contact_phone: phone,
    custom_text: summary, custom_fields: { ...flat, items: lines }, notes: `${text(body.notes, 500)} [${modeLabel} · ${slot}] [Kart (Epoint) ödəniş]`.trim(),
    delivery_date: date, delivery_address: mode === 'delivery' ? address : null, total_price: total,
    status: 'pending', payment_method: 'epoint', payment_status: 'pending',
  }).select('id').single();
  if (error || !order) return reply(500, { error: 'order_not_saved' });
  return await startPayment('cake_orders', order.id, total, `Anacan — ${lines.length} tort sifarişi`, 'tortlar', {});

  async function startPayment(table: 'book_orders' | 'cake_orders', orderId: string, amount: number, description: string, page: string, extra: Record<string, unknown>) {
    try {
      const { ok, httpStatus, result } = await epointRequest(config, 'request', {
        amount: amount.toFixed(2), currency: 'AZN', language: 'az', order_id: orderId, description,
        success_redirect_url: `${SITE}/az/${page}/?odenis=ugurlu&sifaris=${orderId}`,
        error_redirect_url: `${SITE}/az/${page}/?odenis=xeta&sifaris=${orderId}`,
      });
      const url = typeof result.redirect_url === 'string' ? result.redirect_url : '';
      if (!ok || result.status !== 'success' || !isCheckoutUrl(url)) {
        // Provider answer only (no keys, card or customer data): http status, Epoint status/message, redirect host.
        console.error('[web-shop] epoint request rejected:', JSON.stringify({ http: httpStatus, status: result.status ?? null, message: typeof result.message === 'string' ? result.message.slice(0, 120) : null, host: url ? url.split('/')[2] : null }));
        throw new Error('epoint_no_url');
      }
      const transaction = typeof result.transaction === 'string' ? result.transaction.slice(0, 128) : null;
      await admin.from(table).update({ provider_transaction: transaction, updated_at: new Date().toISOString() }).eq('id', orderId);
      return reply(200, { checkout_url: url, order_id: orderId, amount, ...extra });
    } catch (e) {
      console.error('[web-shop] payment start failed:', e instanceof Error ? e.message : 'unknown');
      if (table === 'book_orders') await admin.from('book_orders').update({ status: 'failed', provider_status: 'request_failed', updated_at: new Date().toISOString() }).eq('id', orderId);
      else await admin.from('cake_orders').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('id', orderId);
      return reply(502, { error: 'checkout_unavailable' });
    }
  }
});
