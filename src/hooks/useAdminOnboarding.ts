import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OnboardingStage {
  id: string;
  stage_id: string;
  title: string;
  title_az: string | null;
  subtitle: string | null;
  subtitle_az: string | null;
  description: string | null;
  description_az: string | null;
  emoji: string;
  icon_name: string;
  bg_gradient: string;
  sort_order: number;
  is_active: boolean;
}

export interface MultiplesOption {
  id: string;
  option_id: string;
  label: string;
  label_az: string | null;
  emoji: string;
  baby_count: number;
  sort_order: number;
  is_active: boolean;
}

export const useAdminOnboardingStages = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['onboarding-stages-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_stages')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data as OnboardingStage[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<OnboardingStage>) => {
      const { error } = await supabase.from('onboarding_stages').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages'] });
      toast({ title: tr("useadminonboarding_merhele_elave_edildi_5bc49c", "Mərhələ əlavə edildi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<OnboardingStage> & { id: string }) => {
      const { error } = await supabase.from('onboarding_stages').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages'] });
      toast({ title: tr("useadminonboarding_merhele_yenilendi_18f4f3", "Mərhələ yeniləndi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('onboarding_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-stages'] });
      toast({ title: tr("useadminonboarding_merhele_silindi_fb7d94", "Mərhələ silindi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  return { ...query, create, update, remove };
};

export const useAdminMultiplesOptions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['multiples-options-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multiples_options')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data as MultiplesOption[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: Partial<MultiplesOption>) => {
      const { error } = await supabase.from('multiples_options').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multiples-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['multiples-options'] });
      toast({ title: tr("useadminonboarding_secim_elave_edildi_c68c1c", "Seçim əlavə edildi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<MultiplesOption> & { id: string }) => {
      const { error } = await supabase.from('multiples_options').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multiples-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['multiples-options'] });
      toast({ title: tr("useadminonboarding_secim_yenilendi_9d5d1b", "Seçim yeniləndi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('multiples_options').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multiples-options-admin'] });
      queryClient.invalidateQueries({ queryKey: ['multiples-options'] });
      toast({ title: tr("useadminonboarding_secim_silindi_78ce04", "Seçim silindi") });
    },
    onError: () => {
      toast({ title: tr("useadminonboarding_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    },
  });

  return { ...query, create, update, remove };
};
