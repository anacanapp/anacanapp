import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FlowSymptom {
  id: string;
  symptom_id: string;
  label: string;
  label_az: string | null;
  emoji: string;
  category: string;
  sort_order: number;
}

interface FlowPhaseTip {
  id: string;
  phase: string;
  tip_text: string;
  tip_text_az: string | null;
  tip_text_en?: string | null;
  emoji: string;
  category: string;
  sort_order: number;
}

interface FlowInsight {
  id: string;
  title: string;
  title_az: string | null;
  title_en?: string | null;
  content: string;
  content_az: string | null;
  content_en?: string | null;
  phase: string | null;
  emoji: string;
  category: string;
  sort_order: number;
}

export const useFlowSymptoms = () => {
  return useQuery({
    queryKey: ['flow-symptoms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_symptoms')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Error fetching flow symptoms:', error);
        return [];
      }
      return data as FlowSymptom[];
    },
    staleTime: 1000 * 60 * 60,
  });
};

export const useFlowPhaseTips = (phase?: string) => {
  return useQuery({
    queryKey: ['flow-phase-tips', phase],
    queryFn: async () => {
      let query = supabase
        .from('flow_phase_tips')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (phase) {
        query = query.eq('phase', phase);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching flow phase tips:', error);
        return [];
      }
      return data as FlowPhaseTip[];
    },
    staleTime: 1000 * 60 * 30,
  });
};

export const useFlowInsights = (phase?: string | null) => {
  return useQuery({
    queryKey: ['flow-insights', phase],
    queryFn: async () => {
      let query = supabase
        .from('flow_insights')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (phase) {
        query = query.or(`phase.eq.${phase},phase.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching flow insights:', error);
        return [];
      }
      return data as FlowInsight[];
    },
    staleTime: 1000 * 60 * 30,
  });
};
