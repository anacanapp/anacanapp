import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { format } from 'date-fns';

export interface ZodiacSign {
  id: string;
  name: string;
  name_az: string;
  symbol: string;
  start_date: string;
  end_date: string;
  element: string | null;
  ruling_planet: string | null;
  characteristics_az: string[] | null;
  characteristics?: string[] | null;
  color: string | null;
}

export interface ZodiacCompatibility {
  id: string;
  sign1: string;
  sign2: string;
  compatibility_score: number;
  relationship_type: string;
  description: string | null;
  description_az: string | null;
}

export interface HoroscopeReading {
  id: string;
  user_id: string;
  baby_sign: string | null;
  mom_sign: string | null;
  dad_sign: string | null;
  compatibility_result: Record<string, any> | null;
  shared_count: number;
  created_at: string;
}

export const useZodiacSigns = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['zodiac-signs', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('zodiac_signs').
      select('*').
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['name', 'characteristics']) as unknown as ZodiacSign[];
    },
    staleTime: 1000 * 60 * 60
  });
};

export const useZodiacCompatibility = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['zodiac-compatibility', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('zodiac_compatibility').
      select('*');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['description']) as unknown as ZodiacCompatibility[];
    },
    staleTime: 1000 * 60 * 60
  });
};

export const useHoroscopeReadings = () => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['horoscope-readings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.
      from('horoscope_readings').
      select('*').
      eq('user_id', user.id).
      order('created_at', { ascending: false });

      if (error) throw error;
      return data as HoroscopeReading[];
    },
    enabled: !!user?.id
  });
};

export const useSaveHoroscopeReading = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (reading: {
      baby_sign?: string;
      mom_sign?: string;
      dad_sign?: string;
      compatibility_result: Record<string, any>;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.
      from('horoscope_readings').
      insert({
        user_id: user.id,
        ...reading
      }).
      select().
      single();

      if (error) throw error;
      return data as HoroscopeReading;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horoscope-readings'] });
    }
  });
};

// Get zodiac sign from date
export const getZodiacSign = (date: Date, signs: ZodiacSign[]): ZodiacSign | null => {
  const monthDay = format(date, 'MM-dd');

  for (const sign of signs) {
    const start = sign.start_date;
    const end = sign.end_date;

    // Handle signs that cross year boundary (e.g., Capricorn: 12-22 to 01-19)
    if (start > end) {
      if (monthDay >= start || monthDay <= end) {
        return sign;
      }
    } else {
      if (monthDay >= start && monthDay <= end) {
        return sign;
      }
    }
  }

  return null;
};

// Calculate compatibility between two signs
export const calculateCompatibility = (
sign1: string,
sign2: string,
compatibilities: ZodiacCompatibility[],
relationshipType: string = 'parent_child')
: ZodiacCompatibility | null => {
  const match = compatibilities.find((c) =>
  (c.sign1 === sign1 && c.sign2 === sign2 ||
  c.sign1 === sign2 && c.sign2 === sign1) &&
  c.relationship_type === relationshipType
  );

  return match || null;
};

