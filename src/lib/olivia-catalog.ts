/**
 * The curated Olivia.az catalog (51 products, prices from olivia.az on 2026-11-16, images in public/olivia/).
 * Admin › Partnyor mağazaları imports it for the 'olivia' partner through shop_partner_admin_import_v1.
 */
import catalog from '@/data/olivia-products.json';
import type { ShopCollection } from '@/lib/partner-shop';

export interface OliviaCatalogItem {
  sku: string;
  name: string;
  full_name: string;
  price: number;
  original_price: number | null;
  url: string;
  collections: ShopCollection[];
  why: Partial<Record<ShopCollection, string>>;
  image: string;
  sort: number;
}

export const OLIVIA_CATALOG = catalog as unknown as {
  source: string;
  captured: string;
  collections: Record<ShopCollection, string[]>;
  products: OliviaCatalogItem[];
};

/** Rows for shop_partner_admin_import_v1 (same validation as the partner panel's product form). */
export function oliviaImportRows() {
  return OLIVIA_CATALOG.products.map((p) => ({
    name: p.name,
    description: p.why[p.collections[0]] || null,
    price: String(p.price),
    original_price: p.original_price != null ? String(p.original_price) : '',
    image_url: p.image,
    source_url: p.url,
    sku: p.sku,
    tags: p.collections,
    listed: true,
  }));
}
