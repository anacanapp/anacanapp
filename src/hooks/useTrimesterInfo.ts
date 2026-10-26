import { tr } from "@/lib/tr";import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrimesterInfo {
  id: string;
  trimester_number: number;
  label: string;
  label_az: string | null;
  emoji: string;
  color_class: string;
  is_active: boolean;
}

export const useTrimesterInfo = () => {
  return useQuery({
    queryKey: ['trimester-info'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('trimester_info').
      select('*').
      eq('is_active', true).
      order('trimester_number');

      if (error) throw error;
      return (data || []) as TrimesterInfo[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const FALLBACK_TRIMESTER_INFO = [
{ trimester_number: 1, label_az: '1-ci Trimester', emoji: '🌱', color_class: 'bg-green-500/10 border-green-500/30' },
{ trimester_number: 2, label_az: '2-ci Trimester', emoji: '🌸', color_class: 'bg-amber-500/10 border-amber-500/30' },
{ trimester_number: 3, label_az: tr("usetrimesterinfo_3_cu_trimester_a4a4bb", "3-c\xFC Trimester"), emoji: '🍼', color_class: 'bg-primary/10 border-primary/30' }];