// Ported from: src/lib/ads/config.ts (adsSettingsSchema, placementConfigSchema, adsConfigurationSchema,
//              parseAdsConfiguration incl. the anacan-admob-v1 migration)
//
// The zod validation the app applies to every configuration it receives (fail closed: an invalid document is no
// configuration, so no ad is shown). Objects are strict (unknown keys reject), numbers must be integers in range.
// The typed model, defaults and ids are in domain/ads/ads_config.dart.
import '../../domain/ads/ads_config.dart';

const int kMaxSafeInteger = 9007199254740991;

bool _isInt(Object? v, int min, int max) {
  if (v is int) return v >= min && v <= max;
  if (v is double) return v.isFinite && v == v.truncateToDouble() && v >= min && v <= max;
  return false;
}

bool _strictKeys(Map<Object?, Object?> map, Set<String> keys) => map.keys.every((k) => keys.contains(k)) && keys.every(map.containsKey);

final RegExp _appId = RegExp(r'^ca-app-pub-\d{16}~\d{10}$');
final RegExp _unitId = RegExp(r'^ca-app-pub-\d{16}/\d{10}$');

bool _optionalAppId(Object? v) => v is String && v.length <= 80 && (v.isEmpty || _appId.hasMatch(v));
bool _optionalUnitId(Object? v) => v is String && v.length <= 80 && (v.isEmpty || _unitId.hasMatch(v));

/// zod `z.string().datetime({ offset: true })`.
bool isZodDateTime(Object? v) =>
    v is String && RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(([+-]\d{2}(:?\d{2})?)|Z)$').hasMatch(v) && DateTime.tryParse(v) != null;

const Set<String> _settingsKeys = {
  'enabled', 'mode', 'ios_app_id', 'android_app_id', 'publisher_id', 'min_native_version', 'startup_delay_seconds',
  'fullscreen_cooldown_seconds', 'fullscreen_session_cap', 'fullscreen_daily_cap', 'banner_change_interval_seconds',
  'reward_pause_minutes', 'non_personalized_only',
};

const Set<String> _placementKeys = {
  'id', 'enabled', 'platforms', 'ios_ad_unit_id', 'android_ad_unit_id', 'cooldown_seconds', 'session_cap', 'daily_cap',
  'min_screen_seconds', 'start_at', 'end_at', 'position', 'every_n', 'story_format', 'respect_global_cooldown',
  'revive_lives', 'revive_moves', 'revive_seconds', 'max_revives',
};

bool _validSettings(Object? value) {
  if (value is! Map || !_strictKeys(value, _settingsKeys)) return false;
  return value['enabled'] is bool &&
      const ['demo', 'test', 'live'].contains(value['mode']) &&
      _optionalAppId(value['ios_app_id']) &&
      _optionalAppId(value['android_app_id']) &&
      value['publisher_id'] is String &&
      RegExp(r'^(?:pub-\d{16})?$').hasMatch(value['publisher_id'] as String) &&
      value['min_native_version'] is String &&
      RegExp(r'^\d{1,4}(?:\.\d{1,4}){0,3}$').hasMatch(value['min_native_version'] as String) &&
      _isInt(value['startup_delay_seconds'], 0, 3600) &&
      _isInt(value['fullscreen_cooldown_seconds'], 120, 86400) &&
      _isInt(value['fullscreen_session_cap'], 1, 20) &&
      _isInt(value['fullscreen_daily_cap'], 1, 50) &&
      _isInt(value['banner_change_interval_seconds'], 30, 3600) &&
      _isInt(value['reward_pause_minutes'], 5, 120) &&
      value['non_personalized_only'] is bool;
}

