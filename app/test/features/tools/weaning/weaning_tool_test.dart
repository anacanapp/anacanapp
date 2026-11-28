// Ported from: src/components/tools/weaning/WeaningTool.test.tsx
import 'dart:convert';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/weaning/weaning.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/weaning/weaning_copy.dart';
import 'package:anacan/features/tools/weaning/weaning_screens.dart';
import 'package:anacan/features/tools/weaning/weaning_sync.dart';
import 'package:anacan/features/tools/weaning/weaning_tool.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../parenting/support/programme_harness.dart';

final DateTime now = DateTime(2026, 11, 9, 10);
const String key = 'anacan.weaning.v1.u1';

class _Env {
  _Env({bool premium = false, String birth = '2025-09-09', String gender = 'girl'}) {
    final child = ProgrammeChild(id: 'c1', name: 'Nərmin', birthDate: birth, gender: gender);
    h.inputs = ProgrammeInputs(userId: 'u1', lifeStage: 'mommy', children: [child], selectedChild: child, isPremium: premium, weaningSetting: 'on');
    h.emergency = '911';
  }
  final h = ProgrammeHarness();

  Map<String, dynamic>? stored() => jsonDecode(h.store.getItem(key) ?? 'null') as Map<String, dynamic>?;

  WeaningPlan seedPlan(String start, {WeaningLocal Function(WeaningLocal l)? extra}) {
    final plan = createPlan(feeds: defaultFeeds, pace: 'gentle', nightMode: 'last', start: start, childId: 'c1', now: now);
    var local = emptyLocal(now).copyWith(plan: plan, planDirty: false);
    if (extra != null) local = extra(local);
    h.store.setItem(key, jsonEncode(local.toJson()));
    return plan;
  }

  Future<void> open(WidgetTester tester) => h.pump(tester, WeaningTool(onBack: () {}, now: now));
}

Future<void> answerCheckin(WidgetTester tester) async {
  await tapText(tester, '😊');
  await tapText(tester, wt('weaning_ci_diapers_ok'));
  await tapText(tester, wt('weaning_ci_full_none'));
  await tapText(tester, wt('weaning_ci_mother_good'));
}

Future<void> toggle(WidgetTester tester, String copyKey) => tapKey(tester, 'weaning-ci-$copyKey');

