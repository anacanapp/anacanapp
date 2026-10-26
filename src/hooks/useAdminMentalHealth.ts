import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// NOT: bütün bu fayldakı 15 mutasiyanın (5 resurs növü x create/update/
// remove) heç birində onError yox idi - bir Supabase xətası tamamilə
// sessiz udulurdu (uğur toast-u da göstərilmirdi, sadəcə heç nə baş
// vermirdi). Paylaşılan bir xəta callback-i əlavə olunur.
const showGenericError = (toast: ReturnType<typeof useToast>['toast']) => () => {
  toast({ title: tr("useadminmentalhealth_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
};

export interface EPDSQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_text_az: string | null;
  options: { value: number; text: string; text_az: string }[];
  is_reverse_scored: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MoodLevel {
  id: string;
  mood_value: number;
  label: string;
  label_az: string | null;
  emoji: string;
  color: string | null;
  is_active: boolean;
  sort_order: number;
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
  benefits: string[] | null;
  benefits_az: string[] | null;
  is_active: boolean;
  sort_order: number;
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
  description: string | null;
  description_az: string | null;
  is_active: boolean;
  sort_order: number;
}

// EPDS Questions
export const useAdminEPDSQuestions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['admin-epds-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epds_questions')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []).map(q => ({
        ...q,
        options: (q.options as { value: number; text: string; text_az: string }[]) || [],
      })) as EPDSQuestion[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<EPDSQuestion>) => {
      const { error } = await supabase.from('epds_questions').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-epds-questions'] });
      queryClient.invalidateQueries({ queryKey: ['epds-questions'] });
      toast({ title: tr("useadminmentalhealth_sual_elave_edildi_2d000b", "Sual əlavə edildi") });
    },
    onError: showGenericError(toast),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<EPDSQuestion> & { id: string }) => {
      const { error } = await supabase.from('epds_questions').update(item as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-epds-questions'] });
      queryClient.invalidateQueries({ queryKey: ['epds-questions'] });
      toast({ title: tr("useadminmentalhealth_sual_yenilendi_786899", "Sual yeniləndi") });
    },
    onError: showGenericError(toast),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('epds_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-epds-questions'] });
      queryClient.invalidateQueries({ queryKey: ['epds-questions'] });
      toast({ title: tr("hooks_adminfaq_sual_silindi", "Sual silindi") });
    },
    onError: showGenericError(toast),
  });

  return { ...query, create, update, remove };
};

// Mood Levels
export const useAdminMoodLevels = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['admin-mood-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_levels')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as MoodLevel[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<MoodLevel>) => {
      const { error } = await supabase.from('mood_levels').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mood-levels'] });
      queryClient.invalidateQueries({ queryKey: ['mood-levels'] });
      toast({ title: tr("useadminmentalhealth_ehval_seviyyesi_elave_edildi_b321b6", "Əhval səviyyəsi əlavə edildi") });
    },
    onError: showGenericError(toast),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<MoodLevel> & { id: string }) => {
      const { error } = await supabase.from('mood_levels').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mood-levels'] });
      queryClient.invalidateQueries({ queryKey: ['mood-levels'] });
      toast({ title: tr("useadminmentalhealth_ehval_seviyyesi_yenilendi_26939a", "Əhval səviyyəsi yeniləndi") });
    },
    onError: showGenericError(toast),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mood_levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mood-levels'] });
      queryClient.invalidateQueries({ queryKey: ['mood-levels'] });
      toast({ title: tr("useadminmentalhealth_ehval_seviyyesi_silindi_802b1e", "Əhval səviyyəsi silindi") });
    },
    onError: showGenericError(toast),
  });

  return { ...query, create, update, remove };
};

// Breathing Exercises
export const useAdminBreathingExercises = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['admin-breathing-exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breathing_exercises')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as BreathingExercise[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<BreathingExercise>) => {
      const { error } = await supabase.from('breathing_exercises').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-breathing-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['breathing-exercises'] });
      toast({ title: tr("useadminmentalhealth_nefes_mesqi_elave_edildi_0f4266", "Nəfəs məşqi əlavə edildi") });
    },
    onError: showGenericError(toast),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<BreathingExercise> & { id: string }) => {
      const { error } = await supabase.from('breathing_exercises').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-breathing-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['breathing-exercises'] });
      toast({ title: tr("useadminmentalhealth_nefes_mesqi_yenilendi_61bfcc", "Nəfəs məşqi yeniləndi") });
    },
    onError: showGenericError(toast),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('breathing_exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-breathing-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['breathing-exercises'] });
      toast({ title: tr("useadminmentalhealth_nefes_mesqi_silindi_4bf0db", "Nəfəs məşqi silindi") });
    },
    onError: showGenericError(toast),
  });

  return { ...query, create, update, remove };
};

// Noise Thresholds
export const useAdminNoiseThresholds = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['admin-noise-thresholds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('noise_thresholds')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as NoiseThreshold[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<NoiseThreshold>) => {
      const { error } = await supabase.from('noise_thresholds').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-noise-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['noise-thresholds'] });
      toast({ title: tr("useadminmentalhealth_ses_hedd_elave_edildi_b3723a", "Səs hədd əlavə edildi") });
    },
    onError: showGenericError(toast),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<NoiseThreshold> & { id: string }) => {
      const { error } = await supabase.from('noise_thresholds').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-noise-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['noise-thresholds'] });
      toast({ title: tr("useadminmentalhealth_ses_hedd_yenilendi_66ecc6", "Səs hədd yeniləndi") });
    },
    onError: showGenericError(toast),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('noise_thresholds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-noise-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['noise-thresholds'] });
      toast({ title: tr("useadminmentalhealth_ses_hedd_silindi_041844", "Səs hədd silindi") });
    },
    onError: showGenericError(toast),
  });

  return { ...query, create, update, remove };
};

// Mental Health Resources
export interface MentalHealthResourceAdmin {
  id: string;
  name: string;
  name_az: string;
  description: string | null;
  description_az: string | null;
  resource_type: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  address_az: string | null;
  is_emergency: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
}

export const useAdminMentalHealthResources = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['admin-mental-health-resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mental_health_resources')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as MentalHealthResourceAdmin[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<MentalHealthResourceAdmin>) => {
      const { error } = await supabase.from('mental_health_resources').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mental-health-resources'] });
      queryClient.invalidateQueries({ queryKey: ['mental-health-resources'] });
      toast({ title: tr("useadminmentalhealth_resurs_elave_edildi_5dd590", "Resurs əlavə edildi") });
    },
    onError: showGenericError(toast),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<MentalHealthResourceAdmin> & { id: string }) => {
      const { error } = await supabase.from('mental_health_resources').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mental-health-resources'] });
      queryClient.invalidateQueries({ queryKey: ['mental-health-resources'] });
      toast({ title: tr("useadminmentalhealth_resurs_yenilendi_710694", "Resurs yeniləndi") });
    },
    onError: showGenericError(toast),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mental_health_resources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mental-health-resources'] });
      queryClient.invalidateQueries({ queryKey: ['mental-health-resources'] });
      toast({ title: tr("hooks_adminmh_resurs_silindi", "Resurs silindi") });
    },
    onError: showGenericError(toast),
  });

  return { ...query, create, update, remove };
};
