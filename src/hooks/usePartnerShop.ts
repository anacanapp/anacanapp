import { useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { storefrontFromRpc, type ShopCollection, type Storefront } from '@/lib/partner-shop';

// The partner RPCs are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const EMPTY: Storefront = { partners: new Map(), products: [] };

/**
 * Partner products the server lets this user see (shop_storefront_v1): live partners for everyone,
 * admin_only/paused partners for admins and the partner's own members. Missing RPC → empty storefront.
 */
export function usePartnerStorefront() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['partner-storefront', getBackendConfig().url, user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Storefront> => {
      const { data, error } = await db.rpc('shop_storefront_v1');
      if (error) return EMPTY;
      return storefrontFromRpc(data);
    },
  });
}

export function useInvalidateStorefront() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['partner-storefront'] });
}

/* Measurements for the partner panel. Impressions are batched (the server also dedups them per day). */
type ShopEvent = 'impression' | 'open' | 'add' | 'site' | 'bundle';
const pending = new Map<string, Set<string>>();
let timer: ReturnType<typeof setTimeout> | null = null;
function send(ids: string[], event: ShopEvent, placement: string) {
  if (!ids.length) return;
  try { void db.rpc('shop_partner_track_v1', { p_products: ids.slice(0, 60), p_event: event, p_placement: placement }).then(() => undefined, () => undefined); } catch { /* never blocks */ }
}
export function trackShopImpressions(ids: string[], placement: string) {
  if (!ids.length) return;
  const set = pending.get(placement) || new Set<string>();
  ids.forEach((id) => set.add(id));
  pending.set(placement, set);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    pending.forEach((s, place) => send([...s], 'impression', place));
    pending.clear();
  }, 1500);
}
export const trackShopEvent = (id: string | string[], event: Exclude<ShopEvent, 'impression'>, placement: string) =>
  send(Array.isArray(id) ? id : [id], event, placement);

/* Basket: kept on the device (phase 1 checks out on the partner's site, nothing is ordered through Anacan yet). */
const BASKET_KEY = 'anacan_partner_basket_v1';
const LEGACY_KEY = 'anacan_olivia_basket_v1';
type Basket = Record<string, number>;
let basket: Basket = (() => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(BASKET_KEY) ?? localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Basket : {};
  } catch { return {}; }
})();
const listeners = new Set<() => void>();
function setBasket(next: Basket) {
  basket = next;
  try { localStorage.setItem(BASKET_KEY, JSON.stringify(next)); localStorage.removeItem(LEGACY_KEY); } catch { /* storage may be blocked */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function usePartnerBasket() {
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
let pendingCollection: ShopCollection | null = null;
export const requestShopCollection = (c: ShopCollection | null) => { pendingCollection = c; };
export const takeShopCollection = () => { const c = pendingCollection; pendingCollection = null; return c; };
