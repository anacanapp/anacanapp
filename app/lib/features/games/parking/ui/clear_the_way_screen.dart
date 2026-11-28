// Ported from: src/components/games/parking/ClearTheWay.tsx, src/components/games/parking/hints.ts,
//              src/components/games/parking/parking.css (metrics / dock)
//
// Yolunu aç: slide the cars along their axis (drag, or select + arrow buttons / keys) until Qucaq's car can drive
// out of the right exit; locked exits open for good when the key car reaches the key bay. The saved round is the
// move path (≤ 240) replayed on reopen; 3 solver hints per round run off the UI isolate (10 s timeout); undo
// never lowers the move / hint statistics.
library;

import 'dart:async';
import 'dart:isolate';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../casual/persistence/storage.dart';
import '../../common/engine/json_object.dart';
import '../../common/persistence/game_store.dart';
import '../../ui_common/casual_ui.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/engine.dart';
import 'parking_board.dart';

/// `.parking-screen` palette.
const CasualPalette parkingPalette = CasualPalette(
  accent: Color(0xFF6AA994),
  deep: Color(0xFF468773),
  soft: Color(0xFFEAF1E3),
  background: LinearGradient(
    begin: Alignment(-0.34, -0.94),
    end: Alignment(0.34, 0.94),
    colors: [Color(0xFFF8EEDC), Color(0xFFE1EAD4)],
    stops: [0, .8],
  ),
);

/// `requestParkingHint(level, state, signal)`: the first solver move or null (worker + 10 s timeout).
typedef ParkingHintRunner = Future<ParkingMove?> Function(ParkingLevel level, ParkingState state);

final parkingHintRunnerProvider = Provider<ParkingHintRunner>((ref) => (level, state) async {
      final request = (level: level.toJson(), state: state.toJson());
      final result = await Isolate.run(() => parkingHintJob(request))
          .timeout(const Duration(seconds: 10), onTimeout: () => throw TimeoutException('PARKING_HINT_TIMEOUT'));
      return result == null ? null : ParkingMove.fromJson(result);
    });

List<ParkingMove> _path(JsonMap round) => [for (final move in round['path'] as List) ParkingMove.fromJson(move)];

