import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppBranding {
  id: string;
  key: string;
  image_url: string | null;
  description: string | null;
  updated_at: string;
}

export const useAppBranding = () => {
  return useQuery({
    queryKey: ['app-branding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_branding')
        .select('*')
        .order('key');

      if (error) {
        console.error('Error fetching app branding:', error);
        return [];
      }
      return data as AppBranding[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateBranding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, image_url }: { key: string; image_url: string }) => {
      const { error } = await supabase
        .from('app_branding')
        .update({ image_url, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-branding'] });
    },
  });
};

export const getBrandingUrl = (branding: AppBranding[], key: string): string | null => {
  const item = branding.find(b => b.key === key);
  return item?.image_url || null;
};
