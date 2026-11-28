// Ported from: src/components/games/color-sort/ColorSortGame.tsx, src/components/games/color-sort/color-sort.css
//
// Load (cache → worker → offline fallback), intro with resume of a saved round, tube play with the pour
// stream, undo / hint / extra tube, pause (also on app background and Escape), win / loss and the rewarded
// +moves revive. The round is saved while playing / paused / lost and on exit.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../settings/ui/settings_ui.dart' show ALoader;
import '../../common/persistence/game_store.dart';
import '../../saglam_sebet/ui/arcade_widgets.dart' show GameSurface;
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_registry.dart' show GameLevelResult;
import '../../ui_common/game_revive_action.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/difficulty.dart';
import '../engine/engine.dart';
import '../engine/session.dart';
import '../persistence/storage.dart';
import 'color_sort_text.dart';
import 'color_sort_worker.dart';
import 'color_tube.dart';

class _Notice {
  const _Notice(this.key, [this.parameters = const {}]);
  final String key;
  final Map<String, Object?> parameters;
}

class _Pour {
  const _Pour(this.from, this.to, this.color, this.direction, this.start, this.control, this.mid, this.end);
  final int from;
  final int to;
  final int color;
  final int direction;
  final Offset start, control, mid, end;
}

class ColorSortGame extends ConsumerStatefulWidget {
  const ColorSortGame({
    super.key,
    required this.level,
    required this.levelCount,
    required this.onExit,
    required this.onLevelComplete,
    required this.onNextLevel,
  });
  final int level;
  final int levelCount;
  final VoidCallback onExit;
  final ValueChanged<GameLevelResult> onLevelComplete;
  final VoidCallback onNextLevel;

  @override
  ConsumerState<ColorSortGame> createState() => ColorSortGameState();
}

class ColorSortGameState extends ConsumerState<ColorSortGame> {
  ColorSortLevel? _definition;
  ColorSortSession? _session;
  String _phase = 'loading';
  int? _selected;
  bool _busy = false;
  bool _findingHint = false;
  Move? _hint;
  _Pour? _pouring;
  _Notice? _notice;
  bool _helpOpen = false;
  bool _hasSaved = false;
  late bool _markers = readMarkers(ref.read(gameStoreProvider));
  Timer? _timer;
  ColorSortAbort? _hintController;
  ColorSortAbort? _loadController;
  bool _alive = true;
  int _generation = 0;
  bool _completed = false;
  bool _loadStarted = false;
  late final GameAdsController _ads;
  final GlobalKey _boardKey = GlobalKey();
  final Map<int, GlobalKey> _tubeKeys = {};
  late final GameStore _store = ref.read(gameStoreProvider);

  /// `data-game-phase` / `data-colorsort-moves`.
  String get phase => _phase;
  int get moves => _session?.moves ?? 0;
  ColorSortSession? get session => _session;
  ColorSortLevel? get definition => _definition;
  bool get busy => _busy;

  @override
  void initState() {
    super.initState();
    _ads = GameAdsController(gameId: colorSortId, platform: ref.read(gameAdsPlatformProvider), phase: _phase, restore: _restoreRound);
    _ads.addListener(_onAds);
  }

  void _onAds() {
    if (mounted) setState(() {});
  }

  void _maybeLoad(ColorSortWorker? worker) {
    if (_loadStarted || worker == null) return;
    _loadStarted = true;
    final controller = _loadController = ColorSortAbort();
    worker.loadLevel(widget.level, signal: controller).then((value) {
      if (controller.aborted || !_alive) return;
      final saved = readSavedSession(_store, value);
      setState(() {
        _definition = value;
        _session = saved ?? createSession(value);
        _hasSaved = saved != null;
        _changePhase('intro');
      });
    }, onError: (Object _) {
      if (!controller.aborted && _alive) setState(() => _changePhase('error'));
    });
  }

  @override
  void dispose() {
    _alive = false;
    _generation++;
    _loadController?.abort();
    _hintController?.abort();
    _timer?.cancel();
    final definition = _definition, session = _session;
    if (definition != null && session != null && const ['playing', 'paused', 'lost'].contains(_phase)) saveSession(_store, session, definition);
    _ads.removeListener(_onAds);
    _ads.dispose();
    super.dispose();
  }

  void _changePhase(String value) {
    _phase = value;
    _ads.update(phase: value, restore: _restoreRound);
  }

