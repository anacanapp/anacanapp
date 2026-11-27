// Ported from: src/components/ToolsHub.tsx (renderToolById: baby-tracker, baby-growth / growth-tracker, teething /
//              teething-tracker, vaccine-calendar / vaccines-calendar, solid-food-guide, preemie-hub, baby-album)
//
// Baby tools of phase 4. The hub renders the merged sections of the baby tracker host (baby-growth, teething)
// through the same registry entries.
import '../../shell/shell.dart';
import 'baby_album/baby_monthly_album.dart';
import 'baby_growth/baby_growth_tracker.dart';
import 'baby_tracker/baby_tracker.dart';
import 'preemie/preemie_hub.dart';
import 'solid_food/solid_food_guide.dart';
import 'teething/teething_tracker.dart';
import 'vaccines/vaccine_calendar.dart';

void registerBabyTools(FeatureRegistry r) {
  r.registerTool(ToolId.babyTracker, (context, a) => BabyTracker(onBack: a.onBack));
  r.registerTool(ToolId.babyGrowth, (context, a) => BabyGrowthTracker(onBack: a.onBack));
  r.registerTool(ToolId.teething, (context, a) => TeethingTracker(onBack: a.onBack));
  r.registerTool(ToolId.vaccineCalendar, (context, a) => VaccineCalendar(onBack: a.onBack));
  r.registerTool(ToolId.solidFoodGuide, (context, a) => SolidFoodGuide(onBack: a.onBack));
  r.registerTool(ToolId.preemieHub, (context, a) => PreemieHubScreen(onBack: a.onBack));
  r.registerTool(ToolId.babyAlbum, (context, a) => BabyMonthlyAlbum(onBack: a.onBack));
}
