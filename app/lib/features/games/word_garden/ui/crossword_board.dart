// Ported from: src/components/games/word-garden/CrosswordBoard.tsx and the `.wg-crossword`, `.wg-cell*`,
//              `.wg-word-dots` rules of word-garden.css
//
// The crossword: cells sized to the free space (≤ 54 px per column), start numbers, found / revealed / focused
// states, hint mode (tap a hidden cell), and the word chips that highlight an answer without revealing it.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/lexicon.dart' show displayGardenWord;
import '../engine/model.dart';
import '../engine/state.dart';
import 'garden_dialog.dart' show wgText;
import 'garden_theme.dart';

class CrosswordBoard extends StatefulWidget {
  const CrosswordBoard({
    super.key,
    required this.palette,
    required this.level,
    required this.round,
    required this.locale,
    required this.t,
    required this.disabled,
    required this.hintReady,
    required this.onHint,
    required this.recentWord,
  });
  final GardenPalette palette;
  final WordGardenLevel level;
  final GardenRound round;
  final String locale;
  final GardenText t;
  final bool disabled;
  final bool hintReady;
  final ValueChanged<String> onHint;
  final String? recentWord;

  @override
  State<CrosswordBoard> createState() => CrosswordBoardState();
}

class CrosswordBoardState extends State<CrosswordBoard> {
  String? _focusedWord;

  /// The highlighted answer (`.is-focused` cells).
  String? get focusedWord => _focusedWord;

