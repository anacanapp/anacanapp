// Ported from: src/data/pregnancy-loss/pregnancy-loss.test.ts
import 'package:anacan/features/health_screens/common/feature_text.dart';
import 'package:anacan/features/health_screens/loss/pregnancy_loss.dart';
import 'package:anacan/features/health_screens/loss/pregnancy_loss_text.g.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

Object? _shape(Object? value) {
  if (value is List) return value.isNotEmpty && value.first is String ? ['strings', value.length] : [for (final v in value) _shape(v)];
  if (value is Map) return {for (final e in value.entries) e.key: _shape(e.value)};
  return value.runtimeType.toString();
}

List<String> _placeholders(String s) => [for (final m in RegExp(r'\{\w+\}').allMatches(s)) m[0]!]..sort();

void main() {
  group('pregnancy loss content', () {
    test('has the same shape, placeholders and an emergency number in all 21 languages', () {
      final languages = kPregnancyLossText.keys.toList()..sort();
      expect(languages, (['ar', 'az', 'de', 'en', 'es', 'fr', 'hi', 'id', 'ja', 'ka', 'kk', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'uz', 'vi', 'zh', 'ky', 'et', 'tk', 'uk']..sort()));
      final az = kPregnancyLossText['az']!;
      final azUi = az['ui']! as Map;
      for (final lang in languages) {
        final t = kPregnancyLossText[lang]!;
        expect(_shape(t), _shape(az), reason: lang);
        final ui = t['ui']! as Map;
        for (final e in azUi.entries) {
          if (e.value is! String) continue;
          expect(_placeholders(ui[e.key] as String), _placeholders(e.value as String), reason: '$lang.${e.key}');
        }
        final text = FeatureText(t);
        expect(lossEmergencyNumber(text), matches(RegExp(r'^\d{3}$')), reason: lang);
        expect(text.items('weeks'), hasLength(8));
        expect(text.sub('partner').items('phases'), hasLength(4));
        expect(text.sub('ui').list('moods'), hasLength(5));
        expect(text.sub('ui').list('mood_reply'), hasLength(5));
      }
    });
  });

  group('recovery weeks', () {
    DateTime at(String iso) => DateTime.parse('${iso}T12:00:00');
    test('counts weeks 1..8 from the loss date and ends after eight weeks', () {
      expect(lossDays('2026-10-01', at('2026-10-01')), 0);
      expect(lossWeek('2026-10-01', at('2026-10-01')), 1);
      expect(lossWeek('2026-10-01', at('2026-10-07')), 1);
      expect(lossWeek('2026-10-01', at('2026-10-08')), 2);
      expect(lossWeek('2026-10-01', at('2026-11-25')), 8);
      expect(lossWeek('2026-10-01', at('2026-11-26')), isNull);
      expect(lossWeek(null), isNull);
      expect(lossWeek('not a date'), isNull);
    });
    test('groups weeks into four partner phases', () {
      expect([1, 2, 3, 4, 5, 6, 7, 8].map(lossPhase), [0, 0, 1, 1, 2, 2, 3, 3]);
    });
  });

  // No React suite: src/lib/pregnancy-loss.ts device storage.
  group('kept on this device', () {
    test('the letter is trimmed to 5000 characters and removed when empty', () {
      final store = LocalStore.memory();
      expect(saveLossLetter(store, 'u1', 'x' * 6000), isTrue);
      expect(loadLossLetter(store, 'u1'), hasLength(5000));
      saveLossLetter(store, 'u1', '   ');
      expect(store.getItem('anacan_loss_letter_v1:u1'), isNull);
      expect(loadLossLetter(store, 'u1'), '');
    });
    test('the checklist is a JSON map per user', () {
      final store = LocalStore.memory();
      saveLossTodos(store, 'u1', {'1:0': true});
      expect(store.getItem('anacan_loss_todo_v1:u1'), '{"1:0":true}');
      expect(loadLossTodos(store, 'u1'), {'1:0': true});
      store.setItem('anacan_loss_todo_v1:u2', 'not json');
      expect(loadLossTodos(store, 'u2'), isEmpty);
    });
    test('isoDay keeps the local calendar date', () {
      expect(isoDay(DateTime(2026, 3, 5, 23, 59)), '2026-03-05');
    });
  });
}
