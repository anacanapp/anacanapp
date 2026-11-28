// Ported from: (no React suite) src/components/recovery/{RecoveryScreen,KegelTrainer}.tsx behaviour
import 'package:anacan/features/health_screens/common/feature_text.dart';
import 'package:anacan/features/recovery/kegel_trainer.dart';
import 'package:anacan/features/recovery/recovery.dart';
import 'package:anacan/features/recovery/recovery_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_screens/support/health_harness.dart';
import '../settings/support/harness.dart';

String daysAgo(int d) => isoDay(DateTime.now().subtract(Duration(days: d)));

void main() {
  screenTest('asks for the birth type first and saves it on the profile', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'}, profile: {'baby_birth_date': daysAgo(10)});
    await pumpScreen(tester, RecoveryScreen(onBack: () {}), env);
    expect(find.text('Doğuş necə olub?'), findsOneWidget);
    await tester.tap(find.text('Qeysəriyyə'));
    await tester.pump();
    await tester.pump();
    expect(env.backend.profileUpdates.single.$2, {'birth_type': 'cesarean'});
    expect(env.account.refreshes, 1);
    expect(find.text('ANA BƏRPASI · QEYSƏRİYYƏ'), findsOneWidget);
    expect(find.text('Doğuşdan sonra 2. həftə'), findsOneWidget);
  });

  screenTest('an urgent sign shows the emergency call and is saved to today', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'}, profile: {'baby_birth_date': daysAgo(3), 'birth_type': 'vaginal', 'country_code': 'AZ'});
    await pumpScreen(tester, RecoveryScreen(onBack: () {}), env);
    await tester.ensureVisible(find.text('Əlamətlər'));
    await tester.tap(find.text('Əlamətlər'));
    await tester.pump();
    await tester.tap(find.text('Nəfəs darlığı və ya sinə ağrısı'));
    await tester.pump();
    expect(find.textContaining('Bu təcili əlamətdir'), findsOneWidget);
    expect(env.backend.upserts.single['flags'], ['chest']);
    expect(env.backend.upserts.single['day'], isoDay(DateTime.now()));
    await tester.tap(find.text('103-ə zəng et'));
    expect(env.launched.single.toString(), 'tel:103');
  });

  screenTest('the Kegel tab is locked without Premium', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'}, profile: {'baby_birth_date': daysAgo(3), 'birth_type': 'vaginal'});
    await pumpScreen(tester, RecoveryScreen(onBack: () {}, initialTab: 'kegel'), env);
    await tester.tap(find.text('Gündəlik çanaq dibi proqramı Premium-dadır'));
    await tester.pump();
    expect(env.paywalls, ['Gündəlik çanaq dibi proqramı Premium-dadır']);
  });

  screenTest('the mood test link opens the mental health tool', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'}, profile: {'baby_birth_date': daysAgo(3), 'birth_type': 'vaginal'});
    final tools = <String>[];
    await pumpScreen(tester, RecoveryScreen(onBack: () {}, onNavigateToTool: tools.add), env);
    await tester.tap(find.text('Əhval testi (Edinburq)'));
    expect(tools, ['mental-health']);
  });

  screenTest('KegelTrainer runs squeeze / relax repetitions and completes once', (tester) async {
    final env = HealthEnv();
    var completed = 0;
    final t = FeatureText(recoveryText('az'));
    await pumpApp(
      tester,
      KegelTrainer(t: t, level: const KegelLevel(0, 1, 1, 2), locked: false, cesarean: false, done: 0, onComplete: () async => completed++),
      overrides: env.overrides,
    );
    await tester.tap(find.text('Başla'));
    await tester.pump();
    expect(find.text('Sıxın'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Buraxın'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Sıxın'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(completed, 1);
    expect(find.text('✓'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    expect(completed, 1);
  });
}
