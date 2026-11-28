// Ported from: src/components/ads/AdExperienceProvider.tsx (provider inputs: useAuth, useSubscription,
//              useTimerStore, useWhiteNoiseStore, usePrivacyConsent, getBackendConfig, the configuration query),
//              src/lib/ads/api.ts (module wiring)
//
// Riverpod wiring of the ad experience. `adExperienceProvider` is the one `useAdExperience()` of the app.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/privacy_consent.dart';
import '../../core/net/backend_client.dart' show BootstrapOpened;
import '../../core/net/backend_providers.dart';
import '../../core/net/build_config.dart';
import '../../core/offline/offline_outbox.dart' show newClientId;
import '../../domain/ads/ads_config.dart';
import '../../native/purchases/purchases_providers.dart' show currentStorePlatform;
import '../../native/purchases/subscription.dart' show subscriptionProvider;
import '../../state/persisted_store.dart' show localStoreProvider;
import '../../state/timer_store.dart';
import '../../state/white_noise_store.dart';
import 'ad_experience.dart';
import 'admob_adapter.dart';
import 'ads_api.dart';

/// `getBackendConfig()` of the admitted backend.
final adsBackendProvider = Provider<AdsBackend>((ref) {
  try {
    final result = ref.watch(backendBootstrapProvider).value;
    return result is BootstrapOpened ? (azure: result.backend.azure, url: result.backend.url) : (azure: false, url: '');
  } catch (_) {
    return (azure: false, url: '');
  }
});

final adsHttpClientProvider = Provider<http.Client>((ref) {
  final client = http.Client();
  ref.onDispose(client.close);
  return client;
});

final adsApiProvider = Provider<AdsApi>((ref) => AdsApi(
      backend: () => ref.read(adsBackendProvider),
      rpc: supabaseAdsRpc(() => ref.read(supabaseClientProvider)),
      client: ref.watch(adsHttpClientProvider),
      sourceKey: BuildConfig.fromEnvironment.sourceAnonKey,
    ));

/// `VITE_ADMOB_IOS_APP_ID` / `VITE_ADMOB_ANDROID_APP_ID` as `--dart-define=ANACAN_ADMOB_IOS_APP_ID|ANDROID_APP_ID`
/// (public app ids, not secrets); Google's test app ids when unset.
String compiledAdmobAppId(AdPlatform platform) {
  const ios = String.fromEnvironment('ANACAN_ADMOB_IOS_APP_ID');
  const android = String.fromEnvironment('ANACAN_ADMOB_ANDROID_APP_ID');
  final value = platform == 'ios' ? ios : android;
  return value.isNotEmpty ? value : testAppIds[platform]!;
}

/// `useQuery(['admob-configuration', backend.url], fetchAdmobConfiguration)`: 30 min poll, re-read on resume /
/// reconnect once 60 s stale, no retry.
final admobConfigurationQuery = queryProvider<AdsConfiguration>((ref) {
  final backend = ref.watch(adsBackendProvider);
  final userId = ref.watch(authUserProvider.select((u) => u?.id));
  return QueryOptions<AdsConfiguration>(
    queryKey: ['admob-configuration', backend.url],
    queryFn: (_) => ref.read(adsApiProvider).fetchAdmobConfiguration(),
    enabled: userId != null,
    staleTime: kAdmobConfigStale,
    gcTime: kAdmobConfigFresh,
    refetchInterval: kAdmobConfigPoll,
    refetchOnWindowFocus: RefetchOn.ifStale,
    refetchOnReconnect: RefetchOn.ifStale,
    retry: noRetry,
  );
}, name: 'admobConfigurationQuery');

final adExperienceInputsProvider = Provider<AdExperienceInputs>((ref) {
  final subscription = ref.watch(subscriptionProvider.select((s) => (premium: s.isPremium, ready: s.entitlementReady)));
  return AdExperienceInputs(
    userId: ref.watch(authUserProvider.select((u) => u?.id)),
    isAdmin: ref.watch(isAdminProvider),
    isPremium: subscription.premium,
    entitlementReady: subscription.ready,
    hasActiveTimer: ref.watch(timerStoreProvider.select((s) => s.activeTimers.isNotEmpty)),
    hasActiveAudio: ref.watch(whiteNoiseStoreProvider.select((s) => s.isPlaying)),
    personalizedAdsAllowed: ref.watch(privacyConsentProvider.select((c) => c.ads)),
  );
});

/// Called when the UMP privacy form cannot open (the host shows React's toast).
final adPrivacyUnavailableProvider = Provider<void Function()>((ref) => () {});

final adExperienceEnvProvider = Provider<AdExperienceEnv>((ref) {
  final sdk = ref.watch(admobSdkProvider);
  final platform = currentStorePlatform();
  return AdExperienceEnv(
    api: ref.watch(adsApiProvider),
    store: ref.watch(localStoreProvider),
    platform: platform == 'ios' ? 'ios' : 'android',
    native: platform != 'web',
    compiledAppId: compiledAdmobAppId,
    appVersion: () async => (await PackageInfo.fromPlatform()).version,
    newId: newClientId,
    adapter: sdk == null ? null : NativeAdmobAdapter(sdk),
    azure: ref.watch(adsBackendProvider).azure,
    onPrivacyUnavailable: () => ref.read(adPrivacyUnavailableProvider)(),
  );
});

/// `useAdExperience()`.
final adExperienceProvider = Provider<AdExperienceController>((ref) {
  final controller = AdExperienceController(ref.watch(adExperienceEnvProvider));
  ref.onDispose(controller.dispose);
  ref.listen<AdExperienceInputs>(adExperienceInputsProvider, (_, next) => controller.updateInputs(next), fireImmediately: true);
  ref.listen<QueryResult<AdsConfiguration>>(
    admobConfigurationQuery,
    (_, q) => controller.updateConfiguration(data: q.data, isError: q.isError, dataUpdatedAt: q.dataUpdatedAt),
    fireImmediately: true,
  );
  return controller;
});
