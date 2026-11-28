// Ported from: src/components/games/iki-dost/FriendsBoard.tsx and the `.tf-boards`, `.tf-world*`, `.tf-tile*`,
//              `.tf-gate`, `.tf-actor` rules of two-friends.css
//
// The two worlds (Ritm above, Tumurcuq below), always laid out left-to-right (physical directions stay LTR in
// Arabic), with keys, key gates, pressure plates / plate gates, water, homes and the animated friends; a swipe
// of at least 22 px moves both friends.
library;

import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../engine/engine.dart';
import 'friends_ui.dart';

class FriendsBoard extends StatefulWidget {
  const FriendsBoard({super.key, required this.level, required this.state, required this.t, required this.disabled, required this.onDirection});
  final FriendsLevel level;
  final FriendsState state;
  final FriendsText t;
  final bool disabled;
  final ValueChanged<String> onDirection;

  @override
  State<FriendsBoard> createState() => _FriendsBoardState();
}

class _FriendsBoardState extends State<FriendsBoard> {
  ({int id, Offset at})? _start;

  void _up(PointerUpEvent event) {
    final start = _start;
    if (widget.disabled || start == null || start.id != event.pointer) return;
    final dx = event.position.dx - start.at.dx, dy = event.position.dy - start.at.dy;
    _start = null;
    if (math.max(dx.abs(), dy.abs()) < 22) return;
    widget.onDirection(dx.abs() > dy.abs()
        ? dx > 0
            ? 'right'
            : 'left'
        : dy > 0
            ? 'down'
            : 'up');
  }

