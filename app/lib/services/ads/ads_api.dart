// Ported from: src/lib/ads/api.ts
//
// AdMob configuration reads (Azure RPC, or the Source mirror when the selected backend is Source / Azure is
// down), coarse delivery telemetry and the admin mutations. The Source mirror is read with the public Source
// anon key only (`ANACAN_SOURCE_ANON_KEY` = React's VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY); the user's JWT never
// goes to Source. Telemetry never blocks navigation.
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/ads/ads_config.dart';
import 'ads_schema.dart';
import 'continuity.dart';

class AdmobConfigurationError implements Exception {
  const AdmobConfigurationError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// `getBackendConfig()` (azure flag + url).
typedef AdsBackend = ({bool azure, String url});

class AdsRpcError {
  const AdsRpcError({this.message, this.code});
  final String? message;
  final String? code;
}

/// supabase-js `{ data, error }` of an RPC.
class AdsRpcResult {
  const AdsRpcResult({this.data, this.error});
  final Object? data;
  final AdsRpcError? error;
}

typedef AdsRpc = Future<AdsRpcResult> Function(String name, [Map<String, Object?>? args]);

/// `supabase.rpc(name, args)` as `{ data, error }` (network failures become an error, as in supabase-js).
AdsRpc supabaseAdsRpc(SupabaseClient Function() client) => (name, [args]) async {
      try {
        return AdsRpcResult(data: await client().rpc<Object?>(name, params: args));
      } on PostgrestException catch (error) {
        return AdsRpcResult(error: AdsRpcError(message: error.message, code: error.code));
      } catch (error) {
        return AdsRpcResult(error: AdsRpcError(message: '$error'));
      }
    };

class AdmobOverview {
  const AdmobOverview({required this.configuration, required this.metrics, required this.history});
  final AdsConfiguration configuration;
  final List<Object?> metrics;
  final List<Object?> history;
}

class AdmobMutationResult {
  const AdmobMutationResult({required this.configuration, required this.continuity});
  final AdsConfiguration configuration;
  final AdmobMirrorStatus continuity;
}

/// 'requested' | 'loaded' | 'impression' | 'shown' | 'dismissed' | 'reward_earned' | 'failed' | 'skipped' | 'demo_clicked'
typedef AdEvent = String;

const String kAdmobControlOrigin = 'https://api.anacan.az';
const String kAdmobControlUrl = '$kAdmobControlOrigin/admin/ads';

class AdsApi {
  AdsApi({
    required this.backend,
    required this.rpc,
    required this.client,
    this.sourceKey = '',
    this.requestTimeout = const Duration(seconds: 8),
    Future<void> Function(Duration delay)? delay,
  }) : _delay = delay ?? Future<void>.delayed;

  final AdsBackend Function() backend;
  final AdsRpc rpc;
  final http.Client client;

  /// Public Source anon key (VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY).
  final String sourceKey;
  final Duration requestTimeout;
  final Future<void> Function(Duration delay) _delay;

  /// `fetch(url, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error' })`: package:http
  /// keeps no cookies; a redirect is not followed (and is not a 2xx, so it fails).
  Future<http.Response> _post(Uri url, Map<String, String> headers, String body) async {
    final request = http.Request('POST', url)
      ..followRedirects = false
      ..headers.addAll(headers)
      ..body = body;
    final streamed = await client.send(request).timeout(requestTimeout);
    return http.Response.fromStream(streamed).timeout(requestTimeout);
  }

  Future<Object?> _publicControlRequest(String path, String body) async {
    final response = await _post(Uri.parse(kAdmobControlOrigin + path), const {'Content-Type': 'application/json'}, body);
    if (response.statusCode < 200 || response.statusCode >= 300) throw const AdmobConfigurationError('admob_service_unavailable');
    return jsonDecode(response.body);
  }

  Object? _assertResult(AdsRpcResult result) {
    final error = result.error;
    if (error != null) {
      final message = error.message ?? '';
      throw AdmobConfigurationError(RegExp(r'^admob_[a-z_]+$').hasMatch(message) ? message : 'admob_service_unavailable');
    }
    return result.data;
  }

