// Ported from: src/pages/Index.tsx (`activeScreen === 'mommy-period' && lifeStage === 'mommy'` → MommyPeriodTracker),
//              src/components/Dashboard.tsx (flow stage body = FlowDashboard)
//
// Barrel + feature registration of the flow (cycle tracking) life stage home.

import '../../shell/shell.dart';
import '../../state/user_store.dart' show LifeStages;
import '../home/home_stage_registry.dart';
import 'flow_dashboard.dart';
import 'mommy_period_tracker.dart';

export 'cycle_anomaly_banner.dart';
export 'cycle_trend_chart.dart';
export 'daily_story_cards.dart';
export 'data/flow_hooks.dart';
export 'data/flow_repository.dart';
export 'data/phase_info.dart';
export 'flow_cycle_stats.dart';
export 'flow_daily_logger.dart';
export 'flow_dashboard.dart';
export 'flow_mood_chart.dart';
export 'flow_period_calendar.dart';
export 'flow_platform.dart';
export 'flow_reminders_card.dart';
export 'mommy_period_tracker.dart';
export 'partner_flow_status_card.dart';
export 'period_delay_banner.dart';
export 'pill_reminder_card.dart';
export 'symptom_pattern_report.dart';

/// Registers the flow home body and the `mommy-period` screen.
void registerHomeFlowFeature(FeatureRegistry r) {
  registerHomeStageBody(LifeStages.flow, (context) => const FlowDashboard());
  r.registerScreen(ScreenId.mommyPeriod, (context, a) => PeriodTrackerView(onBack: a.onBack));
}
