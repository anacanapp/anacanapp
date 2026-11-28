// Ported from: src/components/ads/AdExperienceProvider.source.test.tsx
import 'dart:async';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/services/ads/ad_experience.dart';
import 'package:anacan/services/ads/admob_adapter.dart';
import 'package:anacan/services/ads/ads_api.dart';
import 'package:anacan/services/ads/ads_providers.dart';
import 'package:anacan/services/ads/continuity.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import 'admob_adapter_test.dart' show FakeAdmobSdk;

class FakeAdapter extends NativeAdmobAdapter {
  FakeAdapter() : super(FakeAdmobSdk());
  NativeConsent consentResult = const NativeConsent(canRequestAds: true, privacyOptionsRequired: true);
  NativeConsent privacyResult = const NativeConsent(canRequestAds: false, privacyOptionsRequired: true);
  int consents = 0, privacies = 0;
  final List<List<Object?>> banners = [];
  final List<List<Object?>> fullscreens = [];
  final List<List<Object?>> stories = [];
  final Set<String> prepared = {};
  int prepares = 0, storyPrepares = 0;

  @override
  Future<NativeConsent> consent({bool showForm = true}) async {
    consents++;
    return consentResult;
  }

  @override
  Future<NativeConsent> privacyOptions() async {
    privacies++;
    return privacyResult;
  }

  @override
  Future<void> showBanner(String unit, double margin, AdMode mode, bool npa, BannerCallbacks callbacks, {bool top = false, bool inline = false}) async {
    banners.add([unit, margin, mode, npa]);
    callbacks.loaded();
  }

  @override
  Future<void> stopBanner() async {}
  @override
  void reset() {}
  @override
  Future<void> positionBanner(double top, bool hidden) async {}

  @override
  Future<bool> prepare(String unit, AdMode mode, bool npa, [bool rewarded = false]) async {
    prepares++;
    prepared.add(unit);
    return true;
  }

  @override
  Future<bool> prepareStory(String unit, AdMode mode, bool npa, bool videoOnly) async {
    storyPrepares++;
    prepared.add(unit);
    return true;
  }

  @override
  bool isPrepared(String unit, AdMode mode, bool npa, [bool rewarded = false]) => prepared.contains(unit);
  @override
  bool isPreparing(String unit, AdMode mode, bool npa, [bool rewarded = false]) => false;
  @override
  bool isStoryPrepared(String unit, bool videoOnly) => prepared.contains(unit);
  @override
  bool isStoryPreparing(String unit, bool videoOnly) => false;

  @override
  Future<FullscreenResult> showFullscreen(String unit, AdMode mode, bool npa, bool rewarded, bool Function() allowed, FullscreenCallbacks callbacks) async {
    fullscreens.add([unit, mode, npa, rewarded]);
    if (!allowed()) return (shown: false, rewarded: false);
    callbacks.shown();
    callbacks.impression();
    if (rewarded) callbacks.rewarded();
    return (shown: true, rewarded: rewarded);
  }

  @override
  Future<FullscreenResult> showStory(String unit, bool videoOnly, bool Function() allowed, FullscreenCallbacks callbacks) async {
    stories.add([unit, videoOnly]);
    if (!allowed()) return (shown: false, rewarded: false);
    callbacks.shown();
    callbacks.impression();
    return (shown: true, rewarded: false);
  }
}

