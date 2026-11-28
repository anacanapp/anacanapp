// Ported from: src/components/games/qabarciq/BubblePop.tsx, src/components/games/qabarciq/bubble-pop.css
//
// Qabarcıq: lobby (best score, weekly top 3) → 90 s round (100 ms clock, pops, combos, wand / rainbow boosters,
// pause also on app background) → result (record, stats, weekly top 5, again / share). Scores > 0 are submitted
// for signed-in users (`submit_game_score_v1`, level 1) and the weekly board is refreshed afterwards.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/cache/cache.dart';
import '../../../../core/i18n/app_languages.dart';
import '../../../../design/design.dart';
import '../../casual/ui/game_platform.dart';
import '../../common/persistence/game_store.dart';
import '../../hub/data/game_score_sync.dart' show GameScoreInput;
import '../../hub/data/game_scores.dart';
import '../../saglam_sebet/ui/arcade_widgets.dart' show GameSurface;
import '../../ui_common/game_ads.dart';
import '../../ui_common/game_data.dart';
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../data/messages.dart';
import '../engine/engine.dart';
import '../persistence/storage.dart';
import 'bubble_widgets.dart';
import 'weekly_leaderboard.dart';

class _Ghost {
  const _Ghost(this.id, this.c, this.r, this.color);
  final int id, c, r, color;
}

class _Burst {
  const _Burst(this.id, this.x, this.y, this.text, this.color);
  final int id;
  final double x, y;
  final String text;
  final int color;
}

class _Result {
  const _Result(this.stats, this.score, this.record);
  final RoundStats stats;
  final int score;
  final bool record;
}

class BubblePop extends ConsumerStatefulWidget {
  const BubblePop({super.key, required this.onBack, this.seed});
  final VoidCallback onBack;

  /// `Date.now()` used to seed each board (tests pass a fixed value).
  final int Function()? seed;

  @override
  ConsumerState<BubblePop> createState() => BubblePopState();
}

class BubblePopState extends ConsumerState<BubblePop> {
  late final GameStore _store = ref.read(gameStoreProvider);
  late final GameAdsController _ads;
  String _view = 'lobby';
  bool _paused = false;
  late bool _sound = readBubbleSound(_store);
  late double _localBest = readBubbleBest(_store);
  late BubbleRound _round = BubbleRound(createBubbleBoard(_seed()));
  int _left = roundSeconds * 1000;
  final List<_Ghost> _ghosts = [];
  final List<_Burst> _bursts = [];
  Map<int, int> _fresh = {};
  int? _shake;
  _Result? _result;
  double _endAt = 0;
  int _seq = 1;
  Timer? _clock;
  final List<Timer> _pending = [];

  /// `data-game-phase`.
  String get phase => _view == 'play' ? (_paused ? 'paused' : 'playing') : _view == 'result' ? 'won' : 'menu';
  String get view => _view;
  BubbleRound get round => _round;
  int get left => _left;

  int _seed() => widget.seed?.call() ?? DateTime.now().millisecondsSinceEpoch;
  double _now() => ref.read(gameClockProvider).nowMs();

  @override
  void initState() {
    super.initState();
    _ads = GameAdsController(gameId: bubbleId, platform: ref.read(gameAdsPlatformProvider), phase: phase, restore: (_) {});
    _ads.addListener(_onAds);
    ref.read(gameAnalyticsProvider).screen('BubblePop', 'MiniGames');
  }

