// Ported from: src/components/games/GameLevelSelectGrid.tsx
//
// Shared level picker of the hub's level games (Sağlam Səbət, Birləşdir, Rəng çeşidləmə): top bar, tier sections
// with a 4-column grid (stars, lock, the next level highlighted), optional footer and the best-score card.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ATopbar, AIconBtn, px;
import '../hub/persistence/local_game_progress.dart' show GameProgress;
import 'game_env.dart';
import 'game_widgets.dart';
import 'tier_labels.dart';

class LevelSection {
  const LevelSection({required this.label, required this.levels});
  final String label;
  final List<int> levels;
}

class GameLevelSelectGrid extends ConsumerWidget {
  const GameLevelSelectGrid({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.sections,
    required this.progress,
    required this.isLevelUnlocked,
    required this.onSelectLevel,
    required this.onBack,
    required this.bestScoreLabel,
    required this.unlockedLabel,
    required this.totalLevels,
    this.accentColors,
    this.footer,
    this.levelLabel,
    this.backLabel,
  });

  final String title;
  final String subtitle;
  final AIconData icon;
  final List<LevelSection> sections;
  final GameProgress progress;
  final bool Function(int level) isLevelUnlocked;
  final ValueChanged<int> onSelectLevel;
  final VoidCallback onBack;
  final String bestScoreLabel;
  final String unlockedLabel;
  final int totalLevels;

  /// `accentGradient` (Tailwind `from-… to-…`), default `from-primary to-orange-500`.
  final List<Color>? accentColors;
  final Widget? footer;

  /// `aria-label` of a level button.
  final String Function(int level)? levelLabel;
  final String? backLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final colors = accentColors ?? [context.tokens.shadcn.primary, TwColors.orange500];
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.only(left: 20, right: 20, bottom: 40),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ATopbar(
              eyebrow: subtitle,
              title: title,
              onBack: onBack,
              backScale: 0.9,
              actions: [AIconBtn(icon: AIcon(icon, size: 16), size: 44, tapScale: 1)],
            ),
            for (var s = 0; s < sections.length; s++) _section(context, ref, sections[s], s, colors),
            ?footer,
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22), boxShadow: a.cardShadow),
              child: Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(12)),
                  alignment: Alignment.center,
                  child: GameStar(size: 17, filled: true, color: a.warnInk, strokeWidth: 2.2),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('$bestScoreLabel: ${_num(progress.bestScoreOverall)}', style: context.aText.aListTitle),
                    Text('$unlockedLabel: ${_num(math.min(progress.unlockedLevel, totalLevels))}/$totalLevels', style: context.aText.aListSub),
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  static String _num(num value) => value == value.truncate() ? '${value.toInt()}' : '$value';

  Widget _section(BuildContext context, WidgetRef ref, LevelSection section, int sectionIndex, List<Color> colors) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(gradient: LinearGradient(colors: colors), borderRadius: BorderRadius.circular(999)),
            child: Text(trTierName(section.label), style: px(11, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 16.5 / 11)),
          ),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: a.lineStrong)),
        ]),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final size = (constraints.maxWidth - 3 * 12) / 4;
          return Wrap(spacing: 12, runSpacing: 12, children: [
            for (final level in section.levels) SizedBox(width: size, height: size, child: _cell(context, ref, level, colors)),
          ]);
        }),
      ]),
    );
  }

  Widget _cell(BuildContext context, WidgetRef ref, int level, List<Color> colors) {
    final a = context.a;
    final unlocked = isLevelUnlocked(level);
    final saved = progress.levels['$level'];
    final stars = saved is Map ? ((saved['stars'] as num?) ?? 0).toInt() : 0;
    final isNext = unlocked && level == progress.unlockedLevel;
    final decoration = !unlocked
        ? BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line))
        : isNext
            ? BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
                borderRadius: BorderRadius.circular(16),
                boxShadow: context.tokens.shadcn.shadowButton,
              )
            : BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line), boxShadow: a.cardShadow);
    final cell = Container(
      decoration: decoration,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: unlocked
          ? [
              Text('$level', style: px(18, weight: FontWeight.w800, color: isNext ? const Color(0xFFFFFFFF) : a.ink, height: 28 / 18)),
              const SizedBox(height: 4),
              Row(mainAxisSize: MainAxisSize.min, children: [
                for (var i = 0; i < 3; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1),
                    child: GameStar(
                      size: 10,
                      filled: i < stars,
                      color: i < stars
                          ? (isNext ? const Color(0xFFFFFFFF) : a.yellow2)
                          : (isNext ? const Color(0x59FFFFFF) : a.lineStrong),
                    ),
                  ),
              ]),
            ]
          : [
              AIcon(AIcons.lock, size: 16, color: a.inkFaint),
              const SizedBox(height: 4),
              Text('$level', style: px(10, weight: FontWeight.w600, color: a.inkFaint, height: 15 / 10)),
            ]),
    );
    return GameButton(
      key: ValueKey('game-level-$level'),
      enabled: unlocked,
      label: levelLabel?.call(level),
      pressScale: unlocked ? 0.93 : null,
      onTap: () {
        if (!unlocked) return;
        ref.read(gameHapticsProvider).light().catchError((_) {});
        onSelectLevel(level);
      },
      child: Opacity(opacity: unlocked ? 1 : 0.55, child: cell),
    );
  }
}

/// `tr('common_back', 'Geri')` default of the back button label.
String gameBackLabel() => tr('common_back', 'Geri');
