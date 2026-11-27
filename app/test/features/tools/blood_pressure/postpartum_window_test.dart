// Ported from: src/lib/postpartum-window.test.ts
import 'package:anacan/features/tools/blood_pressure/postpartum_window.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime(2026, 11, 8, 1, 30); // 8 Nov 2026, 01:30 local

  test('uses the youngest baby and local calendar days', () {
    expect(daysSinceYoungestBirth(['2024-01-01', '2026-11-01', null], now), 7);
    expect(isEarlyPostpartum(['2024-01-01', '2026-11-01'], now), isTrue);
  });

  test('ends after 41 days and ignores missing or future dates', () {
    expect(isEarlyPostpartum(['2026-09-28'], now), isTrue); // day 41
    expect(isEarlyPostpartum(['2026-09-27'], now), isFalse); // day 42
    expect(isEarlyPostpartum([null, null, '2027-01-01', 'bad'], now), isFalse);
    expect(isEarlyPostpartum([DateTime(2026, 11, 8)], now), isTrue);
  });
}
