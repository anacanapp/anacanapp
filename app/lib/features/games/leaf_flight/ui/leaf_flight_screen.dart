// Ported from: src/components/games/leaf-flight/LeafFlight.tsx, src/components/games/leaf-flight/leaf-flight.css
//
// Tumurcuğun uçuşu: hold (stage, the lift button, Space / ↑ / W) to rise, release to sink. A Ticker feeds frame
// time into the fixed 60 Hz physics (`advanceFlight`: ≤ 0.12 s and ≤ 8 steps per frame, so long frames and
// background time never become damage). Cancelled touches, key-up, blur and background release the hold; the
// live round is saved every 2 s, on pause, on leaving and on unmount; a reopened round waits for "Play".
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../casual/persistence/storage.dart';
import '../../common/persistence/game_store.dart';
import '../../ui_common/casual_ui.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/engine.dart';
import 'flight_painter.dart';

/// `.flight-screen` background.
const CasualPalette flightPalette = CasualPalette(
  background: LinearGradient(
    begin: Alignment(-0.17, -1),
    end: Alignment(0.17, 1),
    colors: [Color(0xFFEEE8F5), Color(0xFFF8EEDC), Color(0xFFDFEBCB)],
    stops: [0, .65, 1],
  ),
);

const List<String> _routeKeys = ['flightTitle', 'wind', 'narrow', 'moving', 'secret'];

