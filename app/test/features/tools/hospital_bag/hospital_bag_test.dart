// Ported from: src/components/tools/HospitalBag.tsx, src/hooks/useHospitalBagSync.ts (behaviour checks; no vitest
//              suite for the component / hook)
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/hospital_bag/hospital_bag.dart';
import 'package:anacan/features/tools/hospital_bag/hospital_bag_logic.dart';
import 'package:anacan/features/tools/hospital_bag/hospital_bag_sync.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';
import '../support/tools_harness.dart' show FakeToolsSource;

class FakeBagRepository implements HospitalBagRepository {
  final List<BagRow> rows = [];
  bool hiddenColumn = true;
  bool partnerAllowed = false;
  final List<String> log = [];
  var _id = 0;

  BagRow _store(Map<String, Object?> r) {
    final row = <String, dynamic>{
      'id': 'row${_id++}',
      'created_at': '2026-11-0${_id}T00:00:00Z',
      'updated_at': '2026-11-01T00:00:00Z',
      'added_by': null,
      'notes': null,
      if (hiddenColumn) 'is_hidden': false,
      ...r,
    };
    rows.add(row);
    return row;
  }

  @override
  Future<List<BagRow>> load(String ownerUserId) async => [for (final r in rows) Map<String, dynamic>.of(r)];

  @override
  Future<({List<BagRow>? rows, Object? error})> upsert(List<Map<String, Object?>> list, {required bool ignoreDuplicates}) async {
    log.add('upsert:${list.length}');
    return (rows: [for (final r in list) _store(r)], error: null);
  }

  @override
  Future<({BagRow? row, Object? error})> insert(Map<String, Object?> row) async {
    log.add('insert:${row['category']}');
    if (row['category'] == 'partner' && !partnerAllowed) return (row: null, error: {'code': '23514'});
    return (row: _store(row), error: null);
  }

  @override
  Future<Object?> update(String ownerUserId, String itemId, Map<String, Object?> values) async {
    log.add('update:$itemId:$values');
    if (values.containsKey('is_hidden') && !hiddenColumn) return {'code': 'PGRST204'};
    for (final r in rows) {
      if (r['item_id'] == itemId) r.addAll(values);
    }
    return null;
  }

  @override
  Future<Object?> delete(String ownerUserId, String itemId) async {
    log.add('delete:$itemId');
    rows.removeWhere((r) => r['item_id'] == itemId);
    return null;
  }

  @override
  void watch(Ref ref, String ownerUserId, String role, {required void Function() onChange, required void Function(String? id) onDelete}) {}
}

final templates = [
  {'id': 't-passport', 'item_name': 'Passport', 'category': 'documents', 'priority': 1, 'notes': 'Şəxsiyyət vəsiqəsi', 'sort_order': 1},
  {'id': 't-gown', 'item_name': 'Xalat', 'category': 'mom', 'priority': 2, 'notes': null, 'sort_order': 2},
];

void main() {
  testWidgets('seeds the default items, toggles, adds a partner item (old constraint) and hides on the device', (tester) async {
    final env = PregnancyEnv();
    final repo = FakeBagRepository()..hiddenColumn = false;
    await pumpTool(tester, HospitalBag(onBack: () {}), overrides: [
      ...env.overrides,
      hospitalBagRepositoryProvider.overrideWithValue(repo),
      toolsDataSourceProvider.overrideWithValue(FakeToolsSource({'hospital_bag_templates': templates})),
    ]);
    await tester.pump();
    await tester.pump();
    await tester.pump();
    expect(find.text('Xəstəxana Çantası'), findsOneWidget);
    expect(repo.log.first, 'upsert:2');
    expect(find.text('0/2'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('bag-check-t-gown')));
    await tester.pump();
    expect(find.text('1/2'), findsOneWidget);
    expect(repo.rows.firstWhere((r) => r['item_id'] == 't-gown')['is_checked'], isTrue);

    await tester.tap(find.byKey(const ValueKey('bag-add-open')));
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('bag-new-item')), '  Telefon   şarjı ');
    await tester.tap(find.byKey(const ValueKey('bag-new-cat-partner')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('bag-add-submit')));
    await tester.pump();
    await tester.pump();
    expect(repo.log.where((l) => l.startsWith('insert')).toList(), ['insert:partner', 'insert:mom']);
    final custom = repo.rows.last;
    expect(custom['item_id'], startsWith('custom:partner:'));
    expect(custom['item_name'], 'Telefon şarjı');
    expect(find.text('Telefon şarjı'), findsOneWidget);
    expect(find.text('Partnyor üçün'), findsOneWidget);

    // No is_hidden column: hiding a default item is remembered on this device.
    await tester.tap(find.byKey(const ValueKey('bag-remove-t-passport')));
    await tester.pump();
    await tester.pump();
    expect(readLocalHidden(env.store, 'u1'), ['t-passport']);
    expect(find.text('Gizlədilənlər (1)'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('bag-hidden-toggle')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('bag-show-t-passport')));
    await tester.pump();
    await tester.pump();
    expect(readLocalHidden(env.store, 'u1'), isEmpty);

    // Own items are deleted after a confirm.
    await tester.tap(find.byKey(ValueKey('bag-remove-${custom['item_id']}')));
    await tester.pump();
    await tester.pump();
    expect(env.confirms.single, 'Bu əşya siyahıdan silinsin?');
    expect(repo.rows.where((r) => r['item_id'] == custom['item_id']), isEmpty);
    await unmount(tester);
  });
}
