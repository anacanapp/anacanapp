// Ported from: src/lib/water-intake.ts, src/lib/water-intake-rpc.ts (pure parts), src/components/tools/Nutrition.tsx
// (daily targets), src/hooks/useDailyLogs.ts (partner "water goal reached" rule)
//
// Water taps are server-side deltas; the UI shows the stored total for the day plus still-queued deltas.

import 'dart:math' as math;

import '../js_compat.dart';

const String waterOutboxTable = 'water_intake';
const String waterRpc = 'increment_water_intake_v1';
const int waterSendTimeoutMs = 15000;

/// Same bounds as the server column clamp.
int clampWater(num value) => math.max(0, math.min(20000, jsRoundInt(value)));

/// Stored water of a loaded log row, only when that row is for [day] (yesterday's row counts as 0).
num storedWaterForDay({required String? logDate, required num? waterIntake, required String day}) =>
    logDate != null && logDate == day ? (waterIntake ?? 0) : 0;

/// Sum of queued water deltas of the outbox entries for [day] (entries: `{table, payload: {log_date, delta}}`).
num pendingWaterDelta(List<Map<String, Object?>> outbox, String day) {
  num sum = 0;
  for (final e in outbox) {
    final payload = e['payload'];
    if (e['table'] != waterOutboxTable || payload is! Map) continue;
    if (payload['log_date'] == day && payload['delta'] is num) sum += payload['delta'] as num;
  }
  return sum;
}

/// What the UI shows for [day].
int displayedWater({required num stored, required num pending}) => clampWater(stored + pending);

/// The server has no such function yet (old backend): PostgREST PGRST202 / 42883 / 404.
bool isMissingRpc(Map<String, Object?>? error, [int? status]) {
  if (error == null) return false;
  final code = error['code'];
  if (code == 'PGRST202' || code == '42883') return true;
  return status == 404 && RegExp('function|rpc', caseSensitive: false).hasMatch((error['message'] as String?) ?? '');
}

/// Partner notification fires once, when an applied tap crosses 2000 (the useDailyLogs rule, unchanged).
bool crossesWaterGoal({required bool applied, required num total, required num amount}) =>
    applied && total >= 2000 && total - amount < 2000;

/// Nutrition tool fallback targets by life stage (used when nutrition_targets has no row).
const Map<String, ({int calories, int waterGlasses, String descriptionKey, String descriptionAz})> fallbackNutritionTargets = {
  'bump': (calories: 2300, waterGlasses: 10, descriptionKey: 'nutrition_hamilelik_dovru_57af7a', descriptionAz: 'Hamiləlik dövrü'),
  'mommy': (calories: 2500, waterGlasses: 12, descriptionKey: 'nutrition_emizdirme_dovru_6f45f4', descriptionAz: 'Əmizdirmə dövrü'),
  'flow': (calories: 2000, waterGlasses: 8, descriptionKey: 'nutrition_umumi_saglamliq_6c20a8', descriptionAz: 'Ümumi sağlamlıq'),
};

/// Maximum glasses the water tab lets the user add (the "+" button stops at 12).
const int maxWaterGlassesPerDay = 12;

/// Daily calorie / water target: the DB row for the stage, else the fallback; multiples in pregnancy add
/// +300 kcal per extra baby (ACOG), only in the bump stage.
({num calories, num water, String description}) nutritionTargets({
  String? lifeStage,
  List<Map<String, Object?>> dbTargets = const [],
  bool isMultiple = false,
  int babyCount = 1,
  Tr tr = azTr,
}) {
  final extra = lifeStage == 'bump' && isMultiple ? (babyCount - 1) * 300 : 0;
  final stage = (lifeStage == null || lifeStage.isEmpty) ? 'flow' : lifeStage;
  for (final t in dbTargets) {
    if (t['life_stage'] == stage) {
      return (
        calories: (t['calories']! as num) + extra,
        water: t['water_glasses']! as num,
        description: (t['description'] as String?) ?? '',
      );
    }
  }
  final f = fallbackNutritionTargets[stage] ?? fallbackNutritionTargets['flow']!;
  return (calories: f.calories + extra, water: f.waterGlasses, description: tr(f.descriptionKey, f.descriptionAz));
}
