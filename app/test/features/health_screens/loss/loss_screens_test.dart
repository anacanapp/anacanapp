// Ported from: (no React suite) src/components/pregnancy-loss/{RecoveryHome,ReadyChoices,RecoveryGuideScreen,
//              LossSignsChecker,LossMemoriesScreen,ProfilePregnancyCard,PregnancyLossSheet}.tsx behaviour
import 'dart:convert';

import 'package:anacan/features/health_screens/loss/loss_memories_screen.dart';
import 'package:anacan/features/health_screens/loss/pregnancy_loss.dart';
import 'package:anacan/features/health_screens/loss/recovery_guide_screen.dart';
import 'package:anacan/features/health_screens/loss/recovery_home.dart';
import 'package:anacan/features/health_screens/pregnancy_card/profile_pregnancy_card.dart';
import 'package:anacan/features/tools/health_common/health_common.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../settings/support/harness.dart';
import '../support/health_harness.dart';

class FakeDailyLogActions extends DailyLogActions {
  FakeDailyLogActions(super.ref);
  final List<int> moods = [];
  @override
  Future<DailyLogSaveResult> updateMood(int mood) async {
    moods.add(mood);
    return const DailyLogSaveResult(data: {});
  }
}

String daysAgo(int d) => isoDay(DateTime.now().subtract(Duration(days: d)));

