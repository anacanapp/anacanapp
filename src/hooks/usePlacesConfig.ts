import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export interface PlaceCategory {
  id: string;
  category_key: string;
  label: string;
  label_az: string | null;
  icon_name: string;
  color_gradient: string;
  sort_order: number;
  is_active: boolean;
}

export interface PlaceAmenity {
  id: string;
  amenity_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  sort_order: number;
  is_active: boolean;
}

export const usePlaceCategories = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['place-categories', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('place_categories').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['label']) as unknown as PlaceCategory[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const usePlaceAmenities = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['place-amenities', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('place_amenities').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['label']) as unknown as PlaceAmenity[];
    },
    staleTime: 1000 * 60 * 30
  });
};

// Fallbacks for offline/loading
export const FALLBACK_CATEGORIES = [
{ category_key: 'all', label: tr("useplacesconfig_hamisi_c73c4d", "Ham\u0131s\u0131"), icon_name: 'MapPin', color_gradient: 'from-pink-500 to-rose-600' },
{ category_key: 'cafe', label: 'Kafe', icon_name: 'Utensils', color_gradient: 'from-amber-500 to-orange-600' },
{ category_key: 'restaurant', label: 'Restoran', icon_name: 'Utensils', color_gradient: 'from-red-500 to-rose-600' },
{ category_key: 'mall', label: 'Mall', icon_name: 'Building2', color_gradient: 'from-blue-500 to-indigo-600' },
{ category_key: 'park', label: 'Park', icon_name: 'TreePine', color_gradient: 'from-emerald-500 to-green-600' }];


export const FALLBACK_AMENITIES = [
{ amenity_key: 'has_breastfeeding_room', label: tr("useplacesconfig_emizdirme_otagi_029c1d", "\u018Fmizdirm\u0259 ota\u011F\u0131"), emoji: '🤱' },
{ amenity_key: 'has_changing_table', label: tr("useplacesconfig_deyisdirme_masasi_99a9aa", "D\u0259yi\u015Fdirm\u0259 masas\u0131"), emoji: '👶' },
{ amenity_key: 'has_elevator', label: 'Lift', emoji: '🛗' }];