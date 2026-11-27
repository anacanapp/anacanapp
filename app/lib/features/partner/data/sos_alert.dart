// Ported from: src/hooks/useSOSAlert.ts
//
// SOS / birth alerts between the linked couple: send (row + partner message + FCM push), the newest 20 alerts of
// the user, the unacknowledged one addressed to them, acknowledging it, and live updates (a received alert buzzes
// once, however many readers are mounted).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../chat/data/chat_push.dart' show SendPushPayload, chatPushSenderProvider;
import '../../settings/data/preferences.dart' show privacyPreferencesQuery;
import '../partner_ports.dart';
import 'partner_backend.dart';

/// `SOSAlert` row.
@immutable
class SosAlert {
  SosAlert(Map<String, dynamic> row) : row = Map.unmodifiable(row);
  final Map<String, dynamic> row;

  String get id => '${row['id'] ?? ''}';
  String get senderId => '${row['sender_id'] ?? ''}';
  String get receiverId => '${row['receiver_id'] ?? ''}';

  /// 'emergency' | 'birth'.
  String get alertType => '${row['alert_type'] ?? ''}';
  String? get message => row['message'] is String ? row['message'] as String : null;
  double? get latitude => row['latitude'] is num ? (row['latitude'] as num).toDouble() : null;
  double? get longitude => row['longitude'] is num ? (row['longitude'] as num).toDouble() : null;
  String? get locationName => row['location_name'] is String ? row['location_name'] as String : null;
  bool get isAcknowledged => row['is_acknowledged'] == true;
  String get createdAt => '${row['created_at'] ?? ''}';
}

/// Module-level dedupe so one SOS alert vibrates once across all mounted readers.
final Set<String> _buzzedSosAlertIds = <String>{};

/// `claimSosHaptic(alertId)`: true the first time an id is seen (and for a missing id); keeps ≤ 200 ids.
bool claimSosHaptic(String? alertId) {
  if (alertId == null || alertId.isEmpty) return true;
  if (_buzzedSosAlertIds.contains(alertId)) return false;
  _buzzedSosAlertIds.add(alertId);
  if (_buzzedSosAlertIds.length > 200) _buzzedSosAlertIds.remove(_buzzedSosAlertIds.first);
  return true;
}

@visibleForTesting
void resetSosHapticClaims() => _buzzedSosAlertIds.clear();

/// The user's own "Location sharing" privacy switch (PartnerPrivacyScreen); GPS is never read when it is off.
/// Default: `usePrivacyPreferences().prefs.privacy_location_sharing` (true until loaded, like the hook defaults).
final sosLocationSharingProvider = Provider<bool>((ref) => ref.watch(privacyPreferencesQuery).data?['privacy_location_sharing'] ?? true);

@immutable
class SosAlertState {
  const SosAlertState({this.alerts = const [], this.pendingAlert, this.loading = false});
  final List<SosAlert> alerts;
  final SosAlert? pendingAlert;
  final bool loading;

  SosAlertState copyWith({List<SosAlert>? alerts, Object? pendingAlert = _keep, bool? loading}) => SosAlertState(
        alerts: alerts ?? this.alerts,
        pendingAlert: identical(pendingAlert, _keep) ? this.pendingAlert : pendingAlert as SosAlert?,
        loading: loading ?? this.loading,
      );
}

const Object _keep = Object();

/// `useSOSAlert()` (`hasPartner` = [sosHasPartnerProvider]).
final sosAlertProvider = NotifierProvider.autoDispose<SosAlertController, SosAlertState>(SosAlertController.new);

/// `hasPartner: !!profile?.linked_partner_id`.
final sosHasPartnerProvider = Provider.autoDispose<bool>((ref) {
  final linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
  return linked != null && linked.isNotEmpty;
});

class SosAlertController extends Notifier<SosAlertState> {
  String? _userId;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  SosAlertState build() {
    final userId = _userId = ref.watch(authUserProvider)?.id;
    // Keep the privacy choice loaded while alerts can be sent.
    ref.listen(sosLocationSharingProvider, (_, _) {});
    if (userId != null) {
      scheduleMicrotask(() {
        if (ref.mounted) unawaited(fetchAlerts());
      });
      // Rows where I am the sender OR the receiver (two filtered handlers, not every SOS of the app).
      _backend.subscribe(ref,
          channelPrefix: 'sos_alerts_changes', table: 'sos_alerts', filter: 'sender_id=eq.$userId', onChange: (_) => unawaited(fetchAlerts()));
      _backend.subscribe(ref, channelPrefix: 'sos_alerts_changes', table: 'sos_alerts', filter: 'receiver_id=eq.$userId', onChange: (change) async {
        // A new alert for me → haptics (several readers may be mounted; buzz once per alert).
        final alertId = change.newRecord['id'] as String?;
        if (change.eventType == 'INSERT' && change.newRecord['receiver_id'] == userId && claimSosHaptic(alertId)) {
          final heavy = ref.read(partnerHapticsProvider).heavy;
          await quietly(() async {
            await heavy();
            await heavy();
            await heavy();
          });
        }
        if (ref.mounted) unawaited(fetchAlerts());
      });
    }
    return const SosAlertState();
  }

