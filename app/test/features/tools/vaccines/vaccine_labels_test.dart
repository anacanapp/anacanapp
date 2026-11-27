// Ported from: src/lib/vaccine-labels.test.ts
import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/features/tools/vaccines/vaccine_labels.dart';
import 'package:anacan/features/tools/vaccines/vaccine_models.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';

VaccineScheduleRow row([Map<String, dynamic> over = const {}, Map<String, dynamic> vaccine = const {}]) => VaccineScheduleRow.fromMap({
      'id': 'r1', 'dose_number': 1, 'recommended_age_days': 60, 'min_age_days': null, 'max_age_days': null,
      'age_label': '2 aylıq', 'age_label_az': '2 aylıq', 'dose_label': '1-ci doza', 'dose_label_az': '1-ci doza',
      ...over,
      'vaccine': {
        'code': 'MMR', 'name': 'Qızılca, parotit, məxmərək', 'name_az': 'Qızılca, parotit, məxmərək', 'route': 'Dərialtı', 'route_az': 'Dərialtı',
        ...vaccine,
      },
    });

final List<String> appCodes = [for (final l in kAppLanguages) l.code];

void main() {
  setUp(installTestI18n);

  group('vaccine label packs', () {
    test('cover all 25 app languages with every term filled', () {
      expect([...kVaccineLabelPacks.keys]..sort(), [...appCodes]..sort());
      for (final pack in kVaccineLabelPacks.values) {
        for (final value in [...pack['terms']!, ...pack['phrases']!]) {
          expect(value.trim(), isNot(''));
        }
        expect(pack['phrases']![kVaccinePhraseKeys.indexOf('dose')], contains('{n}'));
      }
    });
  });

  group('vaccineDisplayName', () {
    test('keeps the abbreviation and translates the description, never showing Azerbaijani in other languages', () {
      expect(vaccineDisplayName(row(), 'en'), 'Measles, mumps, and rubella (MMR)');
      expect(vaccineDisplayName(row(), 'ja'), '麻しん、おたふくかぜ、風しん (MMR)');
      expect(vaccineDisplayName(row(), 'ru'), 'Корь, паротит и краснуха (MMR)');
      expect(vaccineDisplayName(row({}, {'code': 'BCG', 'name': 'Vərəm (BCG)'}), 'et'), 'Tuberkuloos (BCG)');
      expect(vaccineDisplayName(row({}, {'code': 'HepB'}), 'ky'), 'B гепатити (HepB)');
      expect(vaccineDisplayName(row({}, {'code': 'HIB'}), 'zh'), 'b型流感嗜血杆菌 (Hib)');
      for (final code in appCodes.where((c) => c != 'az')) {
        expect(vaccineDisplayName(row({}, {'code': 'DTaP'}), code), matches(RegExp(r'\(DTaP\)$')));
        expect(vaccineDisplayName(row({}, {'code': 'DTaP', 'name': 'Göy öskürək, difteriya, tetanoz'}), code),
            isNot(matches(RegExp('göy öskürək', caseSensitive: false))));
      }
    });

    test('keeps the database text for Azerbaijani, unknown codes and reviewed programme names', () {
      expect(vaccineDisplayName(row(), 'az'), 'Qızılca, parotit, məxmərək');
      expect(vaccineDisplayName(row({}, {'code': 'XYZ', 'name': 'Local name'}), 'en'), 'Local name');
      final meta = {
        'protocol': 'anacan-vaccine-schedule-v1', 'version': '1', 'kind': 'routine', 'age': {'months': 2, 'days': 0}, 'end_age': null,
        'expected_age_days': 60, 'expected_dose_number': 1, 'source_url': 'x', 'source_label': 'x',
        'display_name': {'fr': 'ROR (rougeole, oreillons, rubéole)'},
      };
      expect(vaccineDisplayName(row({'schedule_meta': meta}, {'name': 'ROR (rougeole, oreillons, rubéole)'}), 'fr'),
          'ROR (rougeole, oreillons, rubéole)');
    });
  });

  group('vaccineAgeLabel / vaccineDoseLabel / vaccineRouteLabel', () {
    test('formats ages from the source label, keeping ranges and birth', () {
      expect(vaccineAgeLabel(row(), 'en'), '2 months');
      expect(vaccineAgeLabel(row({'age_label_az': '4-6 yaş'}), 'en'), '4–6 years');
      expect(vaccineAgeLabel(row({'age_label_az': 'Doğulanda'}), 'de'), 'Bei Geburt');
      expect(vaccineAgeLabel(row({'age_label_az': 'Doğulanda (0-4 həftə)'}), 'en'), 'At birth (0–4 weeks)');
      expect(vaccineAgeLabel(row({'age_label_az': '3 yaş 4 ay'}), 'en'), '3 years 4 months');
      expect(vaccineAgeLabel(row({'age_label_az': '4.5 aylıq'}), 'en'), '4.5 months');
      expect(vaccineAgeLabel(row(), 'az'), '2 aylıq');
      expect(vaccineAgeLabel(row({'age_label': 'Odd text', 'age_label_az': 'Qeyri-adi'}), 'en'), 'Odd text');
    });

    test('formats doses and routes', () {
      expect(vaccineDoseLabel(row({'dose_label_az': '3-cü doza'}), 'en'), 'Dose 3');
      expect(vaccineDoseLabel(row({'dose_label_az': '2-ci doza'}), 'ja'), '2回目');
      expect(vaccineDoseLabel(row({'dose_label_az': 'Bustər'}), 'es'), 'Refuerzo');
      expect(vaccineDoseLabel(row({'dose_label_az': 'İkinci bustər'}), 'en'), 'Second booster');
      expect(vaccineDoseLabel(row({'dose_label_az': '1-ci doza (doğulanda)'}), 'en'), 'Dose 1 (at birth)');
      expect(vaccineDoseLabel(row(), 'az'), '1-ci doza');
      expect(vaccineRouteLabel(row(), 'fr'), 'Sous-cutanée');
      expect(vaccineRouteLabel(row({}, {'route_az': 'Ağızdan (oral)'}), 'en'), 'Oral');
    });
  });

  group('vaccineAgeGroups', () {
    test('groups by recommended age days, not by translated text, in age order', () {
      final items = [
        row({'id': 'b', 'recommended_age_days': 120, 'age_label_az': '4 aylıq'}),
        row({'id': 'a1', 'recommended_age_days': 60, 'age_label_az': '2 aylıq'}),
        row({'id': 'a2', 'recommended_age_days': 60, 'age_label_az': '8 həftə'}),
        row({'id': 'a3', 'recommended_age_days': 60, 'age_label_az': '2 aylıq'}),
      ];
      final groups = vaccineAgeGroups<VaccineScheduleRow>(items, (r) => r, 'en');
      expect([for (final g in groups) [g.days, g.label, g.items.map((i) => i.id).toList()]], [
        [60, '2 months / 8 weeks', ['a1', 'a2', 'a3']],
        [120, '4 months', ['b']],
      ]);
      // Same grouping in every language.
      for (final code in appCodes) {
        expect(vaccineAgeGroups<VaccineScheduleRow>(items, (r) => r, code).map((g) => g.items.length).toList(), [3, 1]);
      }
    });
  });
}
