// Ported from: src/components/partner/v2/PartnerHomeScreen.tsx, PartnerLinkForm.tsx, PartnerOnboardingTour.tsx,
//              BirthModeCard.tsx, DailyMissionsCard.tsx, PartnerActivityFeed.tsx (behaviour; no vitest file exists)
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/home/data/home_repository.dart';
import 'package:anacan/features/partner/partner_copy.dart';
import 'package:anacan/features/partner/partner_ports.dart';
import 'package:anacan/features/partner/ui/home_cards.dart';
import 'package:anacan/features/partner/ui/partner_home_screen.dart';
import 'package:anacan/features/partner/ui/partner_link_form.dart';
import 'package:anacan/features/partner/ui/partner_onboarding_tour.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../../home/home_test_support.dart' show FakeHomeRepository;
import '../support.dart';

Map<String, dynamic> _woman(Map<String, dynamic> extra) => {
      'id': kLinkedProfileId,
      'user_id': kPartnerUserId,
      'name': 'Leyla',
      'life_stage': 'bump',
      'last_period_date': '2026-03-01',
      'cycle_length': 28,
      'period_length': 5,
      ...extra,
    };

class _Env {
  _Env({this.linked = kLinkedProfileId, Map<String, dynamic>? woman, bool tourSeen = true, this.unread = 0, this.messages = const []}) {
    if (woman != null) backend.womanProfiles[kLinkedProfileId] = woman;
    backend.rpcs['partner_daily_logs_v1'] = (p) => [
          {'mood': 2, 'symptoms': ['nausea', 'back_pain'], 'water_intake': 900, 'log_date': p!['p_from']},
        ];
    store = seededStore(
      user: {'userId': kUserId, 'role': 'partner', 'name': 'Elvin'},
      extra: {if (tourSeen) kPartnerTourKey: '1'},
    );
  }

  final FakePartnerBackend backend = FakePartnerBackend();
  final FakeHaptics haptics = FakeHaptics();
  final List<(String, String, String)> sent = [];
  final List<String> nav = [];
  final int unread;
  final List<Map<String, dynamic>> messages;
  late final LocalStore store;
  String? linked;
  int chats = 0;
  Object? linkError;

  List<Override> get overrides => partnerOverrides(
        backend: backend,
        haptics: haptics,
        linked: linked,
        lifeStage: 'partner',
        role: 'partner',
        store: store,
        feed: PartnerMessagesFeed(messages: messages, unreadCount: unread),
        extra: [
          homeRepositoryProvider.overrideWithValue(FakeHomeRepository()),
          partnerChatSenderProvider.overrideWithValue((a, b, c) async => sent.add((a, b, c))),
          partnerLinkActionProvider.overrideWithValue((code) async => AuthResult<void>(error: linkError)),
        ],
      );

  Widget screen() => PartnerHomeScreen(onNavigate: nav.add, onOpenChat: () => chats++);
}

