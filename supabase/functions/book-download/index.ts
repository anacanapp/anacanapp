// book-download — hands out a short-lived signed URL for a purchased PDF.
//   POST (signed-in, from "Kitablarım"): { book_id } → { url } when the caller owns the book.
//   GET  (e-mail link): ?o=<order>&t=<token>&b=<book> → 302 to the signed URL when the token matches
//        the paid order's stored hash and the book belongs to that order.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireUser } from '../_shared/auth.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const BOOK_ID = /^[0-9]m?_[0-9]{2}$/;
const SIGNED_SECONDS = 15 * 60;
async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
function downloadPage(url: string, title: string) {
  const href = escapeHtml(url), name = escapeHtml(title);
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${href}"><title>${name} — Anacan</title></head>
<body style="margin:0;background:#FFF7F3;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="background:#fff;border-radius:20px;padding:28px;max-width:420px;text-align:center"><div style="font:800 20px Arial;color:#333">📚 ${name}</div>
<p style="color:#666;font-size:14px;line-height:1.5">PDF yüklənir. Başlamasa, düyməyə toxunun.</p>
<a href="${href}" style="display:inline-block;background:#FF5A5F;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">PDF yüklə</a></div></body></html>`;
}

async function signedUrl(admin: ReturnType<typeof createClient>, bookId: string): Promise<string | null> {
  const { data: book } = await admin.from('book_catalog').select('pdf_path').eq('id', bookId).maybeSingle();
  if (!book?.pdf_path) return null;
  const fileName = String(book.pdf_path).split('/').pop() || `${bookId}.pdf`;
  const { data } = await admin.storage.from('book-pdfs').createSignedUrl(book.pdf_path, SIGNED_SECONDS, { download: `Anacan-${fileName}` });
  return data?.signedUrl ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('o') || '', token = url.searchParams.get('t') || '', bookId = url.searchParams.get('b') || '';
    if (!/^[0-9a-f-]{36}$/.test(orderId) || token.length < 20 || token.length > 128 || !BOOK_ID.test(bookId)) return json(400, { error: 'invalid_link' });
    const { data: order } = await admin.from('book_orders').select('status,book_ids,download_token_hash').eq('id', orderId).maybeSingle();
    if (!order || order.status !== 'paid' || !order.download_token_hash || order.download_token_hash !== await sha256(token)
      || !(order.book_ids as string[]).includes(bookId)) return json(404, { error: 'not_found' });
    const target = await signedUrl(admin, bookId);
    if (!target) return json(503, { error: 'file_unavailable' });
    // The functions router passes only 2xx responses through, so the e-mail link answers with a tiny
    // page that moves straight on to the short-lived signed PDF URL (with a button as a fallback).
    const { data: book } = await admin.from('book_catalog').select('title').eq('id', bookId).maybeSingle();
    return new Response(downloadPage(target, String(book?.title ?? 'Anacan')), { status: 200, headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' } });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_payload' }); }
  const bookId = typeof body.book_id === 'string' && BOOK_ID.test(body.book_id) ? body.book_id : null;
  if (!bookId) return json(400, { error: 'invalid_book' });
  const { data: owned } = await admin.from('book_entitlements').select('book_id').eq('user_id', auth.user.id).eq('book_id', bookId).maybeSingle();
  if (!owned) return json(403, { error: 'not_owned' });
  const target = await signedUrl(admin, bookId);
  return target ? json(200, { url: target, expires_in: SIGNED_SECONDS }) : json(503, { error: 'file_unavailable' });
});
