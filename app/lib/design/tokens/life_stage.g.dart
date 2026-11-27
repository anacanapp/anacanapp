// GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names

import 'package:flutter/painting.dart';

import 'css_types.dart';

/// Life-stage palette (tailwind `flow` / `bump` / `mommy` / `partner` colours + `gradient-*`).
/// Note: `--gradient-partner` is blue while `--partner` is orange — faithful to src/index.css.
class ALifeStagePalette {
  const ALifeStagePalette({required this.base, required this.light, required this.dark, required this.gradient});
  /// `--<stage>` (tailwind `bg-<stage>`).
  final Color base;
  /// `--<stage>-light`.
  final Color light;
  /// `--<stage>-dark`.
  final Color dark;
  /// `--gradient-<stage>`.
  final Gradient gradient;
}

abstract final class ALifeStagePalettes {
  static const Map<String, ALifeStagePalette> light = <String, ALifeStagePalette>{
    'flow': ALifeStagePalette(base: Color(0xFFE4445E), light: Color(0xFFFCE8EB), dark: Color(0xFFD02541), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFFE4445E), Color(0xFFE25A93), Color(0xFFE06C89)], stops: <double>[0.0, 0.5, 1.0])),
    'bump': ALifeStagePalette(base: Color(0xFF9E59CF), light: Color(0xFFF4EBFA), dark: Color(0xFF853DB8), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF9E59CF), Color(0xFFBE6ECF), Color(0xFF8E6ECF)], stops: <double>[0.0, 0.5, 1.0])),
    'mommy': ALifeStagePalette(base: Color(0xFF37BE9C), light: Color(0xFFE7F9F4), dark: Color(0xFF309179), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF37BE9C), Color(0xFF47C2B8), Color(0xFF47C28F)], stops: <double>[0.0, 0.5, 1.0])),
    'partner': ALifeStagePalette(base: Color(0xFFF17C55), light: Color(0xFFFEEEE7), dark: Color(0xFFE04E29), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF4280D7), Color(0xFF5474D4), Color(0xFF4798D1)], stops: <double>[0.0, 0.5, 1.0])),
  };
  static const Map<String, ALifeStagePalette> dark = <String, ALifeStagePalette>{
    'flow': ALifeStagePalette(base: Color(0xFFE96379), light: Color(0xFF45171F), dark: Color(0xFFDD3C57), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFFE4445E), Color(0xFFE25A93), Color(0xFFE06C89)], stops: <double>[0.0, 0.5, 1.0])),
    'bump': ALifeStagePalette(base: Color(0xFFAE75D7), light: Color(0xFF311C40), dark: Color(0xFF9653C6), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF9E59CF), Color(0xFFBE6ECF), Color(0xFF8E6ECF)], stops: <double>[0.0, 0.5, 1.0])),
    'mommy': ALifeStagePalette(base: Color(0xFF4DCBAC), light: Color(0xFF1E3E36), dark: Color(0xFF39AC8F), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF37BE9C), Color(0xFF47C2B8), Color(0xFF47C28F)], stops: <double>[0.0, 0.5, 1.0])),
    'partner': ALifeStagePalette(base: Color(0xFFEB7047), light: Color(0xFF40251C), dark: Color(0xFFD94A26), gradient: CssLinearGradient(angle: 135.0, colors: <Color>[Color(0xFF4280D7), Color(0xFF5474D4), Color(0xFF4798D1)], stops: <double>[0.0, 0.5, 1.0])),
  };
}
