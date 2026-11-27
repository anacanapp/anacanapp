// Ported from: src/components/tools/MaternityCalculator.tsx, src/components/tools/RegionalMaternityCalculator.tsx,
//              src/lib/maternity-i18n.ts (behaviour checks; the maths is covered by
//              test/domain/maternity/maternity_rules_test.dart and maternity_regional_test.dart)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/tools/maternity/maternity_benefits.dart';
import 'package:anacan/features/tools/maternity/maternity_calculator.dart';
import 'package:anacan/features/tools/maternity/maternity_copy.dart';
import 'package:anacan/features/tools/maternity/maternity_copy.g.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

class FakeMaternityRepository implements MaternityRepository {
  @override
  Future<List<Map<String, dynamic>>> config() async => [
        {'config_key': 'min_salary', 'value': 400},
        {'config_key': 'birth_benefit', 'value': 600},
      ];

  @override
  Future<List<Map<String, dynamic>>> guidelines() async => [
        {'id': 'g1', 'title': 'Sənədlər', 'content': 'Arayış lazımdır', 'icon': '📄', 'sort_order': 1},
      ];
}

Map<String, dynamic> _json(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  test('the generated copy matches scripts/i18n and src/data (run gen_pregnancy_copy.mjs after changes)', () {
    final maternity = _json('../scripts/i18n/maternity36-copy.json')['languages'] as Map<String, dynamic>;
    for (final lang in maternity.keys) {
      expect(kMaternityCopy[lang], Map<String, String>.from(maternity[lang] as Map), reason: lang);
    }
    final policy = _json('../src/data/maternity-regional.json');
    expect(kMaternityReviewedAt, policy['reviewedAt']);
    for (final e in (policy['countries'] as Map<String, dynamic>).entries) {
      expect(kMaternityCountryInput[e.key], (e.value as Map)['input']);
      expect(kMaternityCountrySources[e.key]!.map((s) => s.url).toList(), [for (final s in (e.value as Map)['sources'] as List) (s as Map)['url']]);
    }
    expect(maternityText('title', 'zz').isNotEmpty, isTrue); // unknown language → English
    expect(pregnancyFollowupText('names_country', 'az', {'country': 'X'}), contains('X'));
  });

  testWidgets('Azerbaijan mother: backend config benefit, timeline and the DSMF guide', (tester) async {
    final env = PregnancyEnv(profile: testProfile({'country_code': 'AZ', 'due_date': '2027-03-10'}));
    await pumpTool(tester, MaternityCalculator(onBack: () {}), overrides: [...env.overrides, maternityRepositoryProvider.overrideWithValue(FakeMaternityRepository())]);
    await tester.pump();
    await tester.pump();
    expect(find.text('Dekret Kalkulyatoru'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('maternity-salary')), '1000');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('maternity-calculate')));
    await tester.pump();
    expect(tester.widget<Text>(find.byKey(const ValueKey('maternity-total'))).data, '126 gün');
    expect(find.text('Yekun Ödəniş'), findsOneWidget);
    expect(find.text('Doğum müavinəti'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('maternity-tab-guide')));
    await tester.pump();
    expect(find.text('Sənədlər'), findsOneWidget);
    expect(find.textContaining('DSMF'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('a father sees the paternity rules instead of a broken money card', (tester) async {
    final env = PregnancyEnv(profile: testProfile({'country_code': 'TR', 'due_date': '2027-03-10'}));
    await pumpTool(tester, MaternityCalculator(onBack: () {}), overrides: [...env.overrides, maternityRepositoryProvider.overrideWithValue(FakeMaternityRepository())]);
    await tester.pump();
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('maternity-role-father')));
    await tester.pump();
    expect(find.byKey(const ValueKey('maternity-salary')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('maternity-calculate')));
    await tester.pump();
    expect(find.text('Ödəniş Qaydaları'), findsOneWidget);
    expect(find.text('Atalıq məzuniyyətinin başlanğıcı'), findsOneWidget);
    expect(find.text('Yekun Ödəniş'), findsNothing);
    await unmount(tester);
  });

  testWidgets('a regional country renders the regional calculator with its policy text', (tester) async {
    final env = PregnancyEnv(profile: testProfile({'country_code': 'FR', 'due_date': '2027-03-10'}));
    await pumpTool(tester, MaternityCalculator(onBack: () {}), overrides: env.overrides);
    await tester.pump();
    expect(find.byKey(const ValueKey('regional-country')), findsOneWidget);
    expect(find.byKey(const ValueKey('regional-rule-duration')), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('regional-earning-0')).first, '-5');
    await tester.tap(find.byKey(const ValueKey('regional-calculate')));
    await tester.pump();
    expect(find.text(maternityText('input_error', 'az')), findsOneWidget);
    await unmount(tester);
  });
}
