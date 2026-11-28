// Ported from: src/components/games/parking/ParkingBoard.tsx and the `.parking-lot`, `.parking-car*`,
//              `.parking-exit`, `.parking-key-bay` rules of parking.css
//
// The 6×6 lot: cars slide only along their own axis (a drag is clamped to the free run, a multi-cell slide is one
// move), Qucaq's car leaves through the right exit once it is open, the key bay of locked-exit levels, the
// selected car and the solver hint arrow.
library;

import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../ui_common/casual_ui.dart';
import '../engine/engine.dart';

/// ParkingBoard.tsx `COLORS`.
const List<Color> parkingCarColors = [
  Color(0xFF58A18D), Color(0xFFEAA478), Color(0xFFAF8DC8), Color(0xFF73A7C1), Color(0xFFDBBB6C), Color(0xFFCF8D9B),
  Color(0xFF8CAB75), Color(0xFF6CAEAE), Color(0xFFC39C77), Color(0xFFAA91BE), Color(0xFFA9B87B),
];

class ParkingBoard extends StatefulWidget {
  const ParkingBoard({
    super.key,
    required this.level,
    required this.state,
    required this.selected,
    required this.onSelect,
    required this.onMove,
    required this.hint,
    required this.disabled,
    required this.t,
  });
  final ParkingLevel level;
  final ParkingState state;
  final int? selected;
  final ValueChanged<int> onSelect;
  final ValueChanged<ParkingMove> onMove;
  final ParkingMove? hint;
  final bool disabled;
  final CasualText t;

  @override
  State<ParkingBoard> createState() => _ParkingBoardState();
}

class _Drag {
  _Drag(this.id, this.car, this.from, this.at);
  final int id;
  final int car;
  final int from;
  final Offset at;
  double offset = 0;
}

class _ParkingBoardState extends State<ParkingBoard> {
  _Drag? _gesture;

