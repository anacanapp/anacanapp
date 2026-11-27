// Ported from: src/lib/healthCycle.ts (syncPeriodDaysToHealth call site), src/lib/local-notification-scheduler.ts
//              (setLocalNotifications call site), src/lib/native.ts (hapticFeedback), src/components/premium/PremiumGate.tsx,
//              src/components/dashboard/WaterWidget.tsx, src/components/partner-shop/PartnerShop.tsx (PartnerHomeCard),
//              src/components/home/UpcomingAppointments.tsx, src/hooks/useSubscription.ts (isPremium),
//              src/hooks/usePartnerData.ts (flow subset), src/hooks/useAppointments.ts (addAppointment)
//
// Seams the flow home needs from features owned elsewhere. Every provider has a safe default so the
// flow home renders and tests run before the real feature is wired; the app root overrides them.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart' show authControllerProvider;
import '../../core/auth/auth_providers.dart';
import '../../domain/cycle/health_cycle.dart' show PeriodDay;
import '../../domain/cycle/cycle_utils.dart' show CyclePhaseInfo;
import '../../domain/notifications/local_notification_plan.dart' show StoredNotification;

/// Health export of saved period days (Apple Health / Health Connect). Minimal local interface; the
/// native layer implements it with `syncPeriodDaysToHealth` from domain/cycle/health_cycle.dart.
abstract class CycleHealthWriter {
  Future<bool> syncPeriodDays(List<PeriodDay> days);
}

class NoopCycleHealthWriter implements CycleHealthWriter {
  const NoopCycleHealthWriter();
  @override
  Future<bool> syncPeriodDays(List<PeriodDay> days) async => false;
}

final cycleHealthWriterProvider = Provider<CycleHealthWriter>((ref) => const NoopCycleHealthWriter());

/// `setLocalNotifications(namespace, items, { ask, cancelIds })` of the central scheduler (plugin calls come later;
/// the pure planning lives in domain/notifications/local_notification_plan.dart).
abstract class FlowNotificationPlanner {
  bool get isNativePlatform;
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items,
      {bool ask = false, List<int> cancelIds = const []});
}

class NoopFlowNotificationPlanner implements FlowNotificationPlanner {
  const NoopFlowNotificationPlanner();
  @override
  bool get isNativePlatform => false;
  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items,
      {bool ask = false, List<int> cancelIds = const []}) async {}
}

final flowNotificationPlannerProvider = Provider<FlowNotificationPlanner>((ref) => const NoopFlowNotificationPlanner());

/// `hapticFeedback.light()/medium()` (lib/native.ts). No-op until native glue is wired.
class FlowHaptics {
  const FlowHaptics({this.light = _noop, this.medium = _noop});
  final Future<void> Function() light;
  final Future<void> Function() medium;
  static Future<void> _noop() async {}
}

final flowHapticsProvider = Provider<FlowHaptics>((ref) => const FlowHaptics());

/// `<PremiumGate title description emoji feature>{child}</PremiumGate>`. Default: shows the child (the premium
/// state). The paywall feature overrides it with the real gate.
typedef FlowPremiumGateBuilder = Widget Function(BuildContext context,
    {required String title, required String description, required String emoji, required String feature, required Widget child});

Widget _passThroughGate(BuildContext context,
        {required String title, required String description, required String emoji, required String feature, required Widget child}) =>
    child;

final flowPremiumGateProvider = Provider<FlowPremiumGateBuilder>((ref) => _passThroughGate);

/// `useSubscription().isPremium` (SymptomPatternReport). Default true (matches the pass-through gate).
final flowIsPremiumProvider = Provider<bool>((ref) => true);

/// Shared widgets of other features, rendered inside the flow home.
class FlowHomeSlots {
  const FlowHomeSlots({this.waterWidget, this.partnerHomeCard, this.upcomingAppointments});

  /// `<WaterWidget variant="anacan" />` (home.water).
  final WidgetBuilder? waterWidget;

  /// `<PartnerHomeCard lifeStage="flow" daysUntilPeriod={n} />` (partner-shop.home-card).
  final Widget Function(BuildContext context, int daysUntilPeriod)? partnerHomeCard;

  /// `<UpcomingAppointments />` (home.appointments).
  final WidgetBuilder? upcomingAppointments;
}

final flowHomeSlotsProvider = Provider<FlowHomeSlots>((ref) => const FlowHomeSlots());

/// `navigate('/ai-chat?prompt=…')` (PeriodDelayBanner). Default no-op; wire to the AI tab with a prompt.
final flowOpenAiChatProvider = Provider<void Function(String prompt)>((ref) => (_) {});

/// `useAppointments().addAppointment(row)` (TTC positive-test sheet). Default: does nothing.
final flowAddAppointmentProvider = Provider<Future<void> Function(Map<String, Object?> row)>((ref) => (_) async {});

/// The subset of `usePartnerData()` PartnerFlowStatusCard reads (the partner's view of the woman).
class PartnerFlowSnapshot {
  const PartnerFlowSnapshot({required this.name, required this.lifeStage, required this.phaseInfo, required this.daysUntilNextPeriod});
  final String name;
  final String? lifeStage;
  final CyclePhaseInfo? phaseInfo;
  final int daysUntilNextPeriod;
}

/// Wired by the partner feature (partner.home). Default: no partner profile → the card renders nothing.
final partnerFlowSnapshotProvider = Provider<PartnerFlowSnapshot?>((ref) => null);

/// IANA zone for `record_period_days` (`Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'`).
/// Dart has no IANA zone lookup; the app root should override it (e.g. flutter_timezone). Default 'UTC'.
final flowTimeZoneProvider = Provider<String>((ref) => 'UTC');

/// `useAuth().user?.id`.
final flowUserIdProvider = Provider<String?>((ref) => ref.watch(authUserProvider)?.id);

/// `useAuth().profile` raw row (flow_goal, ttc_state, baby_birth_date).
final flowProfileRowProvider = Provider<Map<String, dynamic>?>((ref) => ref.watch(authProfileProvider)?.row);

/// `useAuth().refreshProfile`.
final flowRefreshProfileProvider =
    Provider<Future<void> Function()>((ref) => () => ref.read(authControllerProvider.notifier).refreshProfile());
