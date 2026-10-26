import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { mapRowsTranslation } from '@/lib/tr';
import { getBackendConfig } from '@/integrations/supabase/backend-config';

export type BannerPlacement = 
  | 'home_top' 
  | 'home_middle' 
  | 'home_bottom' 
  | 'tools_top' 
  | 'tools_bottom' 
  | 'profile_top' 
  | 'community_top' 
  | 'ai_chat_top';

export type BannerType = 'native' | 'image';
export type LinkType = 'external' | 'internal' | 'tool' | 'lead_form';
export type LifeStageTarget = 'flow' | 'bump' | 'mommy' | 'partner';

export interface Banner {
  id: string;
  title: string;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  image_url: string | null;
  link_url: string | null;
  link_type: LinkType;
  placement: BannerPlacement;
  banner_type: BannerType;
  background_color: string | null;
  text_color: string | null;
  button_text: string | null;
  button_text_az: string | null;
  is_active: boolean;
  is_premium_only: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  click_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  /** Hədəf mərhələlər — NULL/boş = bütün mərhələlərə (flow/bump/mommy/partner) göstərilir */
  target_life_stages: LifeStageTarget[] | null;
  /** Hədəf dillər — NULL/boş = bütün dillərə göstərilir */
  target_languages: string[] | null;
  /** Hədəf ölkələr (ISO alpha-2) — NULL/boş = bütün ölkələrə göstərilir */
  target_countries: string[] | null;
  /** Limitsiz üçün NULL — təyin olunubsa istifadəçi bu sayda gördükdən sonra göstərilmir */
  max_impressions_per_user: number | null;
  branded?: boolean;
  measurement_version?: number;
  creative_revision?: number;
  sponsor_name?: string;
  sponsor_logo?: string | null;
  /** anacan-brand-ads-v3 (get_banner_inventory_v3); absent on v2/legacy rows */
  audience_tiers?: ('free' | 'premium')[] | null;
  native_template?: string | null;
  creative_options?: { offer_code?: string | null; expert_name?: string | null; expert_role?: string | null } | null;
  lead_form_id?: string | null;
  lead_form?: boolean;
  target_pregnancy_week_min?: number | null;
  target_pregnancy_week_max?: number | null;
  target_pregnancy_weeks?: number[] | null;
  target_child_age_min_days?: number | null;
  target_child_age_max_days?: number | null;
  }

/**
 * Bannerləri gətirir — TAM hədəfləmə (targeting) tətbiq olunur:
 *   1) placement (əvvəlki kimi)
 *   2) mərhələ (life_stage) — server-side .or() filtri
 *   3) dil — server-side .or() filtri
 *   4) ölkə — server-side .or() filtri
 *   5) İmpression tezlik limiti (max_impressions_per_user) — client-side post-filter,
 *      yalnız limiti olan bannerlər üçün ayrıca sorğu ilə (əksəriyyət limitsiz olacaq deyə
 *      lazımsız sorğudan qaçınmaq üçün)
 *   6) is_premium_only — BannerSlot.tsx-də (mövcud, dəyişməz qalır)
 */
/** Backends without the v3 runtime, remembered for this app session to avoid a failing call per slot. */
const inventoryV3Missing = new Set<string>();

export const useBanners = (placement?: BannerPlacement) => {
  const language = useUserStore((state) => state.language);
  const storeCountryCode = useUserStore((state) => state.countryCode);
  const { user, profile } = useAuth();
  const lifeStage = profile?.life_stage;
  const countryCode = ((profile as any)?.country_code || storeCountryCode || '').toUpperCase();

  return useQuery({
    queryKey: ['banners', getBackendConfig().url, placement, language, lifeStage, countryCode, user?.id],
    queryFn: async ({ signal }) => {
      if (user && placement) {
        // v3 evaluates tier/pregnancy-week/child-age targeting server-side; v2 is the
        // compatibility path until the v3 runtime is installed on this backend.
        const backend = getBackendConfig().url;
        for (const rpc of ['get_banner_inventory_v3', 'get_banner_inventory_v2']) {
          if (rpc.endsWith('v3') && inventoryV3Missing.has(backend)) continue;
          const { data, error } = await (supabase as any).rpc(rpc, { p_actor: user.id, p_placement: placement, p_language: language }).abortSignal(signal);
          if (!error) return mapRowsTranslation(data || [], language, ['title', 'description', 'button_text']) as unknown as Banner[];
          if (!['PGRST202', '42883'].includes(error.code)) throw error;
          if (rpc.endsWith('v3')) inventoryV3Missing.add(backend);
        }
      }
      let query = supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (placement) {
        query = query.eq('placement', placement);
      }

      // Mərhələ hədəfləməsi — profil hələ yüklənməyibsə (lifeStage undefined) filtri keç,
      // profil yükləndikdən sonra queryKey dəyişib yenidən sorğu ediləcək
      if (lifeStage) {
        query = query.or(`target_life_stages.is.null,target_life_stages.eq.{},target_life_stages.cs.{${lifeStage}}`);
      }

      // Dil hədəfləməsi — həmişə tətbiq olunur (language həmişə mövcuddur, default 'az')
      query = query.or(`target_languages.is.null,target_languages.eq.{},target_languages.cs.{${language}}`);

      // Ölkə hədəfləməsi
      if (countryCode) {
        query = query.or(`target_countries.is.null,target_countries.eq.{},target_countries.cs.{${countryCode}}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      let rows = mapRowsTranslation(data, language, ['title', 'description', 'button_text']) as unknown as Banner[];

      // İmpression tezlik limiti — yalnız limiti olan bannerlər üçün əlavə sorğu
      const cappedIds = rows.filter((b) => b.max_impressions_per_user != null).map((b) => b.id);
      if (user && cappedIds.length > 0) {
        const { data: impressions } = await (supabase as any)
          .from('banner_impressions')
          .select('banner_id, seen_count')
          .eq('user_id', user.id)
          .in('banner_id', cappedIds);
        const seenMap = new Map<string, number>((impressions || []).map((i: any) => [i.banner_id, i.seen_count]));
        rows = rows.filter((b) => {
          if (b.max_impressions_per_user == null) return true;
          return (seenMap.get(b.id) || 0) < b.max_impressions_per_user;
        });
      }

      return rows;
    }
  });
};

export const useAllBanners = () => {
  return useQuery({
    queryKey: ['banners', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('placement')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as Banner[];
    }
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (banner: Partial<Banner>) => {
      const { data, error } = await supabase
        .from('banners')
        .insert([banner as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    }
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, click_count: _clicks, view_count: _views, ...updates }: Partial<Banner> & { id: string }) => {
      const { data, error } = await supabase
        .from('banners')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    }
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    }
  });
};

/** Atomik klik artırma (RPC) — əvvəlki "oxu-sonra-yaz" yarışı olan versiyanı əvəz edir */
export const useIncrementBannerClick = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).rpc('increment_banner_click', { p_banner_id: id });
    }
  });
};

/**
 * Bannerin GÖRÜNTÜLƏNMƏSİNİ qeyd edir (view_count + banner_impressions.seen_count).
 * BannerSlot.tsx-də hər banner faktiki render olunanda bir dəfə çağırılır.
 */
export const useIncrementBannerImpression = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).rpc('increment_banner_impression', { p_banner_id: id });
    }
  });
};