  Future<Object?> _sourceControlRpc(String name, Map<String, Object?> args) async {
    final result = await rpc(name, args).timeout(requestTimeout, onTimeout: () => throw const AdmobConfigurationError('admob_source_unavailable'));
    if (result.error?.code == 'PGRST202') throw const AdmobConfigurationError('admob_source_not_installed');
    if (result.error?.code == 'PT503') throw const AdmobConfigurationError('admob_source_frozen');
    return _assertResult(result);
  }

  Future<SourceAdmobSnapshot> fetchSourceAdmobSnapshot([int? expectedRevision]) async {
    if (expectedRevision != null && (expectedRevision < 1 || expectedRevision > kMaxSafeInteger)) {
      throw const AdmobConfigurationError('admob_invalid_configuration');
    }
    final b = backend();
    Object? value;
    if (!b.azure) {
      if (b.url != kSourceAdmobOrigin) throw const AdmobConfigurationError('admob_source_unavailable');
      value = await _sourceControlRpc(kSourceAdmobRpc, {'p_expected_revision': expectedRevision});
    } else {
      // Public Source key only: no user/profile/health information and no Azure session goes to Source.
      if (sourceKey.isEmpty) throw const AdmobConfigurationError('admob_source_unavailable');
      try {
        final response = await _post(
          Uri.parse('$kSourceAdmobOrigin/rest/v1/rpc/$kSourceAdmobRpc'),
          {'apikey': sourceKey, 'Authorization': 'Bearer $sourceKey', 'Content-Type': 'application/json'},
          jsonEncode({'p_expected_revision': expectedRevision}),
        );
        if (response.statusCode < 200 || response.statusCode >= 300) throw const AdmobConfigurationError('admob_source_unavailable');
        value = jsonDecode(response.body);
      } on AdmobConfigurationError {
        rethrow;
      } catch (_) {
        throw const AdmobConfigurationError('admob_source_unavailable');
      }
    }
    final snapshot = parseSourceAdmobSnapshot(value);
    if (snapshot == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return snapshot;
  }

  Future<SourceAdmobSnapshot> synchronizeSourceAdmob(int revision) async {
    if (revision < 1 || revision > kMaxSafeInteger) throw const AdmobConfigurationError('admob_invalid_configuration');
    for (final delay in const [0, 500, 1000, 2000, 4000]) {
      if (delay > 0) await _delay(Duration(milliseconds: delay));
      final snapshot = await fetchSourceAdmobSnapshot(revision);
      if (snapshot.upstreamRevision >= revision) return snapshot;
    }
    throw const AdmobConfigurationError('admob_source_sync_pending');
  }

  Future<AdmobMutationResult> _mirrorMutation(AdsConfiguration saved) async {
    SourceAdmobSnapshot? snapshot;
    try {
      snapshot = await synchronizeSourceAdmob(saved.revision);
    } catch (_) {/* Status remains unconfirmed. */}
    // Azure already committed. Do not report an unsaved draft or repeat the mutation.
    return AdmobMutationResult(configuration: saved, continuity: mirrorStatus(snapshot, saved));
  }

  Future<SourceAdmobSnapshot> setSourceAdmobEmergency(bool disabled) async {
    final b = backend();
    if (b.azure || b.url != kSourceAdmobOrigin) throw const AdmobConfigurationError('admob_source_admin_required');
    final result = parseSourceAdmobSnapshot(await _sourceControlRpc('admin_set_source_admob_emergency_v1', {'p_disabled': disabled}));
    if (result == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return result;
  }

  /// The configuration the app runs with (fails closed on an invalid document).
  Future<AdsConfiguration> fetchAdmobConfiguration() async {
    Object? value;
    if (backend().azure) {
      value = _assertResult(await rpc('get_admob_configuration'));
    } else {
      // Source is independently reachable during Azure outages: the last-good snapshot + emergency overlay.
      value = (await fetchSourceAdmobSnapshot()).configuration.toJson();
    }
    final config = parseAdsConfiguration(value);
    if (config == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return config;
  }

  Future<AdmobOverview> fetchAdmobOverview() async {
    if (!backend().azure) throw const AdmobConfigurationError('admob_azure_required');
    final value = _assertResult(await rpc('admin_get_admob_overview'));
    final map = value is Map ? value : null;
    final config = parseAdsConfiguration(map?['configuration']);
    if (config == null || map?['metrics'] is! List || map?['history'] is! List) throw const AdmobConfigurationError('admob_invalid_configuration');
    return AdmobOverview(configuration: config, metrics: map!['metrics'] as List, history: map['history'] as List);
  }

  Future<AdmobMutationResult> saveAdmobConfiguration(AdsConfiguration config) async {
    if (!backend().azure) throw const AdmobConfigurationError('admob_azure_required');
    final json = config.toJson();
    final data = _assertResult(await rpc('admin_save_admob_configuration', {
      'p_expected_revision': config.revision,
      'p_settings': json['settings'],
      'p_placements': json['placements'],
    }));
    final saved = parseAdsConfiguration(data);
    if (saved == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return _mirrorMutation(saved);
  }

  Future<AdmobMutationResult> restoreAdmobConfiguration(int revision, int expectedRevision) async {
    if (!backend().azure) throw const AdmobConfigurationError('admob_azure_required');
    final saved = parseAdsConfiguration(_assertResult(await rpc('admin_restore_admob_configuration', {'p_revision': revision, 'p_expected_revision': expectedRevision})));
    if (saved == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return _mirrorMutation(saved);
  }

  Future<AdmobMutationResult> disableAdmob() async {
    if (!backend().azure) throw const AdmobConfigurationError('admob_azure_required');
    final saved = parseAdsConfiguration(_assertResult(await rpc('admin_disable_admob')));
    if (saved == null) throw const AdmobConfigurationError('admob_invalid_configuration');
    return _mirrorMutation(saved);
  }

  /// Coarse delivery telemetry. On Source only native test/live events of an identified revision are sent.
  Future<void> reportAdEvent(String placementId, AdEvent event, AdMode mode, String platform, [String reason = '', int? revision]) async {
    try {
      if (!backend().azure) {
        if (mode == 'demo' || !const ['ios', 'android'].contains(platform) || revision == null || revision < 1 || revision > kMaxSafeInteger) return;
        await _publicControlRequest('/admob/events', jsonEncode({
          'p_revision': revision,
          'p_placement_id': placementId,
          'p_event': event,
          'p_mode': mode,
          'p_platform': platform,
          'p_reason': reason,
        }));
        return;
      }
      await rpc('record_admob_event', {'p_placement_id': placementId, 'p_event': event, 'p_mode': mode, 'p_platform': platform, 'p_reason': reason});
    } catch (_) {/* Telemetry never blocks navigation or changes entitlement. */}
  }
}

const Map<String, String> kAdmobErrorLabels = {
  'admob_configuration_changed_reload': 'Ayarlar başqa pəncərədə yenilənib. Son versiyanı yükləyib dəyişiklikləri yenidən tətbiq edin.',
  'admob_admin_required': 'Bu əməliyyat yalnız administrator üçündür.',
  'admob_live_ids_required': 'Aktiv placement-lər üçün iOS/Android canlı App ID və Ad unit ID-lərini tamamlayın.',
  'admob_live_publisher_required': 'Canlı rejim üçün öz AdMob Publisher ID-niz tələb olunur.',
  'admob_azure_required': 'Reklam ayarları vahid idarəetmə mərkəzində — api.anacan.az ünvanında dəyişdirilir.',
  'admob_service_unavailable': 'Reklam xidməti əlçatan deyil. Yenidən cəhd edin.',
  'admob_source_unavailable': 'Source reklam ehtiyatı əlçatan deyil. Source quraşdırmasını və bağlantını yoxlayın.',
  'admob_source_not_installed': 'Source reklam ehtiyatı hələ quraşdırılmayıb. Hazır SQL quraşdırma faylını icra edin.',
  'admob_source_frozen': 'Source yazıları köçürmə üçün dondurulub. Hazırda bu ayar dəyişdirilə bilməz.',
  'admob_source_sync_pending': 'Azure-da saxlanıb; Source reklam nüsxəsinin yenilənməsi hələ təsdiqlənməyib.',
  'admob_source_admin_required': 'Bu emergency əməliyyatı Source administrator hesabı ilə edilir.',
  'admob_invalid_configuration': 'Reklam konfiqurasiyası yoxlamadan keçmədi. Son ayarları yenidən yükləyin.',
};
