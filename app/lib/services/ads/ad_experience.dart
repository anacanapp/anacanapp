// Ported from: src/components/ads/AdExperienceProvider.tsx (the provider's state and effects: surfaces, safety
//              blocks, policy contexts, ledger, UMP consent attempt, banner display session, full-screen preloads,
//              present(), admin demo preview, cadence opportunities, privacy options)
//
// [AdExperienceController] is `useAdExperience()`. The host widget (ad_widgets.dart) feeds it the layout the
// React provider read from the DOM (blocking overlays, keyboard focus, bottom nav, inline anchors, foreground,
// online); Riverpod feeds auth, subscription, timers/white noise, privacy consent and the configuration query.
// Without an AdMob SDK ([adapter] null) real modes resolve to `unsupported` and demo mode to `demo_only`, so no
// ad is requested or drawn — React's behaviour without the AdMob plugin.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

import '../../domain/ads/ads_cadence.dart';
import '../../domain/ads/ads_config.dart';
import '../../domain/ads/ads_policy.dart';
import '../../state/local_store.dart';
import 'admob_adapter.dart';
import 'ads_api.dart';
import 'ads_storage.dart';

class AdPreview {
  const AdPreview({this.enabled = false, this.platform = 'ios', this.premium = false, this.fast = true});
  final bool enabled;
  final AdPlatform platform;
  final bool premium;
  final bool fast;

  AdPreview copyWith({bool? enabled}) => AdPreview(enabled: enabled ?? this.enabled, platform: platform, premium: premium, fast: fast);
  static const AdPreview none = AdPreview();
}

const AdDecision kInactiveAdDecision = AdDecision(allowed: false, reason: 'configuration', waitSeconds: 0, mode: 'demo', adUnitId: null);

class AdAnchorRect {
  const AdAnchorRect({required this.top, required this.height, required this.visible});
  final double top;
  final double height;
  final bool visible;

  @override
  bool operator ==(Object other) => other is AdAnchorRect && other.top == top && other.height == height && other.visible == visible;
  @override
  int get hashCode => Object.hash(top, height, visible);
}

/// `layoutState()`.
class AdLayout {
  const AdLayout({
    this.blocked = false,
    this.allowed = const <String>[],
    this.bottom = 8,
    this.safeBottom = 0,
    this.safeTop = 0,
    this.viewportHeight = 800,
    this.anchors = const <String, AdAnchorRect>{},
    this.foreground = true,
    this.online = true,
  });
  final bool blocked;
  final List<String> allowed;
  final double bottom;
  final double safeBottom;
  final double safeTop;
  final double viewportHeight;
  final Map<String, AdAnchorRect> anchors;
  final bool foreground;
  final bool online;

  @override
  bool operator ==(Object other) =>
      other is AdLayout &&
      other.blocked == blocked &&
      listEquals(other.allowed, allowed) &&
      other.bottom == bottom &&
      other.safeBottom == safeBottom &&
      other.safeTop == safeTop &&
      other.viewportHeight == viewportHeight &&
      mapEquals(other.anchors, anchors) &&
      other.foreground == foreground &&
      other.online == online;
  @override
  int get hashCode => Object.hash(blocked, Object.hashAll(allowed), bottom, safeBottom, safeTop, viewportHeight, foreground, online, anchors.length);
}

/// The state the banner dock renders.
class AdBannerState {
  const AdBannerState({required this.id, required this.mode, required this.height, required this.loaded, required this.key});
  final String id;
  final AdMode mode;
  final double height;
  final bool loaded;
  final String key;
  AdBannerState copyWith({double? height, bool? loaded}) => AdBannerState(id: id, mode: mode, height: height ?? this.height, loaded: loaded ?? this.loaded, key: key);
}

class AdDemoPresentation {
  const AdDemoPresentation({required this.id, required this.minutes, required this.finish});
  final String id;
  final int minutes;
  final void Function(bool rewarded) finish;
}

