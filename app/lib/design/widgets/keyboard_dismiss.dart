// Ported from: src/index.css + the Capacitor WebView defaults (no React source: in the WebView a tap outside an
//              <input>/<textarea> blurred it and closed the keyboard, and dragging the page dismissed it on iOS;
//              src/components/chat/ConversationScreen.tsx refocuses the input after send/emoji, so the composer
//              keeps the keyboard open)
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// App-wide keyboard dismissal (mounted once in `AppChrome`, above the router so dialogs and sheets are covered):
///
/// * a **tap** (pointer up within [kTouchSlop] of its down) outside the focused field's [TextFieldTapRegion]
///   group unfocuses it. Taps on another field, the field's selection toolbar/handles, or anything wrapped in
///   [TextFieldTapRegion] (chat composers' send/emoji buttons) keep the keyboard open. Unfocusing on the tap-up
///   instead of the pointer-down keeps the layout still while the finger is down, and leaves drags to the next rule;
/// * a **vertical user drag** of any scroll view (`ScrollViewKeyboardDismissBehavior.onDrag` semantics) unfocuses a
///   focused text field, except the drag that scrolls the text inside a multi-line field itself.
///
/// Multi-line fields (Return inserts a newline) are closed by either rule. Mouse/stylus keep Flutter's default
/// (unfocus on pointer down).
class KeyboardDismissScope extends StatefulWidget {
  const KeyboardDismissScope({super.key, required this.child, this.enabled = true});
  final Widget child;
  final bool enabled;

  @override
  State<KeyboardDismissScope> createState() => _KeyboardDismissScopeState();
}

class _KeyboardDismissScopeState extends State<KeyboardDismissScope> {
  int? _downPointer;
  Offset _downPosition = Offset.zero;

  late final Map<Type, Action<Intent>> _actions = {
    EditableTextTapOutsideIntent: _TapOutsideAction(this),
    EditableTextTapUpOutsideIntent: _TapUpOutsideAction(this),
  };

  void _down(EditableTextTapOutsideIntent intent) {
    _downPointer = intent.pointerDownEvent.pointer;
    _downPosition = intent.pointerDownEvent.position;
  }

  void _up(EditableTextTapUpOutsideIntent intent) {
    final e = intent.pointerUpEvent;
    final tap = e.pointer == _downPointer && (e.position - _downPosition).distance <= kTouchSlop;
    _downPointer = null;
    if (tap && intent.focusNode.hasFocus) intent.focusNode.unfocus();
  }

  bool _onScroll(ScrollUpdateNotification n) {
    if (!widget.enabled || n.dragDetails == null || n.metrics.axis != Axis.vertical) return false;
    // The scrollable inside a multi-line EditableText: the user is scrolling the text being typed.
    if (n.context?.findAncestorStateOfType<EditableTextState>() != null) return false;
    final focus = FocusManager.instance.primaryFocus;
    if (focus != null && focus.context?.findAncestorStateOfType<EditableTextState>() != null) focus.unfocus();
    return false;
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return NotificationListener<ScrollUpdateNotification>(
      onNotification: _onScroll,
      child: Actions(actions: _actions, child: widget.child),
    );
  }
}

/// Fields' pointer-down outside: touch on mobile is remembered for [_TapUpOutsideAction]; other pointer kinds and
/// desktop keep the framework's default (unfocus at once).
class _TapOutsideAction extends ContextAction<EditableTextTapOutsideIntent> {
  _TapOutsideAction(this._scope);
  final _KeyboardDismissScopeState _scope;

  @override
  void invoke(EditableTextTapOutsideIntent intent, [BuildContext? context]) {
    final mobile = switch (defaultTargetPlatform) {
      TargetPlatform.android || TargetPlatform.iOS || TargetPlatform.fuchsia => true,
      _ => false,
    };
    if (mobile && intent.pointerDownEvent.kind == PointerDeviceKind.touch && !kIsWeb) {
      _scope._down(intent);
      return;
    }
    final fallback = callingAction;
    if (fallback is ContextAction<EditableTextTapOutsideIntent>) {
      fallback.invoke(intent, context);
    } else {
      intent.focusNode.unfocus();
    }
  }
}

class _TapUpOutsideAction extends ContextAction<EditableTextTapUpOutsideIntent> {
  _TapUpOutsideAction(this._scope);
  final _KeyboardDismissScopeState _scope;

  @override
  void invoke(EditableTextTapUpOutsideIntent intent, [BuildContext? context]) => _scope._up(intent);
}
