import { tr } from "@/lib/tr";import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingStage {
  id: string;
  stage_id: string;
  title: string;
  title_az: string | null;
  title_en: string | null;
  title_ru: string | null;
  subtitle: string | null;
  subtitle_az: string | null;
  subtitle_en: string | null;
  subtitle_ru: string | null;
  description: string | null;
  description_az: string | null;
  description_en: string | null;
  description_ru: string | null;
  emoji: string;
  icon_name: string;
  bg_gradient: string;
  sort_order: number;
}

interface MultiplesOption {
  id: string;
  option_id: string;
  label: string;
  label_az: string | null;
  label_en: string | null;
  label_ru: string | null;
  emoji: string;
  baby_count: number;
  sort_order: number;
}

// Fetch onboarding stages from database
export const useOnboardingStages = () => {
  return useQuery({
    queryKey: ['onboarding-stages'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('onboarding_stages').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) {
        console.error('Error fetching onboarding stages:', error);
        return [];
      }

      return data as unknown as OnboardingStage[];
    },
    staleTime: 1000 * 60 * 60 // 1 hour
  });
};

// Fetch multiples options from database
export const useMultiplesOptions = () => {
  return useQuery({
    queryKey: ['multiples-options'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('multiples_options').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) {
        console.error('Error fetching multiples options:', error);
        return [];
      }

      return data as unknown as MultiplesOption[];
    },
    staleTime: 1000 * 60 * 60 // 1 hour
  });
};

// Static fallbacks for when database is empty
export const getFallbackStages = () => [
{
  stage_id: 'flow',
  title_az: tr("usedynamiconboarding_dovrumu_izlemek_742fa2", "Dövrümü izləmək"),
  subtitle_az: tr("usedynamiconboarding_menstruasiya_teqvimi_0e3b14", "Menstruasiya təqvimi"),
  description_az: tr("usedynamiconboarding_dovrunuzu_izleyin_ovulyasiyani_370b05", "Dövrünüzü izləyin, ovulyasiyanı proqnozlaşdırın"),
  emoji: '🌸',
  icon_name: 'Calendar',
  bg_gradient: 'from-rose-500 to-pink-600'
},
{
  stage_id: 'bump',
  title_az: tr("usedynamiconboarding_hamileliyim_c88922", "Hamiləliyim"),
  subtitle_az: tr("usedynamiconboarding_hamilelik_izleyicisi_2a251f", "Hamiləlik izləyicisi"),
  description_az: tr("usedynamiconboarding_korpenizin_inkisafini_hefte_he_c2597f", "Körpənizin inkişafını həftə-həftə izləyin"),
  emoji: '🤰',
  icon_name: 'Heart',
  bg_gradient: 'from-violet-500 to-purple-600'
},
{
  stage_id: 'mommy',
  title_az: tr("usedynamiconboarding_korpem_var_58e0cd", "Körpəm var"),
  subtitle_az: tr("usedynamiconboarding_analiq_yardimcisi_acf2af", "Analıq yardımçısı"),
  description_az: tr("usedynamiconboarding_korpenizin_qidalanma_yuxu_ve_i_06b9ec", "Körpənizin qidalanma, yuxu və inkişafını izləyin"),
  emoji: '👶',
  icon_name: 'Baby',
  bg_gradient: 'from-emerald-500 to-teal-600'
}];

export const getFallbackMultiples = () => [
{ option_id: 'single', label_az: tr("usedynamiconboarding_tek_usaq_9b99b4", "Tək uşaq"), emoji: '👶', baby_count: 1 },
{ option_id: 'twins', label_az: tr("usedynamiconboarding_ekiz_680a49", "Əkiz"), emoji: '👶👶', baby_count: 2 }];