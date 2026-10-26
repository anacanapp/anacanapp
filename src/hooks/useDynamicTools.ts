import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

// ===========================================
// SAFETY LOOKUP HOOKS
// ===========================================

export const useSafetyCategories = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['safety-categories', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

export const useSafetyItems = (categoryId?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['safety-items', categoryId, language],
    queryFn: async () => {
      let query = supabase
        .from('safety_items')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (categoryId && categoryId !== 'all') {
        query = query.eq('category', categoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name', 'description', 'hazard_notes', 'tips']);
    },
  });
};

// ===========================================
// SHOP CATEGORIES HOOKS
// ===========================================

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
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

// ===========================================
// NUTRITION HOOKS
// ===========================================

export const useNutritionTargets = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['nutrition-targets', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nutrition_targets')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description']);
    },
  });
};

export const useMealTypes = (lifeStage?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['meal-types', lifeStage, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      
      const mapped = mapRowsTranslation(data, language, ['name']);
      if (lifeStage && mapped) {
        return mapped.filter(m => m.life_stages?.includes(lifeStage));
      }
      return mapped;
    },
  });
};

export const useRecipeCategories = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['recipe-categories', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

export const useRecipeCategoriesAdmin = () => {
  return useQuery({
    queryKey: ['recipe-categories-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_categories')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
};

// ===========================================
// PHOTOSHOOT HOOKS
// ===========================================

export const usePhotoshootBackgrounds = (gender?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-backgrounds', gender, language],
    queryFn: async () => {
      let query = supabase
        .from('photoshoot_backgrounds')
        .select('*')
        .eq('is_active', true)
        .order('category_id')
        .order('sort_order');
      
      const { data, error } = await query;
      if (error) throw error;
      
      const mapped = mapRowsTranslation(data, language, ['name', 'prompt_text']);
      // Filter by gender: 'all' or 'unisex' means universal, otherwise match specific gender
      if (gender && mapped) {
        return mapped.filter(bg => bg.gender === 'all' || bg.gender === 'unisex' || bg.gender === gender);
      }
      return mapped;
    },
  });
};

export const usePhotoshootEyeColors = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-eye-colors', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_eye_colors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

export const usePhotoshootHairColors = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-hair-colors', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_hair_colors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

export const usePhotoshootHairStyles = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-hair-styles', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_hair_styles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']);
    },
  });
};

export const usePhotoshootOutfits = (gender?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-outfits', gender, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_outfits')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      
      const mapped = mapRowsTranslation(data, language, ['name', 'prompt_text']);
      // Filter by gender: 'all' or 'unisex' means universal, otherwise match specific gender
      if (gender && mapped) {
        return mapped.filter(o => o.gender === 'all' || o.gender === 'unisex' || o.gender === gender);
      }
      return mapped;
    },
  });
};

// ===========================================
// HELP CENTER HOOKS
// ===========================================

export interface FAQ {
  id: string;
  question: string;
  question_az: string | null;
  answer: string;
  answer_az: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
}

export interface SupportCategory {
  id: string;
  category_key: string;
  name: string;
  name_az: string | null;
  emoji: string;
  sort_order: number;
  is_active: boolean;
}

export interface WeightRecommendation {
  id: string;
  trimester: number;
  bmi_category: string;
  min_gain_kg: number;
  max_gain_kg: number;
  weekly_gain_kg: number | null;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
}

export const useFaqs = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['faqs', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['question', 'answer']) as FAQ[];
    },
  });
};

export const useSupportCategories = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['support-categories', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']) as SupportCategory[];
    },
  });
};

export const useWeightRecommendations = (trimester?: number) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['weight-recommendations', trimester, language],
    queryFn: async () => {
      let query = supabase
        .from('weight_recommendations')
        .select('*')
        .eq('is_active', true);
      
      if (trimester) {
        query = query.eq('trimester', trimester);
      }
      
      const { data, error } = await query.order('trimester');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['description']) as WeightRecommendation[];
    },
  });
};

// ===========================================
// AI SUGGESTED QUESTIONS HOOKS
// ===========================================