/// Inputs from auth / subscription / stores.
class AdExperienceInputs {
  const AdExperienceInputs({
    this.userId,
    this.isAdmin = false,
    this.isPremium = false,
    this.entitlementReady = false,
    this.hasActiveTimer = false,
    this.hasActiveAudio = false,
    this.personalizedAdsAllowed = false,
  });
  final String? userId;
  final bool isAdmin;
  final bool isPremium;
  final bool entitlementReady;
  final bool hasActiveTimer;
  final bool hasActiveAudio;
  final bool personalizedAdsAllowed;
}

/// Static environment of the controller.
class AdExperienceEnv {
  const AdExperienceEnv({
    required this.api,
    required this.store,
    required this.platform,
    required this.native,
    required this.compiledAppId,
    required this.appVersion,
    required this.newId,
    this.adapter,
    this.azure = false,
    this.onPrivacyUnavailable,
    this.now,
  });
  final AdsApi api;
  final LocalStore store;

  /// 'ios' | 'android' (real platform).
  final AdPlatform platform;

  /// `Capacitor.isNativePlatform()`.
  final bool native;

  /// `VITE_ADMOB_IOS_APP_ID` / `VITE_ADMOB_ANDROID_APP_ID` (or Google's test app ids).
  final String Function(AdPlatform platform) compiledAppId;
  final Future<String> Function() appVersion;
  final String Function() newId;

  /// The native adapter (null = `hasNativeAdmob() === false`).
  final NativeAdmobAdapter? adapter;
  final bool azure;
  final VoidCallback? onPrivacyUnavailable;
  final int Function()? now;
}

class _Surface {
  _Surface(this.token, this.id, this.startedAt);
  final String token;
  final String id;
  final int startedAt;
}

class _Block {
  _Block(this.id, this.allow);
  final String id;

  /// null = a forced block (`useAdSafetyBlock`), else the `data-ad-allow` list of an overlay.
  final Set<String>? allow;
}

const Duration kAdmobConfigPoll = Duration(minutes: 30);
const Duration kAdmobConfigStale = Duration(seconds: 60);
const Duration kAdmobConfigFresh = Duration(minutes: 35);

/// In-memory stand-in for the sessionStorage preview key (`anacan.ads.admin-preview.v1`).
final Map<String, Object?> _previewSession = <String, Object?>{};

