import { tr } from "@/lib/tr";import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkillCategory {
  id: string;
  skill_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  icon_name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export const useSkillCategories = () => {
  return useQuery({
    queryKey: ['skill-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('skill_categories').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return (data || []) as SkillCategory[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const FALLBACK_SKILL_CATEGORIES = [
{ skill_key: 'motor', label_az: tr("useskillcategories_motor_bacariqlari_c2d526", "Motor Bacar\u0131qlar\u0131"), emoji: '🏃', color: 'bg-blue-500' },
{ skill_key: 'sensory', label_az: tr("useskillcategories_hissi_i_nkisaf_48af28", "Hissi \u0130nki\u015Faf"), emoji: '👁️', color: 'bg-purple-500' },
{ skill_key: 'cognitive', label_az: tr("useskillcategories_idrak", "İdrak"), emoji: '🧠', color: 'bg-amber-500' },
{ skill_key: 'language', label_az: tr("useskillcategories_dil", "Dil"), emoji: '💬', color: 'bg-green-500' },
{ skill_key: 'social', label_az: tr("useskillcategories_sosial", "Sosial"), emoji: '👥', color: 'bg-pink-500' }];