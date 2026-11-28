// Ported from: src/components/games/saglam-sebet/SaglamSebetGame.tsx
//
// The falling-food basket game: intro → 3·2·1 countdown → playing (Ticker-driven [SebetSimulation], 1 s clock)
// → won / lost, with pause, retry, next level and the rewarded revive (lives + seconds).
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../casual/ui/game_platform.dart';
import '../../common/engine/js.dart';
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_registry.dart' show GameLevelResult;
import '../../ui_common/game_revive_action.dart';
import '../../ui_common/game_widgets.dart' show GameFilledIcon;
import '../engine/engine.dart';
import 'arcade_widgets.dart';

class _FloatingText {
  _FloatingText(this.id, this.x, this.y, this.text, this.bad);
  final int id;
  final double x;
  final double y;
  final String text;
  final bool bad;
}

int _floatingIds = 0;

class SaglamSebetGame extends ConsumerStatefulWidget {
  const SaglamSebetGame({
    super.key,
    required this.level,
    required this.onExit,
    required this.onLevelComplete,
    this.onRetry,
    this.onNextLevel,
    this.levelConfig = getSebetLevelConfig,
    this.random,
  });
  final int level;
  final VoidCallback onExit;
  final ValueChanged<GameLevelResult> onLevelComplete;
  final VoidCallback? onRetry;
  final VoidCallback? onNextLevel;

  /// `getLevelConfig` (tests shorten rounds like the vitest module mock).
  final SebetLevelConfig Function(int level) levelConfig;

  /// `Math.random` (tests inject a seeded stream).
  final JsRandom? random;

  @override
  ConsumerState<SaglamSebetGame> createState() => SaglamSebetGameState();
}

class SaglamSebetGameState extends ConsumerState<SaglamSebetGame> with SingleTickerProviderStateMixin {
  late final SebetLevelConfig config = widget.levelConfig(widget.level);
  late final SebetSimulation _sim = SebetSimulation(config, random: widget.random);
  late final GameAdsController _ads;
  late final Ticker _ticker;

  String _phase = 'intro';
  int _countdown = 3;
  late int _timeLeft = config.duration;
  final List<_FloatingText> _floating = [];
  double _basketX = 50;
  bool _measured = false;
  bool _shake = false;
  bool _catchPulse = false;
  int _finalStars = 0;
  bool _completed = false;
  Duration? _lastFrame;
  Timer? _countdownTimer;
  Timer? _clock;
  final List<Timer> _pending = [];

  /// `data-game-phase`, `data-game-lives`, `data-game-score`.
  String get phase => _phase;
  int get lives => _sim.lives;
  int get score => _sim.score;
  int get timeLeft => _timeLeft;
  List<FallingObject> get objects => _sim.objects;
  double get basketX => _basketX;

  @override
  void initState() {
    super.initState();
    _ads = GameAdsController(gameId: saglamSebetId, platform: ref.read(gameAdsPlatformProvider), phase: _phase, restore: _restoreRound);
    _ads.addListener(_onAds);
    _ticker = createTicker(_tick);
  }