  /// The `[definition, session, phase]` save effect.
  void _persist() {
    final definition = _definition, session = _session;
    if (definition != null && session != null && const ['playing', 'paused', 'lost'].contains(_phase)) saveSession(_store, session, definition);
  }

  void _commit(ColorSortSession value) => _session = value;

  void _cancelHint() {
    _hintController?.abort();
    _hintController = null;
    _findingHint = false;
  }

  void _restoreRound(GameReviveBenefits benefits) {
    final session = _session, definition = _definition;
    if (session == null || definition == null || _phase != 'lost') return;
    _apply(() {
      _commit(session.copyWith({'bonusMoves': math.min(60, session.bonusMoves + benefits.moves)}));
      _notice = null;
      _selected = null;
      _changePhase('playing');
    });
  }

  /// setState + the save and win/loss effects that follow every render in React.
  void _apply(VoidCallback change) {
    if (!_alive) return;
    setState(change);
    _persist();
    _watch();
  }

  void _watch() {
    final definition = _definition, session = _session;
    if (definition == null || session == null || _phase != 'playing' || _busy) return;
    final board = boardOf(session);
    if (isSolved(board, definition.rules.capacity)) {
      setState(() {
        _cancelHint();
        _changePhase('won');
      });
      clearSavedSession(_store, definition);
      if (!_completed) {
        _completed = true;
        final result = resultForLevel(definition, session.moves, session.hints, session.extraTubes, session.undos);
        widget.onLevelComplete(GameLevelResult(level: result.level, score: result.score, stars: result.stars, passed: true));
        unawaited(ref.read(gameHapticsProvider).medium());
      }
    } else if (remainingMoves(session, definition) == 0) {
      setState(() {
        _cancelHint();
        _changePhase('lost');
      });
      _persist();
    }
  }

  void _startNew() {
    final current = _definition;
    if (current == null) return;
    _generation++;
    _completed = false;
    _timer?.cancel();
    _apply(() {
      _cancelHint();
      _busy = false;
      _pouring = null;
      _hint = null;
      _selected = null;
      _notice = null;
      _hasSaved = false;
      _commit(createSession(current));
      _ads.resetRound();
      _changePhase('playing');
    });
  }

  void _reportLoss() {
    if (_phase == 'lost' && !_completed) {
      _completed = true;
      widget.onLevelComplete(GameLevelResult(level: widget.level, score: 0, stars: 0, passed: false));
    }
  }

  void _exit() {
    _reportLoss();
    setState(_cancelHint);
    unawaited(_ads.transition(widget.onExit));
  }

  void _restart() {
    _reportLoss();
    setState(_cancelHint);
    unawaited(_ads.transition(_startNew));
  }

  void _pause() => _apply(() {
        _cancelHint();
        _changePhase('paused');
      });

  void _selectTube(int index) {
    final definition = _definition, session = _session;
    if (definition == null || session == null || _phase != 'playing' || _busy || _findingHint || _helpOpen) return;
    final board = boardOf(session), rules = definition.rules;
    if (isLocked(board, rules, index)) {
      final after = rules.locks.firstWhere((lock) => lock.tube == index).after;
      setState(() => _notice = _Notice('locked_tube', {'count': after - completedCount(board, rules.capacity)}));
      return;
    }
    final selected = _selected;
    if (selected == index) {
      setState(() {
        _selected = null;
        _notice = null;
      });
      return;
    }
    if (selected == null) {
      if (board[index].isEmpty) {
        setState(() => _notice = const _Notice('empty_tube'));
        return;
      }
      if (isComplete(board[index], rules.capacity)) {
        setState(() => _notice = const _Notice('complete_tube'));
        return;
      }
      setState(() {
        _selected = index;
        _notice = null;
      });
      unawaited(ref.read(gameHapticsProvider).light());
      return;
    }
    final move = Move(selected, index), decision = inspectPour(board, rules, selected, index);
    final next = pourSession(session, definition, move);
    if (next == null) {
      setState(() {
        _notice = _Notice(decision.reason == 'full' ? 'invalid_full' : decision.reason == 'complete' ? 'complete_tube' : 'invalid_color');
        if (board[index].isNotEmpty && !isComplete(board[index], rules.capacity)) _selected = index;
      });
      return;
    }
    final reduceMotion = animationsDisabled(context);
    _Pour? pour;
    final boardBox = _boardKey.currentContext?.findRenderObject() as RenderBox?;
    final sourceBox = _tubeKeys[selected]?.currentContext?.findRenderObject() as RenderBox?;
    final targetBox = _tubeKeys[index]?.currentContext?.findRenderObject() as RenderBox?;
    if (boardBox != null && sourceBox != null && targetBox != null && !reduceMotion) {
      final source = sourceBox.localToGlobal(Offset.zero, ancestor: boardBox), target = targetBox.localToGlobal(Offset.zero, ancestor: boardBox);
      final sx = source.dx + sourceBox.size.width / 2, sy = source.dy + 22;
      final tx = target.dx + targetBox.size.width / 2, ty = target.dy + 22;
      final top = math.min(sy, ty) - 28;
      pour = _Pour(selected, index, next.color, tx >= sx ? 1 : -1, Offset(sx, sy), Offset(sx, top), Offset((sx + tx) / 2, top), Offset(tx, ty));
    }
    setState(() {
      _busy = true;
      _selected = null;
      _hint = null;
      _notice = null;
      _pouring = pour;
      _commit(next.session);
    });
    _persist();
    unawaited(ref.read(gameHapticsProvider).light());
    final epoch = _generation;
    _timer = Timer(Duration(milliseconds: reduceMotion ? 30 : 380), () {
      if (!_alive || epoch != _generation) return;
      _apply(() {
        _busy = false;
        _pouring = null;
      });
    });
  }

