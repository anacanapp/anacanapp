// Ported from: src/components/tools/VaccineCalendar.test.tsx
//
// The vitest file mocks useChildren / useVaccines / supabase / Capacitor; here the same data goes through the
// fakes of the baby tools harness (children rows, FakeVaccinesRepository, FakeVaccineScheduler).
import 'dart:async';

import 'package:anacan/core/auth/auth_models.dart';
import 'package:anacan/features/baby/hooks/use_children.dart' show childrenActionsProvider;
import 'package:anacan/features/tools/vaccines/vaccine_calendar.dart';
import 'package:anacan/features/tools/vaccines/vaccine_labels.dart' show regionalText;
import 'package:anacan/features/tools/vaccines/vaccine_reminders.dart';
import 'package:anacan/state/child_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

Map<String, dynamic> child(String id, String name, String birth, String gender, String? country, String? vaccineCountry) => {
      ...childRow(id, name: name, birth: birth, gender: gender, sort: id == 'child-a' ? 0 : 1),
      'country_code': country,
      'vaccine_country_code': vaccineCountry,
    };

Finder countryButton() => find.byKey(const ValueKey('vaccine-country'));
String countryText(WidgetTester tester) =>
    tester.widgetList<Text>(find.descendant(of: countryButton(), matching: find.byType(Text))).map((t) => t.data).join(' ');

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;

  setUp(() {
    h = BabyToolsHarness();
    h.setLanguage('ja');
    h.profile = Profile({'user_id': 'u1', 'country_code': 'AZ'});
    h.repo.children = [
      child('child-a', 'Child A', '2025-01-01', 'girl', 'AZ', 'FR'),
      child('child-b', 'Child B', '2024-01-01', 'boy', 'AZ', 'NL'),
    ];
    // useVaccineCountries is mocked with `name: code` in vitest: the per-language name columns give the same here.
    h.vaccines.countryRows = [
      for (final c in ['AZ', 'FR', 'NL', 'JP', 'SE']) {'id': c, 'code': c, 'name': c, 'name_ja': c, 'name_sv': c, 'name_az': c, 'flag_emoji': '🌍', 'is_active': true},
    ];
  });

  Future<void> select(WidgetTester tester, String id) async {
    final container = ProviderScope.containerOf(tester.element(find.byType(VaccineCalendar)));
    container.read(childStoreProvider.notifier).setSelectedChildId(id);
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
  }

  Future<void> chooseCountry(WidgetTester tester, String code) async {
    await tester.tap(countryButton());
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(ValueKey('vaccine-country-option-$code')).last);
    await tester.pump();
  }

  testWidgets('uses an explicit vaccine choice immediately when switching children or UI language', (tester) async {
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryText(tester), contains('FR'));
    h.setLanguage('sv');
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryText(tester), contains('FR'));
    await select(tester, 'child-b');
    expect(countryText(tester), contains('NL'));
    expect(h.vaccines.scheduleCalls.last, 'NL');
    expect(h.vaccines.calls.where((c) => c.startsWith('country:')), isEmpty);
    await h.finish(tester);
  });

  testWidgets('prioritizes the account country over a legacy child default and lists it first', (tester) async {
    h.repo.children[0] = {...h.repo.children[0], 'vaccine_country_code': '', 'country_code': 'FR'};
    h.profile = Profile({'user_id': 'u1', 'country_code': 'NL'});
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryText(tester), contains('NL'));
    await tester.tap(countryButton());
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    final first = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('vaccine-country-option-')).first;
    expect((tester.widget(first).key! as ValueKey<String>).value, 'vaccine-country-option-NL');
    await h.finish(tester);
  });

  testWidgets('renders safely while the child list is loading, then adopts the loaded child country', (tester) async {
    final children = h.repo.children;
    h.repo.children = [];
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryButton(), findsNothing);
    h.repo.children = children;
    final container = ProviderScope.containerOf(tester.element(find.byType(VaccineCalendar)));
    await container.read(childrenActionsProvider).refetch();
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryText(tester), contains('FR'));
    await h.finish(tester);
  });

  testWidgets('requires a confirmed country write and does not let a late save switch another child country', (tester) async {
    final finish = Completer<Map<String, dynamic>?>();
    h.vaccines.onCountryWrite = (_, _, _) => finish.future;
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await chooseCountry(tester, 'SE');
    expect(countryText(tester), contains('FR'));
    expect(h.vaccines.calls, ['country:child-a:u1:SE']);
    await select(tester, 'child-b');
    finish.complete({'id': 'child-a', 'vaccine_country_code': 'SE'});
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(countryText(tester), contains('NL'));
    expect(h.vaccines.scheduleCalls.last, 'NL');
    await h.finish(tester);
  });

  testWidgets('keeps the previous country and reports a failed or unconfirmed save', (tester) async {
    h.vaccines.onCountryWrite = (_, _, _) async => null;
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    final childrenCalls = h.repo.childrenCalls;
    await chooseCountry(tester, 'SE');
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text(regionalText('countrySaveFailed', 'ja')), findsOneWidget);
    expect(countryText(tester), contains('FR'));
    expect(h.repo.childrenCalls, childrenCalls);
    await h.finish(tester);
  });

  testWidgets('shows no reminder switch on the web and schedules nothing', (tester) async {
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('vaccine-reminders')), findsNothing);
    expect(h.scheduler.syncs, isEmpty);
    await h.finish(tester);
  });

  testWidgets('waits for the schedule and logs, then reschedules on the phone and cancels when switched off (per device)', (tester) async {
    h.scheduler.native = true;
    final gate = Completer<void>();
    h.vaccines.gate = gate.future;
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pump(const Duration(milliseconds: 50));
    final reminders = find.byKey(const ValueKey('vaccine-reminders'));
    expect(reminders, findsOneWidget);
    expect(tester.widget<A3SwitchView>(find.byType(A3SwitchView)).on, isTrue);
    expect(h.scheduler.syncs, isEmpty);
    gate.complete();
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.scheduler.syncs, ['vaccine:$vaccineChildBaseId']);
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.scheduler.syncs, hasLength(1));
    await tester.tap(reminders);
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.scheduler.clears, isNotEmpty);
    expect(h.scheduler.syncs, hasLength(1));
    expect(tester.widget<A3SwitchView>(find.byType(A3SwitchView)).on, isFalse);
    expect(h.store.getItem('anacan.vaccineReminders.v1'), '0');
    await h.finish(tester);
  });
  testWidgets('says so when notifications are blocked', (tester) async {
    h.scheduler.native = true;
    h.scheduler.result = 'denied';
    h.setLanguage('az');
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Bildirişlər telefonun ayarlarında bağlıdır.'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('shows vaccine names and age groups in the app language, grouped by schedule age not by text', (tester) async {
    Map<String, dynamic> vaccine(String code, String name) =>
        {'id': code, 'code': code, 'name': name, 'name_az': name, 'is_active': true, 'is_mandatory': true, 'color_hex': null, 'country_code': 'FR'};
    Map<String, dynamic> row(String id, int days, String age, Map<String, dynamic> v) => {
          'id': id, 'vaccine_id': v['id'], 'country_code': 'FR', 'dose_number': 1, 'recommended_age_days': days, 'age_label': age,
          'age_label_az': age, 'dose_label': '1-ci doza', 'dose_label_az': '1-ci doza', 'min_age_days': null, 'max_age_days': null,
          'notes': null, 'sort_order': 1,
        };
    final mmr = vaccine('MMR', 'Qızılca, parotit, məxmərək'), hep = vaccine('HepB', 'Hepatit B'), pcv = vaccine('PCV', 'Pnevmokokk');
    h.vaccines.vaccineRows['FR'] = [mmr, hep, pcv];
    h.vaccines.scheduleRows['FR'] = [row('h1', 60, '2 aylıq', hep), row('h2', 60, '8 həftə', pcv), row('m1', 365, '12 aylıq', mmr)];
    await h.pump(tester, VaccineCalendar(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('vaccine-tab-all')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    final groups = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('vaccine-age-group-'));
    expect(groups, findsNWidgets(2));
    String textOf(Finder f) => tester.widgetList<Text>(find.descendant(of: f, matching: find.byType(Text))).map((t) => t.data ?? '').join('|');
    expect(textOf(groups.at(0)), contains('B型肝炎 (HepB)'));
    expect(textOf(groups.at(0)), contains('肺炎球菌 (PCV)'));
    expect(textOf(groups.at(1)), contains('麻しん、おたふくかぜ、風しん (MMR)'));
    expect(find.textContaining('Hepatit B'), findsNothing);
    await h.finish(tester);
  });
}
