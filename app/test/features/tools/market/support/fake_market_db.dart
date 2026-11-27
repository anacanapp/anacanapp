// Ported from: the `fakeClient` helper of src/lib/marketSafety.test.ts and the builder fake of
// src/lib/marketInbox.test.ts — a [MarketDb] that records every call in the supabase-js chain order
// (`['from', table]`, `['insert', row]`, `['eq', column, value]`, …) and answers from a result or per-table rows.
import 'dart:typed_data';

import 'package:anacan/features/tools/market/market_db.dart';

class FakeMarketDb implements MarketDb {
  FakeMarketDb({this.result, this.throwOnCall});

  /// Answer of every call when set (`{ data, error }`).
  MarketResult? result;

  /// Thrown by every call when set (a rejected request).
  Object? throwOnCall;

  final List<List<Object?>> calls = [];

  /// Rows per table for selects when [result] is null.
  final Map<String, List<Map<String, dynamic>>> tables = {};

  /// Error per table for inserts when [result] is null.
  final Map<String, MarketDbError> insertErrors = {};
  final List<(String, Map<String, dynamic>)> inserted = [];
  final List<String> uploads = [];

  void _filters(List<HFilter> filters) {
    for (final f in filters) {
      calls.add([f.op, f.column, f.value]);
    }
  }

  MarketResult _answer(MarketResult fallback) {
    final t = throwOnCall;
    if (t != null) throw t;
    return result ?? fallback;
  }

  bool _match(Map<String, dynamic> row, MarketQuery q) {
    for (final f in q.filters) {
      if (f.op == 'eq' && row[f.column] != f.value) return false;
      if (f.op == 'in' && !(f.value! as List).contains(row[f.column])) return false;
    }
    final or = q.or;
    if (or != null) {
      final parts = or.split(',').map((p) => p.split('.')).where((p) => p.length == 3 && p[1] == 'eq');
      if (parts.isNotEmpty && !parts.any((p) => '${row[p[0]]}' == p[2])) return false;
    }
    return true;
  }

  @override
  Future<MarketResult> select(MarketQuery query) async {
    calls.add(['from', query.table]);
    calls.add(['select', query.columns]);
    _filters(query.filters);
    if (query.or != null) calls.add(['or', query.or]);
    if (query.order != null) calls.add(['order', query.order!.column, query.order!.ascending]);
    if (query.limit != null) calls.add(['limit', query.limit]);
    var rows = [for (final r in tables[query.table] ?? const <Map<String, dynamic>>[]) if (_match(r, query)) Map<String, dynamic>.of(r)];
    final o = query.order;
    if (o != null) {
      rows.sort((a, b) => o.ascending ? '${a[o.column]}'.compareTo('${b[o.column]}') : '${b[o.column]}'.compareTo('${a[o.column]}'));
    }
    if (query.limit != null && rows.length > query.limit!) rows = rows.sublist(0, query.limit);
    return _answer(MarketResult(data: rows));
  }

  @override
  Future<MarketResult> insert(String table, Map<String, dynamic> row) async {
    calls.add(['from', table]);
    calls.add(['insert', row]);
    final r = _answer(MarketResult(error: insertErrors[table]));
    if (r.error == null) {
      inserted.add((table, row));
      (tables[table] ??= []).add({'id': '$table-${inserted.length}', 'created_at': '2026-11-27T10:0${inserted.length % 10}:00Z', ...row});
    }
    return r;
  }

  @override
  Future<MarketResult> update(String table, Map<String, dynamic> patch, List<HFilter> filters, {String? or}) async {
    calls.add(['from', table]);
    calls.add(['update', patch]);
    _filters(filters);
    if (or != null) calls.add(['or', or]);
    return _answer(const MarketResult());
  }

  @override
  Future<MarketResult> delete(String table, List<HFilter> filters) async {
    calls.add(['from', table]);
    calls.add(['delete']);
    _filters(filters);
    final r = _answer(const MarketResult());
    if (r.error == null) {
      tables[table]?.removeWhere((row) => filters.every((f) => row[f.column] == f.value));
    }
    return r;
  }

  @override
  Future<Object?> upload(String bucket, String path, Uint8List bytes, String contentType) async {
    uploads.add('$bucket/$path');
    return null;
  }

  @override
  String publicUrl(String bucket, String path) => 'https://cdn.test/$bucket/$path';
}
