import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface FirstAidScenario {
  id: string;
  title: string;
  title_az: string;
  description: string | null;
  description_az: string | null;
  icon: string | null;
  color: string;
  emergency_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface FirstAidStep {
  id: string;
  scenario_id: string;
  step_number: number;
  title: string;
  title_az: string;
  instruction: string;
  instruction_az: string;
  audio_url: string | null;
  animation_url: string | null;
  image_url: string | null;
  duration_seconds: number;
  is_critical: boolean;
}

export const useFirstAidScenarios = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['first-aid-scenarios', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('first_aid_scenarios')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'description']) as FirstAidScenario[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - this data rarely changes
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours for offline
  });
};

export const useFirstAidSteps = (scenarioId: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['first-aid-steps', scenarioId, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('first_aid_steps')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('step_number');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'instruction']) as FirstAidStep[];
    },
    enabled: !!scenarioId,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
};

// Preload all first aid data for offline use
export const usePreloadFirstAidData = () => {
  const scenariosQuery = useFirstAidScenarios();
  const scenarios = scenariosQuery.data;
  const language = useUserStore((state) => state.language);

  return useQuery({
    queryKey: ['first-aid-all-steps', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('first_aid_steps')
        .select('*')
        .order('scenario_id')
        .order('step_number');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['title', 'instruction']) as FirstAidStep[];
    },
    enabled: !!scenarios?.length,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
};