// Generate compatibility description based on elements
export const getElementCompatibility = (element1: string, element2: string): {
  score: number;
  description_az: string;
} => {
  const compatibilityMap: Record<string, Record<string, {score: number;description_az: string;}>> = {
    fire: {
      fire: { score: 85, description_az: tr("usehoroscope_cox_enerjili_ve_dinamik_bir_el_dfec07", "\xC7ox enerjili v\u0259 dinamik bir \u0259laq\u0259! Birlikd\u0259 h\u0259r \u015Feyi bacarars\u0131n\u0131z.") },
      air: { score: 90, description_az: tr("usehoroscope_mukemmel_harmoniya_hava_odu_da_75f2b0", "M\xFCk\u0259mm\u0259l harmoniya! Hava odu daha da alovland\u0131r\u0131r.") },
      earth: { score: 60, description_az: tr("usehoroscope_ferqli_yanasmalar_amma_bir_bir_ba25d5", "F\u0259rqli yana\u015Fmalar, amma bir-birinizi tamamlaya bil\u0259rsiniz.") },
      water: { score: 50, description_az: tr("usehoroscope_bezen_cetin_olsa_da_derin_emos_8f19ff", "B\u0259z\u0259n \xE7\u0259tin olsa da, d\u0259rin emosional ba\u011F qura bil\u0259rsiniz.") }
    },
    earth: {
      fire: { score: 60, description_az: tr("usehoroscope_ferqli_yanasmalar_amma_bir_bir_ba25d5", "F\u0259rqli yana\u015Fmalar, amma bir-birinizi tamamlaya bil\u0259rsiniz.") },
      air: { score: 55, description_az: tr("usehoroscope_praktik_ve_nezeri_dusuncenin_m_99c118", "Praktik v\u0259 n\u0259z\u0259ri d\xFC\u015F\xFCnc\u0259nin maraql\u0131 birl\u0259\u015Fm\u0259si.") },
      earth: { score: 95, description_az: tr("usehoroscope_cox_sabit_ve_etibarli_elaqe_bi_e3baaf", "\xC7ox sabit v\u0259 etibarl\u0131 \u0259laq\u0259! Birlikd\u0259 da\u011Flar\u0131 yerind\u0259n t\u0259rp\u0259d\u0259rsiniz.") },
      water: { score: 85, description_az: tr("usehoroscope_gozel_harmoniya_su_torpagi_can_abb534", "G\xF6z\u0259l harmoniya! Su torpa\u011F\u0131 canland\u0131r\u0131r.") }
    },
    air: {
      fire: { score: 90, description_az: tr("usehoroscope_mukemmel_harmoniya_hava_odu_da_75f2b0", "M\xFCk\u0259mm\u0259l harmoniya! Hava odu daha da alovland\u0131r\u0131r.") },
      air: { score: 80, description_az: tr("usehoroscope_cox_unsiyyetcil_ve_yaradici_el_3ae25c", "\xC7ox \xFCnsiyy\u0259tcil v\u0259 yarad\u0131c\u0131 \u0259laq\u0259!") },
      earth: { score: 55, description_az: tr("usehoroscope_praktik_ve_nezeri_dusuncenin_m_99c118", "Praktik v\u0259 n\u0259z\u0259ri d\xFC\u015F\xFCnc\u0259nin maraql\u0131 birl\u0259\u015Fm\u0259si.") },
      water: { score: 65, description_az: tr("usehoroscope_emosional_derinlik_ve_intellek_065e73", "Emosional d\u0259rinlik v\u0259 intellektual \xFCnsiyy\u0259tin birl\u0259\u015Fm\u0259si.") }
    },
    water: {
      fire: { score: 50, description_az: tr("usehoroscope_bezen_cetin_olsa_da_derin_emos_8f19ff", "B\u0259z\u0259n \xE7\u0259tin olsa da, d\u0259rin emosional ba\u011F qura bil\u0259rsiniz.") },
      air: { score: 65, description_az: tr("usehoroscope_emosional_derinlik_ve_intellek_065e73", "Emosional d\u0259rinlik v\u0259 intellektual \xFCnsiyy\u0259tin birl\u0259\u015Fm\u0259si.") },
      earth: { score: 85, description_az: tr("usehoroscope_gozel_harmoniya_su_torpagi_can_abb534", "G\xF6z\u0259l harmoniya! Su torpa\u011F\u0131 canland\u0131r\u0131r.") },
      water: { score: 90, description_az: tr("usehoroscope_derin_emosional_bag_bir_birini_dc3f52", "D\u0259rin emosional ba\u011F! Bir-birinizi m\xFCk\u0259mm\u0259l anlay\u0131rs\u0131n\u0131z.") }
    }
  };

  return compatibilityMap[element1]?.[element2] || { score: 70, description_az: tr("usehoroscope_unikal_ve_maraqli_elaqe_48843d", "Unikal v\u0259 maraql\u0131 \u0259laq\u0259!") };
};