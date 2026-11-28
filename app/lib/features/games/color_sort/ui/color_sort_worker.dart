// Ported from: src/components/games/color-sort/workerClient.ts, src/components/games/color-sort/color-sort.worker.ts
//
// Level generation and hint search run off the UI isolate (`Isolate.run` = the module Worker), with the React
// 4.5 s timeout and the same fallbacks: a validated generated level or the permuted offline template, and a hint
// only when it is a legal pour on the current board. Results are cached like `cacheLevel`.
library;

import 'dart:async';
import 'dart:isolate';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../common/persistence/game_store.dart';
import '../../ui_common/game_env.dart';
import '../engine/difficulty.dart';
import '../engine/engine.dart';
import '../engine/generator.dart';
import '../engine/levels.dart';
import '../persistence/storage.dart';

/// The bundled catalog and its raw text (the worker needs the text for its fallback).
class ColorSortBundle {
  const ColorSortBundle(this.catalog, this.text);
  final ColorSortCatalog catalog;
  final String text;
}

/// `assets/games/color_sort/catalog.json` (`BUNDLED_LEVELS`).
final colorSortBundleProvider = FutureProvider<ColorSortBundle>((ref) async {
  final text = await ref.watch(gameAssetTextLoaderProvider)('assets/games/color_sort/catalog.json');
  return ColorSortBundle(ColorSortCatalog.parse(text), text);
});

/// Cancels a pending worker request (`AbortController`).
class ColorSortAbort {
  bool _aborted = false;
  final List<void Function()> _listeners = [];
  bool get aborted => _aborted;
  void abort() {
    if (_aborted) return;
    _aborted = true;
    for (final listener in List.of(_listeners)) {
      listener();
    }
  }

  void _onAbort(void Function() listener) => _listeners.add(listener);
}

/// `loadColorSortLevel` / `requestColorSortHint`.
abstract interface class ColorSortWorker {
  Future<ColorSortLevel> loadLevel(int level, {ColorSortAbort? signal});
  Future<Move?> requestHint(ColorSortLevel definition, Board board, {ColorSortAbort? signal});
}

typedef ColorSortJobRunner = Future<Map<String, Object?>> Function(Map<String, Object?> request);

Future<Map<String, Object?>> _isolateJob(Map<String, Object?> request) => Isolate.run(() => colorSortWorkerJob(request));

class IsolateColorSortWorker implements ColorSortWorker {
  IsolateColorSortWorker({required this.store, required this.bundle, this.run = _isolateJob, this.timeout = const Duration(milliseconds: 4500)});
  final GameStore store;
  final ColorSortBundle bundle;
  final ColorSortJobRunner run;
  final Duration timeout;

  /// `workerRequest`: resolves with [fallback] on abort, timeout or a worker error.
  Future<Map<String, Object?>> _request(Map<String, Object?> message, Map<String, Object?> fallback, ColorSortAbort? signal) {
    if (signal?.aborted ?? false) return Future.value(fallback);
    final completer = Completer<Map<String, Object?>>();
    void finish(Map<String, Object?> value) {
      if (!completer.isCompleted) completer.complete(value);
    }

    final timer = Timer(timeout, () => finish(fallback));
    signal?._onAbort(() => finish(fallback));
    run(message).then(finish, onError: (_) => finish(fallback)).whenComplete(timer.cancel);
    return completer.future.whenComplete(timer.cancel);
  }

  @override
  Future<ColorSortLevel> loadLevel(int input, {ColorSortAbort? signal}) async {
    final level = normalizeLevel(input);
    final cached = getCachedLevel(store, bundle.catalog, level);
    if (cached != null) return cached;
    final fallback = bundle.catalog.fallbackLevel(level);
    final result = await _request({'kind': 'level', 'level': level, 'catalog': bundle.text}, {'level': fallback.toJson()}, signal);
    final raw = result['level'];
    final definition = validateLevelJson(raw, level) ? ColorSortLevel.fromJson((raw as Map).cast()) : fallback;
    if (!(signal?.aborted ?? false)) cacheLevel(store, definition);
    return definition;
  }

  @override
  Future<Move?> requestHint(ColorSortLevel definition, Board board, {ColorSortAbort? signal}) async {
    final known = immediateColorSortHint(definition, board);
    if (known != null) return known;
    final result = await _request({'kind': 'hint', 'board': board, 'rules': definition.rules.toJson()}, const {}, signal);
    return acceptWorkerHint(definition, board, result['move']);
  }
}

/// Null until the catalog is loaded.
final colorSortWorkerProvider = Provider<ColorSortWorker?>((ref) {
  final bundle = ref.watch(colorSortBundleProvider).value;
  return bundle == null ? null : IsolateColorSortWorker(store: ref.watch(gameStoreProvider), bundle: bundle);
});
