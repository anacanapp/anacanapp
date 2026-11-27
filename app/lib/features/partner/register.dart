// Ported from: src/pages/Index.tsx (partner tabs `home` → PartnerHomeScreen onNavigate={setActiveScreen}
//              onOpenChat={() => setActiveTab('chat')}, `together` → PartnerTogetherScreen, screen
//              `partner-notifications`, AlertReceiver for both linked roles with onHospitalRun → 'hospital-run')
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import '../../state/user_store.dart';
import 'ui/alert_receiver.dart';
import 'ui/partner_home_screen.dart';
import 'ui/partner_notifications_screen.dart';
import 'ui/partner_together_screen.dart';

/// `setActiveScreen(screen)` from a partner screen: a known [ScreenId] goes through `openScreenId` (the shell shows
/// its placeholder until the screen's feature registers it), anything else through `openScreen`.
void openPartnerScreen(WidgetRef ref, String screen) {
  final shell = ref.read(shellProvider.notifier);
  final id = ScreenId.values.where((s) => !s.prefix && s.id == screen).firstOrNull;
  if (id != null) {
    shell.openScreenId(id);
  } else {
    shell.openScreen(screen);
  }
}

void registerPartnerFeature(FeatureRegistry r) {
  r.registerTab(ShellTab.home, (context, a) => const _PartnerHomeTab(), partner: true);
  r.registerTab(ShellTab.together, (context, a) => const _PartnerTogetherTab(), partner: true);
  r.registerScreen(ScreenId.partnerNotifications, (context, a) => PartnerNotificationsScreen(onBack: a.onBack));
  r.registerFrameOverlay(
    'partner-alert-receiver',
    (context) => AlertReceiverHost(
      isPartner: (ref) => ref.watch(userStoreProvider.select((s) => s.role)) == 'partner',
      onHospitalRun: (ref) => ref.read(shellProvider.notifier).openScreenId(ScreenId.hospitalRun),
    ),
  );
}

class _PartnerHomeTab extends ConsumerWidget {
  const _PartnerHomeTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) => PartnerHomeScreen(
        onNavigate: (screen) => openPartnerScreen(ref, screen),
        onOpenChat: () => ref.read(shellProvider.notifier).setTab(ShellTab.chat),
      );
}

class _PartnerTogetherTab extends ConsumerWidget {
  const _PartnerTogetherTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) => PartnerTogetherScreen(onNavigate: (screen) => openPartnerScreen(ref, screen));
}
