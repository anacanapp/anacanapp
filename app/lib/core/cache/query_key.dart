// Ported from: node_modules/@tanstack/query-core (utils.ts: hashKey, partialMatchKey, partialDeepEqual),
// as used by every `queryKey: [...]` in src/hooks.
//
// A query key is a JSON-like list (`['illness-entries', userId, episodeId]`). The hash is the
// TanStack one: JSON with object keys sorted, so `{a:1,b:2}` and `{b:2,a:1}` hit the same query.

import 'dart:convert';

typedef QueryKey = List<Object?>;

Object? _stable(Object? value) {
  if (value is Map) {
    final entries = value.entries.toList()..sort((a, b) => a.key.toString().compareTo(b.key.toString()));
    return {for (final e in entries) e.key.toString(): _stable(e.value)};
  }
  if (value is Iterable) return value.map(_stable).toList();
  if (value == null || value is num || value is String || value is bool) return value;
  if (value is DateTime) return value.toUtc().toIso8601String();
  return value.toString();
}

/// `hashKey(queryKey)`: stable JSON.
String hashQueryKey(QueryKey key) => jsonEncode(_stable(key));

/// `partialDeepEqual(a, b)`: every part of [b] is present (deeply) in [a]. Lists compare by index,
/// so `['a']` matches `['a', 1]` (prefix match) like TanStack.
bool partialDeepEqual(Object? a, Object? b) {
  if (identical(a, b) || a == b) return true;
  if (a is List && b is List) {
    if (b.length > a.length) return false;
    for (var i = 0; i < b.length; i++) {
      if (!partialDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (a is Map && b is Map) {
    for (final key in b.keys) {
      if (!a.containsKey(key) || !partialDeepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  if (a is num && b is num) return a == b;
  return false;
}

/// `partialMatchKey(queryKey, filterKey)`.
bool partialMatchKey(QueryKey queryKey, QueryKey filterKey) => partialDeepEqual(queryKey, filterKey);
