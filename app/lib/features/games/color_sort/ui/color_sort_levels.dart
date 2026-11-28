// Ported from: src/components/games/color-sort/ColorSortLevels.tsx
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_registry.dart' show GameLevelsArgs;
import '../../ui_common/game_widgets.dart' show GameButton;
import '../../ui_common/level_select_grid.dart';
import '../engine/difficulty.dart';
import 'color_sort_text.dart';

class ColorSortLevels extends ConsumerWidget {
  const ColorSortLevels({super.key, required this.args});
  final GameLevelsArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = ref.watch(colorSortTextProvider);
    final levelCount = ref.watch(colorSortLibraryProvider);
    if (text == null) return const SizedBox.shrink();
    final t = text.t, number = text.number;
    final sections = <LevelSection>[];
    for (var start = 1; start <= levelCount;) {
      final end = math.min(levelCount, start <= 30 ? start + 5 : start + levelPackSize - 1);
      sections.add(LevelSection(
        label: '${t('difficulty_${getLevelProfile(start).difficulty}')} · ${number(start)}–${number(end)}',
        levels: [for (var level = start; level <= end; level++) level],
      ));
      start = end + 1;
    }
    final dark = AnacanTokens.of(context).isDark;
    return GameLevelSelectGrid(
      title: t('title'),
      subtitle: t('choose_level'),
      icon: AIcons.flaskConical,
      sections: sections,
      progress: args.progress,
      isLevelUnlocked: args.isLevelUnlocked,
      onSelectLevel: args.onSelectLevel,
      onBack: args.onBack,
      bestScoreLabel: t('best_score'),
      unlockedLabel: t('unlocked'),
      totalLevels: levelCount,
      accentColors: const [TwColors.cyan500, TwColors.teal600],
      levelLabel: (level) => t('level', {'level': level}),
      backLabel: t('back'),
      footer: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: dark ? TwColors.cyan950.withValues(alpha: 0.3) : TwColors.cyan50,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: dark ? TwColors.cyan900 : TwColors.cyan200),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Semantics(
              liveRegion: true,
              child: Text(t('available_levels', {'count': levelCount}),
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: dark ? TwColors.cyan100 : TwColors.cyan900)),
            ),
          ),
          if (levelCount < maxLevelCount)
            GameButton(
              key: const ValueKey('colorsort-add-levels'),
              pressScale: 0.98,
              onTap: ref.read(colorSortLibraryProvider.notifier).addLevels,
              child: Container(
                constraints: const BoxConstraints(minHeight: 48),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: TwColors.teal600, borderRadius: BorderRadius.circular(24)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const AIcon(AIcons.plus, size: 18, color: Color(0xFFFFFFFF)),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(t('add_levels', {'count': math.min(levelPackSize, maxLevelCount - levelCount)}),
                        textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFFFFFFFF))),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
