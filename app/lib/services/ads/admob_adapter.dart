// Ported from: src/lib/ads/native.ts (NativeAdmobAdapter over @capacitor-community/admob + the app's native story
//              ad extension)
//
// The lifecycle rules around the AdMob SDK: UMP before initialize, one banner generation at a time (late
// callbacks of a removed banner are ignored), bounded loads, one full-screen presentation at a time, an earned
// reward granted once and only on the SDK's reward signal, preloads invalidated by [reset]. The SDK itself is
// [AdmobSdk]: google_mobile_ads_sdk.dart in the iOS / Android app (services/analytics/sdk_wiring.dart); elsewhere
// [admobSdkProvider] stays null and the app behaves like React without the AdMob plugin (`hasNativeAdmob() === false`).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/ads/ads_config.dart' show AdMode;

class AdmobConsentInfo {
  const AdmobConsentInfo({required this.status, this.isConsentFormAvailable = false, required this.canRequestAds, this.privacyOptionsRequirementStatus = 'NOT_REQUIRED'});

  /// 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED' | 'UNKNOWN'.
  final String status;
  final bool isConsentFormAvailable;
  final bool canRequestAds;

  /// 'REQUIRED' | 'NOT_REQUIRED' | 'UNKNOWN'.
  final String privacyOptionsRequirementStatus;
}

abstract interface class AdmobListenerHandle {
  Future<void> remove();
}

/// Event names of [AdmobSdk.addListener] (banner / interstitial / rewarded / native story).
abstract final class AdmobEvents {
  static const bannerLoaded = 'bannerAdLoaded';
  static const bannerSizeChanged = 'bannerAdSizeChanged';
  static const bannerImpression = 'bannerAdImpression';
  static const bannerFailedToLoad = 'bannerAdFailedToLoad';
  static const interstitialShowed = 'interstitialAdShowed';
  static const interstitialImpression = 'interstitialAdImpression';
  static const interstitialDismissed = 'interstitialAdDismissed';
  static const interstitialFailedToShow = 'interstitialAdFailedToShow';
  static const rewardShowed = 'onRewardedVideoAdShowed';
  static const rewardImpression = 'onRewardedVideoAdImpression';
  static const rewardDismissed = 'onRewardedVideoAdDismissed';
  static const rewardFailedToShow = 'onRewardedVideoAdFailedToShow';
  static const rewardEarned = 'onRewardedVideoAdReward';
  static const storyShowed = 'nativeStoryAdShowed';
  static const storyImpression = 'nativeStoryAdImpression';
  static const storyDismissed = 'nativeStoryAdDismissed';
  static const storyFailedToShow = 'nativeStoryAdFailedToShow';
}

/// The AdMob + UMP SDK surface the adapter drives (`@capacitor-community/admob` + the native story extension).
/// A Flutter implementation (google_mobile_ads) maps its per-ad callbacks onto these events and renders the
/// banner through [buildBannerView] inside the app's banner dock.
abstract interface class AdmobSdk {
  Future<AdmobConsentInfo> requestConsentInfo();
  Future<AdmobConsentInfo> showConsentForm();
  Future<void> showPrivacyOptionsForm();
  Future<void> initialize({required String maxAdContentRating});
  Future<void> setApplicationMuted(bool muted);
  Future<AdmobListenerHandle> addListener(String event, void Function(Map<String, Object?> value) callback);

  /// `adSize`: 'ADAPTIVE_BANNER' | 'BANNER'; `position`: 'TOP_CENTER' | 'BOTTOM_CENTER'.
  Future<void> showBanner({required String adId, required String adSize, required String position, required int margin, required bool isTesting, required bool npa});
  Future<void> removeBanner();
  Future<void> setBannerFrame({required int top, required bool hidden});
  Future<void> prepareInterstitial({required String adId, required bool isTesting, required bool npa});
  Future<void> prepareRewardVideoAd({required String adId, required bool isTesting, required bool npa});
  Future<void> showInterstitial({required String adId});
  Future<void> showRewardVideoAd({required String adId});
  Future<void> prepareNativeStoryAd({required String adId, required bool isTesting, required bool npa, required bool videoOnly});
  Future<void> showNativeStoryAd({required String adId});
  Future<void> removeNativeStoryAd();

  /// The loaded banner as a widget (null when the SDK draws it natively over the app).
  Widget? buildBannerView(BuildContext context);
}

