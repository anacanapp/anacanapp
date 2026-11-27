// Ported from: src/hooks/useStoryInteractions.push.test.tsx ('511 push requires a confirmed database insert'),
//              src/hooks/usePartnerNotifications.ts (sharing gate, message shapes)
import 'dart:convert';

import 'package:anacan/features/partner/data/partner_backend.dart';
import 'package:anacan/features/partner/data/partner_notifications.dart';
import 'package:anacan/features/partner/data/partner_sharing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../support.dart';

const String _row = '44444444-4444-4444-8444-444444444444';

void main() {
  group('remaining push callers use persisted interaction identities', () {
    for (final failure in [false, true]) {
      test('511 push requires a confirmed database insert (failure=$failure)', () async {
        final backend = FakePartnerBackend()
          ..profileUserIds[kLinkedProfileId] = kPartnerUserId
          ..tables['partner_sharing_settings'] = [
            {'user_id': kUserId, 'share_contractions': true},
          ]
          ..returning['partner_messages'] = ((_) => {'id': _row});
        if (failure) backend.errors['insert:partner_messages'] = const PostgrestException(message: 'denied', code: '42501');
        final push = FakePushSender();
        final c = partnerContainer(partnerOverrides(backend: backend, push: push));
        await c.read(partnerNotifierProvider).notifyContraction511();
        if (failure) {
          expect(push.sent, isEmpty);
        } else {
          expect(push.sent.single.data, {'type': 'contraction_511', 'context': 'partner', 'interactionId': _row});
          expect(push.sent.single.userId, kPartnerUserId);
        }
      });
    }
  });

  group('usePartnerNotifications', () {
    test('a category she turned off is not sent', () async {
      final backend = FakePartnerBackend()
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId
        ..tables['partner_sharing_settings'] = [
          {'user_id': kUserId, 'share_kicks': false},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend));
      await c.read(partnerNotifierProvider).notifyKickSession(12, 600);
      expect(backend.callsOf('insertReturning', 'partner_messages'), isEmpty);
      // Mood is still shared (default on).
      await c.read(partnerNotifierProvider).notifyMoodUpdate(2);
      final row = backend.callsOf('insertReturning', 'partner_messages').single.payload! as Map;
      expect(row['message_type'], 'mood_update');
      expect(row['receiver_id'], kPartnerUserId);
      final content = jsonDecode(row['content'] as String) as Map;
      expect(content['title'], 'Əhval yeniləndi 💭');
      expect(content['body'], 'Partnyorunuz bu gün 😔 hiss edir');
      expect(content['data'], {'mood': 2});
    });

    test('the sharing settings are cached for 60 s and invalidated by a change', () async {
      final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      final c = partnerContainer(partnerOverrides(backend: backend));
      await c.read(partnerNotifierProvider).notifyWaterGoal();
      await c.read(partnerNotifierProvider).notifyWaterGoal();
      expect(backend.callsOf('maybeSingle', 'partner_sharing_settings'), hasLength(1));
      c.read(ownSharingCacheProvider).invalidate();
      await c.read(partnerNotifierProvider).notifyWaterGoal();
      expect(backend.callsOf('maybeSingle', 'partner_sharing_settings'), hasLength(2));
      final content = jsonDecode((backend.callsOf('insertReturning', 'partner_messages').last.payload! as Map)['content'] as String) as Map;
      expect(content.containsKey('data'), isFalse);
      expect(content['body'], 'Partnyorunuz gündəlik su hədəfinə çatdı!');
    });

    test('kick and contraction bodies', () {
      expect(partnerNotificationMessage('kick_session', {'kickCount': 7}).body, 'Körpə 7 dəfə təpik atdı!');
      expect(partnerNotificationMessage('kick_session').body, 'Körpə 0 dəfə təpik atdı!');
      expect(partnerNotificationMessage('mood_update').body, 'Partnyorunuz əhvalını qeyd etdi');
      expect(partnerNotificationMessage('contraction_started').title, 'Sancı başladı! ⏱️');
    });

    test('no linked partner: nothing is sent', () async {
      final backend = FakePartnerBackend();
      final c = partnerContainer(partnerOverrides(backend: backend, linked: null));
      await c.read(partnerNotifierProvider).notifyContraction511();
      expect(backend.callsOf('insertReturning'), isEmpty);
    });
  });

  group('usePartnerSharing', () {
    test('pickSettings overlays only boolean columns on the defaults', () {
      final s = pickSharing({'share_weight': true, 'share_mood': 'no', 'share_cycle': false});
      expect(s.shareWeight, isTrue);
      expect(s.shareMood, isTrue);
      expect(s.shareCycle, isFalse);
      expect(pickSharing(null), PartnerSharing.defaults);
    });

    test('mother side: optimistic update, rolled back on failure', () async {
      final backend = FakePartnerBackend()
        ..tables['partner_sharing_settings'] = [
          {'user_id': kUserId, 'share_mood': false},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend));
      final sub = c.listen(partnerSharingProvider, (_, _) {});
      await settle();
      expect(sub.read().settings.shareMood, isFalse);
      expect(await c.read(partnerSharingProvider.notifier).updateSetting('share_mood', true), isTrue);
      expect(sub.read().settings.shareMood, isTrue);
      final row = backend.callsOf('upsert', 'partner_sharing_settings').single.payload! as Map;
      expect(row['user_id'], kUserId);
      expect(row['share_mood'], isTrue);
      backend.errors['upsert:partner_sharing_settings'] = Exception('x');
      expect(await c.read(partnerSharingProvider.notifier).updateSetting('share_water', false), isFalse);
      expect(sub.read().settings.shareWater, isTrue);
    });

    test('partner side: the mother\'s row, refreshed by her realtime changes', () async {
      final backend = FakePartnerBackend()
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId
        ..sharingOfOthers.add({'user_id': kPartnerUserId, 'share_cycle': false});
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerSharedSettingsProvider, (_, _) {});
      await settle();
      expect(sub.read().sharing.shareCycle, isFalse);
      backend.sharingOfOthers[0] = {'user_id': kPartnerUserId, 'share_cycle': true};
      backend.emit('partner_sharing_settings', 'user_id=eq.$kPartnerUserId', const PartnerChange(eventType: 'UPDATE'));
      await settle();
      expect(sub.read().sharing.shareCycle, isTrue);
    });
  });
}
