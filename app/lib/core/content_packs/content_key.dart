// Ported from: scripts/i18n/content-translation-core.mjs (canonicalContent, contentTranslationKey),
// src/lib/content-packs.ts (canonicalJson, keyBucket)
import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../i18n/generated/intl_data.g.dart';
import '../i18n/js_compat.dart';

/// Reverse of the generated composition pairs: composed letter -> (base, mark).
final Map<int, (int, int)> _decomposition = {
  for (final entry in kNfcPairs.entries) entry.value.codeUnitAt(0): (entry.key.codeUnitAt(0), entry.key.codeUnitAt(entry.key.length - 1)),
};

/// Collation elements of one UTF-16 unit: (primary, secondary, tertiary).
(int, int, int) _element(int unit) {
  var base = unit;
  var secondary = 0;
  // Fully decompose (Vietnamese letters carry two marks).
  while (_decomposition.containsKey(base)) {
    final (next, mark) = _decomposition[base]!;
    secondary = secondary * 1024 + mark;
    base = next;
  }
  if (base >= 0x20 && base <= 0x7e) {
    final isUpper = base >= 0x41 && base <= 0x5a;
    return (kAsciiPrimaryRank[base - 0x20], secondary, isUpper ? 1 : 0);
  }
  // Outside the generated ASCII table: after all ASCII, by code unit (approximation of ICU root).
  return (1000 + base, secondary, 0);
}

/// `a.localeCompare(b, 'en')` (ICU root collation, non-ignorable punctuation) for object keys:
/// exact for printable ASCII and precomposed Latin/Cyrillic letters (primary, then accents, then
/// lower-before-upper); other characters order by code unit after ASCII.
int compareLocaleEn(String a, String b) {
  final ea = [for (final unit in a.codeUnits) _element(unit)];
  final eb = [for (final unit in b.codeUnits) _element(unit)];
  for (final level in [0, 1, 2]) {
    final length = ea.length < eb.length ? ea.length : eb.length;
    for (var index = 0; index < length; index++) {
      final x = switch (level) { 0 => ea[index].$1, 1 => ea[index].$2, _ => ea[index].$3 };
      final y = switch (level) { 0 => eb[index].$1, 1 => eb[index].$2, _ => eb[index].$3 };
      if (x != y) return x < y ? -1 : 1;
    }
    if (ea.length != eb.length) return ea.length < eb.length ? -1 : 1;
  }
  return 0;
}

/// `canonicalContent`: JSON.stringify with every object's keys sorted by `localeCompare(_, 'en')`.
String canonicalContent(Object? value) => jsonStringify(value, compareKeys: compareLocaleEn);

/// `canonicalJson` (content packs): JSON.stringify with object keys in code-unit order. The hash of
/// a shard/manifest is computed over this text after parsing, so transport re-encoding is harmless.
String canonicalJson(Object? value) => jsonStringify(value, compareKeys: compareCodeUnits);

String sha256Hex(String text) => sha256.convert(utf8.encode(text)).toString();

/// `contentTranslationKey(row, field)`: `${id}:${field}:${sha256(canonicalContent([base, _az, _en]))}`.
/// Null when `id` is neither a string nor a number. Missing columns count as null.
String? contentTranslationKey(Map<String, dynamic>? row, String field) {
  if (row == null) return null;
  final id = row['id'];
  if (id is! String && id is! num) return null;
  final value = canonicalContent([row[field], row['${field}_az'], row['${field}_en']]);
  final idText = id is num ? jsNumberToString(id) : id as String;
  return '$idText:$field:${sha256Hex(value)}';
}

/// `keyBucket`: the first 8 hex digits of the key's hash modulo [buckets].
int keyBucket(String key, int buckets) {
  if (buckets <= 1) return 0;
  final hash = key.substring(key.lastIndexOf(':') + 1);
  final head = hash.length > 8 ? hash.substring(0, 8) : hash;
  final match = RegExp('^[0-9a-fA-F]+').firstMatch(head);
  if (match == null) return 0;
  return int.parse(match[0]!, radix: 16) % buckets;
}

/// Field of a content key (`<id>:<field>:<hash>`; the id itself may contain ':').
String? keyField(String key) {
  final parts = key.split(':');
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}
