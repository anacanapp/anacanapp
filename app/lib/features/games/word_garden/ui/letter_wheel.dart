// Ported from: src/components/games/word-garden/LetterWheel.tsx and the `.wg-wheel*`, `.wg-letter`, `.wg-word-*`,
//              `.wg-submit` rules of word-garden.css
//
// The letter wheel: drag across letters (crossed letters are picked in order, going back one letter un-picks it,
// a moved drag submits on release), tap letters one by one, keyboard entry (letters with Azerbaijani casing,
// Backspace, Enter), clear / delete / submit buttons and the shuffle button in the middle.
library;

import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/lexicon.dart' show displayGardenWord, localeLower, nfcLatin;
import '../engine/wheel.dart';
import 'garden_dialog.dart' show wgText;
import 'garden_theme.dart';

class LetterWheel extends StatefulWidget {
  const LetterWheel({
    super.key,
    required this.palette,
    required this.letters,
    required this.locale,
    required this.t,
    required this.disabled,
    required this.resetKey,
    required this.onSubmit,
    required this.onShuffle,
    required this.onPick,
    this.wheelSize = 220,
  });
  final GardenPalette palette;
  final List<String> letters;
  final String locale;
  final GardenText t;
  final bool disabled;
  final String resetKey;
  final ValueChanged<String> onSubmit;
  final VoidCallback onShuffle;
  final VoidCallback onPick;
  final double wheelSize;

  @override
  State<LetterWheel> createState() => LetterWheelState();
}

class _Gesture {
  _Gesture(this.id, this.start) : last = start;
  final int id;
  final WheelPoint start;
  WheelPoint last;
  bool moved = false;
}

class LetterWheelState extends State<LetterWheel> {
  List<int> _chosen = const [];
  WheelPoint? _cursor;
  _Gesture? _gesture;

