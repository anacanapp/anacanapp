import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Horoscope Elements
export interface HoroscopeElement {
  id: string;
  element_key: string;
  name: string;
  name_az: string | null;
  icon: string;
  color: string;
  sort_order: number;
}

export const useHoroscopeElements = () => {
  return useQuery({
    queryKey: ['horoscope-elements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('horoscope_elements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as HoroscopeElement[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Horoscope Loading Steps
export interface HoroscopeLoadingStep {
  id: string;
  step_key: string;
  label: string;
  label_az: string | null;
  icon: string;
  sort_order: number;
}

export const useHoroscopeLoadingSteps = () => {
  return useQuery({
    queryKey: ['horoscope-loading-steps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('horoscope_loading_steps')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as HoroscopeLoadingStep[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Time Options
export interface TimeOption {
  id: string;
  option_key: string;
  label: string;
  label_az: string | null;
  hour_value: number | null;
  sort_order: number;
}

export const useTimeOptions = () => {
  return useQuery({
    queryKey: ['time-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as TimeOption[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Cry Type Labels
export interface CryTypeLabel {
  id: string;
  cry_type: string;
  label: string;
  label_az: string | null;
  emoji: string;
  color: string;
  description_az: string | null;
  sort_order: number;
}

export const useCryTypeLabels = () => {
  return useQuery({
    queryKey: ['cry-type-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cry_type_labels')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as CryTypeLabel[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Poop Color Labels
export interface PoopColorLabel {
  id: string;
  color_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  hex_color: string;
  status: string;
  description_az: string | null;
  sort_order: number;
}

export const usePoopColorLabels = () => {
  return useQuery({
    queryKey: ['poop-color-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poop_color_labels')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as PoopColorLabel[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Temperature Emojis
export interface TemperatureEmoji {
  id: string;
  min_temp: number;
  max_temp: number;
  emoji: string;
  label: string;
  label_az: string | null;
  clothing_tip_az: string | null;
  sort_order: number;
}

export const useTemperatureEmojis = () => {
  return useQuery({
    queryKey: ['temperature-emojis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('temperature_emojis')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as TemperatureEmoji[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Marketplace Categories
export interface MarketplaceCategory {
  id: string;
  category_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  sort_order: number;
}

export const useMarketplaceCategories = () => {
  return useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as MarketplaceCategory[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Product Conditions
export interface ProductCondition {
  id: string;
  condition_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  color: string;
  sort_order: number;
}

export const useProductConditions = () => {
  return useQuery({
    queryKey: ['product-conditions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_conditions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as ProductCondition[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Age Ranges
export interface AgeRange {
  id: string;
  range_key: string;
  label: string;
  label_az: string | null;
  min_months: number;
  max_months: number | null;
  sort_order: number;
}

export const useAgeRanges = () => {
  return useQuery({
    queryKey: ['age-ranges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('age_ranges')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as AgeRange[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Provider Types
export interface ProviderType {
  id: string;
  type_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  color: string;
  sort_order: number;
}

export const useProviderTypes = () => {
  return useQuery({
    queryKey: ['provider-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as ProviderType[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Day Labels
export interface DayLabel {
  id: string;
  day_key: string;
  label: string;
  label_az: string | null;
  short_label: string;
  short_label_az: string | null;
  day_number: number;
}

export const useDayLabels = () => {
  return useQuery({
    queryKey: ['day-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('day_labels')
        .select('*')
        .eq('is_active', true)
        .order('day_number');
      if (error) throw error;
      return data as DayLabel[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

// Exercise Daily Tips
export interface ExerciseDailyTip {
  id: string;
  tip: string;
  tip_az: string | null;
  emoji: string;
  trimester: number[] | null;
  sort_order: number;
}

export const useExerciseDailyTips = () => {
  return useQuery({
    queryKey: ['exercise-daily-tips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_daily_tips')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as ExerciseDailyTip[];
    },
    staleTime: 1000 * 60 * 60,
  });
};
