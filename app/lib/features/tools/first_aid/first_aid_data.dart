// Ported from: src/hooks/useFirstAid.ts
//
// First aid must work offline in an emergency. All active scenarios and ALL their steps are fetched together for the
// app language and kept in a small dedicated LocalStore entry (`anacan-firstaid-v1`, same JSON as the Capacitor app's
// localStorage, independent of the shared query cache). Every later open reads that entry first, so a scenario never
// opened before still has its steps without network.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Rows, mapRowsTranslation;
import '../../../core/offline/connectivity.dart' show onlineStatusProvider;
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../health_common/health_db.dart';

@immutable
class FirstAidScenario {
  const FirstAidScenario({required this.id, required this.title, this.description, this.icon, this.color, this.emergencyLevel = 'medium'});
  final String id;

  /// Localized display title.
  final String title;
  final String? description;
  final String? icon;
  final String? color;

  /// 'low' | 'medium' | 'high' | 'critical'
  final String emergencyLevel;

  Map<String, Object?> toJson() => {'id': id, 'title': title, 'description': description, 'icon': icon, 'color': color, 'emergency_level': emergencyLevel};

  static FirstAidScenario fromJson(Map<String, dynamic> j) => FirstAidScenario(
        id: '${j['id']}',
        title: '${j['title'] ?? ''}',
        description: j['description'] as String?,
        icon: j['icon'] as String?,
        color: j['color'] as String?,
        emergencyLevel: j['emergency_level'] is String ? j['emergency_level'] as String : 'medium',
      );
}

@immutable
class FirstAidStep {
  const FirstAidStep({required this.id, required this.scenarioId, required this.stepNumber, required this.title, required this.instruction, this.durationSeconds, this.isCritical = false});
  final String id;
  final String scenarioId;
  final num stepNumber;
  final String title;
  final String instruction;
  final num? durationSeconds;
  final bool isCritical;

  Map<String, Object?> toJson() => {
        'id': id,
        'scenario_id': scenarioId,
        'step_number': stepNumber,
        'title': title,
        'instruction': instruction,
        'duration_seconds': durationSeconds,
        'is_critical': isCritical,
      };

  static FirstAidStep fromJson(Map<String, dynamic> j) => FirstAidStep(
        id: '${j['id']}',
        scenarioId: '${j['scenario_id']}',
        stepNumber: (j['step_number'] as num?) ?? 0,
        title: '${j['title'] ?? ''}',
        instruction: '${j['instruction'] ?? ''}',
        durationSeconds: j['duration_seconds'] as num?,
        isCritical: j['is_critical'] == true,
      );
}

@immutable
class FirstAidBundle {
  const FirstAidBundle({required this.language, required this.savedAt, required this.scenarios, required this.stepsByScenario});
  final String language;
  final int savedAt;
  final List<FirstAidScenario> scenarios;
  final Map<String, List<FirstAidStep>> stepsByScenario;

  Map<String, Object?> toJson() => {
        'v': 1,
        'language': language,
        'savedAt': savedAt,
        'scenarios': [for (final s in scenarios) s.toJson()],
        'stepsByScenario': {for (final e in stepsByScenario.entries) e.key: [for (final s in e.value) s.toJson()]},
      };

  /// `isBundle(value)` + decode; null when the shape is not a v1 bundle.
  static FirstAidBundle? tryParse(Object? value) {
    if (value is! Map || value['v'] != 1 || value['language'] is! String || value['scenarios'] is! List || value['stepsByScenario'] is! Map) return null;
    try {
      return FirstAidBundle(
        language: value['language'] as String,
        savedAt: (value['savedAt'] as num?)?.toInt() ?? 0,
        scenarios: [for (final s in value['scenarios'] as List) if (s is Map) FirstAidScenario.fromJson(Map<String, dynamic>.from(s))],
        stepsByScenario: {
          for (final e in (value['stepsByScenario'] as Map).entries)
            '${e.key}': [for (final s in (e.value is List ? e.value as List : const [])) if (s is Map) FirstAidStep.fromJson(Map<String, dynamic>.from(s))],
        },
      );
    } catch (_) {
      return null;
    }
  }
}

const String firstAidCacheKey = 'anacan-firstaid-v1';
const Duration firstAidFresh = Duration(hours: 24);

List<Object?> firstAidQueryKey(String language) => ['first-aid-bundle', language];

/// Cached bundle of any language (the most recently saved one).
FirstAidBundle? readFirstAidCache(LocalStore store) {
  try {
    final raw = store.getItem(firstAidCacheKey);
    if (raw == null || raw.isEmpty) return null;
    return FirstAidBundle.tryParse(jsonDecode(raw));
  } catch (_) {
    return null;
  }
}

void writeFirstAidCache(LocalStore store, FirstAidBundle bundle) {
  try {
    store.setItem(firstAidCacheKey, jsonEncode(bundle.toJson()));
  } catch (_) {
    // storage full / blocked: in-memory query data still works this session
  }
}

