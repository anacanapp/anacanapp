// Ported from: src/components/tools/KickCounter.tsx (behaviour checks; no vitest suite)
import 'package:anacan/features/tools/kick/kick_counter.dart';
import 'package:anacan/features/tools/kick/kick_session.dart';
import 'package:anacan/features/tools/kick/kick_sessions.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';
import 'kick_sessions_outbox_test.dart' show ServerKickRepository;

void main() {
  testWidgets('a tap starts a session, stop saves it and clears the stored session', (tester) async {
    final env = PregnancyEnv();
    await pumpTool(tester, KickCounter(onBack: () {}), overrides: [
      ...env.overrides,
      kickRepositoryProvider.overrideWithValue(ServerKickRepository(env.server)),
    ]);
    expect(find.text('Təpik Sayğacı'), findsOneWidget);
    expect(find.text('Başlamaq üçün düyməyə toxunun'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('kick-button')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('kick-button')));
    await tester.pump();
    expect(find.text('2'), findsOneWidget);
    expect(loadActiveKickSession(env.store, 'u1')?.kicks, 2);
    expect(find.byKey(const ValueKey('kick-stop')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('kick-stop')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(env.server.table('kick_sessions').single['kick_count'], 2);
    expect(loadActiveKickSession(env.store, 'u1'), isNull);
    expect(find.text('Sessiya yadda saxlandı! 👶'), findsOneWidget);
    expect(find.byKey(const ValueKey('kick-start')), findsOneWidget);
    expect(find.text('Son sessiyalar'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('restores an unfinished session and shows the multiples side picker', (tester) async {
    final env = PregnancyEnv(profile: testProfile({'multiples_type': 'twins'}));
    saveActiveKickSession(env.store, 'u1', ActiveKickSession(startedAt: DateTime.now().millisecondsSinceEpoch - 65000, kicks: 3, position: 'right'));
    await pumpTool(tester, KickCounter(onBack: () {}), overrides: [
      ...env.overrides,
      kickRepositoryProvider.overrideWithValue(ServerKickRepository(env.server)),
    ]);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('01:05'), findsOneWidget);
    expect(find.text('Sağ tərəf'), findsOneWidget);
    expect(find.text('Əla gedir! Körpələriniz aktivdir 💪'), findsNothing);
    await unmount(tester);
  });

  testWidgets('the emergency pill dials the country number', (tester) async {
    final env = PregnancyEnv();
    await pumpTool(tester, KickCounter(onBack: () {}), overrides: [
      ...env.overrides,
      kickRepositoryProvider.overrideWithValue(ServerKickRepository(env.server)),
    ]);
    await tester.tap(find.text('Təcili yardım: 103'));
    expect(env.calls.single.toString(), 'tel:103');
    await unmount(tester);
  });
}
