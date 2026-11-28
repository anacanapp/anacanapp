// Ported from: src/components/partner/{NameVotingScreen,DailySummaryScreen,SurpriseTab,WeeklyStatsTab}.tsx,
//              src/components/partner/v2/{PartnerShoppingScreen,PartnerAppointmentsScreen,PartnerBabyDayScreen,
//              HospitalRunScreen,LiveContractionsScreen,PartnerSharingScreen,NightShiftScreen,BirthPlanScreen,
//              PostpartumSupportScreen}.tsx, src/components/pregnancy-loss/{PartnerLossSupportScreen,PartnerLossCard}.tsx,
//              src/pages/Index.tsx (registration) — behaviour; no vitest file exists for these screens
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/domain/sleep/sleep_training.dart' show PlanState;
import 'package:anacan/features/partner/data/partner_hospital_bag.dart';
import 'package:anacan/features/partner/partner_ports.dart';
import 'package:anacan/features/partner/screens/birth_plan_screen.dart';
import 'package:anacan/features/partner/screens/daily_summary_screen.dart';
import 'package:anacan/features/partner/screens/data/screens_backend.dart';
import 'package:anacan/features/partner/screens/hospital_run_screen.dart';
import 'package:anacan/features/partner/screens/live_contractions_screen.dart';
import 'package:anacan/features/partner/screens/name_voting_screen.dart';
import 'package:anacan/features/partner/screens/night_shift_screen.dart';
import 'package:anacan/features/partner/screens/partner_appointments_screen.dart';
import 'package:anacan/features/partner/screens/partner_baby_day_screen.dart';
import 'package:anacan/features/partner/screens/partner_loss_support_screen.dart';
import 'package:anacan/features/partner/screens/partner_sharing_screen.dart';
import 'package:anacan/features/partner/screens/partner_shopping_screen.dart';
import 'package:anacan/features/partner/screens/partner_surprises_screen.dart';
import 'package:anacan/features/partner/screens/partner_weekly_stats_screen.dart';
import 'package:anacan/features/partner/screens/postpartum_support_screen.dart';
import 'package:anacan/features/partner/screens/register_screens.dart';
import 'package:anacan/features/partner/screens/screens_copy.dart';
import 'package:anacan/features/partner/screens/screens_wiring.dart';
import 'package:anacan/features/partner/ui/alert_receiver.dart' show alertMapsOpenerProvider;
import 'package:anacan/features/partner/ui/partner_ui.dart' show PartnerTap;
import 'package:anacan/features/profile/profile_interfaces.dart' show PremiumPrompt, premiumPromptProvider;
import 'package:anacan/features/tools/data/tools_data_source.dart';
import 'package:anacan/features/tools/names/favorite_names.dart';
import 'package:anacan/features/tools/shopping/shopping_data.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'screens_support.dart';

class _Tools implements ToolsDataSource {
  _Tools(this.tables);
  final Map<String, List<Map<String, dynamic>>> tables;
  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async => [...?tables[query.table]];
}

class _Names implements NamesRepository {
  _Names(this.rows);
  final List<Map<String, dynamic>> rows;
  final List<Map<String, Object?>> inserted = [];
  @override
  Future<List<Map<String, dynamic>>> loadFavorites(String userId) async => rows;
  @override
  Future<Map<String, dynamic>> insertFavorite(Map<String, Object?> row) async {
    inserted.add(row);
    return {'id': 'n${inserted.length}', 'created_at': '', ...row};
  }

  @override
  Future<void> deleteFavorite(String userId, String name) async {}
  @override
  Future<({Object? data, Object? error})> aiLookup(String name, String language) async => (data: null, error: null);
}

class _Shopping extends ShoppingItemsController {
  _Shopping(this.items);
  final List<Map<String, dynamic>> items;
  final List<String> toggled = [];
  final List<String> added = [];
  @override
  ShoppingState build() => ShoppingState(items: items, loading: false);
  @override
  Future<void> toggleItem(String id) async => toggled.add(id);
  @override
  Future<({Map<String, dynamic>? data, Object? error})> addItem({required String name, int? quantity, String? priority}) async {
    added.add(name);
    return (data: null, error: null);
  }
}

class _Prompt implements PremiumPrompt {
  int shown = 0;
  @override
  Future<void> show(BuildContext context, {String? feature}) async => shown++;
}

