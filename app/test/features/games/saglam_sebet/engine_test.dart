// Ported from: src/components/games/saglam-sebet/levelConfig.ts, src/hooks/useLocalGameProgress.ts, src/lib/game-score-sync.ts
// (fixtures from app/tool/games/entries/saglam-sebet.ts; no vitest suite exists for these files)
import 'dart:convert';

import 'package:anacan/features/games/common/engine/js_json.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/hub/engine/score_submission.dart';
import 'package:anacan/features/games/hub/persistence/local_game_progress.dart';
import 'package:anacan/features/games/saglam_sebet/engine/engine.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

void main() {
  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('saglam_sebet'));

    test('level configs (lerp, Math.round, +toFixed(3)), stars and sections', () {
      final configs = asList(data['configs']);
      for (var i = 0; i < configs.length; i++) {
        expect(getSebetLevelConfig(i - 1).toJson(), configs[i], reason: 'level ${i - 1}');
      }
      for (final raw in asList(data['stars'])) {
        final item = asMap(raw);
        expect(getSebetStarsForScore(item['score'] as num, item['target'] as num), item['value']);
      }
      expect([for (final s in getSebetLevelSections()) {'label': s.label, 'levels': s.levels}], data['sections']);
      final items = asMap(jsonDecode(loadAssetText('assets/games/saglam_sebet/items.json')));
      expect([for (final i in goodItems) {'emoji': i.emoji, 'label': i.label, 'points': i.points}], items['good']);
      expect([for (final i in badItems) {'emoji': i.emoji, 'label': i.label, 'points': i.points}], items['bad']);
    });
  });

  group('Sağlam Səbət loop', () {
    test('spawns on the interval, catches over the basket and drops missed items', () {
      final config = getSebetLevelConfig(1);
      final sim = SebetSimulation(config, random: mulberry32(3));
      expect(sim.step(null, 180).good, isEmpty);
      var caught = 0;
      for (var frame = 0; frame < 60 * 40; frame++) {
        final result = sim.step(1000 / 60, sim.objects.isEmpty ? 180 : sim.objects.first.x);
        caught += result.good.length + result.bad.length;
      }
      expect(caught, greaterThan(10));
      expect(sim.score, greaterThan(0));
      expect(sim.objects.every((o) => o.y <= sim.height + 40), isTrue);
      expect(sim.evaluate(5), sim.lives <= 0 ? isNotNull : isNull);
    });

    test('caps a long frame at 50 ms and evaluates the round at time-up', () {
      final sim = SebetSimulation(getSebetLevelConfig(30), random: mulberry32(9));
      sim.step(5000, 0);
      expect(sim.spawnAccumulator, 50);
      sim.score = sim.config.targetScore * 2;
      expect(sim.evaluate(0), (phase: 'won', stars: 3));
      sim.lives = 0;
      expect(sim.evaluate(10), (phase: 'lost', stars: 0));
    });
  });

  group('local mini-game progress', () {
    test('records best stars/scores monotonically and unlocks only on a pass', () {
      final store = MemoryGameStore();
      var progress = readGameProgress(store, 'birlesdir');
      expect(jsonStringify(progress.json), '{"unlockedLevel":1,"levels":{},"bestScoreOverall":0}');
      progress = recordLevelResult(progress, 1, 900, 2, true);
      progress = recordLevelResult(progress, 1, 700, 3, true);
      progress = recordLevelResult(progress, 2, 300, 0, false);
      progress = recordLevelResult(progress, 10, 50, 1, true);
      writeGameProgress(store, 'birlesdir', progress);
      expect(store.getItem('anacan_minigame_progress_birlesdir'),
          '{"unlockedLevel":11,"levels":{"1":{"stars":3,"bestScore":900},"2":{"stars":0,"bestScore":300},"10":{"stars":1,"bestScore":50}},"bestScoreOverall":900}');
      expect(jsonEquals(readGameProgress(store, 'birlesdir').json, progress.json), isTrue);
      store.setItem('anacan_minigame_progress_color-sort', '{"unlockedLevel":0,"levels":null}');
      expect(jsonStringify(readGameProgress(store, 'color-sort').json), '{"unlockedLevel":1,"levels":{},"bestScoreOverall":0}');
      store.setItem('anacan_minigame_progress_color-sort', 'null');
      expect(readGameProgress(store, 'color-sort').unlockedLevel, 1);
    });

    test('validates leaderboard submissions and receipts like game-score-sync', () {
      expect(validateGameScoreSubmission(userId: null, gameId: 'birlesdir', score: 10, level: 1), 'signin');
      expect(validateGameScoreSubmission(userId: 'u', gameId: 'word-garden', score: 10, level: 1), 'invalid_result');
      expect(validateGameScoreSubmission(userId: 'u', gameId: 'qabarciq', score: 300001, level: 1), 'invalid_result');
      expect(validateGameScoreSubmission(userId: 'u', gameId: 'qabarciq', score: 300000, level: 2), 'invalid_result');
      expect(validateGameScoreSubmission(userId: 'u', gameId: 'color-sort', score: 1.5, level: 2), 'invalid_result');
      expect(validateGameScoreSubmission(userId: 'u', gameId: 'saglam-sebet', score: 900, level: 60), isNull);
      final receipt = {'userId': 'u', 'gameId': 'birlesdir', 'submissionId': 's', 'bestScore': 900, 'bestLevel': 3, 'totalPlays': 1, 'duplicate': false};
      expect(validGameScoreReceipt(receipt, userId: 'u', gameId: 'birlesdir', submissionId: 's', score: 900, level: 3), isTrue);
      expect(validGameScoreReceipt({...receipt, 'bestScore': 899}, userId: 'u', gameId: 'birlesdir', submissionId: 's', score: 900, level: 3), isFalse);
    });
  });
}
