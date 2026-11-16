import { useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { OLIVIA_STORE, oliviaFromRow, type OliviaCollection, type OliviaProduct } from '@/lib/olivia-shop';

// store/sku/tags/source_url are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const keyOf = () => ['olivia-products', getBackendConfig().url];

/**
 * Olivia rows (inactive, so RLS returns them to admins only). Disabled for non-admins,
 * which keeps every Olivia surface empty for them.
 */
export function useOliviaProducts() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: keyOf(),
    enabled: !!isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OliviaProduct[]> => {
      const { data, error } = await db.from('products').select('*').eq('store', OLIVIA_STORE)
        .order('sales_count', { ascending: false }).limit(500);
      if (error) throw error;
      return ((data || []) as Record<string, unknown>[]).map(oliviaFromRow).filter((p): p is OliviaProduct => !!p);
    },
  });
}

export function useInvalidateOlivia() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['olivia-products'] });
}

/* Basket: kept on the device (phase 1 checks out on olivia.az, nothing is ordered through Anacan yet). */
const BASKET_KEY = 'anacan_olivia_basket_v1';
type Basket = Record<string, number>;
let basket: Basket = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BASKET_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Basket : {};
  } catch { return {}; }
})();
const listeners = new Set<() => void>();
function setBasket(next: Basket) {
  basket = next;
  try { localStorage.setItem(BASKET_KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useOliviaBasket() {
  const items = useSyncExternalStore(subscribe, () => basket, () => basket);
  return {
    items,
    count: Object.values(items).reduce((a, b) => a + b, 0),
    qty: (id: string) => items[id] || 0,
    set: (id: string, n: number) => {
      const next = { ...basket };
      const q = Math.max(0, Math.min(20, Math.round(n)));
      if (q) next[id] = q; else delete next[id];
      setBasket(next);
    },
    addMany: (ids: string[]) => {
      const next = { ...basket };
      ids.forEach((id) => { if (!next[id]) next[id] = 1; });
      setBasket(next);
    },
    clear: () => setBasket({}),
  };
}

/* Which collection the shop opens on, set by a home promo right before it navigates to the shop. */
let pendingCollection: OliviaCollection | null = null;
export const requestOliviaCollection = (c: OliviaCollection | null) => { pendingCollection = c; };
export const takeOliviaCollection = () => { const c = pendingCollection; pendingCollection = null; return c; };
