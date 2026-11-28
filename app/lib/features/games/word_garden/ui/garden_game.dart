// Ported from: src/components/games/word-garden/GardenGame.tsx and the game-screen rules of word-garden.css
//
// One level: generation off the UI isolate (resuming a saved round on its own library revision), the timed /
// calm clock (only while playing, flushed on pause, settings, background and exit), word / bonus / hint
// decisions, the one-time win reward, restart, the ready overlay of the timed mode, pause / win / time-up dialogs
// and the rewarded extra time.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_revive_action.dart';
import '../../ui_common/game_widgets.dart';
import '../engine/generator.dart' show gardenRandom, shuffleLetters;
import '../engine/lexicon.dart' show displayGardenWord;
import '../engine/model.dart';
import '../engine/state.dart';
import '../persistence/storage.dart' show GardenPreferences;
import 'crossword_board.dart';
import 'garden_dialog.dart';
import 'garden_level_loader.dart';
import 'garden_theme.dart';
import 'letter_wheel.dart';

String _formatTime(num seconds) {
  final whole = seconds.ceil();
  return '${whole ~/ 60}:${(whole % 60).toString().padLeft(2, '0')}';
}

const Map<WordDecision, String> _decisionNotice = {
  WordDecision.found: 'wordFound',
  WordDecision.bonus: 'bonusFound',
  WordDecision.already: 'alreadyFound',
  WordDecision.short: 'tooShort',
  WordDecision.invalid: 'notInDictionary',
};

class GardenGame extends ConsumerStatefulWidget {
  const GardenGame({
    super.key,
    required this.palette,
    required this.language,
    required this.locale,
    required this.mode,
    required this.level,
    required this.profile,
    required this.current,
    required this.transact,
    required this.preferences,
    required this.onPreferences,
    required this.t,
    required this.onExit,
    required this.onNext,
    required this.storageReady,
  });
  final GardenPalette palette;
  final String language;
  final String locale;
  final WordGardenMode mode;
  final int level;
  final GardenProfile profile;

  /// `current.current` (the synchronously updated profile).
  final GardenProfile Function() current;
  final GardenProfile Function(GardenProfile Function(GardenProfile value) update) transact;
  final GardenPreferences preferences;
  final ValueChanged<GardenPreferences> onPreferences;
  final GardenText t;
  final VoidCallback onExit;
  final ValueChanged<int> onNext;
  final bool storageReady;

  @override
  ConsumerState<GardenGame> createState() => GardenGameState();
}

class GardenGameState extends ConsumerState<GardenGame> {
  WordGardenLevel? _definition;

  /// 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'error'.
  String _phase = 'loading';

  /// 'settings' | 'help' | 'bonus' | null.
  String? _modal;
  List<String> _letters = const [];
  bool _hintReady = false;
  String? _notice;
  String? _recentWord;
  String _noticeWord = '';
  int _reward = 0;
  int _attempt = 0;
  int _load = 0;
  bool _onComplete = false;

  late final GameTonePlayer _audio;
  Timer? _noticeTimer;
  Timer? _recentTimer;
  late final GameAdsController _ads;

  // The clock effect (`useEffect([definition, blocked, activeRoundId])`).
  String? _clockKey;
  Timer? _clockTimer;
  void Function()? _clock;
  bool _disposed = false;

  String get phase => _phase;

