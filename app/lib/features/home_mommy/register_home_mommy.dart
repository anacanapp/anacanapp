// Ported from: src/components/Dashboard.tsx (`lifeStage === 'mommy' && <MommyDashboard … />`),
//              src/pages/Index.tsx (`usePendingTimerStops()` mounted at the Index level)
//
// Feature entry point for the mommy home + baby care core.
import 'package:flutter/widgets.dart';

import '../../shell/feature_registry.dart';
import '../../state/user_store.dart' show LifeStages;
import '../baby/hooks/use_pending_timer_stops.dart';
import '../baby/widgets/child_selector.dart';
import '../home/home_stage_registry.dart';
import 'mommy_dashboard.dart';

/// Registers the mommy stage body of the home and the (invisible) pending-timer-stop processor.
///
/// The processor is a frame overlay so it runs whenever the tab frame is shown; Index.tsx kept it mounted for the
/// whole signed-in session, so the app root may instead (or also) keep `pendingTimerStopsHostProvider` watched
/// at its level (see README).
void registerHomeMommyFeature(FeatureRegistry r) {
  registerHomeStageBody(LifeStages.mommy, (context) => const MommyDashboard());
  r.registerFrameOverlay('pending-timer-stops', (context) => const PendingTimerStopsHost());
}

/// The top-bar action the shared home shows for the mommy stage (`<ChildSelector compact />`).
Widget buildMommyTopBarAction(BuildContext context) => const ChildSelector(compact: true);
