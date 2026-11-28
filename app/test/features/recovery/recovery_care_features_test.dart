// Ported from: src/lib/care-features.test.ts ('postpartum recovery', and the 'feature copy' case for recovery)
import 'package:anacan/features/recovery/recovery.dart';
import 'package:anacan/features/recovery/recovery_text.g.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_screens/support/copy_shape.dart';

void main() {
  group('postpartum recovery', () {
    test('computes weeks after birth and the check-up', () {
      final now = DateTime(2026, 11, 15);
      expect(weekAfterBirth('2026-11-15', now), 1);
      expect(weekAfterBirth('2026-11-08', now), 2);
      expect(weekAfterBirth('2026-11-20', now), isNull);
      expect(weekAfterBirth(null, now), isNull);
      expect(checkupDate('2026-11-01').day, 13);
    });

    test('starts pelvic floor training gently', () {
      expect((kegelLevel(1).level, kegelLevel(1).hold), (0, 3));
      expect((kegelLevel(4).level, kegelLevel(4).hold), (1, 5));
      expect((kegelLevel(9).level, kegelLevel(9).hold), (2, 8));
    });

    test('treats dangerous signs as urgent', () {
      expect(flagSeverity(['heavy_bleeding'], null), 'urgent');
      expect(flagSeverity(['harm'], null), 'urgent');
      expect(flagSeverity(['fever'], null), 'doctor');
      expect(flagSeverity([], 3), 'doctor');
      expect(flagSeverity([], 1), isNull);
    });
  });

  group('feature copy', () {
    test('recovery has 21 languages with the same shape and placeholders', () {
      expectSameShape(kRecoveryText);
    });
  });
}
