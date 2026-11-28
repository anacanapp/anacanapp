// Ported from: src/components/games/word-garden/workerClient.ts, src/components/games/word-garden/word-garden.worker.ts,
//              src/components/games/word-garden/library.ts (loadGardenLexicon)
//
// `loadGardenLevel(language, level, mode, signal, revision, seed)`: the lexicon of the requested revision is read
// from the bundle and the level is generated on a background isolate (React: a Web Worker) with the same 15 s
// timeout. A saved round of an older revision is generated with that revision's library.
library;

import 'dart:async';
import 'dart:isolate';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../common/engine/js.dart' show GameError;
import '../../ui_common/game_env.dart';
import '../engine/generator.dart' show generateGardenLevelJob;
import '../engine/library.dart' show gardenLexiconAsset;
import '../engine/model.dart';

typedef GardenLevelLoader = Future<WordGardenLevel> Function(String language, int level, WordGardenMode mode, {String? revision, int? seed});

final gardenLevelLoaderProvider = Provider<GardenLevelLoader>((ref) {
  final read = ref.watch(gameAssetTextLoaderProvider);
  return (language, level, mode, {revision, seed}) async {
    final target = gardenLexiconAsset(language, revision);
    final text = await read(target.asset);
    final code = target.code;
    final result = await Isolate.run(() => generateGardenLevelJob((lexiconJson: text, language: code, level: level, mode: mode.name, seed: seed)))
        .timeout(const Duration(seconds: 15), onTimeout: () => throw const GameError('WORD_GARDEN_GENERATION_TIMEOUT'));
    final error = result['error'];
    if (error is String) throw GameError(error);
    return WordGardenLevel.fromJson((result['level'] as Map).cast<String, Object?>());
  };
});