  void _undo() {
    final session = _session;
    if (session == null || _busy || _findingHint || !const ['playing', 'lost'].contains(_phase)) return;
    final next = undoSession(session);
    if (next != null) {
      _apply(() {
        _commit(next);
        _selected = null;
        _hint = null;
        _notice = null;
        _changePhase('playing');
      });
      unawaited(ref.read(gameHapticsProvider).light());
    }
  }

  void _extra() {
    final session = _session;
    if (session == null || _busy || _findingHint || _phase != 'playing') return;
    final next = addTube(session);
    _apply(() {
      if (next != null) {
        _commit(next);
        _selected = null;
        _hint = null;
        _notice = const _Notice('extra_added');
      } else {
        _notice = const _Notice('extra_empty');
      }
    });
  }

  Future<void> _showHint() async {
    final session = _session, definition = _definition, worker = ref.read(colorSortWorkerProvider);
    if (session == null || definition == null || worker == null || _busy || _findingHint || _phase != 'playing') return;
    if (session.hints >= maxHints) {
      setState(() => _notice = const _Notice('hint_empty'));
      return;
    }
    final snapshot = session, epoch = _generation, controller = ColorSortAbort();
    _hintController?.abort();
    _hintController = controller;
    setState(() {
      _findingHint = true;
      _notice = null;
    });
    try {
      final move = await worker.requestHint(definition, boardOf(snapshot), signal: controller);
      if (controller.aborted || !_alive || _generation != epoch || _phase != 'playing' || !identical(_session, snapshot)) return;
      _apply(() {
        if (move != null) {
          _commit(snapshot.copyWith({'hints': snapshot.hints + 1}));
          _hint = move;
          _selected = null;
          _notice = _Notice('hint_move', {'from': move.from + 1, 'to': move.to + 1});
        } else {
          _notice = const _Notice('hint_none');
        }
      });
    } finally {
      if (_alive && identical(_hintController, controller)) {
        setState(() {
          _findingHint = false;
          _hintController = null;
        });
      }
    }
  }

  void _toggleMarkers() {
    setState(() => _markers = !_markers);
    writeMarkers(_store, _markers);
  }

