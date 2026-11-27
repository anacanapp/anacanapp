// Ported from: src/hooks/useHospitalBagSync.ts, src/hooks/useHospitalBag.ts
//
// Shared data layer of the hospital bag for the owner (the mother, her own rows) and her linked partner (the same
// rows through the partner RLS policies). Changes from the other phone arrive through Realtime: INSERT / UPDATE
// filtered by the owner's user_id, DELETE matched by row id (Realtime does not filter deletes). The list is also
// refetched when the app comes back to the foreground.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/data/realtime.dart';
import '../../../core/net/backend_providers.dart';
import '../../../core/offline/offline.dart' show appResumeEventsProvider, newClientId;
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../data/data.dart' show hospitalBagTemplatesQuery;
import 'hospital_bag_logic.dart';

/// 'owner' | 'partner'
typedef BagRole = String;

abstract interface class HospitalBagRepository {
  /// `select('*').eq('user_id', owner).order('item_id')`.
  Future<List<BagRow>> load(String ownerUserId);

  /// `upsert(rows, { onConflict: 'user_id,item_id', ignoreDuplicates }).select()` → inserted rows, or the error.
  Future<({List<BagRow>? rows, Object? error})> upsert(List<Map<String, Object?>> rows, {required bool ignoreDuplicates});

  /// `insert(row).select().single()`.
  Future<({BagRow? row, Object? error})> insert(Map<String, Object?> row);

  /// `update(values).eq('user_id', owner).eq('item_id', itemId)` → the error (null = ok).
  Future<Object?> update(String ownerUserId, String itemId, Map<String, Object?> values);

  /// `delete().eq('user_id', owner).eq('item_id', itemId)` → the error (null = ok).
  Future<Object?> delete(String ownerUserId, String itemId);

  /// INSERT / UPDATE for the owner, DELETE (unfiltered, with the old row id); removed with [ref].
  void watch(Ref ref, String ownerUserId, String role, {required void Function() onChange, required void Function(String? id) onDelete});
}

class SupabaseHospitalBagRepository implements HospitalBagRepository {
  SupabaseHospitalBagRepository(this._client);
  final SupabaseClient Function() _client;

  static const _table = 'hospital_bag_items';

  @override
  Future<List<BagRow>> load(String ownerUserId) async {
    final data = await _client().from(_table).select().eq('user_id', ownerUserId).order('item_id');
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<({List<BagRow>? rows, Object? error})> upsert(List<Map<String, Object?>> rows, {required bool ignoreDuplicates}) async {
    try {
      final data = await _client().from(_table).upsert(rows, onConflict: 'user_id,item_id', ignoreDuplicates: ignoreDuplicates).select();
      return (rows: [for (final r in data) Map<String, dynamic>.from(r)], error: null);
    } on PostgrestException catch (e) {
      return (rows: null, error: e);
    }
  }

  @override
  Future<({BagRow? row, Object? error})> insert(Map<String, Object?> row) async {
    try {
      final data = await _client().from(_table).insert(row).select().single();
      return (row: Map<String, dynamic>.from(data), error: null);
    } on PostgrestException catch (e) {
      return (row: null, error: e);
    }
  }

  @override
  Future<Object?> update(String ownerUserId, String itemId, Map<String, Object?> values) async {
    try {
      await _client().from(_table).update(values).eq('user_id', ownerUserId).eq('item_id', itemId);
      return null;
    } on PostgrestException catch (e) {
      return e;
    }
  }

  @override
  Future<Object?> delete(String ownerUserId, String itemId) async {
    try {
      await _client().from(_table).delete().eq('user_id', ownerUserId).eq('item_id', itemId);
      return null;
    } on PostgrestException catch (e) {
      return e;
    }
  }

  @override
  void watch(Ref ref, String ownerUserId, String role, {required void Function() onChange, required void Function(String? id) onDelete}) {
    final client = _client();
    final prefix = 'hospital_bag_items_changes:$role';
    subscribePostgresChanges(ref, client, channelPrefix: prefix, table: _table, event: 'INSERT', filter: 'user_id=eq.$ownerUserId', onChange: (_) => onChange());
    subscribePostgresChanges(ref, client, channelPrefix: prefix, table: _table, event: 'UPDATE', filter: 'user_id=eq.$ownerUserId', onChange: (_) => onChange());
    subscribePostgresChanges(ref, client, channelPrefix: prefix, table: _table, event: 'DELETE', onChange: (p) => onDelete(p.oldRecord['id'] as String?));
  }
}

final hospitalBagRepositoryProvider =
    Provider<HospitalBagRepository>((ref) => SupabaseHospitalBagRepository(() => ref.read(supabaseClientProvider)));

class HospitalBagState {
  HospitalBagState({this.rows = const [], this.loading = true, this.localHidden = const [], this.templates = const [], this.role = 'owner'});
  final List<BagRow> rows;
  final bool loading;
  final List<String> localHidden;
  final List<BagTemplate> templates;
  final BagRole role;

