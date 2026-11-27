// Ported from: src/pages/Index.tsx (first-run lock offer effect + `<LockOfferSheet>` / `<AppLockSetupSheet preferBio>`),
//              src/App.tsx (`<AppLockGate />`, `<ScreenCaptureGuard />` — mounted by the app root, see README)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import '../../state/first_run_sheets.dart';
import '../support/data/app_feedback.dart';
import 'app_lock.dart';
import 'app_lock_setup_sheet.dart';
import 'lock_offer_sheet.dart';

/// The in-app onboarding tour is on screen (OnboardingTourHost `onRunningChange`); first-run sheets wait for it.
final onboardingTourActiveProvider = Provider<bool>((ref) => false);

void registerSecurityFeature(FeatureRegistry r) {
  r.registerFrameOverlay('security-lock-offer', (context) => const LockOfferHost());
}

/// Index effect: first Home visit after onboarding (no screen / tool, no tour, not already prompted today, native,
/// lock off, never offered) → after 1.5 s mark seen + prompt day, show the offer; "enable" → setup sheet 350 ms later.
class LockOfferHost extends ConsumerStatefulWidget {
  const LockOfferHost({super.key});
  @override
  ConsumerState<LockOfferHost> createState() => _LockOfferHostState();
}

class _LockOfferHostState extends ConsumerState<LockOfferHost> {
  Timer? _timer;

  void _schedule() {
    _timer?.cancel();
    final shell = ref.read(shellProvider);
    final user = ref.read(authUserProvider);
    final lock = ref.read(appLockProvider);
    if (ref.read(onboardingTourActiveProvider) || user == null || shell.activeTab != ShellTab.home || shell.activeScreen != null || shell.activeTool != null) return;
    if (!lock.shouldOfferLock(isNative: ref.read(isNativePlatformProvider)) || ref.read(feedbackStoreProvider).promptShownToday()) return;
    _timer = Timer(const Duration(milliseconds: 1500), () async {
      if (!mounted) return;
      lock.markLockOfferSeen();
      ref.read(feedbackStoreProvider).markPromptShown();
      final sheets = ref.read(firstRunSheetsProvider.notifier);
      final enable = await sheets.during(FirstRunSheet.lockOffer, () => showLockOfferSheet(context));
      if (!enable || !mounted) return;
      _timer = Timer(const Duration(milliseconds: 350), () {
        if (mounted) unawaited(sheets.during(FirstRunSheet.lockSetup, () => showAppLockSetupSheet(context, preferBio: true)));
      });
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _schedule();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(shellProvider.select((s) => (s.activeTab, s.activeScreen, s.activeTool)), (_, _) => _schedule());
    ref.listen(authUserProvider.select((u) => u?.id), (_, _) => _schedule());
    ref.listen(onboardingTourActiveProvider, (_, _) => _schedule());
    return const SizedBox.shrink();
  }
}
