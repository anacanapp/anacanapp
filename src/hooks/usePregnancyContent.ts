import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr, mapRowTranslation } from "@/lib/tr";
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { useUserStore } from '@/store/userStore';

const TRANSLATABLE_FIELDS = [
  'baby_development',
  'baby_message',
  'baby_size_fruit',
  'body_changes',
  'daily_tip',
  'doctor_visit_tip',
  'emotional_tip',
  'exercise_tip',
  'mother_tips',
  'mother_warnings',
  'nutrition_tip',
  'partner_tip',
  // Əkiz/çoxdöllü hamiləliyə xas əlavə məsləhət (bax aşağıda multiples_tip sahəsi) —
  // Duzelis32 ilə digər sahələrlə eyni konvensiyaya keçirilib (bax _en/_ru/_tr/_kk/_de/_ar).
  'multiples_tip',
  // text[] sahələr — _ru/_tr sütunları da text[] tiplidir, birbaşa əvəzlənir
  'foods_to_avoid',
  'mother_symptoms',
  'recommended_exercises',
  'recommended_foods',
  'tests_to_do',
] as const;

function applyLanguage<T extends Record<string, any> | null>(row: T, lang: string): T {
  if (!row || lang === 'az') return row;
  if ((NEW_LANGUAGE_CODES as readonly string[]).includes(lang)) return mapRowTranslation(row, lang, [...TRANSLATABLE_FIELDS]) as T;
  const out: any = { ...row };
  for (const f of TRANSLATABLE_FIELDS) {
    const langVal = (row as any)[`${f}_${lang}`];
    if (langVal) out[f] = langVal;
  }
  return out as T;
}

export interface PregnancyContent {
  id: string;
  pregnancy_day: number | null;
  week_number: number;
  day_number: number | null;
  days_until_birth: number | null;
  baby_size_fruit: string | null;
  baby_size_cm: number | null;
  baby_weight_gram: number | null;
  baby_development: string | null;
  baby_message: string | null;
  body_changes: string | null;
  daily_tip: string | null;
  mother_symptoms: string[] | null;
  mother_tips: string | null;
  mother_warnings: string | null;
  nutrition_tip: string | null;
  recommended_foods: string[] | null;
  foods_to_avoid: string[] | null;
  exercise_tip: string | null;
  recommended_exercises: string[] | null;
  doctor_visit_tip: string | null;
  tests_to_do: string[] | null;
  emotional_tip: string | null;
  partner_tip: string | null;
  image_url: string | null;
  video_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Əkiz/çoxdöllü hamiləliyə xas əlavə məsləhət — YALNIZ isMultiple=true olanlara
  // göstərilir (bax Dashboard.tsx). Duzelis32 ilə 7 dilə tərcümə olunub və
  // TRANSLATABLE_FIELDS-ə əlavə edilib — applyLanguage() UI dilinə uyğun
  // multiples_tip_{lang} dəyərini avtomatik seçir (baby_message və s. eyni).
  multiples_tip: string | null;
}