void main() {
  setUp(() {
    installTestI18n();
    DomainClock.setSystemTime(now);
  });
  tearDown(DomainClock.reset);

  group('Süddən ayırma screens', () {
    testWidgets('shows the intro and remembers "continue breastfeeding"', (tester) async {
      final e = _Env();
      await e.open(tester);
      expect(find.text(wt('weaning_intro_title')), findsOneWidget);
      await tapText(tester, wt('weaning_continue_btn'));
      expect(e.stored()!['continueBF'], true);
      expect(find.text(wt('weaning_continue_active_title')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await e.open(tester);
      expect(find.text(wt('weaning_continue_active_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('builds no plan under 12 months', (tester) async {
      final e = _Env(birth: '2026-01-09');
      await e.open(tester);
      await tapText(tester, wt('weaning_cta_build'));
      expect(find.text(wt('weaning_verdict_young_title')), findsOneWidget);
      expect(find.text(wt('weaning_yes')), findsNothing);
      expect(find.textContaining(wt('weaning_ready_continue')), findsNothing);
      await tapText(tester, wt('weaning_read_nutrition'));
      expect(find.text(wt('weaning_nut_milk_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('suggests a delay for a sick child that the mother can override', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, wt('weaning_cta_build'));
      await tapKey(tester, 'weaning-q-sick-yes');
      await tapKey(tester, 'weaning-q-change-no');
      await tapKey(tester, 'weaning-q-allergy-no');
      expect(find.text(wt('weaning_verdict_sick_title')), findsOneWidget);
      await tapText(tester, wt('weaning_ready_continue_delay'));
      expect(find.textContaining(wt('weaning_start_delay_note')), findsOneWidget);
      await tapText(tester, wt('weaning_start_today'));
      expect(find.textContaining(wt('weaning_start_delay_note')), findsNothing);
      await tapKey(tester, 'weaning-make-plan');
      expect(e.stored()!['plan']['steps'][0]['start'], '2026-11-09');
      await e.h.finish(tester);
    });

    testWidgets('builds a plan (no one-day pace) and locks the timeline for free users', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, wt('weaning_cta_build'));
      for (final k in const ['sick', 'change', 'allergy']) {
        await tapKey(tester, 'weaning-q-$k-no');
      }
      expect(find.text(wt('weaning_verdict_ok_title')), findsOneWidget);
      await tapText(tester, wt('weaning_ready_continue'));
      expect(tester.widget<WChip>(find.byKey(const ValueKey('weaning-pace-gentle'))).pressed, true);
      expect(find.byKey(const ValueKey('weaning-pace-medium')), findsOneWidget);
      expect(paces, ['gentle', 'medium']);
      await tapKey(tester, 'weaning-make-plan');
      final steps = [for (final s in e.stored()!['plan']['steps'] as List) s['type']];
      expect(steps, ['day', 'day', 'nap', 'morning', 'night', 'bedtime']);
      expect(find.byKey(const ValueKey('weaning-today')), findsOneWidget);
      expect(tester.widget<WBtn>(find.byKey(const ValueKey('weaning-complete'))).disabled, true);
      expect(find.text(wt('weaning_lock_title')), findsOneWidget);
      expect(find.byKey(const ValueKey('weaning-timeline')), findsNothing);
      expect(find.textContaining(wt('weaning_reminders_premium')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('shows the timeline to Premium users and opens "done" from day 3', (tester) async {
      final e = _Env(premium: true);
      e.seedPlan('2026-11-07');
      await e.open(tester);
      expect(find.byKey(const ValueKey('weaning-timeline')), findsOneWidget);
      expect(find.text(wt('weaning_lock_title')), findsNothing);
      expect(find.textContaining(wt('weaning_reminders_on')), findsOneWidget);
      expect(tester.widget<WBtn>(find.byKey(const ValueKey('weaning-complete'))).disabled, false);
      await tapKey(tester, 'weaning-complete');
      expect(e.stored()!['plan']['steps'][0]['status'], 'done');
      expect(find.textContaining('Ən tez'), findsOneWidget);
      // Premium: 09:00 reminders for the upcoming steps (ids from 881100).
      final items = e.h.notifications.last('weaning');
      expect(items, isNotEmpty);
      expect(items.every((i) => i.id >= 881100 && i.id <= 881111), true);
      await e.h.finish(tester);
    });

    testWidgets('opens a step with swap, tips, crying help, partner hint and the 3-day extension', (tester) async {
      final e = _Env(premium: true);
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-how');
      expect(find.text(wt('weaning_cries_title')), findsOneWidget);
      expect(find.text(wt('weaning_partner_day')), findsOneWidget);
      await tapKey(tester, 'weaning-partner-send');
      expect(e.h.shares, hasLength(1));
      await tapKey(tester, 'weaning-extend');
      expect(e.stored()!['plan']['steps'][0]['len'], 10);
      await e.h.finish(tester);
    });

    testWidgets('pauses the plan and sends to a doctor for lump + fever', (tester) async {
      final e = _Env();
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-checkin');
      await answerCheckin(tester);
      await toggle(tester, 'weaning_ci_lump');
      await toggle(tester, 'weaning_ci_fever');
      await tapKey(tester, 'weaning-ci-save');
      expect(find.text(wt('weaning_res_mastitis_title')), findsOneWidget);
      final s = e.stored()!;
      expect(s['plan']['status'], 'paused');
      expect(s['plan']['pauseReason'], 'doctor');
      expect(s['checkins'][0]['tone'], 'red');
      expect(s['checkins'][0]['planId'], s['plan']['id']);
      await tapText(tester, wt('weaning_back_to_plan'));
      expect(find.text(wt('weaning_paused_doctor_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('uses the country emergency number for dehydration and links low mood to the Mood diary', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, wt('weaning_link_mother'));
      expect(find.textContaining('911.'), findsWidgets);
      await tester.pumpWidget(const SizedBox());
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-checkin');
      await tapText(tester, '😊');
      await tapText(tester, wt('weaning_ci_diapers_few'));
      await tapText(tester, wt('weaning_ci_full_none'));
      await tapText(tester, wt('weaning_ci_mother_low'));
      await toggle(tester, 'weaning_ci_sick');
      await tapKey(tester, 'weaning-ci-save');
      expect(find.text(wt('weaning_res_dehyd_title')), findsOneWidget);
      expect(find.textContaining('911.'), findsWidgets);
      expect(find.textContaining(RegExp(r'(^|\D)103(\D|$)')), findsNothing);
      await tapKey(tester, 'weaning-call');
      expect(e.h.calls.single.toString(), 'tel:911');
      await tapText(tester, wt('weaning_res_mood_btn'));
      expect(e.h.openedTools, ['mood-diary']);
      await e.h.finish(tester);
    });

    testWidgets('extends the step for very full breasts', (tester) async {
      final e = _Env();
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-checkin');
      await tapText(tester, '😊');
      await tapText(tester, wt('weaning_ci_diapers_ok'));
      await tapText(tester, wt('weaning_ci_full_much'));
      await tapText(tester, wt('weaning_ci_mother_good'));
      await toggle(tester, 'weaning_ci_sick');
      await tapKey(tester, 'weaning-ci-save');
      expect(find.text(wt('weaning_res_full_title')), findsOneWidget);
      expect(find.text(wt('weaning_res_sick_item')), findsOneWidget);
      expect(e.stored()!['plan']['steps'][0]['len'], 9);
      expect(find.text(wt('weaning_res_updated_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('offers a pause for a sick child', (tester) async {
      final e = _Env();
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-checkin');
      await answerCheckin(tester);
      await toggle(tester, 'weaning_ci_sick');
      await tapKey(tester, 'weaning-ci-save');
      expect(find.text(wt('weaning_res_sick_title')), findsOneWidget);
      await tapText(tester, wt('weaning_res_pause_btn'));
      expect(e.stored()!['plan']['status'], 'paused');
      expect(e.stored()!['plan']['pauseReason'], 'manual');
      expect(find.text(wt('weaning_paused_manual_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('hides the cow-milk advice when an allergy was reported and counts milk cups', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, wt('weaning_link_nutrition'));
      expect(find.byKey(const ValueKey('weaning-cow-milk')), findsOneWidget);
      for (var i = 0; i < 6; i++) {
        await tapKey(tester, 'weaning-cup-plus');
      }
      expect(find.text(wf('weaning_nut_today', {'ml': 720})), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('weaning-milk-over')), matching: find.text(wt('weaning_nut_status_over'))), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      e.h.store.setItem(key, jsonEncode({...emptyLocal(now).toJson(), 'readiness': {'sick': false, 'change': false, 'allergy': true, 'reasons': []}}));
      await e.open(tester);
      await tapText(tester, wt('weaning_link_nutrition'));
      expect(find.byKey(const ValueKey('weaning-cow-milk')), findsNothing);
      expect(find.text(wt('weaning_nut_allergy_title')), findsOneWidget);
      await e.h.finish(tester);
    });

    testWidgets('shows the seven myths and the finish card', (tester) async {
      final e = _Env();
      await e.open(tester);
      await tapText(tester, wt('weaning_link_myths'));
      expect(find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key! as ValueKey).value}'.startsWith('weaning-myth-')), findsNWidgets(7));
      await tester.pumpWidget(const SizedBox());
      final boy = _Env(gender: 'boy');
      final plan = boy.seedPlan('2026-10-01');
      final finished = WeaningPlan.fromJson({
        ...plan.toJson(),
        'status': 'finished',
        'steps': [for (final s in plan.steps) s.copyWith(status: 'done').toJson()],
      });
      boy.h.store.setItem(key, jsonEncode(emptyLocal(now).copyWith(plan: finished).toJson()));
      await boy.open(tester);
      await tapText(tester, wt('weaning_finish_card_btn'));
      expect(find.text(wf('weaning_finish_hero_boy', {'name': 'Nərmin'})), findsOneWidget);
      await boy.h.finish(tester);
    });

    testWidgets('queues changes and pushes the plan to the server', (tester) async {
      final e = _Env();
      e.seedPlan('2026-11-08');
      await e.open(tester);
      await tapKey(tester, 'weaning-pause');
      expect(e.stored()!['plan']['status'], 'paused');
      await tester.pump(const Duration(milliseconds: 500));
      await e.h.flush(tester);
      final row = e.h.weaningRemote.planUpserts.last;
      expect(row['user_id'], 'u1');
      expect(row['child_id'], 'c1');
      expect(row['status'], 'paused');
      expect(row['pause_reason'], 'manual');
      expect(e.stored()!['planDirty'], false);
      await e.h.finish(tester);
    });
  });
}
