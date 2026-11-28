// Ported from: src/lib/ads/native.test.ts
import 'dart:async';

import 'package:anacan/services/ads/admob_adapter.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class _Handle implements AdmobListenerHandle {
  _Handle(this.onRemove);
  final void Function() onRemove;
  @override
  Future<void> remove() async => onRemove();
}

class FakeAdmobSdk implements AdmobSdk {
  final Map<String, Set<void Function(Map<String, Object?>)>> handlers = {};
  final Map<String, int> calls = {};
  Completer<void>? prepareInterstitialGate;

  void _count(String name) => calls[name] = (calls[name] ?? 0) + 1;
  int count(String name) => calls[name] ?? 0;
  void emit(String name, [Map<String, Object?> value = const {}]) {
    for (final cb in List.of(handlers[name] ?? const <void Function(Map<String, Object?>)>{})) {
      cb(value);
    }
  }

  @override
  Future<AdmobListenerHandle> addListener(String event, void Function(Map<String, Object?> value) callback) async {
    (handlers[event] ??= {}).add(callback);
    return _Handle(() => handlers[event]?.remove(callback));
  }

  @override
  Future<void> initialize({required String maxAdContentRating}) async => _count('initialize');
  @override
  Future<void> setApplicationMuted(bool muted) async => _count('setApplicationMuted');
  @override
  Future<AdmobConsentInfo> requestConsentInfo() async => const AdmobConsentInfo(status: 'NOT_REQUIRED', canRequestAds: true);
  @override
  Future<AdmobConsentInfo> showConsentForm() async => const AdmobConsentInfo(status: 'OBTAINED', canRequestAds: true);
  @override
  Future<void> showPrivacyOptionsForm() async => _count('showPrivacyOptionsForm');
  @override
  Future<void> showBanner({required String adId, required String adSize, required String position, required int margin, required bool isTesting, required bool npa}) async =>
      _count('showBanner');
  @override
  Future<void> removeBanner() async => _count('removeBanner');
  @override
  Future<void> setBannerFrame({required int top, required bool hidden}) async => _count('setBannerFrame');
  @override
  Future<void> prepareInterstitial({required String adId, required bool isTesting, required bool npa}) async {
    _count('prepareInterstitial');
    final gate = prepareInterstitialGate;
    if (gate != null) {
      prepareInterstitialGate = null;
      await gate.future;
    }
  }

  @override
  Future<void> prepareRewardVideoAd({required String adId, required bool isTesting, required bool npa}) async => _count('prepareRewardVideoAd');
  @override
  Future<void> showInterstitial({required String adId}) async => _count('showInterstitial');
  @override
  Future<void> showRewardVideoAd({required String adId}) async => _count('showRewardVideoAd');
  @override
  Future<void> prepareNativeStoryAd({required String adId, required bool isTesting, required bool npa, required bool videoOnly}) async => _count('prepareNativeStoryAd');
  @override
  Future<void> showNativeStoryAd({required String adId}) async => _count('showNativeStoryAd');
  @override
  Future<void> removeNativeStoryAd() async => _count('removeNativeStoryAd');
  @override
  Widget? buildBannerView(BuildContext context) => null;
}

Future<void> waitFor(bool Function() condition) async {
  for (var i = 0; i < 100 && !condition(); i++) {
    await Future<void>.delayed(Duration.zero);
  }
  expect(condition(), isTrue);
}

FullscreenCallbacks callbacks(List<String> log) => FullscreenCallbacks(shown: () => log.add('shown'), impression: () => log.add('impression'), rewarded: () => log.add('rewarded'));

void main() {
  late FakeAdmobSdk sdk;
  setUp(() => sdk = FakeAdmobSdk());

  group('native AdMob lifecycle', () {
    test('ignores late banner callbacks after removal and never initializes before UMP permits ads', () async {
      final adapter = NativeAdmobAdapter(sdk);
      await adapter.consent();
      expect(sdk.count('initialize'), 1);
      final log = <String>[];
      await adapter.showBanner('test-unit', 100, 'test', true,
          BannerCallbacks(loaded: () => log.add('loaded'), size: (_) => log.add('size'), impression: () => log.add('impression'), failed: () => log.add('failed')));
      final late = sdk.handlers[AdmobEvents.bannerLoaded]!.first;
      await adapter.stopBanner();
      late(const {});
      expect(log, isNot(contains('loaded')));
      expect(sdk.handlers.values.every((items) => items.isEmpty), isTrue);
    });

    test('a close event or resolved SDK promise does not grant a rewarded benefit', () async {
      final adapter = NativeAdmobAdapter(sdk);
      await adapter.consent();
      await adapter.prepare('reward-unit', 'test', true, true);
      final log = <String>[];
      final result = adapter.showFullscreen('reward-unit', 'test', true, true, () => true, callbacks(log));
      await waitFor(() => sdk.count('showRewardVideoAd') == 1);
      sdk.emit(AdmobEvents.rewardShowed);
      sdk.emit(AdmobEvents.rewardDismissed);
      expect(await result, (shown: true, rewarded: false));
      expect(log, isNot(contains('rewarded')));
      adapter.reset();
    });

    test('only one earned-reward callback grants the benefit and repeated dismissals settle once', () async {
      final adapter = NativeAdmobAdapter(sdk);
      await adapter.consent();
      await adapter.prepare('reward-unit', 'test', true, true);
      final log = <String>[];
      final result = adapter.showFullscreen('reward-unit', 'test', true, true, () => true, callbacks(log));
      await waitFor(() => sdk.count('showRewardVideoAd') == 1);
      sdk.emit(AdmobEvents.rewardShowed);
      sdk.emit(AdmobEvents.rewardEarned);
      sdk.emit(AdmobEvents.rewardEarned);
      sdk.emit(AdmobEvents.rewardDismissed);
      sdk.emit(AdmobEvents.rewardDismissed);
      expect(await result, (shown: true, rewarded: true));
      expect(log.where((e) => e == 'rewarded'), hasLength(1));
      adapter.reset();
    });

    test('stale preloads after reset are not usable and a last-moment policy change prevents showing', () async {
      final gate = Completer<void>();
      sdk.prepareInterstitialGate = gate;
      final adapter = NativeAdmobAdapter(sdk);
      await adapter.consent();
      final loading = adapter.prepare('interstitial-unit', 'test', true);
      await waitFor(() => sdk.count('prepareInterstitial') == 1);
      adapter.reset();
      gate.complete();
      expect(await loading, isFalse);
      expect(adapter.isPrepared('interstitial-unit', 'test', true), isFalse);
      await adapter.prepare('interstitial-unit', 'test', true);
      final result = await adapter.showFullscreen('interstitial-unit', 'test', true, false, () => false, callbacks([]));
      expect(result.shown, isFalse);
      expect(sdk.count('showInterstitial'), 0);
      adapter.reset();
    });
  });
}
