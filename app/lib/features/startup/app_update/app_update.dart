// Ported from: src/hooks/useAppUpdate.ts, src/hooks/useForceUpdate.ts, docs/APP_UPDATE_CENTRE.md
//
// The update centre (`get_app_update_v1`) and the legacy `force_update` setting. The app root overrides the
// shell's `updateCentreForceProvider` / `legacyForceUpdateProvider` with [appUpdateProvider] /
// [legacyForceUpdateProvider] so the gate order picks the force screen.
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/admission/backend_admission.dart' show compareNativeVersions;
import '../../../core/cache/cache.dart';
import '../../../core/data/db.dart';
import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../core/auth/auth_providers.dart' show authProfileProvider;

/// `get_app_update_v1` decision (server picks the strongest matching rule; texts already localised).
@immutable
class AppUpdateDecision {
  const AppUpdateDecision({
    required this.ruleId,
    required this.mode,
    required this.frequency,
    required this.targetVersion,
    required this.storeUrl,
    this.storeVersion,
    this.title,
    this.body,
    this.whatsNew = const [],
    this.button,
    this.later,
    this.raw = const {},
  });

  static const String protocol = 'anacan-app-update-v1';

  final String ruleId;

  /// `force | soft | banner`.
  final String mode;

  /// `every_launch | daily | once`.
  final String frequency;
  final String targetVersion;
  final String? storeVersion;
  final String? title;
  final String? body;

  /// Raw `whats_new` entries (the sheet keeps the non-blank strings).
  final List<Object?> whatsNew;
  final String? button;
  final String? later;
  final String storeUrl;

  /// The JSON object as received (written back to the 24 h cache unchanged).
  final Map<String, Object?> raw;

  /// `isDecision(value)`.
  static AppUpdateDecision? tryParse(Object? value) {
    if (value is! Map) return null;
    final m = Map<String, Object?>.from(value);
    if (m['protocol'] != protocol) return null;
    if (!const ['force', 'soft', 'banner'].contains(m['mode'])) return null;
    if (m['store_url'] is! String) return null;
    String? s(String k) => m[k] is String ? m[k] as String : (m[k] == null ? null : '${m[k]}');
    final whatsNew = m['whats_new'];
    return AppUpdateDecision(
      ruleId: s('rule_id') ?? '',
      mode: m['mode'] as String,
      frequency: s('frequency') ?? '',
      targetVersion: s('target_version') ?? '',
      storeVersion: s('store_version'),
      title: s('title'),
      body: s('body'),
      whatsNew: whatsNew is List ? List<Object?>.from(whatsNew) : const [],
      button: s('button'),
      later: s('later'),
      storeUrl: m['store_url'] as String,
      raw: m,
    );
  }
}

const String kAppUpdateCacheKey = 'anacan_app_update_v1';
String appUpdateLaterKey(String ruleId) => 'anacan_app_update_later_$ruleId';
const Duration kAppUpdateCacheAge = Duration(hours: 24);
const Duration _day = Duration(hours: 24);

/// One sheet per launch for `every_launch` rules (module scope: survives rebuilds, not a cold start).
final Set<String> appUpdateShownThisLaunch = <String>{};

/// `softSheetAllowed(decision, laterAt, now)`.
bool softSheetAllowed(AppUpdateDecision decision, int? laterAt, [int? now]) {
  if (decision.mode != 'soft') return false;
  if (decision.frequency == 'every_launch') return !appUpdateShownThisLaunch.contains(decision.ruleId);
  if (laterAt == null) return true;
  if (decision.frequency == 'once') return false;
  return (now ?? DateTime.now().millisecondsSinceEpoch) - laterAt >= _day.inMilliseconds;
}

/// `Capacitor.isNativePlatform()` (Android / iOS process). False in host tests.
final nativeUpdateChecksProvider = Provider<bool>((ref) => !kIsWeb && (Platform.isAndroid || Platform.isIOS));

