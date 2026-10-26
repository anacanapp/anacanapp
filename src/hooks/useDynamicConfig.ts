import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr, mapRowsTranslation } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { mapFollowupContent } from '@/lib/followup-content';

// ============ EXERCISES ============
export interface Exercise {
  id: string;
  name: string;
  name_az: string | null;
  duration_minutes: number;
  calories: number;
  level: 'easy' | 'medium' | 'hard';
  trimester: number[];
  icon: string;
  description: string | null;
  steps: string[];
  is_active: boolean;
  sort_order: number;
  /** Doğuşdan Sonra Sağalma bölməsində (mommy) göstərilsin? — supabase/duzelis/Duzelis46.sql */
  is_postpartum?: boolean;
  postpartum_week_start?: number | null;
  postpartum_week_end?: number | null;
  postpartum_delivery_types?: string[] | null;
}

export const useExercises = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['exercises', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      const mapped = mapFollowupContent(data, language, ['name', 'description', 'steps']);
      return mapped.map(e => ({
        ...e,
        steps: Array.isArray(e.steps) ? e.steps : JSON.parse(e.steps as string || '[]')
      })) as Exercise[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ WHITE NOISE SOUNDS ============
export interface WhiteNoiseSound {
  id: string;
  name: string;
  name_az: string | null;
  emoji: string;
  color_gradient: string;
  audio_url: string | null;
  is_active: boolean;
  sort_order: number;
  noise_type: string;
  description: string | null;
  description_az: string | null;
}

export const useWhiteNoiseSounds = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['white-noise-sounds', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('white_noise_sounds')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name', 'description']) as WhiteNoiseSound[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ PHOTOSHOOT THEMES ============
export interface PhotoshootTheme {
  id: string;
  category: 'background' | 'outfit' | 'accessory';
  name: string;
  name_az: string | null;
  emoji: string | null;
  prompt_text: string | null;
  preview_url: string | null;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
}

export const usePhotoshootThemes = (category?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-themes', category, language],
    queryFn: async () => {
      let query = supabase
        .from('photoshoot_themes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name', 'prompt_text']) as PhotoshootTheme[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ SURPRISE IDEAS ============
export interface SurpriseIdea {
  id: string;
  surprise_key?: string;
  title: string;
  title_az?: string | null;
  description: string | null;
  description_az?: string | null;
  emoji: string;
  icon: string;
  category: string;
  difficulty: string;
  points: number;
  is_active: boolean;
  sort_order: number;
}

export const useSurpriseIdeas = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['surprise-ideas', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surprise_ideas')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description']) as SurpriseIdea[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ BABY MILESTONES ============
export interface BabyMilestoneDB {
  id: string;
  milestone_key: string;
  week_number: number;
  label: string;
  label_az: string | null;
  emoji: string;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
  sort_order: number;
}

export const useBabyMilestonesDB = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['baby-milestones-db', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_milestones_db')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['label', 'description']) as BabyMilestoneDB[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ SYMPTOMS ============
export interface Symptom {
  id: string;
  symptom_key: string;
  label: string;
  label_az: string | null;
  icon: string;
  life_stages: string[];
  is_active: boolean;
  sort_order: number;
}

export const useSymptoms = (lifeStage?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['symptoms', lifeStage, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('symptoms')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      
      let symptoms = mapRowsTranslation(data, language, ['label']) as Symptom[];
      if (lifeStage) {
        symptoms = symptoms.filter(s => s.life_stages.includes(lifeStage));
      }
      return symptoms;
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ MOOD OPTIONS ============
export interface MoodOption {
  id: string;
  value: number;
  label: string;
  label_az: string | null;
  emoji: string;
  color_class: string | null;
  is_active: boolean;
}

export const useMoodOptions = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['mood-options', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_options')
        .select('*')
        .eq('is_active', true)
        .order('value');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['label']) as MoodOption[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ COMMON FOODS ============
export interface CommonFood {
  id: string;
  name: string;
  name_az: string | null;
  calories: number;
  emoji: string;
  category: string;
  meal_types: string[] | null;
  is_active: boolean;
  sort_order: number;
}

export const useCommonFoods = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['common-foods', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('common_foods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']) as CommonFood[];
    },
    staleTime: 1000 * 60 * 10,
  });
};

// ============ SHOP CATEGORIES ============
export interface ShopCategory {
  id: string;
  category_key: string;
  name: string;
  name_az: string | null;
  emoji: string;
  is_active: boolean;
  sort_order: number;
}

export const useShopCategories = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['shop-categories', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']) as ShopCategory[];
    },
    staleTime: 1000 * 60 * 10,
  });
};


// ============ ADMIN HOOKS ============
export const useExercisesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['exercises-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data.map(e => ({
        ...e,
        steps: Array.isArray(e.steps) ? e.steps : JSON.parse(e.steps as string || '[]')
      })) as Exercise[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Exercise>) => {
      const { error } = await supabase.from('exercises').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast({ title: tr("usedynamicconfig_mesq_elave_edildi_62071a", "Məşq əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<Exercise> & { id: string }) => {
      const { error } = await supabase.from('exercises').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast({ title: tr("usedynamicconfig_mesq_yenilendi_6db253", "Məşq yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises-admin'] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast({ title: tr("usedynamicconfig_mesq_silindi_5f2cd4", "Məşq silindi") });
    },
  });

  return { ...query, create, update, remove };
};

export const useWhiteNoiseSoundsAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['white-noise-sounds-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('white_noise_sounds')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as WhiteNoiseSound[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<WhiteNoiseSound>) => {
      const { error } = await supabase.from('white_noise_sounds').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds-admin'] });
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds'] });
      toast({ title: tr("usedynamicconfig_ses_elave_edildi_be6380", "Səs əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<WhiteNoiseSound> & { id: string }) => {
      const { error } = await supabase.from('white_noise_sounds').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds-admin'] });
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds'] });
      toast({ title: tr("usedynamicconfig_ses_yenilendi_0d354c", "Səs yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('white_noise_sounds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds-admin'] });
      queryClient.invalidateQueries({ queryKey: ['white-noise-sounds'] });
      toast({ title: tr("usedynamicconfig_ses_silindi_f1ba7a", "Səs silindi") });
    },
  });

  return { ...query, create, update, remove };
};

export const useSurpriseIdeasAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['surprise-ideas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surprise_ideas')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as SurpriseIdea[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<SurpriseIdea>) => {
      const { error } = await supabase.from('surprise_ideas').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas'] });
      toast({ title: tr("usedynamicconfig_surpriz_elave_edildi_8f99e6", "Sürpriz əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<SurpriseIdea> & { id: string }) => {
      const { error } = await supabase.from('surprise_ideas').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas'] });
      toast({ title: tr("usedynamicconfig_surpriz_yenilendi_7fd527", "Sürpriz yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('surprise_ideas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['surprise-ideas'] });
      toast({ title: tr("usedynamicconfig_surpriz_silindi_095181", "Sürpriz silindi") });
    },
  });

  return { ...query, create, update, remove };
};

export const useBabyMilestonesDBAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['baby-milestones-db-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baby_milestones_db')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as BabyMilestoneDB[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<BabyMilestoneDB>) => {
      const { error } = await supabase.from('baby_milestones_db').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db-admin'] });
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db'] });
      toast({ title: tr("usedynamicconfig_merhele_elave_edildi_5bc49c", "Mərhələ əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<BabyMilestoneDB> & { id: string }) => {
      const { error } = await supabase.from('baby_milestones_db').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db-admin'] });
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db'] });
      toast({ title: tr("usedynamicconfig_merhele_yenilendi_18f4f3", "Mərhələ yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('baby_milestones_db').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db-admin'] });
      queryClient.invalidateQueries({ queryKey: ['baby-milestones-db'] });
      toast({ title: tr("usedynamicconfig_merhele_silindi_fb7d94", "Mərhələ silindi") });
    },
  });

  return { ...query, create, update, remove };
};

export const useSymptomsAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['symptoms-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('symptoms')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Symptom[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<Symptom>) => {
      const { error } = await supabase.from('symptoms').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms-admin'] });
      queryClient.invalidateQueries({ queryKey: ['symptoms'] });
      toast({ title: tr("usedynamicconfig_simptom_elave_edildi_bd969e", "Simptom əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<Symptom> & { id: string }) => {
      const { error } = await supabase.from('symptoms').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms-admin'] });
      queryClient.invalidateQueries({ queryKey: ['symptoms'] });
      toast({ title: tr("usedynamicconfig_simptom_yenilendi_556a95", "Simptom yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('symptoms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms-admin'] });
      queryClient.invalidateQueries({ queryKey: ['symptoms'] });
      toast({ title: tr("dynamicconfig_simptom_silindi", 'Simptom silindi') });
    },
  });

  return { ...query, create, update, remove };
};

export const useCommonFoodsAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['common-foods-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('common_foods')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as CommonFood[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<CommonFood>) => {
      const { error } = await supabase.from('common_foods').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['common-foods-admin'] });
      queryClient.invalidateQueries({ queryKey: ['common-foods'] });
      toast({ title: tr("usedynamicconfig_qida_elave_edildi_3e2d93", "Qida əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<CommonFood> & { id: string }) => {
      const { error } = await supabase.from('common_foods').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['common-foods-admin'] });
      queryClient.invalidateQueries({ queryKey: ['common-foods'] });
      toast({ title: tr("usedynamicconfig_qida_yenilendi_63fdde", "Qida yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('common_foods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['common-foods-admin'] });
      queryClient.invalidateQueries({ queryKey: ['common-foods'] });
      toast({ title: 'Qida silindi' });
    },
  });

  return { ...query, create, update, remove };
};

export const useShopCategoriesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['shop-categories-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as ShopCategory[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<ShopCategory>) => {
      const { error } = await supabase.from('shop_categories').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shop-categories'] });
      toast({ title: tr("usedynamicconfig_kateqoriya_elave_edildi_e28f72", "Kateqoriya əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<ShopCategory> & { id: string }) => {
      const { error } = await supabase.from('shop_categories').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shop-categories'] });
      toast({ title: tr("usedynamicconfig_kateqoriya_yenilendi_02b12b", "Kateqoriya yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shop_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['shop-categories'] });
      toast({ title: tr("dynamicconfig_kateqoriya_silindi", 'Kateqoriya silindi') });
    },
  });

  return { ...query, create, update, remove };
};

export const usePhotoshootThemesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['photoshoot-themes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_themes')
        .select('*')
        .order('category')
        .order('sort_order');
      if (error) throw error;
      return data as PhotoshootTheme[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<PhotoshootTheme>) => {
      const { error } = await supabase.from('photoshoot_themes').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes'] });
      toast({ title: tr("usedynamicconfig_movzu_elave_edildi_a6721f", "Mövzu əlavə edildi") });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<PhotoshootTheme> & { id: string }) => {
      const { error } = await supabase.from('photoshoot_themes').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes'] });
      toast({ title: tr("usedynamicconfig_movzu_yenilendi_b5e847", "Mövzu yeniləndi") });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('photoshoot_themes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['photoshoot-themes'] });
      toast({ title: tr("usedynamicconfig_movzu_silindi_9e204d", "Mövzu silindi") });
    },
  });

  return { ...query, create, update, remove };
};

export const useMoodOptionsAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['mood-options-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_options')
        .select('*')
        .order('value');
      if (error) throw error;
      return data as MoodOption[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<MoodOption> & { id: string }) => {
      const { error } = await supabase.from('mood_options').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['mood-options'] });
      toast({ title: tr("usedynamicconfig_ehval_yenilendi_0675fd", "Əhval yeniləndi") });
    },
  });

  return { ...query, update };
};
