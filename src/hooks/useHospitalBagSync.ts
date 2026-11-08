import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  bagCounts, cleanItemName, customItemId, dbCategoryFor, isCheckViolation, isMissingColumnError, mergeBagItems,
  missingTemplateRows, readLocalHidden, toggleHidden, writeLocalHidden,
  type BagCategory, type BagItem, type BagRow, type BagTemplate,
} from '@/lib/hospital-bag';

/**
 * Shared data layer of the hospital bag for the owner (the mother, her own rows) and her linked partner
 * (the same rows through the partner RLS policies). Changes from the other phone arrive through Realtime:
 * INSERT / UPDATE filtered by the owner's user_id, DELETE matched by row id (Realtime does not filter deletes).
 * The list is also refetched when the app comes back to the foreground.
 */

// is_hidden and the 'partner' category come with 20261108150000_hospital_bag_custom (not in generated types yet).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns newer than the generated types
const bagTable = () => supabase.from('hospital_bag_items' as any) as any;

export type BagRole = 'owner' | 'partner';

export interface HospitalBagSync {
  items: BagItem[];
  loading: boolean;
  toggleItem: (itemId: string) => Promise<void>;
  addItem: (name: string, category: BagCategory) => Promise<{ data: BagItem | null; error: unknown }>;
  deleteItem: (itemId: string) => Promise<{ error: unknown }>;
  setHidden: (itemId: string, hidden: boolean) => Promise<{ error: unknown }>;
  refetch: () => Promise<void>;
  checkedCount: number;
  totalCount: number;
  progress: number;
}

