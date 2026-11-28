// Ported from: (no vitest for workerClient.ts — checks of the port: cache first, worker result validation,
//              4.5 s timeout / abort fallback, cache write, hint acceptance)
import 'dart:async';
import 'dart:io';

import 'package:anacan/features/games/color_sort/engine/engine.dart';
import 'package:anacan/features/games/color_sort/engine/generator.dart';
import 'package:anacan/features/games/color_sort/engine/levels.dart';
import 'package:anacan/features/games/color_sort/persistence/storage.dart';
import 'package:anacan/features/games/color_sort/ui/color_sort_worker.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:flutter_test/flutter_test.dart';

late ColorSortBundle bundle;

void main() {
  setUpAll(() async {
    final text = await File('assets/games/color_sort/catalog.json').readAsString();
    bundle = ColorSortBundle(ColorSortCatalog.parse(text), text);
  });

  group('Color Sort worker client', () {
    test('returns bundled levels without asking the worker', () async {
      var calls = 0;
      final worker = IsolateColorSortWorker(store: MemoryGameStore(), bundle: bundle, run: (_) async {
        calls++;
        return {};
      });
      final level = await worker.loadLevel(12);
      expect(level.level, 12);
      expect(calls, 0);
    });

    test('validates and caches a generated level, falling back to the permuted template otherwise', () async {
      final store = MemoryGameStore();
      final good = IsolateColorSortWorker(store: store, bundle: bundle, run: (request) async => colorSortWorkerJob(request, timeBudget: false));
      final generated = await good.loadLevel(31);
      expect(validateLevel(generated, 31), isTrue);
      expect(store.getItem('${colorSortCachePrefix}31'), isNotNull);
      final bad = IsolateColorSortWorker(store: MemoryGameStore(), bundle: bundle, run: (_) async => {'level': {'level': 32}});
      final fallback = await bad.loadLevel(32);
      expect(fallback.toJson(), bundle.catalog.fallbackLevel(32).toJson());
    });

    test('falls back when the worker times out and does not cache after an abort', () async {
      expect(IsolateColorSortWorker(store: MemoryGameStore(), bundle: bundle).timeout, const Duration(milliseconds: 4500));
      final worker = IsolateColorSortWorker(
          store: MemoryGameStore(), bundle: bundle, run: (_) => Completer<Map<String, Object?>>().future, timeout: const Duration(milliseconds: 20));
      final result = await worker.loadLevel(40);
      expect(result.toJson(), bundle.catalog.fallbackLevel(40).toJson());
      final abort = ColorSortAbort();
      final aborted = IsolateColorSortWorker(store: MemoryGameStore(), bundle: bundle, run: (_) => Completer<Map<String, Object?>>().future);
      final pending = aborted.loadLevel(41, signal: abort);
      abort.abort();
      final second = await pending;
      expect(second.level, 41);
      expect(aborted.store.getItem('${colorSortCachePrefix}41'), isNull);
    });

    test('uses the authored solution first and accepts only legal worker hints', () async {
      final definition = bundle.catalog.bundled[4];
      final worker = IsolateColorSortWorker(store: MemoryGameStore(), bundle: bundle, run: (_) async => {'move': {'from': 0, 'to': 0}});
      expect(await worker.requestHint(definition, definition.board), definition.solution.first);
      final offPath = pour(definition.board, definition.rules, legalMoves(definition.board, definition.rules).last)!.board;
      final known = knownSolutionMove(definition, offPath);
      if (known == null) expect(await worker.requestHint(definition, offPath), isNull);
    });
  });
}