final user = User(id: '00000000-0000-4000-8000-000000000128', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

class Fixture {
  bool premium = false, ready = true;
  String platform = 'ios';
  late AdsConfiguration config;
  bool emergencyDisabled = false;
  final FakeAdapter adapter = FakeAdapter();
  final List<(String, Map<String, Object?>?)> rpcCalls = [];
  Future<AdsRpcResult> Function(String name)? rpcOverride;
  final List<http.Request> requests = [];
  Future<http.Response> Function(http.Request request) fetch = (_) async => throw http.ClientException('Azure unavailable');
  late ProviderContainer container;
  late QueryClient client;
  int _id = 0;

  Fixture() {
    config = defaultAdsConfiguration()
      ..settings.mode = 'test'
      ..settings.startupDelaySeconds = 0;
    for (final p in config.placements) {
      p.minScreenSeconds = 0;
    }
  }

  Future<AdsRpcResult> _rpc(String name, [Map<String, Object?>? args]) async {
    rpcCalls.add((name, args));
    final override = rpcOverride;
    if (override != null) return override(name);
    if (name != kSourceAdmobRpc) throw StateError('Unexpected Source RPC');
    final configuration = config.toJson();
    if (emergencyDisabled) (configuration['settings']! as Map<String, Object?>)['enabled'] = false;
    return AdsRpcResult(data: {
      'schema': 'anacan-admob-source-v1',
      'sourceGeneration': 1,
      'upstreamRevision': config.revision,
      'emergencyDisabled': emergencyDisabled,
      'syncedAt': '2026-01-01T00:00:00Z',
      'configuration': configuration,
    });
  }

  AdExperienceController mount() {
    client = QueryClient();
    final api = AdsApi(
      backend: () => (azure: false, url: kSourceAdmobOrigin),
      rpc: _rpc,
      client: MockClient((request) {
        requests.add(request);
        return fetch(request);
      }),
      sourceKey: 'public-source-anon-fixture',
    );
    final web = platform == 'web';
    container = ProviderContainer(overrides: [
      queryClientProvider.overrideWithValue(client),
      authUserProvider.overrideWithValue(user),
      adsBackendProvider.overrideWithValue((azure: false, url: kSourceAdmobOrigin)),
      adsApiProvider.overrideWithValue(api),
      adExperienceInputsProvider.overrideWithValue(AdExperienceInputs(userId: user.id, isPremium: premium, entitlementReady: ready)),
      adExperienceEnvProvider.overrideWithValue(AdExperienceEnv(
        api: api,
        store: LocalStore.memory(),
        platform: web ? 'android' : platform,
        native: !web,
        compiledAppId: compiledAdmobAppId,
        appVersion: () async => '31.0',
        newId: () => 'id-${++_id}',
        adapter: web ? null : adapter,
      )),
    ]);
    return container.read(adExperienceProvider);
  }

  Future<void> dispose(WidgetTester tester) async {
    container.dispose();
    client.clear();
    await tester.pump(const Duration(days: 1));
  }
}

Future<void> settle(WidgetTester tester, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

void main() {
  group('Source native advertising survives Azure outages with real UMP eligibility', () {
    testWidgets('obtains Source consent, starts an official test banner, and honors privacy withdrawal', (tester) async {
      final f = Fixture();
      final ads = f.mount();
      ads.registerSurface('home_banner');
      await settle(tester);
      expect(f.adapter.banners, isNotEmpty);
      expect(f.adapter.consents, 1);
      expect([f.adapter.banners.first[0], f.adapter.banners.first[2], f.adapter.banners.first[3]], [testUnitIds['ios']!['banner'], 'test', true]);
      expect(f.rpcCalls.first.$1, kSourceAdmobRpc); expect(f.rpcCalls.first.$2, {'p_expected_revision': null});
      for (final request in f.requests) {
        expect('${request.url}', 'https://api.anacan.az/admob/events');
        expect(request.followRedirects, isFalse);
        expect(request.headers.keys.map((k) => k.toLowerCase()), isNot(contains('authorization')));
      }
      expect(ads.banner?.loaded, isTrue);
      await ads.openPrivacy();
      await settle(tester);
      expect(ads.decisionFor('home_banner').reason, 'consent');
      expect(f.adapter.privacies, 1);
      expect(ads.banner, isNull);
      await f.dispose(tester);
    });

    for (final (platform, status) in const [('ios', 403), ('ios', 503), ('android', 403), ('android', 503)]) {
      testWidgets('keeps $platform test ads working when Azure returns $status', (tester) async {
        final f = Fixture()..platform = platform;
        f.fetch = (_) async => http.Response('{}', status);
        final ads = f.mount();
        ads.registerSurface('home_banner');
        await settle(tester);
        expect(f.adapter.banners.first[0], testUnitIds[platform]!['banner']);
        expect(f.adapter.consents, 1);
        expect(ads.banner?.loaded, isTrue);
        await f.dispose(tester);
      });
    }

    for (final id in const ['article_exit_interstitial', 'community_story_break', 'ads_pause_rewarded']) {
      testWidgets('requests and shows $id with Azure networking blocked', (tester) async {
        final f = Fixture();
        final ads = f.mount();
        ads.registerSurface('home_banner');
        await settle(tester);
        expect(f.adapter.banners, isNotEmpty);
        ads.registerSurface(id);
        await settle(tester);
        if (id == 'article_exit_interstitial') expect(f.adapter.prepares, greaterThan(0));
        if (id == 'community_story_break') expect(f.adapter.storyPrepares, greaterThan(0));
        bool? result;
        unawaited((id == 'ads_pause_rewarded'
                ? ads.showRewarded()
                : id == 'community_story_break'
                    ? ads.showStory()
                    : ads.showInterstitial('article_exit_interstitial'))
            .then((value) => result = value));
        await settle(tester);
        expect(result, isTrue);
        final call = id == 'community_story_break' ? f.adapter.stories.first : f.adapter.fullscreens.first;
        expect(call[0], testUnitIds['ios']![id == 'community_story_break' ? 'native_story' : id == 'ads_pause_rewarded' ? 'rewarded' : 'interstitial']);
        expect(f.rpcCalls.every((c) => c.$1 == kSourceAdmobRpc), isTrue);
        await f.dispose(tester);
      });
    }

    for (final stop in const ['primary kill switch', 'Source emergency']) {
      testWidgets('removes the running banner when a new Source read contains $stop', (tester) async {
        final f = Fixture();
        final ads = f.mount();
        ads.registerSurface('home_banner');
        await settle(tester);
        expect(ads.banner?.loaded, isTrue);
        if (stop == 'Source emergency') {
          f.emergencyDisabled = true;
        } else {
          f.config.settings.enabled = false;
          f.config.revision++;
        }
        unawaited(f.client.invalidateQueries(queryKey: const ['admob-configuration']));
        await settle(tester);
        expect(ads.banner, isNull);
        expect(ads.decisionFor('home_banner').reason, 'disabled');
        await f.dispose(tester);
      });
    }

    testWidgets('still fails closed if Source itself becomes unavailable', (tester) async {
      final f = Fixture();
      final ads = f.mount();
      ads.registerSurface('home_banner');
      await settle(tester);
      expect(ads.banner?.loaded, isTrue);
      f.rpcOverride = (_) async => const AdsRpcResult(error: AdsRpcError(message: 'unavailable'));
      unawaited(f.client.invalidateQueries(queryKey: const ['admob-configuration']));
      await settle(tester);
      expect(ads.banner, isNull);
      expect(ads.decisionFor('home_banner').reason, 'configuration');
      await f.dispose(tester);
    });

    testWidgets('does not load a banner when UMP refuses consent, and can reopen privacy on Source', (tester) async {
      final f = Fixture();
      f.adapter
        ..consentResult = const NativeConsent(canRequestAds: false, privacyOptionsRequired: true)
        ..privacyResult = const NativeConsent(canRequestAds: true, privacyOptionsRequired: true);
      final ads = f.mount();
      ads.registerSurface('home_banner');
      await settle(tester);
      expect(f.adapter.consents, 1);
      expect(f.adapter.banners, isEmpty);
      await ads.openPrivacy();
      await settle(tester);
      expect(f.adapter.banners, isNotEmpty);
      await f.dispose(tester);
    });

    for (final mode in const ['premium', 'unknown entitlement', 'web']) {
      testWidgets('keeps SDK loading suppressed for $mode', (tester) async {
        final f = Fixture()
          ..premium = mode == 'premium'
          ..ready = mode != 'unknown entitlement';
        if (mode == 'web') f.platform = 'web';
        final ads = f.mount();
        ads.registerSurface('home_banner');
        await settle(tester);
        expect(ads.decisionFor('home_banner').reason, mode == 'premium' ? 'premium' : mode == 'web' ? 'unsupported' : 'entitlement_loading');
        expect(f.adapter.consents, 0);
        expect(f.adapter.banners, isEmpty);
        await f.dispose(tester);
      });
    }
  });
}
