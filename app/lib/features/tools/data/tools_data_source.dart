// Ported from: the `supabase.from(table).select('*')…` reads of src/hooks/useDynamicTools.ts,
//              src/hooks/useDynamicConfig.ts and src/hooks/useDynamicContent.ts
//
// One read shape covers every hook of the three files: equality filters, `or(...)`, `is null` / `not is null`,
// and an ordered list of `order(...)` calls. Tests replace [toolsDataSourceProvider] with a fake.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';

/// `supabase.from(table).select('*')` + filters, as data.
@immutable
class TableQuery {
  const TableQuery(this.table, {this.eq = const {}, this.or, this.isNull = const [], this.notNull = const [], this.order = const []});

  final String table;

  /// `.eq(column, value)` in insertion order.
  final Map<String, Object> eq;

  /// `.or(filter)`.
  final String? or;

  /// `.is(column, null)`.
  final List<String> isNull;

  /// `.not(column, 'is', null)`.
  final List<String> notNull;


  final List<({String column, bool ascending})> order;

  @override
  String toString() => 'TableQuery($table, eq: $eq, or: $or, isNull: $isNull, notNull: $notNull, order: $order)';
}

abstract interface class ToolsDataSource {
  /// The rows of [query]; throws the PostgREST error like `if (error) throw error`.
  Future<List<Map<String, dynamic>>> select(TableQuery query);
}

class SupabaseToolsDataSource implements ToolsDataSource {
  SupabaseToolsDataSource(this._db);
  final Db _db;

  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async {
    var q = _db.from(query.table).select();
    query.eq.forEach((column, value) => q = q.eq(column, value));
    if (query.or != null) q = q.or(query.or!);
    for (final c in query.isNull) {
      q = q.isFilter(c, null);
    }
    for (final c in query.notNull) {
      q = q.not(c, 'is', null);
    }
    if (query.order.isEmpty) return asRows(await q);
    var ordered = q.order(query.order.first.column, ascending: query.order.first.ascending, nullsFirst: !query.order.first.ascending);
    for (final o in query.order.skip(1)) {
      ordered = ordered.order(o.column, ascending: o.ascending, nullsFirst: !o.ascending);
    }
    return asRows(await ordered);
  }
}

final toolsDataSourceProvider = Provider<ToolsDataSource>((ref) => SupabaseToolsDataSource(ref.watch(dbProvider)));
