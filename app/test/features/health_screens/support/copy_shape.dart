// Ported from: src/lib/care-features.test.ts (`shape` / `placeholders` helpers of the 'feature copy' suite)
import 'package:flutter_test/flutter_test.dart';

Object? shapeOf(Object? value) {
  if (value is List) return [for (final v in value) shapeOf(v)];
  if (value is Map) return {for (final e in value.entries) e.key: shapeOf(e.value)};
  return value.runtimeType.toString();
}

List<String> placeholdersOf(Object? value, [List<String>? out]) {
  final list = out ?? <String>[];
  if (value is String) {
    list.addAll([for (final m in RegExp(r'\{\w+\}').allMatches(value)) m[0]!]..sort());
  } else if (value is Map) {
    for (final v in value.values) {
      placeholdersOf(v, list);
    }
  } else if (value is List) {
    for (final v in value) {
      placeholdersOf(v, list);
    }
  }
  return list;
}

/// 25 language files, every one with az's shape and placeholders.
void expectSameShape(Map<String, Map<String, Object?>> table) {
  expect(table.length, 25);
  final az = table['az']!;
  for (final e in table.entries) {
    expect(shapeOf(e.value), shapeOf(az), reason: e.key);
    expect(placeholdersOf(e.value), placeholdersOf(az), reason: e.key);
  }
}