  HospitalBagState copyWith({List<BagRow>? rows, bool? loading, List<String>? localHidden, List<BagTemplate>? templates}) => HospitalBagState(
        rows: rows ?? this.rows,
        loading: loading ?? this.loading,
        localHidden: localHidden ?? this.localHidden,
        templates: templates ?? this.templates,
        role: role,
      );

  late final List<BagItem> items = mergeBagItems(rows, templates, localHidden: localHidden, includeMissingTemplates: role == 'owner');
  late final ({int checked, int total, double progress}) counts = bagCounts(items);
}

typedef HospitalBagArgs = ({String? owner, String role});

class HospitalBagController extends Notifier<HospitalBagState> {
  HospitalBagController(this.args);
  final HospitalBagArgs args;

  /// null = unknown; false after a "column does not exist" / check-violation answer (migration not applied).
  bool? _hiddenColumn;
  bool? _partnerCategory;
  int _fetchSeq = 0;
  bool _seeding = false;

  String? get _owner => args.owner;
  HospitalBagRepository get _repo => ref.read(hospitalBagRepositoryProvider);
  LocalStore get _store => ref.read(localStoreProvider);

  @override
  HospitalBagState build() {
    final owner = args.owner;
    final templatesQuery = ref.watch(hospitalBagTemplatesQuery);
    final templates = templatesQuery.data ?? const <BagTemplate>[];
    final signedIn = ref.watch(authUserProvider) != null;
    final ready = signedIn && !templatesQuery.isLoading;
    final initial = HospitalBagState(
      role: args.role,
      templates: templates,
      localHidden: owner == null ? const [] : readLocalHidden(ref.read(localStoreProvider), owner),
      loading: true,
    );
    if (ready) {
      Future.microtask(() {
        if (ref.mounted) unawaited(fetch());
      });
      if (owner != null) {
        _repo.watch(ref, owner, args.role, onChange: () => unawaited(fetch()), onDelete: (id) {
          if (id != null && state.rows.any((r) => r['id'] == id)) state = state.copyWith(rows: state.rows.where((r) => r['id'] != id).toList());
        });
        final sub = ref.watch(appResumeEventsProvider).listen((_) => unawaited(fetch()));
        ref.onDispose(sub.cancel);
      }
    }
    return initial;
  }

  Future<void> fetch() async {
    final owner = _owner;
    if (owner == null) {
      state = state.copyWith(rows: const [], loading: false);
      return;
    }
    final seq = ++_fetchSeq;
    try {
      var next = await _repo.load(owner);
      if (!ref.mounted || seq != _fetchSeq) return;
      if (next.isNotEmpty && _hiddenColumn == null) _hiddenColumn = next[0].containsKey('is_hidden');
      final templates = state.templates;
      // The owner keeps one row per default item so the partner sees the same list (new templates included).
      if (args.role == 'owner' && templates.isNotEmpty && !_seeding) {
        final missing = missingTemplateRows(next, templates, owner);
        if (missing.isNotEmpty) {
          _seeding = true;
          try {
            final res = await _repo.upsert(missing, ignoreDuplicates: true);
            if (res.error == null && res.rows != null && seq == _fetchSeq) next = [...next, ...res.rows!];
          } finally {
            _seeding = false;
          }
        }
      }
      if (ref.mounted && seq == _fetchSeq) state = state.copyWith(rows: next);
    } catch (e) {
      debugPrint('Error fetching hospital bag items: $e');
    } finally {
      if (ref.mounted && seq == _fetchSeq) state = state.copyWith(loading: false);
    }
  }

  /// The row of an item, created first for a default item that has none yet.
  Future<BagRow?> _ensureRow(String itemId) async {
    final owner = _owner;
    for (final r in state.rows) {
      if (r['item_id'] == itemId) return r;
    }
    if (owner == null) return null;
    final seeds = missingTemplateRows(const [], state.templates.where((t) => t['id'] == itemId).toList(), owner);
    if (seeds.isEmpty) return null;
    final res = await _repo.upsert([seeds.first], ignoreDuplicates: false);
    final data = res.rows?.isNotEmpty == true ? res.rows!.first : null;
    if (res.error != null || data == null) return null;
    if (!state.rows.any((r) => r['item_id'] == itemId)) state = state.copyWith(rows: [...state.rows, data]);
    return data;
  }

