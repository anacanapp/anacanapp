// Ported from: (no vitest file for PreemieHubScreen.tsx) — the personal status card for a premature child, the
// generic intro otherwise, and one open accordion item at a time.
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/tools/preemie/preemie_hub.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;
  setUp(() {
    h = BabyToolsHarness();
    DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
  });
  tearDown(DomainClock.reset);

  testWidgets('shows the corrected age for a premature child', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-08-01', due: '2026-09-26')];
    await h.pump(tester, PreemieHubScreen(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('preemie-status')), findsOneWidget);
    expect(find.textContaining('Aylin · 32 həftəlik doğulub'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('shows the generic intro and opens one item at a time', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-08-01')];
    await h.pump(tester, PreemieHubScreen(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('preemie-status')), findsNothing);
    expect(find.textContaining('Dünyada hər 10 körpədən'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('preemie-item-c1')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.textContaining('Korreksiya olunmuş yaş = real'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('preemie-item-n1')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.textContaining('Korreksiya olunmuş yaş = real'), findsNothing);
    expect(find.textContaining('Monitorlar ürək ritmi'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('preemie-item-n1')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.textContaining('Monitorlar ürək ritmi'), findsNothing);
    await h.finish(tester);
  });
}
