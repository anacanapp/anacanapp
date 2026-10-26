import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';
import { localizedCountryName } from '@/lib/app-languages';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { vaccineTiming } from '@/lib/vaccine-schedule';

export interface VaccineCountry {
  id: string;
  code: string;
  name_az: string;
  name_en: string;
  name?: string;
  flag_emoji: string | null;
  source_url: string | null;
  source_label: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  schedule_meta?: { protocol: string; version: string; reviewed_at: string; notes: Record<string, string> } | null;
}

export interface Vaccine {
  id: string;
  country_code: string;
  code: string;
  name_az: string;
  name_en: string | null;
  name?: string;
  short_description_az: string | null;
  short_description_en?: string | null;
  short_description?: string | null;
  full_description_az: string | null;
  full_description_en?: string | null;
  full_description?: string | null;
  disease_az: string | null;
  disease_en?: string | null;
  disease?: string | null;
  route_az: string | null;
  route_en?: string | null;
  route?: string | null;
  side_effects_az: string | null;
  side_effects_en?: string | null;
  side_effects?: string | null;
  contraindications_az: string | null;
  contraindications_en?: string | null;
  contraindications?: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  sort_order: number;
  color_hex: string | null;
  source_url: string | null;
}

export interface VaccineSchedule {
  id: string;
  vaccine_id: string;
  country_code: string;
  dose_number: number;
  dose_label_az: string;
  dose_label?: string;
  recommended_age_days: number;
  age_label_az: string;
  age_label?: string;
  min_age_days: number | null;
  max_age_days: number | null;
  notes_az: string | null;
  notes?: string | null;
  sort_order: number;
  schedule_meta?: unknown;
}


export interface ChildVaccination {
  id: string;
  user_id: string;
  child_id: string;
  vaccine_schedule_id: string;
  country_code: string;
  administered_at: string | null;
  is_skipped: boolean;
  skip_reason: string | null;
  location_az: string | null;
  batch_number: string | null;
  notes: string | null;
}

export interface VaccineScheduleRow extends VaccineSchedule {
  vaccine: Vaccine;
  status?: ChildVaccination | null;
}

export const useVaccineCountries = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['vaccine-countries', language, getBackendConfig().url],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vaccine_countries' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']).map((row: any) => ({ ...row,
        name: row[`name_${language}`] || localizedCountryName(row.code, language, row.name || row.name_en || row.code),
      })) as unknown as VaccineCountry[];
    },
  });
};

export const useVaccineScheduleForCountry = (countryCode: string | null) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['vaccine-schedule', countryCode, language, getBackendConfig().url],
    enabled: !!countryCode,
    queryFn: async () => {
      const { data: vaccines, error: vErr } = await supabase
        .from('vaccines' as any)
        .select('*')
        .eq('country_code', countryCode!)
        .order('sort_order');
      if (vErr) throw vErr;

      const { data: schedules, error: sErr } = await supabase
        .from('vaccine_schedules' as any)
        .select('*')
        .eq('country_code', countryCode!)
        .order('recommended_age_days');
      if (sErr) throw sErr;

      const mappedVaccines = mapRowsTranslation(vaccines, language, [
        'name',
        'short_description',
        'full_description',
        'disease',
        'route',
        'side_effects',
        'contraindications'
      ]) as unknown as Vaccine[];

      const mappedSchedules = mapRowsTranslation(schedules, language, [
        'dose_label',
        'age_label',
        'notes'
      ]) as unknown as VaccineSchedule[];

      const vMap = new Map(mappedVaccines.map(v => [v.id, v]));
      const rows: VaccineScheduleRow[] = mappedSchedules
        .filter(s => vMap.has(s.vaccine_id))
        .map(s => {
          const vaccine = vMap.get(s.vaccine_id)!;
          const name = vaccineTiming(s)?.display_name?.[language];
          // A reviewed MR programme must not inherit old MMR/mumps prose from a
          // legacy catalogue label. Identifiers and personal records stay intact.
          return { ...s, vaccine: name ? { ...vaccine, name, disease: null, short_description: null,
            full_description: null, route: null, side_effects: null, contraindications: null } : vaccine };
        });
      return rows;
    },
  });
};

export const useChildVaccinations = (childId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['child-vaccinations', childId, user?.id, getBackendConfig().url],
    enabled: !!childId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('child_vaccinations' as any)
        .select('*')
        .eq('child_id', childId!)
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []) as unknown as ChildVaccination[];
    },
  });
};

export const useUpsertChildVaccination = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      child_id: string;
      vaccine_schedule_id: string;
      country_code: string;
      administered_at?: string | null;
      is_skipped?: boolean;
      skip_reason?: string | null;
      location_az?: string | null;
      batch_number?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error('unauthenticated');
      const payload = { ...input, user_id: user.id };
      const { data, error } = await supabase
        .from('child_vaccinations' as any)
        .upsert(payload, { onConflict: 'child_id,vaccine_schedule_id' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ChildVaccination;
    },
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['child-vaccinations', variables.child_id] });
    },
  });
};

export const useDeleteChildVaccination = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; child_id: string }) => {
      const { error } = await supabase
        .from('child_vaccinations' as any)
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['child-vaccinations', variables.child_id] });
    },
  });
};
