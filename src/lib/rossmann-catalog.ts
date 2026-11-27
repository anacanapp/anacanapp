/**
 * The bundled Rossmann catalog (mother, baby and hygiene brands from rossmann.az: Babydream, Mamas Babydream, Bübchen,
 * Chicco, Always and others; images in public/rossmann/). Rebuild with scripts/partners/rossmann-catalog.py.
 * Admin › Partnyor mağazaları imports it for the 'rossmann' partner through shop_partner_admin_import_v1.
 */
import catalog from '@/data/rossmann-products.json';
import type { OliviaCatalogItem } from '@/lib/olivia-catalog';
import type { ShopCollection } from '@/lib/partner-shop';

export type RossmannCatalogItem = OliviaCatalogItem;

export const ROSSMANN_CATALOG = catalog as unknown as {
  source: string;
  captured: string;
  collections: Record<ShopCollection, string[]>;
  products: RossmannCatalogItem[];
};

/** Rows for shop_partner_admin_import_v1 (same validation as the partner panel's product form). */
export function rossmannImportRows() {
  return ROSSMANN_CATALOG.products.map((p) => ({
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
