import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { mapRowsTranslation } from '@/lib/tr';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { regionalCountry } from '@/lib/vaccine-schedule';
import { computeAptekTotals, isAptekAvailable, parseAptekConfig, type AptekConfig, type AptekCoupon } from '@/lib/aptek-pricing';

export interface AptekProduct {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  images: string[];
  brand: string | null;
  kind: string | null;
  min_age_months: number | null;
  volume: string | null;
  tags: string[];
  sales_count: number;
  stock: number | null;
  source_url: string | null;
}

export interface AptekCartLine { id: string; product_id: string; quantity: number; product: AptekProduct }

export interface AptekOrderItem { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; total_price: number }
export interface AptekOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number | null;
  discount_amount: number;
  shipping_fee: number;
  delivery_slot: string | null;
  payment_method: string | null;
  created_at: string;
  order_items?: AptekOrderItem[];
}

// The aptek columns are newer than the generated types; queries go through an untyped handle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const backendKey = () => getBackendConfig().url;

export const useAptekConfig = () => useQuery({
  queryKey: ['aptek-config', backendKey()],
  queryFn: async (): Promise<AptekConfig> => {
    const { data, error } = await db.rpc('get_aptek_config');
    if (error) return parseAptekConfig(null); // migration not applied yet → store stays hidden
    return parseAptekConfig(data);
  },
  staleTime: 5 * 60_000,
});

/** Whether the store is visible for this user (country + admin toggle; admins always). */
export function useAptekAvailable(): { available: boolean; config: AptekConfig | undefined } {
  const { profile, isAdmin } = useAuth();
  const language = useUserStore((s) => s.language);
  const storedCountry = useUserStore((s) => s.countryCode);
  const { data: config } = useAptekConfig();
  const country = regionalCountry(language, (profile as { country_code?: string } | null)?.country_code, storedCountry);
  return { available: isAptekAvailable(config, country, !!isAdmin), config };
}

export const useAptekProducts = (enabled = true) => {
  const language = useUserStore((s) => s.language);
  return useQuery({
    queryKey: ['aptek-products', backendKey(), language],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AptekProduct[]> => {
      const { data, error } = await db.from('products').select('*').eq('store', 'aptek').eq('is_active', true)
        .order('sales_count', { ascending: false }).limit(500);
      if (error) throw error;
      return (mapRowsTranslation(data || [], language, ['name', 'description', 'category']) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as AptekProduct),
        price: Number(r.price) || 0,
        original_price: r.original_price != null ? Number(r.original_price) : null,
        images: Array.isArray(r.images) && r.images.length ? (r.images as string[]) : r.image_url ? [String(r.image_url)] : [],
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
        sales_count: Number(r.sales_count) || 0,
      }));
    },
  });
};

export function useAptekCart() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useAptekProducts(!!user);
  const key = ['aptek-cart', backendKey(), user?.id];
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<{ id: string; product_id: string; quantity: number }[]> => {
      const { data, error } = await db.from('cart_items').select('id, product_id, quantity').eq('user_id', user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines: AptekCartLine[] = useMemo(
    () => rows.filter((r) => byId.has(r.product_id)).map((r) => ({ ...r, product: byId.get(r.product_id)! })),
    [rows, byId],
  );
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  const setQuantity = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (!user) throw new Error('AUTH');
      const existing = rows.find((r) => r.product_id === productId);
      const qty = Math.max(0, Math.min(20, Math.round(quantity)));
      if (qty === 0) {
        if (existing) {
          const { error } = await db.from('cart_items').delete().eq('id', existing.id).eq('user_id', user.id);
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await db.from('cart_items').update({ quantity: qty }).eq('id', existing.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('cart_items').insert({ user_id: user.id, product_id: productId, quantity: qty });
        if (error) throw error;
      }
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<typeof rows>(key) || [];
      const qty = Math.max(0, Math.min(20, Math.round(quantity)));
      const next = prev.some((r) => r.product_id === productId)
        ? prev.map((r) => (r.product_id === productId ? { ...r, quantity: qty } : r)).filter((r) => r.quantity > 0)
        : qty > 0 ? [...prev, { id: `tmp-${productId}`, product_id: productId, quantity: qty }] : prev;
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx) qc.setQueryData(key, ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: key }); },
  });

  const quantityOf = (productId: string) => rows.find((r) => r.product_id === productId)?.quantity || 0;
  const add = (productId: string, n = 1) => setQuantity.mutateAsync({ productId, quantity: quantityOf(productId) + n });

  return { lines, count, isLoading, quantityOf, add, setQuantity: (productId: string, quantity: number) => setQuantity.mutateAsync({ productId, quantity }) };
}

/** Looks up a coupon for the preview; the server re-validates at checkout. */
export async function fetchAptekCoupon(code: string): Promise<AptekCoupon | null> {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(clean)) return null;
  const { data } = await db.from('coupons').select('code, discount_type, discount_value, applicable_to, is_active, starts_at, expires_at, max_uses, used_count, min_order_amount')
    .ilike('code', clean).maybeSingle();
  return data ? { ...data, discount_value: Number(data.discount_value) } : null;
}

export function useAptekTotals(lines: AptekCartLine[], coupon?: AptekCoupon | null) {
  const { data: config } = useAptekConfig();
  return useMemo(() => computeAptekTotals(
    lines.map((l) => ({ sku: l.product.sku, price: l.product.price, quantity: l.quantity })),
    config || parseAptekConfig(null), coupon,
  ), [lines, config, coupon]);
}

export interface PlaceOrderInput {
  items: { product_id: string; quantity: number }[];
  coupon?: string | null;
  slot: string;
  payment: 'cash' | 'card_on_delivery';
  address: { line: string; name?: string };
  phone: string;
  notes?: string;
}

export function usePlaceAptekOrder() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlaceOrderInput) => {
      const { data, error } = await db.rpc('place_aptek_order', {
        p_items: input.items, p_coupon: input.coupon || null, p_slot: input.slot, p_payment: input.payment,
        p_address: input.address, p_phone: input.phone, p_notes: input.notes || null,
      });
      if (error) throw error;
      return data as { order_id: string; order_number: string; total: number };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['aptek-cart', backendKey(), user?.id] });
      void qc.invalidateQueries({ queryKey: ['aptek-orders', backendKey(), user?.id] });
      void qc.invalidateQueries({ queryKey: ['aptek-products'] });
    },
  });
}

/** Maps a checkout RPC error to a copy key. */
export function aptekErrorKey(error: unknown): string {
  const msg = String((error as { message?: string })?.message || '');
  const code = /APTEK_[A-Z_]+/.exec(msg)?.[0];
  switch (code) {
    case 'APTEK_BAD_COUPON': return 'coupon_invalid';
    case 'APTEK_OUT_OF_STOCK': return 'err_stock';
    case 'APTEK_BAD_PHONE': return 'err_phone';
    case 'APTEK_BAD_ADDRESS': return 'err_address';
    case 'APTEK_DISABLED': return 'err_disabled';
    default: return 'err_generic';
  }
}

export const useAptekOrders = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['aptek-orders', backendKey(), user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AptekOrder[]> => {
      const { data, error } = await db.from('orders').select('*, order_items(*)').eq('user_id', user!.id).eq('store', 'aptek')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });
};
