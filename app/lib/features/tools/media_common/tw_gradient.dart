// Ported from: tailwind.config.ts (`bg-gradient-to-br from-<c> via-<c> to-<c>` utilities used with class strings
//              stored in the database, e.g. white_noise_sounds.color_gradient)
import 'package:flutter/painting.dart';

import 'tw_palette.g.dart';

/// The colour stops of a Tailwind gradient class string (`from-blue-400 to-cyan-500`), null when it names no
/// known colour. Tailwind fades a missing `to-` stop to the transparent `from-` colour.
List<Color>? twGradientStops(String? classes) {
  if (classes == null) return null;
  Color? from, via, to;
  for (final token in classes.trim().split(RegExp(r'\s+'))) {
    final m = RegExp(r'^(from|via|to)-(.+)$').firstMatch(token);
    if (m == null) continue;
    final color = kTwPalette[m[2]];
    if (color == null) continue;
    switch (m[1]) {
      case 'from':
        from = color;
      case 'via':
        via = color;
      default:
        to = color;
    }
  }
  if (from == null && to == null) return null;
  final start = from ?? to!.withAlpha(0);
  final end = to ?? from!.withAlpha(0);
  return [start, ?via, end];
}

/// `bg-gradient-to-br <classes>`.
LinearGradient? twGradientToBr(String? classes) {
  final stops = twGradientStops(classes);
  return stops == null ? null : LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: stops);
}
