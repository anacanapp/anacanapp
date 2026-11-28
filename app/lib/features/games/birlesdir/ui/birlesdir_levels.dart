// Ported from: src/components/games/birlesdir/BirlesdirLevels.tsx
library;

import 'package:flutter/widgets.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../ui_common/game_registry.dart' show GameLevelsArgs;
import '../../ui_common/level_select_grid.dart';
import '../engine/level_config.dart';

class BirlesdirLevels extends StatelessWidget {
  const BirlesdirLevels({super.key, required this.args});
  final GameLevelsArgs args;

  @override
  Widget build(BuildContext context) => GameLevelSelectGrid(
        title: tr('birlesdir_title', 'Birləşdir'),
        subtitle: tr('birlesdir_choose_level', 'Səviyyə seçin'),
        icon: AIcons.puzzle,
        sections: [for (final section in getBirlesdirLevelSections()) LevelSection(label: section.label, levels: section.levels)],
        progress: args.progress,
        isLevelUnlocked: args.isLevelUnlocked,
        onSelectLevel: args.onSelectLevel,
        onBack: args.onBack,
        bestScoreLabel: tr('birlesdir_best_score_label', 'Ən yaxşı xalınız'),
        unlockedLabel: tr('birlesdir_levels_unlocked_prefix', 'Açılmış səviyyələr'),
        totalLevels: birlesdirTotalLevels,
        accentColors: const [TwColors.violet500, TwColors.fuchsia500],
      );
}
