/**
 * Partner stores inside Mağaza (owner 2026-11-16/17). Olivia.az is the first partner; more brands can be added.
 * Server side (supabase/migrations/20261117090000_shop_partners.sql):
 *  - products.partner_id links a product to its partner; partner rows stay is_active = false;
 *  - shop_storefront_v1 returns a partner's listed, in-stock products to everyone when the partner is live and only
 *    to admins and the partner's own members while it is admin_only/paused (Olivia is admin_only now);
 *  - shop_partner_track_v1 records impressions/opens/adds/site clicks for the partner panel (/partner).
 * Phase 1 sells on the partner's own site: buttons open the product page with Anacan UTM parameters.
 */
import { azOrdinal } from '@/lib/stories';
import { OLIVIA_CATALOG } from '@/lib/olivia-catalog';

export type ShopCollection = 'bag' | 'pregnant' | 'newmom' | 'baby' | 'kid' | 'cycle' | 'gift';
export const SHOP_COLLECTIONS: ShopCollection[] = ['bag', 'pregnant', 'newmom', 'baby', 'kid', 'cycle', 'gift'];

export const SHOP_COLLECTION_LABEL: Record<ShopCollection, string> = {
  bag: 'Xəstəxana çantası',
  pregnant: 'Hamiləlik',
  newmom: 'Yeni ana',
  baby: 'Körpə 0-12 ay',
  kid: 'Uşaq 1-6 yaş',
  cycle: 'Dövr',
  gift: 'Hədiyyə',
};

export interface ShopPartner {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  iconUrl: string | null;
  websiteUrl: string | null;
  brandColor: string;
  status: 'admin_only' | 'live' | 'paused';
}

export interface ShopCampaign { id: string; title: string; discountPct: number; endsAt: string }

/** A storefront product: price is what the user pays now (campaign applied), originalPrice the struck-through one. */
export interface PartnerProduct {
  id: string;
  partnerId: string;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  image: string | null;
  url: string;
  collections: ShopCollection[];
  why: Partial<Record<ShopCollection, string>>;
  sort: number;
  stock: number | null;
  campaign: ShopCampaign | null;
}

export interface Storefront { partners: Map<string, ShopPartner>; products: PartnerProduct[] }

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
const oliviaBySku = new Map(OLIVIA_CATALOG.products.map((p) => [p.sku, p]));

export function partnerFromRow(r: Record<string, unknown>): ShopPartner {
  return {
    id: String(r.id), slug: String(r.slug || ''), name: String(r.name || ''),
    logoUrl: (r.logo_url as string) || null, iconUrl: (r.icon_url as string) || null, websiteUrl: (r.website_url as string) || null,
    brandColor: typeof r.brand_color === 'string' ? r.brand_color : '#8A2BE2',
    status: r.status === 'live' || r.status === 'paused' ? r.status : 'admin_only',
  };
}

export function productFromRow(r: Record<string, unknown>, partner?: ShopPartner): PartnerProduct {
  const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
  const collections = tags.filter((t): t is ShopCollection => (SHOP_COLLECTIONS as string[]).includes(t));
  const base = num(r.price) ?? 0;
  const listedOld = num(r.original_price);
  const c = r.campaign && typeof r.campaign === 'object' ? r.campaign as Record<string, unknown> : null;
  const campaign: ShopCampaign | null = c ? { id: String(c.id), title: String(c.title || ''), discountPct: Number(c.discount_pct) || 0, endsAt: String(c.ends_at || '') } : null;
  const price = campaign && c?.price != null ? Number(c.price) : base;
  const strike = campaign ? Math.max(base, listedOld ?? 0) : listedOld;
  const description = typeof r.description === 'string' && r.description ? r.description : null;
  // Curated Olivia rows keep their per-collection "why" lines until the partner rewrites the description.
  const known = partner?.slug === 'olivia' && typeof r.sku === 'string' ? oliviaBySku.get(r.sku) : undefined;
  const why = known && (!description || description === known.why[known.collections[0]])
    ? known.why
    : description ? Object.fromEntries((collections.length ? collections : (['baby'] as ShopCollection[])).map((k) => [k, description])) : {};
  return {
    id: String(r.id), partnerId: String(r.partner_id || ''), sku: (r.sku as string) || null, name: String(r.name || ''), description,
    price, originalPrice: strike && strike > price ? strike : null, image: (r.image_url as string) || null,
    url: (r.source_url as string) || partner?.websiteUrl || 'https://anacan.az/', collections, why,
    sort: Number(r.sales_count) || 0, stock: num(r.stock), campaign,
  };
}

