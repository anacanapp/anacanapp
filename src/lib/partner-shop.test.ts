import { describe, expect, it } from 'vitest';
import { OLIVIA_CATALOG, oliviaImportRows } from './olivia-catalog';
import { partnerLink, productFromRow, shopPlan, storefrontFromRpc, SHOP_COLLECTIONS } from './partner-shop';

const olivia = { id: 'p1', slug: 'olivia', name: 'Olivia', logo_url: '/partners/olivia/logo.png', icon_url: '/partners/olivia/icon.png', website_url: 'https://olivia.az', brand_color: '#9B16D9', status: 'admin_only' };

describe('partner shop', () => {
  it('imports the Olivia catalog with valid collections and unique SKUs', () => {
    const rows = oliviaImportRows();
    expect(rows).toHaveLength(OLIVIA_CATALOG.products.length);
    for (const r of rows) {
      expect(r.image_url).toMatch(/^\/olivia\/[\w-]+\.webp$/);
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(r.tags.length).toBeGreaterThan(0);
      expect(r.tags.every((t) => (SHOP_COLLECTIONS as string[]).includes(t))).toBe(true);
    }
    expect(new Set(rows.map((r) => r.sku)).size).toBe(rows.length);
    const skus = new Set(rows.map((r) => r.sku));
    Object.values(OLIVIA_CATALOG.collections).forEach((list) => list.forEach((s) => expect(skus.has(s)).toBe(true)));
  });
  it('picks the hero by stage and hides everything in loss recovery', () => {
    expect(shopPlan({ lifeStage: 'bump', pregnancyWeek: 35 })?.hero.collection).toBe('bag');
    expect(shopPlan({ lifeStage: 'bump', pregnancyWeek: 20 })?.hero.collection).toBe('pregnant');
    expect(shopPlan({ lifeStage: 'bump', pregnancyWeek: 19 })?.hero.eyebrow).toBe('19-cu həftə');
    expect(shopPlan({ lifeStage: 'bump', pregnancyWeek: 36 })?.hero.eyebrow).toBe('36-cı həftə üçün');
    expect(shopPlan({ lifeStage: 'mommy', babyMonths: 3 })?.hero.collection).toBe('newmom');
    expect(shopPlan({ lifeStage: 'mommy', babyMonths: 7 })?.hero.collection).toBe('baby');
    expect(shopPlan({ lifeStage: 'mommy', babyMonths: 30 })?.hero.collection).toBe('kid');
    expect(shopPlan({ lifeStage: 'flow', daysUntilPeriod: 2 })?.hero.eyebrow).toBe('Aybaşına 2 gün qalıb');
    expect(shopPlan({ lifeStage: 'flow', recovering: true })).toBeNull();
  });
  it('maps storefront rows, keeps curated Olivia lines and applies campaigns', () => {
    const s = storefrontFromRpc({ partners: [olivia], products: [
      { id: 'x', partner_id: 'p1', sku: '00-00010989', name: 'Salfet', description: 'Körpə üçün ilk paket', price: '5.79', original_price: '6.49', tags: ['bag', 'baby'], source_url: 'https://olivia.az/a', image_url: '/olivia/00-00010989.webp', sales_count: 51 },
      { id: 'y', partner_id: 'p1', sku: 'n1', name: 'Yeni', description: 'Öz izahı', price: 10, original_price: null, tags: ['gift'], campaign: { id: 'c', title: 'Payız', discount_pct: 20, price: 8, ends_at: '2026-12-01T00:00:00Z' } },
      { id: 'z', partner_id: 'other', name: 'Başqa', price: 1, tags: [] },
    ] });
    expect(s.products.map((p) => p.id)).toEqual(['x', 'y']);
    const [a, b] = s.products;
    expect(a.why.baby).toBe('Gündəlik istifadə üçün, 0+');
    expect(a.originalPrice).toBe(6.49);
    expect(b.price).toBe(8);
    expect(b.originalPrice).toBe(10);
    expect(b.campaign?.title).toBe('Payız');
    expect(b.why.gift).toBe('Öz izahı');
    expect(s.partners.get('p1')?.iconUrl).toBe('/partners/olivia/icon.png');
  });
  it('adds UTM to partner links', () => {
    expect(partnerLink('https://olivia.az/a', 'home bag')).toBe('https://olivia.az/a?utm_source=anacan&utm_medium=app&utm_campaign=home_bag');
    expect(productFromRow({ id: 'q', partner_id: 'p', name: 'N', price: 1 }).url).toBe('https://anacan.az/');
  });
});
