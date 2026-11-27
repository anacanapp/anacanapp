// Ported from: src/lib/bloodPressure.test.ts, src/lib/redFlags.test.ts, src/lib/emergency.test.ts
// (emergency: the getEmergencyNumber / fillEmergencyNumber cases; the locale-file and MedicalDisclaimer render
// cases test translation files and a React component and belong to the i18n / UI ports)

import 'package:anacan/domain/health/blood_pressure.dart';
import 'package:anacan/domain/health/emergency.dart';
import 'package:anacan/domain/health/red_flags.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifyBp', () {
    test('classifies a normal reading as normal, no pregnancy alert', () {
      final r = classifyBp(110, 70, false);
      expect(r.category, 'normal');
      expect(r.pregnancyAlert, 'none');
    });
    test('classifies elevated (120-129 systolic, <80 diastolic)', () => expect(classifyBp(125, 75, false).category, 'elevated'));
    test('does not label a single 120/80 reading as hypertension in either life stage', () {
      for (final p in [true, false]) {
        final r = classifyBp(120, 80, p);
        expect(RegExp('hipertenziya|hypertension', caseSensitive: false).hasMatch(r.label), false);
        expect(r.pregnancyAlert, 'none');
      }
      expect(classifyBp(120, 80, true).category, 'normal');
    });
    test('keeps borderline pregnancy readings under observation without using adult stage1 labels', () {
      expect(classifyBp(129, 84, true).category, 'normal');
      expect(classifyBp(130, 75, true).category, 'elevated');
      expect(classifyBp(120, 85, true).category, 'elevated');
      expect(classifyBp(139, 89, true).category, 'elevated');
      expect(classifyBp(140, 80, true).category, 'stage2');
      expect(classifyBp(120, 90, true).category, 'stage2');
    });
    test('preserves the adult AHA monitoring range (130-139/80-89)', () {
      expect(classifyBp(135, 85, false).category, 'stage1');
      expect(classifyBp(125, 82, false).category, 'stage1');
    });
    test('classifies stage2 hypertension (>=140/>=90)', () => expect(classifyBp(145, 92, false).category, 'stage2'));
    test('classifies hypertensive crisis (>=180/>=120) regardless of pregnancy', () => expect(classifyBp(185, 125, false).category, 'crisis'));
    test('classifies low blood pressure (<90 systolic OR <60 diastolic)', () {
      expect(classifyBp(85, 55, false).category, 'low');
      expect(classifyBp(100, 55, false).category, 'low');
    });
    test('does NOT raise a pregnancy alert for a non-pregnant user regardless of reading', () {
      expect(classifyBp(165, 115, false).pregnancyAlert, 'none');
    });
    test('raises "warning" for a pregnant user at >=140/90 (gestational hypertension threshold)', () {
      expect(classifyBp(140, 90, true).pregnancyAlert, 'warning');
      expect(classifyBp(142, 88, true).pregnancyAlert, 'warning');
      expect(classifyBp(138, 91, true).pregnancyAlert, 'warning');
    });
    test('raises "urgent" for a pregnant user at >=160/110 (severe preeclampsia threshold)', () {
      expect(classifyBp(160, 100, true).pregnancyAlert, 'urgent');
      expect(classifyBp(150, 110, true).pregnancyAlert, 'urgent');
      expect(classifyBp(170, 115, true).pregnancyAlert, 'urgent');
    });
    test('does not falsely raise a pregnancy alert just below the warning threshold', () {
      expect(classifyBp(139, 89, true).pregnancyAlert, 'none');
    });
    test('boundary values are inclusive (exactly at threshold triggers the alert)', () {
      expect(classifyBp(140, 89, true).pregnancyAlert, 'warning');
      expect(classifyBp(160, 109, true).pregnancyAlert, 'urgent');
    });
    test('copy comes from tr with the Azerbaijani default (keys preserved)', () {
      final seen = <String>[];
      final r = classifyBp(185, 125, false, tr: (k, d) {
        seen.add(k);
        return d;
      });
      expect(seen, ['bp_cat_crisis', 'bp_guide_crisis']);
      expect(r.guidance, contains('{emergency}'));
      expect([r.emoji, r.bg], ['🚨', 'var(--a-alert-bg)']);
    });
  });

  group('getDangerSignsForStage', () {
    List<String> ids(List<DangerSign> l) => l.map((d) => d.id).toList();
    test('lists urgent signs before the "soon" ones', () {
      for (final stage in ['bump', 'mommy']) {
        final sev = getDangerSignsForStage(stage).map((d) => d.severity).toList();
        final firstSoon = sev.indexOf('soon');
        expect(firstSoon, greaterThan(0));
        expect(sev.sublist(firstSoon).every((s) => s == 'soon'), true);
      }
    });
    test('keeps pregnancy and postpartum signs apart', () {
      final bump = ids(getDangerSignsForStage('bump')), mommy = ids(getDangerSignsForStage('mommy'));
      expect(bump, contains('decreased_movement'));
      expect(bump, isNot(contains('heavy_bleeding_pp')));
      expect(mommy, contains('heavy_bleeding_pp'));
      expect(mommy, contains('sad_thoughts'));
      expect(mommy, isNot(contains('waters_broke')));
      for (final id in ['fever_38', 'chest_pain_breath']) {
        expect(bump, contains(id));
        expect(mommy, contains(id));
      }
    });
    test('treats an unknown or missing stage as pregnancy', () {
      expect(ids(getDangerSignsForStage(null)), ids(getDangerSignsForStage('bump')));
      expect(ids(getDangerSignsForStage('partner')), ids(getDangerSignsForStage('bump')));
    });
    test('shows the twin (TTTS) sign only for multiples', () {
      expect(ids(getDangerSignsForStage('bump')), isNot(contains('ttts_signs')));
      expect(ids(getDangerSignsForStage('bump', isMultiplesPregnancy: true)), contains('ttts_signs'));
      expect(ids(getDangerSignsForStage('mommy', isMultiplesPregnancy: true)), isNot(contains('ttts_signs')));
    });
    test('has unique ids, text and at least one stage for every sign', () {
      final all = dangerSigns();
      expect(all.map((d) => d.id).toSet().length, all.length);
      for (final s in all) {
        expect(s.title, isNotEmpty);
        expect(s.desc, isNotEmpty);
        expect(s.stages, isNotEmpty);
      }
    });
  });

  group('getEmergencyNumber', () {
    for (final (country, number) in [
      ('AZ', '103'), ('GB', '999'), ('US', '911'), ('CA', '911'),
      ('RU', '103'), ('KZ', '103'), ('KG', '103'), ('UZ', '103'), ('BY', '103'), ('UA', '103'),
      ('TR', '112'), ('GE', '112'), ('DE', '112'), ('FR', '112'), ('EE', '112'), ('SE', '112'), ('PL', '112'),
    ]) {
      test('$country -> $number', () {
        expect(getEmergencyNumber(country), number);
        expect(getEmergencyNumber(country.toLowerCase()), number);
      });
    }
    test('falls back to 112 when the country is unknown or missing', () {
      expect(fallbackEmergencyNumber, '112');
      for (final v in [null, '', 'ZZ', 'not-a-country', '1']) {
        expect(getEmergencyNumber(v), '112');
      }
    });
    test('has a number for every country the app languages point at', () {
      for (final code in ['AZ', 'GB', 'TR', 'RU', 'DE', 'SA', 'GE', 'KZ', 'UZ', 'CN', 'ID', 'FR', 'ES', 'PT', 'VN', 'IN', 'JP', 'KR', 'PL', 'NL', 'SE', 'KG', 'EE']) {
        expect(RegExp(r'^\d{3,5}$').hasMatch(getEmergencyNumber(code)), true, reason: code);
      }
    });
  });

  group('fillEmergencyNumber', () {
    test('fills the placeholder', () {
      expect(fillEmergencyNumber('In an emergency, call {emergency}.', '999'), 'In an emergency, call 999.');
    });
    test('rewrites the legacy literal 103 from cached copy without touching other digits', () {
      expect(fillEmergencyNumber('In an emergency, call 103.', '911'), 'In an emergency, call 911.');
      expect(fillEmergencyNumber('Təcili hallarda 103-ə zəng edin.', '103'), 'Təcili hallarda 103-ə zəng edin.');
      expect(fillEmergencyNumber('Call 1030 or +103 or 2103', '999'), 'Call 1030 or +103 or 2103');
    });
  });
}
