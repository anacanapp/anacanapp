// Ported from: src/components/partner/v2/{PartnerTogetherScreen,PartnerNotificationsScreen,AlertReceiver,
//              PartnerCareCard,MotherSOSSheet}.tsx, src/components/partner/{SOSButton,LevelUpCelebration}.tsx
//              (behaviour; no vitest file exists)
import 'dart:convert';

import 'package:anacan/core/data/app_settings.dart' show appSettingProvider;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/partner/data/partner_hospital_bag.dart';
import 'package:anacan/features/partner/partner_copy.dart';
import 'package:anacan/features/partner/partner_ports.dart';
import 'package:anacan/features/partner/ui/alert_receiver.dart';
import 'package:anacan/features/partner/ui/level_up_celebration.dart';
import 'package:anacan/features/partner/ui/partner_care_card.dart';
import 'package:anacan/features/partner/ui/partner_notifications_screen.dart';
import 'package:anacan/features/partner/ui/partner_together_screen.dart';
import 'package:anacan/features/partner/ui/sos.dart';
import 'package:anacan/features/tools/shopping/shopping_data.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../support.dart';

class _Shopping extends ShoppingItemsController {
  _Shopping(this.items);
  final List<Map<String, dynamic>> items;
  @override
  ShoppingState build() => ShoppingState(items: items, loading: false);
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Map<String, dynamic> _woman(String stage, [Map<String, dynamic> extra = const {}]) => {
      'id': kLinkedProfileId,
      'user_id': kPartnerUserId,
      'name': 'Leyla',
      'life_stage': stage,
      'last_period_date': stage == 'bump' ? '2026-06-01' : null,
      'baby_birth_date': stage == 'mommy' ? '2026-11-01' : null,
      ...extra,
    };

void main() {
  setUp(() => DomainClock.setSystemTime(DateTime(2026, 11, 27, 10)));
  tearDown(DomainClock.reset);

  group('PartnerTogetherScreen', () {
    Future<List<String>> pumpTogether(WidgetTester tester, String stage, {bool shareAppointments = true, List<String>? nav}) async {
      final backend = FakePartnerBackend()
        ..womanProfiles[kLinkedProfileId] = _woman(stage)
        ..sharingOfOthers.add({'share_appointments': shareAppointments})
        ..tables['partner_surprises'] = [
          {'id': 's', 'user_id': kUserId, 'status': 'planned', 'surprise_points': 10},
          {'id': 't', 'user_id': kUserId, 'status': 'completed', 'surprise_points': 25},
        ];
      final navigated = nav ?? <String>[];
      await pumpApp(
        tester,
        PartnerTogetherScreen(onNavigate: navigated.add),
        size: const Size(390, 1600),
        overrides: partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', extra: [
          partnerHospitalBagProvider.overrideWithValue(
              const PartnerHospitalBag(items: [], hiddenItems: [], loading: false, checkedCount: 3, totalCount: 12, progress: 25)),
          shoppingItemsProvider.overrideWith(() => _Shopping([
                {'id': '1', 'is_checked': false},
                {'id': '2', 'is_checked': true},
              ])),
          appSettingProvider.overrideWith((ref, key) => null),
        ]),
      );
      await _settle(tester);
      return navigated;
    }

    screenTest('pregnancy: prepare / daily / us tiles', (tester) async {
      final nav = await pumpTogether(tester, 'bump');
      for (final id in ['hospital-bag', 'name-voting', 'birth-plan', 'appointments', 'shopping', 'daily-summary', 'weekly-stats', 'surprises']) {
        expect(find.byKey(ValueKey('together-$id')), findsOneWidget, reason: id);
      }
      for (final id in ['postpartum', 'night-shift', 'baby-day', 'parenting']) {
        expect(find.byKey(ValueKey('together-$id')), findsNothing, reason: id);
      }
      expect(find.text('3/12 hazır'), findsOneWidget);
      expect(find.text('1 gözləyən məhsul'), findsOneWidget);
      expect(find.text('1 planlanıb'), findsOneWidget);
      expect(find.text('25 xal'), findsOneWidget);
      expect(find.text('Gözləyir...'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('together-name-voting')));
      expect(nav, ['name-voting']);
    });

    screenTest('baby: postpartum, night shift and baby day; no appointments when not shared', (tester) async {
      await pumpTogether(tester, 'mommy', shareAppointments: false);
      for (final id in ['postpartum', 'night-shift', 'baby-day']) {
        expect(find.byKey(ValueKey('together-$id')), findsOneWidget, reason: id);
      }
      for (final id in ['hospital-bag', 'name-voting', 'birth-plan', 'appointments']) {
        expect(find.byKey(ValueKey('together-$id')), findsNothing, reason: id);
      }
    });
  });

  group('PartnerNotificationsScreen', () {
    screenTest('loads the choices, saves a switch and rolls back on failure', (tester) async {
      final backend = FakePartnerBackend()
        ..tables['user_preferences'] = [
          {'user_id': kUserId, 'push_partner_thanks': false},
        ];
      var back = 0;
      await pumpApp(tester, PartnerNotificationsScreen(onBack: () => back++), overrides: partnerOverrides(backend: backend), scroll: false);
      await _settle(tester);
      expect(find.text(feature37Text('pn_title')), findsOneWidget);
      expect(find.text(feature37Text('pn_sos')), findsOneWidget);

      await tester.tap(find.descendant(of: find.byKey(const ValueKey('pn-push_partner_thanks')), matching: find.byType(GestureDetector)).last);
      await tester.pump();
      final row = backend.callsOf('upsert', 'user_preferences').single.payload! as Map;
      expect(row, {'user_id': kUserId, 'push_partner_thanks': true});

      backend.errors['upsert:user_preferences'] = Exception('offline');
      await tester.tap(find.descendant(of: find.byKey(const ValueKey('pn-push_messages')), matching: find.byType(GestureDetector)).last);
      await tester.pump();
      await tester.pump();
      expect(find.text('Yadda saxlanılmadı'), findsOneWidget);

      // The toast covers the top bar until it is gone.
      await tester.pump(const Duration(seconds: 6));
      await tester.tap(find.bySemanticsLabel('Geri'));
      expect(back, 1);
    });
  });

  group('AlertReceiver', () {
    screenTest('a birth alert for the partner: hospital mode, on my way, seen', (tester) async {
      final backend = FakePartnerBackend()
        ..sos.add({
          'id': 'a1',
          'sender_id': kPartnerUserId,
          'receiver_id': kUserId,
          'alert_type': 'birth',
          'message': 'Doğuş başladı!',
          'latitude': 40.4,
          'longitude': 49.8,
          'is_acknowledged': false,
          'created_at': '2026-11-27T06:00:00Z',
        });
      final opened = <Uri>[];
      var runs = 0;
      await pumpApp(
        tester,
        AlertReceiverHost(isPartner: (_) => true, onHospitalRun: (_) => runs++),
        overrides: partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', extra: [
          alertMapsOpenerProvider.overrideWithValue((u) async => opened.add(u)),
        ]),
      );
      await _settle(tester);
      expect(find.text('DOĞUŞ BAŞLADI!'), findsOneWidget);
      expect(find.text('Doğuş başladı!'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('alert-maps')));
      expect(opened.single.toString(), 'https://maps.google.com/?q=40.4,49.8');

      await tester.tap(find.byKey(const ValueKey('alert-on-my-way')));
      await tester.pump();
      final msg = backend.callsOf('insert', 'partner_messages').single.payload! as Map;
      expect(msg['receiver_id'], kPartnerUserId);
      expect(msg['content'], 'Yoldayam! 🚗 Tezliklə çatıram!');

      await tester.tap(find.byKey(const ValueKey('alert-hospital-run')));
      await _settle(tester);
      expect(runs, 1);
      expect(backend.callsOf('update', 'sos_alerts'), hasLength(1));
      expect(find.text('DOĞUŞ BAŞLADI!'), findsNothing);
    });

    screenTest('an SOS for the mother: no partner buttons; not shown without a link', (tester) async {
      final backend = FakePartnerBackend()
        ..sos.add({'id': 'a2', 'sender_id': kPartnerUserId, 'receiver_id': kUserId, 'alert_type': 'emergency', 'message': 'Help', 'is_acknowledged': false});
      await pumpApp(tester, AlertReceiverHost(isPartner: (_) => false, onHospitalRun: (_) {}), overrides: partnerOverrides(backend: backend));
      await _settle(tester);
      expect(find.text('TƏCİLİ XƏBƏRDARLIQ!'), findsOneWidget);
      expect(find.byKey(const ValueKey('alert-on-my-way')), findsNothing);
      expect(find.byKey(const ValueKey('alert-maps')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('alert-ack')));
      await _settle(tester);
      expect(find.text('TƏCİLİ XƏBƏRDARLIQ!'), findsNothing);
    });
  });

  group('PartnerCareCard', () {
    screenTest('thank you falls back to a text message on a schema constraint; the summary is sent once', (tester) async {
      final backend = FakePartnerBackend()
        ..womanProfiles[kLinkedProfileId] = {'id': kLinkedProfileId, 'user_id': kPartnerUserId, 'name': 'Elvin', 'life_stage': 'partner'}
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      final push = FakePushSender();
      var attempts = 0;
      backend.returning['partner_messages'] = (row) {
        attempts++;
        if (row['message_type'] == 'thank_you') throw const PostgrestException(message: 'check', code: '23514');
        return {'id': 'm1'};
      };
      final messages = [
        {'message_type': 'love', 'receiver_id': kUserId, 'created_at': DateTime(2026, 11, 27, 8).toUtc().toIso8601String()},
        {'message_type': 'text', 'receiver_id': kUserId, 'created_at': DateTime(2026, 11, 27, 9).toUtc().toIso8601String()},
        {'message_type': 'text', 'receiver_id': kUserId, 'created_at': DateTime(2026, 11, 26, 9).toUtc().toIso8601String()},
      ];
      final sharing = <String>[];
      await pumpApp(
        tester,
        // Below the toast viewport at the top.
        Padding(padding: const EdgeInsets.only(top: 300), child: PartnerCareCard(lifeStage: 'bump', onOpenSharing: () => sharing.add('open'))),
        overrides: partnerOverrides(backend: backend, push: push, feed: PartnerMessagesFeed(messages: messages)),
      );
      await _settle(tester);
      expect(find.text('Elvin'), findsOneWidget);
      expect(find.text('Bu gün: 1 ❤️ · 1 mesaj'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('care-card-thanks')));
      await _settle(tester);
      expect(attempts, 2);
      final fallback = backend.callsOf('insertReturning', 'partner_messages').last.payload! as Map;
      expect(fallback['message_type'], 'text');
      expect(push.sent.single.data, {'type': 'thank_you', 'context': 'partner', 'interactionId': 'm1', 'messageId': 'm1'});
      expect(find.text('Təşəkkür göndərildi! 💙'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('care-card-summary')));
      await _settle(tester);
      final summary = backend.callsOf('upsertReturning', 'daily_summaries').single.payload! as Map;
      expect(summary['is_sent'], isTrue);
      expect(find.text('Bugünkü xülasə göndərildi! 📊'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('care-card-sharing')));
      expect(sharing, ['open']);
      // Content of the thank-you payload (title/body kept for the push).
      expect(jsonEncode(push.sent.single.title), contains('Təşəkkür'));
    });

    screenTest('SOS sheet: hold 1.5 s on the birth button sends a birth alert', (tester) async {
      final backend = FakePartnerBackend()
        ..womanProfiles[kLinkedProfileId] = {'id': kLinkedProfileId, 'user_id': kPartnerUserId, 'name': 'Elvin'}
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      await pumpApp(tester, const PartnerCareCard(lifeStage: 'bump'), overrides: partnerOverrides(backend: backend, push: FakePushSender()));
      await _settle(tester);
      await tester.tap(find.byKey(const ValueKey('care-card-sos')));
      await _settle(tester);
      expect(find.text('Partnyoru çağır'), findsOneWidget);
      expect(find.text('Doğuş başladı! 👶'), findsOneWidget);

      // A short press does nothing.
      final short = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('mother-sos-birth'))));
      await tester.pump(const Duration(milliseconds: 600));
      await short.up();
      await tester.pump(const Duration(seconds: 2));
      expect(backend.callsOf('insertReturning', 'sos_alerts'), isEmpty);

      final hold = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('mother-sos-birth'))));
      for (var i = 0; i < 35; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      await hold.up();
      await _settle(tester);
      final alert = backend.callsOf('insertReturning', 'sos_alerts').single.payload! as Map;
      expect(alert['alert_type'], 'birth');
      expect(find.text('Doğuş siqnalı göndərildi!'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('mother-sos-close')));
      await _settle(tester);
      expect(find.text('Partnyoru çağır'), findsNothing);
    });

    screenTest('not shown without her / his profile', (tester) async {
      await pumpApp(tester, const PartnerCareCard(lifeStage: 'mommy'), overrides: partnerOverrides(backend: FakePartnerBackend(), linked: null));
      await _settle(tester);
      expect(find.byKey(const ValueKey('care-card-thanks')), findsNothing);
    });
  });

  group('SOSButton', () {
    screenTest('compact: a 2 s hold sends once; nothing without a partner', (tester) async {
      final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      await pumpApp(tester, const Center(child: SosButton(variant: SosButtonVariant.compact)), overrides: partnerOverrides(backend: backend, push: FakePushSender()));
      await _settle(tester);
      final g = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('sos-button-compact'))));
      await tester.pump(const Duration(milliseconds: 1900));
      expect(backend.callsOf('insertReturning', 'sos_alerts'), isEmpty);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(seconds: 3));
      await g.up();
      await _settle(tester);
      expect(backend.callsOf('insertReturning', 'sos_alerts'), hasLength(1));
    });

    screenTest('hidden without a linked partner', (tester) async {
      await pumpApp(tester, const SosButton(), overrides: partnerOverrides(backend: FakePartnerBackend(), linked: null));
      await _settle(tester);
      expect(find.byKey(const ValueKey('sos-button-full')), findsNothing);
    });
  });

  group('LevelUpCelebration', () {
    screenTest('shows the level and closes itself after 4 s', (tester) async {
      var closed = 0;
      await pumpApp(tester, LevelUpCelebration(show: true, level: 3, onClose: () => closed++), overrides: partnerOverrides(backend: FakePartnerBackend()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('3'), findsOneWidget);
      expect(find.text('Təbrik Edirik! 🎉'), findsOneWidget);
      await tester.pump(const Duration(seconds: 4));
      await tester.pump(const Duration(milliseconds: 400));
      expect(closed, 1);
      expect(find.byKey(const ValueKey('level-up-dialog')), findsNothing);
    });
  });
}
