// Ported from: src/hooks/usePartnerNotifications.ts
//
// The mother's live events for her partner (mood, contractions, 5-1-1, kicks, water goal) as `partner_messages`
// rows, each gated by the matching sharing choice. The 5-1-1 alert also goes out as an FCM push.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../chat/data/chat_push.dart' show ChatPushSender, SendPushPayload, chatPushSenderProvider;
import '../../tools/pregnancy_common/pregnancy_ports.dart' show PregnancyPartnerNotifications;
import 'partner_backend.dart';
import 'partner_sharing.dart';

/// 'mood_update' | 'contraction_started' | 'contraction_511' | 'kick_session' | 'water_goal'.
typedef PartnerNotificationType = String;

/// Which sharing key each event type depends on (`SHARING_GATE`).
const Map<PartnerNotificationType, String> kSharingGate = {
  'mood_update': 'share_mood',
  'contraction_started': 'share_contractions',
  'contraction_511': 'share_contractions',
  'kick_session': 'share_kicks',
  'water_goal': 'share_water',
};

const List<String> _moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];

/// `getNotificationMessages()[type]`: title and body, evaluated at send time (the current language).
({String title, String body}) partnerNotificationMessage(PartnerNotificationType type, [Map<String, Object?>? data]) {
  switch (type) {
    case 'mood_update':
      final mood = data?['mood'];
      final m = mood is num ? mood.toInt() : 0;
      return (
        title: tr('usepartnernotifications_ehval_yenilendi_967cd7', 'Əhval yeniləndi 💭'),
        body: m != 0
            ? tr('usepartnernotifications_partnyor_mood', 'Partnyorunuz bu gün {mood} hiss edir')
                .replaceFirst('{mood}', m >= 1 && m <= 5 ? _moodEmojis[m - 1] : 'undefined')
            : tr('usepartnernotifications_partnyorunuz_ehvalini_qeyd_etd_612302', 'Partnyorunuz əhvalını qeyd etdi'),
      );
    case 'contraction_started':
      return (
        title: tr('usepartnernotifications_sanci_basladi_c51f20', 'Sancı başladı! ⏱️'),
        body: tr('usepartnernotifications_partnyorunuz_sanci_qeyd_etdi_o_369f2f', 'Partnyorunuz sancı qeyd etdi. Ona dəstək olmaq vaxtıdır!'),
      );
    case 'contraction_511':
      return (
        title: tr('usepartnernotifications_5_1_1_qaydasi_976061', '⚠️ 5-1-1 Qaydası!'),
        body: tr('usepartnernotifications_sancilar_5_deq_araliginda_ve_1_da0619',
            'Sancılar 5 dəqiqədən bir gəlir, hər biri 1 dəqiqə çəkir və bu 1 saatdır davam edir. Xəstəxanaya getmə vaxtı ola bilər!'),
      );
    case 'kick_session':
      final count = data?['kickCount'];
      final n = count is num && count != 0 ? count : 0;
      return (
        title: tr('usepartnernotifications_korpe_tepik_atdi_628b12', 'Körpə təpik atdı! 👶'),
        body: tr('usepartnernotifications_baby_kicked', 'Körpə {count} dəfə təpik atdı!').replaceFirst('{count}', '$n'),
      );
    default: // water_goal
      return (
        title: tr('usepartnernotifications_su_hedefine_catdi_55f2fb', 'Su hədəfinə çatdı! 💧'),
        body: tr('usepartnernotifications_partnyorunuz_gundelik_su_hedef_f06510', 'Partnyorunuz gündəlik su hədəfinə çatdı!'),
      );
  }
}

/// `usePartnerNotifications()`.
class PartnerNotifier implements PregnancyPartnerNotifications {
  PartnerNotifier({
    required this.userId,
    required this.linkedPartnerId,
    required this.backend,
    required this.sharing,
    required this.push,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final String? Function() userId;
  final String? Function() linkedPartnerId;
  final PartnerBackend Function() backend;
  final OwnSharingCache sharing;
  final ChatPushSender Function() push;
  final DateTime Function() _now;

  /// `getPartnerUserId()`: the linked profile's user_id.
  Future<String?> _partnerUserId() async {
    final linked = linkedPartnerId();
    if (linked == null || linked.isEmpty) return null;
    return backend().profileUserId(linked);
  }

  /// `notifyPartner(type, data)`.
  Future<void> notifyPartner(PartnerNotificationType type, [Map<String, Object?>? data]) async {
    final uid = userId();
    if (uid == null) return;
    // Sharing permission: the mother turned this category off → nothing goes to the partner.
    final settings = await sharing.get(uid);
    if (!settings[kSharingGate[type]!]) return;
    final partnerUserId = await _partnerUserId();
    if (partnerUserId == null) return;
    final n = partnerNotificationMessage(type, data);
    final content = jsonEncode({
      'type': type,
      'title': n.title,
      'body': n.body,
      'data': ?data,
      'timestamp': _now().toUtc().toIso8601String(),
    });
    try {
      final message = await backend().insertReturning(
          'partner_messages', {'sender_id': uid, 'receiver_id': partnerUserId, 'message_type': type, 'content': content},
          columns: 'id');
      // Critical event (5-1-1): delivered even when the app is closed (FCM push).
      final id = message['id'];
      if (type == 'contraction_511' && id != null) {
        try {
          await push().send(SendPushPayload(
            userId: partnerUserId,
            title: n.title,
            body: n.body,
            data: {'type': type, 'context': 'partner', 'interactionId': id},
          ));
        } catch (error) {
          debugPrint('511 push failed: $error');
        }
      }
    } catch (error) {
      debugPrint('Error sending partner notification: $error');
    }
  }

  Future<void> notifyMoodUpdate(int mood) => notifyPartner('mood_update', {'mood': mood});

  @override
  Future<void> notifyContractionStarted(int durationSeconds, num? intervalSeconds) =>
      notifyPartner('contraction_started', {'durationSeconds': durationSeconds, 'intervalSeconds': ?intervalSeconds});

  @override
  Future<void> notifyContraction511() => notifyPartner('contraction_511');

  @override
  Future<void> notifyKickSession(int kickCount, int durationSeconds) =>
      notifyPartner('kick_session', {'kickCount': kickCount, 'durationSeconds': durationSeconds});

  Future<void> notifyWaterGoal() => notifyPartner('water_goal');
}

final partnerNotifierProvider = Provider<PartnerNotifier>((ref) => PartnerNotifier(
      userId: () => ref.read(authUserProvider)?.id,
      linkedPartnerId: () => ref.read(authProfileProvider)?.linkedPartnerId,
      backend: () => ref.read(partnerBackendProvider),
      sharing: ref.watch(ownSharingCacheProvider),
      push: () => ref.read(chatPushSenderProvider),
    ));
