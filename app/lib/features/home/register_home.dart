// Ported from: src/pages/Index.tsx (home tab → <Dashboard/> for women, `activeScreen === 'calendar'` →
//              <CalendarScreen/>, <FloatingTimerWidget/>, native-only <HomeWidgetSync/> for bump / mommy)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../shell/shell.dart';
import '../../state/user_store.dart';
import '../calendar/calendar_screen.dart';
import '../startup/app_update/app_update_sheet.dart' show AppUpdateBannerSlot;
import 'dashboard.dart';
import 'floating_timer_widget.dart';
import 'home_widget_sync.dart';

/// Registers the woman home tab (Dashboard), the calendar screen, the floating timer and the widget sync, and the
/// bump stage body. The flow / mommy ports call `registerHomeStageBody` themselves.
void registerHomeFeature(FeatureRegistry r) {
  registerBumpHomeBody();
  // Slivers straight into the shell's scroll view (lazy stage lists); the sky scrolls behind them. Index renders the
  // soft update banner (`px-4 pt-2`) above <Dashboard/> on the home tab.
  r.registerTabSlivers(
      ShellTab.home,
      (context, args) => const ShellSliverBody(
            sliver: SliverMainAxisGroup(slivers: [SliverToBoxAdapter(child: AppUpdateBannerSlot()), DashboardSliver()]),
            background: DashboardSky(),
          ));
  r.registerScreen(ScreenId.calendar, (context, args) => CalendarScreen(onBack: args.onBack));
  r.registerFrameOverlay('floating-timer', (context) => const FloatingTimerWidget());
  r.registerFrameOverlay('home-widget-sync', (context) => const _WidgetSyncGate());
}

/// `{Capacitor.isNativePlatform() && (lifeStage === 'bump' || lifeStage === 'mommy') && <HomeWidgetSync />}`.
class _WidgetSyncGate extends ConsumerWidget {
  const _WidgetSyncGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    return stage == 'bump' || stage == 'mommy' ? const HomeWidgetSync() : const SizedBox.shrink();
  }
}
