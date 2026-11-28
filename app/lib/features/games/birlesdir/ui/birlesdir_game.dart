// Ported from: src/components/games/birlesdir/BirlesdirGame.tsx
//
// Match-3 on an 8 × 8 board: tap two neighbours or swipe a tile (≥ 18 px), cascades resolved with the React
// delays (140 ms before the first resolution, 160 ms between cascade steps, 360 ms after each, 450 + 500 ms
// around a reshuffle, 230 ms swap-back on an invalid swap), move bonus on a win and the rewarded +moves revive.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../casual/ui/game_platform.dart';
import '../../common/engine/js.dart';
import '../../saglam_sebet/ui/arcade_widgets.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_registry.dart' show GameLevelResult;
import '../../ui_common/game_revive_action.dart';
import '../engine/level_config.dart';
import '../engine/match_engine.dart';

const LinearGradient _violetFuchsia = LinearGradient(colors: [TwColors.violet500, TwColors.fuchsia500]);

class BirlesdirGame extends ConsumerStatefulWidget {
  const BirlesdirGame({
    super.key,
    required this.level,
    required this.onExit,
    required this.onLevelComplete,
    this.onNextLevel,
    this.levelConfig = getBirlesdirLevelConfig,
    this.random,
  });
  final int level;
  final VoidCallback onExit;
  final ValueChanged<GameLevelResult> onLevelComplete;
  final VoidCallback? onNextLevel;

  /// `getLevelConfig` (tests shorten rounds like the vitest module mock).
  final BirlesdirLevelConfig Function(int level) levelConfig;

  /// `Math.random` (tests inject a seeded stream).
  final JsRandom? random;

  @override
  ConsumerState<BirlesdirGame> createState() => BirlesdirGameState();
}

class BirlesdirGameState extends ConsumerState<BirlesdirGame> {
  late final BirlesdirLevelConfig config = widget.levelConfig(widget.level);
  late final int typeCount = getTilePool(config.tileTypesCount).length;
  late final Match3 _engine = Match3(random: widget.random);
  late final GameAdsController _ads;

  String _phase = 'intro';
  Board _board = [];
  int _score = 0;
  late int _movesLeft = config.movesLimit;
  Pos? _selected;
  List<Pos>? _invalidPair;
  bool _busy = false;
  ({String label, String emoji, String key})? _bonusBanner;
  bool _shuffleNotice = false;
  int _finalStars = 0;
  int _moveBonus = 0;
  int _gen = 0;
  bool _completed = false;
  bool _alive = true;
  final List<Timer> _pending = [];
  ({int row, int col, Offset start, bool moved})? _drag;

  /// `data-game-phase`, `data-game-moves`, `data-game-score`.
  String get phase => _phase;
  int get movesLeft => _movesLeft;
  int get score => _score;
  Board get board => _board;
  bool get busy => _busy;

  @override
  void initState() {
    super.initState();
    _ads = GameAdsController(gameId: birlesdirId, platform: ref.read(gameAdsPlatformProvider), phase: _phase, restore: _restoreRound);
    _ads.addListener(_onAds);
  }