// Fetch content by pregnancy day (1-280)
export const usePregnancyContentByDay = (pregnancyDay?: number) => {
  const language = useUserStore((s) => s.language);
  return useQuery({
    queryKey: ['pregnancy_content_day', pregnancyDay, language],
    queryFn: async () => {
      if (!pregnancyDay) return null;
      
      // Try to find exact day match first
      let { data, error } = await (supabase as any)
        .from('pregnancy_daily_content')
        .select('*')
        .eq('pregnancy_day', pregnancyDay)
        .eq('is_active', true)
        .maybeSingle();

      // If no exact match, find nearest previous day
      if (!data && !error) {
        const { data: nearestData } = await (supabase as any)
          .from('pregnancy_daily_content')
          .select('*')
          .lt('pregnancy_day', pregnancyDay)
          .eq('is_active', true)
          .order('pregnancy_day', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        data = nearestData;
      }

      if (error) throw error;
      return applyLanguage(data as PregnancyContent | null, language);
    },
    enabled: !!pregnancyDay,
    staleTime: 1000 * 60 * 5,
  });
};

// Original week-based fetch (for backwards compatibility)
export const usePregnancyContent = (weekNumber?: number) => {
  return useQuery({
    queryKey: ['pregnancy_content', weekNumber],
    queryFn: async () => {
      let query = (supabase as any)
        .from('pregnancy_daily_content')
        .select('*')
        .eq('is_active', true)
        .order('pregnancy_day', { ascending: true });

      if (weekNumber) {
        query = query.eq('week_number', weekNumber);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PregnancyContent[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const usePregnancyContentAdmin = () => {
  const queryClient = useQueryClient();

  const fetchAllContent = useQuery({
    queryKey: ['pregnancy_content_admin'],
    queryFn: async () => {
      const data = await fetchAllRows((from, to) =>
        (supabase as any)
          .from('pregnancy_daily_content')
          .select('*')
          .order('week_number', { ascending: true })
          .range(from, to)
      );
      return (data || []) as PregnancyContent[];
    },
  });

  const createContent = useMutation({
    mutationFn: async (content: Partial<PregnancyContent>) => {
      const { data, error } = await (supabase as any)
        .from('pregnancy_daily_content')
        .insert(content)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_admin'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content'] });
    },
  });

  const updateContent = useMutation({
    mutationFn: async ({ id, ...content }: Partial<PregnancyContent> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('pregnancy_daily_content')
        .update(content)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_admin'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content'] });
    },
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('pregnancy_daily_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_admin'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content'] });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from('pregnancy_daily_content')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_admin'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content'] });
    },
  });

  const bulkImport = useMutation({
    mutationFn: async (contents: Partial<PregnancyContent>[]) => {
      const results = { success: 0, failed: 0, errors: [] as string[] };

      // First, get all existing pregnancy_days to know which to update vs insert
      const { data: existingRows } = await (supabase as any)
        .from('pregnancy_daily_content')
        .select('id, pregnancy_day');
      
      const existingMap = new Map<number, string>();
      (existingRows || []).forEach((row: any) => {
        if (row.pregnancy_day) {
          existingMap.set(row.pregnancy_day, row.id);
        }
      });

      // Prepare records with proper defaults for empty values
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      for (const content of contents) {
        // Apply defaults for empty/missing values
        const cleanedContent = {
          pregnancy_day: content.pregnancy_day,
          week_number: content.week_number || Math.ceil((content.pregnancy_day || 1) / 7),
          days_until_birth: content.days_until_birth ?? (280 - (content.pregnancy_day || 1)),
          baby_size_fruit: content.baby_size_fruit || null,
          baby_size_cm: content.baby_size_cm ?? 0,
          baby_weight_gram: content.baby_weight_gram ?? 0,
          baby_development: content.baby_development || null,
          baby_message: content.baby_message || null,
          body_changes: content.body_changes || null,
          daily_tip: content.daily_tip || null,
          mother_symptoms: content.mother_symptoms || null,
          mother_tips: content.mother_tips || null,
          nutrition_tip: content.nutrition_tip || null,
          recommended_foods: content.recommended_foods || null,
          emotional_tip: content.emotional_tip || null,
          partner_tip: content.partner_tip || null,
          multiples_tip: content.multiples_tip || null,
          is_active: content.is_active !== false,
        };

        const existingId = existingMap.get(content.pregnancy_day!);
        if (existingId) {
          toUpdate.push({ id: existingId, data: cleanedContent });
        } else {
          toInsert.push(cleanedContent);
        }
      }

      // Batch insert new records (chunks of 50)
      const insertBatchSize = 50;
      for (let i = 0; i < toInsert.length; i += insertBatchSize) {
        const batch = toInsert.slice(i, i + insertBatchSize);
        const { error } = await (supabase as any)
          .from('pregnancy_daily_content')
          .insert(batch);
        
        if (error) {
          results.failed += batch.length;
          results.errors.push(`Insert batch ${i / insertBatchSize + 1}: ${error.message}`);
        } else {
          results.success += batch.length;
        }
      }

      // Batch update existing records (chunks of 20 for updates)
      const updateBatchSize = 20;
      for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
        const batch = toUpdate.slice(i, i + updateBatchSize);
        
        // Use Promise.all for parallel updates within batch
        const updatePromises = batch.map(async ({ id, data }) => {
          const { error } = await (supabase as any)
            .from('pregnancy_daily_content')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id);
          return { error, pregnancy_day: data.pregnancy_day };
        });

        const updateResults = await Promise.all(updatePromises);
        
        for (const result of updateResults) {
          if (result.error) {
            results.failed++;
            results.errors.push(tr("hooks_pregnancycontent_day_error", "Gün {day}: {error}").replace("{day}", String(result.pregnancy_day)).replace("{error}", result.error.message));
          } else {
            results.success++;
          }
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_admin'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content'] });
      queryClient.invalidateQueries({ queryKey: ['pregnancy_content_day'] });
    },
  });

  return {
    content: fetchAllContent.data || [],
    isLoading: fetchAllContent.isLoading,
    error: fetchAllContent.error,
    createContent,
    updateContent,
    deleteContent,
    bulkDelete,
    bulkImport,
    refetch: fetchAllContent.refetch,
  };
};