Map<String, dynamic> _woman(String stage, [Map<String, dynamic> extra = const {}]) => {
      'id': kLinkedProfileId,
      'user_id': kPartnerUserId,
      'name': 'Leyla',
      'life_stage': stage,
      'baby_name': stage == 'mommy' ? 'Aysel' : null,
      'baby_birth_date': stage == 'mommy' ? '2026-11-13' : null,
      ...extra,
    };

List<Override> _partner(FakePartnerBackend backend, {FakeScreensBackend? screens, FakeHaptics? haptics, List<Override> extra = const []}) => partnerOverrides(
      backend: backend,
      haptics: haptics,
      role: 'partner',
      lifeStage: 'partner',
      extra: [partnerScreensBackendProvider.overrideWithValue(screens ?? FakeScreensBackend()), ...extra],
    );

Future<void> _pump(WidgetTester tester, Widget screen, List<Override> overrides, {Size size = const Size(390, 2400)}) async {
  await pumpApp(tester, screen, overrides: overrides, scroll: false, size: size);
  await pumpFrames(tester);
}

void main() {
  setUpAll(() async {
    await ensureDateLocales();
    await loadAnacanFonts();
  });
  setUp(() => DomainClock.setSystemTime(DateTime(2026, 11, 27, 10)));
  tearDown(DomainClock.reset);

  test('registerPartnerScreens registers the 16 partner sub-screens', () {
    final r = FeatureRegistry();
    registerPartnerScreens(r);
    for (final id in [
      ScreenId.nameVoting, ScreenId.partnerHospitalBag, ScreenId.dailySummary, ScreenId.partnerShopping, //
      ScreenId.partnerAppointments, ScreenId.partnerBabyDay, ScreenId.partnerWeeklyStats, ScreenId.partnerSurprises,
      ScreenId.partnerParenting, ScreenId.hospitalRun, ScreenId.liveContractions, ScreenId.partnerSharing,
      ScreenId.nightShift, ScreenId.birthPlan, ScreenId.postpartumSupport, ScreenId.partnerLossSupport,
    ]) {
      expect(r.screen(id), isNotNull, reason: id.id);
    }
  });

  screenTest('NameVotingScreen: matches with her favourites, liking a name saves it', (tester) async {
    final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
    final screens = FakeScreensBackend()
      ..rows['favoriteNames'] = [
        {'id': 'p1', 'user_id': kPartnerUserId, 'name': 'Aysel', 'gender': 'girl', 'created_at': ''},
        {'id': 'p2', 'user_id': kPartnerUserId, 'name': 'Leyla', 'gender': 'girl', 'created_at': ''},
      ];
    final names = _Names([
      {'id': 'm1', 'user_id': kUserId, 'name': 'Aysel', 'gender': 'girl', 'created_at': ''},
    ]);
    await _pump(
        tester,
        NameVotingScreen(onBack: () {}),
        _partner(backend, screens: screens, extra: [
          namesRepositoryProvider.overrideWithValue(names),
          toolsDataSourceProvider.overrideWithValue(_Tools({
            'baby_names_db': [
              {'name': 'Aysel', 'gender': 'girl', 'meaning': 'Ay kimi'},
              {'name': 'Murad', 'gender': 'boy', 'meaning': 'Arzu'},
            ],
          })),
        ]));
    // Pool: Aysel, Murad, then her favourite Leyla.
    expect(find.byKey(const ValueKey('name-Aysel')), findsOneWidget);
    expect(find.byKey(const ValueKey('name-Leyla')), findsOneWidget);
    expect(find.text('Match'), findsWidgets);
    await tapOn(tester, find.byKey(const ValueKey('nv-tab-matches')));
    await tester.pump();
    expect(find.byKey(const ValueKey('name-Aysel')), findsOneWidget);
    expect(find.byKey(const ValueKey('name-Murad')), findsNothing);
    await tapOn(tester, find.byKey(const ValueKey('nv-tab-browse')));
    await tester.pump();
    await tapOn(tester, find.descendant(of: find.byKey(const ValueKey('name-Murad')), matching: find.byType(PartnerTap)));
    await pumpFrames(tester);
    expect(names.inserted.single['name'], 'Murad');
  });

  screenTest('DailySummaryScreen: pregnancy tiles, and her baby day from partner_day_stage_stats_v1', (tester) async {
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('mommy')
      ..rpcs['partner_daily_summaries_v1'] = ((_) => [
            {'id': 's1', 'summary_date': '2026-11-27', 'mood': 4, 'water_intake': 1500, 'symptoms': ['nausea'], 'notes': 'Yaxşı gün'},
            {'id': 's2', 'summary_date': '2026-11-26', 'mood': 1, 'water_intake': 500},
          ])
      ..rpcs['partner_day_stage_stats_v1'] = (p) => {'stage': 'mommy', 'feeds': 6, 'feed_ml': 420, 'sleep_min': 135, 'diapers': 5};
    await _pump(tester, DailySummaryScreen(onBack: () {}), _partner(backend));
    expect(find.text('Bu gün'), findsOneWidget);
    expect(find.text('Dünən'), findsOneWidget);
    expect(find.text('Ən son'), findsOneWidget);
    expect(find.text('Yaxşı'), findsOneWidget);
    expect(find.text('🍼 6 · 420ml'), findsNWidgets(2));
    expect(find.text('😴 2:15'), findsNWidgets(2));
    expect(find.text('Yaxşı gün'), findsOneWidget);
  });

  screenTest('PartnerShoppingScreen: adds with a haptic-free toast and ticks items', (tester) async {
    final haptics = FakeHaptics();
    final shopping = _Shopping([
      {'id': '1', 'name': 'Süd', 'quantity': 2, 'is_checked': false, 'added_by': 'woman', 'priority': 'high'},
      {'id': '2', 'name': 'Çörək', 'quantity': 1, 'is_checked': true, 'added_by': 'partner', 'priority': 'low'},
    ]);
    await _pump(tester, PartnerShoppingScreen(onBack: () {}), _partner(FakePartnerBackend(), haptics: haptics, extra: [shoppingItemsProvider.overrideWith(() => shopping)]));
    expect(find.text('x2'), findsOneWidget);
    expect(find.text('O əlavə etdi'), findsOneWidget);
    expect(find.text('Sən əlavə etdin'), findsOneWidget);
    await tapOn(tester, find.text('✓'));
    await tester.pump();
    expect(shopping.toggled, ['2']);
    expect(haptics.calls, ['light']);
    await tester.enterText(find.byKey(const ValueKey('shopping-input')), 'Alma');
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('shopping-add')));
    await pumpFrames(tester);
    expect(shopping.added, ['Alma']);
  });

  screenTest('PartnerAppointmentsScreen: a closed share, then upcoming and past visits', (tester) async {
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('bump')
      ..sharingOfOthers.add({'share_appointments': false});
    final screens = FakeScreensBackend();
    await _pump(tester, PartnerAppointmentsScreen(onBack: () {}), _partner(backend, screens: screens));
    expect(find.text('Paylaşım bağlıdır'), findsOneWidget);
    expect(screens.calls, isEmpty);
  });

  screenTest('PartnerAppointmentsScreen: lists her visits from 30 days ago', (tester) async {
    final backend = FakePartnerBackend()..womanProfiles[kLinkedProfileId] = _woman('bump');
    final screens = FakeScreensBackend()
      ..rows['appointments'] = [
        {'id': 'a', 'title': 'USM', 'event_date': '2026-11-20', 'event_time': null, 'event_type': 'appointment'},
        {'id': 'b', 'title': 'Həkim', 'event_date': '2026-11-27', 'event_time': '09:30:00', 'event_type': 'appointment', 'description': 'Qan analizi'},
        {'id': 'c', 'title': 'Vitamin', 'event_date': '2026-12-01', 'event_type': 'pill'},
      ];
    await _pump(tester, PartnerAppointmentsScreen(onBack: () {}), _partner(backend, screens: screens));
    expect(screens.calls.single.$2, [kPartnerUserId, '2026-10-28']);
    expect(find.text('Qarşıdan gələn'), findsOneWidget);
    expect(find.text('Keçmiş'), findsOneWidget);
    expect(find.text('Bu gün'), findsOneWidget);
    expect(find.textContaining('09:30'), findsOneWidget);
    expect(find.text('Qan analizi'), findsOneWidget);
  });

  screenTest("PartnerBabyDayScreen: today's totals, her sleep plan and the log list", (tester) async {
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('mommy')
      ..rpcs['partner_children_v1'] = (_) => [
            {'id': 'k1', 'name': 'Aysel', 'birth_date': '2026-11-13', 'is_current': true},
          ];
    final screens = FakeScreensBackend()
      ..rows['babyLogs'] = [
        {'id': '1', 'log_type': 'feeding', 'start_time': '2026-11-27T06:00:00Z', 'amount_ml': 120},
        {'id': '2', 'log_type': 'sleep', 'start_time': '2026-11-27T03:00:00Z', 'end_time': '2026-11-27T04:30:00Z'},
        {'id': '3', 'log_type': 'diaper', 'start_time': '2026-11-27T02:00:00Z', 'diaper_type': 'wet'},
      ];
    await _pump(
        tester,
        PartnerBabyDayScreen(onBack: () {}),
        _partner(backend, screens: screens, extra: [
          partnerSleepPlanProvider.overrideWith((ref, arg) async => const PlanState(method: 'chair', planStartDate: '2026-11-25', wakeTime: '07:00')),
        ]));
    expect(find.text('AYSEL'), findsOneWidget);
    expect(find.text('120 ml'), findsOneWidget);
    expect(find.text('1s 30d'), findsOneWidget);
    expect(find.byKey(const ValueKey('partner-sleep-plan')), findsOneWidget);
    expect(find.textContaining('Gün 3/14'), findsOneWidget);
    expect(find.text('Bez dəyişmə · wet'), findsOneWidget);
    expect(find.text('Qidalanma · 120 ml'), findsOneWidget);
  });

  screenTest('PartnerWeeklyStatsScreen: totals and the three charts', (tester) async {
    final backend = FakePartnerBackend()
      ..profileUserIds[kLinkedProfileId] = kPartnerUserId
      ..rpcs['partner_daily_logs_v1'] = (_) => [
            {'log_date': '2026-11-26', 'mood': 4, 'water_intake': 2100},
            {'log_date': '2026-11-27', 'mood': 2, 'water_intake': 900},
          ];
    await _pump(tester, PartnerWeeklyStatsScreen(onBack: () {}), _partner(backend));
    expect(find.text('3.0L'), findsOneWidget);
    expect(find.text('3.0'), findsOneWidget);
    expect(find.text('2.1L'), findsOneWidget);
    expect(find.text('Məşqlər'), findsOneWidget);
  });

  screenTest('PartnerSurprisesScreen: completing a planned surprise tells her and adds points', (tester) async {
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('bump')
      ..tables['partner_surprises'] = [
        {'id': 's1', 'user_id': kUserId, 'status': 'planned', 'surprise_id': 'i1', 'surprise_title': 'Şam yeməyi', 'surprise_emoji': '🍷', 'surprise_points': 20, 'planned_date': '2026-12-01'},
        {'id': 's2', 'user_id': kUserId, 'status': 'completed', 'surprise_title': 'Gül', 'surprise_emoji': '🌹', 'surprise_points': 10, 'completed_date': '2026-11-20T10:00:00Z'},
      ];
    final tools = _Tools({
      'surprise_ideas': [
        {'id': 'i1', 'title': 'Dinner', 'title_az': 'Şam yeməyi', 'category': 'romantic', 'points': 20},
        {'id': 'i2', 'title': 'Walk', 'title_az': 'Gəzinti', 'category': 'adventure', 'points': 15},
      ],
    });
    await _pump(tester, PartnerSurprisesScreen(onBack: () {}), _partner(backend, extra: [toolsDataSourceProvider.overrideWithValue(tools)]));
    expect(find.text('10 xal'), findsOneWidget);
    expect(find.text('Planlandı'), findsOneWidget);
    expect(find.byKey(const ValueKey('idea-plan-i2')), findsOneWidget);
    expect(find.byKey(const ValueKey('surprise-cat-adventure')), findsOneWidget);
    await tapOn(tester, find.byKey(const ValueKey('planned-complete-s1')));
    await pumpFrames(tester);
    expect(backend.callsOf('update', 'partner_surprises'), hasLength(1));
    final message = backend.callsOf('insert', 'partner_messages').single.payload! as Map;
    expect((message['message_type'], message['receiver_id']), ('surprise_completed', kPartnerUserId));
    expect((backend.callsOf('insert', 'notifications').single.payload! as Map)['user_id'], kPartnerUserId);
    expect(find.text('30 xal'), findsOneWidget);
  });

  screenTest('HospitalRunScreen: her location from the birth alert, the bag and the checklist', (tester) async {
    final backend = FakePartnerBackend()
      ..sos.add({'id': 'b1', 'alert_type': 'birth', 'sender_id': kPartnerUserId, 'receiver_id': kUserId, 'latitude': 40.4, 'longitude': 49.8, 'is_acknowledged': true});
    final opened = <Uri>[];
    final nav = <String>[];
    var contractions = 0;
    await _pump(
        tester,
        HospitalRunScreen(onBack: () {}, onNavigate: nav.add, onOpenContractions: () => contractions++),
        _partner(backend, extra: [
          partnerHospitalBagProvider.overrideWithValue(const PartnerHospitalBag(items: [], hiddenItems: [], loading: false, checkedCount: 6, totalCount: 8, progress: 75)),
          alertMapsOpenerProvider.overrideWithValue((url) async => opened.add(url)),
        ]));
    expect(find.text('6/8 hazır'), findsOneWidget);
    expect(find.text('75%'), findsOneWidget);
    await tapOn(tester, find.byKey(const ValueKey('hr-location')));
    await tapOn(tester, find.byKey(const ValueKey('hr-bag')));
    await tapOn(tester, find.byKey(const ValueKey('hr-contractions')));
    await tapOn(tester, find.byKey(const ValueKey('hr-step-1')));
    await tester.pump();
    expect(opened.single.toString(), 'https://maps.google.com/?q=40.4,49.8');
    expect(nav, ['partner-hospital-bag']);
    expect(contractions, 1);
  });

  screenTest('LiveContractionsScreen: the 5-1-1 alert and the list', (tester) async {
    final backend = FakePartnerBackend()..womanProfiles[kLinkedProfileId] = _woman('bump');
    String ago(int m) => DateTime(2026, 11, 27, 10).subtract(Duration(minutes: m)).toUtc().toIso8601String();
    final screens = FakeScreensBackend()
      ..rows['contractions'] = [
        {'id': '1', 'start_time': ago(2), 'duration_seconds': 70, 'interval_seconds': 280},
        {'id': '2', 'start_time': ago(7), 'duration_seconds': 65, 'interval_seconds': 290},
        {'id': '3', 'start_time': ago(12), 'duration_seconds': 60, 'interval_seconds': 300},
      ];
    await _pump(tester, LiveContractionsScreen(onBack: () {}), _partner(backend, screens: screens));
    expect(find.byKey(const ValueKey('lc-511')), findsOneWidget);
    expect(find.text('1:05'), findsNWidgets(2)); // the average and the 65 s row
    expect(find.text('5d'), findsOneWidget);
    expect(find.textContaining('2 dəq əvvəl'), findsOneWidget);
    expect(find.text('1:10'), findsOneWidget);
  });

  group('PartnerSharingScreen (mother)', () {
    screenTest('linked: the week, a group switch saves both keys, the shared tools', (tester) async {
      final backend = FakePartnerBackend()
        ..womanProfiles[kLinkedProfileId] = {'id': kLinkedProfileId, 'user_id': kPartnerUserId, 'name': 'Elvin', 'life_stage': 'partner'}
        ..tables['partner_sharing_settings'] = [
          {'user_id': kUserId, 'share_mood': false, 'share_symptoms': false},
        ];
      final nav = <String>[];
      await _pump(
          tester,
          PartnerSharingScreen(onBack: () {}, onNavigate: nav.add),
          partnerOverrides(
            backend: backend,
            store: seededStore(user: {'userId': kUserId, 'role': 'woman', 'lifeStage': 'bump'}),
            feed: PartnerMessagesFeed(messages: [
              {'receiver_id': kUserId, 'message_type': 'love', 'created_at': DateTime.utc(2026, 11, 26).toIso8601String()},
            ]),
          ));
      expect(find.text('Elvin'), findsOneWidget);
      expect(find.byKey(const ValueKey('sh-tool-birth-plan')), findsOneWidget);
      expect(find.byKey(const ValueKey('sh-group-pregnancy')), findsOneWidget);
      expect(find.byKey(const ValueKey('sh-group-cycle')), findsNothing);
      await tapOn(tester, find.byKey(const ValueKey('sh-switch-mood')));
      await pumpFrames(tester);
      expect(backend.callsOf('upsert', 'partner_sharing_settings'), hasLength(2));
      await tapOn(tester, find.byKey(const ValueKey('sh-tool-birth-plan')));
      await tapOn(tester, find.byKey(const ValueKey('sh-notifications')));
      expect(nav, ['birth-plan', 'partner-notifications']);
      expect(find.byKey(const ValueKey('sh-unlink')), findsOneWidget);
      await tapOn(tester, find.byKey(const ValueKey('sh-more')));
      await tester.pump();
      expect(find.byKey(const ValueKey('sh-group-cycle')), findsOneWidget);
    });

    screenTest('not linked and not Premium: the invite asks for Premium', (tester) async {
      final prompt = _Prompt();
      await _pump(
          tester,
          PartnerSharingScreen(onBack: () {}),
          partnerOverrides(
            backend: FakePartnerBackend(),
            linked: null,
            store: seededStore(user: {'userId': kUserId, 'role': 'woman', 'lifeStage': 'flow'}),
            extra: [premiumPromptProvider.overrideWithValue(prompt)],
          ));
      expect(find.text(feature37Text('ph_invite_title')), findsOneWidget);
      expect(find.byKey(const ValueKey('sh-unlink')), findsNothing);
      await tapOn(tester, find.byKey(const ValueKey('sh-premium')));
      await tester.pump();
      expect(prompt.shown, 1);
    });
  });

  screenTest('NightShiftScreen: tonight, last night and the week through the family RPCs', (tester) async {
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('mommy')
      ..rpcs['night_shifts_v1'] = (_) => [
            {'shift_date': '2026-11-26', 'assignee': 'mother', 'is_done': false, 'wakeups': 2, 'updated_by_me': false, 'updated_at': 'x'},
            {'shift_date': '2026-11-27', 'assignee': 'partner', 'is_done': false, 'updated_by_me': true, 'updated_at': 'y'},
          ];
    await _pump(tester, NightShiftScreen(onBack: () {}), _partner(backend));
    final range = backend.callsOf('rpc', 'night_shifts_v1').first.payload! as Map;
    expect((range['p_from'], range['p_to']), ('2026-11-20', '2026-12-03'));
    expect(find.byKey(const ValueKey('ns-last-night')), findsOneWidget);
    expect(find.text('2'), findsWidgets);
    await tapOn(tester, find.byKey(const ValueKey('ns-plus')));
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('ns-mark-done')));
    await pumpFrames(tester);
    final done = backend.callsOf('rpc', 'night_shift_set_v1').single.payload! as Map;
    expect((done['p_date'], done['p_assignee'], done['p_is_done'], done['p_wakeups']), ('2026-11-26', 'mother', true, 3));
    // Tonight is mine: tapping my button again clears it.
    await tapOn(tester, find.byKey(const ValueKey('ns-assign-partner')));
    await pumpFrames(tester);
    final cleared = backend.callsOf('rpc', 'night_shift_set_v1').last.payload! as Map;
    expect((cleared['p_date'], cleared['p_assignee']), ('2026-11-27', null));
  });

  screenTest('NightShiftScreen: no family link', (tester) async {
    final backend = FakePartnerBackend()..errors['rpc:night_shifts_v1'] = Exception('NIGHT_SHIFT_NO_FAMILY');
    await _pump(tester, NightShiftScreen(onBack: () {}), _partner(backend));
    // The query retries 3 times (1 s, 2 s, 4 s) before it reports the error.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(seconds: 5));
    }
    expect(find.text(feature37Text('family_no_link')), findsOneWidget);
  });

  screenTest('BirthPlanScreen: edits the shared plan and saves it with the loaded version', (tester) async {
    final backend = FakePartnerBackend()
      ..rpcs['birth_plan_get_v1'] = ((_) => {
            'plan': {'place': 'Mərkəzi Klinika', 'companions': ['partner']},
            'updated_at': '2026-11-20T10:00:00Z',
            'updated_by_me': false,
            'is_mother': false,
          })
      ..rpcs['birth_plan_save_v1'] = (_) => '2026-11-27T10:00:00Z';
    await _pump(tester, BirthPlanScreen(onBack: () {}), _partner(backend));
    expect(find.text(feature37Text('bp_intro_partner')), findsOneWidget);
    expect(find.byKey(const ValueKey('bp-save')), findsNothing);
    await tapOn(tester, find.byKey(const ValueKey('bp-companions-none')));
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('bp-pain-epidural')));
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('bp-save')));
    await pumpFrames(tester);
    final saved = backend.callsOf('rpc', 'birth_plan_save_v1').single.payload! as Map;
    expect(saved['p_plan'], {'place': 'Mərkəzi Klinika', 'companions': ['none'], 'pain': 'epidural'});
    expect(saved['p_expected_updated_at'], '2026-11-20T10:00:00Z');
    expect(find.byKey(const ValueKey('bp-save')), findsNothing);
  });

  screenTest('PostpartumSupportScreen: the current week, tabs and a one-tap message to her', (tester) async {
    final sent = <(String, String, String)>[];
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = _woman('mommy')
      ..rpcs['partner_daily_logs_v1'] = (_) => [
            for (final d in ['2026-11-24', '2026-11-25', '2026-11-26']) {'log_date': d, 'mood': 1},
          ];
    await _pump(
        tester,
        PostpartumSupportScreen(onBack: () {}),
        _partner(backend, extra: [partnerChatSenderProvider.overrideWithValue((a, b, c) async => sent.add((a, b, c)))]));
    // Baby born 14 days ago → week 3.
    expect(tester.getSemantics(find.byKey(const ValueKey('pp-week-3'))).flagsCollection.isToggled.toString(), contains('isTrue'));
    expect(find.byKey(const ValueKey('support-low-mood')), findsOneWidget);
    await tapOn(tester, find.byKey(const ValueKey('pp-tab-support')));
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('pp-phrase-0')));
    await pumpFrames(tester);
    expect(sent.single.$1, kUserId);
    expect(sent.single.$2, kPartnerUserId);
    await tapOn(tester, find.byKey(const ValueKey('pp-tab-signs')));
    await tester.pump();
    expect(find.byKey(const ValueKey('pp-signs-result')), findsOneWidget);
  });

  screenTest('PartnerLossSupportScreen: phase of her loss week, tasks sent to her, the signs check', (tester) async {
    final sent = <String>[];
    final backend = FakePartnerBackend()..womanProfiles[kLinkedProfileId] = _woman('flow', {'pregnancy_loss_date': '2026-11-10', 'loss_share_partner': true});
    await _pump(
        tester,
        PartnerLossSupportScreen(onBack: () {}),
        _partner(backend, extra: [partnerChatSenderProvider.overrideWithValue((a, b, c) async => sent.add(c))]));
    // 17 days → week 3 → phase 1.
    expect(tester.getSemantics(find.byKey(const ValueKey('loss-phase-1'))).flagsCollection.isToggled.toString(), contains('isTrue'));
    await tapOn(tester, find.byKey(const ValueKey('loss-task-0')));
    await tapOn(tester, find.byKey(const ValueKey('loss-task-1')));
    await tester.pump();
    await tapOn(tester, find.byKey(const ValueKey('loss-tasks-send')));
    await pumpFrames(tester);
    expect(sent, hasLength(1));
    expect(sent.single, contains('🤍'));
    await tapOn(tester, find.byKey(const ValueKey('loss-tab-signs')));
    await tester.pump();
    expect(find.text('112'), findsNothing);
  });

  screenTest('PartnerLossCard: the week of her recovery; the wiring fills the partner home slots', (tester) async {
    var opened = 0;
    await _pump(tester, PartnerLossCard(lossDate: '2026-11-10', onOpen: () => opened++), [...baseOverrides()], size: const Size(390, 844));
    expect(find.textContaining('3/8'), findsOneWidget);
    await tapOn(tester, find.byKey(const ValueKey('partner-loss-card')));
    expect(opened, 1);
    expect(kPartnerScreensHomeSlots.lossCard, isNotNull);
    expect(kPartnerScreensHomeSlots.lossText!('az')!.chips, isNotEmpty);
  });
}
