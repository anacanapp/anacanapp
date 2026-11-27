// Ported from: src/components/tools/FetalGrowthTracker.tsx, src/hooks/useFetalGrowthScans.ts (behaviour checks; the
//              Hadlock maths is covered by test/domain/pregnancy/fetal_size_test.dart)
import 'package:anacan/features/tools/fetal_growth/fetal_growth_scans.dart';
import 'package:anacan/features/tools/fetal_growth/fetal_growth_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

class FakeFetalRepository implements FetalGrowthRepository {
  final List<Map<String, dynamic>> rows = [];
  var _id = 0;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async => [...rows]..sort((a, b) => '${a['scan_date']}'.compareTo('${b['scan_date']}'));

  @override
  Future<Map<String, dynamic>> insert(Map<String, Object?> row) async {
    final r = <String, dynamic>{'id': 's${_id++}', 'created_at': '2026-11-01', ...row};
    rows.add(r);
    return r;
  }

  @override
  Future<void> delete(String id, String userId) async => rows.removeWhere((r) => r['id'] == id);
}

String ymd(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

void main() {
  testWidgets('twins: latest EFW per baby with percentile, discordance and the add sheet', (tester) async {
    final lmp = DateTime.now().subtract(const Duration(days: 30 * 7));
    final env = PregnancyEnv(
      store: userStore(user: {'lifeStage': 'bump', 'lastPeriodDate': lmp.toUtc().toIso8601String()}),
      profile: testProfile({'baby_count': 2, 'multiples_type': 'twins'}),
    );
    final repo = FakeFetalRepository()
      ..rows.addAll([
        {'id': 'a1', 'user_id': 'u1', 'baby_label': 'A', 'scan_date': ymd(lmp.add(const Duration(days: 28 * 7))), 'efw_grams': 1150, 'created_at': ''},
        {'id': 'b1', 'user_id': 'u1', 'baby_label': 'B', 'scan_date': ymd(lmp.add(const Duration(days: 28 * 7))), 'efw_grams': 850, 'created_at': ''},
      ]);
    await pumpTool(tester, FetalGrowthTracker(onBack: () {}), overrides: [...env.overrides, fetalGrowthRepositoryProvider.overrideWithValue(repo)]);
    await tester.pump();
    await tester.pump();
    expect(find.text('Fetal Böyümə İzləyicisi'), findsOneWidget);
    expect(find.text('KÖRPƏ A'), findsOneWidget);
    expect(find.text('1150 q'), findsOneWidget);
    // (1150 − 850) / 1150 = 26 % → high
    expect(find.text('Əhəmiyyətli fərq — həkiminizlə müzakirə edin'), findsOneWidget);
    expect(find.text('Körpələr arasında çəki fərqi: 26%'), findsOneWidget);
    expect(find.byKey(const ValueKey('fetal-chart')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('fetal-add')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('fetal-label-B')));
    await tester.enterText(find.byKey(const ValueKey('fetal-efw')), '50');
    await tester.tap(find.byKey(const ValueKey('fetal-save')));
    await tester.pump();
    expect(repo.rows, hasLength(2)); // under 100 g is ignored
    await tester.enterText(find.byKey(const ValueKey('fetal-efw')), '1300');
    await tester.tap(find.byKey(const ValueKey('fetal-save')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(repo.rows.last['baby_label'], 'B');
    expect(repo.rows.last['efw_grams'], 1300);
    expect(find.text('USM qeydi yadda saxlandı! 🤰'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('without a last period date the scan week and percentile stay unknown', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'bump'}));
    final repo = FakeFetalRepository()..rows.add({'id': 'a1', 'user_id': 'u1', 'baby_label': 'A', 'scan_date': '2026-10-01', 'efw_grams': 900, 'created_at': ''});
    await pumpTool(tester, FetalGrowthTracker(onBack: () {}), overrides: [...env.overrides, fetalGrowthRepositoryProvider.overrideWithValue(repo)]);
    await tester.pump();
    await tester.pump();
    expect(find.text('900 q'), findsNWidgets(2));
    expect(find.textContaining('p'), findsWidgets);
    expect(find.text('–'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('fetal-delete-a1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('confirm-delete')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(repo.rows, isEmpty);
    expect(find.text('Hələ USM qeydi yoxdur'), findsOneWidget);
    await unmount(tester);
  });
}
