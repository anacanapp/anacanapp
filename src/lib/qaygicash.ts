// QayğıCash — Anacan's bonus (cashback) programme. Client-side types, parsing and preview math.
// The ledger lives on the server (migration 20261106150000_qaygicash); every number here is a preview
// and the server re-checks it (max share of an order, minimum, available balance) when an order is placed.
// All amounts are integer minor units (qəpik).
import { appLanguageLocale, normalizeAppLanguage, readAppLanguage } from './app-languages';

/** Brand name: never translated. */
export const QC_BRAND = 'QayğıCash';

export type QcEarnChannel = 'premium_yearly' | 'premium_monthly' | 'book' | 'cake' | 'own_shop' | 'partner' | 'affiliate';
export type QcRedeemChannel = 'aptek' | 'cake' | 'book';
export type QcPremiumPlan = 'monthly' | 'yearly';
export type QcPlatform = 'ios' | 'android' | 'web';

export interface QcPremiumRedeem {
  enabled: boolean;
  monthly: { enabled: boolean; price_minor: number | null };
  yearly: { enabled: boolean; price_minor: number | null };
  platforms: Partial<Record<QcPlatform, boolean>>;
}

export interface QcWallet {
  enabled: true;
  status: 'live' | 'paused';
  country: string;
  currency: string;
  available_minor: number;
  pending_minor: number;
  expiring_30d_minor: number;
  next_expiry_at: string | null;
  debt_minor: number;
  /** Basis points per earn channel (500 = 5 %). */
  rates: Partial<Record<QcEarnChannel, number>>;
  hold_days_physical: number;
  hold_days_digital: number;
  expiry_months: number;
  max_redeem_pct: number;
  min_redeem_minor: number;
  redeem_channels: QcRedeemChannel[];
  terms_version: number;
  premium_redeem: QcPremiumRedeem;
  /** Base the store Premium bonus is computed on (rule fixed_base_minor); falls back to QC_PREMIUM_BASE_MINOR. */
  premium_base_minor?: Partial<Record<QcPremiumPlan, number>>;
}
export type QcWalletResult = { enabled: false } | QcWallet;

export type QcEarnStatus = 'pending' | 'available' | 'expired' | 'reversed';
export type QcRedeemStatus = 'reserved' | 'committed' | 'released';
export interface QcHistoryItem {
  id: string;
  type: 'earn' | 'redeem';
  channel: string;
  source_type?: string;
  amount_minor: number;
  remaining_minor?: number;
  rate_bp?: number;
  status: QcEarnStatus | QcRedeemStatus | string;
  at: string;
  available_at?: string;
  expires_at?: string;
}

export const QC_DISABLED: QcWalletResult = { enabled: false };
/** Premium earns on a fixed local base (App Store / Google Play prices differ per storefront). */
export const QC_PREMIUM_BASE_MINOR: Record<QcPremiumPlan, number> = { yearly: 2699, monthly: 399 };
/** Slider step: 0,10 ₼. */
export const QC_STEP_MINOR = 10;

const int = (value: unknown, fallback = 0) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const obj = (value: unknown): Record<string, unknown> => {
  let v = value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
};