export function storefrontFromRpc(data: unknown): Storefront {
  const d = (data && typeof data === 'object' ? data : {}) as { partners?: unknown[]; products?: unknown[] };
  const partners = new Map<string, ShopPartner>();
  (d.partners || []).forEach((p) => { const x = partnerFromRow(p as Record<string, unknown>); partners.set(x.id, x); });
  const products = (d.products || []).map((p) => {
    const row = p as Record<string, unknown>;
    return productFromRow(row, partners.get(String(row.partner_id)));
  }).filter((p) => partners.has(p.partnerId));
  return { partners, products };
}

export const shopDiscount = (p: Pick<PartnerProduct, 'price' | 'originalPrice'>) =>
  p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;

export const formatManat = (n: number) => `${n.toFixed(2).replace('.', ',')} ₼`;

/** Partner product link with Anacan attribution (phase 1: the sale happens on the partner's site). */
export function partnerLink(url: string, campaign: string) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'anacan');
    u.searchParams.set('utm_medium', 'app');
    u.searchParams.set('utm_campaign', campaign.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'shop');
    return u.toString();
  } catch {
    return 'https://anacan.az/';
  }
}

export interface ShopStageInput {
  lifeStage: 'bump' | 'mommy' | 'flow' | string | null | undefined;
  pregnancyWeek?: number | null;
  babyMonths?: number | null;
  daysUntilPeriod?: number | null;
  recovering?: boolean;
}

export interface ShopHero {
  collection: ShopCollection;
  eyebrow: string;
  title: string;
  text: string;
  /** SKU shown first in the hero thumbnails. */
  lead?: string;
}

/** The stage decides the hero and the order of collections. Loss recovery gets nothing. */
export function shopPlan(input: ShopStageInput): { hero: ShopHero; order: ShopCollection[] } | null {
  if (input.recovering) return null;
  const week = input.pregnancyWeek ?? null;
  const months = input.babyMonths ?? null;
  if (input.lifeStage === 'bump') {
    if (week != null && week >= 32) {
      return {
        hero: { collection: 'bag', eyebrow: `${week}${azOrdinal(week)} həftə üçün`, title: 'Xəstəxana çantası bir yerdə', text: 'Doğuşdan sonra ana və körpə üçün lazım olan baxım məhsulları.' },
        order: ['bag', 'pregnant', 'baby', 'gift'],
      };
    }
    return {
      hero: { collection: 'pregnant', eyebrow: week ? `${week}${azOrdinal(week)} həftə` : 'Hamiləlik', title: 'Qarın böyüyür, dəri quruyur', text: 'Ətirsiz nəmləndiricilər və hamiləlik ləkələrinə qarşı SPF 50+.', lead: '00-00001286' },
      order: ['pregnant', 'bag', 'gift'],
    };
  }
  if (input.lifeStage === 'mommy') {
    if (months != null && months >= 12) {
      return {
        hero: { collection: 'kid', eyebrow: 'Uşaq baxımı', title: 'Diş, saç və günəş', text: 'Uşaq diş məcunları, asan daranan şampunlar və uşaq SPF 50+.' },
        order: ['kid', 'newmom', 'gift'],
      };
    }
    if (months != null && months >= 2 && months <= 6) {
      return {
        hero: { collection: 'newmom', eyebrow: 'Sənin üçün', title: 'Doğuşdan sonra saç tökülməsi', text: 'Çox vaxt 3-4-cü ayda artır və keçicidir. Saç baxımı və yuxusuz gecələr üçün patçlar.', lead: '00-10025971' },
        order: ['newmom', 'baby', 'gift'],
      };
    }
    if (months != null && months >= 5) {
      return {
        hero: { collection: 'baby', eyebrow: `${months} aylıq körpə üçün`, title: 'İlk diş vaxtı', text: '0+ diş fırçası və körpənin gündəlik baxımı.', lead: '00-00012835' },
        order: ['baby', 'newmom', 'gift'],
      };
    }
    return {
      hero: { collection: 'baby', eyebrow: 'Körpə baxımı', title: 'Hər gün lazım olanlar', text: 'Nəm salfet, bezaltı krem, körpə yağı və şampun.' },
      order: ['baby', 'newmom', 'gift'],
    };
  }
  const d = input.daysUntilPeriod;
  return {
    hero: {
      collection: 'cycle',
      eyebrow: d != null && d >= 0 && d <= 5 ? (d === 0 ? 'Aybaşı bu gün' : `Aybaşına ${d} gün qalıb`) : 'Dövr',
      title: 'Bezlərin var?',
      text: 'Gündüz, gecə və gündəlik bezlər bir yerdə.',
    },
    order: ['cycle', 'gift'],
  };
}
