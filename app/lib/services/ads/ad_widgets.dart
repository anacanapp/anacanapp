// Ported from: src/components/ads/AdExperienceProvider.tsx (the provider's rendered layer: banner dock, preview
//              toolbar, demo full-screen; layoutState(); AdSurface, AdInlineAnchor, useAdSafetyBlock, useAdExit;
//              the data-ad-block / data-ad-allow / data-ad-bottom-nav markers), src/styles/ads.css (.admob-banner-dock)
//
// DOM queries become explicit registrations: a screen marks itself with [AdSurface], an overlay that must stop
// ads with [AdSafetyBlock] (`useAdSafetyBlock`) or [AdBlockRegion] (`data-ad-block` + `data-ad-allow`), dialogs and
// sheets pushed on a navigator are seen by [AdRouteObserver], the bottom nav by [AdBottomNavAnchor], inline
// banner slots by [AdInlineAnchor]. [AdExperienceHost] measures them (throttled to ~150 ms like React) and draws
// the banner dock, the admin preview toolbar and demo creatives above the app.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/i18n.dart';
import '../../core/offline/connectivity.dart' show onlineStatusProvider;
import '../../design/design.dart';
import '../../domain/ads/ads_config.dart';
import 'ad_experience.dart';
import 'ads_providers.dart';
import 'demo_ad.dart';

/// Keys of the measured elements (inline anchors by placement, the bottom nav).
class AdLayoutRegistry {
  final Map<String, List<GlobalKey>> _anchors = <String, List<GlobalKey>>{};
  final List<GlobalKey> _navs = <GlobalKey>[];
  final List<VoidCallback> _listeners = <VoidCallback>[];

  void _changed() {
    for (final l in List<VoidCallback>.of(_listeners)) {
      l();
    }
  }

  VoidCallback addListener(VoidCallback listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  VoidCallback registerAnchor(String id, GlobalKey key) {
    (_anchors[id] ??= <GlobalKey>[]).add(key);
    _changed();
    return () {
      _anchors[id]?.remove(key);
      _changed();
    };
  }

  VoidCallback registerNav(GlobalKey key) {
    _navs.add(key);
    _changed();
    return () {
      _navs.remove(key);
      _changed();
    };
  }

  /// Open popup routes (dialogs, sheets) reported by [AdRouteObserver].
  int popups = 0;
}

final adLayoutRegistryProvider = Provider<AdLayoutRegistry>((ref) => AdLayoutRegistry());

/// Counts open [PopupRoute]s (`[role=dialog]`, `[aria-modal]`, full-screen overlays of React). Add it to the
/// app's navigators (`GoRouter(observers: [...])` and the root navigator).
class AdRouteObserver extends NavigatorObserver {
  AdRouteObserver(this.registry);
  final AdLayoutRegistry registry;

