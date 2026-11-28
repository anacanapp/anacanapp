// Ported from: node_modules/@capacitor-community/admob 8.1.0 with patches/@capacitor-community+admob+8.1.0.patch
//              (AdMob plugin: requestConsentInfo / showConsentForm / showPrivacyOptionsForm (AdConsentExecutor),
//              initialize + setRequestConfiguration, setApplicationMuted, showBanner / removeBanner / setBannerFrame
//              (BannerExecutor), prepare/show Interstitial + RewardVideoAd, the patch's native story ad), the
//              `VITE_ADMOB_*_APP_ID` compiled app id of src/components/ads/AdExperienceProvider.tsx
//
// [AdmobSdk] on google_mobile_ads. Event names, test-unit handling and the order of the plugin are kept: `isTesting`
// swaps in Google's test unit of the format (the plugin's `getAdId(call, testingId)`, with the patch's iOS test
// banner / interstitial ids), `npa` is the AdMob `npa=1` extra, initialize sets the max content rating with no test
// devices (React passes none) and returns without waiting for adapter start-up. The banner is a Flutter [AdWidget] in
// the app's banner dock (services/ads/ad_widgets.dart) instead of a native view over the WebView, so the dock owns
// its position and visibility and `setBannerFrame` has nothing left to move. The native story ad and the build's app
// id come from the app's own channel ([AdmobNativeChannel]: AnacanAdsPlugin.kt / AnacanAdsChannel.swift).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../../domain/ads/ads_config.dart' show AdFormat, AdPlatform, isAppId, testStoryVideoIds, testUnitIds;
import 'admob_adapter.dart';

/// The plugin's default (test) unit for [format] when `isTesting` is set.
String admobTestUnit(AdPlatform platform, AdFormat format, {bool videoOnly = false}) =>
    format == 'native_story' && videoOnly ? testStoryVideoIds[platform]! : testUnitIds[platform]![format]!;

/// UMP `ConsentStatus` as the plugin's string.
String admobConsentStatusName(ConsentStatus status) => switch (status) {
      ConsentStatus.required => 'REQUIRED',
      ConsentStatus.notRequired => 'NOT_REQUIRED',
      ConsentStatus.obtained => 'OBTAINED',
      ConsentStatus.unknown => 'UNKNOWN',
    };

/// `getPrivacyOptionsRequirementStatus().name()`.
String admobPrivacyOptionsName(PrivacyOptionsRequirementStatus status) => switch (status) {
      PrivacyOptionsRequirementStatus.required => 'REQUIRED',
      PrivacyOptionsRequirementStatus.notRequired => 'NOT_REQUIRED',
      PrivacyOptionsRequirementStatus.unknown => 'UNKNOWN',
    };

/// `MaxAdContentRating` of the plugin's initialize options.
String admobMaxContentRating(String rating) => switch (rating) {
      'General' => MaxAdContentRating.g,
      'ParentalGuidance' => MaxAdContentRating.pg,
      'Teen' => MaxAdContentRating.t,
      'MatureAudience' => MaxAdContentRating.ma,
      _ => MaxAdContentRating.unspecified,
    };

/// `RequestHelper.createRequest`: non-personalised ads as the AdMob `npa` extra.
AdRequest admobRequest(bool npa) => npa ? const AdRequest(extras: {'npa': '1'}) : const AdRequest();

