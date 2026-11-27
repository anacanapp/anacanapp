// Ported from: src/components/tools/HoroscopeCompatibility.tsx, src/hooks/useHoroscope.ts (behaviour checks; no
//              vitest suite)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/tools/horoscope/horoscope_compatibility.dart';
import 'package:anacan/features/tools/horoscope/horoscope_data.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

final _signs = [
  {'id': 'z1', 'name': 'Oğlaq', 'symbol': '♑', 'start_date': '12-22', 'end_date': '01-19', 'element': 'earth', 'sort_order': 10},
  {'id': 'z2', 'name': 'Dolça', 'symbol': '♒', 'start_date': '01-20', 'end_date': '02-18', 'element': 'air', 'sort_order': 11},
];

Map<String, Object?> _result() => {
  'charts': {
    'mom': {
      'sun': {'sign': 'capricorn', 'signAz': 'Oğlaq', 'symbol': '♑', 'element': 'earth'},
      'moon': {'sign': 'leo', 'signAz': 'Şir', 'symbol': '♌'},
      'rising': null,
      'birthDate': '1990-01-15',
    },
    'dad': null,
    'baby': null,
  },
  'analysis': {
    'overallScore': 85,
    'keywords': ['Sevgi'],
    'momAnalysis': 'Ana sabitdir',
    'dadAnalysis': '',
    'babyAnalysis': '',
    'familyDynamics': 'Ailə',
    'momBabyConnection': '',
    'dadBabyConnection': '',
    'parentCompatibility': '',
    'recommendations': ['Birlikdə gəzin'],
    'luckyColors': ['Mavi'],
    'luckyDays': ['Bazar'],
    'luckyNumbers': ['7'],
  },
};

void main() {
  setUpAll(ensureDateLocales);

  testWidgets('mother birth date → sign, two optional steps, analysis, saved reading and the result view', (tester) async {
    final env = MediaEnv();
    env.db.tables['zodiac_signs'] = [for (final s in _signs) Map<String, dynamic>.of(s)];
    env.db.functions['analyze-horoscope'] = (_) => _result();
    await pumpMediaTool(tester, HoroscopeCompatibility(onBack: () {}), overrides: env.overrides);
    await settle(tester);
    expect(find.text('Oğlaq'), findsOneWidget); // zodiac grid

    await tester.tap(find.byKey(const ValueKey('horo-birth-date')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byKey(const ValueKey('day-15')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byKey(const ValueKey('horo-sign')), findsOneWidget);
    expect(find.textContaining('Torpaq'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('horo-next')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('horo-next')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('horo-analyze')));
    await settle(tester);

    expect(env.usage.consumed, ['horoscope']);
    expect(env.db.callsOf('invoke', 'analyze-horoscope').single.body, {'mom_birth_date': '1990-01-15', 'language': 'en'});
    final saved = env.db.callsOf('insert', 'horoscope_readings').single.body! as Map;
    expect(saved['mom_sign'], 'capricorn');
    expect(saved.containsKey('dad_sign'), isFalse);
    expect(find.text('85%'), findsOneWidget);
    expect(find.text('🌟 Əla uyğunluq!'), findsOneWidget);
    expect(env.toasts.single.title, 'Analiz tamamlandı!');

    await tester.tap(find.byKey(const ValueKey('horo-share')));
    await tester.pump();
    expect(env.shares.single, contains('Oğlaq'));
    expect(env.shares.single, contains('85%'));
    await unmountMediaTool(tester);
  });

  group('horoscope helpers', () {
    test('signs crossing the new year match both sides', () {
      expect(getZodiacSign(DateTime(1990, 12, 25), _signs)?['id'], 'z1');
      expect(getZodiacSign(DateTime(1990, 1, 19), _signs)?['id'], 'z1');
      expect(getZodiacSign(DateTime(1990, 1, 20), _signs)?['id'], 'z2');
      expect(getZodiacSign(DateTime(1990, 6, 1), _signs), isNull);
    });

    test('the payload carries times only when known and prefers the due date for an expected baby', () {
      final mom = HoroscopePerson(birthDate: DateTime(1990, 1, 15), birthTime: '08:30', hasBirthTime: true);
      final dad = HoroscopePerson(birthDate: DateTime(1988, 3, 2));
      final baby = HoroscopePerson(birthDate: DateTime(2026, 5, 1), birthTime: '12:00', hasBirthTime: true);
      expect(horoscopePayload(mom: mom, dad: dad, baby: baby, isBabyExpected: true, expectedDueDate: DateTime(2027, 2, 3)), {
        'mom_birth_date': '1990-01-15',
        'mom_birth_time': '08:30',
        'dad_birth_date': '1988-03-02',
        'baby_due_date': '2027-02-03',
      });
      expect(horoscopePayload(mom: mom, dad: const HoroscopePerson(), baby: baby, isBabyExpected: false)['baby_birth_time'], '12:00');
    });

    test('element compatibility is symmetric and defaults to 70', () {
      expect(getElementCompatibility('fire', 'air').score, 90);
      expect(getElementCompatibility('air', 'fire').score, 90);
      expect(getElementCompatibility('earth', 'earth').score, 95);
      expect(getElementCompatibility('fire', 'ether').score, 70);
    });

    test('pair compatibility matches either order and the relationship type', () {
      final rows = [
        {'sign1': 'leo', 'sign2': 'aries', 'relationship_type': 'parent_child', 'compatibility_score': 90},
      ];
      expect(calculateCompatibility('aries', 'leo', rows)?['compatibility_score'], 90);
      expect(calculateCompatibility('aries', 'leo', rows, 'partners'), isNull);
    });

    test('score messages by band', () {
      expect(horoscopeScoreMessage(95), '💫 Mükəmməl kosmik harmoniya!');
      expect(horoscopeScoreMessage(10), '💝 Fərqlilik gücünüzdür!');
    });
  });
}
