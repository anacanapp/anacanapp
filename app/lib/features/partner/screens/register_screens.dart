// Ported from: src/pages/Index.tsx (the partner sub-screens: name-voting, partner-hospital-bag, daily-summary,
//              partner-shopping, partner-appointments, partner-baby-day, partner-weekly-stats, partner-surprises,
//              partner-parenting, hospital-run (onNavigate={setActiveScreen}, onOpenContractions → live-contractions),
//              live-contractions, partner-sharing (onNavigate={setActiveScreen}), night-shift, birth-plan,
//              postpartum-support, partner-loss-support). Role guards live in the shell (ScreenGuard).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shell/feature_registry.dart';
import '../../../shell/nav/ids.dart';
import '../../../shell/nav/shell_controller.dart';
import '../register.dart' show openPartnerScreen;
import 'birth_plan_screen.dart';
import 'daily_summary_screen.dart';
import 'hospital_run_screen.dart';
import 'live_contractions_screen.dart';
import 'name_voting_screen.dart';
import 'night_shift_screen.dart';
import 'partner_appointments_screen.dart';
import 'partner_baby_day_screen.dart';
import 'partner_hospital_bag_screen.dart';
import 'partner_loss_support_screen.dart';
import 'partner_parenting.dart';
import 'partner_sharing_screen.dart';
import 'partner_shopping_screen.dart';
import 'partner_surprises_screen.dart';
import 'partner_weekly_stats_screen.dart';
import 'postpartum_support_screen.dart';

void registerPartnerScreens(FeatureRegistry r) {
  r.registerScreen(ScreenId.nameVoting, (context, a) => NameVotingScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerHospitalBag, (context, a) => PartnerHospitalBagScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.dailySummary, (context, a) => DailySummaryScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerShopping, (context, a) => PartnerShoppingScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerAppointments, (context, a) => PartnerAppointmentsScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerBabyDay, (context, a) => PartnerBabyDayScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerWeeklyStats, (context, a) => PartnerWeeklyStatsScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerSurprises, (context, a) => PartnerSurprisesScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerParenting, (context, a) => PartnerParentingEntry(onBack: a.onBack));
  r.registerScreen(ScreenId.hospitalRun, (context, a) => _HospitalRunEntry(onBack: a.onBack));
  r.registerScreen(ScreenId.liveContractions, (context, a) => LiveContractionsScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerSharing, (context, a) => _PartnerSharingEntry(onBack: a.onBack));
  r.registerScreen(ScreenId.nightShift, (context, a) => NightShiftScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.birthPlan, (context, a) => BirthPlanScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.postpartumSupport, (context, a) => PostpartumSupportScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.partnerLossSupport, (context, a) => PartnerLossSupportScreen(onBack: a.onBack));
}

class _HospitalRunEntry extends ConsumerWidget {
  const _HospitalRunEntry({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) => HospitalRunScreen(
        onBack: onBack,
        onNavigate: (screen) => openPartnerScreen(ref, screen),
        onOpenContractions: () => ref.read(shellProvider.notifier).openScreenId(ScreenId.liveContractions),
      );
}

class _PartnerSharingEntry extends ConsumerWidget {
  const _PartnerSharingEntry({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) => PartnerSharingScreen(onBack: onBack, onNavigate: (screen) => openPartnerScreen(ref, screen));
}