class NativeConsent {
  const NativeConsent({required this.canRequestAds, required this.privacyOptionsRequired});
  final bool canRequestAds;
  final bool privacyOptionsRequired;
  static const NativeConsent none = NativeConsent(canRequestAds: false, privacyOptionsRequired: false);
}

class BannerCallbacks {
  const BannerCallbacks({required this.loaded, required this.size, required this.impression, required this.failed});
  final void Function() loaded;
  final void Function(double height) size;
  final void Function() impression;
  final void Function() failed;
}

class FullscreenCallbacks {
  const FullscreenCallbacks({required this.shown, required this.impression, required this.rewarded});
  final void Function() shown;
  final void Function() impression;
  final void Function() rewarded;
}

typedef FullscreenResult = ({bool shown, bool rewarded});

const FullscreenResult _notShown = (shown: false, rewarded: false);

/// `NativeAdmobAdapter`.
class NativeAdmobAdapter {
  NativeAdmobAdapter(this.sdk, {this.loadTimeout = const Duration(seconds: 15), int Function()? now})
      : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final AdmobSdk sdk;
  final Duration loadTimeout;
  final int Function() _now;

  bool _initialized = false;
  bool _touched = false;
  int _bannerGeneration = 0;
  List<AdmobListenerHandle> _bannerHandles = <AdmobListenerHandle>[];
  Future<void> _bannerQueue = Future<void>.value();
  Timer? _bannerTimeout;
  final Map<String, int> _prepared = <String, int>{};
  final Map<String, Future<bool>> _preparing = <String, Future<bool>>{};
  int _loadGeneration = 0;
  void Function()? _activePresentation;
  final Map<String, int> _storyReady = <String, int>{};
  final Map<String, Future<bool>> _storyLoading = <String, Future<bool>>{};

  Future<T> _bounded<T>(Future<T> future) => future.timeout(loadTimeout, onTimeout: () => throw TimeoutException('admob_timeout'));

  Future<NativeConsent> consent({bool showForm = true}) async {
    _touched = true;
    var info = await _bounded(sdk.requestConsentInfo());
    if (showForm && info.status == 'REQUIRED' && info.isConsentFormAvailable) info = await sdk.showConsentForm();
    if (info.canRequestAds && !_initialized) {
      await _bounded(sdk.initialize(maxAdContentRating: 'General'));
      await sdk.setApplicationMuted(true);
      _initialized = true;
    }
    return NativeConsent(canRequestAds: info.canRequestAds, privacyOptionsRequired: info.privacyOptionsRequirementStatus == 'REQUIRED');
  }

  Future<NativeConsent> privacyOptions() async {
    await stopBanner();
    _touched = true;
    await sdk.showPrivacyOptionsForm();
    return consent(showForm: false);
  }

  Future<void> _clearBanner() async {
    _bannerTimeout?.cancel();
    final handles = _bannerHandles;
    _bannerHandles = <AdmobListenerHandle>[];
    await Future.wait(handles.map((h) => h.remove().catchError((Object _) {})));
    if (_touched) {
      try {
        await sdk.removeBanner();
      } catch (_) {}
    }
  }

  Future<void> stopBanner() {
    _bannerGeneration++;
    final stop = _bannerQueue.catchError((Object _) {}).then((_) => _clearBanner());
    _bannerQueue = stop;
    return stop;
  }

  Future<void> showBanner(String unit, double margin, AdMode mode, bool npa, BannerCallbacks callbacks, {bool top = false, bool inline = false}) {
    final generation = ++_bannerGeneration;
    final show = _bannerQueue.catchError((Object _) {}).then((_) async {
      await _clearBanner();
      if (generation != _bannerGeneration) return;
      _touched = true;
      if (generation != _bannerGeneration || !_initialized) return;
      var loaded = false;
      bool current() => generation == _bannerGeneration;
      _bannerHandles = await Future.wait([
        sdk.addListener(AdmobEvents.bannerLoaded, (_) {
          if (current()) {
            loaded = true;
            _bannerTimeout?.cancel();
            callbacks.loaded();
          }
        }),
        sdk.addListener(AdmobEvents.bannerSizeChanged, (value) {
          final height = value['height'];
          if (current() && height is num) callbacks.size(height.toDouble().clamp(0, 150));
        }),
        sdk.addListener(AdmobEvents.bannerImpression, (_) {
          if (current()) callbacks.impression();
        }),
        sdk.addListener(AdmobEvents.bannerFailedToLoad, (_) {
          if (current()) {
            _bannerTimeout?.cancel();
            callbacks.failed();
          }
        }),
      ]);
      if (!current()) {
        await _clearBanner();
        return;
      }
      _bannerTimeout = Timer(loadTimeout, () {
        if (current() && !loaded) {
          callbacks.failed();
          unawaited(stopBanner());
        }
      });
      try {
        await sdk.showBanner(
          adId: unit,
          adSize: inline ? 'BANNER' : 'ADAPTIVE_BANNER',
          position: top ? 'TOP_CENTER' : 'BOTTOM_CENTER',
          margin: margin < 0 ? 0 : margin.round(),
          isTesting: mode == 'test',
          npa: npa,
        );
      } catch (_) {
        if (current()) {
          callbacks.failed();
          await _clearBanner();
        }
      }
    });
    _bannerQueue = show;
    return show;
  }