  void _onAds() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _alive = false;
    _gen++;
    for (final timer in _pending) {
      timer.cancel();
    }
    _ads.removeListener(_onAds);
    _ads.dispose();
    super.dispose();
  }

  Future<void> _sleep(int ms) {
    final completer = Completer<void>();
    late final Timer timer;
    timer = Timer(Duration(milliseconds: ms), () {
      _pending.remove(timer);
      completer.complete();
    });
    _pending.add(timer);
    return completer.future;
  }

  void _after(int ms, VoidCallback action) {
    late final Timer timer;
    timer = Timer(Duration(milliseconds: ms), () {
      _pending.remove(timer);
      if (_alive) action();
    });
    _pending.add(timer);
  }

  void _setPhase(String value) {
    _phase = value;
    _ads.update(phase: value, restore: _restoreRound);
    if (value == 'lost' && !_completed) {
      _completed = true;
      widget.onLevelComplete(GameLevelResult(level: widget.level, score: _score, stars: 0, passed: false));
    }
  }

  /// Applies [change], then runs the win/lose watcher (effect on score, moves, busy, phase).
  void _update(VoidCallback change) {
    if (!_alive) return;
    setState(change);
    _evaluate();
  }

  void _evaluate() {
    if (_phase != 'playing' || _busy) return;
    if (_score >= config.targetScore) {
      final perMoveBonus = math.max(12, jsRound(55 * config.scoreMultiplier));
      final bonus = math.max(0, _movesLeft) * perMoveBonus;
      final finalScore = _score + bonus;
      final stars = getBirlesdirStarsForScore(finalScore, config.targetScore);
      setState(() {
        _moveBonus = bonus;
        _score = finalScore;
        _finalStars = stars;
        _setPhase('won');
      });
      if (!_completed) {
        _completed = true;
        widget.onLevelComplete(GameLevelResult(level: widget.level, score: finalScore, stars: stars, passed: true));
      }
      unawaited(ref.read(gameHapticsProvider).medium());
      return;
    }
    if (_movesLeft <= 0) setState(() => _setPhase('lost'));
  }

  void _restoreRound(GameReviveBenefits benefits) {
    _gen++;
    _completed = false;
    _update(() {
      _movesLeft = math.max(0, _movesLeft) + benefits.moves;
      _busy = false;
      _selected = null;
      _invalidPair = null;
      _setPhase('playing');
    });
  }

  void _triggerBonusBanner(List<SpecialEvent> events) {
    if (events.isEmpty) return;
    final info = bonusNames[events.first.kind]!;
    final key = '${DateTime.now().microsecondsSinceEpoch}-${math.Random().nextDouble()}';
    _bonusBanner = (label: tr(info.key, info.name), emoji: info.emoji, key: key);
    _after(850, () => setState(() {
          if (_bonusBanner?.key == key) _bonusBanner = null;
        }));
  }

  Future<void> _resolveFrom(Board startBoard, ResolutionStep? firstResolved) async {
    final gen = _gen;
    bool stale() => _gen != gen || !_alive;
    var current = startBoard;
    var cascadeIndex = 0;
    if (firstResolved != null) {
      final gained = computeScore(firstResolved.clearedCount, 0, firstResolved.events, config.scoreMultiplier);
      current = firstResolved.board;
      final board = current;
      _update(() {
        _score += gained;
        _board = board;
        if (firstResolved.events.isNotEmpty) _triggerBonusBanner(firstResolved.events);
      });
      if (firstResolved.events.isNotEmpty) unawaited(ref.read(gameHapticsProvider).medium());
      cascadeIndex = 1;
      await _sleep(360);
      if (stale()) return;
    }
    while (true) {
      final matchResult = findMatchGroups(current);
      if (matchResult.groups.isEmpty) break;
      await _sleep(160);
      if (stale()) return;
      final step = _engine.applyMatchResult(current, matchResult, typeCount);
      final gained = computeScore(step.clearedCount, cascadeIndex, step.events, config.scoreMultiplier);
      current = step.board;
      final board = current;
      _update(() {
        _score += gained;
        _board = board;
        if (step.events.isNotEmpty) _triggerBonusBanner(step.events);
      });
      if (step.events.isNotEmpty) unawaited(ref.read(gameHapticsProvider).medium());
      cascadeIndex++;
      await _sleep(360);
      if (stale()) return;
    }
    if (!hasAnyPossibleMove(current, typeCount)) {
      await _sleep(450);
      if (stale()) return;
      current = _engine.reshuffleBoard(current, typeCount);
      final board = current;
      _update(() {
        _board = board;
        _shuffleNotice = true;
      });
      _after(1400, () => setState(() => _shuffleNotice = false));
      await _sleep(500);
      if (stale()) return;
    }
    _update(() => _busy = false);
  }

  Future<void> _attemptSwap(Pos a, Pos b) async {
    if (_busy || _phase != 'playing') return;
    final gen = _gen;
    final board = _board;
    final tileA = board[a.row][a.col], tileB = board[b.row][b.col];
    if (tileA?.special == 'color-bomb' || tileB?.special == 'color-bomb') {
      _update(() {
        _busy = true;
        _selected = null;
        _movesLeft--;
      });
      unawaited(ref.read(gameHeavyHapticProvider)());
      final step = _engine.activateColorBombSwap(board, a, b, typeCount);
      await _resolveFrom(board, step);
      return;
    }
    final swapped = swap(board, a, b);
    final matchResult = findMatchGroups(swapped, [a, b]);
    if (matchResult.groups.isEmpty) {
      _update(() {
        _busy = true;
        _selected = null;
        _invalidPair = [a, b];
        _board = swapped;
      });
      await _sleep(230);
      if (_gen != gen || !_alive) return;
      _update(() {
        _board = board;
        _invalidPair = null;
        _busy = false;
      });
      return;
    }
    _update(() {
      _busy = true;
      _selected = null;
      _movesLeft--;
      _board = swapped;
    });
    unawaited(ref.read(gameHapticsProvider).light());
    await _sleep(140);
    if (_gen != gen || !_alive) return;
    final step = _engine.applyMatchResult(swapped, matchResult, typeCount);
    await _resolveFrom(swapped, step);
  }

  void _handleTap(Pos pos) {
    if (_busy || _phase != 'playing') return;
    final selected = _selected;
    if (selected == null) {
      setState(() => _selected = pos);
      unawaited(ref.read(gameHapticsProvider).light());
      return;
    }
    if (selected == pos) {
      setState(() => _selected = null);
      return;
    }
    if (isAdjacent(selected, pos)) {
      unawaited(_attemptSwap(selected, pos));
    } else {
      setState(() => _selected = pos);
      unawaited(ref.read(gameHapticsProvider).light());
    }
  }

  void _resetGame() {
    _gen++;
    _completed = false;
    _board = _engine.createBoard(boardRows, boardCols, typeCount);
    _score = 0;
    _movesLeft = config.movesLimit;
    _selected = null;
    _invalidPair = null;
    _busy = false;
    _bonusBanner = null;
    _shuffleNotice = false;
    _finalStars = 0;
    _moveBonus = 0;
  }

  void _startGame() => _update(() {
        _resetGame();
        _setPhase('playing');
      });

  void _retry() => unawaited(_ads.transition(() {
        if (!_alive) return;
        _update(() {
          _resetGame();
          _ads.resetRound();
          _setPhase('playing');
        });
      }));

  void _exit() => unawaited(_ads.transition(widget.onExit));

  // Pointer handling on the board: tap = select, a drag ≥ 18 px swaps towards the drag direction.
  Pos? _cellAt(Offset local, double cell) {
    const gap = 5.0;
    final colWidth = (_boardWidth - gap * (boardCols - 1)) / boardCols;
    final col = (local.dx / (colWidth + gap)).floor();
    final row = (local.dy / (cell + gap)).floor();
    if (row < 0 || row >= boardRows || col < 0 || col >= boardCols) return null;
    if (local.dx - col * (colWidth + gap) > cell || local.dy - row * (cell + gap) > cell) return null;
    return Pos(row, col);
  }

  double _boardWidth = 0;

  void _pointerDown(Offset local, double cell) {
    final pos = _cellAt(local, cell);
    if (pos == null || _board.isEmpty || _board[pos.row][pos.col] == null) return;
    _drag = (row: pos.row, col: pos.col, start: local, moved: false);
  }

  void _pointerMove(Offset local) {
    final drag = _drag;
    if (drag == null || drag.moved) return;
    final dx = local.dx - drag.start.dx, dy = local.dy - drag.start.dy;
    if (math.sqrt(dx * dx + dy * dy) < 18) return;
    _drag = (row: drag.row, col: drag.col, start: drag.start, moved: true);
    final target = dx.abs() > dy.abs() ? Pos(drag.row, drag.col + (dx > 0 ? 1 : -1)) : Pos(drag.row + (dy > 0 ? 1 : -1), drag.col);
    if (target.row >= 0 && target.row < boardRows && target.col >= 0 && target.col < boardCols) {
      setState(() => _selected = null);
      unawaited(_attemptSwap(Pos(drag.row, drag.col), target));
    }
  }

  void _pointerUp() {
    final drag = _drag;
    if (drag != null && !drag.moved) _handleTap(Pos(drag.row, drag.col));
    _drag = null;
  }

  @override
  Widget build(BuildContext context) {
    _ads.update(phase: _phase, restore: _restoreRound);
    final tokens = AnacanTokens.of(context);
    final s = tokens.shadcn;
    final targetProgress = math.min(100, jsRound(_score / config.targetScore * 100));
    final levelLabel = '${tr('birlesdir_level_label', 'Səviyyə')} ${widget.level}';
    final movesShort = tr('birlesdir_moves_short', 'gediş');

    final hud = ArcadeHud(children: [
      Row(children: [
        ArcadeHudButton(
          playing: _phase == 'playing',
          label: _phase == 'playing' ? tr('birlesdir_paused_title', 'Fasilə') : tr('birlesdir_menu_button', 'Menyu'),
          onTap: () => _phase == 'playing' ? setState(() => _setPhase('paused')) : _exit(),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(levelLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.foreground))),
              AIcon(AIcons.target, size: 12, color: s.mutedForeground),
              const SizedBox(width: 4),
              Text('$_movesLeft $movesShort', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.mutedForeground)),
            ]),
            const SizedBox(height: 4),
            ArcadeProgressBar(percent: targetProgress, fill: _violetFuchsia),
          ]),
        ),
      ]),
      const SizedBox(height: 6),
      Row(children: [
        Expanded(
          child: Text('${tr('birlesdir_target_prefix', 'Hədəf')}: ${config.targetScore}', style: TextStyle(fontSize: 10, color: s.mutedForeground)),
        ),
        Text('$_score', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: TwColors.violet600)),
      ]),
    ]);

    final body = Stack(children: [
      Positioned.fill(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Center(child: _phase != 'intro' ? _boardView(tokens) : const SizedBox.shrink()),
        ),
      ),
      Positioned(
        top: 16,
        left: 0,
        right: 0,
        child: IgnorePointer(
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _bonusBanner == null ? const SizedBox.shrink() : _BonusBanner(key: ValueKey(_bonusBanner!.key), emoji: _bonusBanner!.emoji, label: _bonusBanner!.label),
            ),
          ),
        ),
      ),
      if (_shuffleNotice)
        Positioned(
          bottom: 16,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 300),
                builder: (context, t, child) => Opacity(opacity: t, child: child),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: s.muted,
                    borderRadius: BorderRadius.circular(9999),
                    boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 1), blurRadius: 3), BoxShadow(color: Color(0x1A000000), offset: Offset(0, 1), blurRadius: 2, spreadRadius: -1)],
                  ),
                  child: Text(tr('birlesdir_shuffle_notice', 'Lövhə qarışdırıldı 🔄'),
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: s.mutedForeground)),
                ),
              ),
            ),
          ),
        ),
      if (_phase == 'intro') _intro(levelLabel, movesShort),
      if (_phase == 'paused')
        ArcadeOverlay(horizontalPadding: 0, children: [
          ArcadeTitle(tr('birlesdir_paused_title', 'Fasilə'), large: false),
          ArcadeButton(width: 192, gradient: _violetFuchsia, icon: AIcons.play, label: tr('birlesdir_resume_button', 'Davam et'), onTap: () => setState(() => _setPhase('playing'))),
          ArcadeButton(width: 192, style: ArcadeButtonStyle.muted, icon: AIcons.rotateCcw, label: tr('birlesdir_restart_button', 'Yenidən başla'), onTap: _retry),
          ArcadeButton(width: 192, style: ArcadeButtonStyle.muted, icon: AIcons.house, label: tr('birlesdir_menu_button', 'Menyu'), onTap: _exit),
        ]),
      if (_phase == 'won')
        ArcadeOverlay(opacity: 0.95, gap: 8, children: [
          const ArcadeTrophy(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [TwColors.violet400, TwColors.fuchsia500])),
          ArcadeTitle(tr('birlesdir_level_complete_title', 'Səviyyə tamamlandı!')),
          ArcadeStars(stars: _finalStars),
          ArcadeScoreLine(prefix: tr('birlesdir_your_score_prefix', 'Xalınız'), score: _score),
          if (_moveBonus > 0)
            Text('+$_moveBonus ${tr('birlesdir_move_bonus_label', 'gediş bonusu')} ✨',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: TwColors.violet600)),
          ArcadeActions(children: [
            if (widget.level < birlesdirTotalLevels && widget.onNextLevel != null)
              ArcadeButton(gradient: _violetFuchsia, label: tr('birlesdir_next_level_button', 'Növbəti səviyyə'), onTap: () => unawaited(_ads.transition(widget.onNextLevel!))),
            ArcadeButton(style: ArcadeButtonStyle.muted, icon: AIcons.rotateCcw, label: tr('birlesdir_replay_button', 'Təkrar oyna'), onTap: _retry),
            ArcadeButton(style: ArcadeButtonStyle.faint, icon: AIcons.house, label: tr('birlesdir_menu_button', 'Menyu'), onTap: _exit),
          ]),
        ]),
      if (_phase == 'lost')
        ArcadeOverlay(opacity: 0.95, gap: 8, children: [
          const ArcadeSadFace(),
          ArcadeTitle(tr('birlesdir_out_of_moves_title', 'Gedişlər bitdi!')),
          ArcadeScoreLine(prefix: tr('birlesdir_your_score_prefix', 'Xalınız'), score: _score, target: config.targetScore),
          ArcadeActions(children: [
            GameReviveAction(ads: _ads, game: 'match'),
            ArcadeButton(gradient: _violetFuchsia, icon: AIcons.rotateCcw, label: tr('birlesdir_retry_button', 'Yenidən cəhd et'), onTap: _retry),
            ArcadeButton(style: ArcadeButtonStyle.muted, icon: AIcons.house, label: tr('birlesdir_menu_button', 'Menyu'), onTap: _exit),
          ]),
        ]),
    ]);

    return ArcadeFrame(
      light: const [TwColors.violet50, TwColors.rose50, TwColors.amber50],
      dark: const [TwColors.slate900, TwColors.slate900, TwColors.slate800],
      hud: hud,
      body: body,
    );
  }

  Widget _boardView(AnacanTokens tokens) => LayoutBuilder(builder: (context, constraints) {
        const gap = 5.0;
        final width = math.min(constraints.maxWidth, 480.0);
        _boardWidth = width;
        final cell = ((width - gap * (boardCols - 1)) / boardCols).floorToDouble();
        final colWidth = (width - gap * (boardCols - 1)) / boardCols;
        final height = boardRows * cell + (boardRows - 1) * gap;
        final children = <Widget>[];
        for (var r = 0; r < _board.length; r++) {
          for (var c = 0; c < _board[r].length; c++) {
            final tile = _board[r][c];
            if (tile == null) continue;
            final def = tile.type >= 0 && tile.type < tileDefs.length ? tileDefs[tile.type] : tileDefs[0];
            final isSelected = _selected?.row == r && _selected?.col == c;
            final isInvalid = _invalidPair?.any((p) => p.row == r && p.col == c) ?? false;
            children.add(_TileView(
              key: ValueKey(tile.id),
              position: Offset(c * (colWidth + gap), r * (cell + gap)),
              size: cell,
              selected: isSelected,
              invalid: isInvalid,
              special: tile.special,
              emoji: def.emoji,
              tokens: tokens,
            ));
          }
        }
        return Listener(
          behavior: HitTestBehavior.opaque,
          onPointerDown: (e) => _pointerDown(e.localPosition, cell),
          onPointerMove: (e) => _pointerMove(e.localPosition),
          onPointerUp: (_) => _pointerUp(),
          onPointerCancel: (_) => _drag = null,
          child: SizedBox(key: const ValueKey('birlesdir-board'), width: width, height: height, child: Stack(clipBehavior: Clip.none, children: children)),
        );
      });

  Widget _intro(String levelLabel, String movesShort) {
    final muted = AnacanTokens.of(context).shadcn.mutedForeground;
    return ArcadeOverlay(children: [
      const ArcadeEmblem(icon: AIcons.puzzle, gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [TwColors.violet500, TwColors.fuchsia500])),
      ArcadeChip(trTierName(config.tierName)),
      ArcadeTitle(levelLabel),
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 260),
        child: Text(
          tr('birlesdir_intro_desc', '3 və ya daha çox eyni əşyanı yan-yana gətir, "Sakitlik Anı" və "Super Ana" bonuslarını aç!'),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, height: 20 / 14, color: muted),
        ),
      ),
      ArcadeStatRow(items: [
        (AIcons.trophy, TwColors.amber500, '${config.targetScore} ${tr('birlesdir_points_short', 'xal')}'),
        (AIcons.target, null, '${config.movesLimit} $movesShort'),
      ]),
      Wrap(spacing: 12, alignment: WrapAlignment.center, children: [
        Text('⭐⭐ ≥ ${(config.targetScore * 1.2).ceil()}', style: TextStyle(fontSize: 11, color: muted)),
        Text('⭐⭐⭐ ≥ ${(config.targetScore * 1.5).ceil()}', style: TextStyle(fontSize: 11, color: muted)),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: ArcadeButton(horizontalPadding: 32, gradient: _violetFuchsia, label: tr('birlesdir_start_button', 'Başla'), onTap: _startGame),
      ),
    ]);
  }
}

