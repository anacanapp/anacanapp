import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

export const useAppSettings = () => {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('key');

      if (error) {
        console.error('Error fetching app settings:', error);
        return [];
      }

      return data as AppSetting[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAppSetting = (key: string) => {
  // NOT: Əvvəllər `useAppSettings()`-in (bütün sətirləri gətirən, admin-only
  // RLS-ə tabe) keşindən slice edirdi. `app_settings`-in SELECT policy-si
  // 20260514093759/20260514094740-da tamamilə admin-only edildiyi üçün bu,
  // real (admin olmayan) istifadəçilər üçün HƏMİŞƏ boş qayıdırdı — bir çox
  // canlı funksiyanı (mommy_hero_variant, social_login_enabled,
  // affiliate_section_enabled, community_header_*, premium_paywall_config,
  // billing_page_config, force_update) sessizcə sındırırdı. İndi dar-hədəfli,
  // yalnız açıq allowlist-dəki açarları qaytaran ictimai RPC istifadə olunur
  // (bax Duzelis43.sql) — Epoint açarları kimi sirlər bu yolla ƏSLA
  // əlçatan deyil.
  const { data } = useQuery({
    queryKey: ['app-setting-public', key],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_app_setting' as any, { p_key: key });
      if (error) {
        console.error(`Error fetching app setting "${key}":`, error);
        return null;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Parse boolean strings / JSON-encoded values (dəyər DB-də ikiqat encode
  // oluna bilir, çünki yazma tərəfi həmişə JSON.stringify(value) göndərir)
  if (data === 'true') return true;
  if (data === 'false') return false;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data ?? undefined;
};

export const useUpdateAppSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      // First check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: typeof value === 'string' ? value : JSON.stringify(value) })
          .eq('key', key);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            key, 
            value: typeof value === 'string' ? value : JSON.stringify(value) 
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
};

// Convenience hooks for specific settings
export const useLifeStageEnabled = (stage: 'flow' | 'bump' | 'mommy') => {
  const value = useAppSetting(`${stage}_mode_enabled`);
  return value !== false; // Default to true if not set
};

export const useDarkModeEnabled = () => {
  const value = useAppSetting('dark_mode_enabled');
  return value !== false; // Default to true if not set
};
