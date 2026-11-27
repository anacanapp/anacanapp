// Ported from: src/components/onboarding/OnboardingJourney.test.tsx
import 'dart:async';

import 'package:anacan/features/onboarding/onboarding_fields.dart';
import 'package:anacan/features/onboarding/onboarding_frame.dart';
import 'package:anacan/features/onboarding/onboarding_i18n.dart';
import 'package:anacan/features/onboarding/onboarding_journey.dart';
import 'package:anacan/features/onboarding/onboarding_model.dart';
import 'package:anacan/features/onboarding/onboarding_persistence.dart';
import 'package:anacan/native/purchases/purchases.dart' show PurchasesSdkException;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support.dart';

String step(WidgetTester tester) => tester.widget<OnboardingFrame>(find.byType(OnboardingFrame)).step;

Future<void> tapText(WidgetTester tester, String text) async {
  final f = find.text(text);
  expect(f, findsWidgets, reason: text);
  await tester.ensureVisible(f.last);
  await tester.tap(f.last, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 230));
  await tester.pump();
}

Future<void> tapKey(WidgetTester tester, String key) async {
  final f = find.byKey(ValueKey(key));
  expect(f, findsWidgets, reason: key);
  await tester.ensureVisible(f.first);
  await tester.tap(f.first, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 230));
  await tester.pump();
}

/// Lets the persistence futures complete.
Future<void> flush(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<void> travel(WidgetTester tester, String language, String stage, [String stop = 'paywall']) async {
  String t(String key) => onboardingText(language, key);
  for (var count = 0; count < 40 && step(tester) != stop; count++) {
    final current = step(tester);
    if (current == 'stage') {
      await tapKey(tester, 'stage-$stage');
      continue;
    }
    if (current == 'data') {
      if (stage == 'bump') await tapKey(tester, 'onb-pregnancy-date');
      if (stage == 'flow') await tapKey(tester, 'onb-last-period');
      if (stage == 'mommy') {
        await tester.enterText(find.byKey(const ValueKey('onb-child-name-0')), 'Leyla');
        await tester.pump();
        await tapKey(tester, 'onb-birth-0');
        await tapKey(tester, 'child-0-gender-girl');
      }
    }
    if (isQuestion(current)) {
      final options = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('answer-'));
      await tester.ensureVisible(options.first);
      await tester.tap(options.first);
      await tester.pump(const Duration(milliseconds: 230));
      await flush(tester);
      if (step(tester) != current) continue;
    }
    final label = current == 'welcome' ? t('start') : current == 'results' ? t('view_plan') : t('next');
    await tapText(tester, label);
    await flush(tester);
  }
  expect(step(tester), stop);
}