/// The app's AdMob channel (`anacan/admob`): the native story ad of the patch and the declared app id.
class AdmobNativeChannel {
  AdmobNativeChannel({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/admob';
  final MethodChannel _channel;

  /// Native → Dart `event {name}` (nativeStoryAdShowed / Impression / Dismissed).
  void setEventHandler(void Function(String name)? onEvent) {
    _channel.setMethodCallHandler(onEvent == null
        ? null
        : (call) async {
            final args = call.arguments;
            final name = args is Map ? args['name'] : null;
            if (call.method == 'event' && name is String) onEvent(name);
          });
  }

  /// The AdMob app id the native configuration declares (manifest meta-data / Info.plist).
  Future<String?> appId() => _channel.invokeMethod<String>('appId');

  Future<void> prepareNativeStoryAd({required String adId, required bool isTesting, required bool npa, required bool videoOnly}) =>
      _channel.invokeMethod<Object?>(
          'prepareNativeStoryAd', <String, Object?>{'adId': adId, 'isTesting': isTesting, 'npa': npa, 'videoOnly': videoOnly});

  Future<void> showNativeStoryAd({required String adId}) => _channel.invokeMethod<void>('showNativeStoryAd', <String, Object?>{'adId': adId});

  Future<void> removeNativeStoryAd() => _channel.invokeMethod<void>('removeNativeStoryAd');
}

/// `VITE_ADMOB_*_APP_ID` of this build, read once from the native configuration (the Codemagic build writes the live
/// id only there, never into a Dart define). Until the answer arrives, or when it is not an app id, the compiled
/// default of [fallback] applies.
class NativeAdmobAppId {
  NativeAdmobAppId(AdmobNativeChannel channel, {required this.fallback}) {
    unawaited(channel.appId().then((value) => _value = value, onError: (Object _) => null));
  }

  final String Function(AdPlatform platform) fallback;
  String? _value;

  String resolve(AdPlatform platform) {
    final value = _value;
    return value != null && isAppId(value) ? value : fallback(platform);
  }
}

class _ListenerHandle implements AdmobListenerHandle {
  _ListenerHandle(this._remove);
  final void Function() _remove;
  @override
  Future<void> remove() async => _remove();
}

/// The plugin's `addListener` / `notifyListeners`.
class AdmobEventBus {
  final Map<String, List<void Function(Map<String, Object?>)>> _listeners = {};

  AdmobListenerHandle add(String event, void Function(Map<String, Object?> value) callback) {
    final list = _listeners[event] ??= <void Function(Map<String, Object?>)>[];
    list.add(callback);
    return _ListenerHandle(() => list.remove(callback));
  }

  void emit(String event, [Map<String, Object?> value = const <String, Object?>{}]) {
    for (final callback in List.of(_listeners[event] ?? const <void Function(Map<String, Object?>)>[])) {
      try {
        callback(value);
      } catch (_) {}
    }
  }

  int count(String event) => _listeners[event]?.length ?? 0;
}

class GoogleMobileAdsSdk implements AdmobSdk {
  GoogleMobileAdsSdk({required this.platform, AdmobNativeChannel? native, this.mobileAds, this.consentInformation})
      : _native = native ?? AdmobNativeChannel() {
    _native.setEventHandler(_events.emit);
  }

  /// 'ios' | 'android'.
  final AdPlatform platform;
  final AdmobNativeChannel _native;

  /// Defaults: the google_mobile_ads singletons.
  final MobileAds? mobileAds;
  final ConsentInformation? consentInformation;
  final AdmobEventBus _events = AdmobEventBus();

  MobileAds get _ads => mobileAds ?? MobileAds.instance;
  ConsentInformation get _consentInfo => consentInformation ?? ConsentInformation.instance;

  final ValueNotifier<({BannerAd ad, double width, double height})?> _shownBanner = ValueNotifier(null);
  BannerAd? _loadingBanner;
  int _bannerGeneration = 0;
  final Map<String, InterstitialAd> _interstitials = {};
  final Map<String, RewardedAd> _rewarded = {};

  String _unit(String adId, bool isTesting, AdFormat format) => isTesting ? admobTestUnit(platform, format) : adId;

  // ── consent (AdConsentExecutor) ──

  Future<AdmobConsentInfo> _info({bool withFormAvailability = true}) async => AdmobConsentInfo(
        status: admobConsentStatusName(await _consentInfo.getConsentStatus()),
        isConsentFormAvailable: withFormAvailability && await _consentInfo.isConsentFormAvailable(),
        canRequestAds: await _consentInfo.canRequestAds(),
        privacyOptionsRequirementStatus: admobPrivacyOptionsName(await _consentInfo.getPrivacyOptionsRequirementStatus()),
      );

  @override
  Future<AdmobConsentInfo> requestConsentInfo() async {
    final updated = Completer<void>();
    _consentInfo.requestConsentInfoUpdate(
      ConsentRequestParameters(),
      () {
        if (!updated.isCompleted) updated.complete();
      },
      (error) {
        if (!updated.isCompleted) updated.completeError(StateError(error.message));
      },
    );
    await updated.future;
    return _info();
  }

  @override
  Future<AdmobConsentInfo> showConsentForm() async {
    final dismissed = Completer<void>();
    await ConsentForm.loadAndShowConsentFormIfRequired((error) {
      if (dismissed.isCompleted) return;
      if (error != null) {
        dismissed.completeError(StateError(error.message));
      } else {
        dismissed.complete();
      }
    });
    await dismissed.future;
    // The plugin's showConsentForm answer has no isConsentFormAvailable.
    return _info(withFormAvailability: false);
  }

  @override
  Future<void> showPrivacyOptionsForm() async {
    final dismissed = Completer<void>();
    await ConsentForm.showPrivacyOptionsForm((error) {
      if (dismissed.isCompleted) return;
      if (error != null) {
        dismissed.completeError(StateError(error.message));
      } else {
        dismissed.complete();
      }
    });
    await dismissed.future;
  }

  // ── app settings ──

  @override
  Future<void> initialize({required String maxAdContentRating}) async {
    await _ads.updateRequestConfiguration(
        RequestConfiguration(maxAdContentRating: admobMaxContentRating(maxAdContentRating), testDeviceIds: const <String>[]));
    // The plugin resolves right after MobileAds.initialize(); requests queue until the adapters are ready.
    unawaited(_ads.initialize().then((_) {}, onError: (Object _) {}));
  }

  @override
  Future<void> setApplicationMuted(bool muted) => _ads.setAppMuted(muted);

  @override
  Future<AdmobListenerHandle> addListener(String event, void Function(Map<String, Object?> value) callback) async =>
      _events.add(event, callback);

  // ── banner ──

  /// The banner dock's width (services/ads/ad_widgets.dart): 320 inline, otherwise min(728, screen − 16).
  int _bannerWidth(bool inline) {
    double screen = 390;
    try {
      final view = WidgetsBinding.instance.platformDispatcher.views.first;
      screen = view.physicalSize.width / view.devicePixelRatio;
    } catch (_) {}
    return math.max(0, inline ? math.min(320.0, screen - 16) : math.min(728.0, screen - 16)).truncate();
  }

  void _disposeLater(BannerAd ad) {
    // The dock drops the AdWidget on the next frame; release the platform view after it (or soon, when no frame
    // comes, e.g. in the background).
    var done = false;
    void dispose() {
      if (done) return;
      done = true;
      unawaited(ad.dispose().catchError((Object _) {}));
    }

    SchedulerBinding.instance.addPostFrameCallback((_) => dispose());
    Timer(const Duration(milliseconds: 500), dispose);
  }

  @override
  Future<void> showBanner({
    required String adId,
    required String adSize,
    required String position,
    required int margin,
    required bool isTesting,
    required bool npa,
  }) async {
    await removeBanner(notify: false);
    final generation = ++_bannerGeneration;
    final inline = adSize == 'BANNER';
    AdSize size = AdSize.banner;
    if (!inline) {
      // The plugin's ADAPTIVE_BANNER (Android getCurrentOrientationAnchoredAdaptiveBannerAdSize, iOS
      // currentOrientationAnchoredAdaptiveBanner); the "large" replacement would change the banner height.
      // ignore: deprecated_member_use
      size = await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(_bannerWidth(false)) ?? AdSize.banner;
    }
    if (generation != _bannerGeneration) return;
    final ad = BannerAd(
      adUnitId: _unit(adId, isTesting, 'banner'),
      size: size,
      request: admobRequest(npa),
      listener: BannerAdListener(
        onAdLoaded: (loaded) async {
          if (generation != _bannerGeneration || !identical(loaded, _loadingBanner)) return;
          _loadingBanner = null;
          final banner = loaded as BannerAd;
          AdSize? actual;
          try {
            actual = await banner.getPlatformAdSize();
          } catch (_) {}
          if (generation != _bannerGeneration) {
            unawaited(banner.dispose().catchError((Object _) {}));
            return;
          }
          final width = (actual ?? size).width.toDouble(), height = (actual ?? size).height.toDouble();
          _shownBanner.value = (ad: banner, width: width, height: height);
          _events.emit(AdmobEvents.bannerSizeChanged, {'width': width, 'height': height});
          _events.emit(AdmobEvents.bannerLoaded);
        },
        onAdFailedToLoad: (failed, error) {
          // A replaced / removed banner was already disposed by removeBanner.
          if (generation != _bannerGeneration || !identical(failed, _loadingBanner)) return;
          _loadingBanner = null;
          unawaited(failed.dispose().catchError((Object _) {}));
          _events.emit(AdmobEvents.bannerSizeChanged, const {'width': 0, 'height': 0});
          _events.emit(AdmobEvents.bannerFailedToLoad, {'code': error.code, 'message': error.message});
        },
        onAdImpression: (shown) {
          if (identical(_shownBanner.value?.ad, shown)) _events.emit(AdmobEvents.bannerImpression);
        },
      ),
    );
    _loadingBanner = ad;
    await ad.load();
  }

  @override
  Future<void> removeBanner({bool notify = true}) async {
    _bannerGeneration++;
    final loading = _loadingBanner;
    _loadingBanner = null;
    if (loading != null) unawaited(loading.dispose().catchError((Object _) {}));
    final shown = _shownBanner.value;
    if (shown == null) return;
    _shownBanner.value = null;
    _disposeLater(shown.ad);
    if (notify) _events.emit(AdmobEvents.bannerSizeChanged, const {'width': 0, 'height': 0});
  }

  /// The dock positions and hides the Flutter banner itself.
  @override
  Future<void> setBannerFrame({required int top, required bool hidden}) async {}

  @override
  Widget? buildBannerView(BuildContext context) => ValueListenableBuilder<({BannerAd ad, double width, double height})?>(
        valueListenable: _shownBanner,
        builder: (context, banner, _) => banner == null
            ? const SizedBox.shrink()
            : Center(
                child: SizedBox(
                  width: banner.width,
                  height: banner.height,
                  child: AdWidget(key: ObjectKey(banner.ad), ad: banner.ad),
                ),
              ),
      );

  // ── interstitial / rewarded ──

  @override
  Future<void> prepareInterstitial({required String adId, required bool isTesting, required bool npa}) {
    final loaded = Completer<void>();
    unawaited(InterstitialAd.load(
      adUnitId: _unit(adId, isTesting, 'interstitial'),
      request: admobRequest(npa),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          final previous = _interstitials[adId];
          _interstitials[adId] = ad;
          if (previous != null) unawaited(previous.dispose().catchError((Object _) {}));
          if (!loaded.isCompleted) loaded.complete();
        },
        onAdFailedToLoad: (error) {
          if (!loaded.isCompleted) loaded.completeError(StateError(error.message));
        },
      ),
    ).catchError((Object error) {
      if (!loaded.isCompleted) loaded.completeError(error);
    }));
    return loaded.future;
  }