  Future<void> positionBanner(double top, bool hidden) async {
    if (!_touched) return;
    await sdk.setBannerFrame(top: top < 0 ? 0 : top.round(), hidden: hidden);
  }

  String _adKey(String unit, AdMode mode, bool npa, bool rewarded) => '${rewarded ? 'reward' : 'interstitial'}:$mode:$npa:$unit';

  bool isPrepared(String unit, AdMode mode, bool npa, [bool rewarded = false]) {
    final time = _prepared[_adKey(unit, mode, npa, rewarded)];
    return time != null && _now() - time < 50 * 60000;
  }

  bool isPreparing(String unit, AdMode mode, bool npa, [bool rewarded = false]) => _preparing.containsKey(_adKey(unit, mode, npa, rewarded));

  Future<bool> prepare(String unit, AdMode mode, bool npa, [bool rewarded = false]) {
    final key = _adKey(unit, mode, npa, rewarded);
    if (isPrepared(unit, mode, npa, rewarded)) return Future<bool>.value(true);
    final pending = _preparing[key];
    if (pending != null) return pending;
    final generation = _loadGeneration;
    final future = () async {
      if (!_initialized) return false;
      _touched = true;
      try {
        await _bounded(rewarded
            ? sdk.prepareRewardVideoAd(adId: unit, isTesting: mode == 'test', npa: npa)
            : sdk.prepareInterstitial(adId: unit, isTesting: mode == 'test', npa: npa));
        if (generation != _loadGeneration) return false;
        _prepared[key] = _now();
        return true;
      } catch (_) {
        return false;
      }
    }();
    _preparing[key] = future;
    unawaited(future.whenComplete(() {
      if (identical(_preparing[key], future)) _preparing.remove(key);
    }));
    return future;
  }

  Future<List<AdmobListenerHandle>> _subscribe(List<(String, void Function(Map<String, Object?>))> events, bool Function() settled) async {
    final handles = <AdmobListenerHandle>[];
    for (final (event, callback) in events) {
      final handle = await sdk.addListener(event, callback);
      if (settled()) {
        await handle.remove();
      } else {
        handles.add(handle);
      }
    }
    return handles;
  }

  Future<FullscreenResult> showFullscreen(String unit, AdMode mode, bool npa, bool rewarded, bool Function() allowed, FullscreenCallbacks callbacks) async {
    if (_activePresentation != null || !isPrepared(unit, mode, npa, rewarded)) return _notShown;
    if (_activePresentation != null || !allowed()) return _notShown;
    final completer = Completer<FullscreenResult>();
    var shown = false, earned = false, settled = false;
    final handles = <AdmobListenerHandle>[];
    Timer? timer;
    void finish([Object? _]) {
      if (settled) return;
      settled = true;
      timer?.cancel();
      _activePresentation = null;
      for (final h in handles) {
        unawaited(h.remove().catchError((Object _) {}));
      }
      completer.complete((shown: shown, rewarded: earned));
    }

    _activePresentation = finish;
    unawaited(() async {
      try {
        handles.addAll(await _subscribe([
          (
            rewarded ? AdmobEvents.rewardShowed : AdmobEvents.interstitialShowed,
            (_) {
              if (!settled) {
                shown = true;
                timer?.cancel();
                callbacks.shown();
              }
            }
          ),
          (
            rewarded ? AdmobEvents.rewardImpression : AdmobEvents.interstitialImpression,
            (_) {
              if (!settled) callbacks.impression();
            }
          ),
          (rewarded ? AdmobEvents.rewardDismissed : AdmobEvents.interstitialDismissed, finish),
          (rewarded ? AdmobEvents.rewardFailedToShow : AdmobEvents.interstitialFailedToShow, finish),
          if (rewarded)
            (
              AdmobEvents.rewardEarned,
              (_) {
                if (!settled && !earned) {
                  earned = true;
                  callbacks.rewarded();
                }
              }
            ),
        ], () => settled));
        if (!allowed() || settled) {
          finish();
          return;
        }
        _prepared.remove(_adKey(unit, mode, npa, rewarded));
        timer = Timer(loadTimeout, finish); // Once shown, dismissal owns completion.
        final show = rewarded ? sdk.showRewardVideoAd(adId: unit) : sdk.showInterstitial(adId: unit);
        unawaited(show.catchError(finish));
      } catch (_) {
        finish();
      }
    }());
    return completer.future;
  }

