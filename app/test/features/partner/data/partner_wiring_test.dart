// Ported from: src/components/partner/PartnerAIPremiumGate.tsx (partnerContext source), src/components/
//              PartnerProfileScreen.tsx (data), src/components/flow/PartnerFlowStatusCard.tsx (data) — the values the
//              partner feature gives other features' seams.
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/ai_chat/ai_chat_inputs.dart';
import 'package:anacan/features/home/data/daily_logs.dart' show homeWaterGoalNotifierProvider;
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/partner/partner_wiring.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ports.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

void main() {
  tearDown(DomainClock.reset);

  test('AI, flow card and profile read the woman through usePartnerData', () async {
    DomainClock.setSystemTime(DateTime(2026, 9, 10, 10));
    final backend = FakePartnerBackend()
      ..womanProfiles[kLinkedProfileId] = {
        'id': kLinkedProfileId,
        'user_id': kPartnerUserId,
        'name': 'Leyla',
        'life_stage': 'flow',
        'last_period_date': '2026-09-01',
        'cycle_length': 30,
      }
      ..sharingOfOthers.add({'share_cycle': false})
      ..tables['partner_missions'] = [
        {'user_id': kUserId, 'mission_id': 'x', 'is_completed': true, 'points_earned': 70},
      ];
    final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', extra: partnerWiringOverrides()));
    c.listen(aiPartnerSourceProvider, (_, _) {});
    c.listen(partnerFlowSnapshotProvider, (_, _) {});
    c.listen(partnerProfileDataProvider, (_, _) {});
    await settle();
    final ai = c.read(aiPartnerSourceProvider);
    expect((ai.lifeStage, ai.name, ai.cycleLength, ai.shareCycle), ('flow', 'Leyla', 30, false));
    // Cycle dates need share_cycle.
    expect(partnerContextFrom(ai).lastPeriodDate, isNull);
    final flow = c.read(partnerFlowSnapshotProvider);
    expect(flow?.name, 'Leyla');
    expect(flow?.phaseInfo, isNull);
    final profile = c.read(partnerProfileDataProvider);
    expect(profile.partnerName, 'Leyla');
    expect(profile.level, 2);
    expect(profile.pointsToNextLevel, 30);
  });

  test('the tools\' partner events go through usePartnerNotifications', () async {
    final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
    final c = partnerContainer(partnerOverrides(backend: backend, extra: partnerWiringOverrides()));
    await c.read(pregnancyPartnerNotificationsProvider).notifyKickSession(5, 120);
    c.read(homeWaterGoalNotifierProvider)();
    await settle();
    final types = backend.callsOf('insertReturning', 'partner_messages').map((c) => (c.payload! as Map)['message_type']).toList();
    expect(types, ['kick_session', 'water_goal']);
    expect(c.read(sosAlertPortProvider).hasPartner, isTrue);
  });
}
