import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandReportArgs, type AdBrand, type BrandFilters, type BrandReport } from '@/lib/brand-ads';
import { useBrandAuth } from './Auth';
import type { AudienceDimension, AudienceRow, BrandTargeting } from '@/lib/ads/brandTargeting';

export interface BrandMember { user_id: string; email: string; is_active: boolean; managed: boolean }
export interface BrandWorkspace { brands: AdBrand[]; members: BrandMember[]; banners: { id: string; title: string; placement: string; brand_id: string | null; is_active: boolean }[] }
export function usePortalReport(brand: AdBrand | undefined, filters: BrandFilters) {
  const { client, session, access, backendOrigin, reportBackend } = useBrandAuth();
  return useQuery({ queryKey: ['brand-portal-report', backendOrigin, session?.user.id, brand?.id, filters],
    enabled: !!session && !!brand && !!access?.allowed, staleTime: 15000, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('brand_ad_report_v1', brandReportArgs(brand!.id, filters)).abortSignal(signal);
      if (error) throw error;
      if (data?.brand?.id !== brand!.id || data.protocol !== 'anacan-brand-ads-v1' || data.backend !== reportBackend) throw new Error('BRAND_PORTAL_REPORT_MISMATCH');
      return data as BrandReport;
    } });
}
export function usePortalWorkspace(brand: string | null) {
  const { client, session, access, backendOrigin } = useBrandAuth();
  return useQuery({ queryKey: ['brand-portal-admin', backendOrigin, session?.user.id, brand], enabled: !!access?.admin,
    staleTime: 0, gcTime: 0, retry: false, queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('admin_brand_workspace_v1', { p_brand: brand }).abortSignal(signal);
      if (error) throw error; return data as BrandWorkspace;
    } });
}
export function usePortalAdminAction() {
  const { client } = useBrandAuth(), queries = useQueryClient();
  return useMutation({ mutationFn: async (args: { action: string; brand: string | null; target?: string | null; payload: Record<string, unknown>; request?: string }) => {
    const { data, error } = await client.rpc('admin_brand_action_v1', { p_action: args.action, p_brand: args.brand, p_target: args.target ?? null, p_payload: args.payload, p_request: args.request || crypto.randomUUID() });
    if (error) throw error; return data;
  }, onSuccess: () => queries.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith('brand-portal-') }) });
}

// ── anacan-brand-ads-v3 ────────────────────────────────────────────────────────
export interface AudienceReport { protocol: string; brand: string; from: string; to: string; k: number; available: boolean; reach?: number;
  dimensions: Partial<Record<AudienceDimension, AudienceRow[]>>; timezone: string; refreshed_at: string }
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
export interface CreativeDraft { id: string; banner_id: string | null; payload: CreativePayload; status: ReviewStatus; review_note: string | null; revision: number; updated_at: string }
export interface CreativePayload extends BrandTargeting {
  placement: string; banner_type: 'native' | 'image'; native_template: string; creative_options: { offer_code?: string; expert_name?: string; expert_role?: string };
  image_url: string | null; background_color: string; text_color: string; link_type: 'external' | 'lead_form'; link_url: string | null; lead_form_id: string | null;
  copy: Record<string, { title?: string; description?: string; button_text?: string }>; start_date: string | null; end_date: string | null;
}
export interface LeadFormRecord { id: string; name: string; fields: { key: string; required: boolean }[]; copy: Record<string, Record<string, string>>;
  privacy_url: string | null; retention_days: number; status: ReviewStatus; live: boolean; review_note: string | null; revision: number; updated_at: string; leads: number }
export interface LeadRecord { id: string; form_id: string; form_name: string; answers: Record<string, string>; language: string; consent_text: string; consent_at: string; created_at: string; expires_at: string }
export interface LeadsPage { protocol: string; brand: string; total: number; leads: LeadRecord[]; export_truncated: boolean }
export interface ReviewQueue {
  creatives: { id: string; brand_id: string; brand_name: string; banner_id: string | null; payload: CreativePayload; revision: number; submitted_at: string }[];
  lead_forms: (Omit<LeadFormRecord, 'status' | 'live' | 'review_note' | 'updated_at' | 'leads'> & { brand_id: string; brand_name: string; submitted_at: string })[];
}

function usePortalRpc<T>(key: unknown[], name: string, args: Record<string, unknown>, enabled: boolean, check: (data: any) => boolean = () => true) {
  const { client, session, access, backendOrigin } = useBrandAuth();
  return useQuery({ queryKey: ['brand-portal-' + name, backendOrigin, session?.user.id, ...key], enabled: !!session && !!access?.allowed && enabled,
    staleTime: 15000, gcTime: 0, retry: false, queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc(name, args).abortSignal(signal);
      if (error) throw error;
      if (!check(data)) throw new Error('BRAND_PORTAL_RESPONSE_MISMATCH');
      return data as T;
    } });
}
export const usePortalAudience = (brand: string, filters: { from: string; to: string; placement: string }) =>
  usePortalRpc<AudienceReport>([brand, filters], 'brand_audience_report_v1', { p_brand: brand, p_from: filters.from, p_to: filters.to,
    p_placement: filters.placement === 'all' ? null : filters.placement, p_ad: null }, true, data => data?.protocol === 'anacan-brand-audience-v1' && data.brand === brand);
export const usePortalDrafts = (brand: string) => usePortalRpc<CreativeDraft[]>([brand], 'brand_creative_drafts_v1', { p_brand: brand }, true, Array.isArray);
export const usePortalLeadForms = (brand: string) => usePortalRpc<LeadFormRecord[]>([brand], 'brand_lead_forms_v1', { p_brand: brand }, true, Array.isArray);
export const usePortalLeads = (brand: string, form: string | null, page: number, enabled = true) =>
  usePortalRpc<LeadsPage>([brand, form, page], 'brand_leads_v1', { p_brand: brand, p_form: form, p_limit: 50, p_offset: page * 50, p_export: false }, enabled,
    data => data?.protocol === 'anacan-brand-leads-v1' && data.brand === brand);
export const usePortalReviewQueue = (enabled: boolean) => usePortalRpc<ReviewQueue>([], 'admin_brand_review_queue_v1', {}, enabled,
  data => Array.isArray(data?.creatives) && Array.isArray(data?.lead_forms));
export function usePortalMutation(name: string) {
  const { client } = useBrandAuth(), queries = useQueryClient();
  return useMutation({ mutationFn: async (args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args); if (error) throw error; return data;
  }, onSuccess: () => queries.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith('brand-portal-') }) });
}
