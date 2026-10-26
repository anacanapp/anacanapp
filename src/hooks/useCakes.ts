import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mapRowsTranslation, getPersistedLanguage } from '@/lib/tr';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

export interface Cake {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  images: string[];
  category: string;
  month_number: number | null;
  milestone_type: string | null;
  milestone_label: string | null;
  is_active: boolean;
  sort_order: number;
  has_custom_fields: boolean;
  custom_field_labels: string[];
  created_at: string;
  updated_at: string;
}

export interface CakeOrder {
  id: string;
  user_id: string;
  cake_id: string | null;
  customer_name: string;
  custom_text: string | null;
  child_name: string | null;
  child_age_months: number | null;
  custom_fields: Record<string, string>;
  notes: string | null;
  status: string;
  total_price: number;
  contact_phone: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
  cake?: Cake;
}

export const useCakes = () => {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCakes = async () => {
    try {
      const { data, error } = await supabase
        .from('cakes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCakes(mapRowsTranslation(data || [], getPersistedLanguage(), ['name', 'description', 'milestone_label']) as unknown as Cake[]);
    } catch (error) {
      console.error('Error fetching cakes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCakes();
  }, []);

  const getCakesByMonth = (month: number) => cakes.filter(c => c.category === 'month' && c.month_number === month);
  const getMilestoneCakes = () => cakes.filter(c => c.category === 'milestone');
  const getAllMonthCakes = () => cakes.filter(c => c.category === 'month');

  return { cakes, loading, getCakesByMonth, getMilestoneCakes, getAllMonthCakes, refetch: fetchCakes };
};

export const useCakeOrders = () => {
  const [orders, setOrders] = useState<CakeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchOrders = async () => {
    if (!user) return;
    try {
      // DÜZƏLİŞ: limitsiz idi — admin üçün (RLS bütün sifarişləri göstərir)
      // cake_orders 1000-i keçəndə AdminCakes.tsx yalnız ilk 1000 sifarişi görürdü.
      const data = await fetchAllRows((from, to) =>
        supabase.from('cake_orders').select('*').order('created_at', { ascending: false }).range(from, to)
      );
      setOrders((data || []) as unknown as CakeOrder[]);
    } catch (error) {
      console.error('Error fetching cake orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const createOrder = async (orderData: Omit<CakeOrder, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'cake'>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('cake_orders')
        .insert({ ...orderData, user_id: user.id } as any)
        .select()
        .single();

      if (error) throw error;
      await fetchOrders();
      return data;
    } catch (error) {
      console.error('Error creating cake order:', error);
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('cake_orders')
        .update({ status } as any)
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      return false;
    }
  };

  return { orders, loading, createOrder, updateOrderStatus, refetch: fetchOrders };
};

// Admin hook for managing all cakes
export const useAdminCakes = () => {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const { data, error } = await supabase
        .from('cakes')
        .select('*')
        .order('category', { ascending: true })
        .order('month_number', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCakes((data || []) as unknown as Cake[]);
    } catch (error) {
      console.error('Error fetching cakes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const addCake = async (cake: Partial<Cake>) => {
    try {
      const { error } = await supabase.from('cakes').insert(cake as any);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (error) {
      console.error('Error adding cake:', error);
      return false;
    }
  };

  const updateCake = async (id: string, updates: Partial<Cake>) => {
    try {
      const { error } = await supabase.from('cakes').update(updates as any).eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (error) {
      console.error('Error updating cake:', error);
      return false;
    }
  };

  const deleteCake = async (id: string) => {
    try {
      const { error } = await supabase.from('cakes').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (error) {
      console.error('Error deleting cake:', error);
      return false;
    }
  };

  return { cakes, loading, addCake, updateCake, deleteCake, refetch: fetchAll };
};
