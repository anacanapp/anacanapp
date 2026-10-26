import { z } from 'zod';
import placements from './placements.json';

export const AD_PLACEMENT_IDS = ['home_banner', 'tools_banner', 'community_banner', 'blog_list_banner',
  'blog_article_banner', 'recipes_banner', 'baby_names_banner', 'article_exit_interstitial',
  'recipe_exit_interstitial', 'ads_pause_rewarded', 'community_story_break', 'games_break_interstitial', 'game_revive_rewarded'] as const;
export type AdPlacementId = typeof AD_PLACEMENT_IDS[number];
export type AdFormat = 'banner' | 'interstitial' | 'rewarded' | 'native_story';
export type AdPosition = 'top' | 'middle' | 'bottom';
export type AdPlatform = 'ios' | 'android';
export type AdMode = 'demo' | 'test' | 'live';
export interface PlacementDefinition {
  id: AdPlacementId; title: string; format: AdFormat; surface: string; description: string; trigger: string;
}
export const AD_PLACEMENTS = placements as PlacementDefinition[];
export const placementDefinition = (id: AdPlacementId) => AD_PLACEMENTS.find(item => item.id === id)!;
export const GOOGLE_TEST_PUBLISHER = '3940256099942544';
export const TEST_APP_IDS = { ios: `ca-app-pub-${GOOGLE_TEST_PUBLISHER}~1458002511`, android: `ca-app-pub-${GOOGLE_TEST_PUBLISHER}~3347511713` } as const;
export const TEST_UNIT_IDS: Record<AdPlatform, Record<AdFormat, string>> = {
  ios: { banner: 'ca-app-pub-3940256099942544/2934735716', interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313', native_story: 'ca-app-pub-3940256099942544/3986624511' },
  android: { banner: 'ca-app-pub-3940256099942544/6300978111', interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917', native_story: 'ca-app-pub-3940256099942544/2247696110' },
};
export const TEST_STORY_VIDEO_IDS = { ios: 'ca-app-pub-3940256099942544/2521693316', android: 'ca-app-pub-3940256099942544/1044960115' } as const;
export const isAppId = (value: string) => /^ca-app-pub-\d{16}~\d{10}$/.test(value);
export const isAdUnitId = (value: string) => /^ca-app-pub-\d{16}\/\d{10}$/.test(value);
export const isTestId = (value: string) => value.includes(GOOGLE_TEST_PUBLISHER);
const optionalAppId = z.string().max(80).refine(value => !value || isAppId(value), 'App ID: ca-app-pub-…~…');
const optionalUnitId = z.string().max(80).refine(value => !value || isAdUnitId(value), 'Ad unit ID: ca-app-pub-…/…');
const bounded = (min: number, max: number) => z.number().int().min(min).max(max);
const nullableDate = z.string().datetime({ offset: true }).nullable();
export const adsSettingsSchema = z.object({
  enabled: z.boolean(), mode: z.enum(['demo', 'test', 'live']),
  ios_app_id: optionalAppId, android_app_id: optionalAppId,
  publisher_id: z.string().regex(/^(?:pub-\d{16})?$/, 'Publisher ID: pub-…'),
  min_native_version: z.string().regex(/^\d{1,4}(?:\.\d{1,4}){0,3}$/),
  startup_delay_seconds: bounded(0, 3600),
  fullscreen_cooldown_seconds: bounded(120, 86400),
  fullscreen_session_cap: bounded(1, 20), fullscreen_daily_cap: bounded(1, 50),
  banner_change_interval_seconds: bounded(30, 3600),
  reward_pause_minutes: bounded(5, 120),
  non_personalized_only: z.boolean(),
}).strict();
export const placementConfigSchema = z.object({
  id: z.enum(AD_PLACEMENT_IDS), enabled: z.boolean(),
  platforms: z.array(z.enum(['ios', 'android'])).min(1).max(2).refine(items => new Set(items).size === items.length),
  ios_ad_unit_id: optionalUnitId, android_ad_unit_id: optionalUnitId,
  cooldown_seconds: bounded(0, 86400), session_cap: bounded(1, 100), daily_cap: bounded(1, 500),
  min_screen_seconds: bounded(0, 3600), start_at: nullableDate, end_at: nullableDate,
  position: z.enum(['top', 'middle', 'bottom']), every_n: bounded(0, 50),
  story_format: z.enum(['native', 'video']), respect_global_cooldown: z.boolean(),
  revive_lives: bounded(1, 5), revive_moves: bounded(1, 20), revive_seconds: bounded(5, 60), max_revives: bounded(1, 3),
}).strict().refine(item => !item.start_at || !item.end_at || Date.parse(item.start_at) < Date.parse(item.end_at),
  { message: 'Başlanğıc vaxtı bitmə vaxtından əvvəl olmalıdır.', path: ['end_at'] });
export const adsConfigurationSchema = z.object({
  schema: z.literal('anacan-admob-v2'), revision: z.number().int().positive(), updated_at: z.string(),
  settings: adsSettingsSchema, placements: z.array(placementConfigSchema).length(AD_PLACEMENT_IDS.length),
}).strict().superRefine((config, context) => {
  if (new Set(config.placements.map(item => item.id)).size !== AD_PLACEMENT_IDS.length)
    context.addIssue({ code: 'custom', message: 'Placement siyahısı tam və təkrarsız olmalıdır.', path: ['placements'] });
  for (const item of config.placements) if (['community_story_break', 'games_break_interstitial'].includes(item.id) && item.every_n < 1)
    context.addIssue({ code: 'custom', message: 'Story/oyun sayı ən azı 1 olmalıdır.', path: ['placements', item.id, 'every_n'] });
  if (!config.settings.enabled || config.settings.mode !== 'live') return;
  const publisher = config.settings.publisher_id.replace(/^pub-/, '');
  if (!publisher || publisher === GOOGLE_TEST_PUBLISHER)
    context.addIssue({ code: 'custom', message: 'Canlı rejim üçün öz Publisher ID-nizi daxil edin.', path: ['settings', 'publisher_id'] });
  for (const platform of ['ios', 'android'] as const) {
    const active = config.placements.filter(item => item.enabled && item.platforms.includes(platform));
    if (!active.length) continue;
    const appId = config.settings[`${platform}_app_id`];
    if (!isAppId(appId) || isTestId(appId) || !appId.startsWith(`ca-app-pub-${publisher}~`))
      context.addIssue({ code: 'custom', message: `${platform}: canlı App ID və Publisher ID uyğun olmalıdır.`, path: ['settings', `${platform}_app_id`] });
    for (const item of active) {
      const unit = item[`${platform}_ad_unit_id`];
      if (!isAdUnitId(unit) || isTestId(unit) || !unit.startsWith(`ca-app-pub-${publisher}/`))
        context.addIssue({ code: 'custom', message: `${item.id} · ${platform}: canlı reklam ID-si tələb olunur.`, path: ['placements', config.placements.indexOf(item), `${platform}_ad_unit_id`] });
    }
  }
});
export type AdsSettings = z.infer<typeof adsSettingsSchema>;
export type AdPlacementConfig = z.infer<typeof placementConfigSchema>;
export type AdsConfiguration = z.infer<typeof adsConfigurationSchema>;
export function defaultAdsConfiguration(): AdsConfiguration {
  return { schema: 'anacan-admob-v2', revision: 1, updated_at: new Date(0).toISOString(), settings: {
    enabled: true, mode: 'demo', ios_app_id: '', android_app_id: '', publisher_id: '', min_native_version: '31.0',
    startup_delay_seconds: 60, fullscreen_cooldown_seconds: 600, fullscreen_session_cap: 3, fullscreen_daily_cap: 8,
    banner_change_interval_seconds: 60, reward_pause_minutes: 30, non_personalized_only: true,
  }, placements: AD_PLACEMENTS.map(item => ({ id: item.id, enabled: true, platforms: ['ios', 'android'],
    ios_ad_unit_id: '', android_ad_unit_id: '', cooldown_seconds: item.format === 'banner' ? 90 : item.format === 'rewarded' ? 1800 : 1200,
    session_cap: item.format === 'banner' ? 10 : 2, daily_cap: item.format === 'banner' ? 40 : 4,
    min_screen_seconds: item.format === 'banner' ? 5 : item.format === 'rewarded' ? 0 : 30,
    start_at: null, end_at: null,
    position: 'bottom', every_n: item.id === 'community_story_break' ? 5 : item.id === 'games_break_interstitial' ? 2 : 0,
    story_format: 'native', respect_global_cooldown: !['community_story_break','games_break_interstitial','game_revive_rewarded'].includes(item.id),
    revive_lives: 3, revive_moves: 5, revive_seconds: 15, max_revives: 1,
    ...(item.id === 'community_story_break' ? { cooldown_seconds: 15, min_screen_seconds: 2, session_cap: 20, daily_cap: 40 } : {}),
    ...(item.id === 'games_break_interstitial' ? { cooldown_seconds: 15, min_screen_seconds: 0, session_cap: 20, daily_cap: 40 } : {}),
    ...(item.id === 'game_revive_rewarded' ? { cooldown_seconds: 0, min_screen_seconds: 0, session_cap: 10, daily_cap: 20 } : {}),
  })) };
}
export function parseAdsConfiguration(value: unknown): AdsConfiguration | null {
  const legacy = value as { schema?: string; placements?: unknown[]; settings?: { mode?: string } };
  if (legacy?.schema === 'anacan-admob-v1' && Array.isArray(legacy.placements)) {
    const defaults = defaultAdsConfiguration();
    value = { ...legacy, schema: 'anacan-admob-v2', placements: defaults.placements.map(item => {
      const old = legacy.placements!.find(candidate => (candidate as { id?: string })?.id === item.id);
      return old ? { ...item, ...(old as object) } : { ...item, enabled: legacy.settings?.mode !== 'live' };
    }) };
  }
  const result = adsConfigurationSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function appAdsTxt(config: AdsConfiguration): string {
  return /^pub-\d{16}$/.test(config.settings.publisher_id) && !isTestId(config.settings.publisher_id)
    ? `google.com, ${config.settings.publisher_id}, DIRECT, f08c47fec0942fa0\n` : '# Anacan: AdMob publisher is not configured.\n';
}
