import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { compareNativeVersions } from '@/integrations/supabase/backend-admission';

interface ForceUpdateConfig {
  enabled: boolean;
  min_version: string;
  title: string;
  message: string;
  android_url: string;
  ios_url: string;
}

export function useForceUpdate() {
  const native = Capacitor.isNativePlatform();
  const { data, isLoading } = useQuery({
    queryKey: ['force-update-config'],
    queryFn: async () => {
      const [info, result] = await Promise.all([
        App.getInfo(),
        supabase.rpc('get_public_app_setting' as any, { p_key: 'force_update' }),
      ]);
      if (result.error) throw result.error;
      const config = (typeof result.data === 'string' ? JSON.parse(result.data) : result.data) as ForceUpdateConfig | null;
      const comparison = config ? compareNativeVersions(info.version, config.min_version) : null;
      return { config, updateRequired: config?.enabled === true && comparison !== null && comparison < 0 };
    },
    enabled: native,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  return { forceUpdate: data?.config ?? null, updateRequired: native && data?.updateRequired === true,
    isLoading: native && isLoading };
}
