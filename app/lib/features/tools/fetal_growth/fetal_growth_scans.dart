// Ported from: src/hooks/useFetalGrowthScans.ts
//
// Ultrasound estimated fetal weight (EFW) records. Used before birth (no user_children yet), so each baby has a letter
// label (baby_label 'A'…'D') instead of a child id.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../domain/js_compat.dart';

@immutable
class FetalGrowthScan {
  const FetalGrowthScan({required this.id, required this.userId, required this.babyLabel, required this.scanDate, required this.efwGrams, this.notes, required this.createdAt});
  final String id;
  final String userId;
  final String babyLabel;
  final String scanDate;
  final num efwGrams;
  final String? notes;
  final String createdAt;

  factory FetalGrowthScan.fromRow(Map<String, dynamic> r) => FetalGrowthScan(
        id: '${r['id'] ?? ''}',
        userId: '${r['user_id'] ?? ''}',
        babyLabel: '${r['baby_label'] ?? 'A'}',
        scanDate: '${r['scan_date'] ?? ''}',
        efwGrams: (r['efw_grams'] as num?) ?? 0,
        notes: r['notes'] as String?,
        createdAt: '${r['created_at'] ?? ''}',
      );
}

abstract interface class FetalGrowthRepository {
  /// `select('*').eq('user_id').order('scan_date', asc)`.
  Future<List<Map<String, dynamic>>> load(String userId);

  /// `insert(row).select().single()`.
  Future<Map<String, dynamic>> insert(Map<String, Object?> row);

  /// `delete().eq('id').eq('user_id')`.
  Future<void> delete(String id, String userId);
}

class SupabaseFetalGrowthRepository implements FetalGrowthRepository {
  SupabaseFetalGrowthRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async {
    final data = await _client().from('fetal_growth_scans').select().eq('user_id', userId).order('scan_date', ascending: true);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<Map<String, dynamic>> insert(Map<String, Object?> row) async =>
      Map<String, dynamic>.from(await _client().from('fetal_growth_scans').insert(row).select().single());

  @override
  Future<void> delete(String id, String userId) => _client().from('fetal_growth_scans').delete().eq('id', id).eq('user_id', userId);
}

final fetalGrowthRepositoryProvider =
    Provider<FetalGrowthRepository>((ref) => SupabaseFetalGrowthRepository(() => ref.read(supabaseClientProvider)));

typedef FetalToast = void Function({required String title, String? description, bool destructive});

@immutable
class FetalGrowthState {
  const FetalGrowthState({this.scans = const [], this.loading = true});
  final List<FetalGrowthScan> scans;
  final bool loading;
}

String? _message(Object e) => e is PostgrestException ? e.message : e.toString();

int _dateMs(String d) => jsDateParseMs(d) ?? 0;

class FetalGrowthController extends Notifier<FetalGrowthState> {
  String? get _uid => ref.read(authUserProvider)?.id;
  FetalGrowthRepository get _repo => ref.read(fetalGrowthRepositoryProvider);

  @override
  FetalGrowthState build() {
    ref.watch(authUserProvider);
    Future.microtask(() {
      if (ref.mounted) unawaited(fetch());
    });
    return const FetalGrowthState();
  }

  Future<void> fetch() async {
    final uid = _uid;
    if (uid == null) {
      if (ref.mounted) state = FetalGrowthState(scans: state.scans, loading: false);
      return;
    }
    try {
      final rows = await _repo.load(uid);
      if (ref.mounted) state = FetalGrowthState(scans: [for (final r in rows) FetalGrowthScan.fromRow(r)], loading: false);
    } catch (e) {
      debugPrint('Error fetching fetal growth scans: $e');
      if (ref.mounted) state = FetalGrowthState(scans: state.scans, loading: false);
    }
  }

  Future<FetalGrowthScan?> addScan(String babyLabel, String scanDate, int efwGrams, {String? notes, required FetalToast toast}) async {
    final uid = _uid;
    if (uid == null) return null;
    try {
      final row = await _repo.insert({
        'user_id': uid,
        'baby_label': babyLabel,
        'scan_date': scanDate,
        'efw_grams': efwGrams,
        'notes': (notes == null || notes.isEmpty) ? null : notes,
      });
      final scan = FetalGrowthScan.fromRow(row);
      if (ref.mounted) {
        state = FetalGrowthState(
          scans: jsSorted([...state.scans, scan], (FetalGrowthScan a, FetalGrowthScan b) => _dateMs(a.scanDate) - _dateMs(b.scanDate)),
          loading: state.loading,
        );
      }
      toast(title: tr('fetalgrowth_scan_saved', 'USM qeydi yadda saxlandı! 🤰'), description: '$efwGrams q');
      return scan;
    } catch (e) {
      debugPrint('Error adding fetal growth scan: $e');
      toast(title: tr('fetalgrowth_error', 'Xəta baş verdi'), description: _message(e), destructive: true);
      return null;
    }
  }

  Future<void> deleteScan(String scanId, {required FetalToast toast}) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.delete(scanId, uid);
      if (ref.mounted) state = FetalGrowthState(scans: state.scans.where((s) => s.id != scanId).toList(), loading: state.loading);
      toast(title: tr('common_silindi', 'Silindi'));
    } catch (e) {
      debugPrint('Error deleting fetal growth scan: $e');
      toast(title: tr('fetalgrowth_error', 'Xəta baş verdi'), description: _message(e), destructive: true);
    }
  }
}

final fetalGrowthScansProvider = NotifierProvider.autoDispose<FetalGrowthController, FetalGrowthState>(FetalGrowthController.new);
