// Ported from: JavaScript built-ins relied on by src/lib/tr.ts and scripts/i18n/content-translation-core.mjs
// (String(number), JSON.stringify).

/// `String(value)` for a JS number: integers without `.0`, shortest round-trip digits otherwise,
/// exponent form outside [1e-7, 1e21).
String jsNumberToString(num value) {
  if (value is int) return value.toString();
  final number = value.toDouble();
  if (number.isNaN) return 'NaN';
  if (number.isInfinite) return number > 0 ? 'Infinity' : '-Infinity';
  if (number == 0) return '0'; // -0 prints as "0"
  // Dart's double.toString is the shortest round-trip representation, like JS; only the layout
  // differs. Re-layout per ECMAScript Number::toString: digits d1..dk, decimal exponent n.
  final negative = number < 0;
  var text = number.abs().toString();
  var exponent = 0;
  final e = text.indexOf('e');
  if (e >= 0) {
    exponent = int.parse(text.substring(e + 1));
    text = text.substring(0, e);
  }
  final point = text.indexOf('.');
  var integerPart = point >= 0 ? text.substring(0, point) : text;
  var fraction = point >= 0 ? text.substring(point + 1) : '';
  var digits = integerPart + fraction;
  var n = integerPart.length + exponent;
  final leading = digits.length - digits.replaceFirst(RegExp('^0+'), '').length;
  digits = digits.substring(leading);
  n -= leading;
  digits = digits.replaceFirst(RegExp(r'0+$'), '');
  final k = digits.length;
  String out;
  if (k <= n && n <= 21) {
    out = digits + '0' * (n - k);
  } else if (0 < n && n <= 21) {
    out = '${digits.substring(0, n)}.${digits.substring(n)}';
  } else if (-6 < n && n <= 0) {
    out = '0.${'0' * -n}$digits';
  } else {
    final sign = n - 1 >= 0 ? '+' : '-';
    final mantissa = k == 1 ? digits : '${digits[0]}.${digits.substring(1)}';
    out = '${mantissa}e$sign${(n - 1).abs()}';
  }
  return negative ? '-$out' : out;
}

/// `String(value)` for values used in template substitution.
String jsString(Object? value) {
  if (value == null) return 'null';
  if (value is num) return jsNumberToString(value);
  if (value is bool) return value ? 'true' : 'false';
  if (value is List) return value.map((item) => item == null ? '' : jsString(item)).join(',');
  return value.toString();
}

/// `JSON.stringify` string quoting (ES2019 well-formed: lone surrogates escaped, lower-case hex).
String jsonQuote(String value) {
  final out = StringBuffer('"');
  for (var index = 0; index < value.length; index++) {
    final unit = value.codeUnitAt(index);
    switch (unit) {
      case 0x22:
        out.write(r'\"');
      case 0x5c:
        out.write(r'\\');
      case 0x08:
        out.write(r'\b');
      case 0x0c:
        out.write(r'\f');
      case 0x0a:
        out.write(r'\n');
      case 0x0d:
        out.write(r'\r');
      case 0x09:
        out.write(r'\t');
      default:
        if (unit < 0x20) {
          out.write('\\u${unit.toRadixString(16).padLeft(4, '0')}');
        } else if (unit >= 0xd800 && unit <= 0xdbff) {
          final next = index + 1 < value.length ? value.codeUnitAt(index + 1) : 0;
          if (next >= 0xdc00 && next <= 0xdfff) {
            out.writeCharCode(unit);
            out.writeCharCode(next);
            index++;
          } else {
            out.write('\\u${unit.toRadixString(16)}');
          }
        } else if (unit >= 0xdc00 && unit <= 0xdfff) {
          out.write('\\u${unit.toRadixString(16)}');
        } else {
          out.writeCharCode(unit);
        }
    }
  }
  out.write('"');
  return out.toString();
}

/// `JSON.stringify(value)` where every object's keys are emitted in the order given by [compareKeys]
/// (null keeps insertion order). Supports null, bool, num, String, List and Map values as produced by
/// `jsonDecode` or Supabase rows.
String jsonStringify(Object? value, {int Function(String a, String b)? compareKeys}) {
  final out = StringBuffer();
  void write(Object? item) {
    if (item == null) {
      out.write('null');
    } else if (item is bool) {
      out.write(item ? 'true' : 'false');
    } else if (item is num) {
      out.write(item.isFinite ? jsNumberToString(item) : 'null');
    } else if (item is String) {
      out.write(jsonQuote(item));
    } else if (item is List) {
      out.write('[');
      for (var index = 0; index < item.length; index++) {
        if (index > 0) out.write(',');
        write(item[index]);
      }
      out.write(']');
    } else if (item is Map) {
      final keys = item.keys.map((key) => '$key').toList();
      if (compareKeys != null) {
        final indexed = [for (var index = 0; index < keys.length; index++) (index, keys[index])];
        // Array.prototype.sort is stable: equal keys keep their original order.
        indexed.sort((a, b) {
          final order = compareKeys(a.$2, b.$2);
          return order != 0 ? order : a.$1.compareTo(b.$1);
        });
        keys
          ..clear()
          ..addAll(indexed.map((entry) => entry.$2));
      }
      out.write('{');
      var first = true;
      // Objects enumerate array-index keys first (ascending), whatever the insertion/sort order.
      for (final key in jsForInOrder(keys)) {
        final entry = item[key];
        if (!first) out.write(',');
        first = false;
        out.write(jsonQuote(key));
        out.write(':');
        write(entry);
      }
      out.write('}');
    } else {
      out.write(jsonQuote(item.toString()));
    }
  }

  write(value);
  return out.toString();
}

/// Code-unit order (`Array.prototype.sort()` default for strings).
int compareCodeUnits(String a, String b) => a.compareTo(b);

final RegExp _arrayIndex = RegExp(r'^(?:0|[1-9][0-9]*)$');

/// Property enumeration order of a JS object built with the same insertion order.
Iterable<String> jsForInOrder(Iterable<String> keys) {
  final indices = <String>[];
  final others = <String>[];
  for (final key in keys) {
    if (_arrayIndex.hasMatch(key) && key.length <= 10 && int.parse(key) < 4294967295) {
      indices.add(key);
    } else {
      others.add(key);
    }
  }
  indices.sort((a, b) => int.parse(a).compareTo(int.parse(b)));
  return [...indices, ...others];
}
