// Ported from: src/lib/illness.test.ts, src/lib/care-features.test.ts ('illness journal', and the 'feature copy'
//              case for illness)
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/health_screens/illness/illness.dart';
import 'package:anacan/features/health_screens/illness/illness_text.g.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/copy_shape.dart';

final DateTime now0 = DateTime.parse('2026-11-08T12:00:00Z');
String hoursAgo(num h, [DateTime? from]) => jsToIsoString(DateTime.fromMillisecondsSinceEpoch((from ?? now0).millisecondsSinceEpoch - (h * 3600000).round()));
var _seq = 0;

IllnessEntry entry({
  String kind = 'temp',
  String? at,
  double? tempC,
  String? medName,
  String? dose,
  double? intervalHours,
  bool remind = false,
  List<String>? symptoms,
  DateTime? now,
}) =>
    IllnessEntry(
      id: 'e${_seq++}',
      kind: kind,
      at: at ?? jsToIsoString(now ?? now0),
      tempC: tempC,
      medName: medName,
      dose: dose,
      intervalHours: intervalHours,
      remind: remind,
      symptoms: symptoms,
      by: 'mother',
      byMe: true,
    );

const String? openEnded = null;
List<String> kinds(List<IllnessEntry> entries, int? months) => illnessAlerts(openEnded, entries, months, now0).map((a) => a.kind).toList();

