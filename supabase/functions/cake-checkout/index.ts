// cake-checkout — in-app cake orders, paid only by card through Epoint (owner decision 2026-11-06:
// no cash, no card-to-card). Prices come from the cakes table (never the client), the order is saved as
// channel 'app' / payment_method 'epoint' / payment_status 'pending', and only the signed Epoint callback
// (epoint-payment → _shared/web-cake-result.ts) marks it paid. Optional QayğıCash bonus is reserved here and
// committed by the callback; a failed payment cancels the order, which releases the bonus.
// GET → { ready } (card payments live for cakes).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireUser } from '../_shared/auth.ts';
import { epointConfig, epointRequest, isCheckoutUrl } from '../_shared/epoint.ts';
import { qcErrorCode } from '../_shared/qaygicash.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const APP = 'https://app.anacan.az';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const FLAVORS = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
const SLOTS = ['10:00–13:00', '14:00–18:00'];
const PHOTO_BOX_EXTRA = 18;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bakuDate = (offsetDays: number) => new Date(Date.now() + 4 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
// Epoint's payment page speaks az, en and ru.
const epointLanguage = (lang: string) => lang === 'az' ? 'az' : ['ru', 'kk', 'uz', 'ky'].includes(lang) ? 'ru' : 'en';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const config = await epointConfig(admin);
  const ready = config.merchantLive;
  if (req.method === 'GET') return json(200, { ready, provider: 'epoint' });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!ready) return json(503, { error: 'payments_unavailable' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 16_384) return json(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch { return json(400, { error: 'invalid_payload' }); }
  const userId = auth.user.id;

  // Lines, priced from the catalogue.
  const items = Array.isArray(body.items) ? body.items.slice(0, 11) : [];
  if (items.length < 1 || items.length > 10) return json(400, { error: 'invalid_items' });
  const cakeIds = [...new Set(items.map((item) => (item as Record<string, unknown>)?.cake_id).filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
  const { data: cakes } = await admin.from('cakes').select('id,name,price,category,month_number').in('id', cakeIds).eq('is_active', true);
  const byId = new Map((cakes || []).map((cake: { id: string }) => [cake.id, cake]));
  let totalMinor = 0;
  const lines: Record<string, unknown>[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const cake = byId.get(item?.cake_id as string) as { id: string; name: string; price: number; category: string; month_number: number | null } | undefined;
    const qty = Number(item?.qty);
    if (!cake || !Number.isInteger(qty) || qty < 1 || qty > 5) return json(400, { error: 'invalid_items' });
    const bento = cake.category === 'month' || /bento/i.test(cake.name);
    const photoBox = item.photo_box === true && bento;
    const fields: Record<string, string> = {};
    if (item.fields && typeof item.fields === 'object') {
      for (const [key, value] of Object.entries(item.fields as Record<string, unknown>).slice(0, 8)) {
        const label = text(key, 40), v = text(value, 80);
        if (label && v) fields[label] = v;
      }
    }
    const flavor = FLAVORS.includes(fields['Dad']) ? fields['Dad'] : FLAVORS[0];
    const unitMinor = Math.round((Number(cake.price) + (photoBox ? PHOTO_BOX_EXTRA : 0)) * 100);
    totalMinor += unitMinor * qty;
    lines.push({ cake_id: cake.id, name: cake.name, qty, unit_price: unitMinor / 100, flavor, photo_box: photoBox, fields, month: cake.month_number });
  }

  const name = text(body.customer_name, 80);
  const phone = text(body.contact_phone, 20);
  const date = text(body.delivery_date, 10);
  const slot = SLOTS.includes(body.slot as string) ? body.slot as string : SLOTS[0];
  const mode = body.mode === 'pickup' ? 'pickup' : 'delivery';
  const address = text(body.delivery_address, 200);
  const language = text(body.language, 5) || 'az';
  if (name.length < 2) return json(400, { error: 'invalid_name' });
  if (!PHONE.test(phone)) return json(400, { error: 'invalid_phone' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < bakuDate(2) || date > bakuDate(60)) return json(400, { error: 'invalid_date' });
  if (mode === 'delivery' && address.length < 5) return json(400, { error: 'invalid_address' });

  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await admin.from('cake_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= 6) return json(429, { error: 'too_many_requests' });

  const wanted = typeof body.cashback === 'number' && Number.isFinite(body.cashback) ? Math.round(body.cashback * 100) : 0;
  const cashbackMinor = wanted > 0 && wanted < totalMinor ? wanted : 0;
  if (wanted !== 0 && cashbackMinor === 0) return json(400, { error: 'invalid_cashback' });
  const amountMinor = totalMinor - cashbackMinor;

  const { data: account } = await admin.auth.admin.getUserById(userId);
  const summary = lines.map((line) => `${line.name} x${line.qty}`).join(', ');
  const modeLabel = mode === 'delivery' ? 'Çatdırılma' : 'Özüm götürəcəm';
  const flat: Record<string, string> = { payment_method: 'Kart (Epoint)', delivery_mode: modeLabel, delivery_slot: slot };
  for (const line of lines) {
    const prefix = String(line.name);
    if (line.photo_box) flat[`${prefix} - Əlavə`] = 'Foto qutusu (+6 kapkeyk)';
    for (const [k, v] of Object.entries(line.fields as Record<string, string>)) flat[`${prefix} - ${k}`] = v;
  }
  const notes = text(body.notes, 500);
  const { data: order, error } = await admin.from('cake_orders').insert({
    user_id: userId, channel: 'app', cake_id: lines[0].cake_id, customer_name: name,
    customer_email: (account?.user?.email || '').trim().toLowerCase() || null, contact_phone: phone,
    child_name: text(body.child_name, 60) || null, child_age_months: (lines[0].month as number | null) ?? null,
    custom_text: summary, custom_fields: { ...flat, items: lines },
    notes: `${notes} [${modeLabel} · ${slot}] [Kart (Epoint) ödəniş]`.trim(),
    delivery_date: date, delivery_address: mode === 'delivery' ? address : null,
    total_price: amountMinor / 100, cashback_used: cashbackMinor / 100,
    status: 'pending', payment_method: 'epoint', payment_status: 'pending',
  }).select('id').single();
  if (error || !order) {
    console.error('[cake-checkout] order not saved:', error?.message?.slice(0, 120));
    return json(500, { error: 'order_not_saved' });
  }
  const cancel = () => admin.from('cake_orders').update({ status: 'cancelled', payment_status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id);

  if (cashbackMinor > 0) {
    const { error: qcError } = await admin.rpc('qc_reserve_cake_epoint_v1',
      { p_user: userId, p_order_id: order.id, p_amount_minor: cashbackMinor, p_total_minor: totalMinor });
    if (qcError) {
      await cancel();
      return json(409, { error: qcErrorCode(qcError) ?? 'QC_NOT_AVAILABLE' });
    }
  }

  try {
    const { ok, httpStatus, result } = await epointRequest(config, 'request', {
      amount: (amountMinor / 100).toFixed(2), currency: 'AZN', language: epointLanguage(language), order_id: order.id,
      description: `Anacan — ${lines.length} tort sifarişi`,
      success_redirect_url: `${APP}/payment/success?kind=cakes&order=${order.id}`,
      error_redirect_url: `${APP}/payment/error?kind=cakes&order=${order.id}`,
    });
    const url = typeof result.redirect_url === 'string' ? result.redirect_url : '';
    if (!ok || result.status !== 'success' || !isCheckoutUrl(url)) {
      console.error('[cake-checkout] epoint request rejected:', JSON.stringify({ http: httpStatus, status: result.status ?? null }));
      throw new Error('epoint_no_url');
    }
    await admin.from('cake_orders').update({ provider_transaction: typeof result.transaction === 'string' ? result.transaction.slice(0, 128) : null,
      updated_at: new Date().toISOString() }).eq('id', order.id);
    return json(200, { checkout_url: url, order_id: order.id, amount: amountMinor / 100, cashback: cashbackMinor / 100 });
  } catch (e) {
    console.error('[cake-checkout] create failed:', e instanceof Error ? e.message : 'unknown');
    await cancel();
    return json(502, { error: 'checkout_unavailable' });
  }
});
