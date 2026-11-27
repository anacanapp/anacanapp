// Ported from: src/components/ToolsHub.tsx (renderToolById cases nutrition, shopping, exercise(s), mood(-diary),
//              recipes, doctors, blood-sugar, blood-pressure, mental-health, first-aid, vitamin-tracker / vitamins;
//              usePrefetchFirstAid)
//
// Registration of the health & lifestyle tools. The hub's first-aid warm-up is [healthToolsPrefetchFirstAid] (wire it
// into `ToolsHubSlots.prefetchFirstAid`).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/shell.dart';
import 'blood_pressure/blood_pressure_tracker.dart';
import 'blood_sugar/blood_sugar_tracker.dart';
import 'doctors/doctors_hospitals.dart';
import 'exercises/exercises.dart';
import 'first_aid/first_aid_data.dart' as first_aid;
import 'first_aid/first_aid_guide.dart';
import 'mental_health/mental_health_tracker.dart';
import 'mood/mood_diary.dart';
import 'nutrition/nutrition.dart';
import 'recipes/recipes.dart';
import 'shopping/shopping_list.dart';
import 'vitamins/vitamin_tracker.dart';

void registerHealthTools(FeatureRegistry r) {
  r.registerTool(ToolId.nutrition, (context, a) => Nutrition(onBack: a.onBack));
  r.registerTool(ToolId.shopping, (context, a) => ShoppingList(onBack: a.onBack));
  r.registerTool(ToolId.exercise, (context, a) => Exercises(onBack: a.onBack));
  r.registerTool(ToolId.mood, (context, a) => MoodDiary(onBack: a.onBack));
  r.registerTool(ToolId.recipes, (context, a) => Recipes(onBack: a.onBack));
  r.registerTool(ToolId.doctors, (context, a) => DoctorsHospitals(onBack: a.onBack));
  r.registerTool(ToolId.bloodSugar, (context, a) => BloodSugarTracker(onBack: a.onBack));
  r.registerTool(ToolId.bloodPressure, (context, a) => BloodPressureTracker(onBack: a.onBack));
  r.registerTool(ToolId.mentalHealth, (context, a) => MentalHealthTracker(onBack: a.onBack));
  r.registerTool(ToolId.firstAid, (context, a) => FirstAidGuide(onBack: a.onBack));
  r.registerTool(ToolId.vitaminTracker, (context, a) => VitaminTracker(onBack: a.onBack));
}

/// `usePrefetchFirstAid()`: the value for `ToolsHubSlots(prefetchFirstAid: …)`.
void healthToolsPrefetchFirstAid(WidgetRef ref) => first_aid.prefetchFirstAid(ref);