  @override
  void didUpdateWidget(ParkingBoard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.disabled) _gesture = null;
  }

  double _maxOffset(int index, double requested, double cell) {
    final level = widget.level, state = widget.state;
    final from = state.positions[index], sign = requested.sign.toInt(), car = level.cars[index];
    var max = 0;
    for (var amount = 1; amount <= 6; amount++) {
      final to = from + sign * amount;
      if (to < 0 || to > 6 - car.length || moveParking(level, state, ParkingMove(index, to)) == null) break;
      max = amount;
    }
    if (index == 0 && sign > 0 && moveParking(level, state, const ParkingMove(0, 6)) != null) max = 6 - from;
    return sign * math.min(requested.abs(), max * cell);
  }

  static Color _darken(Color c) => Color.lerp(c, const Color(0xFF000000), .2)!;

  @override
  Widget build(BuildContext context) {
    final level = widget.level, state = widget.state, t = widget.t;
    final short = MediaQuery.sizeOf(context).height <= 610;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Container(
        padding: short ? const EdgeInsets.symmetric(horizontal: 14, vertical: 7) : const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
        decoration: BoxDecoration(
          color: CasualPalette.surface,
          borderRadius: BorderRadius.circular(short ? 19 : 26),
          border: Border.all(color: const Color(0xFFFFFFFF)),
        ),
        child: LayoutBuilder(builder: (context, constraints) {
          final size = math.max(170.0, math.min(420.0, math.min(constraints.maxWidth + 30 - 30, constraints.maxHeight + 20 - 35))).floorToDouble();
          final cell = (size - 6) / 6;
          return Center(
            child: Container(
              key: const ValueKey('parking-board'),
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E9D9),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: const Color(0xFF9BAF9B), width: 3),
                boxShadow: const [BoxShadow(color: Color(0x1669755A), offset: Offset(0, 7), blurRadius: 18)],
              ),
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned.fill(child: CustomPaint(painter: _GridPainter(cell))),
                Positioned(
                  left: size - 6 - 4,
                  top: cell * 2 + 3,
                  width: 26,
                  height: cell - 6,
                  child: Semantics(
                    label: t('exit'),
                    child: Container(
                      decoration: BoxDecoration(
                        color: state.open ? const Color(0xFFD1E9BD) : const Color(0xFFE6D3A6),
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(10)),
                        border: Border(
                          top: BorderSide(color: state.open ? const Color(0xFF9CBA8A) : const Color(0xFFC5B181), width: 2),
                          right: BorderSide(color: state.open ? const Color(0xFF9CBA8A) : const Color(0xFFC5B181), width: 2),
                          bottom: BorderSide(color: state.open ? const Color(0xFF9CBA8A) : const Color(0xFFC5B181), width: 2),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: state.open
                          ? const AIcon(AIcons.arrowRight, size: 18, color: Color(0xFF6D9760))
                          : const AIcon(AIcons.lockKeyhole, size: 16, color: Color(0xFFAD9153)),
                    ),
                  ),
                ),
                if (level.keyBay != null) _keyBay(cell),
                for (var index = 0; index < level.cars.length; index++) _car(index, cell),
              ]),
            ),
          );
        }),
      ),
    );
  }

  Widget _keyBay(double cell) {
    final bay = widget.level.keyBay!, car = widget.level.cars[bay.car];
    final horizontal = car.axis == 'h';
    return Positioned(
      left: (horizontal ? bay.position : car.lane) * cell,
      top: (horizontal ? car.lane : bay.position) * cell,
      width: cell,
      height: cell,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0x55FFF4C8),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFC9A853), width: 2),
        ),
        alignment: Alignment.center,
        child: const AIcon(AIcons.keyRound, size: 18, color: Color(0xFFB59954)),
      ),
    );
  }

  Widget _car(int index, double cell) {
    final level = widget.level, state = widget.state, t = widget.t;
    final car = level.cars[index];
    final from = state.positions[index];
    final dragging = _gesture?.car == index;
    final offset = dragging ? _gesture!.offset : 0.0;
    final horizontal = car.axis == 'h';
    final hint = widget.hint;
    final hinted = hint?.car == index;
    final forward = hinted && hint!.to > from;
    final selected = widget.selected == index;
    final color = parkingCarColors[index % parkingCarColors.length];
    final width = (horizontal ? car.length : 1) * cell - 8, height = (horizontal ? 1 : car.length) * cell - 8;
    final ring = hinted
        ? const Color(0xFFECC653)
        : selected
            ? const Color(0xFFFFF8D1)
            : null;
    final ringGap = hinted ? 2.0 : 1.0;
    Widget wheel(bool first) {
      final pos = horizontal
          ? (first ? Positioned(left: width * .15, top: -3, child: _wheels(true, cell)) : Positioned(right: width * .15, top: -3, child: _wheels(true, cell)))
          : (first ? Positioned(top: height * .15, left: -3, child: _wheels(false, cell)) : Positioned(bottom: height * .15, left: -3, child: _wheels(false, cell)));
      return pos;
    }

    final body = SizedBox(
      width: width,
      height: height,
      child: Stack(clipBehavior: Clip.none, children: [
        wheel(true),
        wheel(false),
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x66FFFFFF)),
              boxShadow: [BoxShadow(color: _darken(color), offset: const Offset(0, 4)), const BoxShadow(color: Color(0x205D6C55), offset: Offset(0, 7), blurRadius: 7)],
            ),
          ),
        ),
        // window and roof
        horizontal
            ? Positioned(right: width * .1, top: height * .17, width: width * .17, height: height * .65, child: _glass(5, const Color(0x66E4F2EE), const Color(0x47EAF7F0)))
            : Positioned(top: height * .1, left: width * .17, width: width * .65, height: height * .17, child: _glass(5, const Color(0x66E4F2EE), const Color(0x47EAF7F0))),
        horizontal
            ? Positioned(left: width * .25, top: height * .15, width: width * .38, height: height * .7, child: _glass(7, const Color(0x16FFFFFF), const Color(0x33FFFFFF)))
            : Positioned(top: height * .25, left: width * .15, height: height * .38, width: width * .7, child: _glass(7, const Color(0x16FFFFFF), const Color(0x33FFFFFF))),
        Center(
          child: index == 0
              ? Transform.translate(
                  offset: const Offset(0, -3),
                  child: Image.asset(CasualArt.parking, width: math.min(36, cell * .72), height: math.min(36, cell * .72), fit: BoxFit.contain, excludeFromSemantics: true),
                )
              : Text(car.id, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0x99FFFFFF))),
        ),
        if (level.keyBay?.car == index) const Positioned(right: 5, bottom: 4, child: AIcon(AIcons.keyRound, size: 13, color: Color(0xFFFFF4B6))),
        if (hinted)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(color: const Color(0x70FEDF94), borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: AIcon(
                horizontal ? (forward ? AIcons.arrowRight : AIcons.arrowLeft) : (forward ? AIcons.arrowDown : AIcons.arrowUp),
                size: 22,
                color: const Color(0xFFFFFFFF),
              ),
            ),
          ),
        if (ring != null)
          Positioned(
            left: -ringGap - 3,
            top: -ringGap - 3,
            right: -ringGap - 3,
            bottom: -ringGap - 3,
            child: IgnorePointer(
              child: Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(12 + ringGap + 3), border: Border.all(color: ring, width: 3))),
            ),
          ),
      ]),
    );

    return AnimatedPositioned(
      key: ValueKey('parking-car-$index'),
      duration: dragging || animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 160),
      curve: Curves.ease,
      left: (horizontal ? from : car.lane) * cell + 4,
      top: (horizontal ? car.lane : from) * cell + 4,
      width: width,
      height: height,
      child: Semantics(
        button: true,
        enabled: !widget.disabled,
        selected: selected,
        label: index == 0 ? CasualArt.qucaqName : '${t(car.length == 3 ? 'bus' : 'cars')} ${car.id}',
        onTap: widget.disabled ? null : () => widget.onSelect(index),
        child: Listener(
          behavior: HitTestBehavior.opaque,
          onPointerDown: (event) {
            if (widget.disabled || _gesture != null || event.buttons & kPrimaryButton == 0) return;
            widget.onSelect(index);
            setState(() => _gesture = _Drag(event.pointer, index, from, event.position));
          },
          onPointerMove: (event) {
            final current = _gesture;
            if (current == null || current.id != event.pointer || widget.disabled) return;
            setState(() => current.offset = _maxOffset(index, horizontal ? event.position.dx - current.at.dx : event.position.dy - current.at.dy, cell));
          },
          onPointerUp: (event) {
            final current = _gesture;
            if (current == null || current.id != event.pointer) return;
            setState(() => _gesture = null);
            var to = current.from + (current.offset / cell).round();
            if (index == 0 && current.offset / cell > 4.7 - current.from && moveParking(level, state, const ParkingMove(0, 6)) != null) to = 6;
            if (to != current.from) widget.onMove(ParkingMove(index, to));
          },
          onPointerCancel: (_) {
            if (_gesture != null) setState(() => _gesture = null);
          },
          child: Transform.translate(offset: horizontal ? Offset(offset, 0) : Offset(0, offset), child: body),
        ),
      ),
    );
  }

  Widget _glass(double radius, Color fill, Color border) =>
      Container(decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(radius), border: Border.all(color: border)));

  /// A wheel and its mirror on the other side (`box-shadow: 0 calc(cell - 6px) #5a665c`).
  Widget _wheels(bool horizontal, double cell) {
    const wheel = Color(0xFF5A665C);
    final w = horizontal ? 12.0 : 5.0, h = horizontal ? 5.0 : 12.0;
    final gap = cell - 6;
    return SizedBox(
      width: horizontal ? w : gap + w,
      height: horizontal ? gap + h : h,
      child: Stack(children: [
        Positioned(left: 0, top: 0, child: _pill(w, h, wheel)),
        Positioned(left: horizontal ? 0 : gap, top: horizontal ? gap : 0, child: _pill(w, h, wheel)),
      ]),
    );
  }

  Widget _pill(double w, double h, Color color) => Container(width: w, height: h, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)));
}

/// `.parking-grid`: 1 px lines every cell.
class _GridPainter extends CustomPainter {
  _GridPainter(this.cell);
  final double cell;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0xAAC6D3BC);
    for (var i = 0; i < 6; i++) {
      canvas.drawRect(Rect.fromLTWH(i * cell, 0, 1, size.height), paint);
      canvas.drawRect(Rect.fromLTWH(0, i * cell, size.width, 1), paint);
    }
  }

  @override
  bool shouldRepaint(_GridPainter oldDelegate) => oldDelegate.cell != cell;
}
