// Ported from: src/components/games/saglam-sebet/levelConfig.ts, src/components/games/saglam-sebet/SaglamSebetGame.tsx
// (spawnObject, the requestAnimationFrame tick, catch rules and end-of-round evaluation)
//
// The React loop is variable-step (`dt = min(frameDelta, 50 ms)`) and draws from `Math.random()`;
// [SebetSimulation.step] is that tick as a pure function with an injected random source.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';

const String saglamSebetId = 'saglam-sebet';
const int saglamTotalLevels = 60;
const double itemSize = 42, basketWidth = 96, basketHeight = 62, basketBottomMargin = 18;

class GameItemDef {
  const GameItemDef(this.emoji, this.label, this.points);
  final String emoji;
  final String label;
  final int points;
}

const List<GameItemDef> goodItems = [
  GameItemDef('🍎', 'Alma', 10), GameItemDef('🥦', 'Brokoli', 12), GameItemDef('💧', 'Su', 8), GameItemDef('🥛', 'Süd', 10),
  GameItemDef('🥕', 'Yerkökü', 8), GameItemDef('🍊', 'Portağal', 10), GameItemDef('🥑', 'Avokado', 14), GameItemDef('🐟', 'Balıq', 15),
  GameItemDef('🍇', 'Üzüm', 9), GameItemDef('🥗', 'Salat', 12),
];

const List<GameItemDef> badItems = [
  GameItemDef('🍔', 'Fast-food', 0), GameItemDef('🍟', 'Qızarmış kartof', 0), GameItemDef('🥤', 'Qazlı içki', 0), GameItemDef('🍩', 'Donut', 0),
  GameItemDef('🍕', 'Pizza', 0), GameItemDef('🍬', 'Şəkərli konfet', 0), GameItemDef('🌧️', 'Stress buludu', 0), GameItemDef('😪', 'Yuxusuzluq', 0),
];

class SebetLevelConfig {
  const SebetLevelConfig({
    required this.level,
    required this.spawnInterval,
    required this.fallSpeed,
    required this.speedVariance,
    required this.badChance,
    required this.lives,
    required this.targetScore,
    required this.duration,
    required this.tierName,
    required this.tierIndex,
  });
  final int level;
  final int spawnInterval;
  final int fallSpeed;
  final double speedVariance;
  final double badChance;
  final int lives;
  final int targetScore;
  final int duration;
  final String tierName;
  final int tierIndex;
  Map<String, Object?> toJson() => {
        'level': level, 'spawnInterval': spawnInterval, 'fallSpeed': fallSpeed, 'speedVariance': speedVariance, 'badChance': badChance,
        'lives': lives, 'targetScore': targetScore, 'duration': duration, 'tierName': tierName, 'tierIndex': tierIndex,
      };
}

class _Tier {
  const _Tier(this.name, this.minLevel, this.maxLevel, this.fall, this.spawn, this.bad, this.duration, this.targetBase, this.targetStep, this.lives);
  final String name;
  final int minLevel;
  final int maxLevel;
  final List<double> fall;
  final List<double> spawn;
  final List<double> bad;
  final List<double> duration;
  final int targetBase;
  final int targetStep;
  final int lives;
}

const List<_Tier> _tiers = [
  _Tier('Rahat', 1, 10, [90, 145], [820, 1000], [0.08, 0.18], [42, 54], 50, 14, 4),
  _Tier('Orta', 11, 20, [145, 195], [620, 800], [0.18, 0.28], [50, 62], 230, 18, 4),
  _Tier('Çətin', 21, 30, [195, 255], [460, 620], [0.28, 0.38], [56, 68], 460, 22, 3),
  _Tier('Ekspert', 31, 40, [255, 330], [320, 460], [0.38, 0.48], [60, 78], 700, 26, 3),
  _Tier('Usta', 41, 50, [330, 400], [280, 400], [0.46, 0.54], [66, 84], 980, 30, 3),
  _Tier('Əfsanə', 51, 60, [400, 480], [240, 340], [0.52, 0.6], [72, 90], 1300, 34, 2),
];

final List<String> sebetTierNames = [for (final tier in _tiers) tier.name];

double _lerp(double a, double b, double t) => a + (b - a) * t;

