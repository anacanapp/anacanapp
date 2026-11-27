// Ported from: the `supabase.from(table)…` / `supabase.functions.invoke(…)` calls of the health tools
//              (src/hooks/{useMentalHealth,useMentalHealthData,useBloodPressure,useVitamins,useVitaminSchedules,
//              useMealLogs,useExerciseLogs,useShoppingItems,useDefaultShoppingItems,useProviderReviews,useFirstAid}.ts,
//              src/components/tools/{BloodSugarTracker,VitaminTracker,DoctorsHospitals,Nutrition}.tsx)
//
// One data shape for every PostgREST call these tools make (filters, order, limit, insert / upsert / update /
// delete with `.select()`), so tests replace a single provider with an in-memory fake.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';

/// One filter: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`.
typedef HFilter = ({String column, String op, Object? value});

HFilter eqF(String column, Object? value) => (column: column, op: 'eq', value: value);
HFilter gteF(String column, Object? value) => (column: column, op: 'gte', value: value);
HFilter gtF(String column, Object? value) => (column: column, op: 'gt', value: value);
HFilter inF(String column, List<Object?> values) => (column: column, op: 'in', value: values);

/// `from(table).select(columns)` + filters + order + limit.
@immutable
class HQuery {
  const HQuery(this.table, {this.columns = '*', this.filters = const [], this.order = const [], this.limit});
  final String table;
  final String columns;
  final List<HFilter> filters;
  final List<({String column, bool ascending})> order;
  final int? limit;

  @override
  String toString() => 'HQuery($table, $columns, $filters, $order, $limit)';
}

abstract interface class HealthDb {
  /// The rows; throws the PostgREST error (`if (error) throw error`).
  Future<Rows> select(HQuery query);

  /// `.maybeSingle()`.
  Future<Row?> maybeSingle(HQuery query);

  /// `.insert(row).select().single()`.
  Future<Row> insert(String table, Row row);

  /// `.upsert(row, { onConflict }).select().single()`.
  Future<Row> upsert(String table, Row row, {required String onConflict});

  /// `.update(patch)` + filters (`.select().single()` when [single]).
  Future<Row?> update(String table, Row patch, List<HFilter> filters, {bool single = false});

  /// `.delete()` + filters.
  Future<void> delete(String table, List<HFilter> filters);

  /// `functions.invoke(name, { body })` as `{data, error}`.
  Future<DbResult<Object?>> invoke(String name, {Object? body});
}

class SupabaseHealthDb implements HealthDb {
  SupabaseHealthDb(this._db);
  final Db _db;

  dynamic _filtered(dynamic q, List<HFilter> filters) {
    for (final f in filters) {
      q = switch (f.op) {
        'eq' => q.eq(f.column, f.value as Object),
        'neq' => q.neq(f.column, f.value as Object),
        'gt' => q.gt(f.column, f.value as Object),
        'gte' => q.gte(f.column, f.value as Object),
        'lt' => q.lt(f.column, f.value as Object),
        'lte' => q.lte(f.column, f.value as Object),
        'in' => q.inFilter(f.column, f.value as List),
        _ => throw ArgumentError('filter ${f.op}'),
      };
    }
    return q;
  }

  dynamic _build(HQuery query) {
    dynamic q = _filtered(_db.from(query.table).select(query.columns), query.filters);
    for (final o in query.order) {
      q = q.order(o.column, ascending: o.ascending);
    }
    if (query.limit != null) q = q.limit(query.limit!);
    return q;
  }

  @override
  Future<Rows> select(HQuery query) async => asRows(await _build(query));

  @override
  Future<Row?> maybeSingle(HQuery query) async => asRow(await _build(query).maybeSingle());

  @override
  Future<Row> insert(String table, Row row) async => asRow(await _db.from(table).insert(row).select().single()) ?? <String, dynamic>{};

  @override
  Future<Row> upsert(String table, Row row, {required String onConflict}) async =>
      asRow(await _db.from(table).upsert(row, onConflict: onConflict).select().single()) ?? <String, dynamic>{};

  @override
  Future<Row?> update(String table, Row patch, List<HFilter> filters, {bool single = false}) async {
    final dynamic q = _filtered(_db.from(table).update(patch), filters);
    if (single) return asRow(await q.select().single());
    await q;
    return null;
  }

  @override
  Future<void> delete(String table, List<HFilter> filters) async {
    await _filtered(_db.from(table).delete(), filters);
  }

  @override
  Future<DbResult<Object?>> invoke(String name, {Object? body}) => _db.invoke(name, body: body);
}

final healthDbProvider = Provider<HealthDb>((ref) => SupabaseHealthDb(ref.watch(dbProvider)));