export interface AISuggestedQuestion {
  id: string;
  life_stage: string;
  user_type: 'mother' | 'partner';
  question: string;
  question_az: string | null;
  icon: string;
  color_from: string;
  color_to: string;
  sort_order: number;
  is_active: boolean;
}

export const useAISuggestedQuestions = (lifeStage: string, userType: 'mother' | 'partner') => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['ai-suggested-questions', lifeStage, userType, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_suggested_questions')
        .select('*')
        .eq('is_active', true)
        .eq('life_stage', lifeStage)
        .eq('user_type', userType)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['question']) as AISuggestedQuestion[];
    },
  });
};

// ===========================================
// TOOL CONFIGS HOOKS
// ===========================================

export interface ToolConfig {
  id: string;
  tool_id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  icon: string;
  color: string;
  bg_color: string;
  min_week: number | null;
  life_stages: string[];
  requires_partner: boolean;
  partner_name: string | null;
  partner_name_az: string | null;
  partner_description: string | null;
  partner_description_az: string | null;
  sort_order: number;
  flow_order: number;
  bump_order: number;
  mommy_order: number;
  is_active: boolean;
  flow_active: boolean;
  bump_active: boolean;
  mommy_active: boolean;
  // New fields
  flow_locked: boolean;
  bump_locked: boolean;
  mommy_locked: boolean;
  is_premium: boolean;
  premium_type: string;
  premium_limit: number;
  display_name_az: string | null;
  // Hero & quick access
  is_hero: boolean;
  hero_order: number;
  hero_gradient: string | null;
  hero_subtitle: string | null;
  hero_badge: string | null;
  is_quick_access: boolean;
  quick_access_order: number;
  quick_access_gradient: string | null;
}

export const useToolConfigs = (lifeStage?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['tool-configs', lifeStage, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tool_configs')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      
      const mapped = mapRowsTranslation(data, language, [
        'name',
        'description',
        'partner_name',
        'partner_description',
        'hero_subtitle',
        'hero_badge'
      ]) as ToolConfig[];

      // Filter by phase-specific active status
      let filtered = mapped;
      if (lifeStage === 'flow') {
        filtered = filtered.filter(t => t.flow_active !== false);
      } else if (lifeStage === 'bump') {
        filtered = filtered.filter(t => t.bump_active !== false);
      } else if (lifeStage === 'mommy') {
        filtered = filtered.filter(t => t.mommy_active !== false);
      }
      
      // Sort by the appropriate order field based on life stage
      let sorted = filtered;
      if (lifeStage === 'flow') {
        sorted = sorted.sort((a, b) => (a.flow_order ?? a.sort_order) - (b.flow_order ?? b.sort_order));
      } else if (lifeStage === 'bump') {
        sorted = sorted.sort((a, b) => (a.bump_order ?? a.sort_order) - (b.bump_order ?? b.sort_order));
      } else if (lifeStage === 'mommy') {
        sorted = sorted.sort((a, b) => (a.mommy_order ?? a.sort_order) - (b.mommy_order ?? b.sort_order));
      } else {
        sorted = sorted.sort((a, b) => a.sort_order - b.sort_order);
      }
      
      return sorted;
    },
  });
};

// ===========================================
// PHOTOSHOOT IMAGE STYLES HOOKS
// ===========================================

export interface PhotoshootImageStyle {
  id: string;
  style_id: string;
  style_name: string;
  style_name_az: string | null;
  emoji: string;
  prompt_modifier: string | null;
  sort_order: number;
  is_active: boolean;
}

export const usePhotoshootImageStyles = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['photoshoot-image-styles', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photoshoot_image_styles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['style_name']) as PhotoshootImageStyle[];
    },
  });
};

// ===========================================
// HOSPITAL BAG TEMPLATES HOOKS
// ===========================================

export interface HospitalBagTemplate {
  id: string;
  item_name: string;
  item_name_az: string | null;
  category: string;
  is_essential: boolean;
  sort_order: number;
  is_active: boolean;
  priority: number;
  notes: string | null;
}

export const useHospitalBagTemplates = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['hospital-bag-templates', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospital_bag_templates')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['item_name', 'notes']) as HospitalBagTemplate[];
    },
  });
};
