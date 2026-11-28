// Ported from: src/pages/Index.tsx (`activeScreen` 'illness', 'recovery' / 'recovery/kegel', 'doctor-report',
//              'loss-guide' / 'loss-guide/signs', 'loss-memories' with their props), src/components/Dashboard.tsx
//              (`<RecoveryHome onNavigate onNavigateToTool onOpenAssistant />`, `<IllnessHomeCard mode onOpen />`),
//              src/components/ProfileScreen.tsx (`<ProfilePregnancyCard onNavigate />`),
//              src/components/partner/v2/PartnerHomeScreen.tsx (IllnessHomeCard, usePregnancyLossText)
//
// The health screens feature: illness journal, postpartum recovery (+ Kegel; code in features/recovery), pregnancy
// loss home / guide / memories, the profile pregnancy card (+ loss sheet) and the doctor report. Screen guards
// (not partner for recovery / loss screens) are applied by the shell. The slot builders below are for the app
// root's HomeSlots / MommyHomeSlots / ProfileSlots / PartnerHomeSlots (docs/flutter/WIRING.md).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../native/purchases/subscription.dart' show subscriptionProvider;
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../home_mommy/mommy_home_slots.dart' show MommySlotArgs;
import '../partner/partner_ports.dart' show PartnerLossText;
import '../recovery/recovery_screen.dart';
import 'common/health_ports.dart';
import 'doctor_report/doctor_report_screen.dart';
import 'illness/illness_home_card.dart';
import 'illness/illness_screen.dart';
import 'loss/loss_memories_screen.dart';
import 'loss/pregnancy_loss.dart';
import 'loss/recovery_guide_screen.dart';
import 'loss/recovery_home.dart';
import 'pregnancy_card/profile_pregnancy_card.dart';

export 'common/health_ports.dart'
    show
        deviceLocaleProvider,
        healthScreensBackendProvider,
        healthScreensIsPremiumProvider,
        illnessNotificationPermissionProvider,
        illnessReminderPlannerProvider;
export 'doctor_report/pdf_report.dart' show doctorReportPdfRendererProvider, pdfDeliveryPlatformProvider;
export 'illness/illness_home_card.dart' show IllnessHomeCard;
export 'loss/recovery_home.dart' show RecoveryHome;
export 'pregnancy_card/profile_pregnancy_card.dart' show ProfilePregnancyCard;

void registerHealthScreensFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.illness, (context, a) => IllnessScreen(onBack: a.onBack));
  Widget recovery(ShellScreenArgs a, String tab) => Consumer(
        builder: (context, ref, _) => RecoveryScreen(
          onBack: a.onBack,
          initialTab: tab,
          onNavigateToTool: (tool) => ref.read(shellProvider.notifier).screenOpensTool(tool),
        ),
      );
  r.registerScreen(ScreenId.recovery, (context, a) => recovery(a, 'week'));
  r.registerScreen(ScreenId.recoveryKegel, (context, a) => recovery(a, 'kegel'));
  r.registerScreen(ScreenId.doctorReport, (context, a) => DoctorReportScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.lossGuide, (context, a) => RecoveryGuideScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.lossGuideSigns, (context, a) => RecoveryGuideScreen(onBack: a.onBack, initialTab: 'signs'));
  r.registerScreen(
    ScreenId.lossMemories,
    (context, a) => Consumer(
      builder: (context, ref, _) => LossMemoriesScreen(
        onBack: a.onBack,
        onNavigate: (screen) => ref.read(shellProvider.notifier).navigateScreen(screen),
        onOpenTool: (tool) => ref.read(shellProvider.notifier).screenOpensTool(tool),
      ),
    ),
  );
}

/// `HomeSlots.recoveryHome`: Dashboard's `<RecoveryHome onNavigate={navigateScreen}
/// onNavigateToTool={handleNavigateToTool} onOpenAssistant={() => setActiveTab('ai')} />`.
Widget recoveryHomeSlot(BuildContext context) => Consumer(
      builder: (context, ref, _) => RecoveryHome(
        onNavigate: (screen) => ref.read(shellProvider.notifier).navigateScreen(screen),
        onNavigateToTool: (tool) => ref.read(shellProvider.notifier).openToolId(tool),
        onOpenAssistant: () => ref.read(shellProvider.notifier).openAssistant(),
      ),
    );

/// `MommySlot.illnessActive`: `<IllnessHomeCard mode="active" onOpen={() => onNavigate('illness')} />`.
Widget illnessActiveSlot(BuildContext context, MommySlotArgs args) => IllnessHomeCard(mode: 'active', onOpen: () => args.onNavigate('illness'));

/// `MommySlot.illnessEntry`: `<IllnessHomeCard mode="entry" onOpen={() => onNavigate('illness')} />`.
Widget illnessEntrySlot(BuildContext context, MommySlotArgs args) => IllnessHomeCard(mode: 'entry', onOpen: () => args.onNavigate('illness'));

/// `ProfileSlots.pregnancyCard`: `<ProfilePregnancyCard onNavigate={navigateScreen} />`.
Widget pregnancyCardSlot(BuildContext context, void Function(String screen) onNavigate) => ProfilePregnancyCard(onNavigate: onNavigate);

/// `PartnerHomeSlots.illnessHomeCard`.
Widget partnerIllnessHomeCardSlot(BuildContext context, String mode, VoidCallback onOpen) => IllnessHomeCard(mode: mode, onOpen: onOpen);

/// `PartnerHomeSlots.lossText`: `usePregnancyLossText(language)` → `ui.p_hero_label`, `chips`.
PartnerLossText? partnerLossTextFor(String language) {
  final text = pregnancyLossText(language);
  return PartnerLossText(heroLabel: text.sub('ui').s('p_hero_label'), chips: text.list('chips'));
}

/// Seams of this feature the app root wires (append to `featureWiringOverrides()`).
List<Override> healthScreensWiringOverrides() => [
      // useSubscription().isPremium (illness PDF, Kegel trainer, doctor report).
      healthScreensIsPremiumProvider.overrideWith((ref) => ref.watch(subscriptionProvider.select((s) => s.isPremium))),
    ];
