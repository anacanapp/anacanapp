// Ported from: src/components/tools/parenting/PartnerParentingScreen.test.tsx (the partner side: usePartnerData →
//              the child ParentingToolView starts on). The parenting tool's own port of this file
//              (test/features/tools/parenting/parenting_entry_test.dart) feeds PartnerParentingData by hand; here the
//              data comes from the partner feature's provider.
import 'package:anacan/domain/parenting/parenting.dart' show milestoneAge;
import 'package:anacan/features/partner/data/partner_data.dart';
import 'package:anacan/features/partner/data/partner_sharing.dart';
import 'package:anacan/features/partner/screens/partner_parenting.dart';
import 'package:anacan/features/partner/screens/screens_wiring.dart';
import 'package:anacan/features/tools/parenting/partner_parenting_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'screens_support.dart';

final DateTime _now = DateTime(2026, 11, 7, 10);

PartnerData _data(List<Object?> rows, {Map<String, dynamic>? profile}) => PartnerData(
      source: PartnerDataState(partnerProfile: profile == null ? null : PartnerWomanData(profile), children: normalizePartnerChildren(rows), loading: false),
      sharing: PartnerSharing.defaults,
    );

({int? months, bool corrected}) _partnerMilestone(PartnerParentingData data) {
  final child = partnerParentingStartChild(data);
  return milestoneAge(child?.birthDate, child?.dueDate, _now);
}

void main() {
  group('partner_children_v1 rows', () {
    test('keep a valid due date and give null when the old function has none', () {
      final rows = normalizePartnerChildren([
        {'id': 'a', 'name': 'Aysel', 'birth_date': '2026-01-08', 'gender': 'girl', 'avatar_emoji': null, 'sort_order': 0, 'is_current': true, 'due_date': '2026-03-15'},
        {'id': 'b', 'name': 'Murad', 'birth_date': '2024-07-07', 'gender': 'boy', 'avatar_emoji': null, 'is_current': false},
        {'id': 'c', 'name': 'X', 'birth_date': null, 'gender': null, 'avatar_emoji': null, 'is_current': false, 'due_date': 'soon'},
        null,
        {'name': 'no id'},
      ]);
      expect([for (final r in rows) (r.id, r.dueDate)], [('a', '2026-03-15'), ('b', null), ('c', null)]);
      // … and reach the parenting tool unchanged.
      final data = partnerParentingDataOf(_data(rows.map((r) => r.toRow()).toList()));
      expect([for (final c in data.children) (c.id, c.dueDate)], [('a', '2026-03-15'), ('b', null), ('c', null)]);
    });
  });

  group('partner Tərbiyə corrected age', () {
    test('a preterm baby gets the corrected age on the partner side (10 months, born ~31 weeks → 7 corrected months)', () {
      final data = partnerParentingDataOf(_data([
        {'id': 'a', 'name': 'Aysel', 'birth_date': '2026-01-08', 'gender': 'girl', 'avatar_emoji': null, 'is_current': true, 'due_date': '2026-03-15'},
      ]));
      final child = partnerParentingStartChild(data)!;
      expect((child.id, child.dueDate), ('a', '2026-03-15'));
      expect(_partnerMilestone(data), (months: 7, corrected: true));
    });

    test('without due_date (old function) the partner keeps calendar age', () {
      final data = partnerParentingDataOf(_data([
        {'id': 'a', 'name': 'Aysel', 'birth_date': '2026-01-08', 'gender': 'girl', 'avatar_emoji': null, 'is_current': true},
      ]));
      expect(partnerParentingStartChild(data)!.dueDate, isNull);
      expect(_partnerMilestone(data), (months: 9, corrected: false));
    });
  });

  test('without children the profile baby is used; the wiring feeds the parenting tool from usePartnerData', () async {
    final data = partnerParentingDataOf(_data(const [], profile: {'id': 'p', 'user_id': 'u', 'baby_name': 'Nur', 'baby_birth_date': '2025-01-01'}));
    expect(data.hasProfile, isTrue);
    final start = partnerParentingStartChild(data)!;
    expect((start.name, start.birthDate), ('Nur', '2025-01-01'));

    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = {'id': kLinkedProfileId, 'user_id': kPartnerUserId, 'name': 'Leyla', 'life_stage': 'mommy', 'baby_name': 'Nur'}
      ..rpcs['partner_children_v1'] = (_) => [
            {'id': 'k1', 'name': 'Aysel', 'birth_date': '2026-01-08', 'is_current': true, 'due_date': '2026-03-15'},
          ];
    final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', extra: partnerScreensWiringOverrides()));
    c.listen(partnerParentingDataProvider, (_, _) {});
    await settle();
    final wired = c.read(partnerParentingDataProvider);
    expect(wired.babyName, 'Nur');
    expect([for (final k in wired.children) (k.id, k.isCurrent, k.dueDate)], [('k1', true, '2026-03-15')]);
  });
}