  void reset() {
    _loadGeneration++;
    _prepared.clear();
    _storyReady.clear();
    _activePresentation?.call();
    unawaited(stopBanner());
    if (_touched) unawaited(sdk.removeNativeStoryAd().catchError((Object _) {}));
  }

  bool isStoryPrepared(String unit, bool videoOnly) {
    final time = _storyReady['$unit:$videoOnly'];
    return time != null && _now() - time < 50 * 60000;
  }

  bool isStoryPreparing(String unit, bool videoOnly) => _storyLoading.containsKey('$unit:$videoOnly');

  Future<bool> prepareStory(String unit, AdMode mode, bool npa, bool videoOnly) {
    final key = '$unit:$videoOnly';
    if (isStoryPrepared(unit, videoOnly)) return Future<bool>.value(true);
    final pending = _storyLoading[key];
    if (pending != null) return pending;
    final generation = _loadGeneration;
    final future = () async {
      if (!_initialized) return false;
      _touched = true;
      try {
        await _bounded(sdk.prepareNativeStoryAd(adId: unit, isTesting: mode == 'test', npa: npa, videoOnly: videoOnly));
        if (generation != _loadGeneration) return false;
        _storyReady[key] = _now();
        return true;
      } catch (_) {
        return false;
      }
    }();
    _storyLoading[key] = future;
    unawaited(future.whenComplete(() {
      if (identical(_storyLoading[key], future)) _storyLoading.remove(key);
    }));
    return future;
  }

  Future<FullscreenResult> showStory(String unit, bool videoOnly, bool Function() allowed, FullscreenCallbacks callbacks) async {
    if (!isStoryPrepared(unit, videoOnly) || _activePresentation != null || !allowed()) return _notShown;
    if (!allowed() || _activePresentation != null) return _notShown;
    final completer = Completer<FullscreenResult>();
    var shown = false, done = false;
    final handles = <AdmobListenerHandle>[];
    Timer? timeout;
    void finish([Object? _]) {
      if (done) return;
      done = true;
      timeout?.cancel();
      _activePresentation = null;
      for (final h in handles) {
        unawaited(h.remove().catchError((Object _) {}));
      }
      completer.complete((shown: shown, rewarded: false));
    }

    _activePresentation = finish;
    unawaited(() async {
      try {
        handles.addAll(await _subscribe([
          (
            AdmobEvents.storyShowed,
            (_) {
              if (!done) {
                shown = true;
                timeout?.cancel();
                callbacks.shown();
              }
            }
          ),
          (
            AdmobEvents.storyImpression,
            (_) {
              if (!done) callbacks.impression();
            }
          ),
          (AdmobEvents.storyDismissed, finish),
          (AdmobEvents.storyFailedToShow, finish),
        ], () => done));
        if (!allowed() || done) {
          finish();
          return;
        }
        _storyReady.remove('$unit:$videoOnly');
        timeout = Timer(loadTimeout, finish);
        unawaited(sdk.showNativeStoryAd(adId: unit).catchError(finish));
      } catch (_) {
        finish();
      }
    }());
    return completer.future;
  }

  Widget? buildBannerView(BuildContext context) => sdk.buildBannerView(context);
}

/// The native AdMob SDK binding (`GoogleMobileAdsSdk` on iOS / Android). Null = no AdMob SDK (web, tests).
final admobSdkProvider = Provider<AdmobSdk?>((ref) => null);
