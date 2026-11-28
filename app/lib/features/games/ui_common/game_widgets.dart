// Ported from: src/lib/backButton.ts (pushBackHandler as used by the games), React `createPortal(…, document.body)`
//              of the full-screen games, window `keydown`/`keyup` + document `visibilitychange` / window `blur`
//              listeners of the game screens, lucide `<Star fill="currentColor" />`
//
// Small building blocks shared by every game screen.
library;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../shell/nav/back_button.dart' show BackLayer;
import '../../../shell/nav/shell_controller.dart' show backDispatcherProvider;
import '../../tools/health_common/health_ui.dart' show LucideFilled;

/// `createPortal(<div className="…-screen" style="position:fixed;inset:0;z-index:65">, document.body)`: draws
/// [child] over the whole app (bottom navigation included) through the nearest [Overlay]. Without an overlay
/// (bare widget tests) it renders in place.
class GamePortal extends StatefulWidget {
  const GamePortal({super.key, required this.child});
  final Widget child;
  @override
  State<GamePortal> createState() => _GamePortalState();
}

class _GamePortalState extends State<GamePortal> {
  final OverlayPortalController _portal = OverlayPortalController()..show();

  @override
  Widget build(BuildContext context) {
    if (Overlay.maybeOf(context) == null) return widget.child;
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (_) => Positioned.fill(child: widget.child),
      child: const SizedBox.shrink(),
    );
  }
}

/// `useEffect(() => pushBackHandler(handler), [])`: registers [onBack] on the shell's back dispatcher (screen layer,
/// newest first) while mounted. Return true when consumed.
class GameBackHandler extends ConsumerStatefulWidget {
  const GameBackHandler({super.key, required this.onBack, required this.child, this.layer = BackLayer.screen});
  final bool Function() onBack;
  final Widget child;
  final BackLayer layer;
  @override
  ConsumerState<GameBackHandler> createState() => _GameBackHandlerState();
}

class _GameBackHandlerState extends ConsumerState<GameBackHandler> {
  VoidCallback? _release;

  @override
  void initState() {
    super.initState();
    _release = ref.read(backDispatcherProvider).push(() => widget.onBack(), widget.layer);
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// `window.addEventListener('keydown' / 'keyup')`: a global hardware-keyboard handler while mounted. Return true
/// from [onKey] for `event.preventDefault()` (the key is consumed).
class GameKeyboardListener extends StatefulWidget {
  const GameKeyboardListener({super.key, required this.onKey, required this.child});
  final bool Function(KeyEvent event) onKey;
  final Widget child;
  @override
  State<GameKeyboardListener> createState() => _GameKeyboardListenerState();
}

class _GameKeyboardListenerState extends State<GameKeyboardListener> {
  bool _handle(KeyEvent event) => widget.onKey(event);

  @override
  void initState() {
    super.initState();
    _GameKeyRouter.add(_handle);
  }

  @override
  void dispose() {
    _GameKeyRouter.remove(_handle);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// One [HardwareKeyboard] handler for all game listeners: the newest listener is asked first and a handled key
/// stops there (a dialog's Escape never reaches the screen below, like its capture listener with
/// `stopImmediatePropagation`).
abstract final class _GameKeyRouter {
  static final List<bool Function(KeyEvent)> _handlers = [];

  static void add(bool Function(KeyEvent) handler) {
    if (_handlers.isEmpty) HardwareKeyboard.instance.addHandler(_dispatch);
    _handlers.add(handler);
  }

  static void remove(bool Function(KeyEvent) handler) {
    _handlers.remove(handler);
    if (_handlers.isEmpty) HardwareKeyboard.instance.removeHandler(_dispatch);
  }

  static bool _dispatch(KeyEvent event) {
    for (final handler in _handlers.reversed.toList()) {
      if (handler(event)) return true;
    }
    return false;
  }
}

/// Ctrl / Alt / Meta held (`event.ctrlKey || event.altKey || event.metaKey`).
bool gameModifierPressed() {
  final k = HardwareKeyboard.instance;
  return k.isControlPressed || k.isAltPressed || k.isMetaPressed;
}

/// `document.visibilitychange` (hidden ⇔ the app is hidden / paused) and window `blur` (inactive).
class GameLifecycleListener extends StatefulWidget {
  const GameLifecycleListener({super.key, this.onHidden, this.onBlur, required this.child});
  final VoidCallback? onHidden;
  final VoidCallback? onBlur;
  final Widget child;
  @override
  State<GameLifecycleListener> createState() => _GameLifecycleListenerState();
}

class _GameLifecycleListenerState extends State<GameLifecycleListener> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden || state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      widget.onHidden?.call();
    } else if (state == AppLifecycleState.inactive) {
      widget.onBlur?.call();
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// `document.hidden`.
bool gameDocumentHidden() {
  final state = WidgetsBinding.instance.lifecycleState;
  return state == AppLifecycleState.hidden || state == AppLifecycleState.paused || state == AppLifecycleState.detached;
}

/// lucide `<Star size fill={filled ? 'currentColor' : 'none'} />` in [color].
class GameStar extends StatelessWidget {
  const GameStar({super.key, required this.size, required this.filled, required this.color, this.strokeWidth = 2});
  final double size;
  final bool filled;
  final Color color;
  final double strokeWidth;
  @override
  Widget build(BuildContext context) => filled
      ? LucideFilled(AIcons.star, size: size, color: color, strokeWidth: strokeWidth)
      : AIcon(AIcons.star, size: size, color: color, strokeWidth: strokeWidth);
}

/// Any lucide icon drawn with `fill="currentColor"` (Play, Heart…).
class GameFilledIcon extends StatelessWidget {
  const GameFilledIcon(this.icon, {super.key, required this.size, required this.color});
  final AIconData icon;
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => LucideFilled(icon, size: size, color: color);
}

/// A plain `<button>`: tap target with semantics, disabled state and an optional press scale (framer `whileTap`).
class GameButton extends StatelessWidget {
  const GameButton({
    super.key,
    required this.child,
    this.onTap,
    this.enabled = true,
    this.label,
    this.selected,
    this.toggled,
    this.pressScale,
    this.disabledOpacity,
    this.excludeChildSemantics = false,
  });
  final Widget child;
  final VoidCallback? onTap;
  final bool enabled;

  /// `aria-label`.
  final String? label;

  /// `aria-pressed`.
  final bool? selected;

  /// `role="switch" aria-checked`.
  final bool? toggled;
  final double? pressScale;

  /// `button:disabled { opacity }`.
  final double? disabledOpacity;
  final bool excludeChildSemantics;

  @override
  Widget build(BuildContext context) {
    final active = enabled && onTap != null;
    Widget body = child;
    if (!enabled && disabledOpacity != null) body = Opacity(opacity: disabledOpacity!, child: body);
    body = pressScale != null && active
        ? PressScale(scale: pressScale!, onTap: onTap, child: body)
        : GestureDetector(behavior: HitTestBehavior.opaque, onTap: active ? onTap : null, child: body);
    return Semantics(
      button: toggled == null,
      toggled: toggled,
      enabled: enabled,
      selected: selected,
      label: label,
      excludeSemantics: excludeChildSemantics || label != null,
      onTap: active ? onTap : null,
      child: body,
    );
  }
}
