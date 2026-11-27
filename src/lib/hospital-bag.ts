/**
 * Hospital bag list logic shared by the mother's checklist (useHospitalBag) and the partner's view
 * (usePartnerHospitalBag). Rows live in public.hospital_bag_items (one row per user + item_id).
 *
 * - Default items come from hospital_bag_templates (item_id = template id). They can be hidden, never deleted.
 * - Own items have item_id `custom:<category>:<uuid>` (older partner items: `partner-<ms>`) and can be deleted.
 *   The category is kept in the id too, so a "partner" item still shows in the right group while the
 *   20261108150000_hospital_bag_custom migration (which allows category 'partner' and adds is_hidden) is not applied.
 * - Without the is_hidden column, hidden default items are remembered on this device only.
 */

export type BagCategory = 'mom' | 'baby' | 'documents' | 'partner';
export const BAG_CATEGORIES: BagCategory[] = ['documents', 'mom', 'baby', 'partner'];
/** Categories the original check constraint accepts (before the migration). */
export const LEGACY_DB_CATEGORIES: BagCategory[] = ['mom', 'baby', 'documents'];
export const CUSTOM_NAME_MAX = 80;

export interface BagRow {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  category: string;
  is_checked: boolean;
  priority?: number | null;
  notes?: string | null;
  added_by?: string | null;
  is_hidden?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface BagTemplate {
  id: string;
  item_name: string;
  category: string;
  priority?: number | null;
  notes?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface BagItem {
  /** Row id, or `tpl:<template id>` for a default item that has no row yet. */
  id: string;
  user_id: string | null;
  item_id: string;
  item_name: string;
  category: BagCategory;
  is_checked: boolean;
  priority: number;
  notes: string | null;
  added_by: string | null;
  custom: boolean;
  hidden: boolean;
  /** A default item without a database row yet (created on the first change). */
  virtual: boolean;
  created_at: string;
  updated_at: string;
}

const isCategory = (value: unknown): value is BagCategory =>
  value === 'mom' || value === 'baby' || value === 'documents' || value === 'partner';

export const isCustomItemId = (itemId: string): boolean => itemId.startsWith('custom:') || itemId.startsWith('partner-');

export function customItemId(category: BagCategory, uuid: string): string {
  return `custom:${category}:${uuid}`;
}

/** The display category: the one encoded in a custom id wins over the stored column. */
export function categoryOf(row: Pick<BagRow, 'item_id' | 'category'>): BagCategory {
  const encoded = row.item_id.startsWith('custom:') ? row.item_id.split(':')[1] : null;
  if (isCategory(encoded)) return encoded;
  return isCategory(row.category) ? row.category : 'mom';
}

/** The value written to the category column; 'partner' falls back to 'mom' while the old constraint is in place. */
export const dbCategoryFor = (category: BagCategory, partnerAllowed: boolean): BagCategory =>
  category === 'partner' && !partnerAllowed ? 'mom' : category;

/** Trimmed, single-spaced, at most CUSTOM_NAME_MAX characters; empty when nothing is left. */
export const cleanItemName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX).trim();

export interface MergeOptions {
  /** item_ids hidden on this device (used when the database has no is_hidden column). */
  localHidden?: Iterable<string>;
  /** Add default items that have no row yet as `virtual` items (the owner's checklist). */
  includeMissingTemplates?: boolean;
}

/**
 * One list from the rows and the templates: templates in their order (with translated name / notes), then
 * rows whose template no longer exists, then own items oldest first.
 */
export function mergeBagItems(rows: BagRow[], templates: BagTemplate[], options: MergeOptions = {}): BagItem[] {
  const localHidden = new Set(options.localHidden ?? []);
  const byItemId = new Map<string, BagRow>();
  for (const row of rows) if (!byItemId.has(row.item_id)) byItemId.set(row.item_id, row);

  const fromRow = (row: BagRow, template?: BagTemplate): BagItem => ({
    id: row.id,
    user_id: row.user_id,
    item_id: row.item_id,
    item_name: template?.item_name || row.item_name,
    category: template && isCategory(template.category) ? template.category : categoryOf(row),
    is_checked: !!row.is_checked,
    priority: template?.priority ?? row.priority ?? 2,
    notes: template ? template.notes ?? null : row.notes ?? null,
    added_by: row.added_by ?? null,
    custom: isCustomItemId(row.item_id),
    hidden: !!row.is_hidden || localHidden.has(row.item_id),
    virtual: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  const sortedTemplates = [...templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const templateIds = new Set(sortedTemplates.map((t) => t.id));
  const items: BagItem[] = [];
  for (const template of sortedTemplates) {
    const row = byItemId.get(template.id);
    if (row) {
      items.push(fromRow(row, template));
    } else if (options.includeMissingTemplates && template.is_active !== false) {
      items.push({
        id: `tpl:${template.id}`, user_id: null, item_id: template.id, item_name: template.item_name,
        category: isCategory(template.category) ? template.category : 'mom', is_checked: false,
        priority: template.priority ?? 2, notes: template.notes ?? null, added_by: null, custom: false,
        hidden: localHidden.has(template.id), virtual: true, created_at: '', updated_at: '',
      });
    }
  }
  const rest = [...byItemId.values()].filter((row) => !templateIds.has(row.item_id));
  const orphans = rest.filter((row) => !isCustomItemId(row.item_id)).sort((a, b) => a.item_id.localeCompare(b.item_id));
  const custom = rest.filter((row) => isCustomItemId(row.item_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.item_id.localeCompare(b.item_id));
  for (const row of [...orphans, ...custom]) items.push(fromRow(row));
  return items;
}

/** Templates that have no row yet (the owner's checklist creates them so the partner sees the same list). */
export function missingTemplateRows(rows: Pick<BagRow, 'item_id'>[], templates: BagTemplate[], userId: string) {
  const have = new Set(rows.map((r) => r.item_id));
  return templates
    .filter((t) => t.is_active !== false && !have.has(t.id))
    .map((t) => ({
      user_id: userId,
      item_id: t.id,
      item_name: t.item_name,
      category: isCategory(t.category) && t.category !== 'partner' ? t.category : 'mom',
      is_checked: false,
      priority: t.priority ?? 2,
      notes: t.notes ?? null,
    }));
}

export const visibleBagItems = (items: BagItem[]): BagItem[] => items.filter((i) => !i.hidden);

export function bagCounts(items: BagItem[]): { checked: number; total: number; progress: number } {
  const visible = visibleBagItems(items);
  const checked = visible.filter((i) => i.is_checked).length;
  return { checked, total: visible.length, progress: visible.length ? (checked / visible.length) * 100 : 0 };
}

/** PostgREST / Postgres errors meaning "this column does not exist yet" (migration not applied). */
export const isMissingColumnError = (error: { code?: string | null } | null | undefined): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204');

/** Check-constraint violation (category 'partner' before the migration). */
export const isCheckViolation = (error: { code?: string | null } | null | undefined): boolean => !!error && error.code === '23514';

// ── Device fallback for hidden default items ───────────────────────────────────────────
const hiddenKey = (ownerUserId: string) => `anacan.hospital-bag.hidden.${ownerUserId}`;

export function readLocalHidden(ownerUserId: string): string[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(hiddenKey(ownerUserId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 500) : [];
  } catch {
    return [];
  }
}

export function writeLocalHidden(ownerUserId: string, itemIds: string[]): void {
  try { globalThis.localStorage?.setItem(hiddenKey(ownerUserId), JSON.stringify([...new Set(itemIds)].slice(0, 500))); } catch {/* not remembered */}
}

/** Toggle one item_id in a hidden list. */
export const toggleHidden = (list: string[], itemId: string, hidden: boolean): string[] =>
  hidden ? [...new Set([...list, itemId])] : list.filter((id) => id !== itemId);
