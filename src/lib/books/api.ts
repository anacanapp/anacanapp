import { supabase } from '@/integrations/supabase/client';

export interface OwnedBook { book_id: string; granted_at: string; order_id: string }

export async function fetchBookPaymentsReady(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('book-checkout', { method: 'GET' });
    return !error && (data as { ready?: boolean } | null)?.ready === true;
  } catch { return false; }
}

export async function fetchMyBooks(): Promise<OwnedBook[]> {
  const { data, error } = await (supabase.rpc as any)('my_books_v1');
  if (error) throw error;
  return (data ?? []) as OwnedBook[];
}

export type CheckoutResult =
  | { ok: true; url: string; orderId: string }
  | { ok: false; reason: 'unavailable' | 'owned' | 'error'; owned?: string[] };

export async function startBookCheckout(bookIds: string[], language: string): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('book-checkout', { body: { book_ids: bookIds, language } });
  if (!error && typeof data?.checkout_url === 'string') return { ok: true, url: data.checkout_url, orderId: data.order_id };
  let body: any = null;
  try { body = await (error as any)?.context?.json?.(); } catch { /* not json */ }
  if (body?.error === 'payments_unavailable') return { ok: false, reason: 'unavailable' };
  if (body?.error === 'already_owned') return { ok: false, reason: 'owned', owned: body.book_ids ?? [] };
  return { ok: false, reason: 'error' };
}

export async function bookDownloadUrl(bookId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('book-download', { body: { book_id: bookId } });
  return !error && typeof data?.url === 'string' ? data.url : null;
}

/** Opens a URL outside the app WebView (payment page, PDF). */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

const CART_KEY = 'anacan_books_cart_v1';
export function readCart(): string[] {
  try { const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(value) ? value.filter(id => typeof id === 'string') : []; } catch { return []; }
}
export function writeCart(ids: string[]) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch { /* private mode */ }
}