class LeafFlight extends ConsumerStatefulWidget {
  const LeafFlight({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<LeafFlight> createState() => LeafFlightState();
}

class LeafFlightState extends ConsumerState<LeafFlight> with SingleTickerProviderStateMixin {
  late CasualProfile _profile;
  late final GameStore _store;
  int? _levelNumber;

  /// 'ready' | 'playing' | 'paused' | 'won' | 'lost'.
  String _phase = 'ready';
  bool _help = false;
  FlightState? _view;
  bool _pressed = false;
  bool _storageReady = true;

  FlightState? _round;
  bool _lifting = false;
  int? _pointer;
  late final Ticker _ticker = createTicker(_tick);
  Duration _previous = Duration.zero;
  double _carry = 0, _painted = 0, _saved = 0;
  final ValueNotifier<int> _frame = ValueNotifier<int>(0);
  ui.Image? _image;
  ImageStream? _imageStream;
  ImageStreamListener? _imageListener;
  late final GameAdsController _ads;

  // Test hooks (`data-game-phase`, `aria-pressed`).
  String get phase => _levelNumber == null ? 'menu' : _phase;
  bool get pressed => _pressed;
  FlightState? get round => _round;

  @override
  void initState() {
    super.initState();
    ref.read(gameAnalyticsProvider).screen('LeafFlight', 'MiniGames');
    _store = ref.read(gameStoreProvider);
    _profile = readCasualProfile(_store, leafFlightId, leafFlightRevision, leafFlightLevels, validSavedFlightRound);
    _ads = GameAdsController(gameId: leafFlightId, platform: ref.read(gameAdsPlatformProvider), phase: 'menu', restore: (_) {})..addListener(_rebuild);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_imageStream == null) {
      final stream = const AssetImage(CasualArt.flight).resolve(createLocalImageConfiguration(context));
      _imageListener = ImageStreamListener((info, _) => _image = info.image);
      stream.addListener(_imageListener!);
      _imageStream = stream;
    }
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _save();
    _ticker.dispose();
    _frame.dispose();
    if (_imageListener != null) _imageStream?.removeListener(_imageListener!);
    _ads.removeListener(_rebuild);
    _ads.dispose();
    super.dispose();
  }

  FlightLevel? get _definition => _levelNumber == null ? null : flightLevel(_levelNumber!);

  void _commit(CasualProfile next) {
    _profile = next;
    final ok = writeCasualProfile(_store, next);
    if (mounted) setState(() => _storageReady = ok);
  }

  void _release() {
    _pointer = null;
    _lifting = false;
    if (_pressed && mounted) setState(() => _pressed = false);
    _pressed = false;
  }

  void _save() {
    final round = _round;
    if (round != null && !round.won) {
      _profile = _profile.withRound(round.json);
      _storageReady = writeCasualProfile(_store, _profile);
    }
  }

  void _setPhase(String next) {
    _phase = next;
    _syncTicker();
    if (mounted) setState(() {});
  }

  void _pause() {
    _release();
    if (_phase == 'playing') {
      _setPhase('paused');
      _save();
      if (mounted) setState(() {});
    }
  }

  void _back() {
    if (_levelNumber == null) {
      widget.onBack();
    } else if (_phase == 'playing') {
      _pause();
    } else {
      _save();
      _release();
      setState(() => _levelNumber = null);
      _syncTicker();
    }
  }

  void _syncTicker() {
    final run = _definition != null && _phase == 'playing' && !_help;
    if (run && !_ticker.isActive) {
      _previous = Duration.zero;
      _carry = 0;
      _painted = 0;
      _saved = 0;
      _ticker.start();
    } else if (!run && _ticker.isActive) {
      _ticker.stop();
      _save();
    }
  }

  void _tick(Duration elapsed) {
    final definition = _definition;
    final elapsedSeconds = (elapsed - _previous).inMicroseconds / 1e6;
    _previous = elapsed;
    final now = elapsed.inMicroseconds / 1000;
    final before = _round;
    if (definition == null || before == null || gameDocumentHidden() || _ads.waiting || _phase != 'playing') return;
    final result = advanceFlight(definition, before, _lifting, elapsedSeconds, _carry);
    _carry = result.carry;
    _round = result.state;
    _frame.value++;
    if (before.hearts != result.state.hearts) unawaited(ref.read(gameHapticsProvider).medium().catchError((Object _) {}));
    if (now - _painted >= 100 || result.state.won || result.state.lost) {
      _painted = now;
      setState(() => _view = result.state);
    }
    if (now - _saved >= 2000) {
      _saved = now;
      _save();
    }
    if (result.state.won || result.state.lost) {
      _release();
      _phase = result.state.won ? 'won' : 'lost';
      _ticker.stop();
      if (result.state.won) {
        final score = flightResult(definition, result.state);
        _commit(recordCasualWin(_profile, definition.level, leafFlightLevels, (stars: score.stars, score: score.score)));
        ref.read(gameAnalyticsProvider).event('minigame_level_won', {'game_id': leafFlightId, 'level': definition.level, 'score': score.score});
      } else {
        _save();
        ref.read(gameAnalyticsProvider).event('minigame_level_lost', {'game_id': leafFlightId, 'level': definition.level});
      }
      setState(() {});
    }
  }

  void _start(int level) {
    if (level < 1 || level > _profile.unlocked) return;
    _release();
    _help = false;
    _ads.resetRound();
    final saved = _profile.round;
    final definition = flightLevel(level);
    final savedLevel = saved is Map ? saved['level'] : null;
    _round = savedLevel == level && validFlightState(saved, definition) && saved is Map && saved['won'] != true
        ? FlightState(Map<String, Object?>.from(saved))
        : createFlightState(level);
    _view = _round;
    _levelNumber = level;
    _commit(_profile.withRound(_round!.json));
    _setPhase(_round!.lost ? 'lost' : 'ready');
  }

  void _play() {
    _release();
    _setPhase('playing');
    ref.read(gameAnalyticsProvider).event('minigame_level_started', {'game_id': leafFlightId, 'level': _levelNumber});
  }

  void _restart() {
    final level = _levelNumber;
    if (level == null) return;
    _release();
    _round = createFlightState(level);
    _view = _round;
    _commit(_profile.withRound(_round!.json));
    _setPhase('ready');
    _ads.resetRound();
  }

  void _pointerDown(PointerDownEvent event) {
    if (_phase != 'playing' || _help || _ads.waiting || _pointer != null || event.buttons & kPrimaryButton == 0) return;
    _pointer = event.pointer;
    _lifting = true;
    setState(() => _pressed = true);
  }

  void _pointerUp(PointerEvent event) {
    if (_pointer == event.pointer) _release();
  }

  bool _onKey(KeyEvent event) {
    final key = event.logicalKey;
    final lift = key == LogicalKeyboardKey.space || key == LogicalKeyboardKey.arrowUp || event.character == 'w' || key == LogicalKeyboardKey.keyW;
    if (event is KeyUpEvent) {
      if (lift) _release();
      return false;
    }
    if (event is KeyDownEvent && key == LogicalKeyboardKey.escape && !_help) {
      _back();
      return true;
    }
    if (_phase != 'playing' || _help || gameModifierPressed()) return false;
    if (lift) {
      _lifting = true;
      if (!_pressed) setState(() => _pressed = true);
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const SizedBox.shrink();
    final t = CasualText(data.casual, ref.watch(gameLanguageProvider));
    final definition = _definition, view = _view;
    _ads.update(phase: _help ? 'paused' : _levelNumber == null ? 'menu' : _phase, restore: (_) {});
    final modal = _levelNumber != null && _phase != 'playing';
    final title = _help
        ? t('help')
        : _phase == 'won'
            ? t('flightWon')
            : _phase == 'lost'
                ? t('flightLost')
                : _phase == 'ready'
                    ? t('flightTitle')
                    : t('pause');
    final short = MediaQuery.sizeOf(context).height <= 610;

    return GameBackHandler(
      onBack: () {
        if (_help) return false;
        _back();
        return true;
      },
      child: GameLifecycleListener(
        onHidden: _pause,
        onBlur: () {
          _release();
          _pause();
        },
        child: GameKeyboardListener(
          onKey: _onKey,
          child: CasualScreen(
            screenKey: const ValueKey('leaf-flight-screen'),
            palette: flightPalette,
            dir: t.dir,
            overlay: _help || modal
                ? GameDialog(
                    key: ValueKey('flight-dialog:${_help ? 'help' : _phase}'),
                    title: title,
                    closeLabel: t('close'),
                    onClose: () {
                      if (_help) {
                        setState(() => _help = false);
                        _syncTicker();
                      } else if (_phase == 'paused') {
                        _play();
                      } else {
                        _save();
                        setState(() => _levelNumber = null);
                      }
                    },
                    children: _dialogBody(t, definition, view),
                  )
                : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CasualHeader(
                eyebrow: _levelNumber == null ? CasualArt.brand : t('flightTitle'),
                title: _levelNumber == null ? t('flightTitle') : t('level', {'level': _levelNumber}),
                onBack: _back,
                backLabel: t('back'),
                action: CasualIconButton(
                  key: const ValueKey('cg-help'),
                  icon: const AIcon(AIcons.circleHelp, size: 19),
                  label: t('help'),
                  onTap: () {
                    _pause();
                    setState(() => _help = true);
                    _syncTicker();
                  },
                ),
              ),
              Expanded(
                child: definition != null && view != null
                    ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _metrics(t, definition, view, short),
                        Expanded(child: _stage(t, definition, short)),
                        _controls(t, short),
                        if (!_storageReady)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(5, 11, 5, 0),
                            child: Text(t('storage'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, height: 1.5, color: CasualPalette.muted)),
                          ),
                      ])
                    : GameLobby(
                        palette: flightPalette,
                        title: t('flightTitle'),
                        description: t('flightCard'),
                        image: CasualArt.flight,
                        count: leafFlightLevels,
                        profile: _profile,
                        savedLevel: _savedLevel,
                        t: t,
                        onPlay: _start,
                      ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  int? get _savedLevel {
    final round = _profile.round;
    return round is Map && round['won'] != true ? (round['level'] as num).toInt() : null;
  }

  Widget _metrics(CasualText t, FlightLevel definition, FlightState view, bool short) => Container(
        constraints: BoxConstraints(minHeight: short ? 35 : 42),
        margin: EdgeInsets.only(bottom: short ? 6 : 9),
        padding: short ? const EdgeInsets.symmetric(horizontal: 10, vertical: 6) : const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: CasualPalette.surface, borderRadius: BorderRadius.circular(17)),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Semantics(
            label: t.number(view.hearts),
            child: Row(children: [
              for (var heart = 1; heart <= 3; heart++) ...[
                if (heart > 1) const SizedBox(width: 4),
                heart <= view.hearts
                    ? const GameFilledIcon(AIcons.heart, size: 17, color: Color(0xFFCB899B))
                    : const AIcon(AIcons.heart, size: 17, color: Color(0xFFCB899B)),
              ],
            ]),
          ),
          Row(children: [
            const AIcon(AIcons.star, size: 16, color: Color(0xFFD8B35B)),
            const SizedBox(width: 5),
            Text('${t.number(view.collected.length)} / ${t.number(definition.stars.length)}', style: const TextStyle(fontSize: 11, color: CasualPalette.muted)),
          ]),
          Text('${t.number(math.min(100, (view.distance / definition.distance * 100).floor()))}%',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: flightPalette.deep)),
        ]),
      );

  Widget _stage(CasualText t, FlightLevel definition, bool short) => Listener(
        key: const ValueKey('flight-stage'),
        behavior: HitTestBehavior.opaque,
        onPointerDown: _pointerDown,
        onPointerUp: _pointerUp,
        onPointerCancel: _pointerUp,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(short ? 19 : 26),
            border: Border.all(color: const Color(0xFFFFFFFF), width: 2),
            boxShadow: const [BoxShadow(color: Color(0x247B8161), offset: Offset(0, 9), blurRadius: 30)],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(short ? 17 : 24),
            child: Stack(fit: StackFit.expand, children: [
              Semantics(
                image: true,
                label: t('flightGuide'),
                child: CustomPaint(
                  key: const ValueKey('flight-canvas'),
                  painter: FlightPainter(level: definition, state: () => _round, lifting: () => _lifting, image: () => _image, repaint: _frame),
                ),
              ),
              PositionedDirectional(
                start: 10,
                bottom: 10,
                child: IgnorePointer(
                  child: Container(
                    padding: short ? const EdgeInsets.symmetric(horizontal: 7, vertical: 4) : const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xAAFFFAF3), borderRadius: BorderRadius.circular(20)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AIcon(AIcons.leaf, size: 13, color: Color(0xFF81906D)),
                      const SizedBox(width: 5),
                      Text(t(_routeKeys[definition.chapter - 1]), style: TextStyle(fontSize: short ? 8 : 9, color: const Color(0xFF81906D))),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
        ),
      );

  Widget _controls(CasualText t, bool short) {
    final liftEnabled = _phase == 'playing' && !_ads.waiting;
    return Padding(
      padding: EdgeInsets.only(top: short ? 6 : 10),
      child: Row(children: [
        CasualIconButton(
          key: const ValueKey('flight-pause'),
          icon: const AIcon(AIcons.pause, size: 19),
          label: t('pause'),
          enabled: _phase == 'playing',
          onTap: _pause,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Semantics(
            button: true,
            enabled: liftEnabled,
            selected: _pressed,
            label: t('lift'),
            child: Listener(
              key: const ValueKey('flight-lift'),
              behavior: HitTestBehavior.opaque,
              onPointerDown: liftEnabled ? _pointerDown : null,
              onPointerUp: _pointerUp,
              onPointerCancel: _pointerUp,
              child: Opacity(
                opacity: liftEnabled ? 1 : .4,
                child: Transform.translate(
                  offset: Offset(0, _pressed ? 3 : 0),
                  child: Container(
                    height: short ? 48 : 58,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(short ? 16 : 19),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: _pressed ? const [Color(0xFF98B9CE), Color(0xFF7F8AB5)] : const [Color(0xFFA8C987), Color(0xFF7DA770)],
                      ),
                      boxShadow: [BoxShadow(color: _pressed ? const Color(0xFF6E759E) : const Color(0xFF6F9763), offset: Offset(0, _pressed ? 1 : 4))],
                    ),
                    child: Row(children: [
                      const AIcon(AIcons.arrowUp, size: 21, color: Color(0xFFFFFFFF)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text(t('lift'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFFFFFFF), height: 1.2)),
                          const SizedBox(height: 3),
                          Opacity(opacity: .8, child: Text(t('release'), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF), height: 1.2))),
                        ]),
                      ),
                      const SizedBox(width: 8),
                      const AIcon(AIcons.wind, size: 18, color: Color(0xFFFFFFFF)),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  List<Widget> _dialogBody(CasualText t, FlightLevel? definition, FlightState? view) {
    final p = flightPalette;
    if (_help) return [CasualDialogText(t('flightGuide'))];
    if (_phase == 'ready') {
      return [
        Padding(
          padding: const EdgeInsets.fromLTRB(0, 6, 0, 14),
          child: Column(children: [
            Transform.translate(offset: const Offset(0, 8), child: Transform.rotate(angle: -20 * math.pi / 180, child: const AIcon(AIcons.leaf, size: 34, color: Color(0xFF85AA72)))),
            Image.asset(CasualArt.flight, width: 78, height: 78, fit: BoxFit.contain, excludeFromSemantics: true),
          ]),
        ),
        CasualDialogText(t('flightGuide')),
        CasualDialogActions(children: [
          CasualButton(key: const ValueKey('flight-play'), palette: p, onTap: _play, children: [const AIcon(AIcons.play, size: 17), Text(t('play'))]),
        ]),
      ];
    }
    if (_phase == 'won' && definition != null && view != null && view.won) {
      final result = flightResult(definition, view);
      final last = _levelNumber == leafFlightLevels;
      return [
        CasualStars(stars: result.stars, label: t('stars', {'count': result.stars})),
        CasualDialogText(t('starCount', {'count': result.collected})),
        CasualScore(value: t.number(result.score), label: t('score'), soft: p.soft),
        CasualDialogActions(children: [
          CasualButton(
            key: const ValueKey('flight-next'),
            palette: p,
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(() {
              if (_levelNumber! < leafFlightLevels) {
                _start(_levelNumber! + 1);
              } else {
                setState(() => _levelNumber = null);
              }
            })),
            children: [Text(t(last ? 'back' : 'next'))],
          ),
          CasualButton(palette: p, primary: false, onTap: () => unawaited(_ads.transition(() => setState(() => _levelNumber = null))), children: [Text(t('back'))]),
        ]),
      ];
    }
    if (_phase == 'lost') {
      return [
        CasualDialogText(t('flightGuide')),
        CasualDialogActions(children: [
          CasualButton(
            key: const ValueKey('flight-restart'),
            palette: p,
            onTap: () => unawaited(_ads.transition(_restart)),
            children: [const AIcon(AIcons.rotateCcw, size: 17), Text(t('restart'))],
          ),
          CasualButton(palette: p, primary: false, onTap: () => unawaited(_ads.transition(() => setState(() => _levelNumber = null))), children: [Text(t('back'))]),
        ]),
      ];
    }
    return [
      CasualDialogText(t('saved')),
      CasualDialogActions(children: [
        CasualButton(key: const ValueKey('flight-resume'), palette: p, onTap: _play, children: [const AIcon(AIcons.play, size: 17), Text(t('resume'))]),
        CasualButton(palette: p, primary: false, onTap: _restart, children: [const AIcon(AIcons.rotateCcw, size: 17), Text(t('restart'))]),
        CasualButton(palette: p, primary: false, onTap: () => setState(() => _levelNumber = null), children: [Text(t('back'))]),
      ]),
    ];
  }
}