  bool _onKey(KeyEvent event) {
    if (event is! KeyDownEvent || event.logicalKey != LogicalKeyboardKey.escape) return false;
    if (_helpOpen) {
      setState(() => _helpOpen = false);
      return true;
    }
    if (_phase == 'playing') {
      _pause();
    } else if (_phase == 'paused') {
      _apply(() => _changePhase('playing'));
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    _ads.update(phase: _phase, restore: _restoreRound);
    _maybeLoad(ref.watch(colorSortWorkerProvider));
    final text = ref.watch(colorSortTextProvider);
    final palette = ColorSortPalette.of(context);
    if (text == null) return GamePortal(child: DecoratedBox(decoration: BoxDecoration(gradient: palette.background)));
    final t = text.t, number = text.number;
    final definition = _definition, session = _session;
    final board = session == null ? const <List<int>>[] : boardOf(session);
    final revealed = session == null ? const <int>{} : session.revealed.toSet();
    final sorted = definition == null ? 0 : completedCount(board, definition.rules.capacity);
    final left = session != null && definition != null ? remainingMoves(session, definition) : null;
    final result = session != null && definition != null ? resultForLevel(definition, session.moves, session.hints, session.extraTubes, session.undos) : null;
    final stuck = definition != null && session != null && !isSolved(board, definition.rules.capacity) && legalMoves(board, definition.rules).isEmpty;
    final overlay = _helpOpen ? 'help' : _phase == 'playing' ? null : _phase;
    final controlsDisabled = _busy || _findingHint || _ads.waiting || _phase != 'playing';
    final noticeText = _busy
        ? t('pouring')
        : _findingHint
            ? t('hint_busy')
            : _notice != null
                ? t(_notice!.key, _notice!.parameters)
                : stuck
                    ? t('stuck')
                    : t(_selected == null ? 'select_source' : 'select_target');

    final media = MediaQuery.of(context);
    final short = media.size.height <= 680;
    final glassHeight = short ? 110.0 : (media.size.height * 0.23).clamp(119.0, 160.0);
    final pad = media.padding;

    Widget panelBox({required Widget child, EdgeInsets padding = EdgeInsets.zero, double radius = 16}) => Container(
          padding: padding,
          decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(radius), border: Border.all(color: palette.line)),
          child: child,
        );

    Widget iconButton(AIconData icon, String label, VoidCallback? onTap, double size) => GameButton(
          label: label,
          enabled: onTap != null,
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.48 : 1,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(15), border: Border.all(color: palette.line)),
              alignment: Alignment.center,
              child: AIcon(icon, size: size, color: palette.ink),
            ),
          ),
        );

    Widget constrained(double max, Widget child) => Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: max), child: child));

    final header = constrained(
      580,
      Row(children: [
        iconButton(AIcons.pause, t('pause'), _busy || overlay != null ? null : _pause, 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(t('title'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1.35, color: palette.ink)),
            const SizedBox(height: 3),
            Text('${t('level', {'level': widget.level})} · ${definition != null ? t('difficulty_${definition.profile.difficulty}') : ''}',
                style: TextStyle(fontSize: 11, color: palette.muted)),
          ]),
        ),
        const SizedBox(width: 10),
        iconButton(AIcons.circleHelp, t('help'), _busy || overlay != null ? null : () => setState(() {
              _cancelHint();
              _helpOpen = true;
            }), 20),
      ]),
    );

    Widget stat(String label, String value) => Expanded(
          child: panelBox(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            child: Row(children: [
              Expanded(child: Text(label, style: TextStyle(fontSize: 11, color: palette.muted))),
              const SizedBox(width: 6),
              Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: palette.ink, fontFeatures: const [ui.FontFeature.tabularFigures()])),
            ]),
          ),
        );

    final stats = Padding(
      padding: EdgeInsets.only(top: short ? 9 : 14),
      child: constrained(
        580,
        Row(children: [
          stat(t(left == null ? 'moves' : 'moves_left'), left == null ? number(session?.moves ?? 0) : number(left)),
          const SizedBox(width: 8),
          stat(t('sorted'), '${number(sorted)}/${number(definition?.colors ?? 0)}'),
        ]),
      ),
    );

    final notice = Padding(
      padding: EdgeInsets.only(top: short ? 7 : 10),
      child: constrained(
        520,
        ConstrainedBox(
          constraints: BoxConstraints(minHeight: short ? 30 : 39),
          child: Semantics(
            liveRegion: true,
            child: Text(noticeText,
                key: const ValueKey('colorsort-notice'),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: short ? 11 : 12, height: 1.45, color: palette.ink)),
          ),
        ),
      ),
    );

    final playArea = Expanded(
      child: SingleChildScrollView(
        child: LayoutBuilder(builder: (context, constraints) {
          final width = math.min(constraints.maxWidth, 560.0);
          final innerWidth = width - 16;
          final measured = width >= 350 ? 6 : width >= 280 ? 5 : 4;
          final columns = math.min(measured, session?.tubes.length ?? measured);
          const gap = 10.0;
          final tubeWidth = math.max(44.0, (innerWidth - (columns - 1) * gap) / columns);
          return Center(
            child: Container(
              key: _boardKey,
              width: width,
              padding: short ? const EdgeInsets.fromLTRB(8, 15, 8, 8) : const EdgeInsets.fromLTRB(8, 20, 8, 14),
              child: Stack(clipBehavior: Clip.none, children: [
                Semantics(
                  container: true,
                  label: t('title'),
                  child: Wrap(alignment: WrapAlignment.center, runAlignment: WrapAlignment.center, spacing: gap, runSpacing: short ? 10 : 20, children: [
                    if (definition != null && session != null)
                      for (var index = 0; index < session.tubes.length; index++) _tube(index, definition, session, board, revealed, sorted, t, number, tubeWidth, glassHeight, controlsDisabled || overlay != null),
                  ]),
                ),
                if (_pouring != null)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: TweenAnimationBuilder<double>(
                        key: ValueKey('pour-${_pouring!.from}-${_pouring!.to}-${session?.moves}'),
                        tween: Tween(begin: 0, end: 1),
                        duration: const Duration(milliseconds: 200),
                        curve: ACurves.framerDefault,
                        builder: (context, progress, _) => CustomPaint(painter: _StreamPainter(_pouring!, progress)),
                      ),
                    ),
                  ),
              ]),
            ),
          );
        }),
      ),
    );

    Widget tool(AIconData icon, String label, VoidCallback? onTap, {String? badge, bool loading = false}) => Expanded(
          child: GameButton(
            enabled: onTap != null,
            onTap: onTap,
            label: badge == null ? label : '$label $badge',
            child: Opacity(
              opacity: onTap == null ? 0.48 : 1,
              child: Container(
                constraints: BoxConstraints(minHeight: short ? 52 : 61),
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 5),
                decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(18), border: Border.all(color: palette.line)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (loading) ALoader(size: 18, color: palette.ink) else AIcon(icon, size: 18, color: palette.ink),
                    if (badge != null) ...[
                      const SizedBox(width: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(color: const Color(0x1F29A19D), borderRadius: BorderRadius.circular(6)),
                        child: Text(badge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: palette.ink)),
                      ),
                    ],
                  ]),
                  const SizedBox(height: 5),
                  Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: palette.ink)),
                ]),
              ),
            ),
          ),
        );

    final bottom = Padding(
      padding: const EdgeInsets.only(top: 10),
      child: constrained(
        580,
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            tool(AIcons.undo2, t('undo'), controlsDisabled || session == null || session.history.isEmpty || overlay != null ? null : _undo),
            const SizedBox(width: 8),
            tool(AIcons.sparkles, t('hint'), controlsDisabled || session == null || session.hints >= maxHints || overlay != null ? null : () => unawaited(_showHint()),
                badge: number(maxHints - (session?.hints ?? 0)), loading: _findingHint),
            const SizedBox(width: 8),
            tool(AIcons.plus, t('extra_tube'), controlsDisabled || session == null || session.extraTubes >= maxExtraTubes || overlay != null ? null : _extra,
                badge: number(maxExtraTubes - (session?.extraTubes ?? 0))),
          ]),
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Row(children: [
              GameButton(
                label: t('markers'),
                selected: _markers,
                enabled: overlay == null,
                onTap: overlay == null ? _toggleMarkers : null,
                child: Opacity(
                  opacity: overlay == null ? 1 : 0.48,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 34),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.layers, size: 13, color: _markers ? palette.ink : palette.muted),
                        const SizedBox(width: 5),
                        Text(t('markers'), style: TextStyle(fontSize: 10, color: _markers ? palette.ink : palette.muted)),
                      ]),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(t('saved'), textAlign: TextAlign.end, style: TextStyle(fontSize: 10, color: palette.muted))),
            ]),
          ),
        ]),
      ),
    );

    final shell = Column(children: [header, stats, notice, playArea, bottom]);

    return GamePortal(
      child: Directionality(
        textDirection: text.dir,
        child: GameKeyboardListener(
          onKey: _onKey,
          child: GameLifecycleListener(
            onHidden: () {
              if (_phase == 'playing') _pause();
            },
            child: GameSurface(
              child: DefaultTextStyle(
                style: TextStyle(fontFamily: text.language == 'ar' ? 'Noto Sans Arabic' : 'Inter', fontFamilyFallback: const ['Nunito'], color: palette.ink, fontSize: 14),
                child: DecoratedBox(
                  key: const ValueKey('colorsort-game'),
                  decoration: BoxDecoration(gradient: palette.background),
                  child: DecoratedBox(
                    decoration: BoxDecoration(gradient: palette.backgroundGlow),
                    child: Stack(children: [
                      Positioned.fill(
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(math.max(12, pad.left), math.max(10, pad.top), math.max(12, pad.right), math.max(10, pad.bottom)),
                          child: overlay == null ? shell : ExcludeSemantics(child: ExcludeFocus(child: shell)),
                        ),
                      ),
                      if (overlay != null) Positioned.fill(key: ValueKey('overlay-$overlay'), child: _overlay(overlay, palette, text, result, glassHeight)),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _tube(int index, ColorSortLevel definition, ColorSortSession session, Board board, Set<int> revealed, int sorted,
      String Function(String, [Map<String, Object?>]) t, String Function(num) number, double width, double glassHeight, bool disabled) {
    final locked = isLocked(board, definition.rules, index) ? definition.rules.locks.firstWhere((item) => item.tube == index).after - sorted : 0;
    final top = topColor(board[index]);
    final complete = isComplete(board[index], definition.rules.capacity);
    final label = locked > 0
        ? '${t('tube', {'number': index + 1})}. ${t('locked_tube', {'count': locked})}'
        : t('tube_label', {
            'number': index + 1,
            'top': complete ? t('complete_tube') : top == null ? t('empty_tube') : t('color_$top'),
            'space': definition.rules.capacity - session.tubes[index].length,
          });
    final key = _tubeKeys.putIfAbsent(index, GlobalKey.new);
    return SizedBox(
      key: key,
      width: width,
      child: ColorTube(
        units: session.tubes[index],
        revealed: revealed,
        index: index,
        label: label,
        number: number,
        selected: _selected == index,
        complete: complete,
        locked: locked,
        markers: _markers,
        disabled: disabled,
        hint: _hint?.from == index ? 'from' : _hint?.to == index ? 'to' : null,
        pouring: _pouring?.from == index,
        direction: _pouring?.direction ?? 1,
        onTap: () => _selectTube(index),
        glassHeight: glassHeight,
        reduceMotion: animationsDisabled(context),
      ),
    );
  }

  Widget _overlay(String overlay, ColorSortPalette palette, ColorSortText text, ColorSortResult? result, double glassHeight) {
    final t = text.t, number = text.number;
    final media = MediaQuery.of(context);
    final short = media.size.height <= 680;
    final definition = _definition, session = _session;
    final waiting = _ads.waiting;

    Widget title(String value) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Semantics(
            header: true,
            child: Text(value,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: short ? 23 : (media.size.width * 0.06).clamp(23.0, 30.0), fontWeight: FontWeight.w800, height: 1.3, color: palette.ink)),
          ),
        );
    Widget para(Widget child) => DefaultTextStyle.merge(
          style: TextStyle(fontSize: 13, height: 1.6, color: palette.muted),
          textAlign: TextAlign.center,
          child: child,
        );
    Widget emblem(Widget icon) => Center(
          child: Container(
            width: short ? 62 : 80,
            height: short ? 62 : 80,
            margin: EdgeInsets.only(bottom: short ? 10 : 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: const CssLinearGradient(angle: 135, colors: [Color(0xFF43C9C0), Color(0xFF197F95)]),
              boxShadow: const [BoxShadow(color: Color(0xFF278E90), offset: Offset(0, 16), blurRadius: 30, spreadRadius: -16)],
            ),
            alignment: Alignment.center,
            child: IconTheme(data: const IconThemeData(color: Color(0xFFFFFFFF)), child: icon),
          ),
        );
    Widget button(String label, VoidCallback? onTap, {bool primary = false, AIconData? icon, bool mirror = false}) => GameButton(
          label: label,
          enabled: onTap != null,
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.48 : 1,
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 15),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: primary ? const CssLinearGradient(angle: 125, colors: [Color(0xFF149C91), Color(0xFF14778A)]) : null,
                color: primary ? null : palette.panel,
                border: primary ? null : Border.all(color: palette.line),
                boxShadow: primary ? const [BoxShadow(color: Color(0xFF08777B), offset: Offset(0, 8), blurRadius: 20, spreadRadius: -12)] : null,
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[AIcon(icon, size: 17, color: primary ? const Color(0xFFFFFFFF) : palette.ink, mirrorInRtl: mirror), const SizedBox(width: 8)],
                Flexible(
                  child: Text(label,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, height: 1.4, color: primary ? const Color(0xFFFFFFFF) : palette.ink)),
                ),
              ]),
            ),
          ),
        );
    Widget actions(List<Widget> children) => Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 9), children[i]],
          ]),
        );

    final content = <Widget>[];
    switch (overlay) {
      case 'loading':
        content.addAll([
          emblem(const ALoader(size: 32, color: Color(0xFFFFFFFF))),
          title(t('loading')),
          button(t('back'), _exit, icon: AIcons.arrowLeft, mirror: true),
        ]);
      case 'error':
        content.addAll([title(t('title')), para(Text(t('load_error'))), actions([button(t('menu'), _exit, primary: true)])]);
      case 'intro':
        if (definition == null) break;
        Widget introStat(String value, String label) => Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(16), border: Border.all(color: palette.line)),
              child: Column(children: [
                Text(value, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: palette.ink, fontFeatures: const [ui.FontFeature.tabularFigures()])),
                const SizedBox(height: 4),
                Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: palette.muted)),
              ]),
            );
        content.addAll([
          emblem(const AIcon(AIcons.flaskConical, size: 40, color: Color(0xFFFFFFFF))),
          Center(
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 12),
              decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(20), border: Border.all(color: palette.line)),
              child: Text(t('difficulty_${definition.profile.difficulty}'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: palette.ink)),
            ),
          ),
          title(t('level', {'level': widget.level})),
          para(Text(t('goal'))),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: LayoutBuilder(builder: (context, constraints) {
              final cell = (constraints.maxWidth - 8) / 2;
              return Wrap(spacing: 8, runSpacing: 8, children: [
                SizedBox(width: cell, child: introStat(number(definition.colors), t('colors'))),
                SizedBox(width: cell, child: introStat(number(definition.profile.emptyTubes), t('empty'))),
                SizedBox(
                    width: cell,
                    child: introStat(definition.moveLimit == null ? '∞' : number(definition.moveLimit!), definition.moveLimit == null ? t('unlimited') : t('moves'))),
                SizedBox(width: cell, child: introStat(number(definition.profile.lockedTubes), t('locks'))),
              ]);
            }),
          ),
          if (definition.hiddenTubes > 0)
            para(Text.rich(TextSpan(children: [
              WidgetSpan(alignment: PlaceholderAlignment.middle, child: Padding(padding: const EdgeInsetsDirectional.only(end: 4), child: AIcon(AIcons.eyeOff, size: 14, color: palette.muted))),
              TextSpan(text: t('hidden')),
            ]))),
          para(Text(t('target_moves', {'count': definition.parMoves + 2}))),
          actions([
            if (_hasSaved) button(t('resume_saved'), () => _apply(() => _changePhase('playing')), primary: true, icon: AIcons.play),
            button(t(_hasSaved ? 'new_game' : 'start'), _startNew, primary: !_hasSaved, icon: AIcons.play),
            button(t('help'), () => setState(() => _helpOpen = true), icon: AIcons.circleHelp),
            button(t('menu'), _exit, icon: AIcons.arrowLeft, mirror: true),
          ]),
        ]);
      case 'help':
        const rules = [
          (AIcons.flaskConical, 'rule_pour'),
          (AIcons.checkCheck, 'rule_seal'),
          (AIcons.keyRound, 'rule_lock'),
          (AIcons.eyeOff, 'rule_hidden'),
          (AIcons.sparkles, 'rule_help'),
          (AIcons.star, 'rule_stars'),
        ];
        content.addAll([
          title(t('help')),
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (var i = 0; i < rules.length; i++) ...[
                if (i > 0) const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: palette.panel, borderRadius: BorderRadius.circular(18), border: Border.all(color: palette.line)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(rules[i].$1, size: 19, color: const Color(0xFF159C98))),
                    const SizedBox(width: 10),
                    Expanded(child: Text(t(rules[i].$2), style: TextStyle(fontSize: 12, height: 1.6, color: palette.muted))),
                  ]),
                ),
              ],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [
              for (var index = 0; index < (definition?.colors ?? 8); index++)
                Semantics(
                  tooltip: t('color_$index'),
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(color: liquidColors[index], borderRadius: BorderRadius.circular(9)),
                    alignment: Alignment.center,
                    child: Text(number(index + 1),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: index == 7 ? const Color(0xFFFFFFFF) : const Color(0xFF10283B))),
                  ),
                ),
            ]),
          ),
          actions([button(t('close'), () => setState(() => _helpOpen = false), primary: true, icon: AIcons.x)]),
        ]);
      case 'paused':
        content.addAll([
          emblem(const AIcon(AIcons.pause, size: 34, color: Color(0xFFFFFFFF))),
          title(t('paused')),
          para(Text(t('saved'))),
          actions([
            button(t('resume'), () => _apply(() => _changePhase('playing')), primary: true, icon: AIcons.play),
            button(t('restart'), waiting ? null : _restart, icon: AIcons.rotateCcw),
            button(t('menu'), waiting ? null : _exit, icon: AIcons.house),
          ]),
        ]);
      case 'won':
        if (result == null) break;
        content.addAll([
          emblem(const AIcon(AIcons.trophy, size: 38, color: Color(0xFFFFFFFF))),
          title(t('won')),
          Semantics(
            label: t('stars', {'count': result.stars}),
            child: ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var star = 1; star <= 3; star++) ...[
                    if (star > 1) const SizedBox(width: 8),
                    Opacity(
                      opacity: star <= result.stars ? 1 : 0.25,
                      child: GameStar(size: 38, filled: star <= result.stars, color: const Color(0xFFD5A124)),
                    ),
                  ],
                ]),
              ),
            ),
          ),
          para(Text.rich(TextSpan(children: [
            TextSpan(text: '${t('score')}: '),
            TextSpan(text: number(result.score), style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: ' · ${t('moves')}: ${number(session?.moves ?? 0)}'),
          ]))),
          actions([
            if (widget.level < maxLevelCount)
              button(
                widget.level < widget.levelCount ? t('next') : t('add_levels', {'count': math.min(levelPackSize, maxLevelCount - widget.levelCount)}),
                waiting ? null : () => unawaited(_ads.transition(widget.onNextLevel)),
                primary: true,
              ),
            button(t('restart'), waiting ? null : _restart, icon: AIcons.rotateCcw),
            button(t('menu'), waiting ? null : _exit, icon: AIcons.house),
          ]),
        ]);
      case 'lost':
        content.addAll([
          emblem(const AIcon(AIcons.flaskConical, size: 38, color: Color(0xFFFFFFFF))),
          title(t('lost')),
          para(Text(t('lost_desc'))),
          actions([
            if (session != null && session.history.isNotEmpty) button(t('undo'), waiting ? null : _undo, primary: true, icon: AIcons.undo2),
            GameReviveAction(
              ads: _ads,
              game: 'match',
              labels: ReviveLabels(
                action: t(_ads.premium ? 'revive_premium' : 'revive_video', {'count': _ads.benefits.moves}),
                note: t('revive_note'),
                failed: t('revive_failed'),
                unavailable: t('ads_unavailable'),
              ),
            ),
            button(t('restart'), waiting ? null : _restart, icon: AIcons.rotateCcw),
            button(t('menu'), waiting ? null : _exit, icon: AIcons.house),
          ]),
        ]);
    }

    final tokens = AnacanTokens.of(context);
    Widget layer = ColoredBox(
      color: palette.overlay,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, math.max(24, media.padding.top), 20, math.max(24, media.padding.bottom)),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: math.max(0, media.size.height - math.max(24, media.padding.top) - math.max(24, media.padding.bottom))),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: content),
            ),
          ),
        ),
      ),
    );
    if (tokens.blurEnabled) layer = ClipRect(child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12), child: layer));
    return FocusScope(autofocus: true, child: Semantics(scopesRoute: true, explicitChildNodes: true, child: layer));
  }
}

/// The pour arc (`M s Q (sx, top) mid T t`, stroke 5, round caps) drawn up to [progress] with opacity 0.6 → 1.
class _StreamPainter extends CustomPainter {
  _StreamPainter(this.pour, this.progress);
  final _Pour pour;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final reflected = pour.mid * 2 - pour.control;
    final path = Path()
      ..moveTo(pour.start.dx, pour.start.dy)
      ..quadraticBezierTo(pour.control.dx, pour.control.dy, pour.mid.dx, pour.mid.dy)
      ..quadraticBezierTo(reflected.dx, reflected.dy, pour.end.dx, pour.end.dy);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round
      ..color = liquidColors[pour.color].withValues(alpha: 0.6 + 0.4 * progress);
    final metrics = path.computeMetrics().toList();
    final total = metrics.fold<double>(0, (sum, m) => sum + m.length);
    var remaining = total * progress;
    for (final metric in metrics) {
      if (remaining <= 0) break;
      canvas.drawPath(metric.extractPath(0, math.min(remaining, metric.length)), paint);
      remaining -= metric.length;
    }
  }

  @override
  bool shouldRepaint(_StreamPainter old) => old.progress != progress || old.pour != pour;
}
