/**
 * Partner panel data layer (route /partner, and Admin › Partnyor mağazaları). Every call goes through a
 * SECURITY DEFINER RPC that checks the caller's role for that partner on the server
 * (supabase/migrations/20261117090000_shop_partners.sql); the tables themselves have no client grants.
 */
import { supabase } from '@/integrations/supabase/client';
import type { ShopCollection } from '@/lib/partner-shop';

export type PartnerRole = 'admin' | 'owner' | 'manager' | 'viewer';
export type PartnerStatus = 'admin_only' | 'live' | 'paused';

export interface PanelPartner {
  id: string; slug: string; name: string; logo_url: string | null; icon_url: string | null; brand_color: string;
  status: PartnerStatus; website_url: string | null; commission_pct: number | null; role: PartnerRole;
}
export interface PanelMe { signed_in: boolean; is_admin: boolean; email?: string; partners: PanelPartner[] }

export interface PanelProduct {
  id: string; sku: string | null; name: string; description: string | null; price: number; original_price: number | null;
  stock: number | null; image_url: string | null; source_url: string | null; tags: ShopCollection[]; listed: boolean; updated_at: string;
}
export interface DashboardProduct { id: string; name: string; image_url: string | null; price: number; stock: number | null; listed: boolean;
  impressions: number; opens: number; adds: number; site: number; sold: number; revenue: number }
export interface DashboardDay { d: string; impressions: number; opens: number; adds: number; site: number; revenue: number }
export interface PanelDashboard {
  from: string; to: string; commission_pct: number | null;
  kpis: { impressions: number; opens: number; adds: number; bundles: number; site: number; reach: number };
  sales: { quantity: number; revenue: number; commission: number; entries: number };
  daily: DashboardDay[]; products: DashboardProduct[];
  placements: Array<{ placement: string; impressions: number; opens: number; adds: number; site: number }>;
  internal_events: number; campaigns_active: number;
}
export interface PanelCampaign {
  id: string; title: string; description: string | null; discount_pct: number; product_ids: string[]; starts_at: string; ends_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; review_note: string | null; live: boolean; created_at: string;
}
export interface PanelSale { id: string; sale_date: string; product_id: string | null; product_name: string | null; quantity: number; revenue: number;
  channel: 'partner_site' | 'app' | 'other'; note: string | null; created_at: string }
export interface PanelTeam {
  members: Array<{ user_id: string; email: string | null; role: Exclude<PartnerRole, 'admin'>; created_at: string; me: boolean }>;
  invites: Array<{ id: string; email: string; role: Exclude<PartnerRole, 'admin'>; expires_at: string; created_at: string }>;
}
export interface PanelAudit { id: string; action: string; target: string | null; payload: Record<string, unknown>; created_at: string; actor_email: string | null }

const ERRORS: Record<string, string> = {
  PARTNER_FORBIDDEN: 'Bu əməliyyat üçün icazəniz yoxdur.',
  PARTNER_NOT_FOUND: 'Mağaza tapılmadı.',
  PRODUCT_NAME: 'Məhsul adı 2-160 simvol olmalıdır.',
  PRODUCT_PRICE: 'Qiymət 0 ilə 100 000 ₼ arasında olmalıdır.',
  PRODUCT_OLD_PRICE: 'Köhnə qiymət cari qiymətdən az ola bilməz.',
  PRODUCT_STOCK: 'Stok 0 ilə 1 000 000 arasında tam ədəd olmalıdır.',
  PRODUCT_IMAGE: 'Şəkil linki https:// ilə başlamalıdır.',
  PRODUCT_URL: 'Məhsul linki https:// ilə başlamalıdır.',
  PRODUCT_DESCRIPTION: 'Təsvir 1000 simvoldan uzun ola bilməz.',
  PRODUCT_SKU: 'SKU 64 simvoldan uzun ola bilməz.',
  PRODUCT_INVALID_NUMBER: 'Qiymət və stok rəqəm olmalıdır.',
  PRODUCT_NOT_FOUND: 'Məhsul tapılmadı.',
  CAMPAIGN_TITLE: 'Kampaniya adı 2-120 simvol olmalıdır.',
  CAMPAIGN_DISCOUNT: 'Endirim 1% ilə 90% arasında olmalıdır.',
  CAMPAIGN_DATES: 'Tarixləri yoxlayın: bitmə başlanğıcdan sonra, 180 gün daxilində və gələcəkdə olmalıdır.',
  CAMPAIGN_NOT_FOUND: 'Kampaniya tapılmadı.',
  CAMPAIGN_INVALID: 'Kampaniya məlumatı səhvdir.',
  SALE_DATE: 'Satış tarixi bu gündən sonra ola bilməz.',
  SALE_QUANTITY: 'Say 1 ilə 100 000 arasında olmalıdır.',
  SALE_REVENUE: 'Məbləğ düzgün deyil.',
  SALE_INVALID: 'Satış məlumatı səhvdir.',
  SALE_NOT_FOUND: 'Satış tapılmadı.',
  INVITE_EMAIL: 'E-poçt ünvanı düzgün deyil.',
  INVITE_INVALID: 'Dəvət linki etibarsızdır və ya vaxtı keçib.',
  INVITE_USED: 'Bu dəvət artıq istifadə olunub.',
  INVITE_EMAIL_MISMATCH: 'Dəvət başqa e-poçt ünvanı üçündür. Həmin ünvanla daxil olun.',
  MEMBER_SELF: 'Öz rolunuzu dəyişə və ya özünüzü silə bilməzsiniz.',
  ADMIN_ONLY: 'Yalnız Anacan adminləri üçün.',
  AUTH_REQUIRED: 'Daxil olun.',
};

