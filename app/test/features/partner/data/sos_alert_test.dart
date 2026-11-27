// Ported from: src/hooks/useSOSAlert.push.test.tsx (+ the rest of useSOSAlert: pending alert, acknowledge, haptics)
import 'dart:convert';

import 'package:anacan/features/partner/data/partner_backend.dart';
import 'package:anacan/features/partner/data/sos_alert.dart';
import 'package:anacan/features/partner/partner_ports.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

const String _senderId = kUserId;
const String _receiverId = kPartnerUserId;
const String _alertId = '44444444-4444-4444-8444-444444444444';

void main() {
  setUp(resetSosHapticClaims);

  test('uses the persisted SOS row for both the alert and interaction identifiers', () async {
    final inserted = {
      'id': _alertId,
      'sender_id': _senderId,
      'receiver_id': _receiverId,
      'alert_type': 'emergency',
      'message': 'Help',
      'latitude': null,
      'longitude': null,
      'location_name': null,
      'is_acknowledged': false,
      'acknowledged_at': null,
      'created_at': '2026-09-11T12:00:00Z',
    };
    final backend = FakePartnerBackend()
      ..profileUserIds[kLinkedProfileId] = _receiverId
      ..returning['sos_alerts'] = ((_) => inserted);
    final push = FakePushSender();
    final c = partnerContainer(partnerOverrides(backend: backend, push: push));
    c.listen(sosAlertProvider, (_, _) {});
    await settle();
    expect(backend.callsOf('sosAlerts'), hasLength(1));

    await c.read(sosAlertProvider.notifier).sendSOS('Help', false, 'emergency');

    expect(push.sent, hasLength(1));
    expect(push.sent.single.userId, _receiverId);
    expect(push.sent.single.data, {'type': 'sos_alert', 'context': 'partner', 'alertId': _alertId, 'interactionId': _alertId});
  });

  test('a birth alert uses the birth texts, the partner message and the default message', () async {
    final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = _receiverId;
    final push = FakePushSender();
    final haptics = FakeHaptics();
    final c = partnerContainer(partnerOverrides(backend: backend, push: push, haptics: haptics));
    c.listen(sosAlertProvider, (_, _) {});
    await settle();
    final r = await c.read(sosAlertProvider.notifier).sendSOS(null, true, 'birth');
    expect(r.error, isNull);
    expect(haptics.calls, ['heavy']);
    final alert = backend.callsOf('insertReturning', 'sos_alerts').single.payload! as Map;
    expect(alert['alert_type'], 'birth');
    expect(alert['message'], 'Doğuş başladı! Xəstəxanaya getmə vaxtıdır!');
    // The user's own "Location sharing" is off: no coordinates.
    expect(alert['latitude'], isNull);
    final msg = backend.callsOf('insert', 'partner_messages').single.payload! as Map;
    expect(msg['message_type'], 'birth_alert');
    final content = jsonDecode(msg['content'] as String) as Map;
    expect(content['title'], '👶 DOĞUŞ SİQNALI!');
    expect(content['body'], 'Sancılar başladı — dərhal əlaqə saxla!');
    expect(push.sent.single.data['type'], 'birth_alert');
  });

  test('location is read only when the privacy switch allows it', () async {
    final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = _receiverId;
    var asked = 0;
    final c = partnerContainer(partnerOverrides(backend: backend, locationSharing: true, extra: [
      sosLocationProvider.overrideWithValue(() async {
        asked++;
        return const SosLocation(latitude: 40.4, longitude: 49.8);
      }),
    ]));
    c.listen(sosAlertProvider, (_, _) {});
    await settle();
    await c.read(sosAlertProvider.notifier).sendSOS();
    expect(asked, 1);
    final alert = backend.callsOf('insertReturning', 'sos_alerts').single.payload! as Map;
    expect(alert['latitude'], 40.4);
    expect(alert['longitude'], 49.8);
    expect(alert['message'], 'TƏCİLİ! Mənə kömək lazımdır!');
  });

  test('no partner linked: nothing is sent', () async {
    final backend = FakePartnerBackend();
    final push = FakePushSender();
    final c = partnerContainer(partnerOverrides(backend: backend, push: push));
    c.listen(sosAlertProvider, (_, _) {});
    await settle();
    final r = await c.read(sosAlertProvider.notifier).sendSOS();
    expect(r.error, 'No partner linked');
    expect(backend.callsOf('insertReturning'), isEmpty);
    expect(push.sent, isEmpty);
  });

  test('the unacknowledged alert for me is pending until acknowledged; a new one buzzes once', () async {
    final backend = FakePartnerBackend()
      ..sos.addAll([
        {'id': 'mine', 'sender_id': kUserId, 'receiver_id': kPartnerUserId, 'alert_type': 'emergency', 'is_acknowledged': false},
        {'id': 'a1', 'sender_id': kPartnerUserId, 'receiver_id': kUserId, 'alert_type': 'birth', 'message': 'Go', 'is_acknowledged': false},
      ]);
    final haptics = FakeHaptics();
    final c = partnerContainer(partnerOverrides(backend: backend, haptics: haptics));
    final sub = c.listen(sosAlertProvider, (_, _) {});
    await settle();
    expect(sub.read().pendingAlert?.id, 'a1');
    expect(sub.read().alerts, hasLength(2));

    const change = PartnerChange(eventType: 'INSERT', newRecord: {'id': 'a1', 'receiver_id': kUserId});
    backend.emit('sos_alerts', 'receiver_id=eq.$kUserId', change);
    backend.emit('sos_alerts', 'receiver_id=eq.$kUserId', change);
    await settle();
    expect(haptics.calls, ['heavy', 'heavy', 'heavy']);

    await c.read(sosAlertProvider.notifier).acknowledgeAlert('a1');
    final ack = backend.callsOf('update', 'sos_alerts').single.payload! as Map;
    expect(ack['is_acknowledged'], isTrue);
    expect(ack['match'], {'id': 'a1', 'receiver_id': kUserId});
    expect(sub.read().pendingAlert, isNull);
  });

  test('claimSosHaptic keeps at most 200 ids', () {
    for (var i = 0; i < 201; i++) {
      expect(claimSosHaptic('id-$i'), isTrue);
    }
    expect(claimSosHaptic('id-0'), isTrue); // evicted
    expect(claimSosHaptic('id-200'), isFalse);
    expect(claimSosHaptic(null), isTrue);
  });
}