bool _validPlacement(Object? value) {
  if (value is! Map || !_strictKeys(value, _placementKeys)) return false;
  final platforms = value['platforms'];
  if (platforms is! List || platforms.isEmpty || platforms.length > 2 || platforms.toSet().length != platforms.length) return false;
  if (!platforms.every((p) => p == 'ios' || p == 'android')) return false;
  final start = value['start_at'], end = value['end_at'];
  if (!(start == null || isZodDateTime(start)) || !(end == null || isZodDateTime(end))) return false;
  final ok = adPlacementIds.contains(value['id']) &&
      value['enabled'] is bool &&
      _optionalUnitId(value['ios_ad_unit_id']) &&
      _optionalUnitId(value['android_ad_unit_id']) &&
      _isInt(value['cooldown_seconds'], 0, 86400) &&
      _isInt(value['session_cap'], 1, 100) &&
      _isInt(value['daily_cap'], 1, 500) &&
      _isInt(value['min_screen_seconds'], 0, 3600) &&
      const ['top', 'middle', 'bottom'].contains(value['position']) &&
      _isInt(value['every_n'], 0, 50) &&
      const ['native', 'video'].contains(value['story_format']) &&
      value['respect_global_cooldown'] is bool &&
      _isInt(value['revive_lives'], 1, 5) &&
      _isInt(value['revive_moves'], 1, 20) &&
      _isInt(value['revive_seconds'], 5, 60) &&
      _isInt(value['max_revives'], 1, 3);
  if (!ok) return false;
  // refine: start before end.
  if (start is String && end is String && !DateTime.parse(start).isBefore(DateTime.parse(end))) return false;
  return true;
}

/// `adsConfigurationSchema.safeParse(value).success`.
bool isValidAdsConfiguration(Object? value) {
  if (value is! Map || !_strictKeys(value, const {'schema', 'revision', 'updated_at', 'settings', 'placements'})) return false;
  if (value['schema'] != 'anacan-admob-v2' || !_isInt(value['revision'], 1, kMaxSafeInteger) || value['updated_at'] is! String) return false;
  final settings = value['settings'];
  if (!_validSettings(settings)) return false;
  final placements = value['placements'];
  if (placements is! List || placements.length != adPlacementIds.length || !placements.every(_validPlacement)) return false;
  // superRefine
  if (placements.map((p) => (p as Map)['id']).toSet().length != adPlacementIds.length) return false;
  for (final item in placements.cast<Map<Object?, Object?>>()) {
    if (const ['community_story_break', 'games_break_interstitial'].contains(item['id']) && (item['every_n'] as num) < 1) return false;
  }
  final s = settings as Map;
  if (s['enabled'] != true || s['mode'] != 'live') return true;
  final publisher = (s['publisher_id'] as String).replaceFirst(RegExp('^pub-'), '');
  if (publisher.isEmpty || publisher == googleTestPublisher) return false;
  for (final platform in const ['ios', 'android']) {
    final active = placements.cast<Map<Object?, Object?>>().where((p) => p['enabled'] == true && (p['platforms'] as List).contains(platform)).toList();
    if (active.isEmpty) continue;
    final appId = s['${platform}_app_id'] as String;
    if (!isAppId(appId) || isTestId(appId) || !appId.startsWith('ca-app-pub-$publisher~')) return false;
    for (final item in active) {
      final unit = item['${platform}_ad_unit_id'] as String;
      if (!isAdUnitId(unit) || isTestId(unit) || !unit.startsWith('ca-app-pub-$publisher/')) return false;
    }
  }
  return true;
}

Map<String, Object?> _asJsonMap(Map<Object?, Object?> map) => {for (final e in map.entries) '${e.key}': e.value};

/// `parseAdsConfiguration(value)`: validated configuration or null; an `anacan-admob-v1` document is upgraded to
/// v2 first (missing placements: enabled unless the old document was live).
AdsConfiguration? parseAdsConfiguration(Object? value) {
  if (value is Map && value['schema'] == 'anacan-admob-v1' && value['placements'] is List) {
    final legacy = value;
    final defaults = defaultAdsConfiguration();
    final oldPlacements = legacy['placements'] as List;
    final legacyMode = legacy['settings'] is Map ? (legacy['settings'] as Map)['mode'] : null;
    value = <String, Object?>{
      ..._asJsonMap(legacy),
      'schema': 'anacan-admob-v2',
      'placements': [
        for (final item in defaults.placements)
          () {
            final old = oldPlacements.where((c) => c is Map && c['id'] == item.id).firstOrNull;
            return old is Map ? {...item.toJson(), ..._asJsonMap(old)} : {...item.toJson(), 'enabled': legacyMode != 'live'};
          }(),
      ],
    };
  }
  if (!isValidAdsConfiguration(value)) return null;
  return AdsConfiguration.fromJson(_asJsonMap(value as Map));
}
