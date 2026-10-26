import { compareNativeVersions } from '@/integrations/supabase/backend-admission';
import { isAppId, isAdUnitId, isTestId, placementDefinition, TEST_APP_IDS, TEST_UNIT_IDS, TEST_STORY_VIDEO_IDS,
  type AdsConfiguration, type AdMode, type AdPlacementId, type AdPlatform } from './config';

export type AdBlockReason = 'ready' | 'configuration' | 'disabled' | 'placement_disabled' | 'platform'
  | 'premium' | 'entitlement_loading' | 'signed_out' | 'background' | 'offline' | 'blocked_screen'
  | 'paused' | 'schedule' | 'startup_delay' | 'screen_time' | 'placement_cooldown' | 'global_cooldown'
  | 'session_cap' | 'daily_cap' | 'unsupported' | 'update_required' | 'app_id_mismatch' | 'unit_id'
  | 'consent' | 'demo_only' | 'busy' | 'not_ready';
export const AD_REASON_LABELS: Record<AdBlockReason, string> = {
  ready: 'Göstərilməyə hazırdır', configuration: 'Konfiqurasiya alınmayıb və ya köhnəlib', disabled: 'Ümumi reklam açarı bağlıdır',
  placement_disabled: 'Bu placement deaktivdir', platform: 'Bu platforma üçün bağlıdır', premium: 'Premium / ailə Premium-u reklamsızdır',
  entitlement_loading: 'Abunəlik vəziyyəti dəqiqləşdirilir', signed_out: 'İstifadəçi hesabına daxil olmayıb', background: 'Tətbiq arxa plandadır',
  offline: 'Şəbəkə yoxdur', blocked_screen: 'Modal, klaviatura və ya qorunan ekran açıqdır', paused: 'Reklamsız fasilə aktivdir',
  schedule: 'Placement-in vaxt cədvəli uyğun deyil', startup_delay: 'Sessiyanın başlanğıc fasiləsi gözlənilir',
  screen_time: 'Ekranda minimum vaxt tamamlanmayıb', placement_cooldown: 'Bu placement-in fasiləsi bitməyib',
  global_cooldown: 'Tam ekran reklamları arasındakı ümumi fasilə bitməyib', session_cap: 'Sessiya limiti dolub', daily_cap: 'Günlük limit dolub',
  unsupported: 'Bu build-də native AdMob SDK-sı yoxdur', update_required: 'Yeni native build tələb olunur',
  app_id_mismatch: 'Build-dəki App ID ilə idarəetmədəki App ID fərqlidir', unit_id: 'Uyğun reklam ID-si yoxdur',
  consent: 'Reklam sorğusu üçün UMP icazəsi yoxdur', demo_only: 'Vebdə yalnız admin demo önizləməsi işləyir', busy: 'Başqa reklam açıqdır', not_ready: 'Reklam əvvəlcədən yüklənməyib',
};
export interface AdCounts { session: number; day: number; last: number }
export interface AdLedger {
  date: string; session_id: string; placements: Partial<Record<AdPlacementId, AdCounts>>;
  fullscreen: AdCounts; last_banner: number; pause_until: number;
}
export interface AdEvaluationContext {
  now: number; sessionStartedAt: number; screenStartedAt: number; platform: AdPlatform;
  signedIn: boolean; entitlementReady: boolean; premium: boolean; foreground: boolean; online: boolean;
  blocked: boolean; native: boolean; sdkAvailable: boolean; nativeVersion: string; compiledAppId: string;
  consent: boolean; demo: boolean; busy?: boolean; fastPreview?: boolean; alreadyShowingBanner?: boolean;
}
export interface AdDecision { allowed: boolean; reason: AdBlockReason; waitSeconds: number; mode: AdMode; adUnitId: string | null }
export function emptyAdLedger(now = Date.now(), sessionId = ''): AdLedger {
  return { date: new Date(now).toISOString().slice(0, 10), session_id: sessionId, placements: {},
    fullscreen: { session: 0, day: 0, last: 0 }, last_banner: 0, pause_until: 0 };
}
export function normalizeAdLedger(input: AdLedger, now: number, sessionId: string): AdLedger {
  const next = structuredClone(input), day = new Date(now).toISOString().slice(0, 10);
  if (next.date !== day) { next.date = day; next.fullscreen.day = 0; Object.values(next.placements).forEach(count => { if (count) count.day = 0; }); }
  if (next.session_id !== sessionId) { next.session_id = sessionId; next.fullscreen.session = 0; Object.values(next.placements).forEach(count => { if (count) count.session = 0; }); }
  return next;
}
export function evaluateAd(config: AdsConfiguration | null, id: AdPlacementId, context: AdEvaluationContext, ledger: AdLedger): AdDecision {
  const mode = context.demo ? 'demo' : config?.settings.mode ?? 'demo';
  const deny = (reason: AdBlockReason, until = 0): AdDecision => ({ allowed: false, reason, waitSeconds: Math.max(0, Math.ceil((until - context.now) / 1000)), mode, adUnitId: null });
  if (!config) return deny('configuration');
  const settings = config.settings, placement = config.placements.find(item => item.id === id), format = placementDefinition(id).format;
  if (!context.signedIn) return deny('signed_out');
  if (!context.entitlementReady) return deny('entitlement_loading');
  if (context.premium) return deny('premium');
  if (!settings.enabled) return deny('disabled');
  if (!placement?.enabled) return deny('placement_disabled');
  if (!placement.platforms.includes(context.platform)) return deny('platform');
  if (!context.foreground) return deny('background');
  if (!context.online) return deny('offline');
  if (context.blocked) return deny('blocked_screen');
  if (context.busy) return deny('busy');
  if (ledger.pause_until > context.now) return deny('paused', ledger.pause_until);
  if ((placement.start_at && context.now < Date.parse(placement.start_at)) || (placement.end_at && context.now >= Date.parse(placement.end_at))) return deny('schedule');
  if (mode === 'demo' && !context.demo) return deny('demo_only');
  if (mode !== 'demo') {
    if (!context.native || !context.sdkAvailable) return deny('unsupported');
    const version = compareNativeVersions(context.nativeVersion, settings.min_native_version);
    if (version === null || version < 0) return deny('update_required');
    const appId = settings[`${context.platform}_app_id`];
    const matchesBuild = mode === 'test'
      ? isAppId(context.compiledAppId) && (context.compiledAppId === TEST_APP_IDS[context.platform] || context.compiledAppId === appId)
      : isAppId(appId) && appId === context.compiledAppId;
    if (!matchesBuild) return deny('app_id_mismatch');
    if (!context.consent) return deny('consent');
  }
  const unit = mode === 'test' ? format === 'native_story' && placement.story_format === 'video'
    ? TEST_STORY_VIDEO_IDS[context.platform] : TEST_UNIT_IDS[context.platform][format] : placement[`${context.platform}_ad_unit_id`];
  if (mode === 'live' && (!isAdUnitId(unit) || isTestId(unit))) return deny('unit_id');
  if (format === 'banner' && context.alreadyShowingBanner)
    return { allowed: true, reason: 'ready', waitSeconds: 0, mode, adUnitId: mode === 'demo' ? null : unit };
  if (!context.fastPreview && format !== 'rewarded' && context.now < context.sessionStartedAt + settings.startup_delay_seconds * 1000)
    return deny('startup_delay', context.sessionStartedAt + settings.startup_delay_seconds * 1000);
  if (!context.fastPreview && context.now < context.screenStartedAt + placement.min_screen_seconds * 1000)
    return deny('screen_time', context.screenStartedAt + placement.min_screen_seconds * 1000);
  const count = ledger.placements[id] ?? { session: 0, day: 0, last: 0 };
  if (count.session >= placement.session_cap) return deny('session_cap');
  if (count.day >= placement.daily_cap) return deny('daily_cap');
  if (count.last && context.now < count.last + placement.cooldown_seconds * 1000) return deny('placement_cooldown', count.last + placement.cooldown_seconds * 1000);
  if (format !== 'banner') {
    if (ledger.fullscreen.session >= settings.fullscreen_session_cap) return deny('session_cap');
    if (ledger.fullscreen.day >= settings.fullscreen_daily_cap) return deny('daily_cap');
    if (placement.respect_global_cooldown && ledger.fullscreen.last && context.now < ledger.fullscreen.last + settings.fullscreen_cooldown_seconds * 1000)
      return deny('global_cooldown', ledger.fullscreen.last + settings.fullscreen_cooldown_seconds * 1000);
  } else if (ledger.last_banner && context.now < ledger.last_banner + settings.banner_change_interval_seconds * 1000)
    return deny('global_cooldown', ledger.last_banner + settings.banner_change_interval_seconds * 1000);
  return { allowed: true, reason: 'ready', waitSeconds: 0, mode, adUnitId: mode === 'demo' ? null : unit };
}
export function recordAdShown(ledger: AdLedger, id: AdPlacementId, now: number): AdLedger {
  const next = structuredClone(ledger), count = next.placements[id] ?? { session: 0, day: 0, last: 0 };
  next.placements[id] = { session: count.session + 1, day: count.day + 1, last: now };
  if (placementDefinition(id).format !== 'banner') next.fullscreen = { session: next.fullscreen.session + 1, day: next.fullscreen.day + 1, last: now };
  else next.last_banner = now;
  return next;
}
