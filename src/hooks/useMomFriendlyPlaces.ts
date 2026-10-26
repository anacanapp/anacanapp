import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';

export interface MomFriendlyPlace {
  id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  category: 'cafe' | 'restaurant' | 'park' | 'mall' | 'hospital' | 'metro' | 'pharmacy' | 'playground';
  latitude: number;
  longitude: number;
  address: string | null;
  address_az: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  has_breastfeeding_room: boolean;
  has_changing_table: boolean;
  has_elevator: boolean;
  has_ramp: boolean;
  has_stroller_access: boolean;
  has_kids_menu: boolean;
  has_play_area: boolean;
  has_high_chair: boolean;
  has_parking: boolean;
  avg_rating: number;
  review_count: number;
  verified_count: number;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PlaceReview {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  cleanliness_rating: number | null;
  accessibility_rating: number | null;
  staff_rating: number | null;
  is_verified: boolean;
  created_at: string;
}

export const useMomFriendlyPlaces = (filters?: {
  category?: string;
  amenities?: string[];
}) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['mom-friendly-places', filters, language],
    queryFn: async () => {
      // NOT: `query` qəsdən `any` tipləndirilib — dinamik .eq() loop-u ilə
      // Supabase-in generic filter-builder tipi TS-də "excessively deep"
      // instantiation xətası verir (məlum supabase-js + TS məhdudiyyəti).
      let query: any = supabase.
      from('mom_friendly_places').
      select('*').
      eq('is_active', true).
      order('avg_rating', { ascending: false });

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category as MomFriendlyPlace['category']);
      }

      // Amenity boolean sütunları server-side filtrlənir (hər tələb olunan
      // amenity üçün .eq(..., true) — hamısı AND məntiqi ilə birləşir, əvvəlki
      // .every() semantikasının eynisi) — əvvəllər BÜTÜN aktiv məkanlar çəkilib
      // client-side yoxlanılırdı.
      if (filters?.amenities?.length) {
        for (const amenity of filters.amenities) {
          query = query.eq(amenity as any, true);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      return mapRowsTranslation(data, language, ['name', 'description', 'address']) as unknown as MomFriendlyPlace[];
    },
    staleTime: 1000 * 60 * 5
  });
};

export const usePlaceReviews = (placeId: string) => {
  return useQuery({
    queryKey: ['place-reviews', placeId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('place_reviews').
      select('*').
      eq('place_id', placeId).
      eq('is_verified', true).
      order('created_at', { ascending: false });

      if (error) throw error;
      return data as PlaceReview[];
    },
    enabled: !!placeId
  });
};

export const useAddPlace = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (place: Omit<Partial<MomFriendlyPlace>, 'id' | 'created_at' | 'created_by'>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.
      from('mom_friendly_places').
      insert({
        name: place.name || '',
        latitude: place.latitude || 0,
        longitude: place.longitude || 0,
        category: place.category || 'cafe',
        ...place,
        // Təsdiqlənənə qədər gizli qalsın — əvvəllər `is_active` default
        // dəyəri (true) ilə yaradılırdı və dərhal HAMIYA görünürdü, "Admin
        // təsdiqindən sonra görünəcək" mesajı yalan idi (bax AdminPlaces.tsx
        // "Təsdiqlə" düyməsi is_active=true edəndə real görünür olur).
        is_active: false,
        is_verified: false,
        created_by: user.id
      }).
      select().
      single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mom-friendly-places'] });
      toast.success(tr("usemomfriendlyplaces_mekan_elave_edildi_admin_tesdi_0c46f2", "M\u0259kan \u0259lav\u0259 edildi! Admin t\u0259sdiqind\u0259n sonra g\xF6r\xFCn\u0259c\u0259k."));
    },
    onError: () => {
      toast.error(tr("usemomfriendlyplaces_mekan_elave_edile_bilmedi_9a9c5b", "M\u0259kan \u0259lav\u0259 edil\u0259 bilm\u0259di"));
    }
  });
};

export const useAddReview = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (review: {
      place_id: string;
      rating: number;
      comment?: string;
      cleanliness_rating?: number;
      accessibility_rating?: number;
      staff_rating?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.
      from('place_reviews').
      insert({
        ...review,
        user_id: user.id
      }).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['place-reviews', variables.place_id] });
      queryClient.invalidateQueries({ queryKey: ['mom-friendly-places'] });
      toast.success(tr("usemomfriendlyplaces_reyiniz_gonderildi_admin_tesdi_abb220", "R\u0259yiniz g\xF6nd\u0259rildi! Admin t\u0259sdiqind\u0259n sonra g\xF6r\xFCn\u0259c\u0259k."));
    },
    onError: () => {
      toast.error(tr("usemomfriendlyplaces_rey_elave_edile_bilmedi_81a081", "R\u0259y \u0259lav\u0259 edil\u0259 bilm\u0259di"));
    }
  });
};

export const useVerifyAmenity = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (verification: {
      place_id: string;
      amenity_verified: string;
      is_confirmed: boolean;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.
      from('place_verifications').
      upsert({
        ...verification,
        user_id: user.id
      }).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mom-friendly-places'] });
      toast.success(tr("usemomfriendlyplaces_tesdiqiniz_ucun_tesekkurler_71a13f", "T\u0259sdiqiniz \xFC\xE7\xFCn t\u0259\u015F\u0259kk\xFCrl\u0259r!"));
    }
  });
};