void main() {
  group('illnessAlerts', () {
    test('flags any fever (38 °C or more) in a baby under 3 months', () {
      expect(kinds([entry(tempC: 38)], 2), ['infant']);
      expect(kinds([entry(tempC: 38)], 0), ['infant']);
      expect(illnessAlerts(openEnded, [entry(tempC: 38.3)], 1, now0).first, const IllnessAlert('infant', temp: 38.3, months: 1));
    });

    test('does not raise the infant alert below 38 °C, from 3 months, or when the age is unknown', () {
      expect(kinds([entry(tempC: 37.9)], 1), isEmpty);
      expect(kinds([entry(tempC: 38.5)], 3), isEmpty);
      expect(kinds([entry(tempC: 38.5)], null), isEmpty);
    });

    test('uses the latest reading (entries are newest first)', () {
      expect(kinds([entry(tempC: 37.2, at: hoursAgo(0)), entry(tempC: 38.6, at: hoursAgo(2))], 1), isEmpty);
      expect(kinds([entry(tempC: 38.5, at: hoursAgo(0)), entry(tempC: 40.3, at: hoursAgo(2))], 12), isEmpty);
    });

    test('flags 40 °C or more at any age', () {
      expect(kinds([entry(tempC: 40)], 24), ['high']);
      expect(kinds([entry(tempC: 39.9)], 24), isEmpty);
      expect(kinds([entry(tempC: 40.2)], null), ['high']);
      expect(kinds([entry(tempC: 40.2)], 1), ['infant', 'high']);
    });

    test('flags breathing difficulty logged in the last 24 hours', () {
      expect(kinds([entry(kind: 'symptom', symptoms: ['cough', 'breathing'], at: hoursAgo(23))], 10), ['breathing']);
      expect(kinds([entry(kind: 'symptom', symptoms: ['breathing'], at: hoursAgo(25))], 10), isEmpty);
      expect(kinds([entry(kind: 'symptom', symptoms: ['cough'], at: hoursAgo(1))], 10), isEmpty);
    });

    test('flags fever lasting more than 3 days', () {
      IllnessEntry fever(num h, [double temp = 38.4]) => entry(tempC: temp, at: hoursAgo(h));
      expect(kinds([fever(0), fever(40), fever(73)], 24), ['long']);
      expect(kinds([fever(0), fever(72)], 24), isEmpty);
      expect(kinds([fever(0)], 24), isEmpty);
      // Normal readings do not count towards the fever span.
      expect(kinds([fever(0), fever(80, 36.9)], 24), isEmpty);
    });

    test('shows nothing once the episode has ended', () {
      final entries = [entry(tempC: 40.5), entry(kind: 'symptom', symptoms: ['breathing'])];
      expect(illnessAlerts(hoursAgo(1), entries, 1, now0), isEmpty);
    });
  });

  group('temperature units', () {
    test('converts between °C and °F', () {
      expect(cToF(37), closeTo(98.6, 1e-10));
      expect(cToF(38), closeTo(100.4, 1e-10));
      expect(cToF(40), 104);
      expect(fToC(212), 100);
      expect(fToC(100.4), closeTo(38, 1e-10));
      expect(toUnit(38.5, 'F'), 101.3);
      expect(toUnit(38.5, 'C'), 38.5);
      expect(fromUnit(101.3, 'F'), 38.5);
      expect(fromUnit(38.46, 'C'), 38.5);
    });

    test('round-trips every 0.1 °C step through the °F dial without drift', () {
      for (var tenths = 350; tenths <= 425; tenths++) {
        final c = tenths / 10;
        expect(fromUnit(toUnit(c, 'F'), 'F'), c);
      }
    });

    test('evaluates thresholds in °C whatever the unit used for input', () {
      expect(kinds([entry(tempC: fromUnit(100.4, 'F'))], 1), ['infant']);
      expect(kinds([entry(tempC: fromUnit(100.2, 'F'))], 1), isEmpty);
      expect(kinds([entry(tempC: fromUnit(104, 'F'))], 24), ['high']);
      expect(kinds([entry(tempC: fromUnit(103.7, 'F'))], 24), isEmpty);
      expect(tempBand(fToC(100.4)), 'fever');
      expect(tempBand(fToC(98.6)), 'normal');
    });

    test('formats readings in the chosen unit', () {
      expect(formatTemp(38.5, 'C', 'en-US'), '38.5 °C');
      expect(formatTemp(38.5, 'F', 'en-US'), '101.3 °F');
      expect(formatTemp(38, 'C', 'de-DE'), '38,0 °C');
      expect(formatTemp(38, 'F', 'en-US', false), '100.4');
    });

    test('defaults to °F only on US English devices', () {
      expect(defaultTempUnit('en-US'), 'F');
      expect(defaultTempUnit('en_US'), 'F');
      expect(defaultTempUnit('en-GB'), 'C');
      expect(defaultTempUnit('az-AZ'), 'C');
      expect(defaultTempUnit(null), 'C');
    });

    test('remembers the choice on this device', () {
      final store = LocalStore.memory();
      saveTempUnit(store, 'F');
      expect(readTempUnit(store, 'az-AZ'), 'F');
      saveTempUnit(store, 'C');
      expect(readTempUnit(store, 'en-US'), 'C');
      store.setItem(tempUnitKey, 'K');
      expect(readTempUnit(store, 'en-US'), defaultTempUnit('en-US'));
    });

    test('rewrites °C copy for display', () {
      expect(tempTemplate('Temperature {temp} °C. Call {number}.'), 'Temperature {temp}. Call {number}.');
      expect(tempTemplate('{temp} °Cです。'), '{temp}です。');
      expect(localizeTempText('38,0 °C eller mer', 'C'), '38,0 °C eller mer');
      expect(localizeTempText('38.0 °C or higher under 3 months', 'F', 'en-US'), '100.4 °F or higher under 3 months');
      expect(localizeTempText('39 °C以上', 'F', 'ja-JP'), '102.2 °F以上');
      expect(localizeTempText('38,0°', 'F', 'en-US'), '100.4 °F');
    });
  });

  // src/lib/care-features.test.ts
  group('illness journal', () {
    // `new Date()` in the React suite: the entries are relative to the real clock.
    final now = DateTime.now();
    String ago(num h) => hoursAgo(h, now);

    test('bands temperatures', () {
      expect(tempBand(35.5), 'low');
      expect(tempBand(36.8), 'normal');
      expect(tempBand(37.7), 'subfebrile');
      expect(tempBand(38.4), 'fever');
      expect(tempBand(39.6), 'high');
    });

    test('keeps the latest dose per medicine and computes the next allowed time from the entered interval', () {
      final entries = [
        entry(kind: 'med', medName: 'Parasetamol', dose: '5 ml', intervalHours: 6, at: ago(2), remind: true),
        entry(kind: 'med', medName: 'parasetamol', dose: '5 ml', intervalHours: 6, at: ago(8)),
        entry(kind: 'med', medName: 'Ibuprofen', dose: '2,5 ml', intervalHours: 8, at: ago(1)),
      ];
      final meds = medStatuses(entries);
      expect(meds.map((m) => m.name), ['Ibuprofen', 'Parasetamol']);
      final para = meds[1];
      expect(((para.nextAt.millisecondsSinceEpoch - para.lastAt.millisecondsSinceEpoch) / 3600000).round(), 6);
      expect(para.remind, isTrue);
      expect(earlyDose(entries, 'PARASETAMOL', now)?.minutesAgo, 120);
      expect(earlyDose(entries, 'Parasetamol', now.add(const Duration(hours: 5))), isNull);
      expect(earlyDose(entries, 'Burun damcisi', now), isNull);
    });

    test('raises the safety alerts', () {
      final startedEnded = ago(1);
      final entries = [
        entry(tempC: 40.1, at: ago(0)),
        entry(kind: 'symptom', symptoms: ['breathing'], at: ago(1)),
        entry(tempC: 38.5, at: ago(79)),
      ];
      expect(illnessAlerts(null, entries, 2, now).map((a) => a.kind), ['infant', 'breathing', 'high', 'long']);
      expect(illnessAlerts(null, [entry(tempC: 38.2, now: now)], 7, now), isEmpty);
      expect(illnessAlerts(startedEnded, entries, 2, now), isEmpty);
      expect(illnessAlerts(null, [entry(tempC: 38.2, now: now)], null, now), isEmpty);
    });

    test('counts episode days and makes stable reminder ids', () {
      final n = DateTime(2026, 11, 3, 9);
      expect(episodeDay(jsToIsoString(DateTime(2026, 11, 1, 23)), n), 3);
      expect(reminderId('a', 'Parasetamol'), reminderId('a', ' parasetamol '));
      expect(reminderId('a', 'x'), isNot(reminderId('b', 'x')));
      expect(reminderId('a', 'x'), greaterThan(0));
      expect(reminderId('a', 'x'), lessThan(1 << 31));
    });
  });

  group('feature copy', () {
    test('illness has 21 languages with the same shape and placeholders', () {
      expectSameShape(kIllnessText);
    });
  });

  // No React suite: the reminder plan of syncDoseReminders (ids 900000000+hash, texts, cancel set).
  group('dose reminder plan', () {
    test('schedules due reminders with stable ids and cancels every medicine', () {
      final now = DateTime(2026, 11, 8, 12);
      final episode = IllnessEpisode(id: 'ep1', kind: 'fever', startedAt: jsToIsoString(now));
      final entries = [
        entry(kind: 'med', medName: 'Parasetamol', dose: '5 ml', intervalHours: 6, at: jsToIsoString(now.subtract(const Duration(hours: 1))), remind: true),
        entry(kind: 'med', medName: 'Ibuprofen', dose: '2 ml', intervalHours: 8, at: jsToIsoString(now.subtract(const Duration(hours: 1)))),
      ];
      final plan = doseReminderPlan(episode, entries, title: (m) => '$m vaxtıdır', body: 'b', now: now);
      expect(plan.namespace, 'illness:ep1');
      expect(plan.cancelIds, [reminderId('ep1', 'Parasetamol'), reminderId('ep1', 'Ibuprofen')]);
      expect(plan.due.map((n) => n.id), [reminderId('ep1', 'Parasetamol')]);
      expect(plan.due.single.title, 'Parasetamol vaxtıdır');
      expect(plan.due.single.at, now.add(const Duration(hours: 5)).millisecondsSinceEpoch);
      expect(reminderId('ep1', 'Parasetamol'), inInclusiveRange(900000000, 998999999));
      final ended = IllnessEpisode(id: 'ep1', kind: 'fever', startedAt: jsToIsoString(now), endedAt: jsToIsoString(now));
      expect(doseReminderPlan(ended, entries, title: (m) => m, body: '', now: now).due, isEmpty);
    });
  });
}