export class PanelError extends Error { constructor(message: string, public code?: string) { super(message); } }

export function panelErrorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: string })?.message || error || '');
  const code = Object.keys(ERRORS).find((k) => raw.includes(k));
  if (code) return ERRORS[code];
  if (/permission denied|42501/i.test(raw)) return ERRORS.PARTNER_FORBIDDEN;
  return 'Əməliyyat alınmadı. Bir az sonra yenidən yoxlayın.';
}

export async function prpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<{ data: T; error: { message?: string; code?: string } | null }>)(fn, args);
  if (error) throw new PanelError(panelErrorText(error), error.code);
  return data;
}

export const ROLE_LABEL: Record<PartnerRole, string> = { admin: 'Anacan admin', owner: 'Sahib', manager: 'Menecer', viewer: 'Baxış' };
export const STATUS_LABEL: Record<PartnerStatus, string> = { admin_only: 'Önizləmə (yalnız admin)', live: 'Canlı', paused: 'Dayandırılıb' };
export const CHANNEL_LABEL: Record<PanelSale['channel'], string> = { partner_site: 'Partnyor saytı', app: 'Tətbiq', other: 'Digər' };
export const CAMPAIGN_STATUS_LABEL: Record<PanelCampaign['status'], string> = { pending: 'Təsdiq gözləyir', approved: 'Təsdiqlənib', rejected: 'Rədd edilib', cancelled: 'Ləğv edilib' };
export const PLACEMENT_LABEL = (p: string) => ({
  shop: 'Mağaza', shop_for: 'Mağaza · Sənin üçün', shop_hero: 'Mağaza · əsas təklif', search: 'Axtarış', basket: 'Səbət',
  home_bump: 'Ana səhifə · hamiləlik', home_mommy: 'Ana səhifə · körpə', home_flow: 'Ana səhifə · dövr',
} as Record<string, string>)[p] || (p.startsWith('shop_') ? `Mağaza · ${p.slice(5)}` : p);

export const canWrite = (r?: PartnerRole) => r === 'admin' || r === 'owner' || r === 'manager';
export const canManageTeam = (r?: PartnerRole) => r === 'admin' || r === 'owner';

const AUDIT: Record<string, string> = {
  product_created: 'Məhsul əlavə olundu', product_updated: 'Məhsul dəyişdi', products_list: 'Məhsullar göstərildi', products_unlist: 'Məhsullar gizlədildi',
  products_stock: 'Stok yeniləndi', products_delete: 'Məhsullar silindi', products_cleared: 'Bütün məhsullar silindi (admin)', products_imported: 'Kataloq yükləndi (admin)',
  campaign_created: 'Kampaniya yaradıldı', campaign_updated: 'Kampaniya dəyişdi', campaign_cancelled: 'Kampaniya ləğv olundu',
  campaign_approved: 'Kampaniya təsdiqləndi', campaign_rejected: 'Kampaniya rədd edildi', sale_added: 'Satış əlavə olundu', sale_updated: 'Satış dəyişdi',
  sale_deleted: 'Satış silindi', invite_created: 'Dəvət göndərildi', invite_revoked: 'Dəvət ləğv olundu', member_joined: 'Komandaya qoşuldu',
  member_removed: 'Üzv silindi', member_role: 'Rol dəyişdi', partner_created: 'Mağaza yaradıldı', partner_updated: 'Mağaza ayarları dəyişdi',
};
export const auditLabel = (a: string) => AUDIT[a] || a;

/** Invite link the owner sends by hand (the token is shown only once). */
export const inviteLink = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://app.anacan.az'}/partner?invite=${encodeURIComponent(token)}`;

export const toLocalInput = (iso: string) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const bakuToday = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
export const daysAgo = (n: number) => new Date(Date.now() + 4 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);