  void _onAds() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    _countdownTimer?.cancel();
    _clock?.cancel();
    for (final timer in _pending) {
      timer.cancel();
    }
    _ads.removeListener(_onAds);
    _ads.dispose();
    super.dispose();
  }

  void _after(Duration delay, VoidCallback action) {
    late final Timer timer;
    timer = Timer(delay, () {
      _pending.remove(timer);
      if (mounted) action();
    });
    _pending.add(timer);
  }

  void _setPhase(String value) {
    final previous = _phase;
    _phase = value;
    _ads.update(phase: value, restore: _restoreRound);
    if (value == 'playing' && previous != 'playing') {
      _lastFrame = null;
      if (!_ticker.isActive) _ticker.start();
      _startClock();
    } else if (value != 'playing') {
      if (_ticker.isActive) _ticker.stop();
      _clock?.cancel();
      _clock = null;
    }
    if (value == 'lost' && !_completed) {
      _completed = true;
      widget.onLevelComplete(GameLevelResult(level: widget.level, score: _sim.score, stars: 0, passed: false));
    }
    if (value == 'countdown') _scheduleCountdown();
  }

  void _restoreRound(GameReviveBenefits benefits) {
    setState(() {
      _sim.lives = math.min(config.lives, benefits.lives);
      _timeLeft = math.max(_timeLeft, benefits.seconds);
      _sim.objects = [];
      _floating.clear();
      _completed = false;
      _sim.spawnAccumulator = 0;
      _setPhase('playing');
    });
  }

  void _startClock() {
    _clock?.cancel();
    _clock = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _phase != 'playing') return;
      _timeLeft = _timeLeft <= 1 ? 0 : _timeLeft - 1;
      if (_timeLeft == 0) timer.cancel();
      _evaluate();
      setState(() {});
    });
  }

  void _scheduleCountdown() {
    _countdownTimer?.cancel();
    if (_countdown < 0) {
      _setPhase('playing');
      return;
    }
    _countdownTimer = Timer(Duration(milliseconds: _countdown == 0 ? 500 : 700), () {
      if (!mounted || _phase != 'countdown') return;
      setState(() {
        _countdown--;
        _scheduleCountdown();
      });
    });
  }

  void _tick(Duration elapsed) {
    if (_phase != 'playing') return;
    final frameMs = _lastFrame == null ? null : (elapsed - _lastFrame!).inMicroseconds / 1000;
    _lastFrame = elapsed;
    final caught = _sim.step(frameMs, _basketX);
    final y = _sim.height - basketHeight - basketBottomMargin - 20;
    final haptics = ref.read(gameHapticsProvider);
    for (final obj in caught.good) {
      _addFloating(obj.x, y, '+${obj.def.points}', false);
      _catchPulse = true;
      _after(const Duration(milliseconds: 180), () => setState(() => _catchPulse = false));
      unawaited(haptics.light());
    }
    for (final obj in caught.bad) {
      _addFloating(obj.x, y, tr('saglamsebet_life_lost_text', '-1 ❤️'), true);
      _shake = true;
      _after(const Duration(milliseconds: 320), () => setState(() => _shake = false));
      unawaited(ref.read(gameHeavyHapticProvider)());
    }
    _evaluate();
    setState(() {});
  }

  void _addFloating(double x, double y, String text, bool bad) {
    final id = ++_floatingIds;
    _floating.add(_FloatingText(id, x, y, text, bad));
    _after(const Duration(milliseconds: 750), () => setState(() => _floating.removeWhere((f) => f.id == id)));
  }

  /// The win/lose watcher effect: lives out ends at once; at time-up the score is evaluated.
  void _evaluate() {
    if (_phase != 'playing') return;
    final result = _sim.evaluate(_timeLeft);
    if (result == null) return;
    if (result.phase == 'won') {
      _finalStars = result.stars;
      _setPhase('won');
      if (!_completed) {
        _completed = true;
        widget.onLevelComplete(GameLevelResult(level: widget.level, score: _sim.score, stars: result.stars, passed: true));
      }
      unawaited(ref.read(gameHapticsProvider).medium());
    } else {
      _setPhase('lost');
    }
  }

  void _startCountdown() => setState(() {
        _countdown = 3;
        _setPhase('countdown');
      });

  void _resetGame() {
    _sim.score = 0;
    _sim.lives = config.lives;
    _sim.objects = [];
    _completed = false;
    _timeLeft = config.duration;
    _floating.clear();
    _finalStars = 0;
    _sim.spawnAccumulator = 0;
  }

  void _retry() {
    unawaited(_ads.transition(() {
      if (!mounted) return;
      _resetGame();
      _ads.resetRound();
      _startCountdown();
      widget.onRetry?.call();
    }));
  }

  void _exit() => unawaited(_ads.transition(widget.onExit));

  void _moveBasket(double localX, double width) {
    if (_phase != 'playing') return;
    setState(() => _basketX = localX.clamp(basketWidth / 2, math.max(basketWidth / 2, width - basketWidth / 2)).toDouble());
  }

  @override
  Widget build(BuildContext context) {
    _ads.update(phase: _phase, restore: _restoreRound);
    final tokens = AnacanTokens.of(context);
    final s = tokens.shadcn;
    final targetProgress = math.min(100, jsRound(_sim.score / config.targetScore * 100));
    final targetReached = _sim.score >= config.targetScore;
    final twoStarScore = (config.targetScore * 1.25).ceil();
    final threeStarScore = (config.targetScore * 1.6).ceil();
    final levelLabel = '${tr('saglamsebet_level_label', 'Səviyyə')} ${widget.level}';

    final hud = ArcadeHud(children: [
      Row(children: [
        ArcadeHudButton(
          playing: _phase == 'playing',
          label: _phase == 'playing' ? tr('saglamsebet_paused_title', 'Fasilə') : tr('saglamsebet_menu_button', 'Menyu'),
          onTap: () => _phase == 'playing' ? setState(() => _setPhase('paused')) : _exit(),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(levelLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.foreground))),
              AIcon(AIcons.clock, size: 12, color: s.mutedForeground),
              const SizedBox(width: 4),
              Text('${_timeLeft}s', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.mutedForeground)),
            ]),
            const SizedBox(height: 4),
            ArcadeProgressBar(
              percent: targetProgress,
              fill: targetReached ? const LinearGradient(colors: [TwColors.emerald500, TwColors.emerald500]) : s.gradientPrimary,
            ),
          ]),
        ),
        const SizedBox(width: 8),
        Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < config.lives; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            i < _sim.lives
                ? const GameFilledIcon(AIcons.heart, size: 16, color: TwColors.rose500)
                : AIcon(AIcons.heart, size: 16, color: s.mutedForeground.withValues(alpha: 0.3)),
          ],
        ]),
      ]),
      const SizedBox(height: 6),
      Row(children: [
        Expanded(
          child: targetReached
              ? Text.rich(
                  TextSpan(children: [
                    const WidgetSpan(alignment: PlaceholderAlignment.middle, child: AIcon(AIcons.check, size: 12, color: TwColors.emerald600)),
                    const WidgetSpan(child: SizedBox(width: 2)),
                    TextSpan(text: '${tr('saglamsebet_target_reached', 'Hədəf keçildi!')} '),
                    if (_sim.score < threeStarScore)
                      TextSpan(
                        text: '· ${_sim.score < twoStarScore ? '⭐⭐ $twoStarScore' : '⭐⭐⭐ $threeStarScore'}',
                        style: TextStyle(color: s.mutedForeground, fontWeight: FontWeight.w500),
                      ),
                  ]),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: TwColors.emerald600),
                )
              : Text('${tr('saglamsebet_target_prefix', 'Hədəf')}: ${config.targetScore}',
                  style: TextStyle(fontSize: 10, color: s.mutedForeground)),
        ),
        Text('${_sim.score}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: s.primary)),
      ]),
    ]);

    final playArea = LayoutBuilder(builder: (context, constraints) {
      final width = constraints.maxWidth, height = constraints.maxHeight;
      _sim.width = width;
      _sim.height = height;
      if (!_measured) {
        _measured = true;
        _basketX = width / 2;
      } else {
        _basketX = math.min(_basketX, width - basketWidth / 2);
      }
      // React placed items with `inset-inline-start: 0` + a physical translateX, which pushes them off-screen in
      // RTL (Arabic); the pointer maths is physical (`clientX - rect.left`), so everything is placed from the left.
      return _Wiggle(
        active: _shake,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onPanDown: (d) => _moveBasket(d.localPosition.dx, width),
          onPanUpdate: (d) => _moveBasket(d.localPosition.dx, width),
          child: Stack(clipBehavior: Clip.hardEdge, children: [
            const PositionedDirectional(top: 24, start: 24, child: _Cloud(size: 30, opacity: 0.3, delayed: false)),
            const PositionedDirectional(top: 64, end: 40, child: _Cloud(size: 24, opacity: 0.2, delayed: true)),
            for (final obj in _sim.objects)
              Positioned(
                left: obj.x - obj.size / 2,
                top: obj.y,
                width: obj.size,
                height: obj.size,
                child: IgnorePointer(
                  child: Text(obj.def.emoji,
                      style: TextStyle(fontSize: obj.size * 0.8, height: 1, shadows: const [Shadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 3)])),
                ),
              ),
            for (final ft in _floating)
              Positioned(
                key: ValueKey('ft-${ft.id}'),
                left: ft.x - 16,
                top: ft.y,
                child: IgnorePointer(child: _FloatingLabel(text: ft.text, color: ft.bad ? s.destructive : s.primary)),
              ),
            Positioned(
              left: _basketX - basketWidth / 2,
              bottom: basketBottomMargin,
              width: basketWidth,
              height: basketHeight,
              child: IgnorePointer(
                child: AnimatedScale(
                  scale: _catchPulse ? 1.12 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: const _Basket(),
                ),
              ),
            ),
            if (_phase == 'intro') _intro(twoStarScore, threeStarScore, levelLabel),
            if (_phase == 'countdown')
              ArcadeOverlay(opacity: 0.4, blur: 2, children: [
                _CountdownNumber(
                  key: ValueKey(_countdown),
                  text: _countdown > 0 ? '$_countdown' : tr('saglamsebet_go_text', 'Başla!'),
                  color: s.primary,
                ),
              ]),
            if (_phase == 'paused')
              ArcadeOverlay(horizontalPadding: 0, children: [
                ArcadeTitle(tr('saglamsebet_paused_title', 'Fasilə'), large: false),
                ArcadeButton(
                  width: 192,
                  icon: AIcons.play,
                  label: tr('saglamsebet_resume_button', 'Davam et'),
                  onTap: () => setState(() => _setPhase('playing')),
                ),
                ArcadeButton(width: 192, style: ArcadeButtonStyle.muted, icon: AIcons.rotateCcw, label: tr('saglamsebet_restart_button', 'Yenidən başla'), onTap: _retry),
                ArcadeButton(width: 192, style: ArcadeButtonStyle.muted, icon: AIcons.house, label: tr('saglamsebet_menu_button', 'Menyu'), onTap: _exit),
              ]),
            if (_phase == 'won')
              ArcadeOverlay(opacity: 0.95, gap: 8, children: [
                const ArcadeTrophy(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [TwColors.amber300, TwColors.amber500])),
                ArcadeTitle(tr('saglamsebet_level_complete_title', 'Səviyyə tamamlandı!')),
                ArcadeStars(stars: _finalStars),
                ArcadeScoreLine(prefix: tr('saglamsebet_your_score_prefix', 'Xalınız'), score: _sim.score),
                ArcadeActions(children: [
                  if (widget.level < saglamTotalLevels && widget.onNextLevel != null)
                    ArcadeButton(label: tr('saglamsebet_next_level_button', 'Növbəti səviyyə'), onTap: () => unawaited(_ads.transition(widget.onNextLevel!))),
                  ArcadeButton(style: ArcadeButtonStyle.muted, icon: AIcons.rotateCcw, label: tr('saglamsebet_replay_button', 'Təkrar oyna'), onTap: _retry),
                  ArcadeButton(style: ArcadeButtonStyle.faint, icon: AIcons.house, label: tr('saglamsebet_menu_button', 'Menyu'), onTap: _exit),
                ]),
              ]),
            if (_phase == 'lost')
              ArcadeOverlay(opacity: 0.95, gap: 8, children: [
                const ArcadeSadFace(),
                ArcadeTitle(_sim.lives <= 0 ? tr('saglamsebet_out_of_lives_title', 'Canlar bitdi!') : tr('saglamsebet_time_up_title', 'Vaxt bitdi!')),
                ArcadeScoreLine(prefix: tr('saglamsebet_your_score_prefix', 'Xalınız'), score: _sim.score, target: config.targetScore),
                ArcadeActions(children: [
                  GameReviveAction(ads: _ads, game: 'basket'),
                  ArcadeButton(icon: AIcons.rotateCcw, label: tr('saglamsebet_retry_button', 'Yenidən cəhd et'), onTap: _retry),
                  ArcadeButton(style: ArcadeButtonStyle.muted, icon: AIcons.house, label: tr('saglamsebet_menu_button', 'Menyu'), onTap: _exit),
                ]),
              ]),
          ]),
        ),
      );
    });

    return ArcadeFrame(
      light: const [TwColors.sky100, TwColors.emerald50, TwColors.amber50],
      dark: const [TwColors.slate900, TwColors.slate900, TwColors.slate800],
      hud: hud,
      body: playArea,
    );
  }

  Widget _intro(int twoStarScore, int threeStarScore, String levelLabel) {
    final muted = AnacanTokens.of(context).shadcn.mutedForeground;
    return ArcadeOverlay(children: [
      ArcadeEmblem(icon: AIcons.shoppingBasket, gradient: AnacanTokens.of(context).shadcn.gradientPrimary),
      ArcadeChip(trTierName(config.tierName)),
      ArcadeTitle(levelLabel),
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: Text(
          tr('saglamsebet_intro_desc', 'Sağlam qidaları səbətə tut, zərərli qidalardan və stress buludlarından qaç!'),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, height: 20 / 14, color: muted),
        ),
      ),
      ArcadeStatRow(items: [
        (AIcons.trophy, TwColors.amber500, '${config.targetScore} ${tr('saglamsebet_points_short', 'xal')}'),
        (AIcons.clock, null, '${config.duration}s'),
        (AIcons.heart, TwColors.rose500, '${config.lives}'),
      ]),
      Wrap(spacing: 12, alignment: WrapAlignment.center, children: [
        Text('⭐⭐ ≥ $twoStarScore', style: TextStyle(fontSize: 11, color: muted)),
        Text('⭐⭐⭐ ≥ $threeStarScore', style: TextStyle(fontSize: 11, color: muted)),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: ArcadeButton(horizontalPadding: 32, label: tr('saglamsebet_start_button', 'Başla'), onTap: _startCountdown),
      ),
    ]);
  }
}

