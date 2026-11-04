// Applies a verified Epoint result to a printable-book order. Used by epoint-result and by the shared
// epoint-payment callback (Epoint has one Result URL per merchant), after the signature was checked.
// The payment is re-confirmed with get-status and the amount must equal the order before anything is granted.
import { epointRequest, type EpointConfig } from './epoint.ts';
import { sendBooksEmail } from './book-email.ts';

const PUBLIC_FUNCTIONS = Deno.env.get('BOOKS_PUBLIC_FUNCTIONS_URL') || 'https://api.anacan.az/functions/v1';
const COVERS = Deno.env.get('BOOKS_PUBLIC_COVERS_URL') || 'https://api.anacan.az/storage/v1/object/public/book-covers';
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
export async function isBookOrder(admin: any, orderId: unknown): Promise<boolean> {
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return false;
  const { data } = await admin.from('book_orders').select('id').eq('id', orderId).maybeSingle();
  return !!data;
}

/** Mints a fresh download token for a paid order and e-mails the links (also used for "resend"). */
// deno-lint-ignore no-explicit-any
export async function emailBookLinks(admin: any, order: { id: string; user_id: string; email: string; book_ids: string[] }): Promise<boolean> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await admin.from('book_orders').update({ download_token_hash: await sha256Hex(token), updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'paid');
  if (error) return false;
  const { data: books } = await admin.from('book_catalog').select('id,title,cover_path').in('id', order.book_ids).order('sort_order');
  const sent = await sendBooksEmail({ userId: order.user_id, to: order.email, orderId: order.id, token, functionsUrl: PUBLIC_FUNCTIONS,
    books: (books ?? []).map((book: { id: string; title: string; cover_path: string }) => ({ id: book.id, title: book.title, cover: `${COVERS}/${String(book.cover_path).replace(/^covers\//, '')}` })) });
  if (sent) await admin.from('book_orders').update({ email_sent_at: new Date().toISOString() }).eq('id', order.id);
  return sent;
}

export type BookResult = 'paid' | 'duplicate' | 'failed' | 'not_found' | 'not_confirmed' | 'grant_failed';

// deno-lint-ignore no-explicit-any
export async function applyBookPaymentResult(admin: any, config: EpointConfig, payload: Record<string, unknown>): Promise<BookResult> {
  const orderId = typeof payload.order_id === 'string' && ORDER_ID.test(payload.order_id) ? payload.order_id : null;
  if (!orderId) return 'not_found';
  const { data: order } = await admin.from('book_orders').select('id,user_id,email,book_ids,amount,status').eq('id', orderId).maybeSingle();
  if (!order) return 'not_found';
  if (order.status === 'paid') return 'duplicate';
  const now = new Date().toISOString();
  if (payload.status !== 'success') {
    await admin.from('book_orders').update({ status: 'failed', provider_status: String(payload.status ?? 'unknown').slice(0, 40), updated_at: now }).eq('id', orderId).eq('status', 'pending');
    return 'failed';
  }
  const { result: status } = await epointRequest(config, 'get-status', { order_id: orderId });
  const paid = Number(status.amount ?? payload.amount);
  if (status.status !== 'success' || !Number.isFinite(paid) || Math.abs(paid - Number(order.amount)) > 0.001) return 'not_confirmed';

  const { data: updated } = await admin.from('book_orders').update({
    status: 'paid', paid_at: now, updated_at: now, provider_status: 'success',
    provider_transaction: typeof payload.transaction === 'string' ? payload.transaction.slice(0, 128) : null,
  }).eq('id', orderId).eq('status', 'pending').select('id');
  if (!updated?.length) return 'duplicate';
  const grants = (order.book_ids as string[]).map(bookId => ({ user_id: order.user_id, book_id: bookId, order_id: orderId }));
  const { error } = await admin.from('book_entitlements').upsert(grants, { onConflict: 'user_id,book_id', ignoreDuplicates: true });
  if (error) return 'grant_failed';
  // Server-side purchase event (internal analytics): the client cannot see the payment itself.
  await admin.from('analytics_events').insert({ user_id: order.user_id, event_name: 'books_purchase_completed', event_category: 'commerce', platform: 'server',
    event_data: { order_id: orderId, book_count: (order.book_ids as string[]).length, value: Number(order.amount), currency: 'AZN' } });
  await emailBookLinks(admin, order);
  return 'paid';
}