  @override
  Future<void> prepareRewardVideoAd({required String adId, required bool isTesting, required bool npa}) {
    final loaded = Completer<void>();
    unawaited(RewardedAd.load(
      adUnitId: _unit(adId, isTesting, 'rewarded'),
      request: admobRequest(npa),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          final previous = _rewarded[adId];
          _rewarded[adId] = ad;
          if (previous != null) unawaited(previous.dispose().catchError((Object _) {}));
          if (!loaded.isCompleted) loaded.complete();
        },
        onAdFailedToLoad: (error) {
          if (!loaded.isCompleted) loaded.completeError(StateError(error.message));
        },
      ),
    ).catchError((Object error) {
      if (!loaded.isCompleted) loaded.completeError(error);
    }));
    return loaded.future;
  }

  FullScreenContentCallback<T> _fullscreen<T extends Ad>(
          {required String showed, required String impression, required String dismissed, required String failed}) =>
      FullScreenContentCallback<T>(
        onAdShowedFullScreenContent: (_) => _events.emit(showed),
        onAdImpression: (_) => _events.emit(impression),
        onAdDismissedFullScreenContent: (ad) {
          unawaited(ad.dispose().catchError((Object _) {}));
          _events.emit(dismissed);
        },
        onAdFailedToShowFullScreenContent: (ad, error) {
          unawaited(ad.dispose().catchError((Object _) {}));
          _events.emit(failed, {'code': error.code, 'message': error.message});
        },
      );

  @override
  Future<void> showInterstitial({required String adId}) async {
    final ad = _interstitials.remove(adId);
    if (ad == null) throw StateError('No Interstitial can be shown. It was not prepared or maybe it failed to be prepared.');
    ad.fullScreenContentCallback = _fullscreen<InterstitialAd>(
      showed: AdmobEvents.interstitialShowed,
      impression: AdmobEvents.interstitialImpression,
      dismissed: AdmobEvents.interstitialDismissed,
      failed: AdmobEvents.interstitialFailedToShow,
    );
    await ad.show();
  }

  @override
  Future<void> showRewardVideoAd({required String adId}) async {
    final ad = _rewarded.remove(adId);
    if (ad == null) throw StateError('No Reward Video Ad can be shown. It was not prepared or maybe it failed to be prepared.');
    ad.fullScreenContentCallback = _fullscreen<RewardedAd>(
      showed: AdmobEvents.rewardShowed,
      impression: AdmobEvents.rewardImpression,
      dismissed: AdmobEvents.rewardDismissed,
      failed: AdmobEvents.rewardFailedToShow,
    );
    await ad.show(onUserEarnedReward: (_, reward) => _events.emit(AdmobEvents.rewardEarned, {'type': reward.type, 'amount': reward.amount}));
  }

  // ── native story (the patch's NativeStoryExecutor, through the app channel) ──

  @override
  Future<void> prepareNativeStoryAd({required String adId, required bool isTesting, required bool npa, required bool videoOnly}) =>
      _native.prepareNativeStoryAd(adId: adId, isTesting: isTesting, npa: npa, videoOnly: videoOnly);

  @override
  Future<void> showNativeStoryAd({required String adId}) => _native.showNativeStoryAd(adId: adId);

  @override
  Future<void> removeNativeStoryAd() => _native.removeNativeStoryAd();
}
