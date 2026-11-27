// Ported from: src/lib/backButton.ts (initBackButtonHandler: dispatch, then toast / exit on a second press
//              within 2 s), src/hooks/useOverlayBackHandler.ts (useOverlayBackHandler)
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../nav/back_button.dart';
import '../nav/shell_controller.dart';
import '../shell_inputs.dart';

/// Android hardware back for the Index route. Flutter pops pushed routes (dialogs, [showASheet]) first;
/// what reaches this scope goes through the [BackDispatcher] layers (overlay → screen → root), and an
/// unconsumed press shows `back_press_again` (1 800 ms), a second one within 2 s exits.
class AndroidBackScope extends ConsumerStatefulWidget {
  const AndroidBackScope({super.key, required this.child, this.enabled});
  final Widget child;

  /// Defaults to Android only (the hardware button does not exist elsewhere).
  final bool? enabled;

  @override
  ConsumerState<AndroidBackScope> createState() => _AndroidBackScopeState();
}

class _AndroidBackScopeState extends ConsumerState<AndroidBackScope> {
  final BackExitPolicy _policy = BackExitPolicy();

  void _onBack() {
    if (ref.read(backDispatcherProvider).dispatch()) return;
    switch (_policy.press()) {
      case BackExitDecision.exit:
        ref.read(shellPlatformProvider).exitApp();
      case BackExitDecision.showToast:
        try {
          AToastHost.of(context)
              .message(tr(BackExitPolicy.toastKey, BackExitPolicy.toastAz), duration: BackExitPolicy.toastDuration);
        } catch (_) {
          // No toast host above the shell (tests): the next press still exits.
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled ?? defaultTargetPlatform == TargetPlatform.android;
    if (!enabled) return widget.child;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: widget.child,
    );
  }
}

/// `useOverlayBackHandler(open, close)`: while [open], back closes this in-tree overlay first.
/// Pass `onClose: null` to swallow back without closing (non-dismissible overlays).
class OverlayBackHandler extends ConsumerStatefulWidget {
  const OverlayBackHandler({super.key, required this.open, required this.onClose, required this.child});
  final bool open;
  final VoidCallback? onClose;
  final Widget child;

  @override
  ConsumerState<OverlayBackHandler> createState() => _OverlayBackHandlerState();
}

class _OverlayBackHandlerState extends ConsumerState<OverlayBackHandler> {
  VoidCallback? _release;

  void _sync() {
    if (widget.open && _release == null) {
      _release = ref.read(backDispatcherProvider).push(() {
        widget.onClose?.call();
        return true;
      }, BackLayer.overlay);
    } else if (!widget.open && _release != null) {
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
  void didUpdateWidget(OverlayBackHandler oldWidget) {
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
