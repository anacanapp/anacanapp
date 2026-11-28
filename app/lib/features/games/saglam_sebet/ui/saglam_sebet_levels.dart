// Ported from: src/components/games/saglam-sebet/SaglamSebetLevels.tsx
library;

import 'package:flutter/widgets.dart';

import '../../../../core/i18n/tr.dart';
import '../../../../design/design.dart';
import '../../ui_common/game_registry.dart' show GameLevelsArgs;
import '../../ui_common/level_select_grid.dart';
import '../engine/engine.dart';

class SaglamSebetLevels extends StatelessWidget {
  const SaglamSebetLevels({super.key, required this.args});
  final GameLevelsArgs args;

  @override
  Widget build(BuildContext context) => GameLevelSelectGrid(
        title: tr('saglamsebet_title', 'Sağlam Səbət'),
        subtitle: tr('saglamsebet_choose_level', 'Səviyyə seçin'),
        icon: AIcons.shoppingBasket,
        sections: [for (final section in getSebetLevelSections()) LevelSection(label: section.label, levels: section.levels)],
        progress: args.progress,
        isLevelUnlocked: args.isLevelUnlocked,
        onSelectLevel: args.onSelectLevel,
        onBack: args.onBack,
        bestScoreLabel: tr('saglamsebet_best_score_label', 'Ən yaxşı xalınız'),
        unlockedLabel: tr('saglamsebet_levels_unlocked_prefix', 'Açılmış səviyyələr'),
        totalLevels: saglamTotalLevels,
        accentColors: const [TwColors.emerald500, TwColors.teal600],
      );
}