void main() {
  setUp(() {
    // `<input type=date>`: the first selectable date relative to the max (LMP 2026-06-01 / last period 2026-09-01 / birth 2026-08-01).
    OnbDateField.debugPick = (context, initial, first, last) async {
      final key = (context.widget as dynamic).key;
      return switch ('$key') {
        _ when last.year == 2026 && last.month == 9 && first.year == 2025 => DateTime(2026, 6, 1),
        _ => DateTime(2026, 8, 1),
      };
    };
  });
  tearDown(() => OnbDateField.debugPick = null);

  for (final language in ['az', 'en', 'ar']) {
    for (final stage in ['bump', 'mommy', 'flow']) {
      testWidgets('$language / $stage: all questions, saved data and free continuation', (tester) async {
        final env = OnboardingTestEnv(language: language);
        addTearDown(env.dispose);
        var done = 0;
        await tester.pumpWidget(env.wrap(OnboardingJourney(onComplete: () => done++)));
        await flush(tester);
        expect(find.text(onboardingText(language, 'welcome_title')), findsOneWidget);
        await travel(tester, language, stage);
        final profile = env.db.tables['profiles']!.first;
        expect(profile['life_stage'], stage);
        final answers = profile['onboarding_answers'] as Map;
        expect([answers['sleep'], answers['supportLevel']], ['rested', 'supported']);
        expect(env.db.tables['user_preferences']!.single['language'], language);
        expect(tester.widget<Directionality>(find.descendant(of: find.byType(OnboardingFrame), matching: find.byType(Directionality)).first).textDirection,
            language == 'ar' ? TextDirection.rtl : TextDirection.ltr);
        expect(find.text(onboardingText(language, 'mobile_purchase')), findsOneWidget);
        await tapText(tester, onboardingText(language, 'continue_free'));
        await flush(tester);
        expect(step(tester), 'free');
        await tapText(tester, onboardingText(language, 'continue_free'));
        await flush(tester);
        expect(done, 1);
        final journey = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
        expect([journey['outcome'], journey['plan']], ['free', 'yearly']);
        expect(journey['offerSeenAt'], isNull, reason: 'no offer without a store');
        expect(env.sdk.count('purchasePackage'), 0);
        expect(env.drafts.getItem(onboardingDraftKey(actor, backend)), isNull);
      });
    }
  }

  for (final (stage, plan, lead) in [
    ('mommy', ['Yuxu rejimi izləmə', 'Qidalanma izləmə', 'İnkişaf mərhələləri', 'Ağlama analizi', 'Hava və geyim'], ['Qidalanma, yuxu və bez qeydləri', 'ÜST boy-çəki əyriləri']),
    ('bump', ['Fetal böyümə izləyici', 'Qidalanmaya nəzarət', 'Təhlükəsizlik sorğusu', 'Təpik və sancı ölçən', 'Çəki, qan təzyiqi və şəkəri izləyicisi'], ['Təpik və sancı ölçən', 'Çəki, qan təzyiqi və şəkəri izləyicisi']),
    ('flow', ['Əhval gündəliyi', 'Qidalanmaya nəzarət', 'Vitamin izləyicisi', 'Sağlam reseptlər', 'Mental sağlamlıq və idman'], ['Fazalara görə simptom analizi', 'Tsikl statistikası və trendlər']),
  ]) {
    testWidgets('$stage shows the requested benefits through results, support, Premium and monthly offer', (tester) async {
      final env = OnboardingTestEnv(native: true);
      env.permission.requestResult = 'denied';
      addTearDown(env.dispose);
      await tester.pumpWidget(env.wrap(const OnboardingJourney()));
      await flush(tester);
      await travel(tester, 'az', stage, 'notifications');
      await tapText(tester, onboardingText('az', 'not_now'));
      await flush(tester);
      expect(step(tester), 'results');
      List<String> benefits() => [
            for (final e in find.descendant(of: find.byKey(const ValueKey('onboarding-benefits')), matching: find.byType(Text)).evaluate())
              (e.widget as Text).data ?? '',
          ];
      expect(benefits(), plan);
      await tapText(tester, onboardingText('az', 'view_plan'));
      expect(step(tester), 'features');
      await tapText(tester, onboardingText('az', 'next'));
      await flush(tester);
      expect(step(tester), 'paywall');
      final premium = [...lead, 'Gündəlik limitsiz Anacan AI', 'Həkim PDF', 'Reklamsız təcrübə'];
      expect(benefits(), premium);
      expect(find.text(onboardingText('az', 'charged_today', {'price': r'$19.99'})), findsOneWidget);
      expect(find.text(onboardingText('az', 'renewal_year', {'price': r'$29.99'})), findsOneWidget);
      await tapSem(tester, onboardingText('az', 'close'));
      await flush(tester);
      expect(step(tester), 'offer');
      expect(benefits(), premium);
      final frame = tester.widget<OnboardingFrame>(find.byType(OnboardingFrame));
      expect(frame.current, frame.total, reason: 'coffee step does not restart the progress');
      expect(find.text(onboardingText('az', 'renewal_month', {'price': r'$3.99'})), findsOneWidget);
      expect(find.text(onboardingText('az', 'restore')), findsOneWidget);
      expect(env.sdk.count('purchasePackage'), 0);
    });
  }

  Future<OnboardingTestEnv> atPaywall(WidgetTester tester, {String stage = 'bump', bool pending = false}) async {
    final env = OnboardingTestEnv(native: true);
    addTearDown(env.dispose);
    var draft = newOnboardingDraft(actor, backend, 'Aysel').copyWith(stage: stage, pregnancyDate: '2026-06-01', lastPeriodDate: '2026-09-01');
    await saveOnboardingSetupForTest(env, draft);
    final record = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
    draft = draft.copyWith(id: record['id'] as String, setupComplete: true, saveStarted: true, step: 'paywall', purchasePending: pending);
    writeOnboardingDraft(draft, env.drafts);
    return env;
  }

  testWidgets('stays on an unsuccessful save, keeps answers, and recovers on retry', (tester) async {
    final env = OnboardingTestEnv();
    addTearDown(env.dispose);
    var once = true;
    env.db.fail = (table, _, after) {
      if (table == 'user_children' && !after && once) {
        once = false;
        return true;
      }
      return false;
    };
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await travel(tester, 'az', 'mommy', 'value');
    await tapText(tester, onboardingText('az', 'next'));
    await flush(tester);
    expect(step(tester), 'analysis');
    expect(find.text(onboardingText('az', 'save_failed')), findsOneWidget);
    expect(readOnboardingDraft(actor, backend, env.drafts)!.children[0].name, 'Leyla');
    await tapText(tester, onboardingText('az', 'retry'));
    await flush(tester);
    expect(step(tester), 'results');
  });

  testWidgets('keeps results continuation busy until the profile refresh finishes', (tester) async {
    final env = OnboardingTestEnv();
    addTearDown(env.dispose);
    env.refreshGate = Completer<void>();
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await travel(tester, 'az', 'flow', 'value');
    await tapText(tester, onboardingText('az', 'next'));
    await flush(tester);
    expect(step(tester), 'results');
    final button = tester.widget<OnboardingButton>(find.widgetWithText(OnboardingButton, onboardingText('az', 'view_plan')));
    expect(button.busy, isTrue);
    env.refreshGate!.complete();
    await flush(tester);
    await tapText(tester, onboardingText('az', 'view_plan'));
    expect(step(tester), 'features');
  });

  testWidgets('resumes drafts and cancels auto-advance when navigating back', (tester) async {
    final env = OnboardingTestEnv();
    addTearDown(env.dispose);
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await travel(tester, 'az', 'flow', 'flowGoal');
    await tester.tap(find.byKey(const ValueKey('answer-track')));
    await tester.pump();
    await tester.tap(bySemLabel(onboardingText('az', 'back')));
    await tester.pump(const Duration(milliseconds: 500));
    expect(step(tester), 'data');
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(env.wrap(OnboardingJourney(key: UniqueKey())));
    await flush(tester);
    expect(step(tester), 'data');
    expect(readOnboardingDraft(actor, backend, env.drafts)!.lastPeriodDate, '2026-08-01');
  });

  testWidgets('repairs an existing name without changing dates or enrolling a new funnel', (tester) async {
    final env = OnboardingTestEnv(profile: {'name': 'İstifadəçi', 'life_stage': 'bump', 'last_period_date': '2026-07-10'});
    addTearDown(env.dispose);
    var done = 0;
    await tester.pumpWidget(env.wrap(OnboardingJourney(onComplete: () => done++)));
    await flush(tester);
    expect(step(tester), 'name');
    await tester.enterText(find.byKey(const ValueKey('onb-name')), 'Leyla');
    await tester.pump();
    await tapText(tester, onboardingText('az', 'next'));
    await flush(tester);
    expect(env.db.tables['profiles']!.first['name'], 'Leyla');
    expect(env.db.tables['profiles']!.first['last_period_date'], '2026-07-10');
    expect(done, 1);
    expect(readOnboardingDraft(actor, backend, env.drafts), isNull);
  });

  for (final permission in ['granted', 'denied']) {
    testWidgets('native notification $permission is captured without trapping the journey', (tester) async {
      final env = OnboardingTestEnv(native: true);
      env.permission.requestResult = permission;
      addTearDown(env.dispose);
      await tester.pumpWidget(env.wrap(const OnboardingJourney()));
      await flush(tester);
      await travel(tester, 'az', 'bump', 'notifications');
      await tapText(tester, onboardingText('az', 'allow_notifications'));
      await flush(tester);
      expect(step(tester), 'results');
      expect((env.db.tables['profiles']!.first['onboarding_answers'] as Map)['notifications'], permission);
    });
  }

  testWidgets('keeps the annual discount and offers only monthly coffee pricing after closing it', (tester) async {
    final env = await atPaywall(tester);
    var done = 0;
    await tester.pumpWidget(env.wrap(OnboardingJourney(onComplete: () => done++)));
    await flush(tester);
    expect(step(tester), 'paywall');
    expect(find.descendant(of: find.byKey(const ValueKey('plan-yearly')), matching: find.text(onboardingText('az', 'per_year', {'price': r'$29.99'}))), findsOneWidget);
    expect(find.descendant(of: find.byKey(const ValueKey('plan-yearly')), matching: find.text(onboardingText('az', 'per_year', {'price': r'$19.99'}))), findsOneWidget);
    await tapSem(tester, onboardingText('az', 'close'));
    await flush(tester);
    expect(step(tester), 'offer');
    expect(tester.widget<Text>(find.byKey(const ValueKey('onb-offer-price'))).data, onboardingText('az', 'per_month', {'price': r'$3.99'}));
    expect(find.text(onboardingText('az', 'coffee_title')), findsOneWidget);
    await tapText(tester, onboardingText('az', 'buy_monthly', {'price': r'$3.99'}));
    await flush(tester);
    expect((env.sdk.callsOf('purchasePackage').single.args.single as Map)['product'], containsPair('identifier', 'com.atlasoon.anacan.premium.monthly'));
    expect(step(tester), 'success');
    await tapText(tester, onboardingText('az', 'open_app'));
    await flush(tester);
    final journey = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
    expect([journey['outcome'], journey['plan'], journey['offerKind']], ['purchased', 'monthly', 'monthly-coffee']);
    expect(done, 1);
  });

  testWidgets('opens the monthly offer after an annual store cancellation and does not loop on its close', (tester) async {
    final env = await atPaywall(tester);
    env.sdk.onPurchasePackage = (_) => throw const PurchasesSdkException(code: '1', userCancelled: true);
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await tapText(tester, onboardingText('az', 'buy', {'price': r'$19.99'}));
    await flush(tester);
    expect(env.sdk.count('purchasePackage'), 1);
    expect(step(tester), 'offer');
    await tapSem(tester, onboardingText('az', 'close'));
    await flush(tester);
    expect(step(tester), 'free');
    final journey = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
    expect(journey['offerSeenAt'], isNotNull);
  });

  testWidgets('closes a selected monthly plan without offering a second monthly screen', (tester) async {
    final env = await atPaywall(tester);
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await tapKey(tester, 'plan-monthly');
    await tapSem(tester, onboardingText('az', 'close'));
    await flush(tester);
    expect(step(tester), 'free');
    final journey = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
    expect(journey['offerSeenAt'], isNull);
  });

  testWidgets('the one-time offer is never shown twice for an account (server claim)', (tester) async {
    final env = await atPaywall(tester);
    final profile = env.db.tables['profiles']!.first;
    ((profile['onboarding_answers'] as Map)['journey'] as Map)['offerSeenAt'] = '2026-09-21T10:00:00.000Z';
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    await tapSem(tester, onboardingText('az', 'close'));
    await flush(tester);
    expect(step(tester), 'free');
  });

  testWidgets('preserves a pending transaction across restart and only retries activation', (tester) async {
    final env = await atPaywall(tester, stage: 'flow', pending: true);
    await tester.pumpWidget(env.wrap(const OnboardingJourney()));
    await flush(tester);
    expect(find.text(onboardingText('az', 'purchase_pending')), findsOneWidget);
    await tapText(tester, onboardingText('az', 'refresh_status'));
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(env.sdk.count('purchasePackage'), 0);
    expect(env.syncCalls, greaterThanOrEqualTo(1));
    expect(step(tester), 'success');
  });
}

Future<void> tapSem(WidgetTester tester, String label) async {
  await tester.ensureVisible(bySemLabel(label).first);
  await tester.pump();
  await tester.tap(bySemLabel(label).first);
}

Finder bySemLabel(String label) => find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label);

Future<void> saveOnboardingSetupForTest(OnboardingTestEnv env, OnboardingDraft draft) => saveOnboardingSetup(draft, 'az', env.db);