/// `Capacitor.getPlatform()` for the RPC and the store label.
final appPlatformNameProvider = Provider<String>((ref) {
  if (kIsWeb) return 'web';
  if (Platform.isIOS) return 'ios';
  if (Platform.isAndroid) return 'android';
  return 'web';
});

/// `App.getInfo().version` (CFBundleShortVersionString / versionName).
final installedAppVersionProvider = FutureProvider<String>((ref) async => (await PackageInfo.fromPlatform()).version);

/// The query result of `useAppUpdate`.
typedef AppUpdateFetch = ({AppUpdateDecision? decision, String version});

final appUpdateQuery = queryProviderFamily<AppUpdateFetch, String?>((ref, country) {
  return QueryOptions<AppUpdateFetch>(
    queryKey: ['app-update-decision', (country == null || country.isEmpty) ? null : country],
    enabled: ref.watch(nativeUpdateChecksProvider),
    staleTime: const Duration(seconds: 60),
    refetchInterval: const Duration(hours: 6),
    // React also refetches on every `appStateChange` → active, whether stale or not.
    refetchOnWindowFocus: RefetchOn.always,
    retry: retryTimes(1),
    // The decision is cached by the hook itself (24 h LS key); the query result is not persisted.
    meta: const {'persist': false},
    queryFn: (_) async {
      final version = await ref.read(installedAppVersionProvider.future);
      final data = await ref.read(dbProvider).rpc<Object?>('get_app_update_v1', params: {
        'p_platform': ref.read(appPlatformNameProvider),
        'p_version': version,
        'p_language': ref.read(appLanguageProvider),
        'p_country': (country == null || country.isEmpty) ? null : country,
      });
      final decision = AppUpdateDecision.tryParse(data);
      _writeCache(ref, decision);
      return (decision: decision, version: version);
    },
  );
});

void _writeCache(Ref ref, AppUpdateDecision? decision) {
  try {
    ref.read(localStoreProvider).writeJson(kAppUpdateCacheKey, {
      'at': DateTime.now().millisecondsSinceEpoch,
      'decision': decision?.raw,
    });
  } catch (_) {
    // storage blocked
  }
}

AppUpdateDecision? _readCache(Ref ref) {
  try {
    final v = ref.read(localStoreProvider).readJson(kAppUpdateCacheKey);
    if (v is! Map) return null;
    final at = v['at'];
    if (at is! num || DateTime.now().millisecondsSinceEpoch - at >= kAppUpdateCacheAge.inMilliseconds) return null;
    return AppUpdateDecision.tryParse(v['decision']);
  } catch (_) {
    return null;
  }
}

/// `useAppUpdate(country)` state.
@immutable
class AppUpdateState {
  const AppUpdateState({this.decision, this.currentVersion, this.showSheet = false, this.showBanner = false});
  final AppUpdateDecision? decision;
  final String? currentVersion;
  final bool showSheet;
  final bool showBanner;
  bool get forceRequired => decision?.mode == 'force';
}

/// `useAppUpdate(profile?.country_code)` (Index).
final appUpdateProvider = NotifierProvider<AppUpdateController, AppUpdateState>(AppUpdateController.new);

class AppUpdateController extends Notifier<AppUpdateState> {
  AppUpdateDecision? _decision;

  @override
  AppUpdateState build() {
    final native = ref.watch(nativeUpdateChecksProvider);
    if (!native) return const AppUpdateState();
    final country = ref.watch(authProfileProvider.select((p) => p?.countryCode));
    final q = ref.watch(appUpdateQuery(country));
    final decision = _decision = q.data?.decision ?? (q.isError ? _readCache(ref) : null);
    int? laterAt;
    if (decision != null) {
      final v = num.tryParse(ref.read(localStoreProvider).getItem(appUpdateLaterKey(decision.ruleId)) ?? '');
      laterAt = v != null && v.isFinite && v > 0 ? v.toInt() : null;
    }
    final showSheet = decision != null && softSheetAllowed(decision, laterAt);
    return AppUpdateState(
      decision: decision,
      currentVersion: q.data?.version,
      showSheet: showSheet,
      showBanner: decision != null && (decision.mode == 'banner' || (decision.mode == 'soft' && !showSheet)),
    );
  }

