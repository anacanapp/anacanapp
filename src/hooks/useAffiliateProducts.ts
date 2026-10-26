import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr, mapRowsTranslation, mapRowTranslation } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';

export interface AffiliateProduct {
  id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  category: string;
  category_az: string | null;
  price: number | null;
  currency: string;
  original_price: number | null;
  affiliate_url: string;
  platform: string;
  image_url: string | null;
  images: string[];
  video_url: string | null;
  store_name: string | null;
  store_logo_url: string | null;
  rating: number;
  review_count: number;
  review_summary: string | null;
  review_summary_az: string | null;
  life_stages: string[];
  is_featured: boolean;
  is_active: boolean;
  price_updated_at: string | null;
  specifications: Record<string, string>;
  pros: string[] | null;
  cons: string[] | null;
  tags: string[] | null;
  created_at: string;
}

export const useAffiliateProducts = (lifeStage?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['affiliate-products', lifeStage, language],
    queryFn: async () => {
      let query = supabase.
      from('affiliate_products').
      select('*').
      eq('is_active', true).
      order('is_featured', { ascending: false }).
      order('sort_order', { ascending: true });

      // life_stages massivi ilə server-side üst-üstə düşmə (overlap) yoxlanışı —
      // əvvəllər BÜTÜN aktiv məhsullar çəkilib client-side filtrlənirdi.
      if (lifeStage) {
        query = query.overlaps('life_stages', [lifeStage]);
      }

      const { data, error } = await query;
      if (error) throw error;

      return mapRowsTranslation(data, language, ['name', 'description', 'category', 'review_summary']) as AffiliateProduct[];
    }
  });
};

export const useAffiliateProduct = (productId: string | null) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['affiliate-product', productId, language],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase.
      from('affiliate_products').
      select('*').
      eq('id', productId).
      maybeSingle();

      if (error) throw error;
      return mapRowTranslation(data, language, ['name', 'description', 'category', 'review_summary']) as AffiliateProduct | null;
    },
    enabled: !!productId
  });
};

export const useSavedProducts = () => {
  const { user } = useAuth();
  const language = useUserStore((state) => state.language);

  return useQuery({
    queryKey: ['saved-affiliate-products', user?.id, language],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.
      from('saved_affiliate_products').
      select(`
          id,
          created_at,
          product:affiliate_products(*)
        `).
      eq('user_id', user.id).
      order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map((item) => {
        const product = mapRowTranslation(item.product as any, language, ['name', 'description', 'category', 'review_summary']);
        return {
          savedId: item.id,
          savedAt: item.created_at,
          ...(product as unknown as AffiliateProduct)
        };
      }) || [];
    },
    enabled: !!user?.id
  });
};

export const useIsProductSaved = (productId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-product-saved', productId, user?.id],
    queryFn: async () => {
      if (!user?.id || !productId) return false;

      const { data, error } = await supabase.
      from('saved_affiliate_products').
      select('id').
      eq('user_id', user.id).
      eq('product_id', productId).
      maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id && !!productId
  });
};

export const useSaveProduct = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!user?.id) throw new Error(tr("useaffiliateproducts_giris_etmelisiniz_6c2220", "Giri\u015F etm\u0259lisiniz"));

      const { error } = await supabase.
      from('saved_affiliate_products').
      insert({ user_id: user.id, product_id: productId });

      if (error) throw error;
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: ['saved-affiliate-products'] });
      queryClient.invalidateQueries({ queryKey: ['is-product-saved', productId] });
      toast({ title: tr("useaffiliateproducts_yadda_saxlanildi_cf4f4a", "Yadda saxlanıldı"), description: tr("useaffiliateproducts_mehsul_favoritlere_elave_edildi_748bcf", "Məhsul favoritlərə əlavə edildi") });
    },
    onError: () => {
      toast({ title: tr("useaffiliateproducts_xeta_3cdbb6", "Xəta"), description: tr("useaffiliateproducts_mehsul_saxlanila_bilmedi_b71bb7", "Məhsul saxlanıla bilmədi"), variant: 'destructive' });
    }
  });
};

export const useUnsaveProduct = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!user?.id) throw new Error(tr("useaffiliateproducts_giris_etmelisiniz_6c2220", "Giri\u015F etm\u0259lisiniz"));

      const { error } = await supabase.
      from('saved_affiliate_products').
      delete().
      eq('user_id', user.id).
      eq('product_id', productId);

      if (error) throw error;
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: ['saved-affiliate-products'] });
      queryClient.invalidateQueries({ queryKey: ['is-product-saved', productId] });
      toast({ title: 'Silindi', description: tr("useaffiliateproducts_mehsul_favoritlerden_silindi_d9717b", "Məhsul favoritlərdən silindi") });
    }
  });
};