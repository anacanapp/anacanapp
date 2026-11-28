// Ported from: src/components/games/iki-dost/TwoFriends.tsx, src/components/games/iki-dost/hints.ts and the lobby /
//              status / dock rules of two-friends.css
//
// İki dost: one shared control moves Ritm and Tumurcuq at once (Tumurcuq's axis may be mirrored), keys open
// gates in both worlds for good, plates open their gates by the pre-move plate state, water ends the round
// (undo restores the joint state), both friends must be home at the same time. The saved round is the move path
// (≤ 320) and is replayed on reopen; solver hints (3 per round) run off the UI isolate with a 5 s timeout.
library;

import 'dart:async';
import 'dart:isolate';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/engine.dart';
import '../engine/state.dart';
import '../persistence/storage.dart';
import 'friends_board.dart';
import 'friends_ui.dart';

/// `requestFriendsHint(level, state, signal)`: the next solver direction or null (worker + 5 s timeout).
typedef FriendsHintRunner = Future<String?> Function(FriendsLevel level, FriendsState state);

final friendsHintRunnerProvider = Provider<FriendsHintRunner>((ref) => (level, state) {
      final request = (level: level.toJson(), state: state.toJson());
      return Isolate.run(() => friendsHintJob(request))
          .timeout(const Duration(seconds: 5), onTimeout: () => throw TimeoutException('TWO_FRIENDS_HINT_TIMEOUT'));
    });

const Map<String, AIconData> _directionIcons = {'up': AIcons.arrowUp, 'right': AIcons.arrowRight, 'down': AIcons.arrowDown, 'left': AIcons.arrowLeft};

String? _keyDirection(KeyEvent event) {
  final key = event.logicalKey;
  if (key == LogicalKeyboardKey.arrowUp) return 'up';
  if (key == LogicalKeyboardKey.arrowRight) return 'right';
  if (key == LogicalKeyboardKey.arrowDown) return 'down';
  if (key == LogicalKeyboardKey.arrowLeft) return 'left';
  return switch (event.character) { 'w' => 'up', 'd' => 'right', 's' => 'down', 'a' => 'left', _ => null };
}