  List<BagRow> _patch(String itemId, Map<String, Object?> values) =>
      [for (final r in state.rows) r['item_id'] == itemId ? {...r, ...values} : r];

  Future<void> toggleItem(String itemId) async {
    final owner = _owner;
    if (owner == null) return;
    final row = await _ensureRow(itemId);
    if (row == null) return;
    final current = state.rows.firstWhere((r) => r['item_id'] == itemId, orElse: () => row);
    final next = current['is_checked'] != true;
    state = state.copyWith(rows: _patch(itemId, {'is_checked': next}));
    final error = await _repo.update(owner, itemId, {'is_checked': next});
    if (error != null) {
      debugPrint('Error toggling hospital bag item: $error');
      if (ref.mounted) state = state.copyWith(rows: _patch(itemId, {'is_checked': !next}));
    }
  }

  Future<({BagItem? data, Object? error})> addItem(String name, BagCategory category) async {
    final itemName = cleanItemName(name);
    final owner = _owner;
    if (owner == null) return (data: null, error: 'No bag owner');
    if (itemName.isEmpty) return (data: null, error: 'Empty name');
    final itemId = customItemId(category, newClientId());
    Future<({BagRow? row, Object? error})> insert(BagCategory dbCategory) => _repo.insert({
          'user_id': owner,
          'item_id': itemId,
          'item_name': itemName,
          'category': dbCategory,
          'is_checked': false,
          'priority': 2,
          'added_by': args.role == 'partner' ? 'partner' : 'woman',
        });
    var result = await insert(dbCategoryFor(category, _partnerCategory != false));
    if (result.error != null && category == 'partner' && isCheckViolation(result.error)) {
      _partnerCategory = false;
      result = await insert(dbCategoryFor(category, false));
    }
    final row = result.row;
    if (result.error != null || row == null) {
      debugPrint('Error adding hospital bag item: ${result.error}');
      return (data: null, error: result.error ?? 'Insert failed');
    }
    if (ref.mounted && !state.rows.any((r) => r['id'] == row['id'])) state = state.copyWith(rows: [...state.rows, row]);
    final merged = mergeBagItems([row], const []);
    return (data: merged.isEmpty ? null : merged.first, error: null);
  }

  Future<Object?> deleteItem(String itemId) async {
    final owner = _owner;
    if (owner == null) return 'No bag owner';
    final item = state.items.where((i) => i.itemId == itemId).firstOrNull;
    if (item == null || !item.custom) return 'Only own items can be deleted';
    final before = state.rows;
    state = state.copyWith(rows: state.rows.where((r) => r['item_id'] != itemId).toList());
    final error = await _repo.delete(owner, itemId);
    if (error != null) {
      debugPrint('Error deleting hospital bag item: $error');
      if (ref.mounted) state = state.copyWith(rows: before);
    }
    return error;
  }

  Future<Object?> setHidden(String itemId, bool hidden) async {
    final owner = _owner;
    if (owner == null) return 'No bag owner';
    void rememberOnDevice() {
      final next = toggleHidden(readLocalHidden(_store, owner), itemId, hidden);
      writeLocalHidden(_store, owner, next);
      if (ref.mounted) state = state.copyWith(localHidden: next);
    }

    if (_hiddenColumn == false) {
      rememberOnDevice();
      return null;
    }
    final row = await _ensureRow(itemId);
    if (row == null) {
      rememberOnDevice();
      return null;
    }
    state = state.copyWith(rows: _patch(itemId, {'is_hidden': hidden}));
    final error = await _repo.update(owner, itemId, {'is_hidden': hidden});
    if (error != null && isMissingColumnError(error)) {
      _hiddenColumn = false;
      if (ref.mounted) state = state.copyWith(rows: [for (final r in state.rows) r['item_id'] == itemId ? (Map<String, dynamic>.of(r)..remove('is_hidden')) : r]);
      rememberOnDevice();
      return null;
    }
    if (error != null) {
      debugPrint('Error hiding hospital bag item: $error');
      if (ref.mounted) state = state.copyWith(rows: _patch(itemId, {'is_hidden': !hidden}));
      return error;
    }
    _hiddenColumn = true;
    // A device copy from before the migration is no longer needed for this item.
    if (state.localHidden.contains(itemId) && !hidden) rememberOnDevice();
    return null;
  }
}

final hospitalBagSyncProvider =
    NotifierProvider.autoDispose.family<HospitalBagController, HospitalBagState, HospitalBagArgs>(HospitalBagController.new);

/// `useHospitalBag()`: the mother's own bag.
final hospitalBagProvider = Provider.autoDispose<HospitalBagState>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return ref.watch(hospitalBagSyncProvider((owner: uid, role: 'owner')));
});
