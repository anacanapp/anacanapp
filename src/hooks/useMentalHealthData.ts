import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';

export interface EPDSQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_text_az: string | null;
  options: {value: number;text: string;text_az: string;}[];
  is_reverse_scored: boolean;
}

export interface MoodLevel {
  id: string;
  mood_value: number;
  label: string;
  label_az: string | null;
  emoji: string;
  color: string | null;
}

export interface BreathingExercise {
  id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  icon: string | null;
  color: string | null;
  inhale_seconds: number;
  hold_seconds: number;
  exhale_seconds: number;
  hold_after_exhale_seconds: number;
  total_cycles: number;
  benefits_az: string[] | null;
}

export interface NoiseThreshold {
  id: string;
  threshold_key: string;
  min_db: number;
  max_db: number | null;
  label: string;
  label_az: string | null;
  color: string | null;
  emoji: string | null;
  description_az: string | null;
}

export const useEPDSQuestionsDB = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['epds-questions', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('epds_questions').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      const expanded = (NEW_LANGUAGE_CODES as readonly string[]).includes(language);
      const mapped = mapRowsTranslation(data, language, expanded ? ['question_text', 'options'] : ['question_text']);
      return (mapped || []).map((q) => ({
        ...q,
        options: (q.options as any[] || []).map((o) => ({
          value: o.value,
          // de/ar üçün en (base `text` sahəsi ingiliscədir) körpüsü, kk/uz/ka üçün ru körpüsü
          text: expanded ? (o[`text_${language}`] ?? o.text ?? o.text_az) : language === 'az' ? (o.text_az ?? o.text) :
                language === 'de' ? (o.text_de ?? o.text ?? o.text_az) :
                language === 'ar' ? (o.text_ar ?? o.text ?? o.text_az) :
                language === 'kk' ? (o.text_kk ?? o.text_ru ?? o.text_az ?? o.text) :
                language === 'uz' ? (o.text_uz ?? o.text_ru ?? o.text_az ?? o.text) :
                language === 'ka' ? (o.text_ka ?? o.text_ru ?? o.text_az ?? o.text) :
                (o[`text_${language}`] ?? o.text_az ?? o.text),
          text_az: o.text_az
        }))
      })) as EPDSQuestion[];
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};

export const useMoodLevelsDB = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['mood-levels', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('mood_levels').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['label']) as unknown as MoodLevel[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const useBreathingExercisesDB = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['breathing-exercises', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('breathing_exercises').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['name', 'description']) as unknown as BreathingExercise[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const useNoiseThresholdsDB = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['noise-thresholds', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('noise_thresholds').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['label', 'description']) as unknown as NoiseThreshold[];
    },
    staleTime: 1000 * 60 * 30
  });
};

// Fallback data for when DB is empty
export const FALLBACK_MOOD_LEVELS: MoodLevel[] = [
{ id: '1', mood_value: 1, label: tr("usementalhealthdata_cox_pis_e041c5", "\xC7ox pis"), label_az: tr("usementalhealthdata_cox_pis_e041c5", "\xC7ox pis"), emoji: '😢', color: '#ef4444' },
{ id: '2', mood_value: 2, label: tr("usementalhealthdata_pis_e041c6", "Pis"), label_az: tr("usementalhealthdata_pis_e041c6", "Pis"), emoji: '😔', color: '#f97316' },
{ id: '3', mood_value: 3, label: tr("usementalhealthdata_normal_e041c7", "Normal"), label_az: tr("usementalhealthdata_normal_e041c7", "Normal"), emoji: '😐', color: '#eab308' },
{ id: '4', mood_value: 4, label: tr("usementalhealthdata_yaxsi_9d8595", "Yax\u015F\u0131"), label_az: tr("usementalhealthdata_yaxsi_9d8595", "Yax\u015F\u0131"), emoji: '😊', color: '#22c55e' },
{ id: '5', mood_value: 5, label: tr("usementalhealthdata_ela_720a0e", "\u018Fla"), label_az: tr("usementalhealthdata_ela_720a0e", "\u018Fla"), emoji: '🥰', color: '#10b981' }];


export const FALLBACK_BREATHING_EXERCISES: BreathingExercise[] = [
{
  id: '1',
  name: tr("usementalhealthdata_4_7_8_nefes_3ae243", "4-7-8 N\u0259f\u0259s"),
  name_az: tr("usementalhealthdata_4_7_8_nefes_3ae243", "4-7-8 N\u0259f\u0259s"),
  description: tr("usementalhealthdata_sakitlik_ve_yuxuya_komek_eden__f1b25c", "Sakitlik v\u0259 yuxuya k\xF6m\u0259k ed\u0259n relaksasiya texnikas\u0131"),
  description_az: tr("usementalhealthdata_sakitlik_ve_yuxuya_komek_eden__f1b25c", "Sakitlik v\u0259 yuxuya k\xF6m\u0259k ed\u0259n relaksasiya texnikas\u0131"),
  icon: 'Wind',
  color: '#8b5cf6',
  inhale_seconds: 4,
  hold_seconds: 7,
  exhale_seconds: 8,
  hold_after_exhale_seconds: 0,
  total_cycles: 4,
  benefits_az: [tr("usementalhealthdata_stressi_azaldir_80384b", "Stressi azald\u0131r"), tr("usementalhealthdata_yuxuya_komek_edir_bc795a", "Yuxuya k\xF6m\u0259k edir")]
},
{
  id: '2',
  name: tr("usementalhealthdata_qutu_nefesi_7667cf", "Qutu N\u0259f\u0259si"),
  name_az: tr("usementalhealthdata_qutu_nefesi_7667cf", "Qutu N\u0259f\u0259si"),
  description: tr("usementalhealthdata_stress_nezareti_ucun_texnika_83964c", "Stress n\u0259zar\u0259ti \xFC\xE7\xFCn texnika"),
  description_az: tr("usementalhealthdata_stress_nezareti_ucun_texnika_83964c", "Stress n\u0259zar\u0259ti \xFC\xE7\xFCn texnika"),
  icon: 'Square',
  color: '#3b82f6',
  inhale_seconds: 4,
  hold_seconds: 4,
  exhale_seconds: 4,
  hold_after_exhale_seconds: 4,
  total_cycles: 4,
  benefits_az: [tr("usementalhealthdata_diqqeti_artirir_6ef41b", "Diqq\u0259ti art\u0131r\u0131r"), tr("usementalhealthdata_narahatligi_azaldir_9bb2df", "Narahatl\u0131\u011F\u0131 azald\u0131r")]
}];
