// Ported from: (no vitest file for TeethingTracker.tsx / useTeething.ts) — behaviour checks of the port: progress,
// the tooth dialog (mark with date + note, unmark), translated tips / symptoms tabs.
import 'package:anacan/features/tools/teething/teething_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

Map<String, dynamic> tooth(String id, String code, String position, String type, int sort) => {
      'id': id, 'tooth_code': code, 'name': code, 'position': position, 'tooth_type': type, 'side': 'left',
      'typical_emergence_months_min': 6, 'typical_emergence_months_max': 10, 'sort_order': sort, 'is_active': true,
    };

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;

  setUp(() {
    h = BabyToolsHarness();
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-01-01')];
    h.repo.teethRows = [
      tooth('t1', 'lower_central_incisor_left', 'lower', 'incisor', 1),
      tooth('t2', 'lower_central_incisor_right', 'lower', 'incisor', 2),
      tooth('t3', 'upper_central_incisor_left', 'upper', 'incisor', 3),
      tooth('t4', 'upper_first_molar_left', 'upper', 'molar', 4),
    ];
    h.repo.teethLogs = [{'id': 'l1', 'user_id': 'u1', 'child_id': 'c1', 'tooth_id': 't1', 'emerged_date': '2026-08-01', 'notes': null}];
    h.teething.tipRows = [
      {'id': 'tip1', 'title': 'Soyuq halqa', 'title_az': 'Soyuq halqa', 'content': 'Soyuducuda saxlayın', 'category': 'pain_relief', 'emoji': '🧊', 'sort_order': 1},
    ];
    h.teething.symptomRows = [
      {'id': 's1', 'name': 'Salya', 'description': 'Çox salya', 'severity': 'mild', 'relief_tips': ['Dəsmal'], 'emoji': null, 'sort_order': 1},
    ];
  });

  testWidgets('shows the progress and the care tips, then the symptoms tab', (tester) async {
    await h.pump(tester, TeethingTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('25%'), findsOneWidget);
    expect(find.text('Soyuq halqa'), findsOneWidget);
    expect(find.text('Ağrı Kəsici'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('teeth-tab-symptoms')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Salya'), findsOneWidget);
    expect(find.text('Yüngül'), findsOneWidget);
    expect(find.text('Dəsmal'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('marks a tooth with its date and note, and unmarks an emerged one', (tester) async {
    await h.pump(tester, TeethingTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('tooth-upper_first_molar_left')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Bu diş hələ çıxmayıb'), findsOneWidget);
    await tester.enterText(find.descendant(of: find.byKey(const ValueKey('tooth-notes')), matching: find.byType(EditableText)), 'Ağrılı');
    await tester.tap(find.byKey(const ValueKey('tooth-toggle')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.teething.calls.first, startsWith('upsert:t4:'));
    expect(h.teething.calls.last, 'note:t4:Ağrılı');
    expect(find.text('50%'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('tooth-lower_central_incisor_left')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Bu diş çıxıb'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('tooth-toggle')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.teething.calls.last, 'delete:t1');
    expect(find.text('25%'), findsOneWidget);
    await h.finish(tester);
  });
}