  /// `getPartnerUserId()`.
  Future<String?> _partnerUserId() async {
    final linked = ref.read(authProfileProvider)?.linkedPartnerId;
    if (linked == null || linked.isEmpty) return null;
    return _backend.profileUserId(linked);
  }

  /// `fetchAlerts()` (`refetch`).
  Future<void> fetchAlerts() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final rows = await _backend.sosAlerts(userId);
      if (!ref.mounted) return;
      final alerts = [for (final r in rows) SosAlert(r)];
      // The unacknowledged alert where I am the receiver.
      final pending = alerts.where((a) => a.receiverId == userId && !a.isAcknowledged).firstOrNull;
      state = state.copyWith(alerts: alerts, pendingAlert: pending);
    } catch (error) {
      debugPrint('Error fetching SOS alerts: $error');
    }
  }

  /// `sendSOS(message, includeLocation, alertType)` → `{data, error}` (error null = sent).
  Future<({Map<String, dynamic>? data, Object? error})> sendSOS([String? message, bool includeLocation = true, String alertType = 'emergency']) async {
    final userId = _userId;
    if (userId == null) return (data: null, error: 'No user logged in');
    state = state.copyWith(loading: true);
    try {
      await quietly(ref.read(partnerHapticsProvider).heavy);
      final partnerUserId = await _partnerUserId();
      if (partnerUserId == null) return (data: null, error: 'No partner linked');

      // Even when the caller asks for the location, the user's own "Location sharing" switch wins: no GPS fix, the
      // alert still goes out without coordinates.
      SosLocation? location;
      if (includeLocation && ref.read(sosLocationSharingProvider)) {
        try {
          location = await ref.read(sosLocationProvider)();
        } catch (error) {
          debugPrint('Error getting location: $error');
          location = null;
        }
      }

      final isBirth = alertType == 'birth';
      final defaultMessage = isBirth
          ? tr('usesosalert_dogus_basladi_msg', 'Doğuş başladı! Xəstəxanaya getmə vaxtıdır!')
          : tr('usesosalert_teci_li_mene_komek_lazimdir_032838', 'TƏCİLİ! Mənə kömək lazımdır!');
      final data = await _backend.insertReturning('sos_alerts', {
        'sender_id': userId,
        'receiver_id': partnerUserId,
        'alert_type': alertType,
        'message': message == null || message.isEmpty ? defaultMessage : message,
        'latitude': _nonZero(location?.latitude),
        'longitude': _nonZero(location?.longitude),
        'location_name': (location?.locationName?.isNotEmpty ?? false) ? location?.locationName : null,
      });

      final pushTitle = isBirth ? tr('usesosalert_dogus_siqnali_title', '👶 DOĞUŞ SİQNALI!') : tr('usesosalert_tecili_xeberdarliq_5bfb41', '🆘 TƏCİLİ XƏBƏRDARLIQ!');
      final pushBody = message != null && message.isNotEmpty
          ? message
          : isBirth
              ? tr('usesosalert_dogus_basladi_push_body', 'Sancılar başladı — dərhal əlaqə saxla!')
              : tr('usesosalert_partnyorunuz_tecili_komek_iste_b7a70c', 'Partnyorunuz təcili kömək istəyir!');
      final type = isBirth ? 'birth_alert' : 'sos_alert';

      // A partner message too, for the in-app notification.
      try {
        await _backend.insert('partner_messages', {
          'sender_id': userId,
          'receiver_id': partnerUserId,
          'message_type': type,
          'content': jsonEncode({
            'type': type,
            'title': pushTitle,
            'body': pushBody,
            'alertId': data['id'],
            'latitude': ?location?.latitude,
            'longitude': ?location?.longitude,
            'timestamp': DateTime.now().toUtc().toIso8601String(),
          }),
        });
      } catch (error) {
        debugPrint('partner_messages insert failed (sos): $error');
      }

      // Critical event: delivered even when the app is closed (FCM push).
      try {
        await ref.read(chatPushSenderProvider).send(SendPushPayload(
              userId: '${data['receiver_id']}',
              title: pushTitle,
              body: pushBody,
              data: {'type': type, 'context': 'partner', 'alertId': data['id'], 'interactionId': data['id']},
            ));
      } catch (error) {
        debugPrint('SOS push failed: $error');
      }

      await fetchAlerts();
      return (data: data, error: null);
    } catch (error) {
      debugPrint('Error sending SOS: $error');
      return (data: null, error: error);
    } finally {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  /// `acknowledgeAlert(alertId)`.
  Future<void> acknowledgeAlert(String alertId) async {
    final userId = _userId;
    if (userId == null) return;
    try {
      await _backend.update('sos_alerts', {'is_acknowledged': true, 'acknowledged_at': DateTime.now().toUtc().toIso8601String()},
          {'id': alertId, 'receiver_id': userId});
      if (ref.mounted) state = state.copyWith(pendingAlert: null);
      await fetchAlerts();
    } catch (error) {
      debugPrint('Error acknowledging alert: $error');
    }
  }
}

/// `location?.latitude || null` (0 is falsy in JS).
double? _nonZero(double? v) => v == null || v == 0 ? null : v;
