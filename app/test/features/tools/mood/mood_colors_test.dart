// Ported from: src/components/tools/mood-colors.test.ts
import 'package:anacan/features/tools/mood/mood_colors.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('mood colours', () {
    test('colours the 1-5 scale from the value, ignoring the light-only database class', () {
      expect([1, 2, 3, 4, 5].map((v) => moodTone(v)).toList(), [MoodTone.pink, MoodTone.coral, MoodTone.yellow, MoodTone.blue, MoodTone.green]);
      expect(moodTone(1, 'bg-green-100 border-green-300'), MoodTone.pink);
    });

    test('maps the database class for values outside the scale', () {
      expect(moodTone(6, 'bg-red-100 border-red-300'), MoodTone.pink);
      expect(moodTone(7, 'bg-orange-100 border-orange-300'), MoodTone.coral);
      expect(moodTone(8, 'bg-lime-100 border-lime-300'), MoodTone.green);
      expect(moodTone(9, 'bg-purple-100'), MoodTone.lav);
      expect(moodTone(0, 'bg-gray-100 border-gray-300'), MoodTone.neutral);
      expect(moodTone(0, null), MoodTone.neutral);
    });

    test('uses only design tokens (with .dark values) for the style', () {
      for (final tone in MoodTone.values) {
        final (bg, border) = moodToneVars[tone]!;
        expect(bg, matches(RegExp(r'^var\(--a-[a-z0-9-]+\)$')));
        expect(border, matches(RegExp(r'^var\(--a-[a-z0-9-]+\)$')));
      }
    });
  });
}
