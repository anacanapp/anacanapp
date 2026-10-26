import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import { brandReportArgs, type AdBrand, type BrandFilters, type BrandReport } from '@/lib/brand-ads';

export function useAdBrands() {
  const { user } = useAuth(), backend = getBackendConfig().url;
  return useQuery({ queryKey: ['brand-ads-access', backend, user?.id], enabled: !!user, meta: { persist: false }, staleTime: 15000, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('my_ad_brands_v1').abortSignal(signal);
      if (error) throw error; return data as AdBrand[];
    } });
}
export function useBrandReport(brand: string | null, filters: BrandFilters) {
  const { user } = useAuth(), backend = getBackendConfig().url;
  return useQuery({ queryKey: ['brand-ads-report', backend, user?.id, brand, filters], enabled: !!user && !!brand,
    meta: { persist: false }, staleTime: 15000, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('brand_ad_report_v1', brandReportArgs(brand!, filters)).abortSignal(signal);
      if (error) throw error;
      if (data?.brand?.id !== brand || data?.protocol !== 'anacan-brand-ads-v1') throw new Error('BRAND_ADS_REPORT_MISMATCH');
      return data as BrandReport;
    } });
}
export function useAdminBrands(brand: string | null) {
  const { user, isAdmin } = useAuth(), backend = getBackendConfig().url;
  return useQuery({ queryKey: ['admin-brand-ads', backend, user?.id, brand], enabled: !!user && isAdmin, meta: { persist: false }, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('admin_brand_workspace_v1', { p_brand: brand }).abortSignal(signal);
      if (error) throw error; return data as { brands: AdBrand[]; members: { user_id: string; email: string; is_active: boolean }[]; banners: { id: string; title: string; placement: string; brand_id: string | null; is_active: boolean }[] };
    } });
}
export function useAdminBrandAction() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (args: Record<string, unknown>) => {
    const { data, error } = await (supabase as any).rpc('admin_brand_action_v1', args); if (error) throw error; return data;
  }, onSuccess: () => client.invalidateQueries({ predicate: query => /^(admin-brand-ads|brand-ads-|banners)/.test(String(query.queryKey[0])) }) });
}