  @override
  Widget build(BuildContext context) {
    final level = widget.level;
    final columns = level.worlds[0].rows[0].length, rows = level.worlds[0].rows.length;
    return Directionality(
      key: const ValueKey('friends-boards'),
      textDirection: TextDirection.ltr,
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: (event) {
          if (!widget.disabled && event.buttons & kPrimaryButton != 0) _start = (id: event.pointer, at: event.position);
        },
        onPointerUp: _up,
        onPointerCancel: (_) => _start = null,
        child: LayoutBuilder(builder: (context, constraints) {
          final short = MediaQuery.sizeOf(context).height <= 610;
          final cell = math
              .max(18.0, math.min(55.0, math.min((constraints.maxWidth - 24) / columns, (constraints.maxHeight - (short ? 84 : 110)) / (rows * 2))))
              .floorToDouble();
          return Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var side = 0; side < 2; side++) ...[
              if (side > 0) SizedBox(height: short ? 6 : 8),
              _world(side, cell, columns, rows, short),
            ],
          ]);
        }),
      ),
    );
  }

  Widget _world(int side, double cell, int columns, int rows, bool short) {
    final level = widget.level, state = widget.state, t = widget.t;
    final world = level.worlds[side];
    final plates = friendsPlateMask(level, state), home = friendsAtHome(level, state);
    final actor = friendPosition(world, state.positions[side]);
    final name = friendNames[side];
    final second = side == 1;
    final lost = friendCell(world, state.positions[side]) == '!';
    return Semantics(
      label: name,
      container: true,
      child: Container(
        padding: short ? const EdgeInsets.fromLTRB(7, 3, 7, 5) : const EdgeInsets.fromLTRB(9, 6, 9, 8),
        decoration: BoxDecoration(
          color: second ? const Color(0xE8FAF6FF) : const Color(0xE8FFFAF3),
          borderRadius: BorderRadius.circular(short ? 16 : 23),
          border: Border.all(color: const Color(0xFFFFFFFF)),
          boxShadow: const [BoxShadow(color: Color(0x0B5A7355), offset: Offset(0, 4), blurRadius: 17)],
        ),
        child: Column(children: [
          SizedBox(
            height: short ? 25 : 31,
            child: Row(children: [
              Image.asset(friendsArtAssets[side], width: short ? 25 : 30, height: short ? 25 : 30, fit: BoxFit.contain, excludeFromSemantics: true),
              const SizedBox(width: 4),
              Text(name, style: tfText(short ? 10 : 12, weight: FontWeight.w900, color: second ? const Color(0xFF966BB5) : const Color(0xFFCC6963))),
              const Spacer(),
              AIcon(home[side] ? AIcons.check : AIcons.house, size: 12, color: home[side] ? FriendsPalette.green : FriendsPalette.muted),
              const SizedBox(width: 4),
              Text(t(home[side] ? 'home' : 'journey'),
                  style: tfText(short ? 8 : 9, weight: home[side] ? FontWeight.w900 : FontWeight.w400, color: home[side] ? FriendsPalette.green : FriendsPalette.muted)),
            ]),
          ),
          SizedBox(height: short ? 1 : 3),
          Container(
            key: ValueKey('friends-board-$side'),
            width: columns * cell,
            height: rows * cell,
            decoration: BoxDecoration(color: second ? const Color(0xFFE8E0ED) : const Color(0xFFE5E9D9), borderRadius: BorderRadius.circular(13)),
            child: Stack(clipBehavior: Clip.none, children: [
              for (var r = 0; r < rows; r++)
                for (var c = 0; c < columns; c++)
                  Positioned(left: c * cell, top: r * cell, width: cell, height: cell, child: _tile(world.rows[r][c], r * columns + c, side, cell, plates)),
              AnimatedPositioned(
                key: ValueKey('friend-$side'),
                duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 130),
                curve: Curves.easeOut,
                left: actor.column * cell,
                top: actor.row * cell,
                width: cell,
                height: cell,
                child: IgnorePointer(
                  child: OverflowBox(
                    maxWidth: cell * 1.35,
                    maxHeight: cell * 1.35,
                    child: Opacity(
                      opacity: lost ? .65 : 1,
                      child: Transform.translate(
                        offset: Offset(0, lost ? cell * 1.35 * .03 : -cell * 1.35 * .08),
                        child: Transform.rotate(
                          angle: lost ? -17 * math.pi / 180 : 0,
                          child: Transform.scale(
                            scale: lost ? .86 : 1,
                            child: Container(
                              decoration: home[side]
                                  ? const BoxDecoration(boxShadow: [BoxShadow(color: Color(0x55FFD586), blurRadius: 8)], shape: BoxShape.circle)
                                  : null,
                              child: Image.asset(friendsArtAssets[side], fit: BoxFit.contain, semanticLabel: name),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _tile(String tile, int position, int side, double cell, int plates) {
    final state = widget.state, t = widget.t;
    final second = side == 1;
    final held = state.positions[side] == position;
    final keyGone = (tile == 'k' && state.keys & 1 != 0) || (tile == 'l' && state.keys & 2 != 0);
    final open = friendsDoorOpen(tile, state, plates);
    final channel = const ['l', 'L', 'b', 'B'].contains(tile) ? 2 : 1;
    final gate = const ['A', 'B', 'K', 'L'].contains(tile);
    Color bg = second ? const Color(0xFFFCF8FF) : const Color(0xFFFAFBF1);
    Color border = second ? const Color(0xFFEEE2F3) : const Color(0xFFE2E8D3);
    Color fg = FriendsPalette.ink;
    Gradient? gradient;
    double radius = 5;
    Widget? icon;
    final iconSize = math.max(13.0, cell * .48);
    if (tile == '#') {
      gradient = LinearGradient(
        begin: const Alignment(-0.57, -0.82),
        end: const Alignment(0.57, 0.82),
        colors: second ? const [Color(0xFFB7A7C3), Color(0xFF9C8FAE)] : const [Color(0xFFA8B49B), Color(0xFF90A28A)],
      );
      border = const Color(0x6BEDF1E0);
      radius = 7;
    } else if (tile == '!') {
      bg = const Color(0xFFA9D3DA);
      border = const Color(0xFFD7EDF0);
      fg = const Color(0xFF619DA8);
      icon = AIcon(AIcons.waves, size: math.max(12, cell * .5), color: fg);
    } else if (tile == 'H') {
      bg = second ? const Color(0xFFE7C8ED) : const Color(0xFFF9D9A7);
      border = second ? const Color(0xFFD4B0DF) : const Color(0xFFEFC68B);
      fg = second ? const Color(0xFF9872B2) : const Color(0xFFAD7C47);
      icon = AIcon(AIcons.house, size: math.max(16, cell * .62), color: fg);
    } else if (tile == 'k' || tile == 'l') {
      bg = const Color(0xFFFFF4C3);
      border = const Color(0xFFF0DE96);
      fg = const Color(0xFFB69740);
      if (!keyGone) icon = AIcon(AIcons.keyRound, size: iconSize, color: fg);
    } else if (gate) {
      final keyGate = tile == 'K' || tile == 'L';
      bg = open ? const Color(0xFFEEF4DF) : keyGate ? const Color(0xFFECD9A8) : const Color(0xFFCDE0D1);
      border = keyGate ? const Color(0xFFC5AA61) : const Color(0xFF85A88C);
      fg = keyGate ? const Color(0xFFA58B4E) : const Color(0xFF5E8E6C);
      icon = AIcon(keyGate ? AIcons.lockKeyhole : AIcons.circleDot, size: iconSize, color: fg);
    } else if (tile == 'a' || tile == 'b') {
      bg = held ? const Color(0xFFC6DEA9) : const Color(0xFFE6EEDB);
      border = held ? const Color(0xFF7BA465) : const Color(0xFFB2C69B);
      fg = const Color(0xFF71975F);
      icon = AIcon(AIcons.circleDot, size: iconSize, color: fg);
    }
    final showChannel = (icon != null && const ['k', 'l', 'K', 'L', 'a', 'b', 'A', 'B'].contains(tile));
    Widget body = Container(
      key: ValueKey('tile-$side-$position'),
      decoration: BoxDecoration(
        color: gradient == null ? bg : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: border, width: 1.5),
        boxShadow: held && (tile == 'a' || tile == 'b') ? const [BoxShadow(color: Color(0x339BBD7B), spreadRadius: 2)] : null,
      ),
      child: Stack(children: [
        if (icon != null) Center(child: icon),
        if (showChannel)
          Positioned(
            right: 2,
            bottom: 1,
            child: Text(t.number(channel), style: tfText(math.max(7, cell * .21), weight: FontWeight.w900, color: fg, height: 1)),
          ),
      ]),
    );
    if (gate && open) body = Opacity(opacity: .5, child: body);
    return body;
  }
}