Future<void> _pump(WidgetTester tester, _Env env, {Size size = const Size(390, 2400)}) async {
  await pumpApp(tester, env.screen(), overrides: env.overrides, size: size);
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  setUp(() => DomainClock.setSystemTime(DateTime(2026, 11, 27, 10)));
  tearDown(DomainClock.reset);

  screenTest('not linked: how to link and the pairing form', (tester) async {
    final env = _Env(linked: null);
    env.linkError = const PartnerLinkError('INVALID_PARTNER_CODE');
    await _pump(tester, env);
    expect(find.text('Hələ bağlanmamısınız'), findsOneWidget);
    expect(find.byType(PartnerLinkForm), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('partner-link-code')), 'anacan-abc');
    await tester.pump();
    expect(find.text('ANACAN-ABC'), findsOneWidget);
    await tester.tap(find.text(feature37Text('partner_link_submit')));
    await tester.pump();
    await tester.pump();
    expect(find.text(getPartnerLinkErrorMessage(env.linkError)), findsOneWidget);

    env.linkError = null;
    await tester.tap(find.text(feature37Text('partner_link_submit')));
    await tester.pump();
    await tester.pump();
    expect(find.text(feature37Text('partner_linked_ok')), findsOneWidget);
  });

  screenTest('linked bump: hero with her day, birth mode from week 36, love and quick messages', (tester) async {
    final env = _Env(woman: _woman({}));
    await _pump(tester, env);
    expect(find.text('Leyla'), findsOneWidget);
    expect(find.text('Salam, Elvin! 👋'), findsOneWidget);
    // Week 38 on 27 Nov for an LMP of 1 Mar; due 6 Dec.
    expect(find.text('38'), findsOneWidget);
    expect(find.text('9'), findsOneWidget);
    expect(find.text('900'), findsOneWidget);
    expect(find.text('😔'), findsOneWidget);
    expect(find.text('nausea'), findsOneWidget);
    expect(find.text('Bu gün əhvalı yaxşı deyil — ona xüsusi diqqət göstər 💗'), findsOneWidget);
    expect(find.byType(BirthModeCard), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('birth-mode-hospital-run')));
    expect(env.nav, ['hospital-run']);

    await tester.tap(find.byKey(const ValueKey('partner-send-love')));
    await tester.pump();
    expect(env.sent.single, (kUserId, kPartnerUserId, '❤️'));
    expect(env.haptics.calls, contains('heavy'));
    expect(find.text('💕 Sevgi göndərildi!'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('partner-chip-🤗 Necə hiss edirsən?')));
    await tester.pump();
    expect(env.sent.last.$3, '🤗 Necə hiss edirsən?');

    await tester.enterText(find.byKey(const ValueKey('partner-love-input')), '  Sevirəm ');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('partner-love-send')));
    await tester.pump();
    expect(env.sent.last.$3, 'Sevirəm');
    expect(tester.widget<EditableText>(find.byType(EditableText).first).controller.text, isEmpty);
  });

  screenTest('unread banner opens the chat; the activity feed shows her events', (tester) async {
    final env = _Env(woman: _woman({'last_period_date': '2026-08-01'}), unread: 2, messages: [
      {
        'id': 'm1',
        'message_type': 'kick_session',
        'receiver_id': kUserId,
        'content': '{"title":"Körpə təpik atdı! 👶","body":"Körpə 8 dəfə təpik atdı!"}',
        'created_at': DateTime(2026, 11, 27, 9, 50).toUtc().toIso8601String(),
      },
      {'id': 'm2', 'message_type': 'text', 'receiver_id': kUserId, 'content': 'hi', 'created_at': '2026-11-27T05:00:00Z'},
    ]);
    await _pump(tester, env);
    expect(find.text('Yeni mesajınız var!'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('partner-unread-banner')));
    expect(env.chats, 1);
    expect(find.text('Körpə 8 dəfə təpik atdı!'), findsOneWidget);
    expect(find.text('10 dəq'), findsOneWidget);
    expect(find.text('hi'), findsNothing);
    expect(find.byType(BirthModeCard), findsNothing);
  });

  screenTest('daily missions: a toggle earns points; the list expands', (tester) async {
    final env = _Env(woman: _woman({'last_period_date': '2026-08-01'}));
    await _pump(tester, env);
    expect(find.text('Bu gün necə kömək edim?'), findsOneWidget);
    expect(find.text('0/7 tamamlandı'), findsOneWidget);
    expect(find.text('Səviyyə 1'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('missions-expand')));
    await tester.pump();
    expect(find.text('Yığcam görünüş'), findsOneWidget);
    final first = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('mission-daily-')).first;
    await tester.tap(first);
    await tester.pump();
    await tester.pump();
    expect(env.backend.callsOf('upsert', 'partner_missions'), hasLength(1));
    expect(find.text('1/7 tamamlandı'), findsOneWidget);
    expect(find.textContaining('xal 🎉'), findsOneWidget);
    expect(env.haptics.calls.first, 'light');
  });

  screenTest('first visit: the onboarding tour, stored once closed', (tester) async {
    final env = _Env(woman: _woman({}), tourSeen: false);
    await _pump(tester, env);
    expect(find.byType(PartnerOnboardingTour), findsOneWidget);
    expect(find.textContaining('"Birlikdə"yə xoş gəldiniz!'), findsOneWidget);
    for (var i = 0; i < 5; i++) {
      await tester.tap(find.byKey(const ValueKey('partner-tour-next')));
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(find.text('Başlayaq! 💙'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('partner-tour-next')));
    await tester.pump();
    expect(find.byType(PartnerOnboardingTour), findsNothing);
    expect(env.store.getItem(kPartnerTourKey), isNotNull);
  });

  test('hero stats by stage', () {
    expect(partnerQuickChips('mommy').length, 6);
    expect(partnerQuickChips('bump', lossChips: const ['a']), ['a']);
  });
}
