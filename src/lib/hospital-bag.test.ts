import { afterEach, describe, expect, it } from 'vitest';
import {
  bagCounts, categoryOf, cleanItemName, customItemId, dbCategoryFor, isCheckViolation, isCustomItemId, isMissingColumnError,
  mergeBagItems, missingTemplateRows, readLocalHidden, toggleHidden, visibleBagItems, writeLocalHidden,
  type BagRow, type BagTemplate,
} from './hospital-bag';

const templates: BagTemplate[] = [
  { id: 't-passport', item_name: 'Passport', category: 'documents', priority: 1, notes: 'ID', sort_order: 1 },
  { id: 't-gown', item_name: 'Gown', category: 'mom', priority: 2, notes: null, sort_order: 2 },
  { id: 't-diapers', item_name: 'Diapers', category: 'baby', priority: 1, notes: null, sort_order: 3 },
  { id: 't-old', item_name: 'Retired', category: 'baby', sort_order: 4, is_active: false },
];
let n = 0;
const row = (over: Partial<BagRow>): BagRow => ({
  id: `r${n++}`, user_id: 'mom', item_id: 't-passport', item_name: 'Pasport', category: 'documents', is_checked: false,
  priority: 2, notes: null, added_by: 'woman', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', ...over,
});

describe('custom item ids and categories', () => {
  it('encodes the category in own items and recognises older partner items', () => {
    const id = customItemId('partner', 'abc');
    expect(id).toBe('custom:partner:abc');
    expect(isCustomItemId(id)).toBe(true);
    expect(isCustomItemId('partner-1730000000000')).toBe(true);
    expect(isCustomItemId('t-passport')).toBe(false);
  });

  it('reads the display category from the id when the column had to fall back', () => {
    expect(categoryOf({ item_id: 'custom:partner:abc', category: 'mom' })).toBe('partner');
    expect(categoryOf({ item_id: 'custom:bogus:abc', category: 'baby' })).toBe('baby');
    expect(categoryOf({ item_id: 'partner-1', category: 'documents' })).toBe('documents');
    expect(categoryOf({ item_id: 'x', category: 'weird' })).toBe('mom');
  });

  it('writes "partner" only when the database accepts it', () => {
    expect(dbCategoryFor('partner', true)).toBe('partner');
    expect(dbCategoryFor('partner', false)).toBe('mom');
    expect(dbCategoryFor('baby', false)).toBe('baby');
  });

  it('cleans item names', () => {
    expect(cleanItemName('  phone   charger ')).toBe('phone charger');
    expect(cleanItemName('   ')).toBe('');
    expect(cleanItemName('x'.repeat(200))).toHaveLength(80);
  });
});

describe('mergeBagItems', () => {
  it('lists templates in order with translated names, then orphan rows, then own items oldest first', () => {
    const rows = [
      row({ item_id: 'custom:mom:b', item_name: 'Snacks', category: 'mom', created_at: '2026-11-03T00:00:00Z' }),
      row({ item_id: 't-gown', item_name: 'Xalat', category: 'mom', is_checked: true }),
      row({ item_id: 'partner-1', item_name: 'Charger', category: 'documents', added_by: 'partner', created_at: '2026-11-02T00:00:00Z' }),
      row({ item_id: 't-passport' }),
      row({ item_id: 't-removed', item_name: 'Old template', category: 'baby' }),
    ];
    const items = mergeBagItems(rows, templates);
    expect(items.map((i) => i.item_id)).toEqual(['t-passport', 't-gown', 't-removed', 'partner-1', 'custom:mom:b']);
    expect(items[0]).toMatchObject({ item_name: 'Passport', notes: 'ID', priority: 1, custom: false, virtual: false });
    expect(items[1]).toMatchObject({ item_name: 'Gown', is_checked: true });
    expect(items[2]).toMatchObject({ item_name: 'Old template', custom: false });
    expect(items[3]).toMatchObject({ custom: true, added_by: 'partner', category: 'documents' });
    expect(items[4]).toMatchObject({ custom: true, item_name: 'Snacks' });
  });

  it('adds missing active templates as virtual items only for the owner', () => {
    const rows = [row({ item_id: 't-passport' })];
    const owner = mergeBagItems(rows, templates, { includeMissingTemplates: true });
    expect(owner.map((i) => [i.item_id, i.virtual])).toEqual([['t-passport', false], ['t-gown', true], ['t-diapers', true]]);
    expect(owner[1].id).toBe('tpl:t-gown');
    expect(mergeBagItems(rows, templates).map((i) => i.item_id)).toEqual(['t-passport']);
  });

  it('marks hidden items from the column or from this device', () => {
    const rows = [row({ item_id: 't-passport', is_hidden: true }), row({ item_id: 't-gown' }), row({ item_id: 't-diapers' })];
    const items = mergeBagItems(rows, templates, { localHidden: ['t-diapers'] });
    expect(items.filter((i) => i.hidden).map((i) => i.item_id)).toEqual(['t-passport', 't-diapers']);
    expect(visibleBagItems(items).map((i) => i.item_id)).toEqual(['t-gown']);
  });

  it('keeps one entry per item_id', () => {
    const items = mergeBagItems([row({ id: 'a', item_id: 't-gown' }), row({ id: 'b', item_id: 't-gown' })], templates);
    expect(items.map((i) => i.id)).toEqual(['a']);
  });

  it('shows a "partner" item in its group even when stored as "mom"', () => {
    const [item] = mergeBagItems([row({ item_id: 'custom:partner:x', category: 'mom', item_name: 'Snacks for dad' })], []);
    expect(item.category).toBe('partner');
  });
});

describe('counts and seeding', () => {
  it('counts only visible items', () => {
    const items = mergeBagItems([
      row({ item_id: 't-passport', is_checked: true }),
      row({ item_id: 't-gown', is_checked: true, is_hidden: true }),
      row({ item_id: 't-diapers' }),
    ], templates);
    expect(bagCounts(items)).toEqual({ checked: 1, total: 2, progress: 50 });
    expect(bagCounts([])).toEqual({ checked: 0, total: 0, progress: 0 });
  });

  it('creates rows only for active templates that have none', () => {
    const missing = missingTemplateRows([{ item_id: 't-passport' }], templates, 'mom');
    expect(missing.map((m) => m.item_id)).toEqual(['t-gown', 't-diapers']);
    expect(missing[0]).toEqual({ user_id: 'mom', item_id: 't-gown', item_name: 'Gown', category: 'mom', is_checked: false, priority: 2, notes: null });
  });
});

describe('migration tolerance helpers', () => {
  afterEach(() => localStorage.clear());

  it('recognises a missing column and a check violation', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: '23514' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
    expect(isCheckViolation({ code: '23514' })).toBe(true);
  });

  it('remembers hidden default items per bag owner on this device', () => {
    expect(readLocalHidden('mom')).toEqual([]);
    writeLocalHidden('mom', toggleHidden([], 't-gown', true));
    expect(readLocalHidden('mom')).toEqual(['t-gown']);
    expect(readLocalHidden('other')).toEqual([]);
    writeLocalHidden('mom', toggleHidden(readLocalHidden('mom'), 't-gown', false));
    expect(readLocalHidden('mom')).toEqual([]);
    localStorage.setItem('anacan.hospital-bag.hidden.mom', '{bad json');
    expect(readLocalHidden('mom')).toEqual([]);
  });
});
