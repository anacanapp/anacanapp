// Ported from: src/components/ToolsHub.tsx (renderToolById cases safety, kick, contraction, weight, hospital, names,
//              maternity-calculator, fetal-growth, danger-signs, pregnancy-album)
//
// Registers the pregnancy tools (phase 4) on the shell's feature registry; the Tools hub looks them up by ToolId.
import '../../shell/shell.dart';
import 'contraction/contraction_timer.dart';
import 'danger_signs/danger_signs_screen.dart';
import 'fetal_growth/fetal_growth_tracker.dart';
import 'hospital_bag/hospital_bag.dart';
import 'kick/kick_counter.dart';
import 'maternity/maternity_calculator.dart';
import 'names/baby_names.dart';
import 'pregnancy_album/pregnancy_album.dart';
import 'safety/safety_lookup.dart';
import 'weight/weight_tracker.dart';

void registerPregnancyTools(FeatureRegistry r) {
  r.registerTool(ToolId.safety, (context, a) => SafetyLookup(onBack: a.onBack));
  r.registerTool(ToolId.kick, (context, a) => KickCounter(onBack: a.onBack));
  r.registerTool(ToolId.contraction, (context, a) => ContractionTimer(onBack: a.onBack));
  r.registerTool(ToolId.weight, (context, a) => WeightTracker(onBack: a.onBack));
  r.registerTool(ToolId.hospital, (context, a) => HospitalBag(onBack: a.onBack));
  r.registerTool(ToolId.names, (context, a) => BabyNames(onBack: a.onBack));
  r.registerTool(ToolId.maternityCalculator, (context, a) => MaternityCalculator(onBack: a.onBack));
  r.registerTool(ToolId.fetalGrowth, (context, a) => FetalGrowthTracker(onBack: a.onBack));
  r.registerTool(ToolId.dangerSigns, (context, a) => DangerSignsScreen(onBack: a.onBack));
  r.registerTool(ToolId.pregnancyAlbum, (context, a) => PregnancyAlbum(onBack: a.onBack));
}