class _BonusBanner extends StatelessWidget {
  const _BonusBanner({super.key, required this.emoji, required this.label});
  final String emoji;
  final String label;
  @override
  Widget build(BuildContext context) => ArcadeSpringIn(
        spring: ASprings.spring(stiffness: 300, damping: 18),
        child: Transform.scale(
          scale: 1.05,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              gradient: _violetFuchsia,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5),
                BoxShadow(color: Color(0x1A000000), offset: Offset(0, 8), blurRadius: 10, spreadRadius: -6),
              ],
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(emoji, style: const TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF))),
            ]),
          ),
        ),
      );
}

/// One `motion.div layout` tile: springs (380 / 26) to its new cell, scales in from 0.4 when created, grows to
/// 1.1 when selected and shakes (x 0 → −4 → 4 → −4 → 0) on an invalid swap.
class _TileView extends StatefulWidget {
  const _TileView({
    super.key,
    required this.position,
    required this.size,
    required this.selected,
    required this.invalid,
    required this.special,
    required this.emoji,
    required this.tokens,
  });
  final Offset position;
  final double size;
  final bool selected;
  final bool invalid;
  final String? special;
  final String emoji;
  final AnacanTokens tokens;

  @override
  State<_TileView> createState() => _TileViewState();
}

class _TileViewState extends State<_TileView> with TickerProviderStateMixin {
  static final SpringDescription _spring = ASprings.spring(stiffness: 380, damping: 26);
  late final AnimationController _move = AnimationController.unbounded(vsync: this, value: 1);
  late final AnimationController _enter = AnimationController.unbounded(vsync: this);
  late final AnimationController _scale = AnimationController.unbounded(vsync: this, value: 1);
  late final AnimationController _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late Offset _from = widget.position;
  late Offset _to = widget.position;

