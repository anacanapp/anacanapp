// Ported from: src/lib/ads/continuity.ts
//
// The Source-hosted AdMob mirror: the validated last-good configuration plus an independent emergency stop,
// reachable during Azure outages.
import 'package:flutter/foundation.dart';

import '../../domain/ads/ads_config.dart';
import 'ads_schema.dart';

const String kSourceAdmobOrigin = 'https://tntbjulojatnrqmylorp.supabase.co';
const String kSourceAdmobRpc = 'get_source_admob_configuration_v1';
const String kSourceAdmobProtocol = 'source-mirror-v1';

@immutable
class SourceAdmobSnapshot {
  const SourceAdmobSnapshot({
    required this.sourceGeneration,
    required this.upstreamRevision,
    required this.emergencyDisabled,
    required this.syncedAt,
    required this.configuration,
  });
  final int sourceGeneration;
  final int upstreamRevision;
  final bool emergencyDisabled;
  final String syncedAt;
  final AdsConfiguration configuration;

  Map<String, Object?> toJson() => {
        'schema': 'anacan-admob-source-v1',
        'sourceGeneration': sourceGeneration,
        'upstreamRevision': upstreamRevision,
        'emergencyDisabled': emergencyDisabled,
        'syncedAt': syncedAt,
        'configuration': configuration.toJson(),
      };
}

@immutable
class AdmobMirrorStatus {
  const AdmobMirrorStatus({required this.available, required this.ready, this.upstreamRevision, this.sourceGeneration, this.emergencyDisabled, this.syncedAt});
  final bool available;
  final bool ready;
  final int? upstreamRevision;
  final int? sourceGeneration;
  final bool? emergencyDisabled;
  final String? syncedAt;

  Map<String, Object?> toJson() => {
        'available': available,
        'ready': ready,
        if (upstreamRevision != null) 'upstreamRevision': upstreamRevision,
        if (sourceGeneration != null) 'sourceGeneration': sourceGeneration,
        if (emergencyDisabled != null) 'emergencyDisabled': emergencyDisabled,
        if (syncedAt != null) 'syncedAt': syncedAt,
      };
}

int? _safePositive(Object? v) {
  if (v is int && v >= 1 && v <= kMaxSafeInteger) return v;
  if (v is double && v.isFinite && v == v.truncateToDouble() && v >= 1 && v <= kMaxSafeInteger) return v.toInt();
  return null;
}

/// `parseSourceAdmobSnapshot(value)`: strict envelope; the configuration must be valid, its revision must equal
/// `upstreamRevision`, and an emergency stop requires `settings.enabled == false`.
SourceAdmobSnapshot? parseSourceAdmobSnapshot(Object? value) {
  if (value is! Map) return null;
  const keys = {'schema', 'sourceGeneration', 'upstreamRevision', 'emergencyDisabled', 'syncedAt', 'configuration'};
  if (!value.keys.every(keys.contains) || !keys.every(value.containsKey)) return null;
  if (value['schema'] != 'anacan-admob-source-v1') return null;
  final generation = _safePositive(value['sourceGeneration']), upstream = _safePositive(value['upstreamRevision']);
  final emergency = value['emergencyDisabled'], syncedAt = value['syncedAt'], configuration = value['configuration'];
  if (generation == null || upstream == null || emergency is! bool || !isZodDateTime(syncedAt)) return null;
  if (!isValidAdsConfiguration(configuration)) return null;
  final config = AdsConfiguration.fromJson({for (final e in (configuration as Map).entries) '${e.key}': e.value});
  if (config.revision != upstream || (emergency && config.settings.enabled)) return null;
  return SourceAdmobSnapshot(sourceGeneration: generation, upstreamRevision: upstream, emergencyDisabled: emergency, syncedAt: syncedAt as String, configuration: config);
}

/// `mirrorStatus(snapshot, primary)`.
AdmobMirrorStatus mirrorStatus(SourceAdmobSnapshot? snapshot, AdsConfiguration primary) {
  if (snapshot == null) return const AdmobMirrorStatus(available: false, ready: false);
  return AdmobMirrorStatus(
    available: true,
    ready: snapshot.upstreamRevision >= primary.revision,
    upstreamRevision: snapshot.upstreamRevision,
    sourceGeneration: snapshot.sourceGeneration,
    emergencyDisabled: snapshot.emergencyDisabled,
    syncedAt: snapshot.syncedAt,
  );
}
