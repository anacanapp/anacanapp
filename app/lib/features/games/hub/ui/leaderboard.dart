// Ported from: src/components/games/Leaderboard.tsx
//
// Top 20 of a game (`game_scores`), the signed-out invitation, the visible load error with retry, the empty state
// with the player's own best and the player's best below the list when outside the top 20.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../../settings/ui/settings_ui.dart' show ARingSpinner, px;
import '../../ui_common/game_env.dart';
import '../../ui_common/game_widgets.dart';
import '../data/game_score_sync.dart';
import '../data/game_scores.dart';

class Leaderboard extends ConsumerWidget {
  const Leaderboard({super.key, required this.gameId});
  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(gameLanguageProvider);
    String m(String key) => gameScoreMessage(language, key);
    final user = ref.watch(authUserProvider);
    final loading = ref.watch(gameAuthLoadingProvider);
    final board = ref.watch(gameLeaderboardQuery((gameId: gameId, limit: 20)));
    final mine = ref.watch(myGameScoreQuery(gameId)).data;
    final entries = board.data ?? const <LeaderboardEntry>[];
    final myRankIndex = entries.indexWhere((e) => e.userId == user?.id);

    if (loading || board.isLoading) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Center(child: ARingSpinner(size: 24, width: 2, color: a.peach2)));
    }

    final primary = context.tokens.shadcn.primary, onPrimary = context.tokens.shadcn.primaryForeground;
    Widget primaryButton(String label, VoidCallback onTap) => GameButton(
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(16)),
            child: Text(label, style: px(14, weight: FontWeight.w600, color: onPrimary, height: 20 / 14)),
          ),
        );
    Widget card({required List<Widget> children, double vertical = 28}) => Container(
          padding: EdgeInsets.symmetric(horizontal: 18, vertical: vertical),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22), boxShadow: a.cardShadow),
          child: Column(children: children),
        );

    if (user == null) {
      return card(children: [
        AIcon(AIcons.user, size: 36, color: primary),
        const SizedBox(height: 12),
        Text(m('loginTitle'), style: x.aListTitle, textAlign: TextAlign.center),
        Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(m('loginDescription'), style: x.aListSub, textAlign: TextAlign.center)),
        primaryButton(m('login'), () => GoRouter.maybeOf(context)?.go('/')),
      ]);
    }

    if (board.isError) {
      return Semantics(
        liveRegion: true,
        child: card(children: [
          Text(m('loadingError'), style: x.aListTitle, textAlign: TextAlign.center),
          Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(m('loadingDescription'), style: x.aListSub, textAlign: TextAlign.center)),
          primaryButton(m('retry'), () => ref.read(gameLeaderboardQuery((gameId: gameId, limit: 20)).notifier).refetch()),
        ]),
      );
    }

    if (entries.isEmpty) {
      return card(vertical: 34, children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
          alignment: Alignment.center,
          child: AIcon(AIcons.trophy, size: 32, color: a.inkFaint),
        ),
        const SizedBox(height: 12),
        Text(tr('minigames_leaderboard_empty_title', 'Reytinq hələ boşdur'), style: x.aListTitle, textAlign: TextAlign.center),
        const SizedBox(height: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Text(tr('minigames_leaderboard_empty_desc', 'İlk oyunçu siz olun! Oyunu bitirin və xalınız qlobal reytinqə düşsün.'),
              style: x.aListSub, textAlign: TextAlign.center),
        ),
        if (mine != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              AIcon(AIcons.trophy, size: 16, color: a.accentInk),
              const SizedBox(width: 8),
              Text('${tr('minigames_your_best_score', 'Sizin ən yaxşı xalınız')}: ${mine['best_score']}',
                  style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14)),
            ]),
          ),
        ],
      ]);
    }

    final rankStyles = <({Gradient bg, Color ink})>[
      (bg: a.gradYellow, ink: a.warnInk),
      (bg: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.surfaceSoft, a.lineStrong]), ink: a.inkSoft),
      (bg: a.gradPeach, ink: a.accentInk),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var index = 0; index < entries.length; index++) ...[
          if (index > 0) const SizedBox(height: 8),
          _row(context, entries[index], index + 1, entries[index].userId == user.id, rankStyles),
        ],
        if (myRankIndex == -1 && mine != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.peach2)),
            child: Row(children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(12)),
                child: Text('—', style: px(12, weight: FontWeight.w700, color: a.accentInk)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(tr('minigames_your_best_score', 'Sizin ən yaxşı xalınız'),
                    style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14)),
              ),
              Text('${mine['best_score']}', style: px(14, weight: FontWeight.w800, color: a.accentInk, height: 20 / 14)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _row(BuildContext context, LeaderboardEntry entry, int rank, bool isMe, List<({Gradient bg, Color ink})> rankStyles) {
    final a = context.a;
    final soft = isMe ? a.accentInk : a.inkSoft;
    return FadeRiseIn(
      delay: Duration(milliseconds: math.min((rank - 1) * 20, 200)),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isMe ? a.peach1 : a.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isMe ? a.peach2 : a.line),
          boxShadow: isMe ? null : a.cardShadow,
        ),
        child: Row(children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: rank <= 3 ? rankStyles[rank - 1].bg : null,
              color: rank <= 3 ? null : a.surfaceSoft,
              borderRadius: BorderRadius.circular(12),
              boxShadow: rank <= 3 ? const [BoxShadow(color: Color(0x4017150F), offset: Offset(0, 4), blurRadius: 10, spreadRadius: -4)] : null,
            ),
            child: rank <= 3
                ? AIcon(AIcons.medal, size: 16, color: rankStyles[rank - 1].ink)
                : Text('$rank', style: px(12, weight: FontWeight.w700, color: a.inkSoft)),
          ),
          const SizedBox(width: 12),
          ClipOval(
            child: Container(
              width: 36,
              height: 36,
              color: isMe ? a.chipOverlay : a.peach1,
              alignment: Alignment.center,
              child: entry.avatarUrl != null
                  ? Image.network(entry.avatarUrl!, width: 36, height: 36, fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => AIcon(AIcons.user, size: 16, color: a.accentInk))
                  : AIcon(AIcons.user, size: 16, color: a.accentInk),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: entry.name),
                  if (isMe) TextSpan(text: ' (${tr('minigames_you_label', 'Siz')})', style: px(12, color: a.accentInk)),
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: px(14, weight: FontWeight.w700, color: isMe ? a.accentInk : a.ink, height: 20 / 14),
              ),
              Opacity(
                opacity: isMe ? 0.75 : 1,
                child: Text('${tr('saglamsebet_level_label', 'Səviyyə')} ${entry.bestLevel}', style: px(11, color: soft, height: 16.5 / 11)),
              ),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${entry.bestScore}', style: px(14, weight: FontWeight.w800, color: a.accentInk, height: 20 / 14)),
            Opacity(opacity: isMe ? 0.75 : 1, child: Text(tr('minigames_points_label', 'xal'), style: px(10, color: soft, height: 15 / 10))),
          ]),
        ]),
      ),
    );
  }
}

/// framer `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}` with a delay.
class FadeRiseIn extends StatefulWidget {
  const FadeRiseIn({super.key, required this.child, this.delay = Duration.zero, this.dy = 6});
  final Widget child;
  final Duration delay;
  final double dy;
  @override
  State<FadeRiseIn> createState() => _FadeRiseInState();
}

class _FadeRiseInState extends State<FadeRiseIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

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
      builder: (context, child) => Opacity(
        opacity: _c.value,
        child: Transform.translate(offset: Offset(0, widget.dy * (1 - Curves.easeOut.transform(_c.value))), child: child),
      ),
      child: widget.child,
    );
  }
}
