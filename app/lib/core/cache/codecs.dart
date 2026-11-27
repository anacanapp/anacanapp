// Ported from: (no React counterpart) — JSON.parse of the persisted react-query cache gives plain
// JSON; these codecs give restored data its Dart type again.

import 'query_client.dart';

Map<String, dynamic> _row(Object? value) => Map<String, dynamic>.from(value as Map);

/// Codecs for the common shapes of Supabase results.
abstract final class QueryCodecs {
  /// `List<Map<String, dynamic>>` (a `select()` result).
  static final QueryDataCodec<List<Map<String, dynamic>>> rows = QueryDataCodec(
    toJson: (rows) => rows,
    fromJson: (json) => (json as List).map(_row).toList(),
  );

  /// `Map<String, dynamic>` (`maybeSingle()` / `single()` result).
  static final QueryDataCodec<Map<String, dynamic>> row = QueryDataCodec(toJson: (row) => row, fromJson: _row);

  /// Nullable row (`maybeSingle()`).
  static final QueryDataCodec<Map<String, dynamic>?> maybeRow =
      QueryDataCodec(toJson: (row) => row, fromJson: (json) => json == null ? null : _row(json));

  /// A model with `toJson()` and a `fromJson` factory.
  static QueryDataCodec<T> model<T>(Map<String, dynamic> Function(T value) toJson, T Function(Map<String, dynamic>) fromJson) =>
      QueryDataCodec(toJson: toJson, fromJson: (json) => fromJson(_row(json)));

  /// A list of models.
  static QueryDataCodec<List<T>> models<T>(
          Map<String, dynamic> Function(T value) toJson, T Function(Map<String, dynamic>) fromJson) =>
      QueryDataCodec(
        toJson: (list) => list.map(toJson).toList(),
        fromJson: (json) => (json as List).map((e) => fromJson(_row(e))).toList(),
      );
}
