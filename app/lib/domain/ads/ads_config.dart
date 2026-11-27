// Ported from: src/lib/ads/config.ts (placement registry, test ids, id formats, default configuration),
// src/integrations/supabase/backend-admission.ts (compareNativeVersions)
//
// The zod schema validation (adsConfigurationSchema / parseAdsConfiguration) is admin-side and not ported; the
// app receives an already validated configuration from the server.

import 'data/ads_data.g.dart';

export 'data/ads_data.g.dart' show testAppIds, testUnitIds, testStoryVideoIds;

const List<String> adPlacementIds = [
  'home_banner', 'tools_banner', 'community_banner', 'blog_list_banner', 'blog_article_banner', 'recipes_banner',
  'baby_names_banner', 'article_exit_interstitial', 'recipe_exit_interstitial', 'ads_pause_rewarded',
  'community_story_break', 'games_break_interstitial', 'game_revive_rewarded',
];

/// 'banner' | 'interstitial' | 'rewarded' | 'native_story'
typedef AdFormat = String;

/// 'demo' | 'test' | 'live'
typedef AdMode = String;

/// 'ios' | 'android'
typedef AdPlatform = String;

Map<String, String> placementDefinition(String id) => adPlacementsData.firstWhere((p) => p['id'] == id);

const String googleTestPublisher = '3940256099942544';

bool isAppId(String value) => RegExp(r'^ca-app-pub-\d{16}~\d{10}$').hasMatch(value);
bool isAdUnitId(String value) => RegExp(r'^ca-app-pub-\d{16}/\d{10}$').hasMatch(value);
bool isTestId(String value) => value.contains(googleTestPublisher);

/// Version compare of "N(.N){0,3}" strings; null when either is malformed.
int? compareNativeVersions(Object? left, Object? right) {
  bool valid(Object? v) => v is String && RegExp(r'^\d{1,9}(?:\.\d{1,9}){0,3}$').hasMatch(v);
  if (!valid(left) || !valid(right)) return null;
  final a = (left as String).split('.').map(int.parse).toList(), b = (right as String).split('.').map(int.parse).toList();
  for (var i = 0; i < (a.length > b.length ? a.length : b.length); i++) {
    final x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0;
    if (x != y) return x < y ? -1 : 1;
  }
  return 0;
}

class AdsSettings {
  AdsSettings({
    required this.enabled,
    required this.mode,
    required this.iosAppId,
    required this.androidAppId,
    required this.publisherId,
    required this.minNativeVersion,
    required this.startupDelaySeconds,
    required this.fullscreenCooldownSeconds,
    required this.fullscreenSessionCap,
    required this.fullscreenDailyCap,
    required this.bannerChangeIntervalSeconds,
    required this.rewardPauseMinutes,
    required this.nonPersonalizedOnly,
  });
  bool enabled;
  AdMode mode;
  String iosAppId;
  String androidAppId;
  String publisherId;
  String minNativeVersion;
  int startupDelaySeconds;
  int fullscreenCooldownSeconds;
  int fullscreenSessionCap;
  int fullscreenDailyCap;
  int bannerChangeIntervalSeconds;
  int rewardPauseMinutes;
  bool nonPersonalizedOnly;

  String appIdFor(AdPlatform platform) => platform == 'ios' ? iosAppId : androidAppId;

  factory AdsSettings.fromJson(Map<String, Object?> j) => AdsSettings(
        enabled: j['enabled'] == true,
        mode: j['mode']! as String,
        iosAppId: (j['ios_app_id'] ?? '') as String,
        androidAppId: (j['android_app_id'] ?? '') as String,
        publisherId: (j['publisher_id'] ?? '') as String,
        minNativeVersion: j['min_native_version']! as String,
        startupDelaySeconds: (j['startup_delay_seconds']! as num).toInt(),
        fullscreenCooldownSeconds: (j['fullscreen_cooldown_seconds']! as num).toInt(),
        fullscreenSessionCap: (j['fullscreen_session_cap']! as num).toInt(),
        fullscreenDailyCap: (j['fullscreen_daily_cap']! as num).toInt(),
        bannerChangeIntervalSeconds: (j['banner_change_interval_seconds']! as num).toInt(),
        rewardPauseMinutes: (j['reward_pause_minutes']! as num).toInt(),
        nonPersonalizedOnly: j['non_personalized_only'] == true,
      );

