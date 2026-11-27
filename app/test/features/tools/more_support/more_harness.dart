// Ported from: (test support) — the baby tools harness (children, local store, user, i18n, toasts, MaterialApp frame
// with unbounded height) plus the seams of the phase 4 "more tools" batch (market, mom map, smart play, play
// together, kid exercises, affiliate).
import 'dart:io';

import 'package:anacan/features/tools/kid_exercises/kid_ex_content.dart';
import 'package:anacan/features/tools/play_together/play_content.dart';
import 'package:anacan/native/purchases/purchase_analytics.dart';
import 'package:anacan/native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import 'package:flutter_riverpod/misc.dart' show Override;

import '../baby_tracker/support/baby_tools_harness.dart';

export '../baby_tracker/support/baby_tools_harness.dart';

/// Reads a bundled asset from `app/` (tests run with `app/` as the working directory).
Future<String> readAppAsset(String assetPath) async => File(assetPath).readAsString();

class MoreToolsHarness extends BabyToolsHarness {
  MoreToolsHarness({super.nowMs, super.babyBirthDate});

  final analytics = RecordingAnalyticsSink();

  /// Extra overrides of one test file (fakes of the tool's backend).
  final List<Override> extra = [];

  List<String> get eventNames => [for (final e in analytics.events) e.$1];

  Map<String, Object?> lastEvent(String name) =>
      analytics.events.lastWhere((e) => e.$1 == name).$2.first! as Map<String, Object?>;

  @override
  List<Override> get toolOverrides => [
        ...super.toolOverrides,
        analyticsSinkProvider.overrideWithValue(analytics),
        kidExAssetLoaderProvider.overrideWithValue(readAppAsset),
        playAssetLoaderProvider.overrideWithValue(readAppAsset),
        ...extra,
      ];
}