/** Normalises qaygicash_wallet_v1. Anything unexpected hides the programme. */
export function parseWallet(raw: unknown): QcWalletResult {
  const w = obj(raw);
  if (w.enabled !== true) return QC_DISABLED;
  const rates: Partial<Record<QcEarnChannel, number>> = {};
  for (const [channel, bp] of Object.entries(obj(w.rates))) rates[channel as QcEarnChannel] = Math.max(0, int(bp));
  const pr = obj(w.premium_redeem), plan = (p: unknown) => {
    const o = obj(p);
    return { enabled: o.enabled === true, price_minor: o.price_minor == null ? null : int(o.price_minor) };
  };
  const platforms = obj(pr.platforms);
  return {
    enabled: true,
    status: w.status === 'paused' ? 'paused' : 'live',
    country: String(w.country || ''),
    currency: String(w.currency || 'AZN'),
    available_minor: Math.max(0, int(w.available_minor)),
    pending_minor: Math.max(0, int(w.pending_minor)),
    expiring_30d_minor: Math.max(0, int(w.expiring_30d_minor)),
    next_expiry_at: typeof w.next_expiry_at === 'string' ? w.next_expiry_at : null,
    debt_minor: Math.max(0, int(w.debt_minor)),
    rates,
    hold_days_physical: Math.max(0, int(w.hold_days_physical, 14)),
    hold_days_digital: Math.max(0, int(w.hold_days_digital, 7)),
    expiry_months: Math.max(1, int(w.expiry_months, 12)),
    max_redeem_pct: Math.min(100, Math.max(0, int(w.max_redeem_pct, 30))),
    min_redeem_minor: Math.max(1, int(w.min_redeem_minor, 100)),
    redeem_channels: (Array.isArray(w.redeem_channels) ? w.redeem_channels : [])
      .filter((c): c is QcRedeemChannel => c === 'aptek' || c === 'cake' || c === 'book'),
    terms_version: Math.max(1, int(w.terms_version, 1)),
    premium_redeem: {
      enabled: pr.enabled === true,
      monthly: plan(pr.monthly),
      yearly: plan(pr.yearly),
      platforms: { ios: platforms.ios === true, android: platforms.android === true, web: platforms.web === true },
    },
    premium_base_minor: {
      ...(int(obj(w.premium_base_minor).yearly) > 0 ? { yearly: int(obj(w.premium_base_minor).yearly) } : {}),
      ...(int(obj(w.premium_base_minor).monthly) > 0 ? { monthly: int(obj(w.premium_base_minor).monthly) } : {}),
    },
  };
}

export function parseHistory(raw: unknown): QcHistoryItem[] {
  let value = raw;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
  if (!Array.isArray(value)) return [];
  return value.map(obj).filter((r) => (r.type === 'earn' || r.type === 'redeem') && typeof r.at === 'string').map((r) => ({
    id: String(r.id ?? `${r.type}-${r.at}`),
    type: r.type as 'earn' | 'redeem',
    channel: String(r.channel || ''),
    source_type: typeof r.source_type === 'string' ? r.source_type : undefined,
    amount_minor: Math.max(0, int(r.amount_minor)),
    remaining_minor: r.remaining_minor == null ? undefined : Math.max(0, int(r.remaining_minor)),
    rate_bp: r.rate_bp == null ? undefined : int(r.rate_bp),
    status: String(r.status || ''),
    at: r.at as string,
    available_at: typeof r.available_at === 'string' ? r.available_at : undefined,
    expires_at: typeof r.expires_at === 'string' ? r.expires_at : undefined,
  }));
}

// ── Money and numbers ────────────────────────────────────────────────────────────────────

const locale = (language?: string) => appLanguageLocale(normalizeAppLanguage(language || readAppLanguage()));

