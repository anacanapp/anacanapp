// Ported from: src/components/games/word-garden/storage.ts, src/components/games/iki-dost/state.ts,
// src/components/games/casual/storage.ts, src/components/games/color-sort/session.ts
// (`JSON.stringify` / `JSON.parse` behaviour the saved games depend on).
//
// Saves are re-written with JavaScript's exact serialisation so the Capacitor app can read them
// back byte-for-byte: integer-valued doubles print without `.0`, numbers use the shortest
// round-trip form, and object keys follow ECMAScript order (array-index keys ascending first,
// then the remaining keys in insertion order).
library;

import 'dart:convert';

/// `Number.prototype.toString()` for a finite or non-finite double / int.
String jsNumberToString(num value) {
  if (value is int) return value.toString();
  final v = value as double;
  if (v.isNaN) return 'NaN';
  if (v.isInfinite) return v > 0 ? 'Infinity' : '-Infinity';
  if (v == 0) return '0';
  final negative = v < 0;
  final abs = v.abs();
  // Dart's toString gives the shortest round-trip digits; extract digits/exponent.
  var text = abs.toString();
  String digits;
  int exponent; // value = 0.digits × 10^exponent  (i.e. n in the ECMAScript algorithm)
  final ePos = text.indexOf('e');
  var mantissa = ePos >= 0 ? text.substring(0, ePos) : text;
  final exp10 = ePos >= 0 ? int.parse(text.substring(ePos + 1)) : 0;
  final dot = mantissa.indexOf('.');
  var intPart = dot >= 0 ? mantissa.substring(0, dot) : mantissa;
  var fracPart = dot >= 0 ? mantissa.substring(dot + 1) : '';
  if (fracPart == '0') fracPart = '';
  digits = intPart + fracPart;
  exponent = intPart.length + exp10;
  // strip leading zeros
  var lead = 0;
  while (lead < digits.length - 1 && digits[lead] == '0') {
    lead++;
  }
  digits = digits.substring(lead);
  exponent -= lead;
  digits = digits.replaceFirst(RegExp(r'0+$'), '');
  if (digits.isEmpty) digits = '0';
  final k = digits.length, n = exponent;
  String out;
  if (k <= n && n <= 21) {
    out = digits + '0' * (n - k);
  } else if (0 < n && n <= 21) {
    out = '${digits.substring(0, n)}.${digits.substring(n)}';
  } else if (-6 < n && n <= 0) {
    out = '0.${'0' * -n}$digits';
  } else {
    final e = n - 1;
    final sign = e >= 0 ? '+' : '-';
    out = k == 1 ? '${digits}e$sign${e.abs()}' : '${digits[0]}.${digits.substring(1)}e$sign${e.abs()}';
  }
  return negative ? '-$out' : out;
}

/// `String(value)` for the primitive values used in game keys and messages.
String jsString(Object? value) {
  if (value == null) return 'null';
  if (value is num) return jsNumberToString(value);
  return value.toString();
}

final RegExp _arrayIndex = RegExp(r'^(?:0|[1-9][0-9]*)$');

/// ECMAScript own-property order for an object built by inserting [keys] in this order.
List<String> jsPropertyOrder(Iterable<String> keys) {
  final indexes = <String>[], others = <String>[];
  for (final key in keys) {
    if (_arrayIndex.hasMatch(key) && key.length <= 10 && int.parse(key) < 4294967295) {
      indexes.add(key);
    } else {
      others.add(key);
    }
  }
  indexes.sort((a, b) => int.parse(a).compareTo(int.parse(b)));
  return [...indexes, ...others];
}

String _quote(String value) {
  final out = StringBuffer('"');
  for (var i = 0; i < value.length; i++) {
    final c = value.codeUnitAt(i);
    switch (c) {
      case 0x22:
        out.write(r'\"');
      case 0x5C:
        out.write(r'\\');
      case 0x08:
        out.write(r'\b');
      case 0x0C:
        out.write(r'\f');
      case 0x0A:
        out.write(r'\n');
      case 0x0D:
        out.write(r'\r');
      case 0x09:
        out.write(r'\t');
      default:
        if (c < 0x20) {
          out.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          final isHigh = c <= 0xDBFF;
          final pairOk = isHigh
              ? i + 1 < value.length && (value.codeUnitAt(i + 1) & 0xFC00) == 0xDC00
              : i > 0 && (value.codeUnitAt(i - 1) & 0xFC00) == 0xD800;
          if (pairOk) {
            out.writeCharCode(c);
          } else {
            out.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
          }
        } else {
          out.writeCharCode(c);
        }
    }
  }
  out.write('"');
  return out.toString();
}

/// `JSON.stringify(value)` for JSON-like Dart values (`Map<String, Object?>`, `List`, `String`, `num`, `bool`, `null`).
/// Map entries whose value is [jsUndefined] are skipped, like `undefined` properties in JS.
String jsonStringify(Object? value) {
  final out = StringBuffer();
  _write(out, value);
  return out.toString();
}

/// Marker for a JS `undefined` property value (omitted by `JSON.stringify`).
const Object jsUndefined = _Undefined();

class _Undefined {
  const _Undefined();
}

void _write(StringBuffer out, Object? value) {
  if (value == null) {
    out.write('null');
  } else if (value is bool) {
    out.write(value ? 'true' : 'false');
  } else if (value is num) {
    out.write(value is double && !value.isFinite ? 'null' : jsNumberToString(value));
  } else if (value is String) {
    out.write(_quote(value));
  } else if (value is List) {
    out.write('[');
    for (var i = 0; i < value.length; i++) {
      if (i > 0) out.write(',');
      final item = value[i];
      _write(out, identical(item, jsUndefined) ? null : item);
    }
    out.write(']');
  } else if (value is Map) {
    out.write('{');
    var first = true;
    final map = value.cast<String, Object?>();
    for (final key in jsPropertyOrder(map.keys)) {
      final item = map[key];
      if (identical(item, jsUndefined)) continue;
      if (!first) out.write(',');
      first = false;
      out.write(_quote(key));
      out.write(':');
      _write(out, item);
    }
    out.write('}');
  } else {
    throw ArgumentError('Not JSON-serialisable: ${value.runtimeType}');
  }
}

/// `JSON.parse` (throws [FormatException] like JS throws SyntaxError). Numbers keep Dart's
/// int/double split; use [isSafeInteger] etc. from js.dart for JS number checks.
Object? jsonParse(String text) => jsonDecode(text);