  /// `later()`: remember the tap (per launch + LS timestamp).
  void later() {
    final decision = _decision;
    if (decision == null) return;
    appUpdateShownThisLaunch.add(decision.ruleId);
    try {
      ref.read(localStoreProvider).setItem(appUpdateLaterKey(decision.ruleId), '${DateTime.now().millisecondsSinceEpoch}');
    } catch (_) {}
    ref.invalidateSelf();
  }

  /// `openStore()`: `window.open(store_url, '_system')`.
  Future<void> openStore() async {
    final decision = _decision;
    if (decision == null) return;
    await openStoreUrl(decision.storeUrl);
  }
}

/// `window.open(url, '_system')`.
Future<void> openStoreUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {}
}

/// Legacy `force_update` app setting (`useForceUpdate`).
@immutable
class ForceUpdateConfig {
  const ForceUpdateConfig({
    required this.enabled,
    required this.minVersion,
    this.title,
    this.message,
    this.androidUrl = '',
    this.iosUrl = '',
  });
  final bool enabled;
  final String? minVersion;
  final String? title;
  final String? message;
  final String androidUrl;
  final String iosUrl;

  static ForceUpdateConfig? fromJson(Object? json) {
    if (json is! Map) return null;
    String? s(String k) => json[k] is String ? json[k] as String : null;
    return ForceUpdateConfig(
      enabled: json['enabled'] == true,
      minVersion: json['min_version']?.toString(),
      title: s('title'),
      message: s('message'),
      androidUrl: s('android_url') ?? '',
      iosUrl: s('ios_url') ?? '',
    );
  }
}

typedef ForceUpdateFetch = ({ForceUpdateConfig? config, bool updateRequired});

final forceUpdateQuery = queryProvider<ForceUpdateFetch>((ref) => QueryOptions<ForceUpdateFetch>(
      queryKey: const ['force-update-config'],
      enabled: ref.watch(nativeUpdateChecksProvider),
      staleTime: const Duration(seconds: 60),
      refetchInterval: const Duration(minutes: 5),
      meta: const {'persist': false},
      queryFn: (_) async {
        final results = await Future.wait<Object?>([
          ref.read(installedAppVersionProvider.future),
          ref.read(dbProvider).rpc<Object?>('get_public_app_setting', params: {'p_key': 'force_update'}),
        ]);
        final version = results[0] as String;
        final raw = results[1];
        final config = ForceUpdateConfig.fromJson(raw is String ? jsonDecode(raw) : raw);
        final comparison = config != null ? compareNativeVersions(version, config.minVersion) : null;
        return (config: config, updateRequired: config?.enabled == true && comparison != null && comparison < 0);
      },
    ));

/// `useForceUpdate()`: `{forceUpdate, updateRequired, isLoading}`.
final legacyForceUpdateStateProvider = Provider<({ForceUpdateConfig? forceUpdate, bool updateRequired, bool isLoading})>((ref) {
  final native = ref.watch(nativeUpdateChecksProvider);
  if (!native) return (forceUpdate: null, updateRequired: false, isLoading: false);
  final q = ref.watch(forceUpdateQuery);
  return (forceUpdate: q.data?.config, updateRequired: q.data?.updateRequired == true, isLoading: q.isLoading);
});

/// Index: `!forceUpdateLoading && updateRequired && forceUpdate`.
final legacyForceUpdateGateProvider = Provider<bool>((ref) {
  final s = ref.watch(legacyForceUpdateStateProvider);
  return !s.isLoading && s.updateRequired && s.forceUpdate != null;
});

/// Index: `appUpdate.forceRequired && appUpdate.decision`.
final updateCentreForceGateProvider = Provider<bool>((ref) {
  final s = ref.watch(appUpdateProvider);
  return s.forceRequired && s.decision != null;
});
