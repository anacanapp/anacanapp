// book-admin — support actions for printable books (admins only):
//   { action: 'resend_email', order_id }                 → new download token + e-mail with links
//   { action: 'grant', email, book_ids, note }            → gift books to an account (order provider 'admin', 0 AZN)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdmin } from '../_shared/auth.ts';
import { emailBookLinks } from '../_shared/book-result.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const BOOK_ID = /^[0-9]m?_[0-9]{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_payload' }); }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body.action === 'resend_email') {
    const orderId = typeof body.order_id === 'string' ? body.order_id : '';
    const { data: order } = await admin.from('book_orders').select('id,user_id,email,book_ids,status').eq('id', orderId).maybeSingle();
    if (!order || order.status !== 'paid') return json(404, { error: 'paid_order_not_found' });
    return json(200, { sent: await emailBookLinks(admin, order) });
  }

  if (body.action === 'grant') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const ids = Array.isArray(body.book_ids) ? [...new Set(body.book_ids.filter((id): id is string => typeof id === 'string' && BOOK_ID.test(id)))] : [];
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
    if (!email || !ids.length || ids.length > 70) return json(400, { error: 'invalid_grant' });
    const { data: profile } = await admin.from('profiles').select('user_id').ilike('email', email).maybeSingle();
    if (!profile?.user_id) return json(404, { error: 'user_not_found' });
    const { data: books } = await admin.from('book_catalog').select('id').in('id', ids);
    if ((books?.length ?? 0) !== ids.length) return json(400, { error: 'unknown_books' });
    const now = new Date().toISOString();
    const { data: order, error } = await admin.from('book_orders').insert({
      user_id: profile.user_id, email, book_ids: ids, unit_price: 0, amount: 0, status: 'paid', provider: 'admin',
      paid_at: now, granted_by: auth.userId, admin_note: note || null,
    }).select('id,user_id,email,book_ids').single();
    if (error || !order) return json(500, { error: 'grant_failed' });
    await admin.from('book_entitlements').upsert(ids.map(bookId => ({ user_id: profile.user_id, book_id: bookId, order_id: order.id })),
      { onConflict: 'user_id,book_id', ignoreDuplicates: true });
    return json(200, { order_id: order.id, sent: await emailBookLinks(admin, order) });
  }
  return json(400, { error: 'unknown_action' });
});
