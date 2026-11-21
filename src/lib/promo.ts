import { supabase } from '@/integrations/supabase/client';

// QR Premium campaigns (docs/PROMO_QR.md). A QR opens https://app.anacan.az/h/<CODE>; the code is kept on the
// device until the person is signed in, then promo-redeem grants the campaign's RevenueCat promotional Premium.

export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
export const PROMO_DURATIONS = ['weekly', 'monthly', 'two_month', 'three_month', 'six_month', 'yearly', 'lifetime'] as const;
export type PromoDuration = typeof PROMO_DURATIONS[number];
export type PromoState = 'active' | 'inactive' | 'not_started' | 'expired' | 'full';
export interface PromoCampaignPublic { found: boolean; code?: string; title?: string; duration?: PromoDuration; eligibility?: 'new_users' | 'everyone'; state?: PromoState }

export type PromoErrorCode = 'PROMO_NOT_FOUND' | 'PROMO_INACTIVE' | 'PROMO_NOT_STARTED' | 'PROMO_EXPIRED' | 'PROMO_FULL'
  | 'PROMO_ALREADY_USED' | 'PROMO_NOT_NEW_USER' | 'PROMO_IN_PROGRESS' | 'premium_store_subscription_active' | 'grant_failed';
export type PromoResult = { ok: true; duration: PromoDuration; title: string | null; expires_at: string | null } | { ok: false; code: PromoErrorCode };

const ERROR_CODES: PromoErrorCode[] = ['PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_NOT_STARTED', 'PROMO_EXPIRED', 'PROMO_FULL',
  'PROMO_ALREADY_USED', 'PROMO_NOT_NEW_USER', 'PROMO_IN_PROGRESS', 'premium_store_subscription_active', 'grant_failed'];
/** Errors that will not change by trying again later: the saved code is dropped. */
export const FINAL_ERRORS = new Set<PromoErrorCode>(['PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_EXPIRED', 'PROMO_FULL',
  'PROMO_ALREADY_USED', 'PROMO_NOT_NEW_USER', 'premium_store_subscription_active']);

export const normalizePromoCode = (raw: string | null | undefined): string | null => {
  const code = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return PROMO_CODE_RE.test(code) ? code : null;
};

/** Code from a /h/<CODE> link (web path, universal link or anacan:// scheme). */
export function promoCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://app.anacan.az');
    const path = parsed.protocol === 'anacan:' ? `/${parsed.host}${parsed.pathname}` : parsed.pathname;
    const match = path.match(/^\/h\/([^/?#]+)\/?$/i);
    return match ? normalizePromoCode(decodeURIComponent(match[1])) : null;
  } catch { return null; }
}

const KEY = 'anacan:promo-code';
const TTL_MS = 30 * 24 * 3600 * 1000;
export const PROMO_PENDING_EVENT = 'anacan:promo-pending';

export function savePendingPromo(raw: string, now = Date.now()): string | null {
  const code = normalizePromoCode(raw);
  if (!code) return null;
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: now })); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent(PROMO_PENDING_EVENT)); } catch { /* no window */ }
  return code;
}
export function readPendingPromo(now = Date.now()): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { code?: string; at?: number } | null;
    if (!value || typeof value.at !== 'number' || now - value.at > TTL_MS) { if (value) localStorage.removeItem(KEY); return null; }
    return normalizePromoCode(value.code);
  } catch { return null; }
}
export function clearPendingPromo(): void { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

export const promoErrorCode = (value: unknown): PromoErrorCode => {
  const text = typeof value === 'string' ? value : value && typeof value === 'object'
    ? String((value as { error?: unknown; message?: unknown }).error ?? (value as { message?: unknown }).message ?? '') : '';
  return ERROR_CODES.find((code) => text.includes(code)) ?? 'grant_failed';
};

/** The promo RPCs are newer than the generated database types. */
export const promoRpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

export async function fetchPromoCampaign(code: string): Promise<PromoCampaignPublic> {
  const { data, error } = await promoRpc('promo_campaign_public_v1', { p_code: code });
  if (error) throw error;
  return (data ?? { found: false }) as PromoCampaignPublic;
}

export async function redeemPromo(code: string): Promise<PromoResult> {
  try {
    const { data, error } = await supabase.functions.invoke('promo-redeem', { body: { code } });
    const ok = data as { ok?: boolean; duration?: PromoDuration; title?: string | null; expires_at?: string | null } | null;
    if (!error && ok?.ok === true && ok.duration) return { ok: true, duration: ok.duration, title: ok.title ?? null, expires_at: ok.expires_at ?? null };
    let body: unknown = data;
    try { body = await (error as { context?: { json?: () => Promise<unknown> } } | null)?.context?.json?.() ?? body; } catch { /* not JSON */ }
    return { ok: false, code: promoErrorCode(body ?? error) };
  } catch (e) {
    return { ok: false, code: promoErrorCode(e) };
  }
}

type PromoCopy = Record<string, string>;
export const promoDurationLabel = (text: PromoCopy, duration: string | undefined) => text[`d_${duration}`] ?? duration ?? '';
export function promoErrorText(text: PromoCopy, code: PromoErrorCode): string {
  switch (code) {
    case 'PROMO_ALREADY_USED': return text.err_used;
    case 'PROMO_NOT_NEW_USER': return text.err_new;
    case 'PROMO_FULL': return text.err_full;
    case 'PROMO_EXPIRED': case 'PROMO_INACTIVE': return text.err_expired;
    case 'PROMO_NOT_FOUND': case 'PROMO_NOT_STARTED': return text.err_not_found;
    case 'premium_store_subscription_active': return text.err_store;
    default: return text.err_failed;
  }
}
