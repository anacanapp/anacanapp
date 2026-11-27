/**
 * In-app Epoint Premium prices (owner 2026-11-25): the admin sets USD prices (default + per-country overrides) in
 * app_settings.in_app_epoint_pricing; the server converts them to AZN at the Central Bank of Azerbaijan rate
 * (app_settings.fx_usd_azn, refreshed daily by web-premium; else the admin fallback rate) and locks the AZN price into
 * the subscription at signup. This file mirrors the SQL (web_premium_app_offer_v1, _web_premium_round_azn) for the admin
 * preview only; the app always shows and charges the server's numbers.
 */
export type PricingPlan = 'monthly' | 'yearly';
export type Rounding = 'x99' | 'cents';
export interface UsdPrices { monthly: number | null; yearly: number | null }
export interface InAppEpointPricing {
  default: UsdPrices;
  countries: Record<string, Partial<Record<PricingPlan, number>>>;
  fallbackRate: number | null;
  rounding: Rounding;
}
export interface UsdAznRate { rate: number; date: string | null; source: 'cbar' | 'fallback' }

const USD_MIN = 0.5, USD_MAX = 300, RATE_MIN = 0.5, RATE_MAX = 5;
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const unwrap = (raw: unknown): Record<string, unknown> | null => {
  let v = raw;
  for (let i = 0; i < 2 && typeof v === 'string'; i++) { try { v = JSON.parse(v); } catch { return null; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
};

export function parsePricing(raw: unknown): InAppEpointPricing {
  const v = unwrap(raw) ?? {};
  const def = (v.default && typeof v.default === 'object' ? v.default : {}) as Record<string, unknown>;
  const countries: InAppEpointPricing['countries'] = {};
  if (v.countries && typeof v.countries === 'object' && !Array.isArray(v.countries)) {
    for (const [code, value] of Object.entries(v.countries as Record<string, unknown>)) {
      const cc = code.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc) || !value || typeof value !== 'object') continue;
      const o = value as Record<string, unknown>;
      const entry: Partial<Record<PricingPlan, number>> = {};
      const m = num(o.monthly), y = num(o.yearly);
      if (m !== null) entry.monthly = m;
      if (y !== null) entry.yearly = y;
      countries[cc] = entry;
    }
  }
  return { default: { monthly: num(def.monthly), yearly: num(def.yearly) }, countries, fallbackRate: num(v.fallback_rate),
    rounding: v.rounding === 'cents' ? 'cents' : 'x99' };
}

/** The stored shape (what the admin saves). */
export function serializePricing(p: InAppEpointPricing): Record<string, unknown> {
  return { default: { monthly: p.default.monthly, yearly: p.default.yearly }, countries: p.countries, fallback_rate: p.fallbackRate, rounding: p.rounding };
}

/** USD prices for a country: its override per plan, else the default. */
export function resolveUsdPrices(p: InAppEpointPricing, country: string | null | undefined): UsdPrices & { override: boolean } {
  const cc = (country ?? '').trim().toUpperCase();
  const o = /^[A-Z]{2}$/.test(cc) ? p.countries[cc] : undefined;
  return { monthly: o?.monthly ?? p.default.monthly, yearly: o?.yearly ?? p.default.yearly, override: !!o };
}

/** Same as public._web_premium_round_azn: 'cents' → 2 decimals, 'x99' → the nearest price ending in ,99 (≥ 0,99). */
export function roundAzn(amount: number, mode: Rounding = 'x99'): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 1e6) / 1e6; // strip float noise (3.99 * 1.7 = 6.783000000000001)
  if (mode === 'cents') return Math.round(cents * 100 + 1e-9) / 100;
  const f = Math.floor(cents);
  const lo = f - 0.01, hi = f + 0.99;
  const pick = cents - lo <= hi - cents ? lo : hi;
  return Math.max(0.99, Math.round(pick * 100) / 100);
}

/** The rate the server uses: the cached CBAR rate, else the admin fallback. */
export function effectiveRate(fxRaw: unknown, pricing: InAppEpointPricing): UsdAznRate | null {
  const fx = unwrap(fxRaw);
  const cached = num(fx?.rate);
  if (cached !== null && cached >= RATE_MIN && cached <= RATE_MAX) return { rate: cached, date: typeof fx?.date === 'string' ? fx.date : null, source: 'cbar' };
  const fallback = pricing.fallbackRate;
  return fallback !== null && fallback >= RATE_MIN && fallback <= RATE_MAX ? { rate: fallback, date: null, source: 'fallback' } : null;
}

export function usdToAzn(usd: number | null, rate: number | null, mode: Rounding): number | null {
  if (usd === null || rate === null || usd < USD_MIN || usd > USD_MAX) return null;
  const azn = roundAzn(usd * rate, mode);
  return azn !== null && azn >= 0.5 && azn <= 500 ? azn : null;
}

/** Admin validation; returns an Azerbaijani message or null. */
export function validatePricing(p: InAppEpointPricing): string | null {
  const ok = (v: number | null | undefined) => v === null || v === undefined || (v >= USD_MIN && v <= USD_MAX);
  if (p.default.monthly === null || p.default.yearly === null) return 'Default aylıq və illik USD qiymətini yazın.';
  if (!ok(p.default.monthly) || !ok(p.default.yearly)) return `USD qiymət ${USD_MIN}–${USD_MAX} arasında olmalıdır.`;
  for (const [cc, o] of Object.entries(p.countries)) {
    if (!/^[A-Z]{2}$/.test(cc)) return `Yanlış ölkə kodu: ${cc}`;
    if (!ok(o.monthly) || !ok(o.yearly)) return `${cc}: USD qiymət ${USD_MIN}–${USD_MAX} arasında olmalıdır.`;
  }
  if (p.fallbackRate !== null && (p.fallbackRate < RATE_MIN || p.fallbackRate > RATE_MAX)) return `Ehtiyat məzənnə ${RATE_MIN}–${RATE_MAX} arasında olmalıdır.`;
  return null;
}

/** Comma / space separated ISO country codes → unique upper-case list; invalid entries are reported. */
export function parseCountryList(text: string): { countries: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map(part => part.trim().toUpperCase()).filter(Boolean);
  const countries = [...new Set(parts.filter(part => /^[A-Z]{2}$/.test(part)))];
  return { countries, invalid: parts.filter(part => !/^[A-Z]{2}$/.test(part)) };
}