  @override
  void initState() {
    super.initState();
    _audio = ref.read(gameTonePlayerFactoryProvider)();
    _ads = GameAdsController(gameId: wordGardenId, platform: ref.read(gameAdsPlatformProvider), phase: _adsPhase, restore: _restore)
      ..addListener(_rebuild);
    _loadLevel();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  String get _adsPhase => _modal != null ? 'paused' : _phase;

  @override
  void dispose() {
    _disposed = true;
    _stopClock();
    _audio.close();
    _noticeTimer?.cancel();
    _recentTimer?.cancel();
    _ads.removeListener(_rebuild);
    _ads.dispose();
    super.dispose();
  }

  GardenProfile get _current => widget.current();

  void _changePhase(String next) {
    if (_phase == 'playing' && next != 'playing') _clock?.call();
    _phase = next;
    if (mounted && !_disposed) setState(() {});
  }

  void _feedback(String kind) {
    final options = widget.preferences;
    _audio.play(kind, options.sound);
    if (options.haptics) {
      final haptics = ref.read(gameHapticsProvider);
      unawaited((kind == 'letter' ? haptics.light() : haptics.medium()).catchError((Object _) {}));
    }
  }

  void _restore(GameReviveBenefits benefits) {
    final definition = _definition;
    if (definition == null || _phase != 'lost' || widget.mode != WordGardenMode.timed || benefits.seconds <= 0) return;
    widget.transact((value) => reviveGardenRound(value, definition, benefits.seconds));
    _changePhase('playing');
  }

  Future<void> _loadLevel() async {
    final token = ++_load;
    if (_phase != 'loading') _changePhase('loading');
    _onComplete = false;
    final current = _current;
    final revision = gardenLevelRevision(current, widget.level);
    try {
      final generated = await ref.read(gardenLevelLoaderProvider)(widget.language, widget.level, widget.mode,
          revision: revision, seed: current.seed?.toInt());
      if (!mounted || token != _load) return;
      final value = adoptGardenLevel(generated, _current.revision);
      _definition = value;
      _letters = value.letters;
      widget.transact((profile) => resumeGardenRound(profile, generated, value));
      final round = _current.round;
      _changePhase(round?.remainingSeconds == 0
          ? 'lost'
          : widget.mode == WordGardenMode.timed && round?.started == false
              ? 'ready'
              : 'playing');
      ref.read(gameAnalyticsProvider).event('minigame_level_started', {
        'game_id': wordGardenId,
        'language': widget.language,
        'mode': widget.mode.name,
        'level': widget.level,
      });
    } catch (_) {
      if (mounted && token == _load) _changePhase('error');
    }
  }

  bool get _blocked => _phase != 'playing' || _modal != null || _ads.waiting;

  // ── clock ──

  void _syncClock() {
    final definition = _definition;
    final round = definition != null && widget.profile.round?.levelId == definition.id ? widget.profile.round : null;
    final key = definition == null || _blocked || round == null ? null : '${definition.id}:${round.levelId}:${widget.mode.name}';
    if (key == _clockKey) return;
    _stopClock();
    _clockKey = key;
    if (key == null) return;
    final def = definition!;
    final clock = ref.read(gameClockProvider);
    var previous = clock.nowMs();
    void flush() {
      final now = clock.nowMs(), seconds = (now - previous) / 1000;
      previous = now;
      if (_phase != 'playing' || seconds <= 0) return;
      widget.transact((value) => tickGardenRound(value, def, seconds));
    }

    _clock = flush;
    _clockTimer = Timer.periodic(Duration(milliseconds: widget.mode == WordGardenMode.timed ? 250 : 1000), (_) {
      if (gameDocumentHidden() || _phase != 'playing' || _modal != null) return;
      flush();
      final next = _current;
      if (next.round?.remainingSeconds == 0 && !isGardenSolved(def, next.round!)) {
        _hintReady = false;
        _changePhase('lost');
      }
    });
  }

  void _stopClock() {
    final flush = _clock;
    _clockTimer?.cancel();
    _clockTimer = null;
    _clockKey = null;
    if (flush != null) {
      flush();
      if (identical(_clock, flush)) _clock = null;
    }
  }

  void _hidden() {
    if (_phase == 'playing') {
      _hintReady = false;
      _changePhase('paused');
    }
  }

  // ── win ──

  void _checkWin() {
    final definition = _definition;
    final round = widget.profile.round;
    if (definition == null || round == null || round.levelId != definition.id || _phase != 'playing' || !isGardenSolved(definition, round)) return;
    final result = completeGardenLevel(_current, definition);
    if (result == null) return;
    widget.transact((_) => result.profile);
    _reward = result.reward;
    _hintReady = false;
    _changePhase('won');
    if (!_onComplete) {
      _onComplete = true;
      _feedback('win');
      ref.read(gameAnalyticsProvider).event('minigame_level_won', {
        'game_id': wordGardenId,
        'language': widget.language,
        'mode': widget.mode.name,
        'level': widget.level,
        'score': result.result.score,
      });
    }
  }

  void _afterBuild() {
    if (!mounted) return;
    _syncClock();
    _checkWin();
  }

  // ── actions ──

  void _back() {
    if (_phase == 'playing') {
      _hintReady = false;
      _changePhase('paused');
    } else {
      widget.onExit();
    }
  }

  void _showNotice(String key) {
    _noticeTimer?.cancel();
    setState(() => _notice = key);
    _noticeTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _notice = null);
    });
  }

  void _submit(String word) {
    final definition = _definition;
    if (definition == null || _phase != 'playing' || _modal != null || _ads.waiting || _hintReady) return;
    _clock?.call();
    if (_current.round?.remainingSeconds == 0) {
      _changePhase('lost');
      return;
    }
    final decision = submitGardenWord(_current, definition, word);
    _noticeWord = word;
    if (!identical(decision.profile, _current)) widget.transact((_) => decision.profile);
    _showNotice(_decisionNotice[decision.decision]!);
    if (decision.decision == WordDecision.found) {
      _recentTimer?.cancel();
      setState(() => _recentWord = word);
      _recentTimer = Timer(const Duration(milliseconds: 850), () {
        if (mounted) setState(() => _recentWord = null);
      });
      _feedback('found');
    } else if (decision.decision == WordDecision.bonus) {
      _showNotice(decision.reward > 0 ? 'bonusFound' : 'bonusReplayFound');
      _feedback('bonus');
    }
  }

  void _restart() {
    final definition = _definition;
    if (definition == null) return;
    widget.transact((value) => value.copyWith(round: createGardenRound(definition)));
    _letters = definition.letters;
    _reward = 0;
    _notice = null;
    _hintReady = false;
    _recentWord = null;
    _onComplete = false;
    _attempt++;
    _ads.resetRound();
    _changePhase(widget.mode == WordGardenMode.timed ? 'ready' : 'playing');
  }

  void _reveal(String key) {
    final definition = _definition;
    if (definition == null || !_hintReady || _blocked) return;
    _clock?.call();
    if (_current.round?.remainingSeconds == 0) {
      _hintReady = false;
      _changePhase('lost');
      return;
    }
    final result = revealGardenHint(_current, definition, key);
    if (result.used) {
      widget.transact((_) => result.profile);
      _hintReady = false;
      _showNotice('hintGiven');
      _feedback('found');
    }
  }

  void _activateHint(GardenRound round) {
    final definition = _definition;
    if (definition == null || _blocked) return;
    if (_hintReady) {
      setState(() => _hintReady = false);
      return;
    }
    if (round.hintsUsed > 0 && widget.profile.progress.coins < hintCost) {
      _showNotice('noHintCoins');
      return;
    }
    if (visibleGardenCells(definition, round).length == definition.cells.length) return;
    setState(() {
      _notice = null;
      _hintReady = true;
    });
  }

  void _openModal(String modal) => setState(() {
        _hintReady = false;
        _modal = modal;
      });

  @override
  Widget build(BuildContext context) {
    _ads.update(phase: _adsPhase, restore: _restore);
    WidgetsBinding.instance.addPostFrameCallback((_) => _afterBuild());
    final p = widget.palette, t = widget.t, definition = _definition;
    final round = definition != null && widget.profile.round?.levelId == definition.id ? widget.profile.round : null;
    final blocked = _blocked;
    final terminal = _modal == null && (_phase == 'paused' || _phase == 'won' || _phase == 'lost');
    final title = _modal == 'settings'
        ? t('settings')
        : _modal == 'help'
            ? t('helpTitle')
            : _modal == 'bonus'
                ? t('bonusTitle')
                : _phase == 'won'
                    ? t('won')
                    : _phase == 'lost'
                        ? t('timeUp')
                        : t('paused');
    final pad = MediaQuery.paddingOf(context);
    final size = MediaQuery.sizeOf(context);
    final wheelSize = (size.height * .25).clamp(188.0, 220.0);

    return GameBackHandler(
      onBack: () {
        _back();
        return true;
      },
      child: GameLifecycleListener(
        onHidden: _hidden,
        child: GameKeyboardListener(
          onKey: (event) {
            if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape && _modal == null) {
              _back();
              return true;
            }
            return false;
          },
          child: Stack(key: const ValueKey('wordgarden-game'), children: [
            Padding(
              padding: EdgeInsets.fromLTRB(math.max(14, pad.left), math.max(10, pad.top), math.max(14, pad.right), math.max(10, pad.bottom)),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _header(p, t),
                    if (_phase == 'loading' || _phase == 'error' || definition == null || round == null)
                      Expanded(child: _loading(p, t))
                    else ...[
                      _metrics(p, t, definition, round),
                      Expanded(
                        child: Stack(children: [
                          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Expanded(child: _boardPanel(p, t, definition, round, blocked)),
                            const SizedBox(height: 12),
                            _inputPanel(p, t, definition, blocked, wheelSize),
                          ]),
                          if (_phase == 'ready') Positioned.fill(child: _readyOverlay(p, t, definition)),
                        ]),
                      ),
                      _tools(p, t, round, blocked),
                      if (!widget.storageReady)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(t('storageError'), textAlign: TextAlign.center, style: wgText(10, color: p.accentDeep)),
                        ),
                    ],
                  ]),
                ),
              ),
            ),
            if (_modal != null || terminal)
              GardenDialog(
                key: ValueKey('wg-dialog:${_modal ?? _phase}'),
                palette: p,
                title: title,
                closeLabel: t('close'),
                onClose: () {
                  if (_modal != null) {
                    setState(() => _modal = null);
                  } else if (_phase == 'paused') {
                    _changePhase('playing');
                  } else {
                    unawaited(_ads.transition(widget.onExit));
                  }
                },
                children: _dialogBody(p, t, definition, round),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _header(GardenPalette p, GardenText t) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            GardenIconButton(key: const ValueKey('wg-game-back'), palette: p, icon: AIcons.arrowLeft, label: t('back'), onTap: _back),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(t('title'), style: wgText(10, weight: FontWeight.w700, color: p.muted)),
                Semantics(
                  header: true,
                  child: Text(t('level', {'level': widget.level}), style: wgText(18, weight: FontWeight.w900, color: p.ink, height: 1.3, ls: -.3)),
                ),
              ]),
            ),
            const SizedBox(width: 10),
            GameButton(
              key: const ValueKey('wg-wallet'),
              label: t('coins'),
              onTap: () => _openModal('bonus'),
              child: Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                decoration: BoxDecoration(color: p.panel, borderRadius: BorderRadius.circular(13), border: Border.all(color: p.border)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.flower2, size: 17, color: p.accent),
                  const SizedBox(width: 6),
                  Text(t.number(widget.profile.progress.coins), key: const ValueKey('wg-coins'), style: wgText(12, weight: FontWeight.w800, color: p.ink)),
                ]),
              ),
            ),
            const SizedBox(width: 10),
            GardenIconButton(key: const ValueKey('wg-game-settings'), palette: p, icon: AIcons.settings2, label: t('settings'), onTap: () => _openModal('settings')),
          ]),
        ),
      );

  Widget _loading(GardenPalette p, GardenText t) => Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            _phase == 'loading' && !animationsDisabled(context)
                ? _Spin(child: AIcon(AIcons.flower2, size: 48, color: p.accent))
                : AIcon(AIcons.flower2, size: 48, color: p.accent),
            const SizedBox(height: 15),
            Text(t(_phase == 'error' ? 'loadError' : 'loading'), textAlign: TextAlign.center, style: wgText(22, weight: FontWeight.w900, color: p.ink)),
            const SizedBox(height: 15),
            if (_phase == 'error') ...[
              SizedBox(width: 240, child: GardenButton(palette: p, label: t('retry'), onTap: _loadLevel)),
              const SizedBox(height: 15),
            ],
            SizedBox(
              width: 240,
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: GardenButton(palette: p, kind: GardenButtonKind.secondary, label: t('back'), onTap: widget.onExit),
              ),
            ),
          ]),
        ),
      );

  Widget _metrics(GardenPalette p, GardenText t, WordGardenLevel definition, GardenRound round) {
    final timed = widget.mode == WordGardenMode.timed;
    final remaining = round.remainingSeconds ?? 0;
    final urgent = timed && remaining <= math.min(10, (definition.timeLimit ?? 0) * .25);
    final clockColor = urgent ? p.accentDeep : p.leaf;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: p.panel,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: p.border),
        boxShadow: const [BoxShadow(color: Color(0x06354B3C), offset: Offset(0, 4), blurRadius: 18)],
      ),
      child: Stack(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
          child: Column(children: [
            Row(children: [
              AIcon(AIcons.bookOpen, size: 17, color: p.leaf),
              const SizedBox(width: 9),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t('wordsProgress', {'found': round.found.length, 'total': definition.words.length}),
                      style: wgText(13, weight: FontWeight.w900, color: p.ink, height: 1.3)),
                  const SizedBox(height: 3),
                  Text(t('difficulty${definition.difficulty}'), style: wgText(10, color: p.muted, height: 1.2)),
                ]),
              ),
              const SizedBox(width: 14),
              Row(key: const ValueKey('wordgarden-timer'), children: [
                AIcon(timed ? AIcons.clock3 : AIcons.leaf, size: 18, color: clockColor),
                const SizedBox(width: 8),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(timed ? _formatTime(remaining) : t('calm'),
                      style: wgText(22, weight: urgent ? FontWeight.w900 : FontWeight.w900, color: clockColor, height: 1.1, ls: -.5)),
                  const SizedBox(height: 1),
                  Text(t(timed ? 'timeLeft' : 'noRush'), style: wgText(9, color: p.muted, height: 1.2)),
                ]),
              ]),
            ]),
            const SizedBox(height: 8),
            Semantics(
              label: t('foundWords'),
              value: '${round.found.length}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  height: 5,
                  child: Stack(children: [
                    const Positioned.fill(child: ColoredBox(color: Color(0x1A698676))),
                    FractionallySizedBox(
                      widthFactor: definition.words.isEmpty ? 0 : round.found.length / definition.words.length,
                      child: ColoredBox(color: p.leaf),
                    ),
                  ]),
                ),
              ),
            ),
          ]),
        ),
        if (timed)
          Positioned(
            left: 14,
            right: 14,
            bottom: 0,
            height: 3,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (math.min(100, remaining / (definition.timeLimit ?? 1) * 100) / 100).clamp(0, 1).toDouble(),
                  child: ColoredBox(color: urgent ? p.accentDeep : p.accent),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _boardPanel(GardenPalette p, GardenText t, WordGardenLevel definition, GardenRound round, bool blocked) => Semantics(
        label: t('boardLabel'),
        container: true,
        child: Container(
          constraints: const BoxConstraints(minHeight: 130),
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 10),
          decoration: BoxDecoration(
            color: p.highContrast ? p.panel : p.panel,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: p.border),
            boxShadow: [BoxShadow(color: p.night ? const Color(0x26071725) : const Color(0x093B514C), offset: const Offset(0, 7), blurRadius: 22)],
          ),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 0, 6, 4),
              child: Row(children: [
                AIcon(AIcons.sparkles, size: 14, color: p.leaf),
                const SizedBox(width: 6),
                Expanded(child: Text(t('boardTitle'), style: wgText(11, weight: FontWeight.w800, color: p.leaf))),
                Text(t('languageShort'), style: wgText(8, weight: FontWeight.w800, color: p.muted, ls: 1.2)),
              ]),
            ),
            Expanded(
              child: Visibility(
                visible: true,
                child: CrosswordBoard(
                  palette: p,
                  level: definition,
                  round: round,
                  locale: widget.locale,
                  t: t,
                  disabled: blocked,
                  hintReady: _hintReady && !blocked,
                  onHint: _reveal,
                  recentWord: _recentWord,
                ),
              ),
            ),
          ]),
        ),
      );

  Widget _inputPanel(GardenPalette p, GardenText t, WordGardenLevel definition, bool blocked, double wheelSize) {
    final positive = _notice == 'wordFound' || _notice == 'bonusFound';
    final noticeColor = _hintReady ? p.accentDeep : positive ? p.leaf : p.muted;
    return Semantics(
      label: t('wheelLabel'),
      container: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 0, 10, 9),
        decoration: BoxDecoration(
          gradient: p.highContrast ? null : LinearGradient(begin: const Alignment(-0.5, -0.87), end: const Alignment(0.5, 0.87), colors: [p.panel, p.soft]),
          color: p.highContrast ? p.panel : null,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: p.border),
          boxShadow: [BoxShadow(color: p.night ? const Color(0x26071725) : const Color(0x12365744), offset: const Offset(0, 9), blurRadius: 26)],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            height: 26,
            margin: const EdgeInsets.fromLTRB(0, 3, 0, 4),
            alignment: Alignment.center,
            child: Semantics(
              liveRegion: true,
              child: _hintReady
                  ? Text(t('hintReady'), key: const ValueKey('wg-notice'), style: wgText(10, weight: FontWeight.w800, color: noticeColor))
                  : _notice != null
                      ? Text(t(_notice!, {'count': hintCost, 'word': displayGardenWord(_noticeWord, widget.locale)}),
                          key: const ValueKey('wg-notice'),
                          textAlign: TextAlign.center,
                          style: wgText(10, weight: p.highContrast ? FontWeight.w800 : FontWeight.w700, color: noticeColor, height: 1.35))
                      : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          AIcon(AIcons.leaf, size: 12, color: noticeColor),
                          const SizedBox(width: 5),
                          Text(t('drawShort'), key: const ValueKey('wg-notice'), style: wgText(10, weight: FontWeight.w700, color: noticeColor)),
                        ]),
            ),
          ),
          Visibility(
            visible: true,
            child: LetterWheel(
              palette: p,
              letters: _letters,
              locale: widget.locale,
              t: t,
              disabled: blocked || _hintReady,
              resetKey: '${definition.id}:$_attempt',
              wheelSize: wheelSize,
              onPick: () => _feedback('letter'),
              onSubmit: _submit,
              onShuffle: () => setState(() => _letters = shuffleLetters(_letters, gardenRandom(DateTime.now().millisecondsSinceEpoch))),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _readyOverlay(GardenPalette p, GardenText t, WordGardenLevel definition) => ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: ColoredBox(
          color: p.night ? const Color(0xA6162638) : const Color(0xA6F8EFE5),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 280),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: p.panel,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: p.border),
                  boxShadow: const [BoxShadow(color: Color(0x20365A43), offset: Offset(0, 18), blurRadius: 50)],
                ),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Center(child: AIcon(AIcons.clock3, size: 28, color: p.leaf)),
                  const SizedBox(height: 12),
                  Text(t('readyTitle'), textAlign: TextAlign.center, style: wgText(25, weight: FontWeight.w900, color: p.ink, height: 1.2)),
                  const SizedBox(height: 8),
                  Text(t('readyDescription', {'count': definition.timeLimit ?? 0}),
                      textAlign: TextAlign.center, style: wgText(12, color: p.muted, height: 1.6)),
                  const SizedBox(height: 18),
                  GardenButton(
                    key: const ValueKey('wg-start-timed'),
                    palette: p,
                    icon: AIcons.play,
                    label: t('startTimed'),
                    onTap: () {
                      widget.transact((value) => value.round == null ? value : value.copyWith(round: value.round!.copyWith({'started': true})));
                      _changePhase('playing');
                    },
                  ),
                ]),
              ),
            ),
          ),
        ),
      );

  Widget _tools(GardenPalette p, GardenText t, GardenRound round, bool blocked) {
    Widget tool({required Key key, required AIconData icon, required String label, required String small, required VoidCallback onTap, bool active = false}) =>
        Expanded(
          child: GameButton(
            key: key,
            enabled: !blocked,
            onTap: onTap,
            child: Opacity(
              opacity: blocked ? .45 : 1,
              child: Container(
                constraints: const BoxConstraints(minHeight: 52),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                decoration: BoxDecoration(
                  color: active ? p.soft : p.panel,
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(color: active ? p.accent : p.border),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(icon, size: 20, color: active ? p.accentDeep : p.leaf),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(label, style: wgText(10, weight: FontWeight.w800, color: p.ink, height: 1.25)),
                      const SizedBox(height: 2),
                      Text(small, style: wgText(8, weight: FontWeight.w600, color: p.muted, height: 1.3)),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(top: 11),
      child: Row(children: [
        tool(
          key: const ValueKey('wg-hint'),
          icon: AIcons.lightbulb,
          label: t(_hintReady ? 'cancelHint' : 'hint'),
          small: round.hintsUsed == 0 ? t('freeHint') : t('hintPrice', {'count': hintCost}),
          onTap: () => _activateHint(round),
          active: _hintReady,
        ),
        const SizedBox(width: 8),
        tool(
          key: const ValueKey('wg-bonus'),
          icon: AIcons.gift,
          label: t('bonusShort'),
          small: t('bonusCount', {'count': round.bonus.length}),
          onTap: () => _openModal('bonus'),
        ),
        const SizedBox(width: 8),
        tool(
          key: const ValueKey('wg-pause'),
          icon: AIcons.pause,
          label: t('pauseAction'),
          small: t('savedShort'),
          onTap: () {
            _hintReady = false;
            _changePhase('paused');
          },
        ),
      ]),
    );
  }

  List<Widget> _dialogBody(GardenPalette p, GardenText t, WordGardenLevel? definition, GardenRound? round) {
    if (_modal == 'settings') return [GardenSettings(palette: p, preferences: widget.preferences, onChange: widget.onPreferences, t: t)];
    if (_modal == 'help') return [GardenHelp(palette: p, t: t)];
    if (_modal == 'bonus') {
      final bonus = round?.bonus ?? const <String>[];
      return [
        Text(t('bonusDescription')),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 22),
          child: bonus.isNotEmpty
              ? Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [
                  for (final word in bonus)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                      decoration: BoxDecoration(color: p.soft, borderRadius: BorderRadius.circular(10)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(displayGardenWord(word, widget.locale), style: wgText(13, weight: FontWeight.w900, color: p.leaf, ls: 1)),
                        const SizedBox(width: 8),
                        AIcon(AIcons.check, size: 12, color: p.leaf),
                      ]),
                    ),
                ])
              : Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(children: [
                    AIcon(AIcons.flower2, size: 36, color: p.leaf),
                    const SizedBox(height: 12),
                    Text(t('bonusEmpty'), style: wgText(12, color: p.muted)),
                  ]),
                ),
        ),
        if (definition != null) GardenMuted(t('bonusAvailable', {'count': definition.bonusWords.length}), palette: p),
      ];
    }
    if (_phase == 'paused') {
      return [
        GardenEmblem(palette: p, icon: AIcons.pause),
        Text(t('pausedDescription')),
        GardenActions(children: [
          GardenButton(key: const ValueKey('wg-resume'), palette: p, icon: AIcons.play, label: t('resume'), onTap: () => _changePhase('playing')),
          GardenButton(palette: p, kind: GardenButtonKind.secondary, icon: AIcons.house, label: t('exitLevel'), onTap: widget.onExit),
          GardenButton(palette: p, kind: GardenButtonKind.text, icon: AIcons.circleHelp, label: t('help'), onTap: () => setState(() => _modal = 'help')),
        ]),
      ];
    }
    if (_phase == 'won' && definition != null && round != null) {
      final result = gardenResult(definition, round);
      return [
        Center(
          child: Container(
            width: 100,
            height: 100,
            margin: const EdgeInsets.fromLTRB(0, 9, 0, 5),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [Color(0xFFFFDDCC), Color(0x66F8B6A9), Color(0x00F8B6A9)], stops: [0, 0.5, 0.73]),
            ),
            alignment: Alignment.center,
            child: AIcon(AIcons.flower2, size: 50, color: p.accent),
          ),
        ),
        Text(t('wonDescription')),
        Semantics(
          label: t('stars', {'count': result.stars}),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var star = 1; star <= 3; star++) ...[
                if (star > 1) const SizedBox(width: 8),
                Transform.translate(
                  offset: Offset(0, star == 2 ? -7 : 0),
                  child: Transform.scale(
                    scale: star == 2 ? 1.1 : 1,
                    child: GameStar(size: 38, filled: star <= result.stars, color: star <= result.stars ? const Color(0xFFDFAA4E) : const Color(0xFFD1B18B)),
                  ),
                ),
              ],
            ]),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 15),
          decoration: BoxDecoration(color: p.soft, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            for (final (value, label) in [
              (t.number(result.score), t('score')),
              ('+${t.number(_reward)}', t('coins')),
              (t.number(result.bonusWords), t('bonusWords')),
            ])
              Expanded(
                child: Column(children: [
                  Text(value, style: wgText(20, weight: FontWeight.w900, color: p.ink, height: 1.2)),
                  const SizedBox(height: 4),
                  Text(label, style: wgText(9, color: p.muted)),
                ]),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Wrap(alignment: WrapAlignment.center, spacing: 5, runSpacing: 5, children: [
            for (final word in definition.words)
              Semantics(
                tooltip: word.definition,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0x35728569))),
                  child: Text(displayGardenWord(word.word, widget.locale), style: wgText(10, weight: FontWeight.w800, color: p.leaf, ls: 1)),
                ),
              ),
          ]),
        ),
        GardenMuted(round.hintsUsed > 0 ? t('hintsUsed', {'count': round.hintsUsed}) : t('noHints'), palette: p),
        GardenActions(children: [
          GardenButton(
            key: const ValueKey('wg-next-level'),
            palette: p,
            icon: AIcons.play,
            label: t('nextLevel'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(() => widget.onNext(widget.level + 1))),
          ),
          GardenButton(
            palette: p,
            kind: GardenButtonKind.secondary,
            icon: AIcons.house,
            label: t('exitLevel'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(widget.onExit)),
          ),
        ]),
      ];
    }
    if (_phase == 'lost') {
      return [
        GardenEmblem(palette: p, icon: AIcons.rotateCcw),
        Text(t('timeUpDescription')),
        GardenActions(children: [
          GardenButton(
            key: const ValueKey('wg-replay'),
            palette: p,
            icon: AIcons.rotateCcw,
            label: t('replay'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(_restart)),
          ),
          GameReviveAction(
            ads: _ads,
            game: 'basket',
            canOffer: _ads.canOffer && _ads.benefits.seconds > 0,
            labels: ReviveLabels(
              action: t(_ads.premium ? 'revivePremium' : 'reviveVideo', {'count': _ads.benefits.seconds}),
              note: t('reviveNote'),
              failed: t('reviveFailed'),
              unavailable: t('reviveUnavailable'),
            ),
          ),
          GardenButton(
            palette: p,
            kind: GardenButtonKind.secondary,
            icon: AIcons.house,
            label: t('exitLevel'),
            enabled: !_ads.waiting,
            onTap: () => unawaited(_ads.transition(widget.onExit)),
          ),
        ]),
      ];
    }
    return const [];
  }
}

/// `@keyframes wg-flower-rotate` (9 s per turn).
class _Spin extends StatefulWidget {
  const _Spin({required this.child});
  final Widget child;
  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 9))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}