class ClearTheWay extends ConsumerStatefulWidget {
  const ClearTheWay({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<ClearTheWay> createState() => ClearTheWayState();
}

class ClearTheWayState extends ConsumerState<ClearTheWay> {
  CasualProfile? _profile;
  late final GameStore _store;
  int? _levelNumber;

  /// 'pause' | 'help' | 'restart' | null.
  String? _modal;
  int? _selected;
  ParkingMove? _hint;
  bool _hintBusy = false;
  int _hintToken = 0;
  bool _storageReady = true;
  JsonMap? _finishedRound;
  String? _notice;
  bool _completed = false;
  late final GameAdsController _ads;
  String _phase = 'menu';

  String get phase => _phase;

  /// The solver hint shown on the board.
  ParkingMove? get hint => _hint;

  @override
  void initState() {
    super.initState();
    _store = ref.read(gameStoreProvider);
    ref.read(gameAnalyticsProvider).screen('ClearTheWay', 'MiniGames');
    _ads = GameAdsController(gameId: parkingId, platform: ref.read(gameAdsPlatformProvider), phase: 'menu', restore: (_) {})..addListener(_rebuild);
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _hintToken++;
    _ads.removeListener(_rebuild);
    _ads.dispose();
    super.dispose();
  }

  ParkingCatalog get _catalog => ref.read(gameDataProvider).requireValue.parkingCatalog;
  CasualProfile get _current => _profile!;
  ParkingLevel? get _definition => _levelNumber == null ? null : _catalog.level(_levelNumber!);

  JsonMap? _roundFor(ParkingLevel? definition) {
    if (definition == null) return null;
    final saved = _current.round;
    if (saved is Map && saved['level'] == definition.level) return asMap(saved);
    return _finishedRound;
  }

  void _commit(CasualProfile value) {
    _profile = value;
    final ok = writeCasualProfile(_store, value);
    if (mounted) setState(() => _storageReady = ok);
  }

  void _cancelHint() {
    _hintToken++;
    if (_hintBusy || _hint != null) {
      setState(() {
        _hintBusy = false;
        _hint = null;
      });
    }
  }

  void _move(ParkingMove value) {
    final definition = _definition, round = _roundFor(definition);
    if (definition == null || round == null || _phase != 'playing' || _ads.waiting || _hintBusy) return;
    final state = replayParking(definition, _path(round));
    final next = moveParking(definition, state, value);
    if (next == null) {
      setState(() => _notice = 'blocked');
      return;
    }
    if ((round['path'] as List).length >= 240) {
      setState(() => _notice = 'hintNone');
      return;
    }
    _hint = null;
    _notice = !state.open && next.open ? 'parkingKey' : null;
    _commit(_current.withRound({
      ...round,
      'path': [...round['path'] as List, value.toJson()],
      'moves': (round['moves'] as num) + 1,
    }));
    unawaited(ref.read(gameHapticsProvider).light().catchError((Object _) {}));
  }

  void _back() {
    _cancelHint();
    if (_levelNumber == null) {
      widget.onBack();
    } else if (_phase == 'playing') {
      setState(() => _modal = 'pause');
    } else {
      setState(() {
        _modal = null;
        _levelNumber = null;
      });
    }
  }

  void _start(int level) {
    if (level < 1 || level > _current.unlocked) return;
    _cancelHint();
    _modal = null;
    _notice = null;
    _selected = null;
    _finishedRound = null;
    _completed = false;
    _ads.resetRound();
    final saved = _current.round;
    if (!(saved is Map && saved['level'] == level)) _commit(_current.withRound(createParkingRound(level)));
    setState(() => _levelNumber = level);
    ref.read(gameAnalyticsProvider).event('minigame_level_started', {'game_id': parkingId, 'level': level});
  }

  void _restart() {
    final level = _levelNumber;
    if (level == null) return;
    _cancelHint();
    _modal = null;
    _notice = null;
    _selected = null;
    _completed = false;
    _finishedRound = null;
    _commit(_current.withRound(createParkingRound(level)));
    _ads.resetRound();
  }

  void _undo() {
    final saved = _current.round;
    if (saved is! Map || (saved['path'] as List).isEmpty || _ads.waiting || _hintBusy) return;
    final round = asMap(saved);
    _cancelHint();
    _notice = null;
    final path = round['path'] as List;
    _commit(_current.withRound({...round, 'path': path.sublist(0, path.length - 1), 'undos': (round['undos'] as num) + 1}));
  }

  Future<void> _getHint() async {
    final definition = _definition, round = _roundFor(definition);
    if (definition == null || round == null || _phase != 'playing' || _hintBusy || _ads.waiting) return;
    if ((round['hints'] as num) >= 3) {
      setState(() => _notice = 'hintEmpty');
      return;
    }
    final token = ++_hintToken;
    final path = round['path'];
    final state = replayParking(definition, _path(round));
    setState(() {
      _hintBusy = true;
      _notice = null;
    });
    try {
      final found = await ref.read(parkingHintRunnerProvider)(definition, state);
      final current = _current.round;
      if (!mounted || token != _hintToken || current is! Map || !identical(current['path'], path) || _phase != 'playing') return;
      if (found != null) {
        setState(() {
          _hint = found;
          _selected = found.car;
        });
        _commit(_current.withRound({...round, 'hints': (round['hints'] as num) + 1}));
      } else {
        setState(() => _notice = 'hintNone');
      }
    } catch (_) {
      if (mounted && token == _hintToken) setState(() => _notice = 'hintNone');
    } finally {
      if (mounted && token == _hintToken) setState(() => _hintBusy = false);
    }
  }

  void _shift(int sign, ParkingState? state) {
    final selected = _selected;
    if (selected == null || state == null) return;
    final from = state.positions[selected];
    _move(ParkingMove(selected, selected == 0 && sign > 0 && from == 4 ? 6 : from + sign));
  }

  void _checkWin(ParkingLevel? definition, JsonMap? round, bool won) {
    if (definition == null || round == null || !won || _completed) return;
    _completed = true;
    _finishedRound = round;
    final result = parkingResult(definition, round);
    _commit(recordCasualWin(_current, definition.level, parkingLevels, (stars: result.stars, score: result.score)));
    unawaited(ref.read(gameHapticsProvider).medium().catchError((Object _) {}));
    ref.read(gameAnalyticsProvider).event('minigame_level_won', {'game_id': parkingId, 'level': definition.level, 'score': result.score});
  }

  bool _onKey(KeyEvent event, ParkingLevel? definition, ParkingState? state) {
    if (event is! KeyDownEvent) return false;
    if (event.logicalKey == LogicalKeyboardKey.escape && _modal == null) {
      _back();
      return true;
    }
    final selected = _selected;
    if (_phase != 'playing' || selected == null || definition == null || state == null || gameModifierPressed()) return false;
    final car = definition.cars[selected], key = event.logicalKey;
    final sign = car.axis == 'h'
        ? key == LogicalKeyboardKey.arrowRight
            ? 1
            : key == LogicalKeyboardKey.arrowLeft
                ? -1
                : 0
        : key == LogicalKeyboardKey.arrowDown
            ? 1
            : key == LogicalKeyboardKey.arrowUp
                ? -1
                : 0;
    if (sign == 0) return false;
    final from = state.positions[selected];
    _move(ParkingMove(selected, selected == 0 && sign > 0 && from == 4 ? 6 : from + sign));
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const SizedBox.shrink();
    _profile ??= readCasualProfile(_store, parkingId, parkingRevision, parkingLevels, (round) => validParkingRound(round, data.parkingCatalog));
    final t = CasualText(data.casual, ref.watch(gameLanguageProvider));
    final definition = _definition, round = _roundFor(definition);
    final state = definition != null && round != null ? replayParking(definition, _path(round)) : null;
    final won = state != null && parkingSolved(state);
    _phase = definition == null
        ? 'menu'
        : _modal != null
            ? 'paused'
            : won
                ? 'won'
                : 'playing';
    _ads.update(phase: _phase, restore: (_) {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _checkWin(definition, round, won);
    });
    final result = definition != null && round != null ? parkingResult(definition, round) : null;
    final savedRound = _current.round;

    return GameBackHandler(
      onBack: () {
        if (_modal != null) return false;
        _back();
        return true;
      },
      child: GameLifecycleListener(
        onHidden: () {
          if (_phase == 'playing') {
            _cancelHint();
            setState(() => _modal = 'pause');
          }
        },
        child: GameKeyboardListener(
          onKey: (event) => _onKey(event, definition, state),
          child: CasualScreen(
            screenKey: const ValueKey('parking-screen'),
            palette: parkingPalette,
            dir: t.dir,
            overlay: _modal != null || won
                ? GameDialog(
                    key: ValueKey('parking-dialog:${_modal ?? 'won'}'),
                    title: t(_modal == 'help'
                        ? 'help'
                        : _modal == 'restart'
                            ? 'restart'
                            : _modal == 'pause'
                                ? 'pause'
                                : 'parkingWon'),
                    closeLabel: t('close'),
                    onClose: () {
                      if (_modal != null) {
                        setState(() => _modal = null);
                      } else {
                        setState(() => _levelNumber = null);
                      }
                    },
                    children: _dialogBody(t, definition, result),
                  )
                : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CasualHeader(
                eyebrow: _levelNumber == null ? CasualArt.brand : t('parkingTitle'),
                title: _levelNumber == null ? t('parkingTitle') : t('level', {'level': _levelNumber}),
                onBack: _back,
                backLabel: t('back'),
                action: CasualIconButton(
                  key: const ValueKey('cg-help'),
                  icon: const AIcon(AIcons.circleHelp, size: 19),
                  label: t('help'),
                  onTap: () {
                    _cancelHint();
                    setState(() => _modal = 'help');
                  },
                ),
              ),
              Expanded(
                child: definition != null && state != null && round != null
                    ? _game(t, definition, state, round)
                    : GameLobby(
                        palette: parkingPalette,
                        title: t('parkingTitle'),
                        description: t('parkingCard'),
                        image: CasualArt.parking,
                        count: parkingLevels,
                        profile: _current,
                        savedLevel: savedRound is Map ? (savedRound['level'] as num).toInt() : null,
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

  Widget _game(CasualText t, ParkingLevel definition, ParkingState state, JsonMap round) {
    final short = MediaQuery.sizeOf(context).height <= 610;
    final p = parkingPalette;
    final controlsDisabled = _phase != 'playing' || _hintBusy || _ads.waiting;
    final selected = _selected;
    final vertical = selected != null && definition.cars[selected].axis == 'v';
    final canExit = _phase == 'playing' && moveParking(definition, state, const ParkingMove(0, 6)) != null;
    Widget shiftButton(Key key, int sign) {
      final enabled = selected != null && _phase == 'playing' && !_hintBusy;
      return GameButton(
        key: key,
        enabled: enabled,
        label: t(vertical ? (sign < 0 ? 'up' : 'down') : (sign < 0 ? 'left' : 'right')),
        onTap: () => _shift(sign, state),
        child: Opacity(
          opacity: enabled ? 1 : .4,
          child: Container(
            width: short ? 38 : 42,
            height: short ? 40 : 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: const Color(0xFFE6EDDD), borderRadius: BorderRadius.circular(13)),
            child: AIcon(vertical ? (sign < 0 ? AIcons.arrowUp : AIcons.arrowDown) : (sign < 0 ? AIcons.arrowLeft : AIcons.arrowRight), size: 21, color: p.deep),
          ),
        ),
      );
    }

    final noticeText = _hintBusy
        ? t('hintBusy')
        : _notice != null
            ? t(_notice!)
            : definition.keyBay != null && !state.open
                ? t('parkingKey')
                : t('parkingGuide');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        constraints: BoxConstraints(minHeight: short ? 37 : 47),
        margin: const EdgeInsets.only(bottom: 7),
        padding: short ? const EdgeInsets.symmetric(horizontal: 9, vertical: 6) : const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
        decoration: BoxDecoration(color: CasualPalette.surface, borderRadius: BorderRadius.circular(17)),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            const AIcon(AIcons.carFront, size: 17, color: CasualPalette.muted),
            const SizedBox(width: 5),
            Text(t.number(definition.cars.length), style: TextStyle(fontSize: short ? 9 : 10, color: CasualPalette.muted)),
            const SizedBox(width: 5),
            Text(t('cars'), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: CasualPalette.muted)),
          ]),
          Row(children: [
            Text(t.number(round['moves'] as num),
                key: const ValueKey('parking-moves'), style: TextStyle(fontSize: short ? 18 : 21, fontWeight: FontWeight.w700, color: p.deep)),
            const SizedBox(width: 5),
            Text(t('moves'), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: p.deep)),
          ]),
          const SizedBox(width: 10),
          Flexible(
            child: Text(t('par', {'count': definition.par}), textAlign: TextAlign.end, style: TextStyle(fontSize: short ? 9 : 10, color: CasualPalette.muted)),
          ),
        ]),
      ),
      Expanded(
        child: ParkingBoard(
          level: definition,
          state: state,
          selected: _selected,
          onSelect: (car) => setState(() => _selected = car),
          onMove: _move,
          hint: _hint,
          disabled: controlsDisabled,
          t: t,
        ),
      ),
      Container(
        margin: EdgeInsets.only(top: short ? 6 : 9),
        padding: short ? const EdgeInsets.symmetric(horizontal: 8, vertical: 6) : const EdgeInsets.fromLTRB(11, 9, 11, 11),
        decoration: BoxDecoration(color: CasualPalette.surface, borderRadius: BorderRadius.circular(short ? 18 : 23), border: Border.all(color: const Color(0xFFFFFFFF))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            constraints: BoxConstraints(minHeight: short ? 24 : 31),
            margin: EdgeInsets.fromLTRB(4, 0, 4, short ? 5 : 8),
            alignment: Alignment.center,
            child: Semantics(
              liveRegion: true,
              child: Text(noticeText, key: const ValueKey('parking-notice'), textAlign: TextAlign.center, style: TextStyle(fontSize: short ? 8 : 10, height: 1.5, color: CasualPalette.muted)),
            ),
          ),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(children: [
              shiftButton(const ValueKey('parking-shift-back'), -1),
              SizedBox(width: short ? 4 : 6),
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 55, maxWidth: 100),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (selected == null)
                      AIcon(AIcons.carFront, size: 21, color: p.deep)
                    else if (selected == 0) ...[
                      Image.asset(CasualArt.parking, width: 37, height: 37, fit: BoxFit.contain, excludeFromSemantics: true),
                      const SizedBox(width: 4),
                      Text(CasualArt.qucaqName, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: p.deep)),
                    ] else ...[
                      Text(definition.cars[selected].id, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: p.deep)),
                      if (definition.keyBay?.car == selected) ...[const SizedBox(width: 4), AIcon(AIcons.keyRound, size: 13, color: p.deep)],
                    ],
                  ]),
                ),
              ),
              SizedBox(width: short ? 4 : 6),
              shiftButton(const ValueKey('parking-shift-forward'), 1),
              SizedBox(width: short ? 4 : 6),
              Expanded(
                child: GameButton(
                  key: const ValueKey('parking-exit'),
                  enabled: canExit,
                  label: t('exit'),
                  onTap: () => _move(const ParkingMove(0, 6)),
                  child: Opacity(
                    opacity: canExit ? 1 : .4,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 80),
                      height: short ? 40 : 44,
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(begin: const Alignment(-0.6, -1), end: const Alignment(0.6, 1), colors: [p.accent, p.deep]),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const AIcon(AIcons.arrowRight, size: 17, color: Color(0xFFFFFFFF)),
                        const SizedBox(width: 5),
                        Flexible(child: Text(t('exit'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF)))),
                      ]),
                    ),
                  ),
                ),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(children: [
              Expanded(
                child: CasualToolButton(
                  key: const ValueKey('parking-undo'),
                  palette: p,
                  icon: AIcons.undo2,
                  label: t('undo'),
                  enabled: (round['path'] as List).isNotEmpty && _phase == 'playing' && !_hintBusy,
                  onTap: _undo,
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: CasualToolButton(
                  key: const ValueKey('parking-hint'),
                  palette: p,
                  icon: AIcons.lightbulb,
                  label: t('hint'),
                  badge: t.number(3 - (round['hints'] as num)),
                  enabled: _phase == 'playing' && !_hintBusy,
                  onTap: () => unawaited(_getHint()),
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: CasualToolButton(
                  key: const ValueKey('parking-pause'),
                  palette: p,
                  icon: AIcons.pause,
                  label: t('pause'),
                  enabled: _phase == 'playing',
                  onTap: () {
                    _cancelHint();
                    setState(() => _modal = 'pause');
                  },
                ),
              ),
            ]),
          ),
          if (!_storageReady)
            Padding(
              padding: const EdgeInsets.fromLTRB(5, 11, 5, 0),
              child: Text(t('storage'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, height: 1.5, color: CasualPalette.muted)),
            ),
        ]),
      ),
    ]);
  }

  List<Widget> _dialogBody(CasualText t, ParkingLevel? definition, ({int stars, int score})? result) {
    final p = parkingPalette;
    switch (_modal) {
      case 'help':
        return [CasualDialogText(t('parkingGuide')), CasualDialogText(t('parkingKey'))];
      case 'restart':
        return [
          CasualDialogActions(children: [
            CasualButton(key: const ValueKey('parking-restart-confirm'), palette: p, onTap: _restart, children: [const AIcon(AIcons.rotateCcw, size: 17), Text(t('restart'))]),
            CasualButton(palette: p, primary: false, onTap: () => setState(() => _modal = null), children: [Text(t('resume'))]),
          ]),
        ];
      case 'pause':
        return [
          CasualDialogText(t('saved')),
          CasualDialogActions(children: [
            CasualButton(key: const ValueKey('parking-resume'), palette: p, onTap: () => setState(() => _modal = null), children: [const AIcon(AIcons.play, size: 17), Text(t('resume'))]),
            CasualButton(palette: p, primary: false, onTap: () => setState(() => _modal = 'restart'), children: [const AIcon(AIcons.rotateCcw, size: 17), Text(t('restart'))]),
            CasualButton(
              palette: p,
              primary: false,
              onTap: () => setState(() {
                _modal = null;
                _levelNumber = null;
              }),
              children: [Text(t('back'))],
            ),
          ]),
        ];
    }
    if (result == null || definition == null) return const [];
    final last = _levelNumber == parkingLevels;
    return [
      Transform.translate(
        offset: const Offset(0, -5),
        child: Center(child: Image.asset(CasualArt.parking, width: 95, height: 95, fit: BoxFit.contain, excludeFromSemantics: true)),
      ),
      CasualStars(stars: result.stars, label: t('stars', {'count': result.stars})),
      CasualScore(value: t.number(result.score), label: t('score'), soft: p.soft),
      CasualDialogText(t('par', {'count': definition.par})),
      CasualDialogActions(children: [
        CasualButton(
          key: const ValueKey('parking-next'),
          palette: p,
          enabled: !_ads.waiting,
          onTap: () => unawaited(_ads.transition(() {
            if (_levelNumber! < parkingLevels) {
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
}
