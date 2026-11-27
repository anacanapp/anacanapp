// Ported from: src/hooks/useWeightEntries.ts, the supabase calls of src/components/tools/WeightTracker.tsx
//              (dr-anacan-chat weight analysis, profiles.height_cm via src/lib/profileHeight.ts)
//
// New entries go through the offline outbox (`weight_entries`, client uuid, idempotent replay) and show at once
// (optimistic while queued, confirmed when saved); a background flush that delivered `weight_entries` refetches.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException, PostgrestException, SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/dates/local_date.dart';

@immutable
class WeightEntry {
  const WeightEntry({required this.id, required this.userId, required this.weight, required this.entryDate, this.notes, required this.createdAt});
  final String id;
  final String userId;
  final num weight;
  final String entryDate;
  final String? notes;
  final String createdAt;

  factory WeightEntry.fromRow(Map<String, dynamic> r) => WeightEntry(
        id: '${r['id'] ?? ''}',
        userId: '${r['user_id'] ?? ''}',
        weight: r['weight'] is num ? r['weight'] as num : num.tryParse('${r['weight']}') ?? 0,
        entryDate: '${r['entry_date'] ?? ''}',
        notes: r['notes'] as String?,
        createdAt: '${r['created_at'] ?? r['entry_date'] ?? ''}',
      );
}

abstract interface class WeightRepository {
  /// `select('*').eq('user_id').order('entry_date', desc).limit(100)`.
  Future<List<Map<String, dynamic>>> load(String userId);
  Future<void> delete(String id, String userId);
  Future<void> deleteAll(String userId);

  /// `functions.invoke('dr-anacan-chat', { body })` → `{ data, error }`.
  Future<({Object? data, Object? error})> invokeAdvice(Map<String, Object?> body);

  /// `from(table).update(values).eq(column, value)` → the error (null = ok).
  Future<Object?> update(String table, Map<String, Object?> values, String column, String value);
}

class SupabaseWeightRepository implements WeightRepository {
  SupabaseWeightRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async {
    final data = await _client().from('weight_entries').select().eq('user_id', userId).order('entry_date', ascending: false).limit(100);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<void> delete(String id, String userId) => _client().from('weight_entries').delete().eq('id', id).eq('user_id', userId);

  @override
  Future<void> deleteAll(String userId) => _client().from('weight_entries').delete().eq('user_id', userId);

  @override
  Future<({Object? data, Object? error})> invokeAdvice(Map<String, Object?> body) async {
    try {
      final res = await _client().functions.invoke('dr-anacan-chat', body: body);
      return (data: res.data, error: null);
    } on FunctionException catch (e) {
      return (data: null, error: e);
    } catch (e) {
      return (data: null, error: e);
    }
  }

  @override
  Future<Object?> update(String table, Map<String, Object?> values, String column, String value) async {
    try {
      await _client().from(table).update(values).eq(column, value);
      return null;
    } on PostgrestException catch (e) {
      return e;
    }
  }
}

final weightRepositoryProvider = Provider<WeightRepository>((ref) => SupabaseWeightRepository(() => ref.read(supabaseClientProvider)));

typedef WeightToast = void Function({required String title, String? description, bool destructive});

@immutable
class WeightEntriesState {
  const WeightEntriesState({this.entries = const [], this.loading = true});
  final List<WeightEntry> entries;
  final bool loading;
}

@immutable
class WeightStats {
  const WeightStats({required this.startWeight, required this.currentWeight, required this.totalGain, required this.entryCount});
  final num startWeight;
  final num currentWeight;
  final num totalGain;
  final int entryCount;
}

class WeightEntriesController extends Notifier<WeightEntriesState> {
  String? get _uid => ref.read(authUserProvider)?.id;
  WeightRepository get _repo => ref.read(weightRepositoryProvider);