  void _onAds() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _clock?.cancel();
    for (final timer in _pending) {
      timer.cancel();
    }
    _ads.removeListener(_onAds);
    _ads.dispose();
    super.dispose();
  }

  void _after(int ms, VoidCallback action) {
    late final Timer timer;
    timer = Timer(Duration(milliseconds: ms), () {
      _pending.remove(timer);
      if (mounted) action();
    });
    _pending.add(timer);
  }

  /// The clock effect (`[view, paused]`): runs only while playing.
  void _syncClock() {
    final run = _view == 'play' && !_paused;
    if (!run) {
      _clock?.cancel();
      _clock = null;
      return;
    }
    if (_clock != null) return;
    _endAt = _now() + _left;
    _clock = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (!mounted) return;
      final remaining = math.max(0.0, _endAt - _now());
      setState(() {
        _left = remaining.ceil();
        _round.tick(_now().round());
      });
      if (remaining <= 0) {
        timer.cancel();
        _clock = null;
        _finish();
      }
    });
  }

  void _setView(String view, {bool? paused}) {
    setState(() {
      _view = view;
      if (paused != null) _paused = paused;
    });
    _ads.update(phase: phase, restore: (_) {});
    _syncClock();
  }

  void _setPaused(bool value) {
    setState(() => _paused = value);
    _ads.update(phase: phase, restore: (_) {});
    _syncClock();
  }

  void _start() {
    final next = createBubbleBoard(_seed());
    _clock?.cancel();
    _clock = null;
    setState(() {
      _round = BubbleRound(next);
      _ghosts.clear();
      _bursts.clear();
      _result = null;
      _fresh = {
        for (var c = 0; c < next.grid.length; c++)
          for (var r = 0; r < next.grid[c].length; r++) next.grid[c][r].id: r + 1 + c % 3,
      };
      _left = roundSeconds * 1000;
    });
    _setView('play', paused: false);
    _ads.resetRound();
    ref.read(gameAnalyticsProvider).event('minigame_level_started', {'game_id': bubbleId, 'level': 1});
  }

  int get _best => math.max(_localBest, ((ref.read(myGameScoreQuery(bubbleId)).data?['best_score'] as num?) ?? 0).toDouble()).toInt();

  void _finish() {
    final s = _round.stats;
    final score = math.min(maxScore, s.score);
    final record = score > 0 && score > _best;
    if (record) {
      recordBubbleBest(_store, score, _best);
      _localBest = score.toDouble();
    }
    setState(() {
      _result = _Result(s, score, record);
      _round.mode = 'pop';
    });
    _setView('result');
    ref.read(gameAnalyticsProvider).event('minigame_level_won', {'game_id': bubbleId, 'level': 1, 'score': score});
    if (score > 0 && ref.read(authUserProvider) != null) {
      unawaited(ref.read(gameScoreSubmitterProvider(bubbleId)).mutate(
            GameScoreInput(score: score, level: 1),
            language: ref.read(gameLanguageProvider),
            onToast: (toast) {
              if (toast.kind == GameScoreToastKind.success) unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['game-weekly-leaderboard']));
              _showToast(toast);
            },
          ));
    }
    unawaited(ref.read(gameHapticsProvider).medium());
  }

  void _showToast(GameScoreToast toast) {
    if (!mounted || context.findAncestorStateOfType<State<AToastHost>>() == null) return;
    final toasts = AToastHost.of(context);
    switch (toast.kind) {
      case GameScoreToastKind.success:
        toasts.success(toast.message);
      case GameScoreToastKind.info:
        toasts.info(toast.message);
      case GameScoreToastKind.error:
        toasts.error(toast.message);
    }
  }

  /// Hardware back: play → pause (→ lobby when paused), result → lobby, lobby → hub.
  bool _back() {
    if (_view == 'play') {
      if (!_paused) {
        _setPaused(true);
      } else {
        _setView('lobby');
      }
    } else if (_view == 'result') {
      _setView('lobby');
    } else {
      widget.onBack();
    }
    return true;
  }

  void _tap(int c, int r) {
    if (_view != 'play' || _paused) return;
    final before = _round.board;
    final color0 = before.grid[c][r].color;
    final id = before.grid[c][r].id;
    final mode = _round.mode;
    final outcome = _round.tap(c, r, _now().round());
    if (outcome == null) {
      setState(() => _shake = id);
      _after(320, () => setState(() {
            if (_shake == id) _shake = null;
          }));
      return;
    }
    final cells = outcome.cells;
    final removedPerCol = List<int>.filled(cols, 0);
    for (final (cc, _) in cells) {
      removedPerCol[cc]++;
    }
    final next = _round.board;
    final spawned = <int, int>{};
    for (var cc = 0; cc < next.grid.length; cc++) {
      for (final bubble in next.grid[cc]) {
        if (bubble.id >= before.nextId) spawned[bubble.id] = removedPerCol[cc];
      }
    }
    final color = cells.isEmpty ? color0 : before.grid[cells[0].$1][cells[0].$2].color;
    final gid = _seq;
    final cx = cells.fold<int>(0, (a, cell) => a + cell.$1) / cells.length, cy = cells.fold<int>(0, (a, cell) => a + cell.$2) / cells.length;
    final burstId = _seq++;
    final language = normalizeAppLanguage(ref.read(gameLanguageProvider));
    setState(() {
      _fresh = spawned;
      final keep = _ghosts.length > 40 ? _ghosts.sublist(_ghosts.length - 40) : List.of(_ghosts);
      _ghosts
        ..clear()
        ..addAll(keep)
        ..addAll([for (var i = 0; i < cells.length; i++) _Ghost(gid * 1000 + i, cells[i].$1, cells[i].$2, color)]);
      final keepBursts = _bursts.length > 6 ? _bursts.sublist(_bursts.length - 6) : List.of(_bursts);
      _bursts
        ..clear()
        ..addAll(keepBursts)
        ..add(_Burst(burstId, cx, cy, '+${gameNumber(language, outcome.gained)}', color));
    });
    _after(750, () => setState(() {
          _ghosts.removeWhere((g) => g.id ~/ 1000 == gid);
          _bursts.removeWhere((b) => b.id == burstId);
        }));
    final big = cells.length >= 6 || outcome.kind != 'group';
    if (_sound) ref.read(bubbleSoundPlayerProvider).pop(outcome.combo, big);
    unawaited(big ? ref.read(gameHapticsProvider).medium() : ref.read(gameHapticsProvider).light());
    // A booster used on its tap goes back to 'pop' (the engine already did); mode is read for the hint text.
    if (mode != _round.mode) setState(() {});
  }

  void _toggleSound() {
    setState(() => _sound = !_sound);
    writeBubbleSound(_store, _sound);
  }

  Future<void> _share(BubbleMessages messages, String language, int score) async {
    await ref.read(shareServiceProvider).share(title: _t(messages, language, 'title'), text: _t(messages, language, 'shareText', {'score': score}));
    ref.read(gameAnalyticsProvider).event('minigame_shared', {'game_id': bubbleId, 'score': score});
  }

  String _t(BubbleMessages messages, String language, String key, [Map<String, Object?> values = const {}]) =>
      messages.text(language, key, {for (final e in values.entries) e.key: e.value is num ? gameNumber(language, e.value as num) : e.value});

  @override
  Widget build(BuildContext context) {
    _ads.update(phase: phase, restore: (_) {});
    final data = ref.watch(gameDataProvider).value;
    if (data == null) return const GamePortal(child: ColoredBox(color: BubbleColors.cream));
    final language = normalizeAppLanguage(ref.watch(gameLanguageProvider));
    final dir = language == 'ar' ? TextDirection.rtl : TextDirection.ltr;
    String t(String key, [Map<String, Object?> values = const {}]) => _t(data.bubble, language, key, values);
    String fmt(num value) => gameNumber(language, value);
    final user = ref.watch(authUserProvider);
    final myScore = ref.watch(myGameScoreQuery(bubbleId)).data;
    final best = math.max(_localBest, ((myScore?['best_score'] as num?) ?? 0).toDouble());
    final weekly = ref.watch(weeklyLeaderboardQuery((gameId: bubbleId, limit: 20)));
    final media = MediaQuery.of(context);
    final short = media.size.height <= 640;

    Widget iconButton(Widget icon, String label, VoidCallback onTap, {bool light = false, bool? pressed}) => GameButton(
          label: label,
          selected: pressed,
          onTap: onTap,
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: light ? const Color(0xE6FFFFFF) : const Color(0xFFFFE7DD),
              boxShadow: light ? const [BoxShadow(color: Color(0x33C4413F), offset: Offset(0, 4), blurRadius: 12)] : null,
            ),
            alignment: Alignment.center,
            child: icon,
          ),
        );

    Widget header() => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 46),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            iconButton(const AIcon(AIcons.arrowLeft, size: 19, color: BubbleColors.coral, mirrorInRtl: true), t('back'), _back),
            iconButton(AIcon(_sound ? AIcons.volume2 : AIcons.volumeX, size: 19, color: BubbleColors.coral), t('sound'), _toggleSound, pressed: _sound),
          ]),
        );

    Widget pillButton(String label, VoidCallback? onTap, {bool primary = true, Widget? icon, double minHeight = 52, double fontSize = 17}) => GameButton(
          label: label,
          enabled: onTap != null,
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.4 : 1,
            child: Container(
              constraints: BoxConstraints(minHeight: minHeight),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: primary ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [BubbleColors.coral2, BubbleColors.coral]) : null,
                color: primary ? null : BubbleColors.white,
                border: primary ? null : Border.all(color: const Color(0xFFFFB4A8), width: 2),
                boxShadow: primary ? const [BoxShadow(color: Color(0xFFD9474B), offset: Offset(0, 5)), BoxShadow(color: BubbleColors.coral, offset: Offset(0, 12), blurRadius: 24, spreadRadius: -10)] : null,
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[icon, const SizedBox(width: 8)],
                Flexible(
                  child: Text(label,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w800, color: primary ? BubbleColors.white : BubbleColors.coral)),
                ),
              ]),
            ),
          ),
        );

    Widget rankList(int count, bool compact) {
      Widget note(Widget child) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 13, color: BubbleColors.muted), textAlign: TextAlign.center, child: child),
          );
      if (user == null) return note(Text(t('signIn')));
      if (weekly.isLoading) return const _Skeleton();
      if (weekly.isError) {
        return note(Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text('${t('loadError')} '),
          GameButton(
            onTap: () => unawaited(ref.read(weeklyLeaderboardQuery((gameId: bubbleId, limit: 20)).notifier).refetch()),
            child: Text(t('retry'), style: const TextStyle(fontSize: 13, color: BubbleColors.coral, fontWeight: FontWeight.w800, decoration: TextDecoration.underline)),
          ),
        ]));
      }
      final board = weekly.data;
      final rows = (board?.top ?? const <WeeklyRow>[]).take(count).toList();
      if (rows.isEmpty) return note(Text(t('empty')));
      final me = board?.me;
      final meInTop = rows.any((row) => row.userId == user.id);
      Widget item({required bool mine, required Widget rank, required Widget avatar, required String name, required String score}) => Container(
            constraints: BoxConstraints(minHeight: compact ? 42 : 48),
            padding: compact ? (mine ? const EdgeInsets.symmetric(vertical: 4, horizontal: 10) : const EdgeInsets.symmetric(vertical: 3, horizontal: 4)) : const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: compact ? (mine ? BubbleColors.white : null) : (mine ? null : BubbleColors.white),
              gradient: !compact && mine ? const LinearGradient(colors: [Color(0xFFFFD9C8), Color(0xFFFFE7DC)]) : null,
              border: compact
                  ? (mine ? Border.all(color: const Color(0xFFFFD2C2)) : null)
                  : Border.all(color: mine ? const Color(0xFFFFC6B2) : const Color(0xFFF6E6DE)),
            ),
            child: Row(children: [
              rank,
              const SizedBox(width: 10),
              avatar,
              const SizedBox(width: 10),
              Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: BubbleColors.ink))),
              const SizedBox(width: 10),
              Text(score, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFD9534B), fontFeatures: [ui.FontFeature.tabularFigures()])),
            ]),
          );
      Widget rank(String text, int? top) => SizedBox(
            width: 22,
            child: Text(text,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: top == 1 ? const Color(0xFFE5A100) : top == 2 ? const Color(0xFF8F8FA3) : top == 3 ? const Color(0xFFD27A4A) : BubbleColors.muted,
                )),
          );
      final children = <Widget>[
        for (final row in rows)
          item(
            mine: row.userId == user.id,
            rank: rank('${row.rank}', row.rank <= 3 ? row.rank : null),
            avatar: BubbleAvatar(name: row.name ?? t('you'), avatarUrl: row.avatarUrl),
            name: row.userId == user.id ? t('you') : row.name ?? t('player'),
            score: fmt(row.score),
          ),
        if (me != null && !meInTop)
          item(mine: true, rank: rank(fmt(me.rank), null), avatar: BubbleAvatar(name: t('you'), avatarUrl: null), name: t('you'), score: fmt(me.score)),
      ];
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 7), children[i]],
      ]);
    }

    Widget card({required String title, required Widget child, Widget? footer, bool grow = false}) => Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const CssLinearGradient(angle: 160, colors: [BubbleColors.white, Color(0xFFFFF4EE)]),
            border: Border.all(color: BubbleColors.line),
            boxShadow: const [BoxShadow(color: Color(0x55C96A5A), offset: Offset(0, 10), blurRadius: 30, spreadRadius: -18)],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: grow ? MainAxisSize.max : MainAxisSize.min, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFFC9463F)))),
                if (weekly.data != null)
                  Text(t('players', {'n': weekly.data!.players}), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: BubbleColors.muted)),
              ]),
            ),
            if (grow) Expanded(child: SingleChildScrollView(child: child)) else child,
            ?footer,
          ]),
        );

    Widget body;
    if (_view == 'lobby') {
      body = SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          header(),
          const SizedBox(height: 12),
          Text(t('title'), textAlign: TextAlign.center, style: TextStyle(fontSize: short ? 26 : 32, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: BubbleColors.coral)),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(t('tagline'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: BubbleColors.muted)),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Center(child: HeroBubbles(width: math.min(short ? 170.0 : 240.0, media.size.width * (short ? 0.45 : 0.62)))),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFFFFB4A8), width: 2),
              color: const Color(0xFFFFF4EF),
            ),
            child: Text.rich(
              TextSpan(children: [TextSpan(text: '${t('best')}: '), TextSpan(text: fmt(best), style: const TextStyle(fontWeight: FontWeight.w800))]),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFFE2584F)),
            ),
          ),
          const SizedBox(height: 12),
          pillButton(t('play'), _start, icon: const GameFilledIcon(AIcons.play, size: 20, color: BubbleColors.white), minHeight: 58, fontSize: 20),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(t('howTo'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, height: 1.45, color: BubbleColors.muted)),
          ),
          const SizedBox(height: 12),
          card(
            title: t('weekly'),
            child: rankList(3, true),
            footer: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(t('resets'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5, color: BubbleColors.muted)),
            ),
          ),
        ]),
      );
    } else if (_view == 'play') {
      body = _playView(t, fmt, short);
    } else {
      final r = _result ?? const _Result(RoundStats(), 0, false);
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        header(),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const CssLinearGradient(angle: 170, colors: [Color(0xFFFF8A7A), BubbleColors.coral]),
            boxShadow: const [BoxShadow(color: BubbleColors.coral, offset: Offset(0, 16), blurRadius: 30, spreadRadius: -16)],
          ),
          child: Column(children: [
            Opacity(opacity: 0.85, child: Text(t('timeUp'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: BubbleColors.white))),
            const SizedBox(height: 2),
            Text(t(r.record || r.score >= 8000 ? 'great' : 'good'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: BubbleColors.white)),
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 4, 0, 12),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(fmt(r.score),
                    style: TextStyle(fontSize: short ? 42 : 52, fontWeight: FontWeight.w800, letterSpacing: -1, height: 1.1, color: BubbleColors.white, fontFeatures: const [ui.FontFeature.tabularFigures()])),
                if (r.record) ...[
                  const SizedBox(width: 10),
                  Transform.rotate(
                    angle: -6 * math.pi / 180,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: const Color(0xFFFFE79A), borderRadius: BorderRadius.circular(999)),
                      child: Text(t('newRecord'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF9A6A00))),
                    ),
                  ),
                ],
              ]),
            ),
            Row(children: [
              for (final (i, (icon, label, value)) in [
                (AIcons.sparkles, t('popped'), fmt(r.stats.popped)),
                (AIcons.link2, t('bestCombo'), 'x${fmt(r.stats.bestCombo)}'),
                (AIcons.clock, t('time'), t('seconds', {'n': roundSeconds})),
              ].indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
                    decoration: BoxDecoration(color: const Color(0xE8FFFFFF), borderRadius: BorderRadius.circular(18)),
                    child: Column(children: [
                      AIcon(icon, size: 16, color: BubbleColors.coral),
                      const SizedBox(height: 2),
                      Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5, height: 1.2, fontWeight: FontWeight.w700, color: BubbleColors.muted)),
                      const SizedBox(height: 2),
                      Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: BubbleColors.ink)),
                    ]),
                  ),
                ),
              ],
            ]),
          ]),
        ),
        const SizedBox(height: 10),
        Expanded(child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 120), child: card(title: t('weeklyTitle'), child: rankList(5, false), grow: true))),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: pillButton(t('again'), _ads.waiting ? null : () => unawaited(_ads.transition(_start)))),
          const SizedBox(width: 10),
          Expanded(
            child: pillButton(t('share'), () => unawaited(_share(data.bubble, language, r.score)),
                primary: false, icon: const AIcon(AIcons.share2, size: 17, color: BubbleColors.coral)),
          ),
        ]),
        const SizedBox(height: 12),
      ]);
    }

    return GamePortal(
      child: GameBackHandler(
        onBack: _back,
        child: GameLifecycleListener(
          onHidden: () {
            if (_view == 'play' && !_paused) _setPaused(true);
          },
          child: Directionality(
            textDirection: dir,
            child: GameSurface(
              child: DefaultTextStyle(
                style: const TextStyle(fontFamily: 'Plus Jakarta Sans', fontFamilyFallback: ['Nunito', 'Inter'], color: BubbleColors.ink, fontSize: 14),
                child: CustomPaint(
                  key: const ValueKey('bubble-pop-screen'),
                  painter: _BackgroundPainter(),
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(math.max(14, media.padding.left), math.max(10, media.padding.top), math.max(14, media.padding.right), math.max(10, media.padding.bottom)),
                    child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520), child: body)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _playView(String Function(String, [Map<String, Object?>]) t, String Function(num) fmt, bool short) {
    final seconds = (_left / 1000).ceil();
    final clock = '${seconds ~/ 60}:${'${seconds % 60}'.padLeft(2, '0')}';
    final combo = _round.combo;
    final mode = _round.mode;
    final reduce = animationsDisabled(context);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final hud = Container(
      constraints: BoxConstraints(minHeight: short ? 56 : 64),
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [BubbleColors.coral2, BubbleColors.coral]),
        boxShadow: const [BoxShadow(color: BubbleColors.coral, offset: Offset(0, 10), blurRadius: 24, spreadRadius: -12)],
      ),
      child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
        Row(children: [
          GameButton(
            label: t('paused'),
            onTap: () => _setPaused(true),
            child: Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xE6FFFFFF), boxShadow: [BoxShadow(color: Color(0x33C4413F), offset: Offset(0, 4), blurRadius: 12)]),
              alignment: Alignment.center,
              child: const GameFilledIcon(AIcons.pause, size: 18, color: BubbleColors.coral),
            ),
          ),
          const Spacer(),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 92),
            child: Semantics(
              liveRegion: true,
              child: Text(fmt(_round.stats.score),
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: BubbleColors.white, fontFeatures: [ui.FontFeature.tabularFigures()])),
            ),
          ),
        ]),
        Positioned.fill(
          child: OverflowBox(
            minWidth: 0,
            minHeight: 0,
            maxWidth: short ? 66 : 78,
            maxHeight: short ? 66 : 78,
            child: Transform.translate(
              offset: Offset(0, (short ? 66 : 78) * 0.2),
              child: _Clock(size: short ? 66 : 78, text: clock, fraction: 1 - _left / (roundSeconds * 1000), low: seconds <= 10, animate: !reduce),
            ),
          ),
        ),
        Positioned(
          right: rtl ? null : -2,
          left: rtl ? -2 : null,
          bottom: -28,
          child: AnimatedOpacity(
            key: ValueKey('combo-$combo'),
            opacity: combo >= 2 ? 1 : 0,
            duration: reduce ? Duration.zero : const Duration(milliseconds: 150),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: combo >= 2 ? 0 : 1, end: 1),
              duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
              builder: (context, v, child) {
                final scale = combo < 2 ? 0.6 : v < 0.6 ? 0.7 + 0.45 * v / 0.6 : 1.15 - 0.15 * (v - 0.6) / 0.4;
                return Transform.scale(scale: scale, child: child);
              },
              child: Container(
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: BubbleColors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: const [BoxShadow(color: Color(0x88C4413F), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -6)],
                ),
                child: combo >= 2
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.sparkles, size: 13, color: BubbleColors.coral),
                        const SizedBox(width: 5),
                        Text(t('combo', {'n': combo}), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: BubbleColors.coral)),
                      ])
                    : const SizedBox(),
              ),
            ),
          ),
        ),
      ]),
    );

    final field = Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: LayoutBuilder(builder: (context, constraints) {
          final cell = math.max(24.0, math.min(constraints.maxWidth / cols, constraints.maxHeight / rows).floorToDouble());
          final w = cell * cols, h = cell * rows;
          final grid = _round.board.grid;
          return Center(
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: SizedBox(
                width: w,
                height: h,
                child: Stack(clipBehavior: Clip.none, children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: const Color(0xFFFFEEE6), borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFFFD9CB))),
                        child: Stack(children: [
                          for (var c = 0; c < grid.length; c++)
                            for (var r = 0; r < grid[c].length; r++)
                              BubbleView(
                                key: ValueKey(grid[c][r].id),
                                color: grid[c][r].color,
                                position: Offset(c * cell, r * cell),
                                cell: cell,
                                drop: _fresh[grid[c][r].id] ?? 0,
                                shake: _shake == grid[c][r].id,
                                picking: mode != 'pop',
                                label: '${c + 1}:${r + 1}',
                                reduceMotion: reduce,
                                onDown: () => _tap(c, r),
                              ),
                          for (final g in _ghosts) BubbleGhost(key: ValueKey('ghost-${g.id}'), color: g.color, position: Offset(g.c * cell, g.r * cell), cell: cell),
                        ]),
                      ),
                    ),
                  ),
                  for (final b in _bursts)
                    BubbleBurst(key: ValueKey('burst-${b.id}'), color: b.color, center: Offset((b.x + 0.5) * cell, (b.y + 0.5) * cell), text: b.text),
                ]),
              ),
            ),
          );
        }),
      ),
    );

    Widget tool(String kind, AIconData icon, int count) {
      final active = mode == kind;
      final wand = kind == 'wand';
      final size = short ? 56.0 : 66.0;
      return GameButton(
        label: t(kind),
        enabled: count > 0,
        selected: active,
        onTap: () => setState(() => _round.mode = _round.mode == kind ? 'pop' : kind),
        child: Opacity(
          opacity: count > 0 ? 1 : 0.4,
          child: AnimatedSlide(
            offset: Offset(0, active ? -4 / size : 0),
            duration: reduce ? Duration.zero : const Duration(milliseconds: 150),
            child: AnimatedScale(
              scale: active ? 1.06 : 1,
              duration: reduce ? Duration.zero : const Duration(milliseconds: 150),
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    center: const Alignment(-0.3, -0.4),
                    colors: wand ? const [Color(0xFFA8D2FB), Color(0xFF5F9EE6)] : const [Color(0xFFFFF1B5), Color(0xFFF3C741)],
                  ),
                  border: active ? Border.all(color: BubbleColors.white, width: 3, strokeAlign: BorderSide.strokeAlignOutside) : null,
                  boxShadow: wand
                      ? const [BoxShadow(color: Color(0xFF4A82C4), offset: Offset(0, 5)), BoxShadow(color: Color(0xFF4A82C4), offset: Offset(0, 10), blurRadius: 18, spreadRadius: -8)]
                      : const [BoxShadow(color: Color(0xFFD1A428), offset: Offset(0, 5)), BoxShadow(color: Color(0xFFD1A428), offset: Offset(0, 10), blurRadius: 18, spreadRadius: -8)],
                ),
                child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
                  AIcon(icon, size: 24, color: BubbleColors.white),
                  Positioned(
                    right: -2,
                    bottom: -2,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 24),
                      height: 24,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: BubbleColors.white,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [BoxShadow(color: Color(0x22000000), offset: Offset(0, 2), blurRadius: 6)],
                      ),
                      alignment: Alignment.center,
                      child: Text('$count', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B7FB0))),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    final tools = Padding(
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 10),
      child: Stack(clipBehavior: Clip.none, children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          tool('wand', AIcons.wandSparkles, _round.wands),
          const SizedBox(width: 26),
          tool('rainbow', AIcons.rainbow, _round.rainbows),
        ]),
        if (mode != 'pop')
          Positioned(
            top: -26,
            left: 0,
            right: 0,
            child: Text(t(mode == 'wand' ? 'pickWand' : 'pickRainbow'),
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: BubbleColors.coral)),
          ),
      ]),
    );

    return Stack(clipBehavior: Clip.none, children: [
      Positioned.fill(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [hud, field, tools])),
      if (_paused)
        Positioned(
          left: -20,
          top: -20,
          right: -20,
          bottom: -20,
          child: Semantics(
            scopesRoute: true,
            explicitChildNodes: true,
            label: t('paused'),
            child: ClipRect(
              child: BackdropFilter(
                filter: AnacanTokens.of(context).blurEnabled ? ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4) : ui.ImageFilter.blur(),
                child: ColoredBox(
                  color: const Color(0x554A3A36),
                  child: Center(
                    child: FractionallySizedBox(
                      widthFactor: 0.86,
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 320),
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                            decoration: BoxDecoration(
                              color: BubbleColors.white,
                              borderRadius: BorderRadius.circular(28),
                              boxShadow: const [BoxShadow(color: Color(0x55000000), offset: Offset(0, 20), blurRadius: 50, spreadRadius: -20)],
                            ),
                            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              Text(t('paused'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: BubbleColors.coral)),
                              const SizedBox(height: 12),
                              Text(fmt(_round.stats.score), textAlign: TextAlign.center, style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: BubbleColors.ink)),
                              const SizedBox(height: 16),
                              _ModalButton(label: t('resume'), primary: true, onTap: () => _setPaused(false)),
                              const SizedBox(height: 12),
                              _ModalButton(label: t('quit'), primary: false, onTap: () => _setView('lobby', paused: false)),
                            ]),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    ]);
  }
}

