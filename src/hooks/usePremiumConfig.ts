import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { localizePremiumRows } from '@/lib/premium-i18n';

export interface PremiumFeature {
  id: string;
  title: string;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  icon: string;
  is_included_free: boolean;
  is_included_premium: boolean;
  is_included_premium_plus: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremiumPlan {
  id: string;
  plan_key: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  badge_text: string | null;
  badge_text_az: string | null;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const usePremiumConfig = () => {
  const [features, setFeatures] = useState<PremiumFeature[]>([]);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useUserStore((state) => state.language);

  const fetchData = async () => {
    try {
      const [featuresRes, plansRes] = await Promise.all([
        supabase
          .from('premium_features')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('premium_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
      ]);

      if (featuresRes.error) throw featuresRes.error;
      if (plansRes.error) throw plansRes.error;

      // Keep source rows: a slower request must not overwrite the current
      // language with text localized for a previous render.
      setFeatures((featuresRes.data || []) as PremiumFeature[]);
      setPlans((plansRes.data || []) as PremiumPlan[]);
    } catch (error) {
      console.error('Error fetching premium config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const translatedFeatures = useMemo(() => localizePremiumRows(features, language, ['title', 'description']), [features, language]);
  const translatedPlans = useMemo(() => localizePremiumRows(plans, language, ['name', 'description', 'badge_text']), [plans, language]);

  return {
    features: translatedFeatures,
    plans: translatedPlans,
    loading,
    refetch: fetchData
  };
};

// Admin hook
export const useAdminPremiumConfig = () => {
  const [features, setFeatures] = useState<PremiumFeature[]>([]);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [featuresRes, plansRes] = await Promise.all([
        supabase
          .from('premium_features')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('premium_plans')
          .select('*')
          .order('sort_order', { ascending: true })
      ]);

      if (featuresRes.error) throw featuresRes.error;
      if (plansRes.error) throw plansRes.error;

      setFeatures((featuresRes.data || []) as PremiumFeature[]);
      setPlans((plansRes.data || []) as PremiumPlan[]);
    } catch (error) {
      console.error('Error fetching premium config:', error);
    } finally {
      setLoading(false);
    }
  };

  // Feature CRUD
  const createFeature = async (feature: Omit<PremiumFeature, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase.from('premium_features').insert(feature);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateFeature = async (id: string, updates: Partial<PremiumFeature>) => {
    try {
      const { error } = await supabase
        .from('premium_features')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteFeature = async (id: string) => {
    try {
      const { error } = await supabase.from('premium_features').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Plan CRUD
  const updatePlan = async (id: string, updates: Partial<PremiumPlan>) => {
    try {
      const { error } = await supabase
        .from('premium_plans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    features,
    plans,
    loading,
    createFeature,
    updateFeature,
    deleteFeature,
    updatePlan,
    refetch: fetchData
  };
};
