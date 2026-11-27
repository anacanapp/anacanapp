// Ported from: src/components/tools/ContractionTimer.tsx, src/hooks/useContractions.ts (behaviour checks; no vitest
//              suite — the maths is covered by test/domain/labor/labor_utils_test.dart)
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/tools/contraction/contraction_timer.dart';
import 'package:anacan/features/tools/contraction/contractions.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

class FakeContractionsRepository implements ContractionsRepository {
  final List<Map<String, dynamic>> rows = [];
  bool fail = false;
  int deletes = 0;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async {
    if (fail) throw StateError('offline');
    return [...rows]..sort((a, b) => '${b['start_time']}'.compareTo('${a['start_time']}'));
  }

  @override
  Future<({Object? error, Map<String, dynamic>? row})> insert(Map<String, Object?> row, {bool returnRow = false}) async {
    if (fail) return (error: StateError('Failed to fetch'), row: null);
    final stored = {...row, 'created_at': row['start_time']};
    rows.add(Map<String, dynamic>.from(stored));
    return (error: null, row: returnRow ? Map<String, dynamic>.from(stored) : null);
  }

  @override
  Future<void> deleteAll(String userId) async {
    deletes++;
    rows.clear();
  }

  @override
  void watch(Ref ref, String userId, void Function() onChange) {}
}

void main() {
  test('timer state is per user, drops a forgotten running contraction and keeps the WebView JSON', () {
    final store = LocalStore.memory();
    final now = DateTime.now().millisecondsSinceEpoch;
    saveContractionTimerState(store, 'u1', ContractionTimerState(activeStart: now - 1000, lastStart: 5, lastEnd: 6));
    expect(store.getItem('anacan_contraction_timer_v1:u1'), '{"activeStart":${now - 1000},"lastStart":5,"lastEnd":6}');
    expect(loadContractionTimerState(store, 'u1'), ContractionTimerState(activeStart: now - 1000, lastStart: 5, lastEnd: 6));
    saveContractionTimerState(store, 'u1', ContractionTimerState(activeStart: now - 31 * 60 * 1000));
    expect(loadContractionTimerState(store, 'u1').activeStart, isNull);
    expect(loadContractionTimerState(store, null), ContractionTimerState.empty);
  });

  testWidgets('start / stop saves a contraction; offline it stays queued and shows as pending', (tester) async {
    final env = PregnancyEnv();
    final repo = FakeContractionsRepository();
    await pumpTool(tester, ContractionTimer(onBack: () {}), overrides: [
      ...env.overrides,
      contractionsRepositoryProvider.overrideWithValue(repo),
    ]);
    await tester.pump();
    expect(find.text('Sancı Ölçən'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('contraction-start')));
    await tester.pump(const Duration(seconds: 2));
    await tester.tap(find.byKey(const ValueKey('contraction-stop')));
    await tester.pump();
    await tester.pump();
    expect(repo.rows, hasLength(1));
    expect(find.text('Sancılar (1)'), findsOneWidget);

    env.connectivity.setOnline(false);
    DomainClock.setSystemTime(DateTime.now().add(const Duration(minutes: 3)));
    addTearDown(DomainClock.reset);
    await tester.tap(find.byKey(const ValueKey('contraction-start')));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.byKey(const ValueKey('contraction-stop')));
    await tester.pump();
    expect(find.text('Bu cihazda saxlanıldı'), findsOneWidget);
    expect(find.text('Sinxronlaşma gözlənilir'), findsOneWidget);
    expect(env.store.getItem('anacan_contraction_queue_v1:u1'), contains('"start_time"'));

    env.connectivity.setOnline(true);
    await tester.pump();
    await tester.pump();
    expect(repo.rows, hasLength(2));
    expect(find.text('Sinxronlaşma gözlənilir'), findsNothing);

    await tester.pump(const Duration(seconds: 6)); // the top toast covers the header
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.byKey(const ValueKey('contraction-clear')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('contraction-clear-confirm')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(repo.deletes, 1);
    expect(find.text('Sancılar silindi'), findsOneWidget);
    await unmount(tester);
  });
}
