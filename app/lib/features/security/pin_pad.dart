// Ported from: src/components/security/PinPad.tsx
//
// Shared PIN keypad: 4 dots + 3×4 numpad (biometric key bottom-left when shown), shake on a wrong PIN, cleared
// 320 ms later.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import 'app_lock.dart';

class PinPad extends StatefulWidget {
  const PinPad({super.key, required this.onComplete, this.showBiometric = false, this.onBiometric, this.resetKey, this.disabled = false});

  /// Called with the full PIN; false → error animation.
  final FutureOr<bool> Function(String pin) onComplete;
  final bool showBiometric;
  final VoidCallback? onBiometric;

  /// External reset trigger (e.g. the step changed).
  final Object? resetKey;
  final bool disabled;

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> with TickerProviderStateMixin {
  String _pin = '';
  bool _busy = false;
  Timer? _clear;
  late final AnimationController _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 180));

  @override
  void didUpdateWidget(PinPad old) {
    super.didUpdateWidget(old);
    if (old.resetKey != widget.resetKey) setState(() => _pin = '');
  }

  @override
  void dispose() {
    _clear?.cancel();
    _shake.dispose();
    _pop.dispose();
    super.dispose();
  }

  Future<void> _push(String d) async {
    if (_busy || widget.disabled || _pin.length >= kPinLength) return;
    unawaited(HapticFeedback.lightImpact());
    final next = _pin + d;
    setState(() => _pin = next);
    _pop.forward(from: 0);
    if (next.length == kPinLength) {
      setState(() => _busy = true);
      final ok = await widget.onComplete(next);
      if (!mounted) return;
      if (!ok) {
        unawaited(HapticFeedback.heavyImpact());
        _shake.forward(from: 0);
        _clear?.cancel();
        _clear = Timer(const Duration(milliseconds: 320), () {
          if (mounted) setState(() => _pin = '');
        });
      }
      setState(() => _busy = false);
    }
  }

  void _back() {
    if (_busy || widget.disabled) return;
    unawaited(HapticFeedback.lightImpact());
    setState(() => _pin = _pin.isEmpty ? '' : _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final ios = defaultTargetPlatform == TargetPlatform.iOS;
    const keys = <String>['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'back'];
    // keyframes x: [0, -10, 10, -8, 8, -4, 4, 0] over 400 ms
    const frames = <double>[0, -10, 10, -8, 8, -4, 4, 0];
    double shakeX(double t) {
      final p = t * (frames.length - 1);
      final i = p.floor().clamp(0, frames.length - 2);
      return frames[i] + (frames[i + 1] - frames[i]) * (p - i);
    }

    Widget key(String k) {
      if (k == 'bio') {
        if (!widget.showBiometric) return const SizedBox(width: 68, height: 68);
        return Semantics(
          label: 'Biometric',
          button: true,
          child: PressScale(
            key: const ValueKey<String>('pin-bio'),
            scale: 0.9,
            onTap: widget.onBiometric,
            child: SizedBox(width: 68, height: 68, child: Center(child: AIcon(ios ? AIcons.scanFace : AIcons.fingerprint, size: 28, strokeWidth: 1.8, color: a.accentInk))),
          ),
        );
      }
      if (k == 'back') {
        return Semantics(
          label: 'Backspace',
          button: true,
          child: PressScale(
            key: const ValueKey<String>('pin-back'),
            scale: 0.9,
            onTap: _back,
            child: SizedBox(width: 68, height: 68, child: Center(child: AIcon(AIcons.delete, size: 24, strokeWidth: 1.8, color: a.inkSoft, mirrorInRtl: true))),
          ),
        );
      }
      return _DigitKey(digit: k, onTap: () => _push(k));
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 280),
      child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
        AnimatedBuilder(
          animation: Listenable.merge(<Listenable>[_shake, _pop]),
          builder: (context, _) => Transform.translate(
            offset: Offset(_shake.isAnimating ? shakeX(_shake.value) : 0, 0),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
              for (var i = 0; i < kPinLength; i++) ...<Widget>[
                if (i > 0) const SizedBox(width: 16),
                Transform.scale(
                  scale: i == _pin.length - 1 && _pop.isAnimating ? 1 + 0.25 * (1 - (2 * _pop.value - 1).abs()) : 1,
                  child: AnimatedContainer(
                    key: ValueKey<String>('pin-dot-$i'),
                    duration: const Duration(milliseconds: 150),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _pin.length ? a.peach2 : const Color(0x00000000),
                      border: i < _pin.length ? null : Border.all(color: a.inkFaint, width: 2),
                    ),
                  ),
                ),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 36),
        for (var r = 0; r < 4; r++) ...<Widget>[
          if (r > 0) const SizedBox(height: 12),
          Row(children: <Widget>[
            for (var c = 0; c < 3; c++) ...<Widget>[
              if (c > 0) const SizedBox(width: 12),
              Expanded(child: Center(child: key(keys[r * 3 + c]))),
            ],
          ]),
        ],
      ]),
    );
  }
}

class _DigitKey extends StatefulWidget {
  const _DigitKey({required this.digit, required this.onTap});
  final String digit;
  final VoidCallback onTap;
  @override
  State<_DigitKey> createState() => _DigitKeyState();
}

class _DigitKeyState extends State<_DigitKey> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Listener(
      onPointerDown: (_) => setState(() => _down = true),
      onPointerUp: (_) => setState(() => _down = false),
      onPointerCancel: (_) => setState(() => _down = false),
      child: PressScale(
        key: ValueKey<String>('pin-${widget.digit}'),
        scale: 0.9,
        onTap: widget.onTap,
        child: Container(
          width: 68,
          height: 68,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            // whileTap background: var(--a-peach-1)
            color: _down ? a.peach1 : a.surface,
            shape: BoxShape.circle,
            border: Border.all(color: a.btnBorder),
            boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
          ),
          child: Text(widget.digit, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: a.ink, height: 1.2)),
        ),
      ),
    );
  }
}