  Map<String, Object?> toJson() => {
        'enabled': enabled,
        'mode': mode,
        'ios_app_id': iosAppId,
        'android_app_id': androidAppId,
        'publisher_id': publisherId,
        'min_native_version': minNativeVersion,
        'startup_delay_seconds': startupDelaySeconds,
        'fullscreen_cooldown_seconds': fullscreenCooldownSeconds,
        'fullscreen_session_cap': fullscreenSessionCap,
        'fullscreen_daily_cap': fullscreenDailyCap,
        'banner_change_interval_seconds': bannerChangeIntervalSeconds,
        'reward_pause_minutes': rewardPauseMinutes,
        'non_personalized_only': nonPersonalizedOnly,
      };
}

class AdPlacementConfig {
  AdPlacementConfig({
    required this.id,
    required this.enabled,
    required this.platforms,
    this.iosAdUnitId = '',
    this.androidAdUnitId = '',
    required this.cooldownSeconds,
    required this.sessionCap,
    required this.dailyCap,
    required this.minScreenSeconds,
    this.startAt,
    this.endAt,
    this.position = 'bottom',
    this.everyN = 0,
    this.storyFormat = 'native',
    required this.respectGlobalCooldown,
    this.reviveLives = 3,
    this.reviveMoves = 5,
    this.reviveSeconds = 15,
    this.maxRevives = 1,
  });
  String id;
  bool enabled;
  List<AdPlatform> platforms;
  String iosAdUnitId;
  String androidAdUnitId;
  int cooldownSeconds;
  int sessionCap;
  int dailyCap;
  int minScreenSeconds;
  String? startAt;
  String? endAt;
  String position;
  int everyN;
  String storyFormat;
  bool respectGlobalCooldown;
  int reviveLives;
  int reviveMoves;
  int reviveSeconds;
  int maxRevives;

  String adUnitIdFor(AdPlatform platform) => platform == 'ios' ? iosAdUnitId : androidAdUnitId;

  factory AdPlacementConfig.fromJson(Map<String, Object?> j) => AdPlacementConfig(
        id: j['id']! as String,
        enabled: j['enabled'] == true,
        platforms: (j['platforms']! as List).cast<String>(),
        iosAdUnitId: (j['ios_ad_unit_id'] ?? '') as String,
        androidAdUnitId: (j['android_ad_unit_id'] ?? '') as String,
        cooldownSeconds: (j['cooldown_seconds']! as num).toInt(),
        sessionCap: (j['session_cap']! as num).toInt(),
        dailyCap: (j['daily_cap']! as num).toInt(),
        minScreenSeconds: (j['min_screen_seconds']! as num).toInt(),
        startAt: j['start_at'] as String?,
        endAt: j['end_at'] as String?,
        position: (j['position'] ?? 'bottom') as String,
        everyN: ((j['every_n'] ?? 0) as num).toInt(),
        storyFormat: (j['story_format'] ?? 'native') as String,
        respectGlobalCooldown: j['respect_global_cooldown'] == true,
        reviveLives: ((j['revive_lives'] ?? 3) as num).toInt(),
        reviveMoves: ((j['revive_moves'] ?? 5) as num).toInt(),
        reviveSeconds: ((j['revive_seconds'] ?? 15) as num).toInt(),
        maxRevives: ((j['max_revives'] ?? 1) as num).toInt(),
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'enabled': enabled,
        'platforms': platforms,
        'ios_ad_unit_id': iosAdUnitId,
        'android_ad_unit_id': androidAdUnitId,
        'cooldown_seconds': cooldownSeconds,
        'session_cap': sessionCap,
        'daily_cap': dailyCap,
        'min_screen_seconds': minScreenSeconds,
        'start_at': startAt,
        'end_at': endAt,
        'position': position,
        'every_n': everyN,
        'story_format': storyFormat,
        'respect_global_cooldown': respectGlobalCooldown,
        'revive_lives': reviveLives,
        'revive_moves': reviveMoves,
        'revive_seconds': reviveSeconds,
        'max_revives': maxRevives,
      };
}

