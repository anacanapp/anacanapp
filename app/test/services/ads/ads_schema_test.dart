// Ported from: src/lib/ads/policy.test.ts (the adsConfigurationSchema assertions of
// "allows explicit rewarded actions before passive-ad grace and rejects incomplete live configuration"; the policy
// part is in test/domain/ads/ads_test.dart), src/lib/ads/config.ts (parseAdsConfiguration v1 migration)
import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/services/ads/ads_schema.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AdMob delivery policy', () {
    test('allows explicit rewarded actions before passive-ad grace and rejects incomplete live configuration', () {
      final config = defaultAdsConfiguration();
      expect(isValidAdsConfiguration(config.toJson()), isTrue);
      config.settings.mode = 'live';
      expect(isValidAdsConfiguration(config.toJson()), isFalse);
      config.settings.enabled = false;
      expect(isValidAdsConfiguration(config.toJson()), isTrue);
    });
  });

  group('configuration schema', () {
    test('rejects unknown keys, out-of-range numbers and incomplete placement lists', () {
      final base = defaultAdsConfiguration().toJson();
      expect(isValidAdsConfiguration({...base, 'extra': true}), isFalse);
      final settings = Map<String, Object?>.from(base['settings']! as Map)..['fullscreen_cooldown_seconds'] = 60;
      expect(isValidAdsConfiguration({...base, 'settings': settings}), isFalse);
      expect(isValidAdsConfiguration({...base, 'placements': (base['placements']! as List).sublist(1)}), isFalse);
      final placements = [for (final p in base['placements']! as List) Map<String, Object?>.from(p as Map)];
      placements[0]['start_at'] = '2027-01-02T00:00:00Z';
      placements[0]['end_at'] = '2027-01-01T00:00:00Z';
      expect(isValidAdsConfiguration({...base, 'placements': placements}), isFalse);
    });

    test('upgrades an anacan-admob-v1 document; missing placements stay off for live', () {
      final v2 = defaultAdsConfiguration().toJson();
      final legacy = {
        ...v2,
        'schema': 'anacan-admob-v1',
        'placements': [
          {...(v2['placements']! as List).first as Map<String, Object?>, 'enabled': false},
        ],
      };
      final upgraded = parseAdsConfiguration(legacy)!;
      expect(upgraded.schema, 'anacan-admob-v2');
      expect(upgraded.placements.first.enabled, isFalse);
      expect(upgraded.placements[1].enabled, isTrue);
      expect(parseAdsConfiguration({'schema': 'anacan-admob-v2'}), isNull);
    });
  });
}
