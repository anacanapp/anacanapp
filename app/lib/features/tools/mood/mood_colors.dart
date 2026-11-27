// Ported from: src/components/tools/mood-colors.ts
//
// Theme-aware mood colours: the 1-5 scale decides the tone; the database `color_class` (light-only Tailwind pastels)
// is only read for values outside that scale. Tones map to design tokens that have their own dark values.
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';

enum MoodTone { pink, coral, yellow, blue, green, lav, neutral }

const Map<int, MoodTone> _byValue = {1: MoodTone.pink, 2: MoodTone.coral, 3: MoodTone.yellow, 4: MoodTone.blue, 5: MoodTone.green};

final List<(RegExp, MoodTone)> _byHue = [
  (RegExp(r'\b(?:bg|border)-(?:red|rose|pink|fuchsia)-'), MoodTone.pink),
  (RegExp(r'\b(?:bg|border)-(?:orange|amber)-'), MoodTone.coral),
  (RegExp(r'\b(?:bg|border)-yellow-'), MoodTone.yellow),
  (RegExp(r'\b(?:bg|border)-(?:lime|green|emerald|teal)-'), MoodTone.green),
  (RegExp(r'\b(?:bg|border)-(?:sky|blue|cyan|indigo)-'), MoodTone.blue),
  (RegExp(r'\b(?:bg|border)-(?:violet|purple)-'), MoodTone.lav),
];

MoodTone moodTone(num value, [String? colorClass]) {
  final byValue = value is int || value == value.roundToDouble() ? _byValue[value.toInt()] : null;
  if (byValue != null) return byValue;
  final cls = colorClass ?? '';
  for (final (pattern, tone) in _byHue) {
    if (pattern.hasMatch(cls)) return tone;
  }
  return MoodTone.neutral;
}

/// The CSS variables of a tone (`moodToneStyle`): `(background, borderColor)`.
const Map<MoodTone, (String, String)> moodToneVars = {
  MoodTone.pink: ('var(--a-pink-1)', 'var(--a-pink-2)'),
  MoodTone.coral: ('var(--a-coral-soft)', 'var(--a-peach-2)'),
  MoodTone.yellow: ('var(--a-yellow-1)', 'var(--a-yellow-2)'),
  MoodTone.blue: ('var(--a-blue-1)', 'var(--a-blue-2)'),
  MoodTone.green: ('var(--a-green-1)', 'var(--a-green-2)'),
  MoodTone.lav: ('var(--a-lav-1)', 'var(--a-lav-2)'),
  MoodTone.neutral: ('var(--a-surface-soft)', 'var(--a-line-strong)'),
};

/// `moodToneStyle(tone)` resolved against the design tokens: `(background, borderColor)`.
(Color, Color) moodToneColors(ATokens a, MoodTone tone) => switch (tone) {
      MoodTone.pink => (a.pink1, a.pink2),
      MoodTone.coral => (a.coralSoft, a.peach2),
      MoodTone.yellow => (a.yellow1, a.yellow2),
      MoodTone.blue => (a.blue1, a.blue2),
      MoodTone.green => (a.green1, a.green2),
      MoodTone.lav => (a.lav1, a.lav2),
      MoodTone.neutral => (a.surfaceSoft, a.lineStrong),
    };