  @override
  Widget build(BuildContext context) {
    final level = widget.level, round = widget.round, p = widget.palette, t = widget.t;
    final visible = visibleGardenCells(level, round);
    final found = round.found.toSet();
    final starts = <String, int>{for (var i = 0; i < level.words.length; i++) cellKey(level.words[i].row, level.words[i].column): i + 1};
    return Column(children: [
      Expanded(
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: LayoutBuilder(builder: (context, constraints) {
            final available = math.max(60.0, constraints.maxHeight - 10);
            final width = math.min(math.min(constraints.maxWidth - 10, available * level.columns / level.rows), level.columns * 54.0).floorToDouble();
            const gap = 4.0;
            final cell = (width - gap * (level.columns - 1)) / level.columns;
            final font = math.max(12.0, math.min(28.0, (width / level.columns - 4) * .54));
            final radius = math.max(5.0, math.min(10.0, MediaQuery.sizeOf(context).width * .018));
            return Center(
              child: SizedBox(
                key: const ValueKey('wordgarden-board'),
                width: width,
                height: cell * level.rows + gap * (level.rows - 1),
                child: Stack(children: [
                  for (final c in level.cells)
                    Positioned(
                      left: c.column * (cell + gap),
                      top: c.row * (cell + gap),
                      width: cell,
                      height: cell,
                      child: _cell(c, visible, found, starts, font, radius),
                    ),
                ]),
              ),
            );
          }),
        ),
      ),
      const SizedBox(height: 6),
      SizedBox(
        height: 30,
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < level.words.length; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            _dot(level.words[i], i, found.contains(level.words[i].id), p, t),
          ],
        ]),
      ),
    ]);
  }

  Widget _cell(GardenCell c, Set<String> visible, Set<String> found, Map<String, int> starts, double font, double radius) {
    final p = widget.palette, t = widget.t, key = cellKey(c.row, c.column);
    final known = visible.contains(key);
    final complete = c.wordIds.any(found.contains);
    final focused = _focusedWord != null && c.wordIds.contains(_focusedWord);
    final justFound = widget.recentWord != null && c.wordIds.contains(widget.recentWord);
    Color bg = p.night ? const Color(0x0BFFFFFF) : p.soft;
    Color border = p.night ? const Color(0x7AADBFB0) : const Color(0x59A2B29C);
    Color fg = p.ink;
    List<BoxShadow> shadow = const [BoxShadow(color: Color(0x20738870), offset: Offset(0, 2))];
    if (complete) {
      bg = p.night ? const Color(0xFF526856) : const Color(0xFFE7F0DF);
      border = p.night ? const Color(0xFFC6D5B8) : const Color(0x57A6C2A0);
      fg = p.night ? const Color(0xFFFFF5E4) : const Color(0xFF335947);
      shadow = const [BoxShadow(color: Color(0xFFB2C7A5), offset: Offset(0, 2))];
    } else if (known) {
      bg = const Color(0xFFFFF4CD);
      fg = const Color(0xFF806927);
    }
    if (p.highContrast) {
      bg = complete ? const Color(0xFFE1EFD6) : const Color(0xFFFFFDF5);
      border = const Color(0xFF66846A);
      fg = const Color(0xFF1C3028);
    }
    if (focused) {
      bg = p.night ? const Color(0xFF705573) : complete ? const Color(0xFFDDEACB) : const Color(0xFFFFE2C3);
      border = p.accent;
      shadow = const [BoxShadow(color: Color(0x33E97F69), spreadRadius: 2)];
    }
    final hinting = widget.hintReady && !known;
    if (hinting) border = p.accent;
    final enabled = widget.hintReady && !known;
    Widget body = Container(
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(radius), border: Border.all(color: border, width: 1.5), boxShadow: shadow),
      child: Stack(children: [
        if (starts.containsKey(key))
          Positioned(
            left: 4,
            top: 3,
            child: Opacity(
              opacity: .8,
              child: Text('${starts[key]}', style: wgText(8, weight: FontWeight.w700, color: complete ? const Color(0xFF8B9989) : p.muted, height: 1)),
            ),
          ),
        Center(child: Text(known ? displayGardenWord(c.letter, widget.locale) : '', style: wgText(font, weight: FontWeight.w900, color: fg, height: 1))),
        if (hinting) Center(child: Opacity(opacity: .8, child: AIcon(AIcons.leaf, size: 12, color: p.accentDeep))),
      ]),
    );
    if (justFound) body = _Bloom(key: ValueKey('bloom:$key:${widget.recentWord}'), child: body);
    return GameButton(
      key: ValueKey('wg-cell-$key'),
      enabled: enabled,
      label: known
          ? t('revealedCell', {'letter': displayGardenWord(c.letter, widget.locale), 'row': c.row + 1, 'column': c.column + 1})
          : t('hiddenCell', {'row': c.row + 1, 'column': c.column + 1}),
      onTap: () => widget.onHint(key),
      child: body,
    );
  }

  Widget _dot(GardenWord word, int index, bool isFound, GardenPalette p, GardenText t) {
    final focused = _focusedWord == word.id;
    final color = focused ? p.accentDeep : isFound ? p.leaf : p.muted;
    return GameButton(
      key: ValueKey('wg-word-${index + 1}'),
      enabled: !widget.disabled,
      selected: focused,
      label: isFound ? displayGardenWord(word.word, widget.locale) : t('wordLabel', {'number': index + 1, 'length': word.letters.length}),
      onTap: () => setState(() => _focusedWord = focused ? null : word.id),
      child: Container(
        constraints: const BoxConstraints(minWidth: 32, minHeight: 30),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
        decoration: BoxDecoration(
          color: isFound ? (p.night ? const Color(0xFF435B4D) : const Color(0xFFE7F0DF)) : p.soft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: focused ? p.accent : isFound ? const Color(0x66A2B69B) : const Color(0x30879B80)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (isFound)
            AIcon(AIcons.check, size: 12, color: p.night ? const Color(0xFFEDF6DD) : color)
          else
            Opacity(opacity: .55, child: Text('${index + 1}', style: wgText(7, color: color, height: 1))),
          const SizedBox(width: 4),
          Text('${word.letters.length}', style: wgText(10, color: isFound && p.night ? const Color(0xFFEDF6DD) : color, height: 1)),
        ]),
      ),
    );
  }
}

/// `@keyframes wg-cell-bloom` (0.65 s): scale .82 → 1.08 → 1, opacity .3 → 1.
class _Bloom extends StatefulWidget {
  const _Bloom({super.key, required this.child});
  final Widget child;
  @override
  State<_Bloom> createState() => _BloomState();
}

class _BloomState extends State<_Bloom> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 650))..forward();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (animationsDisabled(context)) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final v = Curves.ease.transform(_c.value);
        final scale = v < .55 ? .82 + (1.08 - .82) * (v / .55) : 1.08 - .08 * ((v - .55) / .45);
        return Opacity(opacity: (.3 + .7 * math.min(1, v / .55)).clamp(0, 1).toDouble(), child: Transform.scale(scale: scale, child: child));
      },
      child: widget.child,
    );
  }
}