  @override
  void didUpdateWidget(LetterWheel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.resetKey != widget.resetKey || oldWidget.disabled != widget.disabled) {
      _gesture = null;
      _chosen = const [];
      _cursor = null;
    }
  }

  void _choose(int index) {
    final next = selectWheelLetter(_chosen, index);
    if (identical(next, _chosen)) return;
    setState(() => _chosen = next);
    widget.onPick();
  }

  void _clear() => setState(() {
        _chosen = const [];
        _cursor = null;
      });

  void _submit() {
    final word = _chosen.map((i) => widget.letters[i]).join();
    _clear();
    if (!widget.disabled && word.isNotEmpty) widget.onSubmit(word);
  }

  void _backspace() => setState(() => _chosen = _chosen.sublist(0, math.max(0, _chosen.length - 1)));

  bool _onKey(KeyEvent event) {
    if (event is! KeyDownEvent || widget.disabled || gameModifierPressed()) return false;
    if (event.logicalKey == LogicalKeyboardKey.enter || event.logicalKey == LogicalKeyboardKey.numpadEnter) {
      if (_chosen.isEmpty) return false;
      _submit();
      return true;
    }
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      if (_chosen.isEmpty) return false;
      _backspace();
      return true;
    }
    final character = event.character;
    if (character == null) return false;
    final normalized = localeLower(nfcLatin(character), widget.locale);
    if (normalized.runes.length != 1) return false;
    for (var i = 0; i < widget.letters.length; i++) {
      if (widget.letters[i] == normalized && !_chosen.contains(i)) {
        _choose(i);
        return true;
      }
    }
    return false;
  }

  WheelPoint _local(Offset position) => WheelPoint(position.dx / widget.wheelSize * 300, position.dy / widget.wheelSize * 300);

  void _down(PointerDownEvent event) {
    if (widget.disabled || _gesture != null || event.buttons & kPrimaryButton == 0) return;
    final next = _local(event.localPosition);
    final radius = math.max(27.0, 22 * 300 / widget.wheelSize);
    final points = wheelPoints(widget.letters.length);
    final index = points.indexWhere((point) => jsHypot([point.x - next.x, point.y - next.y]) <= radius);
    if (index < 0) return;
    _gesture = _Gesture(event.pointer, next);
    _choose(index);
    setState(() => _cursor = next);
  }

  void _move(PointerEvent event) {
    final current = _gesture;
    if (current == null || event.pointer != current.id || widget.disabled) return;
    final next = _local(event.localPosition);
    if (jsHypot([next.x - current.start.x, next.y - current.start.y]) > 8) current.moved = true;
    for (final index in crossedLetters(current.last, next, wheelPoints(widget.letters.length))) {
      _choose(index);
    }
    current.last = next;
    setState(() => _cursor = next);
  }

  void _up(PointerUpEvent event) {
    final current = _gesture;
    if (current == null || current.id != event.pointer) return;
    _move(event);
    _gesture = null;
    setState(() => _cursor = null);
    if (current.moved) _submit();
  }

  void _cancel(PointerCancelEvent event) {
    if (_gesture == null) return;
    _gesture = null;
    _clear();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.palette, t = widget.t;
    final points = wheelPoints(widget.letters.length);
    final value = _chosen.map((i) => widget.letters[i]).join();
    final size = widget.wheelSize;
    final night = p.night;
    return GameKeyboardListener(
      onKey: _onKey,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          width: math.min(300, MediaQuery.sizeOf(context).width - 60),
          height: 44,
          child: Row(children: [
            Expanded(
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: p.border)),
                child: Row(children: [
                  Expanded(
                    child: Semantics(
                      liveRegion: true,
                      label: value.isNotEmpty ? t('selectedWord', {'word': displayGardenWord(value, widget.locale)}) : t('waitingWord'),
                      child: ExcludeSemantics(
                        child: Text(
                          value.isNotEmpty ? displayGardenWord(value, widget.locale) : t('waitingWord'),
                          key: const ValueKey('wg-word-preview'),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: value.isNotEmpty
                              ? wgText(19, weight: FontWeight.w900, color: p.ink, ls: 2, height: 1.2)
                              : wgText(10, color: p.muted, ls: .3),
                        ),
                      ),
                    ),
                  ),
                  if (_chosen.isNotEmpty)
                    GameButton(
                      enabled: !widget.disabled,
                      label: t('clear'),
                      onTap: _clear,
                      child: SizedBox(width: 26, height: 28, child: Center(child: AIcon(AIcons.x, size: 17, color: p.ink))),
                    ),
                ]),
              ),
            ),
            const SizedBox(width: 6),
            _entryButton(key: const ValueKey('wg-backspace'), icon: AIcons.delete, label: t('backspace'), onTap: _backspace, filled: false),
            const SizedBox(width: 6),
            _entryButton(key: const ValueKey('wg-submit'), icon: AIcons.cornerDownLeft, label: t('submit'), onTap: _submit, filled: true),
          ]),
        ),
        const SizedBox(height: 7),
        Semantics(
          label: t('wheelLabel'),
          container: true,
          child: Listener(
            key: const ValueKey('wordgarden-wheel'),
            behavior: HitTestBehavior.opaque,
            onPointerDown: _down,
            onPointerMove: _move,
            onPointerUp: _up,
            onPointerCancel: _cancel,
            child: SizedBox(
              width: size,
              height: size,
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        center: const Alignment(-0.28, -0.5),
                        colors: night ? const [Color(0xFF354D57), Color(0xFF273940)] : const [Color(0xFFFFFDF8), Color(0xFFF1F2E6)],
                      ),
                      border: Border.all(color: night ? const Color(0x9C91A6A5) : const Color(0xFFFFFFFF)),
                      boxShadow: night
                          ? const [BoxShadow(color: Color(0x59061926), offset: Offset(0, 14), blurRadius: 28)]
                          : const [
                              BoxShadow(color: Color(0x2EBFD0B1), offset: Offset(0, 5)),
                              BoxShadow(color: Color(0x12506349), offset: Offset(0, 8), blurRadius: 20),
                            ],
                    ),
                  ),
                ),
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _WheelLinesPainter(
                        points: [for (final i in _chosen) points[i], if (_cursor != null && (_gesture?.moved ?? false)) _cursor!],
                        accent: p.accent,
                        leaf: p.leaf,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: size * .5 - math.max(44, size * .21) / 2,
                  top: size * .5 - math.max(44, size * .21) / 2,
                  width: math.max(44, size * .21),
                  height: math.max(44, size * .21),
                  child: GameButton(
                    key: const ValueKey('wg-shuffle'),
                    enabled: !widget.disabled,
                    label: t('shuffle'),
                    onTap: () {
                      _clear();
                      widget.onShuffle();
                    },
                    child: Container(
                      decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x0A7D9A6A)),
                      alignment: Alignment.center,
                      child: AIcon(AIcons.shuffle, size: 24, color: p.leaf),
                    ),
                  ),
                ),
                for (var index = 0; index < widget.letters.length; index++) _letter(index, points[index]),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(t('clickShort'), textAlign: TextAlign.center, style: wgText(9, color: p.muted, height: 1.4)),
      ]),
    );
  }

  Widget _entryButton({required Key key, required AIconData icon, required String label, required VoidCallback onTap, required bool filled}) {
    final p = widget.palette;
    final enabled = !widget.disabled && _chosen.isNotEmpty;
    return GameButton(
      key: key,
      enabled: enabled,
      label: label,
      onTap: onTap,
      child: Opacity(
        opacity: enabled ? 1 : .38,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: filled ? p.leaf : p.panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: p.border)),
          child: AIcon(icon, size: 18, color: filled ? const Color(0xFFFFFFFF) : p.ink),
        ),
      ),
    );
  }

  Widget _letter(int index, WheelPoint point) {
    final p = widget.palette, size = widget.wheelSize;
    final selected = _chosen.contains(index);
    final box = math.max(44.0, size * .18);
    final letter = widget.letters[index];
    Gradient bg = p.night
        ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF7E9C8B), Color(0xFF668274)])
        : const LinearGradient(begin: Alignment(-0.42, -0.9), end: Alignment(0.42, 0.9), colors: [Color(0xFFEFF7E8), Color(0xFFDCE9D0)]);
    Color fg = p.night ? const Color(0xFFFFFAE7) : const Color(0xFF49624E);
    Color drop = p.night ? const Color(0xFF445E52) : const Color(0xFFADBF9F);
    if (p.highContrast) {
      bg = const LinearGradient(colors: [Color(0xFFE4EFD7), Color(0xFFE4EFD7)]);
      fg = const Color(0xFF173C28);
    }
    if (selected) {
      bg = p.highContrast
          ? const LinearGradient(colors: [Color(0xFFB84C40), Color(0xFFB84C40)])
          : p.night
              ? LinearGradient(colors: [p.accentDeep, p.accentDeep])
              : LinearGradient(begin: const Alignment(-0.42, -0.9), end: const Alignment(0.42, 0.9), colors: [p.accent, p.accentDeep]);
      fg = const Color(0xFFFFFFFF);
      drop = p.accentDeep;
    }
    return Positioned(
      left: point.x / 300 * size - box / 2,
      top: point.y / 300 * size - box / 2,
      width: box,
      height: box,
      child: Semantics(
        button: true,
        selected: selected,
        enabled: !widget.disabled,
        label: widget.t('letterLabel', {'letter': displayGardenWord(letter, widget.locale), 'number': index + 1}),
        onTap: widget.disabled ? null : () => _choose(index),
        child: ExcludeSemantics(
          child: Opacity(
            key: ValueKey('wg-letter-$index'),
            opacity: widget.disabled ? .75 : 1,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: bg,
                border: selected ? Border.all(color: const Color(0xFFFFFFFF), width: 2) : null,
                boxShadow: [BoxShadow(color: drop, offset: const Offset(0, 3)), const BoxShadow(color: Color(0x18587349), offset: Offset(0, 4), blurRadius: 8)],
              ),
              alignment: Alignment.center,
              child: Text(displayGardenWord(letter, widget.locale),
                  style: wgText(math.max(23, math.min(29, MediaQuery.sizeOf(context).width * .06)), weight: FontWeight.w900, color: fg, height: 1)),
            ),
          ),
        ),
      ),
    );
  }

  /// Letters as indexes in the rack (tests).
  List<int> get chosen => _chosen;
}

class _WheelLinesPainter extends CustomPainter {
  _WheelLinesPainter({required this.points, required this.accent, required this.leaf});
  final List<WheelPoint> points;
  final Color accent;
  final Color leaf;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 300;
    canvas.scale(scale);
    final orbit = Paint()
      ..color = leaf.withValues(alpha: .12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final circumference = 2 * math.pi * 134;
    for (var d = 0.0; d < circumference; d += 10) {
      final a0 = d / 134, a1 = (d + 2) / 134;
      canvas.drawArc(Rect.fromCircle(center: const Offset(150, 150), radius: 134), a0, a1 - a0, false, orbit);
    }
    // An SVG polyline with a single point draws nothing.
    if (points.length < 2) return;
    final line = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()..moveTo(points.first.x, points.first.y);
    for (final point in points.skip(1)) {
      path.lineTo(point.x, point.y);
    }
    canvas.drawPath(path, line);
  }

  @override
  bool shouldRepaint(_WheelLinesPainter old) => old.points.length != points.length || old.accent != accent || !_same(old.points, points);

  static bool _same(List<WheelPoint> a, List<WheelPoint> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i].x != b[i].x || a[i].y != b[i].y) return false;
    }
    return true;
  }
}