/// The wicker basket: amber gradient body (`rounded-b-[28px] rounded-t-xl`), cross-hatch, handle and icon.
class _Basket extends StatelessWidget {
  const _Basket();
  @override
  Widget build(BuildContext context) {
    final shadows = AnacanTokens.of(context).shadcn.shadowElevated;
    return Stack(clipBehavior: Clip.none, alignment: Alignment.bottomCenter, children: [
      Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [TwColors.amber400, TwColors.amber600]),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12), bottom: Radius.circular(28)),
          border: Border.all(color: TwColors.amber700.withValues(alpha: 0.4), width: 2),
          boxShadow: shadows,
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(10), bottom: Radius.circular(26)),
          child: Stack(fit: StackFit.expand, children: [
            Opacity(opacity: 0.25, child: CustomPaint(painter: _WeavePainter())),
            Center(child: AIcon(AIcons.shoppingBasket, size: 28, color: const Color(0xFFFFFFFF).withValues(alpha: 0.9))),
          ]),
        ),
      ),
      Positioned(
        top: -4,
        width: basketWidth * 0.7,
        height: 8,
        child: Container(decoration: BoxDecoration(color: TwColors.amber700.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(9999))),
      ),
    ]);
  }
}

/// `repeating-linear-gradient(±45deg, rgba(0,0,0,.15) 0 3px, transparent 3px 8px)`.
class _WeavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x26000000)
      ..strokeWidth = 3;
    final extent = size.width + size.height;
    // Stripes 3px wide every 8px measured across the stripe direction.
    const period = 8 * math.sqrt2;
    for (var d = -extent; d < extent; d += period) {
      canvas.drawLine(Offset(d, 0), Offset(d + size.height, size.height), paint);
      canvas.drawLine(Offset(d + size.height, 0), Offset(d, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(_WeavePainter oldDelegate) => false;
}

class _FloatingLabel extends StatelessWidget {
  const _FloatingLabel({required this.text, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 700),
        curve: ACurves.framerDefault,
        builder: (context, t, child) => Opacity(
          opacity: 1 - t,
          child: Transform.translate(offset: Offset(0, -40 * t), child: Transform.scale(scale: 0.8 + 0.3 * t, child: child)),
        ),
        child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
      );
}

class _CountdownNumber extends StatelessWidget {
  const _CountdownNumber({super.key, required this.text, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 300),
        curve: ACurves.framerDefault,
        builder: (context, t, child) => Opacity(opacity: t, child: Transform.scale(scale: 0.4 + 0.8 * t, child: child)),
        child: Text(text,
            style: TextStyle(fontSize: 60, height: 1, fontWeight: FontWeight.w900, color: color, shadows: const [Shadow(color: Color(0x26000000), offset: Offset(0, 10), blurRadius: 8)])),
      );
}

/// `animate-float` / `animate-float-delayed` ☁️ (4 s / 5 s, translateY 0 → −15 px).
class _Cloud extends StatefulWidget {
  const _Cloud({required this.size, required this.opacity, required this.delayed});
  final double size;
  final double opacity;
  final bool delayed;
  @override
  State<_Cloud> createState() => _CloudState();
}

class _CloudState extends State<_Cloud> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: Duration(milliseconds: widget.delayed ? 5000 : 4000));

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
  Widget build(BuildContext context) => IgnorePointer(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = _controller.value;
            final phase = t < 0.5 ? t * 2 : (1 - t) * 2;
            return Transform.translate(offset: Offset(0, -15 * ACurves.cssEaseInOut.transform(phase)), child: child);
          },
          child: Opacity(opacity: widget.opacity, child: Text('☁️', style: TextStyle(fontSize: widget.size, height: 1))),
        ),
      );
}

/// `animate-wiggle` while [active] (rotate −3° ↔ 3°, 1 s ease-in-out).
class _Wiggle extends StatefulWidget {
  const _Wiggle({required this.active, required this.child});
  final bool active;
  final Widget child;
  @override
  State<_Wiggle> createState() => _WiggleState();
}

class _WiggleState extends State<_Wiggle> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));

  @override
  void didUpdateWidget(_Wiggle oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      _controller.repeat();
    } else if (!widget.active && oldWidget.active) {
      _controller
        ..stop()
        ..value = 0;
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
          if (!widget.active) return child!;
          final t = _controller.value;
          final phase = t < 0.5 ? t * 2 : (1 - t) * 2;
          final deg = -3 + 6 * ACurves.cssEaseInOut.transform(phase);
          return Transform.rotate(angle: deg * math.pi / 180, child: child);
        },
        child: widget.child,
      );
}