/** 134 → "1,34 ₼" (locale digits and separators, always two decimals). */
export function formatQc(minor: number, language?: string): string {
  const n = new Intl.NumberFormat(locale(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(minor) / 100);
  return `${n}\u00a0₼`;
}
/** Signed amount for history and summary rows: "+1,34 ₼" / "−1,34 ₼". */
export function formatQcSigned(minor: number, language?: string): string {
  if (minor === 0) return formatQc(0, language);
  return `${minor > 0 ? '+' : '−'}${formatQc(Math.abs(minor), language)}`;
}
/** 500 bp → "5%", 250 bp → "2,5%". */
export function formatRate(bp: number, language?: string): string {
  return new Intl.NumberFormat(locale(language), { style: 'percent', maximumFractionDigits: 1 }).format(bp / 10000);
}
/** Short date ("20 noy"); the year is added when it is not the current one. */
export function formatQcDate(at: string | Date, language?: string, now = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(locale(language), opts);
}

export const toMinor = (azn: number) => Math.round((Number(azn) || 0) * 100);
export const toAzn = (minor: number) => Math.round(minor) / 100;

// ── Earning ──────────────────────────────────────────────────────────────────────────────

/** Bonus for a paid amount: floor(amount × rate), never more than the rate (same rounding as the server). */
export function earnPreview(amountMinor: number, rateBp: number | undefined | null): number {
  if (!rateBp || rateBp <= 0 || !(amountMinor > 0)) return 0;
  return Math.floor((Math.floor(amountMinor) * rateBp) / 10000);
}

export const rateOf = (wallet: QcWalletResult | undefined, channel: QcEarnChannel): number =>
  wallet?.enabled ? wallet.rates[channel] ?? 0 : 0;

/** Premium bonus preview on the fixed base (yearly 26,99, monthly 3,99). */
export function premiumEarnMinor(wallet: QcWalletResult | undefined, plan: QcPremiumPlan): number {
  const base = wallet && wallet.enabled ? wallet.premium_base_minor?.[plan] : undefined;
  return earnPreview(base ?? QC_PREMIUM_BASE_MINOR[plan], rateOf(wallet, plan === 'yearly' ? 'premium_yearly' : 'premium_monthly'));
}

export interface AptekEarnLine { priceMinor: number; quantity: number; own: boolean }
/**
 * Aptek: only Anacan-brand (cashback_own) lines earn, on their share of what is paid for goods
 * (bundle/coupon discounts and the bonus used are spread over all lines; delivery excluded).
 * Mirrors qc_orders_status: base = floor(own × (subtotal − discount − bonus) / subtotal).
 */
export function aptekEarnMinor(lines: AptekEarnLine[], discountMinor: number, usedMinor: number, rateBp: number | undefined): number {
  if (!rateBp) return 0;
  const subtotal = lines.reduce((s, l) => s + l.priceMinor * l.quantity, 0);
  const own = lines.reduce((s, l) => s + (l.own ? l.priceMinor * l.quantity : 0), 0);
  if (subtotal <= 0 || own <= 0) return 0;
  const paid = Math.max(subtotal - Math.max(0, discountMinor) - Math.max(0, usedMinor), 0);
  return earnPreview(Math.floor((own * paid) / subtotal), rateBp);
}

/** When a bonus earned now becomes spendable. */
export function availableFrom(holdDays: number, now = new Date()): Date {
  return new Date(now.getTime() + Math.max(0, holdDays) * 86_400_000);
}

// ── Spending ─────────────────────────────────────────────────────────────────────────────

/** Most bonus usable on goods worth goodsMinor: floor(goods × max %) and no more than the balance. */
export function maxRedeemMinor(goodsMinor: number, wallet: QcWalletResult | undefined): number {
  if (!wallet?.enabled || !(goodsMinor > 0)) return 0;
  const cap = Math.floor((Math.floor(goodsMinor) * wallet.max_redeem_pct) / 100);
  return Math.max(0, Math.min(wallet.available_minor, cap));
}

export type RedeemBlock = 'disabled' | 'paused' | 'channel' | 'balance' | 'order' | null;
export interface RedeemLimits { show: boolean; block: RedeemBlock; min: number; max: number }
/**
 * Whether the "Use QayğıCash" switch is offered for this order, and its range.
 * show=false hides the switch (programme off, paused, channel closed, balance under the minimum);
 * block='order' means the balance is enough but this order is too small for the minimum.
 */
export function redeemLimits(wallet: QcWalletResult | undefined, channel: QcRedeemChannel, goodsMinor: number): RedeemLimits {
  if (!wallet?.enabled) return { show: false, block: 'disabled', min: 0, max: 0 };
  const min = wallet.min_redeem_minor;
  if (wallet.status !== 'live') return { show: false, block: 'paused', min, max: 0 };
  if (!wallet.redeem_channels.includes(channel)) return { show: false, block: 'channel', min, max: 0 };
  if (wallet.available_minor < min) return { show: false, block: 'balance', min, max: 0 };
  const max = maxRedeemMinor(goodsMinor, wallet);
  if (max < min) return { show: true, block: 'order', min, max: 0 };
  return { show: true, block: null, min, max };
}

/** Keeps a chosen amount inside [min, max] on the 0,10 ₼ grid (max itself is always allowed). */
export function clampRedeem(value: number, min: number, max: number, step = QC_STEP_MINOR): number {
  if (max < min || max <= 0) return 0;
  if (value >= max) return max;
  if (value <= min) return min;
  return Math.min(max, min + Math.round((value - min) / step) * step);
}

// ── Premium with bonus ───────────────────────────────────────────────────────────────────

/** The "pay Premium with QayğıCash" option: off unless every server switch allows it on this platform. */
export function premiumRedeemOption(wallet: QcWalletResult | undefined, plan: QcPremiumPlan, platform: QcPlatform):
  { price: number; affordable: boolean } | null {
  if (!wallet?.enabled || wallet.status !== 'live') return null;
  const pr = wallet.premium_redeem, p = pr[plan];
  if (!pr.enabled || !p.enabled || pr.platforms[platform] !== true || !p.price_minor || p.price_minor <= 0) return null;
  return { price: p.price_minor, affordable: wallet.available_minor >= p.price_minor };
}

// ── Errors and statuses ──────────────────────────────────────────────────────────────────

const ERROR_KEYS: Record<string, string> = {
  QC_INSUFFICIENT: 'qc_err_insufficient',
  QC_ABOVE_MAX: 'qc_err_above_max',
  QC_BELOW_MIN: 'qc_err_below_min',
  QC_CHANNEL_CLOSED: 'qc_err_channel_closed',
  QC_PAUSED: 'qc_err_paused',
  QC_NOT_AVAILABLE: 'qc_err_not_available',
  QC_ALREADY_APPLIED: 'qc_err_already_applied',
  QC_ORDER_NOT_ELIGIBLE: 'qc_err_order_not_eligible',
  QC_PREMIUM_CLOSED: 'qc_err_premium_closed',
  not_configured: 'qc_err_premium_closed',
  premium_store_subscription_active: 'qc_err_store_subscription',
};

/** The QC_* code (or a known premium error) in an RPC / edge-function error, else null. */
export function qcErrorCode(error: unknown): string | null {
  if (!error) return null;
  const e = error as { message?: unknown; error?: unknown; code?: unknown };
  const text = [e.message, e.error, e.code, typeof error === 'string' ? error : ''].filter((x) => typeof x === 'string').join(' ');
  const qc = /\bQC_[A-Z_]+\b/.exec(text)?.[0];
  if (qc) return qc;
  if (/premium_store_subscription_active/.test(text)) return 'premium_store_subscription_active';
  if (/\bnot_configured\b/.test(text)) return 'not_configured';
  if (/\bgrant_failed\b/.test(text)) return 'grant_failed';
  return null;
}

/** Translation key for an error code; unknown codes fall back to the generic message. */
export const qcErrorKey = (code: string | null | undefined): string => (code && ERROR_KEYS[code]) || 'qc_err_generic';

export type QcTone = 'pending' | 'available' | 'used' | 'gone';
/** Colour family of a history row: pending amber, available green, used blue, reversed/expired/returned grey. */
export function historyTone(item: Pick<QcHistoryItem, 'type' | 'status'>): QcTone {
  if (item.type === 'redeem') return item.status === 'released' ? 'gone' : 'used';
  if (item.status === 'pending') return 'pending';
  if (item.status === 'available') return 'available';
  return 'gone';
}

/** Copy key of a history row's status. */
export function historyStatusKey(item: Pick<QcHistoryItem, 'type' | 'status'>): string {
  if (item.type === 'redeem') return item.status === 'released' ? 'qc_status_returned' : item.status === 'reserved' ? 'qc_status_reserved' : 'qc_status_used';
  switch (item.status) {
    case 'pending': return 'qc_status_pending';
    case 'available': return 'qc_status_available';
    case 'expired': return 'qc_status_expired';
    default: return 'qc_status_reversed';
  }
}

const EARN_SOURCES = new Set(['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'adjust']);
const REDEEM_SOURCES = new Set(['aptek', 'cake', 'book', 'premium']);
/** Copy key of a history row's title. */
export function historyTitleKey(item: Pick<QcHistoryItem, 'type' | 'channel' | 'source_type'>): string {
  if (item.type === 'redeem') return REDEEM_SOURCES.has(item.channel) ? `qc_hist_use_${item.channel}` : 'qc_hist_use_other';
  if (item.source_type === 'adjust') return 'qc_hist_earn_adjust';
  return EARN_SOURCES.has(item.channel) ? `qc_hist_earn_${item.channel}` : 'qc_hist_earn_adjust';
}

/** Has the person ever had bonus activity (for the one-time intro vs the balance card). */
export const hasQcActivity = (wallet: QcWalletResult | undefined) =>
  !!wallet?.enabled && wallet.available_minor + wallet.pending_minor > 0;

const INTRO_KEY = 'anacan_qc_intro_dismissed_v1:';
export function readIntroDismissed(uid: string | null | undefined): boolean {
  if (!uid) return true;
  try { return localStorage.getItem(INTRO_KEY + uid) === '1'; } catch { return false; }
}
export function writeIntroDismissed(uid: string | null | undefined): void {
  if (!uid) return;
  try { localStorage.setItem(INTRO_KEY + uid, '1'); } catch { /* private mode */ }
}
