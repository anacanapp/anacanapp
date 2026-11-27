// Ported from: src/lib/recap/anim.ts
//
// Easing, interpolation and a seeded PRNG for the recap renderer (no Random, no clock).
import 'dart:math' as math;

double clamp01(double x) => x < 0 ? 0 : (x > 1 ? 1 : x);
double lerp(double a, double b, double t) => a + (b - a) * t;

/// 0→1 progress of [t] inside [start, start + duration].
double prog(double t, double start, double duration) => clamp01((t - start) / math.max(1e-6, duration));

double easeOutCubic(double t) => 1 - math.pow(1 - clamp01(t), 3).toDouble();
double easeInCubic(double t) => math.pow(clamp01(t), 3).toDouble();
double easeInOutCubic(double t) {
  final x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - math.pow(-2 * x + 2, 3) / 2;
}

double easeOutExpo(double t) {
  final x = clamp01(t);
  return x >= 1 ? 1 : 1 - math.pow(2, -10 * x).toDouble();
}

double easeOutBack(double t, [double s = 1.6]) {
  final x = clamp01(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}

double easeOutQuint(double t) => 1 - math.pow(1 - clamp01(t), 5).toDouble();

const int _m32 = 0xFFFFFFFF;
int _imul(int a, int b) => ((a & _m32) * (b & _m32)) & _m32;

/// Mulberry32: fast, deterministic, good enough for visuals (bit-identical to the TypeScript).
double Function() prng(int seed) {
  var a = seed & _m32;
  return () {
    a = (a + 0x6d2b79f5) & _m32;
    var t = a;
    t = _imul(t ^ (t >> 15), t | 1);
    t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & _m32)) & _m32;
    return ((t ^ (t >> 14)) & _m32) / 4294967296;
  };
}

/// The grain tile LCG of export.ts (`a = imul(a, 1664525) + 1013904223 >>> 0`, value `a >>> 24`).
int grainLcgNext(int a) => (_imul(a, 1664525) + 1013904223) & _m32;

String _fixed3(double v) => v.toStringAsFixed(3);

int _hex(String hex) {
  final h = hex.replaceAll('#', '');
  final full = h.length == 3 ? h.split('').map((c) => '$c$c').join() : h;
  return int.parse(full, radix: 16);
}

/// Hex colour → rgba string with alpha.
String rgba(String hex, double alpha) {
  final n = _hex(hex);
  return 'rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${_fixed3(math.max(0, math.min(1, alpha)).toDouble())})';
}

int _jsRound(double v) {
  final f = v.floorToDouble();
  return ((v - f) >= 0.5 ? f + 1 : f).toInt();
}

/// Mix two hex colours.
String mix(String a, String b, double t) {
  final pa = _hex(a), pb = _hex(b);
  int ch(int shift) => _jsRound(lerp(((pa >> shift) & 255).toDouble(), ((pb >> shift) & 255).toDouble(), clamp01(t)));
  return '#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toRadixString(16).substring(1)}';
}
