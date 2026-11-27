// Ported from: src/components/games/leaf-flight/engine.ts (`Math.sin` in flightGateGaps).
//
// V8 implements `Math.sin`/`Math.cos` with fdlibm (src/base/ieee754.cc), which is not always
// correctly rounded; Dart's `dart:math` calls the platform libm, which can differ in the last
// bit. Leaf Flight collision tests depend on these values, so the fdlibm algorithm is ported
// here verbatim (arguments up to ~2^19·π/2; larger arguments fall back to dart:math).
library;

import 'dart:math' as math;
import 'dart:typed_data';

final ByteData _bits = ByteData(8);

int _high(double x) {
  _bits.setFloat64(0, x, Endian.little);
  return _bits.getInt32(4, Endian.little);
}

double _fromWords(int high, int low) {
  _bits.setInt32(4, high, Endian.little);
  _bits.setUint32(0, low, Endian.little);
  return _bits.getFloat64(0, Endian.little);
}

const double _s1 = -1.66666666666666324348e-01,
    _s2 = 8.33333333332248946124e-03,
    _s3 = -1.98412698298579493134e-04,
    _s4 = 2.75573137070700676789e-06,
    _s5 = -2.50507602534068634195e-08,
    _s6 = 1.58969099521155010221e-10;

double _kernelSin(double x, double y, int iy) {
  final ix = _high(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    if (x.toInt() == 0) return x;
  }
  final z = x * x;
  final v = z * x;
  final r = _s2 + z * (_s3 + z * (_s4 + z * (_s5 + z * _s6)));
  if (iy == 0) return x + v * (_s1 + z * r);
  return x - ((z * (0.5 * y - v * r) - y) - v * _s1);
}

const double _c1 = 4.16666666666666019037e-02,
    _c2 = -1.38888888888741095749e-03,
    _c3 = 2.48015872894767294178e-05,
    _c4 = -2.75573143513906633035e-07,
    _c5 = 2.08757232129817482790e-09,
    _c6 = -1.13596475577881948265e-11;

double _kernelCos(double x, double y) {
  final ix = _high(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    if (x.toInt() == 0) return 1.0;
  }
  final z = x * x;
  final r = z * (_c1 + z * (_c2 + z * (_c3 + z * (_c4 + z * (_c5 + z * _c6)))));
  if (ix < 0x3FD33333) return 1.0 - (0.5 * z - (z * r - x * y));
  final qx = ix > 0x3fe90000 ? 0.28125 : _fromWords(ix - 0x00200000, 0);
  final hz = 0.5 * z - qx;
  final a = 1.0 - qx;
  return a - (hz - (z * r - x * y));
}

const List<int> _npio2hw = [
  0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB, 0x402921FB,
  0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB,
  0x403AB41B, 0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
  0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB,
];

const double _invpio2 = 6.36619772367581382433e-01,
    _pio2_1 = 1.57079632673412561417e+00,
    _pio2_1t = 6.07710050650619224932e-11,
    _pio2_2 = 6.07710050630396597660e-11,
    _pio2_2t = 2.02226624879595063154e-21,
    _pio2_3 = 2.02226624871116645580e-21,
    _pio2_3t = 8.47842766036889956997e-32;

/// Returns n and writes y0/y1; null when the argument needs the large-argument path.
int? _remPio2(double x, List<double> y) {
  final hx = _high(x);
  final ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    if (hx > 0) {
      var z = x - _pio2_1;
      if (ix != 0x3ff921fb) {
        y[0] = z - _pio2_1t;
        y[1] = (z - y[0]) - _pio2_1t;
      } else {
        z -= _pio2_2;
        y[0] = z - _pio2_2t;
        y[1] = (z - y[0]) - _pio2_2t;
      }
      return 1;
    } else {
      var z = x + _pio2_1;
      if (ix != 0x3ff921fb) {
        y[0] = z + _pio2_1t;
        y[1] = (z - y[0]) + _pio2_1t;
      } else {
        z += _pio2_2;
        y[0] = z + _pio2_2t;
        y[1] = (z - y[0]) + _pio2_2t;
      }
      return -1;
    }
  }
  if (ix <= 0x413921fb) {
    var t = x.abs();
    final n = (t * _invpio2 + 0.5).toInt();
    final fn = n.toDouble();
    var r = t - fn * _pio2_1;
    var w = fn * _pio2_1t;
    if (n < 32 && ix != _npio2hw[n - 1]) {
      y[0] = r - w;
    } else {
      final j = ix >> 20;
      y[0] = r - w;
      var high = _high(y[0]);
      var i = j - ((high >> 20) & 0x7ff);
      if (i > 16) {
        t = r;
        w = fn * _pio2_2;
        r = t - w;
        w = fn * _pio2_2t - ((t - r) - w);
        y[0] = r - w;
        high = _high(y[0]);
        i = j - ((high >> 20) & 0x7ff);
        if (i > 49) {
          t = r;
          w = fn * _pio2_3;
          r = t - w;
          w = fn * _pio2_3t - ((t - r) - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = (r - y[0]) - w;
    if (hx < 0) {
      y[0] = -y[0];
      y[1] = -y[1];
      return -n;
    }
    return n;
  }
  return null;
}

/// `Math.sin` as computed by V8.
double jsSin(double x) {
  final ix = _high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return _kernelSin(x, 0, 0);
  if (ix >= 0x7ff00000) return double.nan;
  final y = <double>[0, 0];
  final n = _remPio2(x, y);
  if (n == null) return math.sin(x);
  switch (n & 3) {
    case 0:
      return _kernelSin(y[0], y[1], 1);
    case 1:
      return _kernelCos(y[0], y[1]);
    case 2:
      return -_kernelSin(y[0], y[1], 1);
    default:
      return -_kernelCos(y[0], y[1]);
  }
}

/// `Math.cos` as computed by V8.
double jsCos(double x) {
  final ix = _high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return _kernelCos(x, 0);
  if (ix >= 0x7ff00000) return double.nan;
  final y = <double>[0, 0];
  final n = _remPio2(x, y);
  if (n == null) return math.cos(x);
  switch (n & 3) {
    case 0:
      return _kernelCos(y[0], y[1]);
    case 1:
      return -_kernelSin(y[0], y[1], 1);
    case 2:
      return -_kernelCos(y[0], y[1]);
    default:
      return _kernelSin(y[0], y[1], 1);
  }
}
