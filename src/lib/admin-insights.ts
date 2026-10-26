import { supabase } from '@/integrations/supabase/client';
import { tr } from './tr';
import { getLocaleTag } from './i18n';
export interface InsightFilters { countries: string[]; languages: string[]; modules: string[]; access: string; search?: string }
export const emptyInsightFilters = (): InsightFilters => ({ countries: [], languages: [], modules: [], access: 'all', search: '' });
export interface AdminMember { user_id: string; name: string | null; email: string | null; country: string; language: string; module: string;
  joined_at: string; access_kind: string; billing_cycle: string; billing_basis: string; subscription_status: string; is_trial: boolean;
  expires_at: string | null; cancelled_at: string | null; product_id: string | null }
export interface MemberPage { schema: 'anacan-admin-members-v1'; total: number; page: number; size: number; items: AdminMember[] }
export interface AdminInsights { schema: 'anacan-admin-insights-v1'; generatedAt: string; from: string; to: string; timezone: string;
  kpis: Record<string, number>; activity: Record<string, number>;
  countries: Array<{ country: string; users: number; premium: number; trial: number; monthly: number }>;
  tools: Array<{ tool_id: string; tool_name: string | null; events: number; users: number; opens: number; uses: number; premium_users: number; last_used: string }>;
  daily: Array<{ date: string; events: number; active: number; joined: number }>;
  cancellations: { storeUsers: number; surveyUsers: number; reasons: Array<{ reason_code: string; cancel_flow: string; users: number }> };
  payments: Array<{ currency: string; transactions: number; amount: number }>;
}
export interface ProviderMetrics { available: boolean; reason?: string; checkedAt: string; scope: 'project';
  metrics?: Array<{ id: string; name: string; value: number; unit: string; description?: string }> }
export const adminErrorText = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  return ({ admin_required: tr('admin_required', 'Bu səhifə administrator hesabı üçündür.'), admin_runtime_required: tr('admin_runtime_required', 'Admin backend yenilənməsi tələb olunur.'),
    admin_invalid_period: tr('admin_invalid_period', 'Tarix intervalını yoxlayın (maksimum 366 gün).'), admin_audience_changed: tr('admin_audience_changed', 'Auditoriya dəyişib. Önbaxışı yeniləyib göndərin.'),
    admin_empty_audience: tr('admin_empty_audience', 'Bu seçimlər üzrə göndərişə uyğun cihaz yoxdur.'), admin_campaign_id_conflict: tr('admin_campaign_id_conflict', 'Bu göndərişin məzmunu artıq qeydə alınıb.'),
    admin_campaign_changed: tr('admin_campaign_changed', 'Kampaniya məzmunu dəyişib. Yeni önbaxışla ayrıca kampaniya yaradın.'),
  } as Record<string, string>)[code] ?? tr('admin_data_unavailable', 'Məlumat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
};
export async function adminRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const request = (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => {
    abortSignal: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  })(name, args);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const { data, error } = await request.abortSignal(controller.signal);
    if (error) throw new Error(error.code === 'PGRST202' ? 'admin_runtime_required' : /^admin_[a-z_]+$/.test(error.message || '') ? error.message : 'admin_unavailable');
    return data as T;
  } finally { clearTimeout(timeout); }
}
export async function fetchAdminInsights(from: string, to: string, filters: InsightFilters): Promise<AdminInsights> {
  const data = await adminRpc<AdminInsights>('admin_insights_v1', { p_from: from, p_to: to, p_filters: filters });
  if (data?.schema !== 'anacan-admin-insights-v1' || !data.kpis || !data.activity || !Array.isArray(data.tools) || !Array.isArray(data.countries)) throw new Error('admin_invalid_response');
  return data;
}
export async function fetchAdminMembers(filters: InsightFilters, page: number): Promise<MemberPage> {
  const data = await adminRpc<MemberPage>('admin_members_v1', { p_filters: filters, p_page: page, p_size: 30 });
  if (data?.schema !== 'anacan-admin-members-v1' || !Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('admin_invalid_response');
  return data;
}
export async function fetchProviderMetrics(): Promise<ProviderMetrics> {
  const { data, error } = await supabase.functions.invoke('admin-revenue-metrics', { body: {} });
  if (error || typeof data?.available !== 'boolean') throw new Error('admin_revenue_unavailable');
  return data;
}
export const ACCESS_LABELS: Record<string, string> = {
  all: tr('admin_access_all', 'Bütün istifadəçilər'), premium: tr('admin_access_premium', 'Bütün Premium hüquqları'),
  paid: tr('admin_access_paid', 'Ödənişli'), trial: tr('admin_access_trial', 'Trial'), manual: tr('admin_access_manual', 'Manual / hədiyyə'),
  household: tr('admin_access_household', 'Ailə Premium-u'), free: tr('admin_access_free', 'Pulsuz'),
  cancelled: tr('admin_access_cancelled', 'Yenilənməsi ləğv edilən'), expired: tr('admin_access_expired', 'Bitmiş'),
  monthly: tr('admin_access_monthly', 'Aylıq ödənişli'), annual: tr('admin_access_annual', 'İllik / köhnə Premium+'),
};
export const CYCLE_LABELS: Record<string, string> = { monthly: tr('admin_cycle_monthly', 'Aylıq'), annual: tr('admin_cycle_annual', 'İllik'),
  lifetime: tr('admin_cycle_lifetime', 'Ömürlük'), annual_or_lifetime: tr('admin_cycle_annual_lifetime', 'İllik / ömürlük'), unknown: tr('admin_not_recorded', 'Qeyd olunmayıb') };
export const countryFlag = (code: string) => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(letter => letter.charCodeAt(0) + 127397)) : '';
export const MODULE_LABELS: Record<string, string> = { flow: tr('admin_module_flow', 'Menstruasiya'), bump: tr('admin_module_bump', 'Hamiləlik'),
  mommy: tr('admin_module_mommy', 'Analıq'), partner: tr('admin_module_partner', 'Partnyor'), unknown: tr('admin_module_unknown', 'Seçilməyib') };
export const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(getLocaleTag()) : '—';
export function monthPeriod(offset = 0, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = offset === 0 ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