/// Builds the compact, language-projected bundle from raw DB rows.
FirstAidBundle buildFirstAidBundle(Rows? scenarioRows, Rows? stepRows, String language, [int? now]) {
  final scenarios = [
    for (final row in mapRowsTranslation(scenarioRows ?? const [], language, const ['title', 'description']))
      FirstAidScenario(
        id: '${row['id']}',
        title: '${row['title'] ?? row['title_az'] ?? ''}',
        description: (row['description'] ?? row['description_az']) as String?,
        icon: row['icon'] as String?,
        color: row['color'] as String?,
        emergencyLevel: row['emergency_level'] is String ? row['emergency_level'] as String : 'medium',
      ),
  ];
  final active = {for (final s in scenarios) s.id};
  final steps = <String, List<FirstAidStep>>{};
  for (final row in mapRowsTranslation(stepRows ?? const [], language, const ['title', 'instruction'])) {
    final scenarioId = '${row['scenario_id']}';
    if (!active.contains(scenarioId)) continue;
    final n = row['step_number'];
    (steps[scenarioId] ??= []).add(FirstAidStep(
      id: '${row['id']}',
      scenarioId: scenarioId,
      stepNumber: n is num ? n : (num.tryParse('$n') ?? 0),
      title: '${row['title'] ?? row['title_az'] ?? ''}',
      instruction: '${row['instruction'] ?? row['instruction_az'] ?? ''}',
      durationSeconds: row['duration_seconds'] as num?,
      isCritical: row['is_critical'] == true,
    ));
  }
  for (final list in steps.values) {
    list.sort((a, b) => a.stepNumber.compareTo(b.stepNumber));
  }
  return FirstAidBundle(language: language, savedAt: now ?? DateTime.now().millisecondsSinceEpoch, scenarios: scenarios, stepsByScenario: steps);
}

/// Network first, cache second: scenarios + all steps in parallel, persisted. When the network fails, the last saved
/// bundle (even in another language: something beats nothing in an emergency) is returned instead.
Future<FirstAidBundle> fetchFirstAidBundle(HealthDb db, LocalStore store, String language) async {
  try {
    final results = await Future.wait([
      db.select(const HQuery('first_aid_scenarios', filters: [(column: 'is_active', op: 'eq', value: true)], order: [(column: 'sort_order', ascending: true)])),
      db.select(const HQuery('first_aid_steps', order: [(column: 'scenario_id', ascending: true), (column: 'step_number', ascending: true)])),
    ]);
    final bundle = buildFirstAidBundle(results[0], results[1], language);
    // An empty response is not worth overwriting good offline content with.
    if (bundle.scenarios.isNotEmpty || readFirstAidCache(store) == null) writeFirstAidCache(store, bundle);
    return bundle;
  } catch (_) {
    final cached = readFirstAidCache(store);
    if (cached != null && cached.scenarios.isNotEmpty) return cached;
    rethrow;
  }
}

QueryOptions<FirstAidBundle> firstAidQueryOptions(HealthDb db, LocalStore store, String language, {bool Function()? isOnline}) {
  final cached = readFirstAidCache(store);
  final initial = cached != null && cached.language == language ? cached : null;
  return QueryOptions<FirstAidBundle>(
    queryKey: firstAidQueryKey(language),
    queryFn: (_) => fetchFirstAidBundle(db, store, language),
    initialData: initial,
    initialDataUpdatedAt: initial?.savedAt,
    staleTime: firstAidFresh,
    // Runs even offline so it can fall back to the cache (or fail fast into the retry state) instead of pausing.
    networkMode: NetworkMode.always,
    retry: (failureCount, _) => failureCount < 2 && (isOnline?.call() ?? true),
    retryDelay: (_, _) => const Duration(milliseconds: 800),
    // Has its own LocalStore entry; not duplicated in the shared persist cache.
    meta: const {'persist': false},
  );
}

/// `useFirstAidContent()`: all scenarios + steps for the app language, cache first.
final firstAidContentQuery = queryProvider<FirstAidBundle>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  return firstAidQueryOptions(ref.watch(healthDbProvider), ref.watch(localStoreProvider), language.isEmpty ? 'az' : language,
      isOnline: () => ref.read(onlineStatusProvider));
}, name: 'firstAidContentQuery');

/// `prefetchFirstAidContent(queryClient, language)`: skips the network when the saved bundle is fresh.
Future<void> prefetchFirstAidContent(QueryClient client, HealthDb db, LocalStore store, String language, {int? now}) {
  final cached = readFirstAidCache(store);
  if (cached != null && cached.language == language && (now ?? DateTime.now().millisecondsSinceEpoch) - cached.savedAt < firstAidFresh.inMilliseconds) {
    return Future.value();
  }
  return client.prefetchQuery(firstAidQueryOptions(db, store, language)).catchError((Object _) {});
}

/// `usePrefetchFirstAid()` for the hub's `ToolsHubSlots.prefetchFirstAid`: warms the offline cache 1.5 s after the
/// hub mounts, unless offline.
void prefetchFirstAid(WidgetRef ref) {
  if (!ref.read(onlineStatusProvider)) return;
  final client = ref.read(queryClientProvider);
  final db = ref.read(healthDbProvider);
  final store = ref.read(localStoreProvider);
  final language = ref.read(userStoreProvider).language;
  Timer(const Duration(milliseconds: 1500), () {
    unawaited(prefetchFirstAidContent(client, db, store, language.isEmpty ? 'az' : language));
  });
}
