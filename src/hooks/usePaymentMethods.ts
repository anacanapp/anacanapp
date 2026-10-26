import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface PaymentMethod {
  id: string;
  method_key: string;
  label: string;
  label_az: string | null;
  description: string | null;
  description_az: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const usePaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useUserStore((state) => state.language);

  const fetchMethods = async () => {
    try {
      // Use safe RPC that excludes sensitive `config` column from public reads
      const { data, error } = await supabase.rpc('get_active_payment_methods' as any);

      if (error) throw error;
      // `config` is intentionally not returned; default to empty object for type compatibility
      const normalized = (data || []).map((m: any) => ({ ...m, config: {} }));
      const translated = mapRowsTranslation(normalized, language, ['label', 'description']) as PaymentMethod[];
      setMethods(translated);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, [language]);

  const getActiveMethods = () => methods.filter(m => m.is_active);

  const updateMethod = async (id: string, updates: Partial<PaymentMethod>) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      await fetchMethods();
      return true;
    } catch (error) {
      console.error('Error updating payment method:', error);
      return false;
    }
  };

  return { methods, loading, getActiveMethods, updateMethod, refetch: fetchMethods };
};

// Admin-only variant: reads the FULL row (including the sensitive `config`
// JSONB — card number/holder/bank name for c2c_transfer) directly from the
// table instead of the public `get_active_payment_methods()` RPC, which
// deliberately strips `config` for every caller. `payment_methods` RLS
// grants admins full-row access ("Admins can manage payment methods" FOR
// ALL), so this is safe — a non-admin calling this will just get 0 rows.
// Previously AdminCakes.tsx reused the public hook, so its "Kartdan Karta"
// config editor always opened blank and could blindly overwrite real
// customer-facing bank-transfer details without ever showing the current
// values.
export const useAdminPaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setMethods((data || []) as unknown as PaymentMethod[]);
    } catch (error) {
      console.error('Error fetching payment methods (admin):', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const updateMethod = async (id: string, updates: Partial<PaymentMethod>) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      await fetchMethods();
      return true;
    } catch (error) {
      console.error('Error updating payment method:', error);
      return false;
    }
  };

  return { methods, loading, updateMethod, refetch: fetchMethods };
};
