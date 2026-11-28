// Ported from: (no React suite) src/components/illness/{IllnessScreen,IllnessHomeCard,IllnessSheets}.tsx behaviour
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/health_screens/illness/illness.dart';
import 'package:anacan/features/health_screens/illness/illness_home_card.dart';
import 'package:anacan/features/health_screens/illness/illness_screen.dart';
import 'package:anacan/features/health_screens/illness/illness_sheets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../settings/support/harness.dart';
import '../support/health_harness.dart';

Map<String, dynamic> episode({String id = 'ep1', String? ended, num? lastTemp = 38.6}) => {
      'id': id,
      'child_id': null,
      'child_name': 'Aylin',
      'kind': 'fever',
      // Yesterday noon: day 2 whatever the time of the run.
      'started_at': jsToIsoString(() {
        final n = DateTime.now();
        return DateTime(n.year, n.month, n.day - 1, 12);
      }()),
      'ended_at': ended,
      'note': null,
      'entries': 2,
      'last_temp': lastTemp,
      'max_temp': 38.6,
    };

Map<String, dynamic> tempRow(String id, num temp, {int hoursAgo = 1}) => {
      'id': id,
      'kind': 'temp',
      'at': jsToIsoString(DateTime.now().subtract(Duration(hours: hoursAgo))),
      'temp_c': '$temp',
      'temp_method': 'armpit',
      'med_name': null,
      'dose': null,
      'interval_hours': null,
      'remind': false,
      'symptoms': null,
      'note': null,
      'by': 'mother',
      'by_me': true,
    };

void main() {
  screenTest('without an open episode the start card starts one and tells the partner', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'})..otherParentUserId = 'partner-1';
    env.backend.rpcAnswers['illness_episodes_v1'] = (_) => <Object>[];
    env.backend.rpcAnswers['illness_episode_start_v1'] = (_) => 'ep-new';
    await pumpScreen(tester, IllnessScreen(onBack: () {}), env);
    expect(find.text('Körpə xəstədir?'), findsOneWidget);
    await tester.tap(find.text('Soyuqdəymə'));
    await tester.pump();
    await tester.tap(find.text('Xəstəliyi qeyd etməyə başla'));
    await tester.pump();
    await tester.pump();
    final start = env.backend.rpcs.firstWhere((r) => r.$1 == 'illness_episode_start_v1');
    expect(start.$2!['p_kind'], 'cold');
    expect(env.partnerMessages.single.$2, 'partner-1');
    expect(env.partnerMessages.single.$3, contains('Soyuqdəymə'));
  });

  screenTest('an open episode shows the latest reading, the infant alert and calls the emergency number', (tester) async {
    final env = HealthEnv(
      user: {'lifeStage': 'mommy'},
      profile: {'baby_birth_date': jsToIsoString(DateTime.now().subtract(const Duration(days: 40))).substring(0, 10), 'country_code': 'AZ'},
    );
    env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode()];
    env.backend.rpcAnswers['illness_entries_v1'] = (_) => [tempRow('t1', 38.6), tempRow('t2', 38.1, hoursAgo: 5)];
    await pumpScreen(tester, IllnessScreen(onBack: () {}), env);
    expect(find.textContaining('Qızdırma · Gün 2'), findsOneWidget);
    expect(find.text('Davam edir'), findsOneWidget);
    // 1 month old with 38.6 °C → the infant alert with the call button (AZ: 103).
    expect(find.textContaining('aylıq körpədə'), findsOneWidget);
    await tester.tap(find.text('103-ə zəng et').first);
    expect(env.launched.single.toString(), 'tel:103');
  });

  screenTest('the PDF summary asks for Premium first', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'});
    env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode()];
    env.backend.rpcAnswers['illness_entries_v1'] = (_) => [tempRow('t1', 37.2)];
    await pumpScreen(tester, IllnessScreen(onBack: () {}), env);
    await tester.tap(find.textContaining('Həkim üçün xülasə'));
    await tester.pump();
    expect(env.paywalls, ['PDF xülasə Premium funksiyadır']);
  });

  screenTest('marking healed closes the episode', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'});
    env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode()];
    env.backend.rpcAnswers['illness_entries_v1'] = (_) => <Object>[];
    await pumpScreen(tester, IllnessScreen(onBack: () {}), env);
    await tester.tap(find.text('Sağaldı'));
    await tester.pump();
    final close = env.backend.rpcs.firstWhere((r) => r.$1 == 'illness_episode_close_v1');
    expect(close.$2, {'p_episode': 'ep1', 'p_ended': true});
    await tester.pump(const Duration(seconds: 5));
  });

  screenTest('the temperature sheet saves the reading in °C', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'mommy'});
    env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode()];
    env.backend.rpcAnswers['illness_entries_v1'] = (_) => <Object>[];
    await pumpScreen(tester, IllnessScreen(onBack: () {}), env);
    await tester.tap(find.text('Hərarət').first);
    await tester.pumpAndSettle();
    expect(find.byType(TempSheet), findsOneWidget);
    await tester.tap(find.text('+'));
    await tester.pump();
    await tester.tap(find.text('Yadda saxla'));
    await tester.pump();
    await tester.pump();
    final add = env.backend.rpcs.firstWhere((r) => r.$1 == 'illness_entry_add_v1');
    final entry = add.$2!['p_entry'] as Map;
    expect(entry['kind'], 'temp');
    expect(entry['temp_c'], 37.6);
    expect(entry['temp_method'], 'armpit');
    await tester.pumpAndSettle(const Duration(seconds: 5));
  });

  group('IllnessHomeCard', () {
    screenTest('active mode shows the open episode with its last temperature', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'mommy'});
      env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode()];
      await pumpApp(tester, IllnessHomeCard(mode: 'active', onOpen: () {}), overrides: env.overrides);
      await tester.pump();
      expect(find.text('Qızdırma · gün 2'), findsOneWidget);
      expect(find.text('38.6°'), findsOneWidget);
      expect(find.text('Körpə xəstələnəndə'), findsNothing);
    });

    screenTest('entry mode shows only when nothing is open', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'mommy'});
      env.backend.rpcAnswers['illness_episodes_v1'] = (_) => [episode(ended: jsToIsoString(DateTime.now()))];
      var opened = false;
      await pumpApp(tester, IllnessHomeCard(mode: 'entry', onOpen: () => opened = true), overrides: env.overrides);
      await tester.pump();
      expect(find.text('Körpə xəstələnəndə'), findsOneWidget);
      await tester.tap(find.text('Körpə xəstələnəndə'));
      expect(opened, isTrue);
    });
  });

  test('kind emoji covers every kind', () {
    expect(illnessKinds.every(kindEmoji.containsKey), isTrue);
  });
}