  @override
  void initState() {
    super.initState();
    _enter.animateWith(SpringSimulation(_spring, 0, 1, 0));
    if (widget.selected) _scale.value = 1.1;
    if (widget.invalid) _shake.forward();
  }

  @override
  void didUpdateWidget(_TileView old) {
    super.didUpdateWidget(old);
    if (widget.position != old.position) {
      final current = Offset.lerp(_from, _to, _move.value)!;
      _from = current;
      _to = widget.position;
      _move.value = 0;
      _move.animateWith(SpringSimulation(_spring, 0, 1, 0));
    }
    if (widget.selected != old.selected) {
      _scale.animateWith(SpringSimulation(_spring, _scale.value, widget.selected ? 1.1 : 1, _scale.velocity));
    }
    if (widget.invalid && !old.invalid) _shake.forward(from: 0);
  }

  @override
  void dispose() {
    _move.dispose();
    _enter.dispose();
    _scale.dispose();
    _shake.dispose();
    super.dispose();
  }

  double _shakeX(double t) {
    const frames = [0.0, -4.0, 4.0, -4.0, 0.0];
    final f = t * (frames.length - 1);
    final i = f.floor().clamp(0, frames.length - 2);
    return frames[i] + (frames[i + 1] - frames[i]) * (f - i);
  }