class _ModalButton extends StatelessWidget {
  const _ModalButton({required this.label, required this.primary, required this.onTap});
  final String label;
  final bool primary;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GameButton(
        label: label,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: primary ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [BubbleColors.coral2, BubbleColors.coral]) : null,
            color: primary ? null : BubbleColors.white,
            border: primary ? null : Border.all(color: const Color(0xFFFFB4A8), width: 2),
            boxShadow: primary ? const [BoxShadow(color: Color(0xFFD9474B), offset: Offset(0, 5)), BoxShadow(color: BubbleColors.coral, offset: Offset(0, 12), blurRadius: 24, spreadRadius: -10)] : null,
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (primary) ...[const GameFilledIcon(AIcons.play, size: 18, color: BubbleColors.white), const SizedBox(width: 8)],
            Text(label, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: primary ? BubbleColors.white : BubbleColors.coral)),
          ]),
        ),
      );
}

/// `.bp-clock`: coral disc with the cream halo, the remaining-time ring and the m:ss label (pulsing ≤ 10 s).
class _Clock extends StatefulWidget {
  const _Clock({required this.size, required this.text, required this.fraction, required this.low, required this.animate});
  final double size;
  final String text;
  final double fraction;
  final bool low;
  final bool animate;
  @override
  State<_Clock> createState() => _ClockState();
}