export function useHospitalBagSync(ownerUserId: string | null, role: BagRole, templates: BagTemplate[], ready = true): HospitalBagSync {
  const [rows, setRows] = useState<BagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [localHidden, setLocalHidden] = useState<string[]>([]);
  // null = unknown; false after a "column does not exist" / check-violation answer (migration not applied).
  const hiddenColumn = useRef<boolean | null>(null);
  const partnerCategory = useRef<boolean | null>(null);
  const rowsRef = useRef<BagRow[]>([]);
  rowsRef.current = rows;
  const fetchSeq = useRef(0);
  const seeding = useRef(false);

  useEffect(() => {
    setLocalHidden(ownerUserId ? readLocalHidden(ownerUserId) : []);
  }, [ownerUserId]);

  const fetchRows = useCallback(async () => {
    if (!ownerUserId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const seq = ++fetchSeq.current;
    try {
      const { data, error } = await bagTable().select('*').eq('user_id', ownerUserId).order('item_id');
      if (error) throw error;
      if (seq !== fetchSeq.current) return;
      let next = (data ?? []) as BagRow[];
      if (next.length && hiddenColumn.current === null) hiddenColumn.current = 'is_hidden' in next[0];
      // The owner keeps one row per default item so the partner sees the same list (new templates included).
      if (role === 'owner' && templates.length && !seeding.current) {
        const missing = missingTemplateRows(next, templates, ownerUserId);
        if (missing.length) {
          seeding.current = true;
          try {
            const { data: inserted, error: insertError } = await bagTable()
              .upsert(missing, { onConflict: 'user_id,item_id', ignoreDuplicates: true })
              .select();
            if (!insertError && inserted && seq === fetchSeq.current) next = [...next, ...(inserted as BagRow[])];
          } finally {
            seeding.current = false;
          }
        }
      }
      if (seq === fetchSeq.current) setRows(next);
    } catch (error) {
      console.error('Error fetching hospital bag items:', error);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [ownerUserId, role, templates]);

  useEffect(() => {
    if (!ready) return;
    void fetchRows();
  }, [fetchRows, ready]);

  // Realtime + foreground refetch.
  useEffect(() => {
    if (!ownerUserId || !ready) return;
    const channel = supabase
      .channel(`hospital_bag_items_changes:${role}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hospital_bag_items', filter: `user_id=eq.${ownerUserId}` }, () => { void fetchRows(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospital_bag_items', filter: `user_id=eq.${ownerUserId}` }, () => { void fetchRows(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hospital_bag_items' }, (payload: { old?: { id?: string } }) => {
        const id = payload.old?.id;
        if (id && rowsRef.current.some((r) => r.id === id)) setRows((prev) => prev.filter((r) => r.id !== id));
      })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchRows(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [ownerUserId, role, ready, fetchRows]);

  const items = useMemo(
    () => mergeBagItems(rows, templates, { localHidden, includeMissingTemplates: role === 'owner' }),
    [rows, templates, localHidden, role]
  );

  /** The row of an item, created first for a default item that has none yet. */
  const ensureRow = useCallback(async (itemId: string): Promise<BagRow | null> => {
    const existing = rowsRef.current.find((r) => r.item_id === itemId);
    if (existing || !ownerUserId) return existing ?? null;
    const [seed] = missingTemplateRows([], templates.filter((t) => t.id === itemId), ownerUserId);
    if (!seed) return null;
    const { data, error } = await bagTable().upsert(seed, { onConflict: 'user_id,item_id' }).select().single();
    if (error || !data) return null;
    setRows((prev) => (prev.some((r) => r.item_id === itemId) ? prev : [...prev, data as BagRow]));
    return data as BagRow;
  }, [ownerUserId, templates]);

  const toggleItem = useCallback(async (itemId: string) => {
    if (!ownerUserId) return;
    const row = await ensureRow(itemId);
    if (!row) return;
    const next = !row.is_checked;
    setRows((prev) => prev.map((r) => (r.item_id === itemId ? { ...r, is_checked: next } : r)));
    const { error } = await bagTable().update({ is_checked: next }).eq('user_id', ownerUserId).eq('item_id', itemId);
    if (error) {
      console.error('Error toggling hospital bag item:', error);
      setRows((prev) => prev.map((r) => (r.item_id === itemId ? { ...r, is_checked: !next } : r)));
    }
  }, [ownerUserId, ensureRow]);

  const addItem = useCallback(async (name: string, category: BagCategory) => {
    const itemName = cleanItemName(name);
    if (!ownerUserId) return { data: null, error: 'No bag owner' };
    if (!itemName) return { data: null, error: 'Empty name' };
    const itemId = customItemId(category, crypto.randomUUID());
    const insert = (dbCategory: BagCategory) => bagTable()
      .insert({ user_id: ownerUserId, item_id: itemId, item_name: itemName, category: dbCategory, is_checked: false, priority: 2, added_by: role === 'partner' ? 'partner' : 'woman' })
      .select()
      .single();
    let result = await insert(dbCategoryFor(category, partnerCategory.current !== false));
    if (result.error && category === 'partner' && isCheckViolation(result.error)) {
      partnerCategory.current = false;
      result = await insert(dbCategoryFor(category, false));
    }
    if (result.error || !result.data) {
      console.error('Error adding hospital bag item:', result.error);
      return { data: null, error: result.error ?? 'Insert failed' };
    }
    const row = result.data as BagRow;
    setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
    return { data: mergeBagItems([row], [])[0] ?? null, error: null };
  }, [ownerUserId, role]);

  const deleteItem = useCallback(async (itemId: string) => {
    if (!ownerUserId) return { error: 'No bag owner' };
    const item = items.find((i) => i.item_id === itemId);
    if (!item || !item.custom) return { error: 'Only own items can be deleted' };
    const before = rowsRef.current;
    setRows((prev) => prev.filter((r) => r.item_id !== itemId));
    const { error } = await bagTable().delete().eq('user_id', ownerUserId).eq('item_id', itemId);
    if (error) {
      console.error('Error deleting hospital bag item:', error);
      setRows(before);
    }
    return { error: error ?? null };
  }, [ownerUserId, items]);

  const setHidden = useCallback(async (itemId: string, hidden: boolean) => {
    if (!ownerUserId) return { error: 'No bag owner' };
    const rememberOnDevice = () => {
      const next = toggleHidden(readLocalHidden(ownerUserId), itemId, hidden);
      writeLocalHidden(ownerUserId, next);
      setLocalHidden(next);
    };
    if (hiddenColumn.current === false) {
      rememberOnDevice();
      return { error: null };
    }
    const row = await ensureRow(itemId);
    if (!row) {
      rememberOnDevice();
      return { error: null };
    }
    setRows((prev) => prev.map((r) => (r.item_id === itemId ? { ...r, is_hidden: hidden } : r)));
    const { error } = await bagTable().update({ is_hidden: hidden }).eq('user_id', ownerUserId).eq('item_id', itemId);
    if (error && isMissingColumnError(error)) {
      hiddenColumn.current = false;
      setRows((prev) => prev.map((r) => (r.item_id === itemId ? { ...r, is_hidden: undefined } : r)));
      rememberOnDevice();
      return { error: null };
    }
    if (error) {
      console.error('Error hiding hospital bag item:', error);
      setRows((prev) => prev.map((r) => (r.item_id === itemId ? { ...r, is_hidden: !hidden } : r)));
      return { error };
    }
    hiddenColumn.current = true;
    // A device copy from before the migration is no longer needed for this item.
    if (localHidden.includes(itemId) && !hidden) rememberOnDevice();
    return { error: null };
  }, [ownerUserId, ensureRow, localHidden]);

  const counts = bagCounts(items);
  return {
    items, loading, toggleItem, addItem, deleteItem, setHidden, refetch: fetchRows,
    checkedCount: counts.checked, totalCount: counts.total, progress: counts.progress,
  };
}
