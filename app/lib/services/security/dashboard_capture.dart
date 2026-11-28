// Ported from: src/components/security/ScreenCaptureGuard.tsx (`dashboardCaptureAllowed()`), src/pages/Index.tsx
//              (`data-main-dashboard={activeTab === 'home' && !blogOverlayOpen}` on the tab frame),
//              src/plugins/ScreenshotGuard.ts (method-channel binding of the plugin surface)
//
// Capture is allowed only while the main dashboard is visible: the shell shows the tab frame (no sub-screen,
// viewed profile or mother chat) on Home, no blog article overlay, no dialog / sheet route, no full-screen chat,
// no onboarding tour step and no other registered full-screen overlay ([CaptureBlock]). Everything else keeps
// FLAG_SECURE / the secure surface on. The guard widget and its platform interface live in
// features/security/screen_capture_guard.dart; this file provides the input and a platform binding.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/security/register.dart' show onboardingTourActiveProvider;
import '../../features/security/screen_capture_guard.dart' show ScreenshotGuardPlatform;
import '../../shell/shell.dart';

/// Open popup routes (`[role=dialog]`, `[aria-modal]`) and registered full-screen overlays.
class CaptureBlockers extends Notifier<int> {
  @override
  int build() => 0;
  void add() => state = state + 1;
  void remove() => state = state > 0 ? state - 1 : 0;
}

final captureBlockersProvider = NotifierProvider<CaptureBlockers, int>(CaptureBlockers.new);

/// Counts [PopupRoute]s (dialogs, sheets). Add to the app's navigators (go_router `observers` + root navigator).
class CapturePopupObserver extends NavigatorObserver {
  CapturePopupObserver(this.container);
  final ProviderContainer container;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (route is PopupRoute) container.read(captureBlockersProvider.notifier).add();
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (route is PopupRoute) container.read(captureBlockersProvider.notifier).remove();
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => didPop(route, previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (oldRoute is PopupRoute) container.read(captureBlockersProvider.notifier).remove();
    if (newRoute is PopupRoute) container.read(captureBlockersProvider.notifier).add();
  }
}

/// A full-screen overlay drawn in-tree (React: a `.fixed` element ≥ 80 % × 65 % of the viewport with z ≥ 40, e.g.
/// the app lock screen): protection stays on while [active].
class CaptureBlock extends ConsumerStatefulWidget {
  const CaptureBlock({super.key, this.active = true, required this.child});
  final bool active;
  final Widget child;
  @override
  ConsumerState<CaptureBlock> createState() => _CaptureBlockState();
}

class _CaptureBlockState extends ConsumerState<CaptureBlock> {
  late final CaptureBlockers _blockers = ref.read(captureBlockersProvider.notifier);
  bool _held = false;

  void _sync() {
    if (widget.active == _held) return;
    _held = widget.active;
    // Deferred: provider state must not change while the tree builds.
    final add = _held;
    scheduleMicrotask(() => add ? _blockers.add() : _blockers.remove());
  }

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(CaptureBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  @override
  void dispose() {
    if (_held) scheduleMicrotask(_blockers.remove);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// The pure rule (`dashboardCaptureAllowed()`).
bool dashboardCaptureAllowedFor({
  required bool shellShown,
  required ShellLayer layer,
  required ShellTab activeTab,
  required bool blogOverlayOpen,
  required int blockers,
  required bool fullScreenChat,
  required bool onboardingStep,
}) =>
    shellShown && layer == ShellLayer.frame && activeTab == ShellTab.home && !blogOverlayOpen && blockers == 0 && !fullScreenChat && !onboardingStep;

/// Value for `dashboardCaptureAllowedProvider` (features/security). App root:
/// `dashboardCaptureAllowedProvider.overrideWith(dashboardCaptureAllowed)`.
bool dashboardCaptureAllowed(Ref ref) {
  try {
    final user = ref.watch(shellUserProvider);
    final inputs = ref.watch(gateInputsProvider);
    final shellShown = decideGate(inputs, showSplash: false, showIntro: false).gate == GateId.shell;
    final state = ref.watch(shellProvider);
    return dashboardCaptureAllowedFor(
      shellShown: shellShown,
      layer: layerFor(state, user.guard),
      activeTab: state.activeTab,
      blogOverlayOpen: state.blogOverlay != null,
      blockers: ref.watch(captureBlockersProvider),
      fullScreenChat: ref.watch(chatChromeHiddenProvider),
      onboardingStep: ref.watch(onboardingTourActiveProvider),
    );
  } catch (_) {
    // Shell inputs not wired (tests, pre-startup): protected.
    return false;
  }
}

/// [ScreenshotGuardPlatform] over the `anacan/screenshot_guard` method channel (methods `setEnabled
/// {enabled}`, `setCurtainSuspended {suspended}`; events `screenshotTaken`, `captureChanged {captured}` sent as
/// method calls from the native side). Without the native handler every call is a no-op, so it can be wired
/// before the plugin exists.
class MethodChannelScreenshotGuard implements ScreenshotGuardPlatform {
  MethodChannelScreenshotGuard({MethodChannel? channel}) : _channel = channel ?? const MethodChannel('anacan/screenshot_guard') {
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'screenshotTaken':
          _screenshots.add(null);
        case 'captureChanged':
          final args = call.arguments;
          _captures.add(args is Map && args['captured'] == true);
      }
      return null;
    });
  }

  final MethodChannel _channel;
  final StreamController<void> _screenshots = StreamController<void>.broadcast();
  final StreamController<bool> _captures = StreamController<bool>.broadcast();

  Future<void> _invoke(String method, Map<String, Object?> args) async {
    try {
      await _channel.invokeMethod<Object?>(method, args);
    } on MissingPluginException {
      // Native side not present in this build.
    } on PlatformException {
      // Native failure: the OS keeps its previous state.
    }
  }

  @override
  Future<void> setEnabled(bool enabled) => _invoke('setEnabled', {'enabled': enabled});
  @override
  Future<void> setCurtainSuspended(bool suspended) => _invoke('setCurtainSuspended', {'suspended': suspended});
  @override
  Stream<void> get screenshotTaken => _screenshots.stream;
  @override
  Stream<bool> get captureChanged => _captures.stream;
}
