// Ported from: src/components/security/ScreenCaptureGuard.tsx, src/plugins/ScreenshotGuard.ts (interface)
//
// Screens are protected from capture except the visible main dashboard. The native part (iOS secure surface,
// Android FLAG_SECURE, screenshot / capture events) is behind [ScreenshotGuardPlatform]; the DOM scan of React
// (`dashboardCaptureAllowed()`) becomes the [dashboardCaptureAllowedProvider] input the shell/home wire (true only
// while the main dashboard is shown with no dialog / modal / full-screen overlay). While a screen recording is
// active (`captureChanged`) and capture is not allowed, an opaque branded curtain covers the app.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Native plugin surface (`ScreenshotGuard`): `setEnabled`, `setCurtainSuspended`, `screenshotTaken`,
/// `captureChanged` events.
abstract interface class ScreenshotGuardPlatform {
  Future<void> setEnabled(bool enabled);
  Future<void> setCurtainSuspended(bool suspended);
  Stream<void> get screenshotTaken;
  Stream<bool> get captureChanged;
}

/// No-op until the native plugin is wired.
class NoopScreenshotGuard implements ScreenshotGuardPlatform {
  const NoopScreenshotGuard();
  @override
  Future<void> setEnabled(bool enabled) async {}
  @override
  Future<void> setCurtainSuspended(bool suspended) async {}
  @override
  Stream<void> get screenshotTaken => const Stream<void>.empty();
  @override
  Stream<bool> get captureChanged => const Stream<bool>.empty();
}

final screenshotGuardPlatformProvider = Provider<ScreenshotGuardPlatform>((ref) => const NoopScreenshotGuard());

/// `dashboardCaptureAllowed()` — wired by the shell/home (default: protected).
final dashboardCaptureAllowedProvider = Provider<bool>((ref) => false);

/// Mount once above the app (App.tsx `<ScreenCaptureGuard />`). [child] is the app.
class ScreenCaptureGuard extends ConsumerStatefulWidget {
  const ScreenCaptureGuard({super.key, this.child});
  final Widget? child;
  @override
  ConsumerState<ScreenCaptureGuard> createState() => _ScreenCaptureGuardState();
}

class _ScreenCaptureGuardState extends ConsumerState<ScreenCaptureGuard> {
  bool _captured = false;
  bool? _allowed;
  int _generation = 0;
  Future<void> _queue = Future<void>.value();
  final List<StreamSubscription<Object?>> _subs = <StreamSubscription<Object?>>[];

  @override
  void initState() {
    super.initState();
    final platform = ref.read(screenshotGuardPlatformProvider);
    // Native screenshots are blanked/refused by the OS surface; no flash for them (only desktop PrintScreen).
    _subs.add(platform.screenshotTaken.listen((_) {}));
    _subs.add(platform.captureChanged.listen((captured) {
      if (mounted) setState(() => _captured = captured);
    }));
  }

  void _apply(bool permit) {
    if (_allowed == permit) return;
    _allowed = permit;
    final version = ++_generation;
    final platform = ref.read(screenshotGuardPlatformProvider);
    _queue = _queue.catchError((Object _) {}).then((_) async {
      if (version != _generation || !mounted) return;
      await platform.setEnabled(!permit);
    }).catchError((Object _) {});
  }

  @override
  void dispose() {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final allowed = ref.watch(dashboardCaptureAllowedProvider);
    _apply(allowed);
    final curtain = _captured && !allowed;
    return Stack(textDirection: TextDirection.ltr, children: <Widget>[
      if (widget.child != null) Positioned.fill(child: widget.child!),
      if (curtain)
        Positioned.fill(
          child: KeyedSubtree(
            key: const ValueKey<String>('capture-curtain'),
            child: ColoredBox(
              color: const Color(0xFFFAF7F4), // ScreenCaptureGuard.tsx literal #FAF7F4
              child: Center(child: Image.asset('assets/images/profile/brand-mark-coral.png', width: 112, height: 118, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 112, height: 118))),
            ),
          ),
        ),
    ]);
  }
}

/// Key of the curtain (tests).
const String kCaptureCurtainKey = 'capture-curtain';
