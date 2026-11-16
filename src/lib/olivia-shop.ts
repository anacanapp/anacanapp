/**
 * Olivia.az partnership (owner 2026-11-16): a stage-aware storefront inside the existing Mağaza screen,
 * plus home promos. Admin-only while the partnership is negotiated:
 *  - rows live in public.products with store = 'olivia' and is_active = false, so the
 *    "Anyone can view active products" policy hides them from everyone except admins
 *    ("Admins can manage products"); no schema change, products is already CDC/writer guarded;
 *  - every UI entry point also checks isAdmin.
 * Phase 1 sells through olivia.az: buttons open the product page with Anacan UTM parameters.
 * Admin › Olivia mağazası imports the curated list (src/data/olivia-products.json) or deletes it in one click.
 */
import catalog from '@/data/olivia-products.json';
import { azOrdinal } from '@/lib/stories';

export const OLIVIA_STORE = 'olivia';

export type OliviaCollection = 'bag' | 'pregnant' | 'newmom' | 'baby' | 'kid' | 'cycle' | 'gift';
export const OLIVIA_COLLECTIONS: OliviaCollection[] = ['bag', 'pregnant', 'newmom', 'baby', 'kid', 'cycle', 'gift'];

export const OLIVIA_COLLECTION_LABEL: Record<OliviaCollection, string> = {
  bag: 'Xəstəxana çantası',
  pregnant: 'Hamiləlik',
  newmom: 'Yeni ana',
  baby: 'Körpə 0-12 ay',
  kid: 'Uşaq 1-6 yaş',
  cycle: 'Dövr',
  gift: 'Hədiyyə',
};

export interface OliviaCatalogItem {
  sku: string;
  name: string;
  full_name: string;
  price: number;
  original_price: number | null;
  url: string;
  collections: OliviaCollection[];
  why: Partial<Record<OliviaCollection, string>>;
  image: string;
  sort: number;
}

export const OLIVIA_CATALOG = catalog as unknown as {
  source: string;
  captured: string;
  collections: Record<OliviaCollection, string[]>;
  products: OliviaCatalogItem[];
};

/** A product row as the app uses it (built from public.products, enriched from the bundled catalog). */
export interface OliviaProduct {
  id: string;
  sku: string;
  name: string;
  fullName: string;
  price: number;
  originalPrice: number | null;
  image: string | null;
  url: string;
  collections: OliviaCollection[];
  why: Partial<Record<OliviaCollection, string>>;
  sort: number;
}

const bySku = new Map(OLIVIA_CATALOG.products.map((p) => [p.sku, p]));

export function oliviaFromRow(row: Record<string, unknown>): OliviaProduct | null {
  const sku = typeof row.sku === 'string' ? row.sku : '';
  if (!sku) return null;
  const known = bySku.get(sku);
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  const collections = tags.filter((t): t is OliviaCollection => (OLIVIA_COLLECTIONS as string[]).includes(t));
  return {
    id: String(row.id),
    sku,
    name: String(row.name || known?.name || sku),
    fullName: known?.full_name || String(row.name || ''),
    price: Number(row.price) || 0,
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    image: (row.image_url as string | null) || known?.image || null,
    url: (row.source_url as string | null) || known?.url || 'https://olivia.az/',
    collections: collections.length ? collections : known?.collections || [],
    why: known?.why || (typeof row.description === 'string' && row.description ? { [collections[0] || 'baby']: row.description } : {}),
    sort: Number(row.sales_count) || known?.sort || 0,
  };
}

/** Rows written by the admin import: inactive (admin-only through RLS), tagged with their collections. */
export function oliviaImportRows() {
  return OLIVIA_CATALOG.products.map((p) => ({
    name: p.name,
    description: p.why[p.collections[0]] || null,
    price: p.price,
    original_price: p.original_price,
    image_url: p.image,
    images: [p.image],
    category: 'olivia',
    sku: p.sku,
    store: OLIVIA_STORE,
    kind: p.collections[0],
    tags: p.collections,
    source: 'olivia.az',
    source_url: p.url,
    // Keeps the curated order; nothing else reads sales_count for this store.
    sales_count: OLIVIA_CATALOG.products.length - p.sort,
    stock: null,
    is_active: false,
    cashback_own: false,
  }));
}

export const oliviaDiscount = (p: Pick<OliviaProduct, 'price' | 'originalPrice'>) =>
  p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;

export const formatManat = (n: number) => `${n.toFixed(2).replace('.', ',')} ₼`;

/** olivia.az product link with Anacan attribution (phase 1: the sale happens on olivia.az). */
export function oliviaLink(url: string, campaign: string) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'anacan');
    u.searchParams.set('utm_medium', 'app');
    u.searchParams.set('utm_campaign', campaign.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'shop');
    return u.toString();
  } catch {
    return 'https://olivia.az/';
  }
}

export interface OliviaStageInput {
  lifeStage: 'bump' | 'mommy' | 'flow' | string | null | undefined;
  pregnancyWeek?: number | null;
  babyMonths?: number | null;
  daysUntilPeriod?: number | null;
  recovering?: boolean;
}

export interface OliviaHero {
  collection: OliviaCollection;
  eyebrow: string;
  title: string;
  text: string;
  /** Product shown first in the hero thumbnails. */
  lead?: string;
}

/** The stage decides the hero and the order of collections. Loss recovery gets nothing. */
export function oliviaPlan(input: OliviaStageInput): { hero: OliviaHero; order: OliviaCollection[] } | null {
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
