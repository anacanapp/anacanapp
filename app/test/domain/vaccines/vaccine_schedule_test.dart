// Ported from: src/lib/vaccine-schedule.test.ts

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/vaccines/vaccine_schedule.dart';
import 'package:flutter_test/flutter_test.dart';

ScheduleLike row([Map<String, Object?> changes = const {}]) => ScheduleLike(
      id: 'dose-2',
      doseNumber: 2,
      recommendedAgeDays: 60,
      minAgeDays: 60,
      maxAgeDays: null,
      scheduleMeta: {
        'protocol': 'anacan-vaccine-schedule-v1', 'version': 'fixture', 'kind': 'routine', 'age': {'months': 2, 'days': 0}, 'end_age': null,
        'expected_age_days': 60, 'expected_dose_number': 2, 'source_url': 'https://example.org/schedule', 'source_label': 'Fixture', ...changes,
      },
    );
Map<String, VaccinationLike> empty() => {};

void main() {
  group('regional vaccination schedules', () {
    test('honours child, account and stored country before the language suggestion', () {
      expect(regionalCountry('ja', ['FR', 'AZ']), 'FR');
      expect(regionalCountry('vi', [null, 'SE']), 'SE');
      expect(regionalCountry('ko', [null, null, 'NL']), 'NL');
      for (final e in {'zh': 'CN', 'id': 'ID', 'fr': 'FR', 'es': 'ES', 'pt': 'PT', 'vi': 'VN', 'hi': 'IN', 'ja': 'JP', 'ko': 'KR', 'pl': 'PL', 'nl': 'NL', 'sv': 'SE'}.entries) {
        expect(regionalCountry(e.key), e.value);
      }
    });
    test('uses calendar months, leap years and civil days rather than 30-day months', () {
      expect(formatYmd(calendarOffsetDate('2024-01-31', const CalendarOffset(months: 1, days: 0))!), '2024-02-29');
      expect(formatYmd(calendarOffsetDate('2025-01-31', const CalendarOffset(months: 1, days: 0))!), '2025-02-28');
      expect(formatYmd(calendarOffsetDate('2024-02-29', const CalendarOffset(months: 12, days: 0))!), '2025-02-28');
      expect(vaccineStatus(row(), '2026-01-31', empty(), DateTime(2026, 3, 30, 23)), 'future');
      expect(vaccineStatus(row(), '2026-01-31', empty(), DateTime(2026, 3, 31)), 'pending');
    });
    test('does not invent a 60-day overdue deadline for a reviewed age without a stated range', () {
      expect(vaccineStatus(row(), '2025-01-01', empty(), DateTime(2026, 9, 24)), 'pending');
      expect(vaccineStatus(row({'end_age': {'months': 4, 'days': -1}}), '2026-01-01', empty(), DateTime(2026, 5, 1)), 'overdue');
    });
    test('anchors subsequent doses to the actual prior vaccination, not to birth or the nominal age', () {
      final schedule = row({
        'relative': {'schedule_id': 'dose-1', 'min': {'months': 6, 'days': 0}, 'max': {'months': 12, 'days': 0}},
      });
      expect(vaccineStatus(schedule, '2024-01-01', empty(), DateTime(2026, 9, 24)), 'interval');
      final logs = {'dose-1': const VaccinationLike(administeredAt: '2026-04-30')};
      expect(vaccineStatus(schedule, '2024-01-01', logs, DateTime(2026, 9, 24)), 'future');
      expect(vaccineStatus(schedule, '2024-01-01', logs, DateTime(2026, 10, 30)), 'pending');
    });
    test('does not turn conditional/product/seasonal programmes into automatic overdue doses', () {
      expect(vaccineStatus(row({'kind': 'conditional'}), '2020-01-01', empty(), DateTime(2026, 9, 24)), 'conditional');
      expect(vaccineStatus(row({'kind': 'seasonal'}), '2020-01-01', empty(), DateTime(2026, 9, 24)), 'seasonal');
    });
    test('applies cohort and gender rules while retaining a recorded historical vaccination', () {
      final child = row({'gender': 'girl', 'born_from': '2021-01-01'});
      expect(vaccineEligible(child, '2022-01-01', 'boy'), false);
      expect(vaccineEligible(child, '2020-12-31', 'girl'), false);
      expect(vaccineEligible(child, '2022-01-01', 'girl'), true);
      expect(vaccineEligible(child, '2020-12-31', 'girl', const VaccinationLike(administeredAt: '2025-01-01')), true);
      expect(vaccineStatus(child, '2020-12-31', {'dose-2': const VaccinationLike(administeredAt: '2025-01-01')}), 'done');
    });
  });

  group('legacy rows without reviewed timing (no vitest case; TypeScript rules)', () {
    test('uses min/max days and the +60 day fallback', () {
      const legacy = ScheduleLike(id: 'x', doseNumber: 1, recommendedAgeDays: 60, minAgeDays: null, maxAgeDays: null);
      expect(vaccineStatus(legacy, '2026-01-01', {}, DateTime(2026, 2, 1)), 'future');
      expect(vaccineStatus(legacy, '2026-01-01', {}, DateTime(2026, 3, 2)), 'pending');
      expect(vaccineStatus(legacy, '2026-01-01', {}, DateTime(2026, 5, 2)), 'overdue');
      expect(vaccineStatus(legacy, 'bad', {}, DateTime(2026, 5, 2)), 'future');
      expect(vaccineTiming(row({'protocol': 'other'})), isNull);
      expect(vaccineTiming(row({'relative': {'schedule_id': 'dose-2', 'min': {'months': 1, 'days': 0}}})), isNull);
    });
  });
}