class AdExperienceController extends ChangeNotifier {
  AdExperienceController(this.env) {
    _session = (id: env.newId(), startedAt: _now(), userId: null);
    _tick = _now();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      _tick = _now();
      _reconcile();
      final clock = _tick ~/ 30000;
      if (clock != _consumerClock) {
        _consumerClock = clock;
        _notify();
      }
    });
    final adapter = env.adapter;
    if (adapter != null) {
      unawaited(adapter.stopBanner().catchError((Object _) {}));
      unawaited(env.appVersion().then((v) {
        if (_mounted) {
          _nativeVersion = v;
          _reconcile();
          _notify();
        }
      }, onError: (Object _) {}));
    }
  }

  final AdExperienceEnv env;
  int _now() => (env.now ?? () => DateTime.now().millisecondsSinceEpoch)();

  late Timer _timer;
  bool _mounted = true;
  int _epoch = 0;
  int _tick = 0;
  int _consumerClock = 0;
  String _nativeVersion = '0';
  late ({String id, int startedAt, String? userId}) _session;

  AdExperienceInputs _inputs = const AdExperienceInputs();
  AdsConfiguration? _configData;
  bool _configError = false;
  int _configUpdatedAt = 0;
  AdLayout _layout = const AdLayout();
  final List<_Surface> _surfaces = <_Surface>[];
  final List<_Block> _blocks = <_Block>[];
  NativeConsent _consent = NativeConsent.none;
  bool _busy = false;
  AdBannerState? _banner;
  AdDemoPresentation? _demo;
  AdPreview _preview = AdPreview.none;
  bool _previewRequested = false;
  bool _previewProof = false;
  Timer? _previewTimer;
  String _consentAttempt = '';
  final Map<String, int> _backoff = <String, int>{};
  final Map<AdMode, AdLedger> _ledgerCache = <AdMode, AdLedger>{};
  final Map<String, AdCadence> _cadences = <String, AdCadence>{};
  ({String key, int top, bool hidden})? _positioned;

  // ── public surface (`useAdExperience()`) ──

  bool get nativeAvailable => env.adapter != null;
  NativeConsent get consent => _consent;
  bool get busy => _busy;
  AdBannerState? get banner => _banner;
  AdDemoPresentation? get demo => _demo;
  AdLayout get layout => _layout;
  AdPreview get preview => _effectivePreview;
  AdPreview get requestedPreview => _preview;

  /// The fresh configuration, or null (missing, errored, or unconfirmed for > 35 min: no new ads).
  AdsConfiguration? get configuration => !_configError && _tick - _configUpdatedAt < kAdmobConfigFresh.inMilliseconds ? _configData : null;

  AdMode get mode => _effectivePreview.enabled ? 'demo' : configuration?.settings.mode ?? 'demo';
  int get pauseUntil => _getLedger(mode).pauseUntil;
  String? get bannerId => _banner?.loaded == true ? _banner!.id : null;

  bool get _demoAllowed => _inputs.userId != null && _inputs.isAdmin && _previewRequested && _previewProof;
  AdPreview get _effectivePreview => _preview.copyWith(enabled: _preview.enabled && _demoAllowed);

  bool get _forced => _inputs.hasActiveTimer || _inputs.hasActiveAudio || _blocks.any((b) => b.allow == null);
  bool get _protectedBlocked => _layout.blocked || _forced;
  List<String> get _protectedAllowed => _forced ? const <String>[] : _layout.allowed;

  bool _notifyScheduled = false;

  /// Listeners rebuild widgets; a change made while the tree builds (a surface registered in `initState`) is
  /// delivered after the frame.
  void _notify() {
    if (!_mounted) return;
    final phase = SchedulerBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.persistentCallbacks || phase == SchedulerPhase.midFrameMicrotasks) {
      if (_notifyScheduled) return;
      _notifyScheduled = true;
      SchedulerBinding.instance.addPostFrameCallback((_) {
        _notifyScheduled = false;
        if (_mounted) notifyListeners();
      });
      return;
    }
    notifyListeners();
  }

  // ── inputs ──

  void updateInputs(AdExperienceInputs next) {
    final previous = _inputs;
    _inputs = next;
    if (previous.userId != next.userId || previous.isAdmin != next.isAdmin) _resetSession();
    _reconcile();
    _notify();
  }

  void updateConfiguration({required AdsConfiguration? data, required bool isError, required int dataUpdatedAt}) {
    _configData = data;
    _configError = isError;
    _configUpdatedAt = dataUpdatedAt;
    _tick = _now();
    _reconcile();
    _notify();
  }

  void updateLayout(AdLayout next) {
    if (next == _layout) return;
    _layout = next;
    _reconcile();
    _notify();
  }

  void _resetSession() {
    _epoch++;
    env.adapter?.reset();
    _banner = null;
    _bannerEffect?.cancel();
    _bannerEffect = null;
    _bannerEffectKey = null;
    _setBusy(false);
    _consentAttempt = '';
    _session = (id: env.newId(), startedAt: _now(), userId: _inputs.userId);
    _ledgerCache.clear();
    _cadences.clear();
    _demo?.finish(false);
    if (_inputs.userId == null || !_inputs.isAdmin) {
      _preview = AdPreview.none;
      _previewRequested = false;
      _stopPreviewProof();
      return;
    }
    final saved = _previewSession['value'];
    if (saved is Map && saved['userId'] == _inputs.userId && (saved['expiresAt'] as int? ?? 0) > _now()) {
      _preview = AdPreview(enabled: true, platform: saved['platform'] == 'android' ? 'android' : 'ios', premium: saved['premium'] == true, fast: saved['fast'] != false);
      _previewRequested = true;
      _startPreviewProof();
    }
  }

  /// `registerSurface(id)`: the screen (or placement) is mounted; returns the unregister callback.
  VoidCallback registerSurface(String id) {
    final token = env.newId();
    _surfaces.add(_Surface(token, id, _now()));
    _reconcile();
    _notify();
    return () {
      _surfaces.removeWhere((s) => s.token == token);
      _reconcile();
      _notify();
    };
  }

  /// `registerBlock()` (`useAdSafetyBlock`) when [allow] is null; an overlay with `data-ad-block` /
  /// `data-ad-allow` otherwise.
  VoidCallback registerBlock({Set<String>? allow}) {
    final block = _Block(env.newId(), allow);
    _blocks.add(block);
    _reconcile();
    _notify();
    return () {
      _blocks.remove(block);
      _reconcile();
      _notify();
    };
  }

  /// Overlay blocks (with allow lists) as the layout sees them: blocked, and the placements every one allows.
  ({bool blocked, List<String> allowed}) overlayBlocks() {
    final overlays = _blocks.where((b) => b.allow != null).toList();
    if (overlays.isEmpty) return (blocked: false, allowed: const <String>[]);
    return (blocked: true, allowed: [for (final id in adPlacementIds) if (overlays.every((b) => b.allow!.contains(id))) id]);
  }

  // ── policy ──

  AdLedger _getLedger(AdMode mode) {
    final now = _now();
    final value = normalizeAdLedger(_ledgerCache[mode] ?? readAdLedger(env.store, mode, _session.id, now), now, _session.id);
    _ledgerCache[mode] = value;
    return value;
  }

  void _saveLedger(AdMode mode, AdLedger value) {
    _ledgerCache[mode] = value;
    writeAdLedger(env.store, mode, value);
    if (_mounted) {
      _tick = _now();
      _notify();
    }
  }

  bool _npaFor(AdsConfiguration value) => value.settings.nonPersonalizedOnly || !_inputs.personalizedAdsAllowed;

  AdEvaluationContext _contextFor(String id, {bool ignoreBusy = false, bool? consent, bool existingBanner = false}) {
    final preview = _effectivePreview, previewing = preview.enabled;
    final platform = previewing ? preview.platform : (env.platform == 'ios' ? 'ios' : 'android');
    _Surface? surface;
    for (final s in _surfaces.reversed) {
      if (s.id == id) {
        surface = s;
        break;
      }
    }
    final now = _now();
    return AdEvaluationContext(
      now: now,
      sessionStartedAt: _session.startedAt,
      screenStartedAt: surface?.startedAt ?? now,
      platform: platform,
      signedIn: _inputs.userId != null,
      entitlementReady: previewing || _inputs.entitlementReady,
      premium: previewing ? preview.premium : _inputs.isPremium,
      foreground: _layout.foreground,
      online: _layout.online,
      blocked: _protectedBlocked && !_protectedAllowed.contains(id),
      native: env.native,
      sdkAvailable: nativeAvailable,
      nativeVersion: previewing ? '31.0' : _nativeVersion,
      compiledAppId: env.compiledAppId(platform),
      consent: consent ?? (previewing || _consent.canRequestAds),
      demo: previewing,
      busy: !ignoreBusy && _busy,
      fastPreview: previewing && preview.fast,
      alreadyShowingBanner: existingBanner,
    );
  }

  /// `decisionFor(id)`.
  AdDecision decisionFor(String id, {bool ignoreBusy = false, bool? consent, bool existingBanner = false}) {
    final context = _contextFor(id, ignoreBusy: ignoreBusy, consent: consent, existingBanner: existingBanner);
    final config = configuration;
    final mode = context.demo ? 'demo' : config?.settings.mode ?? 'demo';
    return evaluateAd(config, id, context, _getLedger(mode));
  }

  void _emit(String id, AdEvent event, AdMode mode, [String reason = '']) {
    if (_inputs.userId != null) {
      unawaited(env.api.reportAdEvent(id, event, mode, env.native ? env.platform : 'web', reason, configuration?.revision));
    }
  }

  void _markShown(String id, AdMode mode) {
    _saveLedger(mode, recordAdShown(_getLedger(mode), id, _now()));
    _emit(id, 'shown', mode);
    final key = '$mode:$id';
    final cadence = _cadences[key];
    if (cadence != null) _cadences[key] = consumeAdCadence(cadence);
  }

  void _setBusy(bool value) {
    _busy = value;
    _notify();
  }

  Future<bool> _ensureConsent() async {
    final adapter = env.adapter;
    if (adapter == null) return false;
    final ownEpoch = _epoch;
    _setBusy(true);
    try {
      final result = await adapter.consent();
      if (ownEpoch != _epoch || !_mounted) return false;
      _consent = result;
      return result.canRequestAds;
    } catch (_) {
      return false;
    } finally {
      if (ownEpoch == _epoch) {
        _setBusy(false);
        _reconcile();
      }
    }
  }

  // ── effects ──

  bool _reconciling = false;
  bool _again = false;

  void _reconcile() {
    if (!_mounted) return;
    if (_reconciling) {
      _again = true;
      return;
    }
    _reconciling = true;
    try {
      var guard = 0;
      do {
        _again = false;
        _consentEffect();
        _bannerEffectRun();
        _positionEffect();
        _prepareEffect();
      } while (_again && ++guard < 4);
    } finally {
      _reconciling = false;
    }
  }

  void _consentEffect() {
    final config = configuration;
    if (config == null || _effectivePreview.enabled || config.settings.mode == 'demo' || !nativeAvailable || _busy) return;
    final eligible = _surfaces.any((s) => decisionFor(s.id, consent: true).allowed);
    final key = '${_inputs.userId}:${config.settings.mode}:${config.settings.iosAppId}:${config.settings.androidAppId}';
    if (!eligible || _consentAttempt == key) return;
    _consentAttempt = key;
    unawaited(_ensureConsent());
  }

  _Surface? get _bannerSurface {
    for (final s in _surfaces.reversed) {
      if (placementDefinition(s.id)['format'] == 'banner') return s;
    }
    return null;
  }

  String get bannerPosition {
    final surface = _bannerSurface;
    for (final p in configuration?.placements ?? const <AdPlacementConfig>[]) {
      if (p.id == surface?.id) return p.position;
    }
    return 'bottom';
  }

  double get bannerTop {
    final surface = _bannerSurface;
    final position = bannerPosition;
    final anchor = surface == null ? null : _layout.anchors[surface.id];
    return position == 'top'
        ? _layout.safeTop + 8
        : position == 'middle'
            ? anchor?.top ?? 0
            : _layout.viewportHeight - _layout.bottom - (_banner?.height ?? 60);
  }

  bool get bannerVisible {
    final surface = _bannerSurface;
    return bannerPosition != 'middle' || (surface != null && _layout.anchors[surface.id]?.visible == true);
  }

  /// `--admob-banner-space`, `--admob-viewport-bottom`, `--admob-viewport-top` (px; 0 when no banner).
  double get bannerSpace => _banner?.loaded == true ? (_banner!.height + 18).ceilToDouble() : 0;
  double get viewportBottom => _banner?.loaded == true && bannerPosition == 'bottom' ? (_layout.bottom + _banner!.height + 8).ceilToDouble() : 0;
  double get viewportTop => _banner?.loaded == true && bannerPosition == 'top' ? (_banner!.height + 16).ceilToDouble() : 0;

  String? _bannerEffectKey;
  _BannerEffect? _bannerEffect;

  void _bannerEffectRun() {
    final surface = _bannerSurface;
    final config = configuration;
    final decision = surface == null ? kInactiveAdDecision : decisionFor(surface.id, existingBanner: _banner?.loaded == true && _banner!.id == surface.id);
    final position = bannerPosition;
    final bannerKey = surface != null && decision.allowed
        ? '${surface.token}:${decision.mode}:${decision.adUnitId}:${config == null ? '' : _npaFor(config)}:$position'
        : '';
    final canDisplay = bannerKey.isNotEmpty && _now() >= (_backoff[bannerKey] ?? 0) && (bannerVisible || _banner?.key == bannerKey);
    final effectKey = '$bannerKey|$canDisplay';
    if (effectKey == _bannerEffectKey) return;
    _bannerEffectKey = effectKey;
    _bannerEffect?.cancel();
    _bannerEffect = null;
    final adapter = env.adapter;
    if (!canDisplay || surface == null || config == null) {
      if (adapter != null) unawaited(adapter.stopBanner().catchError((Object _) {}));
      if (_banner != null) {
        _banner = null;
        _again = true;
      }
      return;
    }
    final id = surface.id, mode = decision.mode, ownEpoch = _epoch;
    final effect = _BannerEffect(adapter);
    _bannerEffect = effect;
    var committed = false;
    bool valid() => !effect.cancelled && _mounted && ownEpoch == _epoch;
    void loaded() {
      if (!valid()) return;
      if (_banner?.key == bannerKey) _banner = _banner!.copyWith(loaded: true);
      if (!committed) {
        committed = true;
        _markShown(id, mode);
        _emit(id, 'loaded', mode);
      }
      _again = true;
      if (!_reconciling) _reconcile();
      _notify();
    }

    _banner = AdBannerState(id: id, mode: mode, height: position == 'middle' ? 50 : mode == 'demo' ? 74 : 60, loaded: mode == 'demo', key: bannerKey);
    _emit(id, 'requested', mode);
    if (mode == 'demo') {
      loaded();
      _emit(id, 'impression', mode);
    } else if (adapter != null) {
      final margin = math.max(0.0, position == 'bottom' ? _layout.bottom - (env.platform == 'ios' ? _layout.safeBottom : 0) : bannerTop - _layout.safeTop);
      unawaited(adapter.showBanner(
        decision.adUnitId!,
        margin,
        mode,
        _npaFor(config),
        BannerCallbacks(
          loaded: loaded,
          size: (height) {
            if (valid() && height > 0 && _banner?.key == bannerKey) {
              _banner = _banner!.copyWith(height: height);
              _reconcile();
              _notify();
            }
          },
          impression: () {
            if (valid()) _emit(id, 'impression', mode);
          },
          failed: () {
            if (valid()) {
              _backoff[bannerKey] = _now() + 60000;
              _emit(id, 'failed', mode, 'sdk_error');
              _banner = null;
              _reconcile();
              _notify();
            }
          },
        ),
        top: position != 'bottom',
        inline: position == 'middle',
      ));
    }
    _again = true;
  }

  void _positionEffect() {
    final banner = _banner;
    if (banner == null || !banner.loaded || banner.mode == 'demo') {
      _positioned = null;
      return;
    }
    final top = bannerTop.round(), hidden = !bannerVisible, last = _positioned;
    if (last != null && last.key == banner.key && last.hidden == hidden && (last.top - top).abs() < 2) return;
    _positioned = (key: banner.key, top: top, hidden: hidden);
    final adapter = env.adapter;
    if (adapter == null) return;
    unawaited(adapter.positionBanner(top.toDouble(), hidden).catchError((Object _) {
      _positioned = null;
      unawaited(adapter.stopBanner().catchError((Object _) {}));
      _banner = null;
      _reconcile();
      _notify();
    }));
  }

  void _prepareEffect() {
    final adapter = env.adapter, config = configuration;
    if (adapter == null || config == null) return;
    for (final surface in List<_Surface>.of(_surfaces)) {
      final format = placementDefinition(surface.id)['format'];
      if (format != 'interstitial' && format != 'native_story') continue;
      final decision = decisionFor(surface.id);
      if (!decision.allowed || decision.mode == 'demo' || decision.adUnitId == null || _now() <= (_backoff[surface.id] ?? 0)) continue;
      final placement = config.placements.firstWhere((p) => p.id == surface.id);
      final unit = decision.adUnitId!, mode = decision.mode, npa = _npaFor(config);
      if (format == 'native_story') {
        final video = placement.storyFormat == 'video';
        if (!adapter.isStoryPrepared(unit, video) && !adapter.isStoryPreparing(unit, video)) {
          _emit(surface.id, 'requested', mode);
          unawaited(adapter.prepareStory(unit, mode, npa, video).then((ok) {
            if (!ok) _backoff[surface.id] = _now() + 60000;
            _emit(surface.id, ok ? 'loaded' : 'failed', mode, ok ? '' : 'sdk_error');
          }));
        }
      } else if (!adapter.isPrepared(unit, mode, npa) && !adapter.isPreparing(unit, mode, npa)) {
        _emit(surface.id, 'requested', mode);
        unawaited(adapter.prepare(unit, mode, npa).then((ok) {
          if (!ok) _backoff[surface.id] = _now() + 60000;
          _emit(surface.id, ok ? 'loaded' : 'failed', mode, ok ? '' : 'sdk_error');
        }));
      }
    }
  }

  // ── presentation ──

  Future<bool> _present(String id, bool rewarded) async {
    if (_busy) return false;
    String? surfaceToken;
    for (final s in _surfaces.reversed) {
      if (s.id == id) {
        surfaceToken = s.token;
        break;
      }
    }
    if (surfaceToken == null) return false;
    var decision = decisionFor(id);
    if (rewarded && decision.reason == 'consent') {
      await _ensureConsent();
      decision = decisionFor(id);
    }
    if (!decision.allowed) {
      _emit(id, 'skipped', decision.mode, decision.reason);
      return false;
    }
    final config = configuration!;
    final nativeStory = placementDefinition(id)['format'] == 'native_story';
    final placement = config.placements.firstWhere((p) => p.id == id);
    final storyVideo = placement.storyFormat == 'video';
    final ownEpoch = _epoch, mode = decision.mode, minutes = config.settings.rewardPauseMinutes;
    bool stillCurrent() => _mounted && _epoch == ownEpoch;
    void grant() {
      if (!stillCurrent()) return;
      if (id == 'ads_pause_rewarded') {
        final ledger = _getLedger(mode);
        ledger.pauseUntil = math.max(ledger.pauseUntil, _now() + minutes * 60000);
        _saveLedger(mode, ledger);
      }
      _emit(id, 'reward_earned', mode);
    }

    final adapter = env.adapter;
    if (mode != 'demo' && !rewarded) {
      final ready = adapter != null &&
          (nativeStory ? adapter.isStoryPrepared(decision.adUnitId!, storyVideo) : adapter.isPrepared(decision.adUnitId!, mode, _npaFor(config)));
      if (!ready) {
        _emit(id, 'skipped', mode, 'not_ready');
        return false;
      }
    }
    _setBusy(true);
    if (adapter != null) unawaited(adapter.stopBanner().catchError((Object _) {}));
    _banner = null;
    _notify();
    try {
      if (mode == 'demo') {
        final completer = Completer<bool>();
        var finished = false;
        _markShown(id, mode);
        _emit(id, 'impression', mode);
        void finish(bool earned) {
          if (finished) return;
          finished = true;
          if (earned && rewarded && stillCurrent()) grant();
          _emit(id, 'dismissed', mode);
          if (_mounted) {
            _demo = null;
            _notify();
          }
          completer.complete(rewarded ? earned && stillCurrent() : true);
        }

        _demo = AdDemoPresentation(id: id, minutes: minutes, finish: finish);
        _notify();
        return await completer.future;
      }
      if (adapter == null) return false;
      if (rewarded) {
        _emit(id, 'requested', mode);
        if (!await adapter.prepare(decision.adUnitId!, mode, _npaFor(config), true)) {
          _emit(id, 'failed', mode, 'sdk_error');
          return false;
        }
        _emit(id, 'loaded', mode);
      }
      final token = surfaceToken;
      bool allowed() => stillCurrent() && _surfaces.any((s) => s.token == token) && decisionFor(id, ignoreBusy: true).allowed;
      final callbacks = FullscreenCallbacks(
        shown: () {
          if (stillCurrent()) _markShown(id, mode);
        },
        impression: () {
          if (stillCurrent()) _emit(id, 'impression', mode);
        },
        rewarded: grant,
      );
      final result = nativeStory
          ? await adapter.showStory(decision.adUnitId!, storyVideo, allowed, callbacks)
          : await adapter.showFullscreen(decision.adUnitId!, mode, _npaFor(config), rewarded, allowed, callbacks);
      if (stillCurrent()) _emit(id, result.shown ? 'dismissed' : 'failed', mode, result.shown ? '' : 'sdk_error');
      return rewarded ? result.rewarded && stillCurrent() : result.shown;
    } finally {
      if (stillCurrent()) {
        _setBusy(false);
        _reconcile();
      }
    }
  }

  Future<bool> showInterstitial(String id) => _present(id, false);
  Future<bool> showRewarded([String id = 'ads_pause_rewarded']) => _present(id, true);
  Future<bool> showStory() => _present('community_story_break', false);

  /// `opportunity(id, key)`: counts a finished story / round once; true when a break is due.
  bool opportunity(String id, String key) {
    final config = configuration;
    AdPlacementConfig? placement;
    for (final p in config?.placements ?? const <AdPlacementConfig>[]) {
      if (p.id == id) placement = p;
    }
    if (config == null || !config.settings.enabled || placement == null || !placement.enabled) return false;
    final mode = _effectivePreview.enabled ? 'demo' : config.settings.mode;
    final ledgerKey = '$mode:$id';
    final result = advanceAdCadence(_cadences[ledgerKey] ?? const AdCadence(count: 0, seen: <String>[]), key, placement.everyN);
    _cadences[ledgerKey] = result.state;
    return result.due;
  }

  // ── admin demo preview (web admin starts it; natively it can only resume a stored preview) ──

  void _startPreviewProof() {
    _previewTimer?.cancel();
    if (!env.azure) {
      _previewProof = false;
      return;
    }
    Future<void> check() async {
      try {
        await env.api.fetchAdmobOverview();
        _previewProof = true;
      } catch (_) {
        _previewProof = false;
      }
      _reconcile();
      _notify();
    }

    unawaited(check());
    _previewTimer = Timer.periodic(const Duration(seconds: 30), (_) => unawaited(check()));
  }

  void _stopPreviewProof() {
    _previewTimer?.cancel();
    _previewTimer = null;
    _previewProof = false;
  }

  Future<void> startPreview({AdPlatform platform = 'ios', bool premium = false, bool fast = true}) async {
    final userId = _inputs.userId;
    if (userId == null || !_inputs.isAdmin) return;
    await env.api.fetchAdmobOverview();
    final next = AdPreview(enabled: true, platform: platform, premium: premium, fast: fast);
    _previewSession['value'] = {'enabled': true, 'platform': platform, 'premium': premium, 'fast': fast, 'userId': userId, 'expiresAt': _now() + 2 * 3600000};
    _preview = next;
    _previewRequested = true;
    _previewProof = true;
    _startPreviewProof();
    _reconcile();
    _notify();
  }

  void stopPreview() {
    _previewSession.remove('value');
    _preview = AdPreview.none;
    _previewRequested = false;
    _stopPreviewProof();
    _demo?.finish(false);
    _reconcile();
    _notify();
  }

  void resetDemo() {
    _saveLedger('demo', emptyAdLedger(_now(), _session.id));
    _backoff.clear();
    _cadences.clear();
  }

  /// `demo_clicked` of the demo banner.
  void demoBannerClicked(String id) => _emit(id, 'demo_clicked', 'demo');

  Future<void> openPrivacy() async {
    final adapter = env.adapter;
    if (adapter == null || _busy) return;
    final ownEpoch = _epoch;
    _setBusy(true);
    try {
      final result = await adapter.privacyOptions();
      if (_mounted && _epoch == ownEpoch) _consent = result;
    } catch (_) {
      env.onPrivacyUnavailable?.call();
    } finally {
      if (ownEpoch == _epoch) {
        _setBusy(false);
        _reconcile();
      }
    }
  }

  @override
  void dispose() {
    _mounted = false;
    _epoch++;
    _timer.cancel();
    _previewTimer?.cancel();
    _demo?.finish(false);
    env.adapter?.reset();
    super.dispose();
  }
}

class _BannerEffect {
  _BannerEffect(this.adapter);
  final NativeAdmobAdapter? adapter;
  bool cancelled = false;
  void cancel() {
    cancelled = true;
    final a = adapter;
    if (a != null) unawaited(a.stopBanner().catchError((Object _) {}));
  }
}
