// Ported from: src/components/games/word-garden/generator.ts, src/components/games/color-sort/generator.ts,
// src/components/games/leaf-flight/engine.ts, src/components/games/qabarciq/engine.ts
// (the JavaScript number semantics every game engine relies on).
//
// JavaScript numbers are IEEE doubles; bitwise operators convert through ToInt32/ToUint32.
// These helpers reproduce those conversions exactly on the Dart VM (64-bit ints), so seeded
// generators produce byte-identical levels. Not intended for dart2js/web, where `int` is a double.
library;

const double _two32 = 4294967296.0;

/// ECMAScript ToUint32 for any number (NaN/±Infinity → 0, fractional part truncated, modulo 2^32).
int toUint32(num value) {
  if (value is int) return value & 0xFFFFFFFF;
  final v = value.toDouble();
  if (!v.isFinite) return 0;
  final t = v.truncateToDouble();
  var r = t.remainder(_two32); // exact (fmod)
  if (r < 0) r += _two32;
  return r.toInt() & 0xFFFFFFFF;
}

/// ECMAScript ToInt32.
int toInt32(num value) {
  final u = toUint32(value);
  return u >= 0x80000000 ? u - 0x100000000 : u;
}

/// `Math.imul(a, b)`.
int imul(num a, num b) => toInt32((toUint32(a) * toUint32(b)) & 0xFFFFFFFF);

/// `a >>> b` (result is a uint32).
int ushr(num a, int b) => toUint32(a) >> (b & 31);

/// `a << b` (result is an int32).
int shl(num a, int b) => toInt32(toUint32(a) << (b & 31));

/// `a ^ b`, `a | b`, `a & b` with ToInt32 operands (result int32).
int xor32(num a, num b) => toInt32(toInt32(a) ^ toInt32(b));
int or32(num a, num b) => toInt32(toInt32(a) | toInt32(b));
int and32(num a, num b) => toInt32(toInt32(a) & toInt32(b));

/// `Math.round` (ties toward +Infinity, unlike Dart's `round()` which ties away from zero).
int jsRound(num value) {
  final v = value.toDouble();
  final f = v.floorToDouble();
  return (v - f >= 0.5 ? f + 1 : f).toInt();
}

/// `Number.isSafeInteger`.
bool isSafeInteger(Object? value) {
  if (value is int) return value.abs() <= 9007199254740991;
  if (value is double) return value.isFinite && value == value.truncateToDouble() && value.abs() <= 9007199254740991;
  return false;
}

/// `Number.isInteger`.
bool isJsInteger(Object? value) {
  if (value is int) return true;
  if (value is double) return value.isFinite && value == value.truncateToDouble();
  return false;
}

/// `Number.isFinite`.
bool isJsFinite(Object? value) => value is int || (value is double && value.isFinite);

/// The mulberry32-style generator used by Word Garden (`gardenRandom`), Color Sort (`seededRandom`)
/// and Leaf Flight (`random`). JS keeps `state` as a double that is never truncated, so the state
/// is kept as a double here too and every step converts through ToInt32/ToUint32 like V8 does.
class Mulberry32 {
  Mulberry32(num seed) : _state = seed.toDouble();
  double _state;

  double next() {
    _state += 0x6D2B79F5;
    var value = imul(xor32(_state, ushr(_state, 15)), or32(_state, 1));
    value = xor32(value, value + imul(xor32(value, ushr(value, 7)), or32(value, 61)));
    return ushr(xor32(value, ushr(value, 14)), 0) / 4294967296;
  }

  double call() => next();
}

typedef JsRandom = double Function();

/// Fisher–Yates exactly as the TS `shuffleLetters`/`shuffled` (copies the input).
List<T> jsShuffle<T>(Iterable<T> items, JsRandom random) {
  final result = List<T>.of(items);
  for (var index = result.length - 1; index > 0; index--) {
    final next = (random() * (index + 1)).floor();
    final tmp = result[index];
    result[index] = result[next];
    result[next] = tmp;
  }
  return result;
}

/// Stable sort (merge sort) with a JS-style comparator returning any number. V8's
/// `Array.prototype.sort` is stable (TimSort); Dart's `List.sort` is not, so every port uses this.
void stableSort<T>(List<T> list, num Function(T a, T b) compare) {
  if (list.length < 2) return;
  final buffer = List<T>.of(list);
  _mergeSort(buffer, list, 0, list.length, compare);
}

void _mergeSort<T>(List<T> src, List<T> dst, int lo, int hi, num Function(T, T) compare) {
  // Sorts src[lo,hi) into dst[lo,hi); src and dst start with equal contents.
  if (hi - lo < 2) return;
  if (hi - lo <= 12) {
    for (var i = lo + 1; i < hi; i++) {
      final item = dst[i];
      var j = i - 1;
      while (j >= lo && compare(dst[j], item) > 0) {
        dst[j + 1] = dst[j];
        j--;
      }
      dst[j + 1] = item;
    }
    return;
  }
  final mid = (lo + hi) >> 1;
  _mergeSort(dst, src, lo, mid, compare);
  _mergeSort(dst, src, mid, hi, compare);
  var i = lo, j = mid, k = lo;
  while (i < mid && j < hi) {
    dst[k++] = compare(src[j], src[i]) < 0 ? src[j++] : src[i++];
  }
  while (i < mid) {
    dst[k++] = src[i++];
  }
  while (j < hi) {
    dst[k++] = src[j++];
  }
}

/// Returns a sorted copy (stable).
List<T> stableSorted<T>(Iterable<T> items, num Function(T a, T b) compare) {
  final list = List<T>.of(items);
  stableSort(list, compare);
  return list;
}

/// JS `a < b ? -1 : a > b ? 1 : 0` on strings: UTF-16 code-unit order (Dart's `compareTo` agrees).
int codeOrder(String a, String b) => a.compareTo(b);

/// Default `Array.prototype.sort()` without comparator: compares `String(value)` code units.
List<T> jsDefaultSorted<T>(Iterable<T> items) => stableSorted(items, (a, b) => '$a'.compareTo('$b'));

/// `Number(bool)`.
int jsNumberOfBool(bool value) => value ? 1 : 0;

/// A TS `throw new Error('CODE')` from a game engine. [code] is the exact message string.
class GameError implements Exception {
  const GameError(this.code);
  final String code;
  @override
  String toString() => code;
}

final RegExp _decimalLiteral = RegExp(r'^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$');
final RegExp _jsWhitespace = RegExp(r'^[\s﻿ ]+|[\s﻿ ]+$');

/// `Number(string)` (ToNumber on a string; `Number(null)` is 0).
double jsToNumber(String? value) {
  if (value == null) return 0;
  final text = value.replaceAll(_jsWhitespace, '');
  if (text.isEmpty) return 0;
  if (_decimalLiteral.hasMatch(text)) return double.parse(text);
  final lower = text.toLowerCase();
  for (final (prefix, radix) in [('0x', 16), ('0o', 8), ('0b', 2)]) {
    if (lower.startsWith(prefix) && lower.length > 2) {
      final parsed = BigInt.tryParse(lower.substring(2), radix: radix);
      return parsed == null ? double.nan : parsed.toDouble();
    }
  }
  if (text == 'Infinity' || text == '+Infinity') return double.infinity;
  if (text == '-Infinity') return double.negativeInfinity;
  return double.nan;
}