class AdsConfiguration {
  AdsConfiguration({required this.schema, required this.revision, required this.updatedAt, required this.settings, required this.placements});
  String schema;
  int revision;
  String updatedAt;
  AdsSettings settings;
  List<AdPlacementConfig> placements;

  factory AdsConfiguration.fromJson(Map<String, Object?> j) => AdsConfiguration(
        schema: j['schema']! as String,
        revision: (j['revision']! as num).toInt(),
        updatedAt: (j['updated_at'] ?? '') as String,
        settings: AdsSettings.fromJson((j['settings']! as Map).cast<String, Object?>()),
        placements: [for (final p in j['placements']! as List) AdPlacementConfig.fromJson((p as Map).cast<String, Object?>())],
      );

  Map<String, Object?> toJson() => {
        'schema': schema,
        'revision': revision,
        'updated_at': updatedAt,
        'settings': settings.toJson(),
        'placements': [for (final p in placements) p.toJson()],
      };
}

AdsConfiguration defaultAdsConfiguration() => AdsConfiguration(
      schema: 'anacan-admob-v2',
      revision: 1,
      updatedAt: '1970-01-01T00:00:00.000Z',
      settings: AdsSettings(
        enabled: true,
        mode: 'demo',
        iosAppId: '',
        androidAppId: '',
        publisherId: '',
        minNativeVersion: '31.0',
        startupDelaySeconds: 60,
        fullscreenCooldownSeconds: 600,
        fullscreenSessionCap: 3,
        fullscreenDailyCap: 8,
        bannerChangeIntervalSeconds: 60,
        rewardPauseMinutes: 30,
        nonPersonalizedOnly: true,
      ),
      placements: [
        for (final item in adPlacementsData)
          () {
            final id = item['id']!, format = item['format']!;
            final p = AdPlacementConfig(
              id: id,
              enabled: true,
              platforms: ['ios', 'android'],
              cooldownSeconds: format == 'banner' ? 90 : format == 'rewarded' ? 1800 : 1200,
              sessionCap: format == 'banner' ? 10 : 2,
              dailyCap: format == 'banner' ? 40 : 4,
              minScreenSeconds: format == 'banner' ? 5 : format == 'rewarded' ? 0 : 30,
              everyN: id == 'community_story_break' ? 5 : id == 'games_break_interstitial' ? 2 : 0,
              respectGlobalCooldown: !const ['community_story_break', 'games_break_interstitial', 'game_revive_rewarded'].contains(id),
            );
            if (id == 'community_story_break') {
              p
                ..cooldownSeconds = 15
                ..minScreenSeconds = 2
                ..sessionCap = 20
                ..dailyCap = 40;
            }
            if (id == 'games_break_interstitial') {
              p
                ..cooldownSeconds = 15
                ..minScreenSeconds = 0
                ..sessionCap = 20
                ..dailyCap = 40;
            }
            if (id == 'game_revive_rewarded') {
              p
                ..cooldownSeconds = 0
                ..minScreenSeconds = 0
                ..sessionCap = 10
                ..dailyCap = 20;
            }
            return p;
          }(),
      ],
    );

/// app-ads.txt content.
String appAdsTxt(AdsConfiguration config) =>
    RegExp(r'^pub-\d{16}$').hasMatch(config.settings.publisherId) && !isTestId(config.settings.publisherId)
        ? 'google.com, ${config.settings.publisherId}, DIRECT, f08c47fec0942fa0\n'
        : '# Anacan: AdMob publisher is not configured.\n';