  @override
  WeightEntriesState build() {
    final uid = ref.watch(authUserProvider)?.id;
    if (uid == null) return const WeightEntriesState();
    final outbox = ref.watch(offlineOutboxProvider);
    final unsubscribe = outbox.subscribe((event) {
      if (event.userId == uid && event.sentTables.contains('weight_entries')) unawaited(fetch());
    });
    final release = outbox.retainUser(uid);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
    Future.microtask(() {
      if (ref.mounted) unawaited(fetch());
    });
    return const WeightEntriesState();
  }

  Future<void> fetch() async {
    final uid = _uid;
    if (uid == null) return;
    try {
      final rows = await _repo.load(uid);
      if (ref.mounted) state = WeightEntriesState(entries: [for (final r in rows) WeightEntry.fromRow(r)], loading: false);
    } catch (e) {
      debugPrint('Error fetching weight entries: $e');
      if (ref.mounted) state = WeightEntriesState(entries: state.entries, loading: false);
    }
  }

  Future<WeightEntry?> addEntry(num weight, {String? notes, required WeightToast toast}) async {
    final uid = _uid;
    if (uid == null) return null;
    final outcome = await ref.read(offlineOutboxProvider).saveWithOutbox(uid, 'weight_entries', {
      'user_id': uid,
      'weight': weight,
      'notes': (notes == null || notes.isEmpty) ? null : notes,
      'entry_date': todayKey(),
    });
    if (outcome.status == SaveStatus.error) {
      debugPrint('Error adding weight entry: ${outcome.error}');
      toast(title: tr('useweightentries_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: _message(outcome.error), destructive: true);
      return null;
    }
    final saved = WeightEntry.fromRow(Map<String, dynamic>.from(outcome.data!));
    if (ref.mounted) {
      state = WeightEntriesState(entries: [saved, ...state.entries.where((e) => e.id != saved.id)], loading: state.loading);
    }
    toast(title: tr('useweightentries_ceki_yadda_saxlandi_f56b5a', 'Çəki yadda saxlandı! ⚖️'), description: '$weight kg');
    if (outcome.status == SaveStatus.saved) unawaited(fetch());
    return saved;
  }

  Future<void> deleteEntry(String entryId, {required WeightToast toast}) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.delete(entryId, uid);
      if (ref.mounted) state = WeightEntriesState(entries: state.entries.where((e) => e.id != entryId).toList(), loading: state.loading);
      toast(title: 'Silindi', description: tr('useweightentries_ceki_qeydi_silindi_d9e1c4', 'Çəki qeydi silindi'));
    } catch (e) {
      debugPrint('Error deleting weight entry: $e');
      toast(title: tr('useweightentries_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: _message(e), destructive: true);
    }
  }

  Future<void> deleteAllEntries({required WeightToast toast}) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.deleteAll(uid);
      if (ref.mounted) state = WeightEntriesState(entries: const [], loading: state.loading);
      toast(
        title: tr('useweightentries_sifirlandi_edc3d3', 'Sıfırlandı'),
        description: tr('useweightentries_butun_ceki_qeydleri_silindi_9918ff', 'Bütün çəki qeydləri silindi'),
      );
    } catch (e) {
      debugPrint('Error deleting all weight entries: $e');
      toast(title: tr('useweightentries_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: _message(e), destructive: true);
    }
  }

  static String? _message(Object? error) {
    if (error is Map && error['message'] is String) return error['message'] as String;
    if (error is PostgrestException) return error.message;
    return null;
  }
}

final weightEntriesProvider = NotifierProvider.autoDispose<WeightEntriesController, WeightEntriesState>(WeightEntriesController.new);

/// `getStats()`: start = profile start weight or the oldest entry; current = the newest entry.
WeightStats? weightStatsOf(List<WeightEntry> entries, num? profileStartWeight) {
  if (entries.isEmpty) return null;
  final first = entries.last.weight;
  final start = (profileStartWeight != null && profileStartWeight != 0) ? profileStartWeight : first;
  final current = entries.first.weight != 0 ? entries.first.weight : start;
  return WeightStats(startWeight: start, currentWeight: current, totalGain: current - start, entryCount: entries.length);
}