class _ClockState extends State<_Clock> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

  void _sync() {
    if (widget.low && widget.animate) {
      if (!_pulse.isAnimating) _pulse.repeat();
    } else {
      _pulse
        ..stop()
        ..value = 0;
    }
  }

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(_Clock oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _pulse,
        builder: (context, child) {
          final t = _pulse.value, phase = t < 0.5 ? t * 2 : (1 - t) * 2;
          final k = _pulse.isAnimating ? ACurves.cssEaseInOut.transform(phase) : 0.0;
          return Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: BubbleColors.coral,
              boxShadow: [
                const BoxShadow(color: BubbleColors.cream, spreadRadius: 5),
                if (k > 0) BoxShadow(color: const Color(0x44FF5A5F), spreadRadius: 5 + 5 * k),
                if (k == 0) const BoxShadow(color: Color(0xFFC4413F), offset: Offset(0, 10), blurRadius: 20, spreadRadius: -8),
              ],
            ),
            child: child,
          );
        },
        child: Stack(alignment: Alignment.center, children: [
          Positioned.fill(child: Padding(padding: const EdgeInsets.all(6), child: CustomPaint(painter: ClockRingPainter(1 - widget.fraction)))),
          Text(widget.text,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: BubbleColors.white, fontFeatures: [ui.FontFeature.tabularFigures()])),
        ]),
      );
}

class _Skeleton extends StatefulWidget {
  const _Skeleton();
  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

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
  Widget build(BuildContext context) => ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => Container(
            height: 120,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment(-1 + 4 * (1 - _controller.value) - 2, 0),
                end: Alignment(1 + 4 * (1 - _controller.value) - 2, 0),
                colors: const [Color(0xFFFDEEE8), BubbleColors.cream, Color(0xFFFDEEE8)],
                tileMode: TileMode.repeated,
              ),
            ),
          ),
        ),
      );
}

/// `.bp-screen` background: two peach blobs (92 % 6 %, r 70; 4 % 96 %, r 110) over the cream gradient.
class _BackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [BubbleColors.cream, Color(0xFFFFF1EA)]).createShader(rect));
    canvas.drawCircle(Offset(size.width * 0.92, size.height * 0.06), 70.5, Paint()..color = const Color(0xFFFFD9C9));
    canvas.drawCircle(Offset(size.width * 0.04, size.height * 0.96), 110.5, Paint()..color = const Color(0xFFFFD2C2));
  }

  @override
  bool shouldRepaint(_BackgroundPainter oldDelegate) => false;
}
