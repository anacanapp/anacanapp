// Anacan Aptek price preview. Mirrors public.place_aptek_order (20261027090000_aptek_store.sql);
// the server recomputes everything at checkout and its numbers are the ones charged.

export interface AptekBundle { id: string; skus: string[]; tone?: string }
export interface AptekConfig {
  enabled: boolean;
  countries: string[];
  free_shipping_min: number;
  shipping_fee: number;
  bundle_discount_pct: number;
  slots: string[];
  bundles: AptekBundle[];
  placements: Record<string, boolean>;
}
export interface PriceLine { sku: string | null; price: number; quantity: number }
export interface AptekCoupon {
  code: string;
  discount_type: 'percentage' | 'fixed' | string;
  discount_value: number;
  applicable_to: string[] | null;
  is_active: boolean | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number | null;
  min_order_amount: number | null;
}
export interface AptekTotals {
  subtotal: number;
  bundleDiscount: number;
  couponDiscount: number;
  shipping: number;
  total: number;
  /** Amount still needed for free delivery (0 when reached). */
  toFreeShipping: number;
  completeBundles: string[];
}

export const DEFAULT_APTEK_CONFIG: AptekConfig = {
  enabled: false,
  countries: ['AZ'],
  free_shipping_min: 30,
  shipping_fee: 3,
  bundle_discount_pct: 10,
  slots: ['today_evening', 'tomorrow_morning', 'tomorrow_evening', 'day_after'],
  bundles: [],
  placements: {},
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalises the stored config (it may arrive JSON-encoded or partial). */
export function parseAptekConfig(raw: unknown): AptekConfig {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  const v = (value && typeof value === 'object' ? value : {}) as Partial<AptekConfig>;
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  return {
    enabled: v.enabled === true,
    countries: Array.isArray(v.countries) ? v.countries.map(String) : DEFAULT_APTEK_CONFIG.countries,
    free_shipping_min: num(v.free_shipping_min, DEFAULT_APTEK_CONFIG.free_shipping_min),
    shipping_fee: num(v.shipping_fee, DEFAULT_APTEK_CONFIG.shipping_fee),
    bundle_discount_pct: Math.min(50, Math.max(0, num(v.bundle_discount_pct, DEFAULT_APTEK_CONFIG.bundle_discount_pct))),
    slots: Array.isArray(v.slots) && v.slots.length ? v.slots.map(String) : DEFAULT_APTEK_CONFIG.slots,
    bundles: Array.isArray(v.bundles)
      ? v.bundles.filter((b): b is AptekBundle => !!b && typeof b.id === 'string' && Array.isArray(b.skus))
      : [],
    placements: v.placements && typeof v.placements === 'object' ? v.placements : {},
  };
}

/** Coupon checks the server applies; returns a reason key or null when usable. */
export function couponProblem(c: AptekCoupon | null | undefined, subtotal: number, now = new Date()): string | null {
  if (!c || c.is_active !== true) return 'coupon_invalid';
  if (!(c.applicable_to || []).some((a) => a === 'aptek' || a === 'all')) return 'coupon_invalid';
  if (c.starts_at && new Date(c.starts_at) > now) return 'coupon_invalid';
  if (c.expires_at && new Date(c.expires_at) < now) return 'coupon_expired';
  if (c.max_uses != null && (c.used_count || 0) >= c.max_uses) return 'coupon_used_up';
  if (c.min_order_amount != null && subtotal < c.min_order_amount) return 'coupon_min_order';
  return null;
}

export function computeAptekTotals(lines: PriceLine[], config: AptekConfig, coupon?: AptekCoupon | null, now = new Date()): AptekTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const inCart = new Map(lines.filter((l) => l.quantity > 0 && l.sku).map((l) => [l.sku as string, l.price]));

  let bundleDiscount = 0;
  const completeBundles: string[] = [];
  for (const b of config.bundles) {
    if (b.skus.length && b.skus.every((sku) => inCart.has(sku))) {
      completeBundles.push(b.id);
      const unitSum = [...new Set(b.skus)].reduce((s, sku) => s + (inCart.get(sku) || 0), 0);
      bundleDiscount += round2((unitSum * config.bundle_discount_pct) / 100);
    }
  }
  bundleDiscount = round2(bundleDiscount);

  let couponDiscount = 0;
  if (coupon && !couponProblem(coupon, subtotal, now)) {
    const base = subtotal - bundleDiscount;
    couponDiscount = coupon.discount_type === 'percentage'
      ? round2((base * Math.min(coupon.discount_value, 100)) / 100)
      : Math.min(coupon.discount_value, base);
  }

  const afterDiscounts = subtotal - bundleDiscount - couponDiscount;
  const shipping = subtotal === 0 || afterDiscounts >= config.free_shipping_min ? 0 : config.shipping_fee;
  return {
    subtotal,
    bundleDiscount,
    couponDiscount: round2(couponDiscount),
    shipping,
    total: round2(Math.max(afterDiscounts, 0) + shipping),
    toFreeShipping: round2(Math.max(0, config.free_shipping_min - afterDiscounts)),
    completeBundles,
  };
}

/** Store is shown in its countries when enabled; admins always see it (to prepare it). */
export function isAptekAvailable(config: AptekConfig | null | undefined, countryCode: string | null | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  if (!config?.enabled) return false;
  return !!countryCode && config.countries.includes(countryCode.toUpperCase());
}
