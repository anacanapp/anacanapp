/** Web shop data for anacan.az (Azerbaijani only): public catalogue reads and the web-shop checkout.
 * Prices shown here are previews; the web-shop function always recomputes them on the server. */

export type ShopKind = 'books' | 'cakes';
export const SHOP_FUNCTION = 'https://api.anacan.az/functions/v1/web-shop';

export interface ShopBook { id: string; age_group: string; title: string; subtitle?: string | null; about?: string | null; skills?: string[] | null; pages: number; size_mb?: number | null; cover_path: string }
export interface ShopCake { id: string; name: string; description?: string | null; price: number; image_url?: string | null; category: string; month_number?: number | null; milestone_label?: string | null; milestone_type?: string | null; has_custom_fields?: boolean; custom_field_labels?: string[] | null }
export interface CakeLine { cake_id: string; name: string; price: number; image_url?: string | null; flavor: string; photo_box: boolean; qty: number; fields: Record<string, string> }

interface PublicBackend { schema: string; project: string; url: string; publishableKey: string }
let backend: Promise<PublicBackend> | undefined;
export function shopBackend() {
  backend ||= fetch('/website/backend.json', { credentials: 'omit', redirect: 'error', cache: 'no-cache' }).then(async (response) => {
    const value = await response.json();
    if (!response.ok || value.schema !== 'anacan-website-backend-v1' || value.url !== 'https://gcp.anacan.az') throw new Error('WEBSITE_GOOGLE_CONFIGURATION_INVALID');
    return value as PublicBackend;
  });
  return backend;
}

export async function readShopCatalog<T>(kind: ShopKind): Promise<T[]> {
  const config = await shopBackend();
  const path = kind === 'books'
    ? '/rest/v1/book_catalog?select=id,age_group,title,subtitle,about,skills,pages,size_mb,cover_path&active=eq.true&order=sort_order'
    : '/rest/v1/cakes?select=id,name,description,price,image_url,category,month_number,milestone_label,milestone_type,has_custom_fields,custom_field_labels&is_active=eq.true&order=sort_order';
  const response = await fetch(config.url + path, { credentials: 'omit', redirect: 'error', headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}` } });
  if (!response.ok) throw new Error('WEBSITE_SHOP_READ_UNAVAILABLE');
  const values = await response.json();
  if (!Array.isArray(values)) throw new Error('WEBSITE_SHOP_READ_INVALID');
  return values as T[];
}

/** Whether card payment is live for this kind (false while the function is switched off). */
export async function readShopReady(kind: ShopKind): Promise<boolean> {
  try {
    const response = await fetch(SHOP_FUNCTION, { method: 'GET', credentials: 'omit' });
    if (!response.ok) return false;
    const value = await response.json();
    return !!value?.[kind]?.ready;
  } catch { return false; }
}

/** Epoint opens its acquiring bank's page (e.g. https://ecomm.pashabank.az/...), not only *.epoint.az. */
export function isCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'epoint.az' || url.hostname.endsWith('.az'));
  } catch { return false; }
}

export async function startShopCheckout(body: Record<string, unknown>): Promise<{ url?: string; error?: string; status: number }> {
  try {
    const response = await fetch(SHOP_FUNCTION, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    const url = isCheckoutUrl(value?.checkout_url) ? value.checkout_url : undefined;
    return { url, error: typeof value?.error === 'string' ? value.error : undefined, status: response.status };
  } catch { return { error: 'network', status: 0 }; }
}

// ---------- pricing previews (server is authoritative) ----------
export const bookUnit = (n: number) => n >= 10 ? 2 : n >= 5 ? 2.6 : n >= 3 ? 3 : 4;
export const bookTotal = (n: number) => Math.round(bookUnit(n) * n * 100) / 100;
export const nextTier = (n: number) => [3, 5, 10].find((tier) => n < tier) ?? null;
export const PHOTO_BOX = { extra: 18, image: 'https://api.anacan.az/storage/v1/object/public/assets/cakes/cake-1793813000-pkg-foto-qutusu.jpg' };
export const FLAVORS = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
export const cakeUnit = (line: CakeLine) => Number(line.price) + (line.photo_box ? PHOTO_BOX.extra : 0);
export const isBento = (cake: ShopCake) => cake.category === 'month' || /bento/i.test(cake.name || '');
export const money = (value: number) => { const n = Math.round(value * 100) / 100; return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' ₼'; };
export const coverUrl = (book: ShopBook) => 'https://gcp.anacan.az/storage/v1/object/public/book-covers/' + encodeURIComponent(String(book.cover_path || '').split('/').pop() || '');

export const BOOK_AGES: Array<[string, string]> = [['all', 'Hamısı'], ['6m', '6 ay+'], ['1y', '1 yaş'], ['2y', '2 yaş'], ['3y', '3 yaş'], ['4y', '4 yaş'], ['5y', '5 yaş'], ['6y', '6 yaş']];
export const CAKE_CATEGORIES: Array<[string, string]> = [['all', 'Hamısı'], ['month', 'Aylıq'], ['milestone', 'Xüsusi günlər'], ['pregnancy', 'Hamiləlik'], ['family', 'Ailə və bayram']];
export const ageLabel = (age: string) => BOOK_AGES.find(([key]) => key === age)?.[1] || age;
export const cakeCategory = (cake: ShopCake) => ['month', 'milestone', 'pregnancy', 'family'].includes(cake.category) ? cake.category : 'milestone';
export const cakeTag = (cake: ShopCake) => cake.category === 'month' && cake.month_number ? (cake.month_number === 12 ? '1 yaş' : `${cake.month_number}-ci ay`) : (cake.milestone_label || '');
export function cakeSpecs(description?: string | null): Array<[string, string]> {
  const text = description || '', out: Array<[string, string]> = [];
  const size = text.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*sm\b/i); if (size) out.push(['ölçü', size[1].replace(/\s+/g, '') + ' sm']);
  const weight = text.match(/(~?\s*\d+(?:[.,]\d+)?)\s*(kq|q)\b/i); if (weight) out.push(['çəki', weight[1].replace(/\s+/g, '') + ' ' + weight[2]]);
  const people = text.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*nəfər/i); if (people) out.push(['nəfərlik', people[1].replace(/\s+/g, '')]);
  return out;
}
export const cakeStory = (description?: string | null) => String(description || '').replace(/\s*\d+(?:\s*[–-]\s*\d+)?\s*sm,?\s*~?\s*[\d.,]*\s*(?:kq|q)?,?\s*\d*(?:\s*[–-]\s*\d+)?\s*nəfərlik\.?/i, '').trim();

/** Delivery days: from the day after tomorrow (48 hours), twelve days, Baku time. */
export function shopDays(): string[] {
  const days: string[] = [];
  for (let i = 2; i < 14; i++) days.push(new Date(Date.now() + 4 * 3600_000 + i * 86400_000).toISOString().slice(0, 10));
  return days;
}
export const WEEKDAYS = ['B.', 'B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.'];
