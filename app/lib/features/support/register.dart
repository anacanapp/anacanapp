// Ported from: src/pages/Index.tsx (`help` screen, `<AppRatingPrompt />`, the day-14 `<FeedbackSheet auto>` effect)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import '../../state/first_run_sheets.dart';
import '../security/app_lock.dart' show isNativePlatformProvider;
import '../security/register.dart' show onboardingTourActiveProvider;
import 'app_rating.dart';
import 'data/app_feedback.dart';
import 'feedback_sheet.dart';
import 'help_screen.dart';

void registerSupportFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.help, (context, a) => HelpScreen(onBack: a.onBack));
  r.registerFrameOverlay('support-rating-prompt', (context) => const AppRatingPrompt());
  r.registerFrameOverlay('support-auto-feedback', (context) => const AutoFeedbackHost());
}

/// Index: once (from day 14), after 20 s on Home with no screen / tool / tour, native only.
class AutoFeedbackHost extends ConsumerStatefulWidget {
  const AutoFeedbackHost({super.key});
  @override
  ConsumerState<AutoFeedbackHost> createState() => _AutoFeedbackHostState();
}

class _AutoFeedbackHostState extends ConsumerState<AutoFeedbackHost> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    ref.read(feedbackStoreProvider).noteFirstOpen();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _schedule();
    });
  }

  void _schedule() {
    _timer?.cancel();
    final s = ref.read(shellProvider);
    final user = ref.read(authUserProvider);
    if (ref.read(onboardingTourActiveProvider) || user == null || s.activeTab != ShellTab.home || s.activeScreen != null || s.activeTool != null) return;
    _timer = Timer(const Duration(seconds: 20), () {
      if (!mounted) return;
      final profile = ref.read(authProfileProvider);
      final store = ref.read(feedbackStoreProvider);
      if (ref.read(isNativePlatformProvider) &&
          store.shouldAutoPromptFeedback(accountCreatedAt: user.createdAt, lossRecovery: profile?.lossRecoveryActive == true)) {
        store.markPromptShown();
        unawaited(ref.read(firstRunSheetsProvider.notifier).during(FirstRunSheet.autoFeedback, () => showFeedbackSheet(context, auto: true)));
      }
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
