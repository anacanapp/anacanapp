// Ported from: (no vitest file for BabyMonthlyAlbum.tsx) — upload into an empty month, the action sheet's replace
// (new object first, then the old one removed) and delete with confirmation, and the 12-month order card.
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/tools/baby_album/baby_monthly_album.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;
  setUp(() {
    h = BabyToolsHarness();
    DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-05-01')];
  });
  tearDown(DomainClock.reset);

  testWidgets('uploads a photo into an empty month', (tester) async {
    h.picked.add(pngFile('IMG.jpg'));
    await h.pump(tester, BabyMonthlyAlbum(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Fiziki Albom'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('album-month-3')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.album.calls, ['upload:u1/month-3-1700000000000.jpg']);
    expect(find.text('Şəkil yükləndi!'), findsOneWidget);
    expect(find.byKey(const ValueKey('album-uploading')), findsNothing);
    await h.finish(tester);
  });

  testWidgets('replaces a photo (new object first) and deletes after confirmation', (tester) async {
    h.album.names.add('month-2-1.jpg');
    h.picked.add(pngFile('new.png'));
    await h.pump(tester, BabyMonthlyAlbum(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-month-2')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-action-replace')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.album.calls, ['upload:u1/month-2-1700000000000.png', 'remove:u1/month-2-1.jpg']);

    await tester.tap(find.byKey(const ValueKey('album-month-2')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-action-delete')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-confirm-delete')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.album.calls.last, 'remove:u1/month-2-1700000000000.png');
    expect(h.album.names, isEmpty);
    await h.finish(tester);
  });

  testWidgets('a failed replace keeps the original and says so', (tester) async {
    h.album.names.add('month-2-1.jpg');
    h.album.uploadError = {'message': 'offline'};
    h.picked.add(pngFile('new.jpg'));
    await h.pump(tester, BabyMonthlyAlbum(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-month-2')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('album-action-replace')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.album.names, ['month-2-1.jpg']);
    expect(find.text('Şəkil dəyişdirilmədi. Əvvəlki şəkil saxlanıldı.'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('offers the physical album from 12 months', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2025-10-01')];
    await h.pump(tester, BabyMonthlyAlbum(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('album-order-card')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('album-order')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('album-order-card')), findsNothing);
    await h.finish(tester);
  });
}