  bool _counts(Route<dynamic>? route) => route is PopupRoute;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (_counts(route)) {
      registry.popups++;
      registry._changed();
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (_counts(route)) {
      registry.popups = math.max(0, registry.popups - 1);
      registry._changed();
    }
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => didPop(route, previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (_counts(oldRoute)) didPop(oldRoute!, null);
    if (_counts(newRoute)) didPush(newRoute!, null);
  }
}

/// Mount once above the app's routes (inside `AToastHost`, below `ScreenCaptureGuard`); [child] is the app.
class AdExperienceHost extends ConsumerStatefulWidget {
  const AdExperienceHost({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<AdExperienceHost> createState() => _AdExperienceHostState();
}

class _AdExperienceHostState extends ConsumerState<AdExperienceHost> with WidgetsBindingObserver {
  static const int _throttleMs = 150;
  late final AdExperienceController _ads = ref.read(adExperienceProvider);
  late final AdLayoutRegistry _registry = ref.read(adLayoutRegistryProvider);
  VoidCallback? _releaseRegistry;
  Timer? _throttle;
  int _last = 0;
  AppLifecycleState? _lifecycle = WidgetsBinding.instance.lifecycleState;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    FocusManager.instance.addListener(_schedule);
    _releaseRegistry = _registry.addListener(_schedule);
    _ads.addListener(_schedule);
    _schedule();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    FocusManager.instance.removeListener(_schedule);
    _releaseRegistry?.call();
    _ads.removeListener(_schedule);
    _throttle?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycle = state;
    _schedule();
  }

  @override
  void didChangeMetrics() => _schedule();

  void _schedule() {
    if (_throttle != null || !mounted) return;
    final wait = math.max(0, _throttleMs - (DateTime.now().millisecondsSinceEpoch - _last));
    _throttle = Timer(Duration(milliseconds: wait), () {
      _throttle = null;
      if (!mounted) return;
      SchedulerBinding.instance.addPostFrameCallback((_) => _measure());
      SchedulerBinding.instance.ensureVisualUpdate();
    });
  }

  Rect? _rectOf(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  void _measure() {
    if (!mounted) return;
    _last = DateTime.now().millisecondsSinceEpoch;
    final media = MediaQuery.maybeOf(context);
    final viewportHeight = media?.size.height ?? 800;
    final safeTop = media?.padding.top ?? 0, safeBottom = media?.padding.bottom ?? 0;
    final focus = FocusManager.instance.primaryFocus?.context;
    final editing = focus != null && focus.mounted && (focus.widget is EditableText || focus.findAncestorWidgetOfExactType<EditableText>() != null);
    final overlays = _ads.overlayBlocks();
    final popups = _registry.popups > 0;
    final blocked = editing || overlays.blocked || popups;
    final allowed = editing || popups || !overlays.blocked ? const <String>[] : overlays.allowed;
    Rect? nav;
    for (final key in _registry._navs) {
      nav = _rectOf(key) ?? nav;
    }
    final bottom = nav != null && nav.height > 0 ? math.max(0.0, viewportHeight - nav.top) + 10 : safeBottom + 8;
    final anchors = <String, AdAnchorRect>{};
    for (final entry in _registry._anchors.entries) {
      for (final key in entry.value) {
        final rect = _rectOf(key);
        if (rect == null) continue;
        anchors[entry.key] = AdAnchorRect(
          top: rect.top,
          height: rect.height,
          visible: rect.height > 0 && rect.top >= safeTop + 4 && rect.bottom <= viewportHeight - bottom,
        );
      }
    }
    final lifecycle = _lifecycle;
    _ads.updateLayout(AdLayout(
      blocked: blocked,
      allowed: allowed,
      bottom: bottom,
      safeBottom: safeBottom,
      safeTop: safeTop,
      viewportHeight: viewportHeight,
      anchors: anchors,
      foreground: lifecycle == null || lifecycle == AppLifecycleState.resumed || lifecycle == AppLifecycleState.inactive,
      online: ref.read(onlineStatusProvider),
    ));
  }

  void _toast(String text) {
    try {
      AToastHost.of(context).info(text);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<bool>(onlineStatusProvider, (_, _) => _schedule());
    return ListenableBuilder(
      listenable: _ads,
      builder: (context, child) {
        final banner = _ads.banner;
        final preview = _ads.preview;
        final demo = _ads.demo;
        final position = _ads.bannerPosition;
        final width = MediaQuery.maybeOf(context)?.size.width ?? 390;
        Widget? dock;
        if (banner != null && banner.loaded) {
          final dockWidth = position == 'middle' ? math.min(320.0, width - 16) : math.min(728.0, width - 16);
          dock = Positioned(
            key: const ValueKey<String>('ad-banner-dock'),
            top: _ads.bannerTop,
            left: (width - dockWidth) / 2,
            width: dockWidth,
            height: banner.height,
            child: Visibility.maintain(
              visible: _ads.bannerVisible,
              child: banner.mode == 'demo'
                  ? DemoBanner(
                      placementId: banner.id,
                      compact: position == 'middle',
                      onTap: () {
                        _ads.demoBannerClicked(banner.id);
                        _toast(tr('adexp_demo_banner_info', 'Bu demo reklamdır. Real reklamın məzmununu AdMob təqdim edir.'));
                      },
                    )
                  : IgnorePointer(ignoring: false, child: _ads.env.adapter?.buildBannerView(context) ?? const SizedBox.shrink()),
            ),
          );
        }
        final top = MediaQuery.maybeOf(context)?.padding.top ?? 0;
        return Stack(textDirection: Directionality.maybeOf(context) ?? TextDirection.ltr, children: [
          Positioned.fill(child: child!),
          ?dock,
          if (preview.enabled)
            PositionedDirectional(
              top: top + 4,
              end: 8,
              child: AdPreviewToolbar(platform: _ads.requestedPreview.platform, premium: _ads.requestedPreview.premium, onReset: _ads.resetDemo, onClose: _ads.stopPreview),
            ),
          if (demo != null)
            Positioned.fill(
              child: DemoFullscreen(
                key: ValueKey<String>('ad-demo-full-${demo.id}'),
                placementId: demo.id,
                rewardMinutes: demo.minutes,
                storyFormat: _ads.configuration?.placements.where((p) => p.id == demo.id).firstOrNull?.storyFormat ?? 'native',
                onFinish: demo.finish,
              ),
            ),
        ]);
      },
      child: NotificationListener<ScrollNotification>(
        onNotification: (_) {
          _schedule();
          return false;
        },
        child: widget.child,
      ),
    );
  }
}

/// `<AdSurface id enabled />`: the placement's screen is mounted (renders nothing).
class AdSurface extends ConsumerStatefulWidget {
  const AdSurface({super.key, required this.id, this.enabled = true});
  final String id;
  final bool enabled;

  @override
  ConsumerState<AdSurface> createState() => _AdSurfaceState();
}

class _AdSurfaceState extends ConsumerState<AdSurface> {
  VoidCallback? _dispose;

  void _register() {
    _dispose?.call();
    _dispose = null;
    if (!widget.enabled || !adPlacementIds.contains(widget.id)) return;
    _dispose = ref.read(adExperienceProvider).registerSurface(widget.id);
  }

  @override
  void initState() {
    super.initState();
    _register();
  }

  @override
  void didUpdateWidget(AdSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id || oldWidget.enabled != widget.enabled) _register();
  }

  @override
  void dispose() {
    _dispose?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// `<AdInlineAnchor id />`: 50 px slot (`my-4`) for a `middle` banner while it may show, else zero height.
class AdInlineAnchor extends ConsumerStatefulWidget {
  const AdInlineAnchor({super.key, required this.id});
  final String id;

  @override
  ConsumerState<AdInlineAnchor> createState() => _AdInlineAnchorState();
}

class _AdInlineAnchorState extends ConsumerState<AdInlineAnchor> {
  final GlobalKey _key = GlobalKey();
  VoidCallback? _release;

  @override
  void initState() {
    super.initState();
    _release = ref.read(adLayoutRegistryProvider).registerAnchor(widget.id, _key);
  }

  @override
  void didUpdateWidget(AdInlineAnchor oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      _release?.call();
      _release = ref.read(adLayoutRegistryProvider).registerAnchor(widget.id, _key);
    }
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ads = ref.watch(adExperienceProvider);
    return ListenableBuilder(
      listenable: ads,
      builder: (context, _) {
        final placement = ads.configuration?.placements.where((p) => p.id == widget.id).firstOrNull;
        final active = placement?.position == 'middle' && (ads.bannerId == widget.id || ads.decisionFor(widget.id).allowed);
        return Padding(
          padding: EdgeInsets.symmetric(vertical: active ? 16 : 0),
          child: SizedBox(key: _key, height: active ? 50 : 0),
        );
      },
    );
  }
}

/// `useAdSafetyBlock(active)`: while [active], no ad may start (and a running banner stops).
class AdSafetyBlock extends ConsumerStatefulWidget {
  const AdSafetyBlock({super.key, this.active = true, required this.child});
  final bool active;
  final Widget child;

  @override
  ConsumerState<AdSafetyBlock> createState() => _AdSafetyBlockState();
}

class _AdSafetyBlockState extends ConsumerState<AdSafetyBlock> {
  VoidCallback? _release;

  void _sync() {
    if (widget.active && _release == null) _release = ref.read(adExperienceProvider).registerBlock();
    if (!widget.active && _release != null) {
      _release!();
      _release = null;
    }
  }

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(AdSafetyBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// `data-ad-block="true" data-ad-allow="…"`: an overlay that blocks every placement except [allow] (e.g. a game
/// root allowing `games_break_interstitial game_revive_rewarded`).
class AdBlockRegion extends ConsumerStatefulWidget {
  const AdBlockRegion({super.key, this.allow = '', required this.child});

  /// Space-separated placement ids.
  final String allow;
  final Widget child;

  @override
  ConsumerState<AdBlockRegion> createState() => _AdBlockRegionState();
}

class _AdBlockRegionState extends ConsumerState<AdBlockRegion> {
  VoidCallback? _release;

  void _register() {
    _release?.call();
    _release = ref.read(adExperienceProvider).registerBlock(allow: widget.allow.split(' ').where((s) => s.isNotEmpty).toSet());
  }

  @override
  void initState() {
    super.initState();
    _register();
  }

  @override
  void didUpdateWidget(AdBlockRegion oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.allow != widget.allow) _register();
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// `data-ad-bottom-nav`: wrap the bottom nav so the bottom banner sits 10 px above it.
class AdBottomNavAnchor extends ConsumerStatefulWidget {
  const AdBottomNavAnchor({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<AdBottomNavAnchor> createState() => _AdBottomNavAnchorState();
}

class _AdBottomNavAnchorState extends ConsumerState<AdBottomNavAnchor> {
  final GlobalKey _key = GlobalKey();
  VoidCallback? _release;

  @override
  void initState() {
    super.initState();
    _release = ref.read(adLayoutRegistryProvider).registerNav(_key);
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => KeyedSubtree(key: _key, child: widget.child);
}

/// The `[data-ad-screen]::after` spacer: banner height + 18 while a bottom/top banner shows (0 for `middle`).
class AdBannerSpacer extends ConsumerWidget {
  const AdBannerSpacer({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ads = ref.watch(adExperienceProvider);
    return ListenableBuilder(
      listenable: ads,
      builder: (context, _) => SizedBox(height: ads.bannerPosition == 'middle' ? 0 : ads.bannerSpace),
    );
  }
}

/// `useAdExit(id, onExit)` at leave time: shows the interstitial when it is ready and allowed, then leaves.
/// [surfaceRegistered] callers keep an [AdSurface] for [id] mounted while the screen is open (React registers it
/// for the screen's lifetime so `min_screen_seconds` counts from entry).
Future<void> adExit(WidgetRef ref, String id, VoidCallback onExit, {bool active = true}) async {
  try {
    if (active) await ref.read(adExperienceProvider).showInterstitial(id);
  } catch (_) {
    // Never block navigation.
  } finally {
    onExit();
  }
}
