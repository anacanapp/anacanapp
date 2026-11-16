import { describe, expect, it } from 'vitest';
import { OLIVIA_CATALOG, OLIVIA_COLLECTIONS, oliviaFromRow, oliviaImportRows, oliviaLink, oliviaPlan } from './olivia-shop';

describe('olivia shop', () => {
  it('imports only inactive olivia rows, so RLS keeps them admin-only', () => {
    const rows = oliviaImportRows();
    expect(rows).toHaveLength(OLIVIA_CATALOG.products.length);
    for (const r of rows) {
      expect(r.store).toBe('olivia');
      expect(r.is_active).toBe(false);
      expect(r.image_url).toMatch(/^\/olivia\/[\w-]+\.webp$/);
      expect(r.tags.length).toBeGreaterThan(0);
      expect(r.tags.every((t) => (OLIVIA_COLLECTIONS as string[]).includes(t))).toBe(true);
    }
    expect(new Set(rows.map((r) => r.sku)).size).toBe(rows.length);
  });
  it('keeps every collection product in the catalog', () => {
    const skus = new Set(OLIVIA_CATALOG.products.map((p) => p.sku));
    for (const list of Object.values(OLIVIA_CATALOG.collections)) list.forEach((s) => expect(skus.has(s)).toBe(true));
  });
  it('picks the hero by stage and hides everything in loss recovery', () => {
    expect(oliviaPlan({ lifeStage: 'bump', pregnancyWeek: 35 })?.hero.collection).toBe('bag');
    expect(oliviaPlan({ lifeStage: 'bump', pregnancyWeek: 20 })?.hero.collection).toBe('pregnant');
    expect(oliviaPlan({ lifeStage: 'bump', pregnancyWeek: 19 })?.hero.eyebrow).toBe('19-cu həftə');
    expect(oliviaPlan({ lifeStage: 'bump', pregnancyWeek: 36 })?.hero.eyebrow).toBe('36-cı həftə üçün');
    expect(oliviaPlan({ lifeStage: 'mommy', babyMonths: 3 })?.hero.collection).toBe('newmom');
    expect(oliviaPlan({ lifeStage: 'mommy', babyMonths: 7 })?.hero.collection).toBe('baby');
    expect(oliviaPlan({ lifeStage: 'mommy', babyMonths: 30 })?.hero.collection).toBe('kid');
    expect(oliviaPlan({ lifeStage: 'flow', daysUntilPeriod: 2 })?.hero.eyebrow).toBe('Aybaşına 2 gün qalıb');
    expect(oliviaPlan({ lifeStage: 'flow', recovering: true })).toBeNull();
  });
  it('maps a row back with its collections and adds UTM to links', () => {
    const p = oliviaFromRow({ id: 'x', sku: '00-00010989', name: 'Salfet', price: '5.79', original_price: '6.49', tags: ['bag', 'baby'], source_url: 'https://olivia.az/a' });
    expect(p?.collections).toEqual(['bag', 'baby']);
    expect(p?.price).toBe(5.79);
    expect(oliviaLink('https://olivia.az/a', 'home bag')).toBe('https://olivia.az/a?utm_source=anacan&utm_medium=app&utm_campaign=home_bag');
  });
});
