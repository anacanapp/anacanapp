// Ported from: (TypeScript row typing in src/integrations/supabase/types.ts) — instead of 247 generated
// models, a `Row` map with null-safe typed getters. Per-feature model classes follow the convention
// in README.md (`fromRow` / `toRow`, snake_case keys kept).

import 'dart:convert';

/// One PostgREST row (`select('*')` element).
typedef Row = Map<String, dynamic>;

/// Rows of a `select()`.
typedef Rows = List<Row>;

/// Converts a PostgREST result (`List<dynamic>` of maps) into [Rows].
Rows asRows(Object? value) =>
    value is List ? [for (final e in value) if (e is Map) Map<String, dynamic>.from(e)] : <Row>[];

/// A single row (`maybeSingle()`), or null.
Row? asRow(Object? value) => value is Map ? Map<String, dynamic>.from(value) : null;

/// Null-safe typed reads. Absent keys and wrong types read as null (JS `row.x ?? default` style).
extension RowFields on Map<String, dynamic> {
  String? str(String key) {
    final v = this[key];
    return v is String ? v : null;
  }

  /// Numbers (int, double, or a numeric string as PostgREST returns for `numeric`) → int (truncated).
  int? integer(String key) {
    final v = this[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt();
    return null;
  }

  double? number(String key) {
    final v = this[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  bool? boolean(String key) {
    final v = this[key];
    return v is bool ? v : null;
  }

  /// `timestamptz` / `date` columns. A bare `YYYY-MM-DD` is UTC midnight (`new Date('2026-03-01')`);
  /// use `storedCalendarDate` (state/calendar_utils.dart) for calendar-day semantics.
  DateTime? date(String key) {
    final v = this[key];
    if (v is DateTime) return v;
    if (v is! String || v.isEmpty) return null;
    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v)) {
      final p = v.split('-').map(int.parse).toList();
      return DateTime.utc(p[0], p[1], p[2]);
    }
    return DateTime.tryParse(v);
  }

  /// A `json`/`jsonb` column (already decoded by PostgREST); a JSON string is parsed.
  Object? json(String key) {
    final v = this[key];
    if (v is String) {
      try {
        return jsonDecode(v);
      } catch (_) {
        return v;
      }
    }
    return v;
  }

  Row? row(String key) => asRow(json(key));

  Rows rows(String key) => asRows(json(key));

  List<String> strings(String key) {
    final v = json(key);
    return v is List ? [for (final e in v) if (e is String) e] : const [];
  }
}