  @override
  Widget build(BuildContext context) {
    final reduce = animationsDisabled(context);
    final s = widget.tokens.shadcn;
    final size = widget.size;
    final tile = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: s.card.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: widget.selected ? s.primary : s.border.withValues(alpha: 0.3), width: widget.selected ? 2 : 1),
        boxShadow: widget.selected ? s.shadowGlow : null,
      ),
      alignment: Alignment.center,
      child: _content(),
    );
    return AnimatedBuilder(
      animation: Listenable.merge([_move, _enter, _scale, _shake]),
      builder: (context, child) {
        final pos = reduce ? widget.position : Offset.lerp(_from, _to, _move.value)!;
        final enter = reduce ? 1.0 : _enter.value;
        final scale = (reduce ? (widget.selected ? 1.1 : 1.0) : _scale.value) * (0.4 + 0.6 * enter);
        final dx = _shake.isAnimating ? _shakeX(_shake.value) : 0.0;
        return Positioned(
          left: pos.dx + dx,
          top: pos.dy,
          width: size,
          height: size,
          child: Opacity(opacity: enter.clamp(0, 1).toDouble(), child: Transform.scale(scale: scale, child: child)),
        );
      },
      child: tile,
    );
  }

  Widget _content() {
    final size = widget.size;
    final emoji = Text(widget.emoji, style: TextStyle(fontSize: size * 0.55, height: 1));
    switch (widget.special) {
      case 'color-bomb':
        return _Pulse(
          child: Container(
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [TwColors.fuchsia400, TwColors.amber300, TwColors.sky400]),
            ),
            alignment: Alignment.center,
            child: AIcon(AIcons.sparkles, size: size / 2, color: const Color(0xFFFFFFFF)),
          ),
        );
      case 'wrapped':
        return Stack(clipBehavior: Clip.none, children: [
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [TwColors.amber200.withValues(alpha: 0.7), TwColors.amber400.withValues(alpha: 0.7)],
              ),
              border: Border.all(color: TwColors.amber400.withValues(alpha: 0.7), width: 2),
            ),
            alignment: Alignment.center,
            child: emoji,
          ),
          const PositionedDirectional(top: -4, end: -4, child: AIcon(AIcons.sparkles, size: 12, color: TwColors.amber600)),
        ]);
      case 'striped-h':
      case 'striped-v':
        final horizontal = widget.special == 'striped-h';
        return Stack(alignment: Alignment.center, children: [
          emoji,
          Positioned(
            left: horizontal ? 2 : null,
            right: horizontal ? 2 : null,
            top: horizontal ? null : 2,
            bottom: horizontal ? null : 2,
            child: Container(
              width: horizontal ? null : 3,
              height: horizontal ? 3 : null,
              decoration: BoxDecoration(color: const Color(0xCCFFFFFF), borderRadius: BorderRadius.circular(9999)),
            ),
          ),
        ]);
      default:
        return emoji;
    }
  }
}

/// `animate-pulse-scale` (2 s, scale 1 → 1.05 → 1).
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_controller.isAnimating) _controller.repeat();
    } else {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final t = _controller.value;
          final phase = t < 0.5 ? t * 2 : (1 - t) * 2;
          return Transform.scale(scale: 1 + 0.05 * ACurves.cssEaseInOut.transform(phase), child: child);
        },
        child: widget.child,
      );
}
