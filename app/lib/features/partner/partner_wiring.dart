// Ported from: the partner hooks' call sites in other features — src/hooks/{useDailyLogs,useKickSessions,
//              useContractions}.ts (usePartnerNotifications), src/components/tools/DangerSignsScreen.tsx (useSOSAlert),
//              src/components/partner/PartnerAIPremiumGate.tsx (usePartnerData → partner context),
//              src/components/flow/PartnerFlowStatusCard.tsx, src/components/PartnerProfileScreen.tsx (usePartnerData,
//              usePartnerStats, usePartnerMissions, useSurprises, usePartnerAchievements, usePartnerMenuItems),
//              src/components/Dashboard.tsx (PartnerCareCard, DailySummaryAutoSync)
//
// The values the partner feature gives the seams other features declared (docs/flutter/WIRING.md, phase 6).
// `app/lib/app/app_wiring.dart` adds `...partnerWiringOverrides()` and the two [HomeSlots] builders below.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../ai_chat/ai_chat_inputs.dart' show AiPartnerSource, aiPartnerSourceProvider;
import '../home/data/daily_logs.dart' show homeWaterGoalNotifierProvider;
import '../home_flow/flow_platform.dart' show PartnerFlowSnapshot, partnerFlowSnapshotProvider;
import '../profile/profile_interfaces.dart' show PartnerProfileData, partnerProfileDataProvider;
import '../tools/health_common/health_common.dart' show healthMoodPartnerNotifierProvider;
import '../tools/pregnancy_common/pregnancy_ports.dart' show SosAlertPort, pregnancyPartnerNotificationsProvider, sosAlertPortProvider;
import 'data/partner_data.dart';
import 'data/partner_missions.dart';
import 'data/partner_notifications.dart';
import 'data/partner_progress.dart';
import 'data/sos_alert.dart';
import 'screens/screens_wiring.dart' show partnerScreensWiringOverrides;
import 'ui/partner_care_card.dart';

/// `usePartnerData()` as the AI tab reads it (Ata AI's partner context).
final aiPartnerSourceFromPartnerProvider = Provider.autoDispose<AiPartnerSource>((ref) {
  final d = ref.watch(partnerDataProvider);
  final p = d.partnerProfile;
  return AiPartnerSource(
    lifeStage: p?.lifeStage,
    name: p?.name,
    dueDate: p?.dueDate,
    babyName: p?.babyName,
    babyBirthDate: p?.babyBirthDate,
    lastPeriodDate: p?.lastPeriodDate,
    cycleLength: p?.cycleLength,
    shareCycle: d.sharing.shareCycle,
    pregnancyWeek: d.getPregnancyWeek(),
  );
});

/// PartnerFlowStatusCard's subset of `usePartnerData()` (null without her profile).
final partnerFlowSnapshotFromPartnerProvider = Provider.autoDispose<PartnerFlowSnapshot?>((ref) {
  final d = ref.watch(partnerDataProvider);
  final p = d.partnerProfile;
  if (p == null) return null;
  return PartnerFlowSnapshot(name: p.name, lifeStage: p.lifeStage, phaseInfo: d.getCyclePhaseInfo(), daysUntilNextPeriod: d.getDaysUntilNextPeriod());
});

/// Everything PartnerProfileScreen reads from the partner feature.
final partnerProfileDataFromPartnerProvider = Provider.autoDispose<PartnerProfileData>((ref) {
  final d = ref.watch(partnerDataProvider);
  final p = d.partnerProfile;
  final stats = ref.watch(partnerStatsProvider);
  final missions = ref.watch(partnerMissionsProvider);
  final surprises = ref.watch(surprisesProvider);
  final stage = p?.lifeStage;
  return PartnerProfileData(
    partnerName: p?.name,
    partnerAvatarUrl: p?.avatarUrl,
    partnerStage: stage,
    pregnancyWeek: stage == 'bump' ? d.getPregnancyWeek() : 0,
    babyAgeDays: stage == 'mommy' ? d.getBabyAgeDays() : 0,
    totalPoints: stats.stats.totalPoints,
    lovesSent: stats.stats.lovesSent,
    messagesSent: stats.stats.messagesSent,
    completedMissions: stats.stats.completedMissions,
    statsLoading: stats.loading,
    level: missions.level,
    levelProgress: missions.levelProgress,
    pointsToNextLevel: missions.pointsToNextLevel,
    completedSurprises: surprises.completedSurprises.length,
    surprisePoints: surprises.totalPoints,
    achievementRows: ref.watch(partnerAchievementsQuery).data ?? const [],
    menuRows: ref.watch(partnerMenuItemsQuery).data ?? const [],
  );
});

/// `useSOSAlert()` for the danger-signs screen.
final sosAlertPortFromPartnerProvider = Provider.autoDispose<SosAlertPort>((ref) {
  final hasPartner = ref.watch(sosHasPartnerProvider);
  final loading = ref.watch(sosAlertProvider.select((s) => s.loading));
  return SosAlertPort(
    hasPartner: hasPartner,
    loading: loading,
    sendSOS: (message, includeLocation, alertType) async =>
        (await ref.read(sosAlertProvider.notifier).sendSOS(message, includeLocation, alertType)).error,
  );
});

/// Dashboard `<PartnerCareCard lifeStage onOpenSharing={() => onNavigate('partner-sharing')} />` (HomeSlots).
Widget partnerCareCardSlot(BuildContext context, String lifeStage) => Consumer(
      builder: (context, ref, _) =>
          PartnerCareCard(lifeStage: lifeStage, onOpenSharing: () => ref.read(shellProvider.notifier).openScreen('partner-sharing')),
    );

/// Dashboard `<DailySummaryAutoSync />` (HomeSlots, rendered for a linked pregnancy).
Widget dailySummaryAutoSyncSlot(BuildContext context) => const DailySummaryAutoSync();

/// The overrides of the phase-6 seams (append to `featureWiringOverrides()`).
List<Override> partnerWiringOverrides() => [
      aiPartnerSourceProvider.overrideWith((ref) => ref.watch(aiPartnerSourceFromPartnerProvider)),
      partnerFlowSnapshotProvider.overrideWith((ref) => ref.watch(partnerFlowSnapshotFromPartnerProvider)),
      partnerProfileDataProvider.overrideWith((ref) => ref.watch(partnerProfileDataFromPartnerProvider)),
      pregnancyPartnerNotificationsProvider.overrideWith((ref) => ref.watch(partnerNotifierProvider)),
      sosAlertPortProvider.overrideWith((ref) => ref.watch(sosAlertPortFromPartnerProvider)),
      healthMoodPartnerNotifierProvider.overrideWith((ref) => (mood) => ref.read(partnerNotifierProvider).notifyMoodUpdate(mood)),
      homeWaterGoalNotifierProvider.overrideWith((ref) => () => ref.read(partnerNotifierProvider).notifyWaterGoal()),
      // Partner screens: parenting data for PartnerParentingScreen, PartnerLossCard + loss text on the partner home.
      ...partnerScreensWiringOverrides(),
    ];