class TwoFriends extends ConsumerStatefulWidget {
  const TwoFriends({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<TwoFriends> createState() => TwoFriendsState();
}

class TwoFriendsState extends ConsumerState<TwoFriends> {
  FriendsProfile? _profile;
  int? _levelNumber;
  int _chapter = 1;

  /// 'pause' | 'help' | 'settings' | 'restart' | null.
  String? _modal;
  ({bool sound, bool haptics}) _preferences = (sound: false, haptics: true);
  bool _storageReady = true;
  String? _notice;
  String? _hint;
  bool _hintBusy = false;
  int _hintToken = 0;
  double _movementTime = double.negativeInfinity;
  late final GameTonePlayer _audio;
  late final GameAdsController _ads;

  String get phase => _phase;
  String _phase = 'menu';

  /// The highlighted solver direction.
  String? get hint => _hint;

  @override
  void initState() {
    super.initState();
    _audio = ref.read(gameTonePlayerFactoryProvider)();
    ref.read(gameAnalyticsProvider).screen('TwoFriends', 'MiniGames');
    _preferences = readFriendsPreferences(ref.read(gameStoreProvider));
    _ads = GameAdsController(gameId: twoFriendsId, platform: ref.read(gameAdsPlatformProvider), phase: 'menu', restore: (_) {})..addListener(_rebuild);
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _audio.close();
    _hintToken++;
    _ads.removeListener(_rebuild);
    _ads.dispose();
    super.dispose();
  }

  FriendsCatalog get _catalog => ref.read(gameDataProvider).requireValue.friendsCatalog;

  void _ensureProfile() {
    if (_profile != null) return;
    _profile = readFriendsProfile(ref.read(gameStoreProvider), _catalog);
    _chapter = (_profile!.unlocked / 8).ceil();
  }

  FriendsProfile get _current => _profile!;

  void _transact(FriendsProfile Function(FriendsProfile value) update) {
    final next = update(_current);
    if (identical(next, _current)) return;
    setState(() {
      _profile = next;
      _storageReady = writeFriendsProfile(ref.read(gameStoreProvider), next);
    });
  }

  void _feedback(String kind) {
    _audio.play(kind, _preferences.sound);
    if (_preferences.haptics) {
      final haptics = ref.read(gameHapticsProvider);
      unawaited((kind == 'letter' ? haptics.light() : haptics.medium()).catchError((Object _) {}));
    }
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

  FriendsLevel? get _definition => _levelNumber == null ? null : _catalog.level(_levelNumber!);
  FriendsRound? _roundFor(FriendsLevel? definition) =>
      definition != null && _current.round?.level == definition.level ? _current.round : null;

  void _back() {
    _cancelHint();
    if (_levelNumber != null) {
      if (_phase == 'playing') {
        setState(() => _modal = 'pause');
      } else {
        setState(() {
          _modal = null;
          _levelNumber = null;
        });
      }
    } else {
      widget.onBack();
    }
  }

  void _direction(String value) {
    final definition = _definition, round = _roundFor(definition);
    if (definition == null || round == null || _phase != 'playing' || _ads.waiting || _hintBusy) return;
    final replay = replayFriends(definition, round.path);
    final now = ref.read(gameClockProvider).nowMs();
    if (now - _movementTime < 135) return;
    _movementTime = now;
    final move = moveFriends(definition, replay.state, value);
    if (!move.changed) {
      setState(() => _notice = 'blocked');
      return;
    }
    if (round.path.length >= friendsPathLimit) {
      setState(() => _notice = 'hintNone');
      return;
    }
    _hint = null;
    _notice = move.collectedKeys != 0
        ? 'keyFound'
        : move.openedDoors != 0
            ? 'gateOpen'
            : null;
    _transact((profile) {
      final r = profile.round;
      return r == null ? profile : profile.withRound(r.copyWith({'path': [...r.path, value], 'moves': r.moves + 1}));
    });
    _feedback(move.collectedKeys != 0 || move.openedDoors != 0 ? 'found' : 'letter');
  }

  void _start(int level) {
    if (level < 1 || level > _current.unlocked) return;
    _cancelHint();
    _notice = null;
    _modal = null;
    _movementTime = double.negativeInfinity;
    if (_current.round?.level != level || _current.round!.awarded) _transact((value) => value.withRound(createFriendsRound(level)));
    setState(() => _levelNumber = level);
    _ads.resetRound();
    ref.read(gameAnalyticsProvider).event('minigame_level_started', {'game_id': twoFriendsId, 'level': level});
  }

  void _restart() {
    _cancelHint();
    setState(() {
      _notice = null;
      _modal = null;
    });
    final level = _levelNumber;
    if (level != null) _transact((value) => value.withRound(createFriendsRound(level)));
    _ads.resetRound();
    _movementTime = double.negativeInfinity;
  }

  void _undo(bool won) {
    final round = _current.round;
    if (round == null || round.path.isEmpty || won || _ads.waiting) return;
    _cancelHint();
    _notice = null;
    _movementTime = double.negativeInfinity;
    _transact((value) => value.withRound(value.round!.copyWith({'path': value.round!.path.sublist(0, value.round!.path.length - 1), 'undos': value.round!.undos + 1})));
    _feedback('letter');
  }

  Future<void> _requestHint() async {
    final definition = _definition, round = _roundFor(definition);
    if (definition == null || round == null || _phase != 'playing' || _ads.waiting || _hintBusy) return;
    if (round.hints >= friendsHintLimit) {
      setState(() => _notice = 'hintEmpty');
      return;
    }
    final token = ++_hintToken;
    final path = round.json['path'];
    final state = replayFriends(definition, round.path).state;
    setState(() {
      _hintBusy = true;
      _notice = null;
    });
    try {
      final found = await ref.read(friendsHintRunnerProvider)(definition, state);
      if (!mounted || token != _hintToken || !identical(_current.round?.json['path'], path) || _phase != 'playing') return;
      if (found != null) {
        setState(() => _hint = found);
        _transact((value) => value.withRound(value.round!.copyWith({'hints': value.round!.hints + 1})));
      } else {
        setState(() => _notice = 'hintNone');
      }
    } catch (_) {
      if (mounted && token == _hintToken) setState(() => _notice = 'hintNone');
    } finally {
      if (mounted && token == _hintToken) setState(() => _hintBusy = false);
    }
  }

  void _setPreference(String key) {
    final next = key == 'sound' ? (sound: !_preferences.sound, haptics: _preferences.haptics) : (sound: _preferences.sound, haptics: !_preferences.haptics);
    setState(() => _preferences = next);
    writeFriendsPreferences(ref.read(gameStoreProvider), next);
  }

  void _checkWin(FriendsLevel? definition, FriendsRound? round, bool won) {
    if (definition == null || round == null || !won || round.awarded || (_current.round?.awarded ?? false)) return;
    _transact((value) => completeFriendsLevel(value, definition));
    _feedback('win');
    ref.read(gameAnalyticsProvider).event('minigame_level_won', {
      'game_id': twoFriendsId,
      'level': definition.level,
      'score': friendsResult(definition, round).score,
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const SizedBox.shrink();
    _ensureProfile();
    final t = FriendsText(data.friends, ref.watch(gameLanguageProvider));
    final definition = _definition, round = _roundFor(definition);
    final replay = definition != null && round != null ? replayFriends(definition, round.path) : null;
    final won = definition != null && replay != null && !replay.lost && friendsSolved(definition, replay.state);
    _phase = definition == null
        ? 'menu'
        : _modal != null
            ? 'paused'
            : replay?.lost ?? false
                ? 'lost'
                : won
                    ? 'won'
                    : 'playing';
    _ads.update(phase: _phase, restore: (_) {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _checkWin(definition, round, won);
    });
    final pad = MediaQuery.paddingOf(context);
    final showDialog = _modal != null || (definition != null && (won || (replay?.lost ?? false)));
    final overlayTitle = _modal != null
        ? t(_modal == 'pause'
            ? 'pause'
            : _modal == 'restart'
                ? 'restart'
                : _modal!)
        : t(won ? 'won' : 'lost');

    return GamePortal(
      child: GameBackHandler(
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
            onKey: (event) {
              if (event is! KeyDownEvent || gameModifierPressed()) return false;
              final value = _keyDirection(event);
              if (value != null && _phase == 'playing') {
                _direction(value);
                return true;
              }
              if (event.logicalKey == LogicalKeyboardKey.escape && _modal == null) {
                _back();
                return true;
              }
              return false;
            },
            child: Directionality(
              key: const ValueKey('two-friends-screen'),
              textDirection: t.dir,
              child: DefaultTextStyle(
                style: tfText(14),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFFF7F0E4), Color(0xFFE1E9D3), Color(0xFFC2D6BF)],
                      stops: [0, .7, 1],
                    ),
                  ),
                  child: Stack(children: [
                    const Positioned.fill(child: _Landscape()),
                    Padding(
                      padding: EdgeInsets.fromLTRB(math.max(14, pad.left), math.max(10, pad.top), math.max(14, pad.right), math.max(10, pad.bottom)),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 540),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            _header(t, definition),
                            Expanded(
                              child: definition == null
                                  ? _lobby(t)
                                  : round != null && replay != null
                                      ? _game(t, definition, round, replay.state, won)
                                      : const SizedBox.shrink(),
                            ),
                          ]),
                        ),
                      ),
                    ),
                    if (showDialog)
                      FriendsDialog(
                        key: ValueKey('tf-dialog:${_modal ?? _phase}'),
                        title: overlayTitle,
                        closeLabel: t('close'),
                        onClose: () {
                          if (_modal != null) {
                            setState(() => _modal = null);
                          } else {
                            _cancelHint();
                            setState(() => _levelNumber = null);
                          }
                        },
                        children: _dialogBody(t, definition, round, won, replay?.lost ?? false),
                      ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(FriendsText t, FriendsLevel? definition) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            FriendsIconButton(key: const ValueKey('tf-back'), icon: AIcons.arrowLeft, label: t('back'), onTap: _back, mirror: true),
            const SizedBox(width: 11),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(definition != null ? t('title') : friendsBrand, style: tfText(9, weight: FontWeight.w800, color: FriendsPalette.muted, ls: .3)),
                Semantics(
                  header: true,
                  child: Text(definition != null ? t('level', {'level': definition.level}) : t('title'),
                      style: tfText(20, weight: FontWeight.w900, height: 1.3, ls: -.5)),
                ),
              ]),
            ),
            const SizedBox(width: 11),
            FriendsIconButton(
              key: const ValueKey('tf-settings'),
              icon: AIcons.settings2,
              label: t('settings'),
              onTap: () {
                _cancelHint();
                setState(() => _modal = 'settings');
              },
            ),
          ]),
        ),
      );

  Widget _lobby(FriendsText t) {
    final profile = _current;
    final savedLevel = profile.round != null && !profile.round!.awarded ? profile.round!.level : profile.unlocked;
    final resume = profile.round != null && !profile.round!.awarded;
    final width = MediaQuery.sizeOf(context).width;
    Widget friend(int side) => SizedBox(
          width: 136,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset(friendsArtAssets[side], width: 140, height: 145, fit: BoxFit.contain, excludeFromSemantics: true),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(color: const Color(0xAAFFFCF8), borderRadius: BorderRadius.circular(30), border: Border.all(color: const Color(0xFFFFFFFF))),
              child: Text(friendNames[side], style: tfText(10, weight: FontWeight.w800, color: side == 0 ? const Color(0xFFCC6963) : const Color(0xFF9866BA))),
            ),
          ]),
        );
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(2, 5, 2, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const AIcon(AIcons.heartHandshake, size: 14, color: FriendsPalette.green),
            const SizedBox(width: 6),
            Flexible(child: Text(t('tagline'), style: tfText(11, weight: FontWeight.w800, color: FriendsPalette.green))),
          ]),
        ),
        Text(t('title'), textAlign: TextAlign.center, style: tfText((width * .1).clamp(35, 46), weight: FontWeight.w900, ls: -1.8, height: 1.2)),
        Container(
          height: 172,
          margin: const EdgeInsets.fromLTRB(0, 9, 0, 16),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              friend(0),
              const SizedBox(width: 4),
              const Padding(padding: EdgeInsets.only(bottom: 20), child: AIcon(AIcons.heartHandshake, size: 28, color: FriendsPalette.green)),
              const SizedBox(width: 4),
              friend(1),
            ]),
          ),
        ),
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 290),
            child: Text(t('card'), textAlign: TextAlign.center, style: tfText(12, color: FriendsPalette.muted, height: 1.6)),
          ),
        ),
        const SizedBox(height: 17),
        GameButton(
          key: const ValueKey('tf-play'),
          onTap: () => _start(savedLevel),
          child: Container(
            constraints: const BoxConstraints(minHeight: 58),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(begin: Alignment(-0.8, -0.6), end: Alignment(0.8, 0.6), colors: [FriendsPalette.coral, Color(0xFFCB625F)]),
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [BoxShadow(color: Color(0x66BE6150), offset: Offset(0, 8), blurRadius: 22, spreadRadius: -9)],
            ),
            child: Row(children: [
              const GameFilledIcon(AIcons.play, size: 18, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 8),
              Expanded(child: Text(t(resume ? 'resume' : 'play'), style: tfText(16, weight: FontWeight.w800, color: const Color(0xFFFFFFFF)))),
              Text(t('level', {'level': savedLevel}), style: tfText(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
              const SizedBox(width: 8),
              const AIcon(AIcons.arrowRight, size: 16, color: Color(0xFFFFFFFF), mirrorInRtl: false),
            ]),
          ),
        ),
        Container(
          margin: const EdgeInsets.only(top: 19),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: FriendsPalette.surface,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0xFFFFFFFF)),
            boxShadow: const [BoxShadow(color: Color(0x0952694B), offset: Offset(0, 9), blurRadius: 30)],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                FriendsIconButton(
                  key: const ValueKey('tf-chapter-previous'),
                  icon: AIcons.chevronLeft,
                  label: t('back'),
                  plain: true,
                  mirror: true,
                  enabled: _chapter != 1,
                  onTap: () => setState(() => _chapter--),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(children: [
                    Text('${t.number(_chapter)} / ${t.number(5)}', style: tfText(9, color: FriendsPalette.muted)),
                    const SizedBox(height: 3),
                    Text(t('chapter$_chapter'), textAlign: TextAlign.center, style: tfText(15, weight: FontWeight.w900)),
                  ]),
                ),
                const SizedBox(width: 8),
                FriendsIconButton(
                  key: const ValueKey('tf-chapter-next'),
                  icon: AIcons.chevronRight,
                  label: t('next'),
                  plain: true,
                  mirror: true,
                  enabled: _chapter != 5,
                  onTap: () => setState(() => _chapter++),
                ),
              ]),
            ),
            LayoutBuilder(builder: (context, constraints) {
              final size = (constraints.maxWidth - 3 * 9) / 4;
              return Wrap(spacing: 9, runSpacing: 9, children: [
                for (var level = (_chapter - 1) * 8 + 1; level <= _chapter * 8; level++) SizedBox(width: size, height: size, child: _levelButton(t, level)),
              ]);
            }),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FriendsButton(
              key: const ValueKey('tf-help'),
              kind: 'secondary',
              icon: AIcons.circleHelp,
              label: t('help'),
              onTap: () => setState(() => _modal = 'help'),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
              child: Text(t(_storageReady ? 'saved' : 'storage'), textAlign: TextAlign.center, style: tfText(10, color: FriendsPalette.muted)),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _levelButton(FriendsText t, int level) {
    final profile = _current;
    final unlocked = level <= profile.unlocked;
    final completed = profile.levels['$level'];
    final stars = completed is Map ? ((completed['stars'] as num?) ?? 0).toInt() : 0;
    final current = completed == null && level == profile.unlocked;
    final fg = completed != null
        ? FriendsPalette.green
        : current
            ? const Color(0xFFFFFFFF)
            : const Color(0xFFA1AAA0);
    return GameButton(
      key: ValueKey('friends-level-$level'),
      enabled: unlocked,
      label: t('level', {'level': level}),
      onTap: () => _start(level),
      child: Opacity(
        opacity: unlocked ? 1 : .55,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: completed != null ? const Color(0xFFE5EFD9) : current ? null : const Color(0xFFF1F3E9),
            gradient: current ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [FriendsPalette.coral, Color(0xFFCB625F)]) : null,
            boxShadow: current ? const [BoxShadow(color: Color(0x22B0664E), offset: Offset(0, 5), blurRadius: 13)] : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (unlocked) Text(t.number(level), style: tfText(21, weight: FontWeight.w900, color: fg, height: 1.2)) else AIcon(AIcons.lockKeyhole, size: 19, color: fg),
            const SizedBox(height: 6),
            if (completed != null)
              Row(mainAxisSize: MainAxisSize.min, children: [
                for (var star = 1; star <= 3; star++) Padding(padding: const EdgeInsets.symmetric(horizontal: .5), child: GameStar(size: 9, filled: star <= stars, color: fg)),
              ])
            else
              AIcon(AIcons.house, size: 12, color: fg),
          ]),
        ),
      ),
    );
  }

  Widget _game(FriendsText t, FriendsLevel definition, FriendsRound round, FriendsState state, bool won) {
    final controlsDisabled = _phase != 'playing' || _hintBusy || _ads.waiting;
    final short = MediaQuery.sizeOf(context).height <= 610;
    Widget note(int side, String text) => Expanded(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset(friendsArtAssets[side], width: 44, height: 44, fit: BoxFit.contain, excludeFromSemantics: true),
            const SizedBox(height: 3),
            Text(friendNames[side], style: tfText(10, weight: FontWeight.w900, color: side == 0 ? const Color(0xFFD07268) : const Color(0xFF9870B5))),
            const SizedBox(height: 3),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 90),
              child: Text(text, textAlign: TextAlign.center, style: tfText(8, color: FriendsPalette.muted, height: 1.35)),
            ),
          ]),
        );
    Widget direction(String value) {
      final hinted = _hint == value;
      return GameButton(
        key: ValueKey('friends-direction-$value'),
        enabled: !controlsDisabled,
        label: t(value),
        onTap: () => _direction(value),
        child: Opacity(
          opacity: controlsDisabled ? .4 : 1,
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: hinted ? const Color(0xFFFFEDBB) : const Color(0xFFE7EDDD),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: hinted ? const Color(0xFFD9BB73) : const Color(0xFFDBE3CC)),
              boxShadow: hinted
                  ? const [BoxShadow(color: Color(0xFFD8BD7C), offset: Offset(0, 3)), BoxShadow(color: Color(0x44F3D68B), spreadRadius: 3)]
                  : const [BoxShadow(color: Color(0xFFC3D0B8), offset: Offset(0, 3))],
            ),
            child: AIcon(_directionIcons[value]!, size: 23, color: hinted ? const Color(0xFFAC853C) : FriendsPalette.green),
          ),
        ),
      );
    }

    Widget tool({required Key key, required AIconData icon, required String label, String? badge, required bool enabled, required VoidCallback onTap}) => Expanded(
          child: GameButton(
            key: key,
            enabled: enabled,
            onTap: onTap,
            child: Opacity(
              opacity: enabled ? 1 : .4,
              child: Container(
                constraints: BoxConstraints(minHeight: short ? 40 : 44),
                decoration: BoxDecoration(color: const Color(0xFFFAFBF3), borderRadius: BorderRadius.circular(13), border: Border.all(color: FriendsPalette.line)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(icon, size: 17, color: FriendsPalette.green),
                  const SizedBox(width: 6),
                  Flexible(child: Text(label, style: tfText(short ? 9 : 10, weight: FontWeight.w800, color: FriendsPalette.green))),
                  if (badge != null) ...[
                    const SizedBox(width: 4),
                    Opacity(opacity: .7, child: Text(badge, style: tfText(9, weight: FontWeight.w800, color: FriendsPalette.green))),
                  ],
                ]),
              ),
            ),
          ),
        );

    final dpad = short
        ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            direction('left'),
            const SizedBox(width: 9),
            direction('up'),
            const SizedBox(width: 9),
            direction('down'),
            const SizedBox(width: 9),
            direction('right'),
          ])
        : SizedBox(
            width: 140,
            height: 140,
            child: Stack(children: [
              Positioned(left: 48, top: 0, child: direction('up')),
              Positioned(left: 96, top: 48, child: direction('right')),
              Positioned(left: 48, top: 96, child: direction('down')),
              Positioned(left: 0, top: 48, child: direction('left')),
              const Positioned(left: 48, top: 48, width: 44, height: 44, child: Center(child: AIcon(AIcons.heartHandshake, size: 16, color: Color(0xFFB2BFA7)))),
            ]),
          );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        constraints: const BoxConstraints(minHeight: 51),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(color: FriendsPalette.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFFFFFFF))),
        child: Row(children: [
          const AIcon(AIcons.heartHandshake, size: 16, color: FriendsPalette.green),
          const SizedBox(width: 7),
          Expanded(child: Text(t(definition.control), style: tfText(11, weight: FontWeight.w800, color: FriendsPalette.green))),
          const SizedBox(width: 10),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Text(t.number(round.moves), key: const ValueKey('friends-moves'), style: tfText(18, weight: FontWeight.w400, height: 1.1)),
            const SizedBox(height: 3),
            Text(t('moves'), style: tfText(8, weight: FontWeight.w700, color: FriendsPalette.muted, height: 1.1)),
          ]),
        ]),
      ),
      Expanded(child: FriendsBoard(level: definition, state: state, t: t, disabled: controlsDisabled, onDirection: _direction)),
      Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.fromLTRB(12, 5, 12, 10),
        decoration: BoxDecoration(color: FriendsPalette.surface, borderRadius: BorderRadius.circular(25), border: Border.all(color: const Color(0xFFFFFFFF))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            constraints: const BoxConstraints(minHeight: 25),
            padding: const EdgeInsets.all(3),
            alignment: Alignment.center,
            child: Semantics(
              liveRegion: true,
              child: _hintBusy
                  ? Text(t('hintBusy'), key: const ValueKey('tf-notice'), textAlign: TextAlign.center, style: tfText(10, color: FriendsPalette.muted, height: 1.4))
                  : _hint != null
                      ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const AIcon(AIcons.lightbulb, size: 15, color: Color(0xFFB38C41)),
                          const SizedBox(width: 5),
                          Text(t(_hint!), key: const ValueKey('tf-notice'), style: tfText(10, weight: FontWeight.w800, color: const Color(0xFFB38C41), height: 1.4)),
                        ])
                      : Text(t(_notice ?? 'instruction'), key: const ValueKey('tf-notice'), textAlign: TextAlign.center, style: tfText(10, color: FriendsPalette.muted, height: 1.4)),
            ),
          ),
          Directionality(
            textDirection: TextDirection.ltr,
            child: short
                ? dpad
                : Row(children: [
                    note(0, t('same')),
                    const SizedBox(width: 5),
                    Semantics(label: t('instruction'), container: true, child: dpad),
                    const SizedBox(width: 5),
                    note(1, t(definition.control)),
                  ]),
          ),
          Padding(
            padding: EdgeInsets.only(top: short ? 4 : 10),
            child: Row(children: [
              tool(
                key: const ValueKey('tf-undo'),
                icon: AIcons.undo2,
                label: t('undo'),
                enabled: round.path.isNotEmpty && !won && !_ads.waiting && _modal == null,
                onTap: () => _undo(won),
              ),
              const SizedBox(width: 7),
              tool(
                key: const ValueKey('tf-hint'),
                icon: AIcons.lightbulb,
                label: t('hint'),
                badge: t.number(friendsHintLimit - round.hints),
                enabled: !controlsDisabled,
                onTap: () => unawaited(_requestHint()),
              ),
              const SizedBox(width: 7),
              tool(
                key: const ValueKey('tf-pause'),
                icon: AIcons.pause,
                label: t('pause'),
                enabled: _phase == 'playing' && !_ads.waiting,
                onTap: () {
                  _cancelHint();
                  setState(() => _modal = 'pause');
                },
              ),
            ]),
          ),
          if (!_storageReady)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(t('storage'), textAlign: TextAlign.center, style: tfText(9, color: const Color(0xFFAD6D50))),
            ),
        ]),
      ),
    ]);
  }

  List<Widget> _dialogBody(FriendsText t, FriendsLevel? definition, FriendsRound? round, bool won, bool lost) {
    switch (_modal) {
      case 'help':
        return [
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final (i, key) in const ['helpMove', 'helpWalls', 'helpKeys', 'helpPlates', 'helpHome'].indexed) ...[
              if (i > 0) const SizedBox(height: 14),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 26,
                  height: 27,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFE6EDDB), borderRadius: BorderRadius.circular(10)),
                  child: Text('${i + 1}', style: tfText(11, weight: FontWeight.w800, color: FriendsPalette.green)),
                ),
                const SizedBox(width: 9),
                Expanded(child: Text(t(key), textAlign: TextAlign.start, style: tfText(11, color: FriendsPalette.muted, height: 1.7))),
              ]),
            ],
          ]),
        ];
      case 'settings':
        return [
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (i, key) in const ['sound', 'haptics'].indexed) ...[
                if (i > 0) const SizedBox(height: 10),
                GameButton(
                  key: ValueKey('tf-switch-$key'),
                  toggled: key == 'sound' ? _preferences.sound : _preferences.haptics,
                  label: t(key),
                  onTap: () => _setPreference(key),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFFEEF1E4), borderRadius: BorderRadius.circular(15)),
                    child: Row(children: [
                      AIcon(key == 'sound' ? AIcons.volume2 : AIcons.vibrate, size: 19, color: FriendsPalette.ink),
                      const SizedBox(width: 9),
                      Expanded(child: Text(t(key), textAlign: TextAlign.start, style: tfText(12))),
                      Container(
                        width: 32,
                        height: 23,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: (key == 'sound' ? _preferences.sound : _preferences.haptics) ? FriendsPalette.green : const Color(0xFFD6DFCD),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: (key == 'sound' ? _preferences.sound : _preferences.haptics) ? const AIcon(AIcons.check, size: 14, color: Color(0xFFFFFFFF)) : null,
                      ),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
        ];
      case 'pause':
        return [
          Text(t('saved')),
          FriendsActions(children: [
            FriendsButton(key: const ValueKey('tf-resume'), icon: AIcons.play, label: t('resume'), onTap: () => setState(() => _modal = null)),
            FriendsButton(kind: 'secondary', icon: AIcons.rotateCcw, label: t('restart'), onTap: () => setState(() => _modal = 'restart')),
            FriendsButton(
              kind: 'secondary',
              icon: AIcons.house,
              label: t('back'),
              onTap: () => setState(() {
                _modal = null;
                _levelNumber = null;
              }),
            ),
            FriendsButton(kind: 'text', label: t('help'), onTap: () => setState(() => _modal = 'help')),
          ]),
        ];
      case 'restart':
        return [
          FriendsActions(children: [
            FriendsButton(key: const ValueKey('tf-restart-confirm'), icon: AIcons.rotateCcw, label: t('restart'), onTap: _restart),
            FriendsButton(kind: 'secondary', label: t('resume'), onTap: () => setState(() => _modal = null)),
          ]),
        ];
    }
    if (won && definition != null && round != null) {
      final result = friendsResult(definition, round);
      return [
        Transform.translate(
          offset: const Offset(0, -5),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Image.asset(friendsArtAssets[0], width: 92, height: 92, fit: BoxFit.contain, excludeFromSemantics: true),
            const SizedBox(width: 5),
            const AIcon(AIcons.heartHandshake, size: 27, color: FriendsPalette.green),
            const SizedBox(width: 5),
            Image.asset(friendsArtAssets[1], width: 92, height: 92, fit: BoxFit.contain, excludeFromSemantics: true),
          ]),
        ),
        Text(t('wonDesc')),
        Semantics(
          label: t('stars', {'count': result.stars}),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var star = 1; star <= 3; star++) ...[
                if (star > 1) const SizedBox(width: 8),
                Transform.translate(offset: Offset(0, star == 2 ? -5 : 0), child: GameStar(size: 31, filled: star <= result.stars, color: const Color(0xFFD8AA56))),
              ],
            ]),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFFEDF1E3), borderRadius: BorderRadius.circular(18)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (final (i, (value, label)) in [(t.number(result.score), t('score')), (t.number(round.moves), t('moves'))].indexed) ...[
              if (i > 0) const SizedBox(width: 35),
              Column(children: [
                Text(value, style: tfText(23, weight: FontWeight.w900, height: 1.2)),
                const SizedBox(height: 4),
                Text(label, style: tfText(9, weight: FontWeight.w700, color: FriendsPalette.muted)),
              ]),
            ],
          ]),
        ),
        Padding(padding: const EdgeInsets.only(top: 11), child: Text(t('par', {'count': definition.par}), style: tfText(10, color: FriendsPalette.muted, height: 1.7))),
        FriendsActions(children: [
          FriendsButton(
            key: const ValueKey('tf-next'),
            icon: AIcons.play,
            label: t(_levelNumber == twoFriendsLevels ? 'allDone' : 'next'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(() {
              if (_levelNumber! < twoFriendsLevels) {
                _start(_levelNumber! + 1);
              } else {
                setState(() => _levelNumber = null);
              }
            })),
          ),
          FriendsButton(
            kind: 'secondary',
            label: t('back'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(() => setState(() => _levelNumber = null))),
          ),
        ]),
      ];
    }
    if (lost) {
      return [
        Text(t('lostDesc')),
        FriendsActions(children: [
          FriendsButton(key: const ValueKey('tf-lost-undo'), icon: AIcons.undo2, label: t('undo'), onTap: () => _undo(false)),
          FriendsButton(
            kind: 'secondary',
            icon: AIcons.rotateCcw,
            label: t('restart'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(_restart)),
          ),
        ]),
      ];
    }
    return const [];
  }
}

