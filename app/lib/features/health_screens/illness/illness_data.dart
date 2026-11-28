// Ported from: src/hooks/useIllness.ts, src/lib/illness.ts (listEpisodes, listEntries, startEpisode, closeEpisode,
//              deleteEpisode, addEntry, deleteEntry, syncDoseReminders), src/data/illness/index.ts (useIllnessText),
//              src/components/illness/useTempUnit.ts
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../home_flow/flow_platform.dart' show FlowNotificationPlanner;
import '../common/feature_text.dart';
import '../common/health_ports.dart';
import 'illness.dart';
import 'illness_text.g.dart';

/// `useIllnessText(language)`.
FeatureText illnessText(String language) => FeatureText.of(kIllnessText, language);

final illnessTextProvider = Provider<FeatureText>((ref) => illnessText(ref.watch(appLanguageProvider)));

List<Map<String, dynamic>> _rows(Object? data) => data is List ? [for (final r in data) if (r is Map) Map<String, dynamic>.from(r)] : const [];

/// `useIllnessEpisodes()`.
final illnessEpisodesQuery = queryProvider<List<IllnessEpisode>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(healthScreensBackendProvider);
  return QueryOptions(
    queryKey: ['illness-episodes', userId],
    enabled: userId != null,
    staleTime: const Duration(seconds: 30),
    refetchOnWindowFocus: RefetchOn.ifStale,
    queryFn: (_) async => [for (final r in _rows(await backend.rpc('illness_episodes_v1', {'p_limit': 20}))) IllnessEpisode.fromRow(r)],
  );
}, name: 'illnessEpisodesQuery');

/// `useIllnessEntries(episodeId)` (newest first, as the RPC returns them).
final illnessEntriesQuery = queryProviderFamily<List<IllnessEntry>, String?>((ref, episodeId) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(healthScreensBackendProvider);
  return QueryOptions(
    queryKey: ['illness-entries', userId, episodeId],
    enabled: userId != null && episodeId != null,
    staleTime: const Duration(seconds: 15),
    refetchOnWindowFocus: RefetchOn.ifStale,
    refetchInterval: const Duration(seconds: 60),
    queryFn: (_) async => [for (final r in _rows(await backend.rpc('illness_entries_v1', {'p_episode': episodeId}))) IllnessEntry.fromRow(r)],
  );
}, name: 'illnessEntriesQuery');

/// `useIllnessActions()`: every write refreshes both lists.
class IllnessActions {
  IllnessActions(this._ref);
  final Ref _ref;
  HealthScreensBackend get _backend => _ref.read(healthScreensBackendProvider);

  void _refresh() {
    final qc = _ref.read(queryClientProvider);
    unawaited(qc.invalidateQueries(queryKey: const ['illness-episodes']));
    unawaited(qc.invalidateQueries(queryKey: const ['illness-entries']));
  }

  Future<T> _write<T>(Future<T> Function() run) async {
    final result = await run();
    _refresh();
    return result;
  }

  /// `startEpisode(kind, childId, childName)` → the new episode id.
  Future<String> start(IllnessKind kind, String? childId, String? childName) => _write(() async =>
      '${await _backend.rpc('illness_episode_start_v1', {'p_kind': kind, 'p_child_id': childId, 'p_child_name': childName})}');

  Future<void> close(String id, bool ended) => _write(() => _backend.rpc('illness_episode_close_v1', {'p_episode': id, 'p_ended': ended}));

  Future<void> remove(String id) => _write(() => _backend.rpc('illness_episode_delete_v1', {'p_episode': id}));

  Future<void> add(String episodeId, Map<String, Object?> entry) =>
      _write(() => _backend.rpc('illness_entry_add_v1', {'p_episode': episodeId, 'p_entry': entry}));

  Future<void> removeEntry(String id) => _write(() => _backend.rpc('illness_entry_delete_v1', {'p_entry': id}));
}

final illnessActionsProvider = Provider<IllnessActions>(IllnessActions.new);

/// `syncDoseReminders(episode, entries, text)`: reminders are a convenience; failures are ignored.
Future<void> syncDoseReminders(
  FlowNotificationPlanner planner,
  IllnessEpisode episode,
  List<IllnessEntry> entries, {
  required String Function(String med) title,
  required String body,
}) async {
  try {
    final plan = doseReminderPlan(episode, entries, title: title, body: body);
    await planner.setLocalNotifications(plan.namespace, plan.due, cancelIds: plan.cancelIds);
  } catch (_) {
    // the screen still shows the next time
  }
}

/// `useTempUnit()`: the °C / °F choice of this device, shared by the screen, its sheets and the home card.
class TempUnitController extends Notifier<TempUnit> {
  @override
  TempUnit build() => readTempUnit(ref.read(localStoreProvider), ref.read(deviceLocaleProvider));

  void set(TempUnit unit) {
    saveTempUnit(ref.read(localStoreProvider), unit);
    state = unit;
  }
}

final tempUnitProvider = NotifierProvider<TempUnitController, TempUnit>(TempUnitController.new);
