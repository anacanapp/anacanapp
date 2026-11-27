// Ported from: src/components/games/birlesdir/levelConfig.ts, src/components/games/birlesdir/tileDefs.ts
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';

const String birlesdirId = 'birlesdir';
const int birlesdirTotalLevels = 40;
const int boardRows = 8;
const int boardCols = 8;
const int _targetBase = 800, _targetStep = 150;

class BirlesdirLevelConfig {
  const BirlesdirLevelConfig(this.level, this.movesLimit, this.targetScore, this.tileTypesCount, this.tierName, this.scoreMultiplier);
  final int level;
  final int movesLimit;
  final int targetScore;
  final int tileTypesCount;
  final String tierName;
  final double scoreMultiplier;
  Map<String, Object?> toJson() => {
        'level': level, 'movesLimit': movesLimit, 'targetScore': targetScore, 'tileTypesCount': tileTypesCount, 'tierName': tierName,
        'scoreMultiplier': scoreMultiplier,
      };
}

class _Tier {
  const _Tier(this.name, this.minLevel, this.maxLevel, this.movesBase, this.movesStep, this.tileTypesCount, this.scoreMultiplier);
  final String name;
  final int minLevel;
  final int maxLevel;
  final int movesBase;
  final int movesStep;
  final int tileTypesCount;
  final double scoreMultiplier;
}

const List<_Tier> _tiers = [
  _Tier('Asan', 1, 7, 24, 1, 5, 0.47),
  _Tier('Orta', 8, 14, 26, 1, 6, 1.34),
  _Tier('Çətin', 15, 20, 28, 1, 7, 1.94),
  _Tier('Usta', 21, 30, 27, 0, 7, 2.25),
  _Tier('Əfsanə', 31, 40, 25, 0, 7, 2.55),
];

final List<String> birlesdirTierNames = [for (final tier in _tiers) tier.name];

_Tier _tierOf(int level) => _tiers.firstWhere((t) => level >= t.minLevel && level <= t.maxLevel, orElse: () => _tiers.last);

BirlesdirLevelConfig getBirlesdirLevelConfig(int level) {
  final lvl = math.min(math.max(level, 1), birlesdirTotalLevels);
  final tier = _tierOf(lvl);
  return BirlesdirLevelConfig(lvl, tier.movesBase + tier.movesStep * (lvl - tier.minLevel), jsRound(_targetBase + _targetStep * (lvl - 1)),
      tier.tileTypesCount, tier.name, tier.scoreMultiplier);
}

List<({String label, List<int> levels})> getBirlesdirLevelSections() => [
      for (final tier in _tiers) (label: tier.name, levels: [for (var l = tier.minLevel; l <= tier.maxLevel; l++) l]),
    ];

int getBirlesdirStarsForScore(num score, num targetScore) {
  if (score < targetScore) return 0;
  if (score >= targetScore * 1.5) return 3;
  if (score >= targetScore * 1.2) return 2;
  return 1;
}

class TileDef {
  const TileDef(this.type, this.emoji, this.label);
  final int type;
  final String emoji;
  final String label;
}

const List<TileDef> tileDefs = [
  TileDef(0, '☕', 'Qəhvə fincanı'),
  TileDef(1, '🧸', 'Oyuncaq ayı'),
  TileDef(2, '🍼', 'Əmzik'),
  TileDef(3, '🥒', 'Üz maskası'),
  TileDef(4, '🛁', 'İstirahət anı'),
  TileDef(5, '🌸', 'Sakitlik çiçəyi'),
  TileDef(6, '👑', 'Super Ana tacı'),
];

List<TileDef> getTilePool(int typeCount) => tileDefs.sublist(0, math.min(math.max(typeCount, 3), tileDefs.length));

/// Bonus perk names: translation key + Azerbaijani fallback + emoji.
const Map<String, ({String key, String name, String emoji})> bonusNames = {
  'striped-h': (key: 'birlesdir_bonus_striped', name: 'Sakitlik Anı!', emoji: '💫'),
  'striped-v': (key: 'birlesdir_bonus_striped', name: 'Sakitlik Anı!', emoji: '💫'),
  'wrapped': (key: 'birlesdir_bonus_wrapped', name: 'Super Ana!', emoji: '💥'),
  'color-bomb': (key: 'birlesdir_bonus_colorbomb', name: 'Ana Sehri!', emoji: '🌈'),
};
