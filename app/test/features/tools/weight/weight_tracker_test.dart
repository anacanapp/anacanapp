// Ported from: src/components/tools/WeightTracker.tsx, src/hooks/useWeightEntries.ts (behaviour checks; no vitest
//              suite for the component)
import 'package:anacan/features/tools/weight/weight_entries.dart';
import 'package:anacan/features/tools/weight/weight_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

class FakeWeightRepository implements WeightRepository {
  FakeWeightRepository(this.server, [List<Map<String, dynamic>>? rows]) {
    for (final r in rows ?? const <Map<String, dynamic>>[]) {
      server.rows[r['id'] as String] = {...r, 'table': 'weight_entries'};
    }
  }
  final FakeOutboxServer server;
  final List<Map<String, Object?>> adviceBodies = [];
  final List<List<Object?>> updates = [];
  int deleteAlls = 0;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async =>
      server.table('weight_entries')..sort((a, b) => '${b['entry_date']}${b['created_at']}'.compareTo('${a['entry_date']}${a['created_at']}'));

  @override
  Future<void> delete(String id, String userId) async => server.rows.remove(id);

  @override
  Future<void> deleteAll(String userId) async {
    deleteAlls++;
    server.rows.removeWhere((_, r) => r['table'] == 'weight_entries');
  }

  @override
  Future<({Object? data, Object? error})> invokeAdvice(Map<String, Object?> body) async {
    adviceBodies.add(body);
    return (data: {'message': 'Yaxşı gedir.'}, error: null);
  }

  @override
  Future<Object?> update(String table, Map<String, Object?> values, String column, String value) async {
    updates.add([table, values, column, value]);
    return null;
  }
}

Map<String, dynamic> entry(String id, num weight, String date) =>
    {'id': id, 'user_id': 'u1', 'weight': weight, 'entry_date': date, 'notes': null, 'created_at': '${date}T08:00:00Z'};

void main() {
  testWidgets('pregnancy with a known week: IOM range, status, AI advice and the pre-eclampsia strip', (tester) async {
    final lmp = DateTime.now().subtract(const Duration(days: 20 * 7 + 2));
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'bump', 'lastPeriodDate': lmp.toUtc().toIso8601String()}));
    final repo = FakeWeightRepository(env.server, [entry('a', 62, '2026-11-20'), entry('b', 60, '2026-10-01')]);
    await pumpTool(tester, WeightTracker(onBack: () {}), overrides: [...env.overrides, weightRepositoryProvider.overrideWithValue(repo)]);
    await tester.pump();
    await tester.pump();
    expect(find.text('Çəki İzləyici'), findsOneWidget);
    expect(find.text('+2.0'), findsOneWidget);
    expect(find.text('Tövsiyə olunan aralıq'), findsOneWidget);
    expect(find.text('Yaxşı gedir.'), findsOneWidget);
    expect(repo.adviceBodies.single['isWeightAnalysis'], isTrue);
    expect('${(repo.adviceBodies.single['messages'] as List).single}', contains('20 həftə'));
    expect(find.textContaining('Dərhal zəng edin'), findsOneWidget);
    // No height yet: the BMI basis asks for it.
    expect(find.text('Boyunuzu yazın ki, aralıq BMI-yə görə hesablansın. Hələlik normal BMI aralığı göstərilir.'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('cycle users get plain BMI tracking and save their height on the device', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'flow'}), profile: testProfile({'height_cm': null}));
    final repo = FakeWeightRepository(env.server, [entry('a', 61, '2026-11-20')]);
    await pumpTool(tester, WeightTracker(onBack: () {}), overrides: [...env.overrides, weightRepositoryProvider.overrideWithValue(repo)]);
    await tester.pump();
    await tester.pump();
    expect(find.text('BMI hesablamaq üçün boyunuzu yazın.'), findsOneWidget);
    expect(find.textContaining('Dərhal zəng edin'), findsNothing);
    await tester.enterText(find.byKey(const ValueKey('weight-height-input')), '90');
    await tester.tap(find.byKey(const ValueKey('weight-height-save')));
    await tester.pump();
    expect(find.text('Boyu sm ilə daxil edin (120-220)'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('weight-height-input')), '165,5');
    await tester.tap(find.byKey(const ValueKey('weight-height-save')));
    await tester.pump();
    expect(env.store.getItem('anacan:weight-tracker:height-cm:u1'), '165.5');
    expect(repo.updates.single, ['profiles', {'height_cm': 165.5}, 'user_id', 'u1']);
    expect(find.text('Hazırkı BMI 22.3 (normal)'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('the add sheet validates "65,5" style input and saves through the outbox', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'mommy'}));
    final repo = FakeWeightRepository(env.server);
    await pumpTool(tester, WeightTracker(onBack: () {}), overrides: [...env.overrides, weightRepositoryProvider.overrideWithValue(repo)]);
    await tester.pump();
    expect(find.text('DOĞUŞDAN SONRA'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('weight-add')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('weight-input')), '12');
    await tester.tap(find.byKey(const ValueKey('weight-save')));
    await tester.pump();
    expect(find.text('Çəkini kq ilə daxil edin, məs. 65,5 (30-250)'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('weight-input')), '65,5');
    await tester.tap(find.byKey(const ValueKey('weight-save')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    final saved = env.server.table('weight_entries').single;
    expect(saved['weight'], 65.5);
    expect(find.text('Çəki yadda saxlandı! ⚖️'), findsOneWidget);
    expect(find.text('65.5 kg'), findsWidgets);
    await unmount(tester);
  });
}