SebetLevelConfig getSebetLevelConfig(int level) {
  final lvl = math.min(math.max(level, 1), saglamTotalLevels);
  var index = _tiers.indexWhere((t) => lvl >= t.minLevel && lvl <= t.maxLevel);
  if (index == -1) index = _tiers.length - 1;
  final tier = _tiers[index];
  final span = math.max(tier.maxLevel - tier.minLevel, 1);
  final t = (lvl - tier.minLevel) / span;
  return SebetLevelConfig(
    level: lvl,
    spawnInterval: jsRound(_lerp(tier.spawn[0], tier.spawn[1], t)),
    fallSpeed: jsRound(_lerp(tier.fall[0], tier.fall[1], t)),
    speedVariance: 0.22,
    // `+value.toFixed(3)`: Dart's toStringAsFixed uses the same exact-decimal rounding.
    badChance: double.parse(_lerp(tier.bad[0], tier.bad[1], t).toStringAsFixed(3)),
    lives: tier.lives,
    targetScore: jsRound(tier.targetBase + tier.targetStep * (lvl - tier.minLevel)),
    duration: jsRound(_lerp(tier.duration[0], tier.duration[1], t)),
    tierName: tier.name,
    tierIndex: index,
  );
}

List<({String label, List<int> levels})> getSebetLevelSections() => [
      for (final tier in _tiers) (label: tier.name, levels: [for (var l = tier.minLevel; l <= tier.maxLevel; l++) l]),
    ];

int getSebetStarsForScore(num score, num targetScore) {
  if (score < targetScore) return 0;
  if (score >= targetScore * 1.6) return 3;
  if (score >= targetScore * 1.25) return 2;
  return 1;
}

class FallingObject {
  const FallingObject(this.id, this.x, this.y, this.speed, this.def, this.isBad);
  final int id;
  final double x;
  final double y;
  final double speed;
  final GameItemDef def;
  final bool isBad;
  double get size => itemSize;
  FallingObject withY(double y) => FallingObject(id, x, y, speed, def, isBad);
}

/// Pure version of the component's game loop state (objects, spawn accumulator, score, lives).
class SebetSimulation {
  SebetSimulation(this.config, {JsRandom? random, this.width = 360, this.height = 560})
      : random = random ?? math.Random().nextDouble,
        lives = config.lives;
  final SebetLevelConfig config;
  final JsRandom random;
  double width;
  double height;
  List<FallingObject> objects = [];
  double spawnAccumulator = 0;
  int score = 0;
  int lives;
  int _ids = 0;

  FallingObject spawnObject() {
    final isBad = random() < config.badChance;
    final pool = isBad ? badItems : goodItems;
    final def = pool[(random() * pool.length).floor()];
    final x = itemSize + random() * math.max(width - itemSize * 2, 40);
    final variance = 1 + (random() * 2 - 1) * config.speedVariance;
    return FallingObject(++_ids, x, -itemSize, config.fallSpeed * variance, def, isBad);
  }

  /// One animation frame: [frameMs] since the previous frame (null on the first frame → dt 0).
  ({List<FallingObject> good, List<FallingObject> bad}) step(double? frameMs, double basketCenter) {
    final dt = math.min((frameMs ?? 0) / 1000, 0.05);
    spawnAccumulator += dt * 1000;
    if (spawnAccumulator >= config.spawnInterval) {
      spawnAccumulator = 0;
      objects = [...objects, spawnObject()];
    }
    final basketTop = height - basketHeight - basketBottomMargin;
    final good = <FallingObject>[], bad = <FallingObject>[], next = <FallingObject>[];
    for (final obj in objects) {
      final newY = obj.y + obj.speed * dt;
      final centerY = newY + obj.size / 2;
      final inCatchZone = centerY >= basketTop - 6 && centerY <= basketTop + basketHeight * 0.55;
      final withinX = (obj.x - basketCenter).abs() <= basketWidth / 2 + obj.size / 2 - 14;
      if (inCatchZone && withinX) {
        (obj.isBad ? bad : good).add(obj);
        continue;
      }
      if (newY > height + 40) continue;
      next.add(obj.withY(newY));
    }
    objects = next;
    for (final obj in good) {
      score += obj.def.points;
    }
    for (final _ in bad) {
      lives = math.max(0, lives - 1);
    }
    return (good: good, bad: bad);
  }

  /// Win/lose watcher: lives out ends at once; at time-up the score is evaluated against the target.
  ({String phase, int stars})? evaluate(int timeLeft) {
    if (lives <= 0) return (phase: 'lost', stars: 0);
    if (timeLeft <= 0) {
      return score >= config.targetScore ? (phase: 'won', stars: getSebetStarsForScore(score, config.targetScore)) : (phase: 'lost', stars: 0);
    }
    return null;
  }
}
