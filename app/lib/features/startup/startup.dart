// Ported from: src/pages/Index.tsx (splash / StartupScreen / ForceUpdateScreen / AppUpdateSheet wiring),
//              src/components/SplashScreen.tsx, src/components/StartupScreen.tsx, src/components/ForceUpdateScreen.tsx
//
// Startup feature: brand splash and loading gates, the forced-update gate (update centre + legacy setting),
// the soft-update sheet over the shell, the pre-i18n admission screens and the error fallbacks.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../shell/feature_registry.dart';
import '../../shell/gates/gate_sequence.dart';
import 'app_update/app_update.dart';
import 'app_update/app_update_sheet.dart';
import 'force_update_screen.dart';
import 'startup_screen.dart';

export 'admission_screens.dart';
export 'app_update/app_update.dart';
export 'app_update/app_update_sheet.dart';
export 'app_update_copy.dart';
export 'error_boundary.dart';
export 'force_update_screen.dart';
export 'offline_sync_indicator.dart';
export 'startup_screen.dart';
export 'widgets/a_sky.dart';

/// Frame-overlay id of the soft update sheet.
const String kAppUpdateSheetOverlayId = 'app-update-sheet';

/// Registers the startup gates and the update sheet.
void registerStartupFeature(FeatureRegistry r) {
  r.registerGate(GateId.splash, (context, args) => const SplashScreen());
  r.registerGate(GateId.startup, (context, args) => const StartupScreen());
  r.registerGate(GateId.forceUpdate, (context, args) => ForceUpdateGate(reason: args.decision.reason));
  r.registerFrameOverlay(kAppUpdateSheetOverlayId, (context) => const AppUpdateSheetHost());
}

/// Index's two force-update branches.
class ForceUpdateGate extends ConsumerWidget {
  const ForceUpdateGate({super.key, required this.reason});
  final GateReason? reason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(appLanguageProvider);
    if (reason == GateReason.legacyForceUpdate) {
      final config = ref.watch(legacyForceUpdateStateProvider).forceUpdate;
      if (config == null) return const StartupScreen();
      return ForceUpdateScreen(
        key: const ValueKey('force-update:legacy'),
        title: config.title,
        message: config.message,
        androidUrl: config.androidUrl,
        iosUrl: config.iosUrl,
        language: language,
      );
    }
    final s = ref.watch(appUpdateProvider);
    final d = s.decision;
    if (d == null) return const StartupScreen();
    return ForceUpdateScreen(
      key: const ValueKey('app-update-force'),
      title: d.title,
      message: d.body,
      buttonLabel: d.button,
      currentVersion: s.currentVersion,
      androidUrl: d.storeUrl,
      iosUrl: d.storeUrl,
      language: language,
    );
  }
}