/// `.tf-landscape`: two soft hills, the sun and a star.
class _Landscape extends StatelessWidget {
  const _Landscape();
  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: LayoutBuilder(builder: (context, c) {
          final w = c.maxWidth, h = c.maxHeight;
          Widget hill(double left, double bottom, Color color, double angle) => Positioned(
                left: left,
                bottom: bottom,
                child: Transform.rotate(
                  angle: angle * math.pi / 180,
                  child: Opacity(
                    opacity: .45,
                    child: Container(width: w * 1.5, height: h * .35, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.all(Radius.elliptical(w * .75, h * .175)))),
                  ),
                ),
              );
          return Stack(clipBehavior: Clip.hardEdge, children: [
            hill(-w * .3, -h * .13, const Color(0xFF9BBC9A), -12),
            hill(w * .08, -h * .17, const Color(0xFF739C83), 20),
            Positioned(
              right: -25,
              top: h * .18,
              child: Opacity(
                opacity: .7,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: const BoxDecoration(color: Color(0xFFFFF4CD), shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0xFFFFF4CD), blurRadius: 100)]),
                ),
              ),
            ),
            Positioned(left: w * .07, top: h * .15, child: const Text('✦', style: TextStyle(color: Color(0xFFC8AD7B), fontSize: 22))),
          ]);
        }),
      );
}
