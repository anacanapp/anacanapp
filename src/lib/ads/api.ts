import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { parseAdsConfiguration, type AdsConfiguration, type AdMode, type AdPlacementId } from './config';
import { SOURCE_ADMOB_ORIGIN, SOURCE_ADMOB_RPC, mirrorStatus, parseSourceAdmobSnapshot,
  type AdmobMirrorStatus, type SourceAdmobSnapshot } from './continuity';

interface RpcResult { data: unknown; error: { message?: string; code?: string } | null }
interface RpcRequest extends PromiseLike<RpcResult> { abortSignal?: (signal: AbortSignal) => RpcRequest }
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => RpcRequest)(name, args);
export interface AdMetric { day: string; placement_id: AdPlacementId; mode: AdMode; platform: string; event: string; reason: string; count: number }
export interface AdHistory { revision: number; changed_at: string; actor: string | null }
export interface AdmobOverview { configuration: AdsConfiguration; metrics: AdMetric[]; history: AdHistory[]; continuity?: AdmobMirrorStatus }
export interface AdmobMutationResult { configuration: AdsConfiguration; continuity: AdmobMirrorStatus }
export class AdmobConfigurationError extends Error {}
export const ADMOB_CONTROL_ORIGIN = 'https://api.anacan.az';
export const ADMOB_CONTROL_URL = `${ADMOB_CONTROL_ORIGIN}/admin/ads`;
async function publicControlRequest(path: string, init: RequestInit, timeout: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(ADMOB_CONTROL_ORIGIN + path, { ...init,
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new AdmobConfigurationError('admob_service_unavailable');
    return await response.json();
  } finally { clearTimeout(timer); }
}
function assertResult(result: RpcResult): unknown {
  if (result.error) throw new AdmobConfigurationError(/^admob_[a-z_]+$/.test(result.error.message ?? '')
    ? result.error.message : 'admob_service_unavailable');
  return result.data;
}
async function sourceControlRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    const request = rpc(name, args);
    const result = await Promise.race([request.abortSignal?.(controller.signal) ?? request,
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new AdmobConfigurationError('admob_source_unavailable'));
      }, 8000); })]);
    if (result.error?.code === 'PGRST202') throw new AdmobConfigurationError('admob_source_not_installed');
    if (result.error?.code === 'PT503') throw new AdmobConfigurationError('admob_source_frozen');
    return assertResult(result);
  } finally { clearTimeout(timer!); }
}
export async function fetchSourceAdmobSnapshot(expectedRevision?: number): Promise<SourceAdmobSnapshot> {
  if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1))
    throw new AdmobConfigurationError('admob_invalid_configuration');
  const backend = getBackendConfig();
  let value: unknown;
  if (!backend.azure) {
    if (backend.url !== SOURCE_ADMOB_ORIGIN) throw new AdmobConfigurationError('admob_source_unavailable');
    value = await sourceControlRpc(SOURCE_ADMOB_RPC, { p_expected_revision: expectedRevision ?? null });
  } else {
    // Public Source key only. The current Azure user's JWT/cookie is never sent
    // to Source; this request contains no user/profile/health information.
    const key = import.meta.env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY;
    if (!key) throw new AdmobConfigurationError('admob_source_unavailable');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${SOURCE_ADMOB_ORIGIN}/rest/v1/rpc/${SOURCE_ADMOB_RPC}`, { method: 'POST',
        credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_expected_revision: expectedRevision ?? null }) });
      if (!response.ok) throw new AdmobConfigurationError('admob_source_unavailable');
      value = await response.json();
    } catch (error) {
      if (error instanceof AdmobConfigurationError) throw error;
      throw new AdmobConfigurationError('admob_source_unavailable');
    } finally { clearTimeout(timer); }
  }
  const snapshot = parseSourceAdmobSnapshot(value);
  if (!snapshot) throw new AdmobConfigurationError('admob_invalid_configuration');
  return snapshot;
}
export async function synchronizeSourceAdmob(revision: number): Promise<SourceAdmobSnapshot> {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new AdmobConfigurationError('admob_invalid_configuration');
  for (const delay of [0, 500, 1000, 2000, 4000]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const snapshot = await fetchSourceAdmobSnapshot(revision);
    if (snapshot.upstreamRevision >= revision) return snapshot;
  }
  throw new AdmobConfigurationError('admob_source_sync_pending');
}
async function mirrorMutation(saved: AdsConfiguration): Promise<AdmobMutationResult> {
  let snapshot: SourceAdmobSnapshot | null = null;
  try { snapshot = await synchronizeSourceAdmob(saved.revision); } catch { /* Status remains unconfirmed. */ }
  // Azure already committed. Do not report an unsaved draft or repeat the mutation.
  return { configuration: saved, continuity: mirrorStatus(snapshot, saved) };
}
export async function setSourceAdmobEmergency(disabled: boolean): Promise<SourceAdmobSnapshot> {
  const backend = getBackendConfig();
  if (backend.azure || backend.url !== SOURCE_ADMOB_ORIGIN) throw new AdmobConfigurationError('admob_source_admin_required');
  const value = await sourceControlRpc('admin_set_source_admob_emergency_v1', { p_disabled: disabled });
  const result = parseSourceAdmobSnapshot(value);
  if (!result) throw new AdmobConfigurationError('admob_invalid_configuration');
  return result;
}
export async function fetchAdmobConfiguration(): Promise<AdsConfiguration | null> {
  let value: unknown;
  if (getBackendConfig().azure) value = assertResult(await rpc('get_admob_configuration'));
  else {
    // Source is independently reachable during Azure outages. It serves the
    // validated last-good snapshot and its independent emergency-stop overlay.
    value = (await fetchSourceAdmobSnapshot()).configuration;
  }
  const config = parseAdsConfiguration(value);
  if (!config) throw new AdmobConfigurationError('admob_invalid_configuration');
  return config;
}
export async function fetchAdmobOverview(): Promise<AdmobOverview> {
  if (!getBackendConfig().azure) throw new AdmobConfigurationError('admob_azure_required');
  const value = assertResult(await rpc('admin_get_admob_overview')) as Partial<AdmobOverview> | null;
  const config = parseAdsConfiguration(value?.configuration);
  if (!config || !Array.isArray(value?.metrics) || !Array.isArray(value?.history))
    throw new AdmobConfigurationError('admob_invalid_configuration');
  // Admin controls and demo eligibility must still load if Source is unavailable.
  // The admin hook observes mirror status in a separate, bounded query.
  return { configuration: config, metrics: value.metrics, history: value.history };
}
export async function saveAdmobConfiguration(config: AdsConfiguration): Promise<AdmobMutationResult> {
  if (!getBackendConfig().azure) throw new AdmobConfigurationError('admob_azure_required');
  const data = assertResult(await rpc('admin_save_admob_configuration', {
    p_expected_revision: config.revision, p_settings: config.settings, p_placements: config.placements,
  }));
  const saved = parseAdsConfiguration(data);
  if (!saved) throw new AdmobConfigurationError('admob_invalid_configuration');
  return mirrorMutation(saved);
}
export async function restoreAdmobConfiguration(revision: number, expectedRevision: number): Promise<AdmobMutationResult> {
  if (!getBackendConfig().azure) throw new AdmobConfigurationError('admob_azure_required');
  const data = assertResult(await rpc('admin_restore_admob_configuration', { p_revision: revision, p_expected_revision: expectedRevision }));
  const saved = parseAdsConfiguration(data);
  if (!saved) throw new AdmobConfigurationError('admob_invalid_configuration');
  return mirrorMutation(saved);
}
export async function disableAdmob(): Promise<AdmobMutationResult> {
  if (!getBackendConfig().azure) throw new AdmobConfigurationError('admob_azure_required');
  const saved = parseAdsConfiguration(assertResult(await rpc('admin_disable_admob')));
  if (!saved) throw new AdmobConfigurationError('admob_invalid_configuration');
  return mirrorMutation(saved);
}
export type AdEvent = 'requested' | 'loaded' | 'impression' | 'shown' | 'dismissed' | 'reward_earned' | 'failed' | 'skipped' | 'demo_clicked';
export async function reportAdEvent(placementId: AdPlacementId, event: AdEvent, mode: AdMode, platform: string, reason = '', revision?: number): Promise<void> {
  try {
    if (!getBackendConfig().azure) {
      if (mode === 'demo' || !['ios', 'android'].includes(platform) || !Number.isSafeInteger(revision) || revision! < 1) return;
      await publicControlRequest('/admob/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_revision: revision, p_placement_id: placementId, p_event: event, p_mode: mode, p_platform: platform, p_reason: reason }) }, 8000);
      return;
    }
    await rpc('record_admob_event', { p_placement_id: placementId, p_event: event, p_mode: mode, p_platform: platform, p_reason: reason });
  } catch { /* Telemetry never blocks navigation or changes entitlement. */ }
}
export const ADMOB_ERROR_LABELS: Record<string, string> = {
  admob_configuration_changed_reload: 'Ayarlar başqa pəncərədə yenilənib. Son versiyanı yükləyib dəyişiklikləri yenidən tətbiq edin.',
  admob_admin_required: 'Bu əməliyyat yalnız administrator üçündür.',
  admob_live_ids_required: 'Aktiv placement-lər üçün iOS/Android canlı App ID və Ad unit ID-lərini tamamlayın.',
  admob_live_publisher_required: 'Canlı rejim üçün öz AdMob Publisher ID-niz tələb olunur.',
  admob_azure_required: 'Reklam ayarları vahid idarəetmə mərkəzində — api.anacan.az ünvanında dəyişdirilir.',
  admob_service_unavailable: 'Reklam xidməti əlçatan deyil. Yenidən cəhd edin.',
  admob_source_unavailable: 'Source reklam ehtiyatı əlçatan deyil. Source quraşdırmasını və bağlantını yoxlayın.',
  admob_source_not_installed: 'Source reklam ehtiyatı hələ quraşdırılmayıb. Hazır SQL quraşdırma faylını icra edin.',
  admob_source_frozen: 'Source yazıları köçürmə üçün dondurulub. Hazırda bu ayar dəyişdirilə bilməz.',
  admob_source_sync_pending: 'Azure-da saxlanıb; Source reklam nüsxəsinin yenilənməsi hələ təsdiqlənməyib.',
  admob_source_admin_required: 'Bu emergency əməliyyatı Source administrator hesabı ilə edilir.',
  admob_invalid_configuration: 'Reklam konfiqurasiyası yoxlamadan keçmədi. Son ayarları yenidən yükləyin.',
};