void main() {
  group('RecoveryHome', () {
    screenTest('shows the current week, saves the mood and links the guide, signs and tools', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'}, profile: {'pregnancy_loss_date': daysAgo(9), 'loss_recovery_active': true});
      late FakeDailyLogActions actions;
      final screens = <String>[], tools = <String>[];
      await pumpApp(
        tester,
        RecoveryHome(onNavigate: screens.add, onNavigateToTool: tools.add, onOpenAssistant: () => screens.add('ai')),
        overrides: [
          ...env.overrides,
          dailyLogsViewProvider.overrideWithValue((logs: const [], todayLog: {'mood': 2}, loading: false)),
          dailyLogActionsProvider.overrideWith((ref) => actions = FakeDailyLogActions(ref)),
        ],
        size: const Size(390, 2400),
      );
      await tester.pump();
      final text = pregnancyLossText('az');
      expect(find.text(text.sub('ui').s('home_week').replaceFirst('{n}', '2')), findsOneWidget);
      expect(find.text(text.items('weeks')[1].s('title')), findsOneWidget);
      // Today's mood 2 → its reply.
      expect(find.text(text.sub('ui').list('mood_reply')[1]), findsOneWidget);
      await tester.tap(find.text(text.sub('ui').list('moods')[4]));
      await tester.pump();
      expect(actions.moods, [5]);
      await tester.tap(find.text(text.sub('ui').s('check_title')));
      await tester.tap(find.text(text.sub('ui').s('diary_title')));
      await tester.tap(find.text(text.sub('ui').s('talk_title')));
      expect(screens, ['loss-guide/signs', 'ai']);
      expect(tools, ['mood-diary']);
      // Still in the eight weeks: no "ready" choices yet.
      expect(find.text(text.sub('ui').s('ready_title')), findsNothing);
    });

    screenTest('after eight weeks the ready choices end the recovery and open the cycle home', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'}, profile: {'pregnancy_loss_date': daysAgo(70), 'loss_recovery_active': true});
      final screens = <String>[];
      await pumpApp(
        tester,
        RecoveryHome(onNavigate: screens.add),
        overrides: [
          ...env.overrides,
          dailyLogsViewProvider.overrideWithValue((logs: const [], todayLog: null, loading: false)),
        ],
        size: const Size(390, 2400),
      );
      await tester.pump();
      final t = pregnancyLossText('az').sub('ui');
      expect(find.text(t.s('home_done')), findsNWidgets(2));
      await tester.tap(find.text(t.s('ready_cycle')));
      await tester.pumpAndSettle();
      expect(find.text(t.s('ready_confirm_cycle')), findsOneWidget);
      await tester.tap(find.text(t.s('ready_yes')));
      await tester.pumpAndSettle();
      expect(env.backend.rpcs.single.$1, 'pregnancy_loss_end_v1');
      expect(env.backend.rpcs.single.$2, {'p_track_cycle': true});
      expect(env.account.refreshes, 1);
      expect(screens, ['home']);
    });
  });

  group('RecoveryGuideScreen', () {
    screenTest('the weekly checklist is kept on the device; the signs tab offers the emergency call', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'}, profile: {'pregnancy_loss_date': daysAgo(1)});
      await pumpScreen(tester, RecoveryGuideScreen(onBack: () {}), env);
      final text = pregnancyLossText('az');
      final todo = text.items('weeks')[0].list('todo');
      await tester.tap(find.text(todo[1]));
      await tester.pump();
      expect(jsonDecode(env.store.getItem('anacan_loss_todo_v1:user-1')!), {'1:1': true});
      await tester.tap(find.text(text.sub('ui').s('tab_signs')));
      await tester.pump();
      await tester.tap(find.text(text.sub('signs').list('urgent').first));
      await tester.pump();
      final number = lossEmergencyNumber(text);
      await tester.tap(find.text('${text.sub('ui').s('call')} $number'));
      expect(env.launched.single.toString(), 'tel:$number');
    });

    screenTest('opens on the signs tab for loss-guide/signs and lists the FAQ', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'});
      await pumpScreen(tester, RecoveryGuideScreen(onBack: () {}, initialTab: 'signs'), env);
      final text = pregnancyLossText('az');
      expect(find.text(text.sub('ui').s('signs_title')), findsOneWidget);
      await tester.tap(find.text(text.sub('ui').s('tab_faq')));
      await tester.pump();
      final faq = text.items('faq');
      expect(find.text(faq[0].s('a')), findsOneWidget);
      await tester.tap(find.text(faq[1].s('q')));
      await tester.pump();
      expect(find.text(faq[1].s('a')), findsOneWidget);
      expect(find.text(faq[0].s('a')), findsNothing);
    });
  });

  group('LossMemoriesScreen', () {
    screenTest('reads and deletes the baby chat kept on this device and saves the letter', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'}, extra: {
        'anacan_baby_chat_v1:user-1': jsonEncode({
          '2026-05-01': [
            {'id': 'm1', 'from': 'baby', 'text': 'Salam ana', 'at': 1},
            {'id': 'm2', 'from': 'mom', 'text': 'Salam balam', 'at': 2},
          ],
        }),
      });
      final tools = <String>[], screens = <String>[];
      await pumpScreen(tester, LossMemoriesScreen(onBack: () {}, onNavigate: screens.add, onOpenTool: tools.add), env);
      final t = pregnancyLossText('az').sub('ui');
      await tester.tap(find.text(t.s('mem_album')));
      expect(tools, ['pregnancy-album']);
      await tester.tap(find.text(t.s('mem_chat')));
      await tester.pump();
      expect(find.text('Salam balam'), findsOneWidget);
      await tester.tap(find.text(t.s('mem_chat_delete')));
      await tester.pump();
      await tester.tap(find.text(t.s('mem_chat_delete')).first);
      await tester.pump();
      expect(env.store.getItem('anacan_baby_chat_v1:user-1'), isNull);
      expect(find.text('Salam balam'), findsNothing);
      await tester.tap(find.text(t.s('mem_letter')));
      await tester.pump();
      await tester.enterText(find.byType(EditableText), 'Əziz balam');
      await tester.tap(find.text(t.s('mem_save')));
      await tester.pump();
      expect(loadLossLetter(env.store, 'user-1'), 'Əziz balam');
      await tester.tap(find.text(t.s('mem_guide')));
      expect(screens, ['loss-guide']);
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('ProfilePregnancyCard', () {
    screenTest('is hidden outside pregnancy and loss recovery', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'});
      await pumpApp(tester, const ProfilePregnancyCard(), overrides: env.overrides);
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(GestureDetector), findsNothing);
    });

    screenTest('during recovery it links the guide and the memories', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'flow'}, profile: {'loss_recovery_active': true});
      final screens = <String>[];
      await pumpApp(tester, ProfilePregnancyCard(onNavigate: screens.add), overrides: env.overrides);
      await tester.pump(const Duration(milliseconds: 400));
      final t = pregnancyLossText('az').sub('ui');
      await tester.tap(find.text(t.s('memories_title')));
      expect(screens, ['loss-memories']);
    });

    screenTest('the loss sheet records the loss, tells the linked partner and goes home', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'bump'}, profile: {'linked_partner_id': 'pp1'});
      env.backend.profileUsers['pp1'] = 'partner-user';
      final screens = <String>[];
      await pumpApp(tester, ProfilePregnancyCard(onNavigate: screens.add), overrides: env.overrides, size: const Size(390, 1400));
      await tester.pump(const Duration(milliseconds: 400));
      final t = pregnancyLossText('az').sub('ui');
      await tester.tap(find.text(t.s('entry_title')));
      await tester.pumpAndSettle();
      expect(find.text(t.s('sheet_title')), findsOneWidget);
      await tester.tap(find.text(t.s('sheet_continue')));
      await tester.pumpAndSettle();
      expect(env.backend.rpcs.single.$1, 'pregnancy_loss_begin_v1');
      expect(env.backend.rpcs.single.$2, {'p_date': isoDay(DateTime.now()), 'p_share_partner': true});
      expect(env.partnerMessages.single, ('user-1', 'partner-user', t.s('partner_message')));
      expect(env.account.refreshes, 1);
      expect(screens, ['home']);
    });

    screenTest('without a linked partner nothing is shared', (tester) async {
      final env = HealthEnv(user: {'lifeStage': 'bump'});
      await pumpApp(tester, const ProfilePregnancyCard(), overrides: env.overrides, size: const Size(390, 1400));
      await tester.pump(const Duration(milliseconds: 400));
      final t = pregnancyLossText('az').sub('ui');
      await tester.tap(find.text(t.s('entry_title')));
      await tester.pumpAndSettle();
      expect(find.text(t.s('sheet_partner')), findsNothing);
      await tester.tap(find.text(t.s('sheet_continue')));
      await tester.pumpAndSettle();
      expect(env.backend.rpcs.single.$2!['p_share_partner'], isFalse);
      expect(env.partnerMessages, isEmpty);
    });
  });
}
