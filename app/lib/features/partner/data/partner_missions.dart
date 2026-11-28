// Ported from: src/data/partner-missions/index.ts, src/hooks/usePartnerMissions.ts
//
// Partner daily missions by the woman's stage (texts per language in generated/partner_missions_text.g.dart) and
// the partner's completion state / points (`partner_missions`). One shared state for every screen that reads the
// level (home card, profile); the missions list itself depends on the stage passed in.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../../state/user_store.dart';
import '../generated/partner_missions_text.g.dart';
import 'partner_backend.dart';

/// 'any' | 'flow' | 'bump' | 'bump_late' | 'newborn' | 'mommy'.
typedef MissionPool = String;

/// 'care' | 'support' | 'surprise'.
typedef MissionCategory = String;

/// 'easy' | 'medium' | 'hard'.
typedef MissionDifficulty = String;

@immutable
class PartnerMissionDef {
  const PartnerMissionDef(this.key, this.pool, this.category, this.difficulty, this.icon);
  final String key;
  final MissionPool pool;
  final MissionCategory category;
  final MissionDifficulty difficulty;

  /// `MissionIcon` name (coffee, heart, …).
  final String icon;

  int get points => difficulty == 'easy' ? 10 : difficulty == 'medium' ? 20 : 30;

  @override
  String toString() => key;
}

const List<PartnerMissionDef> kPartnerMissions = [
  PartnerMissionDef('any_drink', 'any', 'care', 'easy', 'coffee'),
  PartnerMissionDef('any_dishes', 'any', 'care', 'easy', 'home'),
  PartnerMissionDef('any_compliment', 'any', 'surprise', 'easy', 'smile'),
  PartnerMissionDef('any_listen', 'any', 'support', 'easy', 'message'),
  PartnerMissionDef('any_walk', 'any', 'care', 'easy', 'footprints'),
  PartnerMissionDef('any_love_note', 'any', 'surprise', 'easy', 'heart'),
  PartnerMissionDef('any_cook', 'any', 'care', 'medium', 'utensils'),
  PartnerMissionDef('any_errand', 'any', 'support', 'medium', 'cart'),
  PartnerMissionDef('any_flowers', 'any', 'surprise', 'medium', 'flower'),
  PartnerMissionDef('flow_heat', 'flow', 'care', 'easy', 'droplets'),
  PartnerMissionDef('flow_supplies', 'flow', 'support', 'easy', 'cart'),
  PartnerMissionDef('flow_iron_meal', 'flow', 'care', 'medium', 'utensils'),
  PartnerMissionDef('flow_patience', 'flow', 'support', 'medium', 'heart'),
  PartnerMissionDef('flow_rest', 'flow', 'care', 'medium', 'moon'),
  PartnerMissionDef('flow_massage', 'flow', 'care', 'medium', 'heart'),
  PartnerMissionDef('flow_movie', 'flow', 'surprise', 'easy', 'star'),
  PartnerMissionDef('flow_active', 'flow', 'surprise', 'medium', 'sun'),
  PartnerMissionDef('bump_vitamins', 'bump', 'support', 'easy', 'pill'),
  PartnerMissionDef('bump_water', 'bump', 'care', 'easy', 'droplets'),
  PartnerMissionDef('bump_feet', 'bump', 'care', 'medium', 'heart'),
  PartnerMissionDef('bump_talk_baby', 'bump', 'support', 'easy', 'baby'),
  PartnerMissionDef('bump_appointment', 'bump', 'support', 'hard', 'stethoscope'),
  PartnerMissionDef('bump_read', 'bump', 'support', 'easy', 'book'),
  PartnerMissionDef('bump_heavy', 'bump', 'care', 'medium', 'home'),
  PartnerMissionDef('bump_photo', 'bump', 'surprise', 'easy', 'camera'),
  PartnerMissionDef('bump_snack', 'bump', 'care', 'easy', 'utensils'),
  PartnerMissionDef('bump_pillows', 'bump', 'care', 'easy', 'moon'),
  PartnerMissionDef('late_bag', 'bump_late', 'support', 'medium', 'bag'),
  PartnerMissionDef('late_route', 'bump_late', 'support', 'medium', 'car'),
  PartnerMissionDef('late_fuel', 'bump_late', 'support', 'easy', 'car'),
  PartnerMissionDef('late_car_seat', 'bump_late', 'support', 'hard', 'baby'),
  PartnerMissionDef('late_contractions', 'bump_late', 'support', 'easy', 'stethoscope'),
  PartnerMissionDef('late_phone', 'bump_late', 'support', 'easy', 'phone'),
  PartnerMissionDef('late_birth_plan', 'bump_late', 'support', 'medium', 'book'),
  PartnerMissionDef('nb_night_feed', 'newborn', 'care', 'hard', 'moon'),
  PartnerMissionDef('nb_diapers', 'newborn', 'care', 'medium', 'baby'),
  PartnerMissionDef('nb_bath', 'newborn', 'care', 'medium', 'droplets'),
  PartnerMissionDef('nb_skin', 'newborn', 'support', 'easy', 'heart'),
  PartnerMissionDef('nb_visitors', 'newborn', 'support', 'medium', 'home'),
  PartnerMissionDef('nb_meal', 'newborn', 'care', 'easy', 'utensils'),
  PartnerMissionDef('nb_feelings', 'newborn', 'support', 'easy', 'message'),
  PartnerMissionDef('nb_nap', 'newborn', 'care', 'medium', 'moon'),
  PartnerMissionDef('mm_play', 'mommy', 'support', 'easy', 'smile'),
  PartnerMissionDef('mm_bedtime', 'mommy', 'care', 'medium', 'moon'),
  PartnerMissionDef('mm_stroll', 'mommy', 'care', 'easy', 'footprints'),
  PartnerMissionDef('mm_baby_food', 'mommy', 'care', 'medium', 'utensils'),
  PartnerMissionDef('mm_me_time', 'mommy', 'surprise', 'medium', 'sun'),
  PartnerMissionDef('mm_photo', 'mommy', 'surprise', 'easy', 'camera'),
  PartnerMissionDef('mm_read', 'mommy', 'support', 'easy', 'book'),
  PartnerMissionDef('mm_date', 'mommy', 'surprise', 'hard', 'star'),
];

/// `ICONS` (lucide names of usePartnerMissions).
const Map<String, AIconData> kMissionIcons = {
  'coffee': AIcons.coffee,
  'heart': AIcons.heart,
  'home': AIcons.house,
  'calendar': AIcons.calendar,
  'droplets': AIcons.droplets,
  'moon': AIcons.moon,
  'smile': AIcons.smile,
  'utensils': AIcons.utensils,
  'music': AIcons.music,
  'stethoscope': AIcons.stethoscope,
  'baby': AIcons.baby,
  'cart': AIcons.shoppingCart,
  'car': AIcons.car,
  'book': AIcons.book,
  'camera': AIcons.camera,
  'sun': AIcons.sun,
  'gift': AIcons.gift,
  'flower': AIcons.flower2,
  'star': AIcons.star,
  'message': AIcons.messageCircle,
  'bag': AIcons.briefcase,
  'phone': AIcons.phone,
  'pill': AIcons.pill,
  'footprints': AIcons.footprints,
};

/// `MissionStageInput`.
typedef MissionStageInput = ({String? lifeStage, int pregnancyWeek, int babyAgeDays});

const MissionStageInput kNoMissionStage = (lifeStage: null, pregnancyWeek: 0, babyAgeDays: 0);

/// Pools that fit the woman's stage, most specific first.
List<MissionPool> missionPoolsFor(MissionStageInput input) {
  final lifeStage = input.lifeStage;
  if (lifeStage == 'flow') return const ['flow'];
  if (lifeStage == 'mommy') return input.babyAgeDays < 90 ? const ['newborn', 'mommy'] : const ['mommy'];
  if (lifeStage == 'bump') return input.pregnancyWeek >= 32 ? const ['bump_late', 'bump'] : const ['bump'];
  return const [];
}

double Function() _seededRandom(int seed) {
  var s = seed;
  return () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

List<T> _shuffle<T>(List<T> items, double Function() random) {
  final out = [...items];
  for (var i = out.length - 1; i > 0; i--) {
    final j = (random() * (i + 1)).floor();
    final t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/// `missionDaySeed(date)` = yyyymmdd (local).
int missionDaySeed([DateTime? date]) {
  final d = date ?? DomainClock.now();
  return d.year * 10000 + d.month * 100 + d.day;
}

/// Seven missions for the day: four from the stage (late pregnancy first when it applies) and the rest from the
/// general pool. Same day + same stage gives the same list.
List<PartnerMissionDef> pickDailyMissions(MissionStageInput input, [DateTime? date, int count = 7]) {
  final random = _seededRandom(missionDaySeed(date));
  final pools = missionPoolsFor(input);
  final staged = [for (final pool in pools) ..._shuffle(kPartnerMissions.where((x) => x.pool == pool).toList(), random)];
  final general = _shuffle(kPartnerMissions.where((x) => x.pool == 'any').toList(), random);
  final fromStage = staged.take(pools.isNotEmpty ? 4 : 0);
  return [...fromStage, ...general].take(count).toList();
}

/// Stored mission id: date + key, so a completion belongs to exactly one day's mission.
String dailyMissionId(String key, [DateTime? date]) => 'daily-${missionDaySeed(date)}-$key';

/// `loadPartnerMissionText(language)`: own language, else English, else Azerbaijani.
Map<String, List<String>> partnerMissionText(String language) =>
    kPartnerMissionText[language] ?? kPartnerMissionText['en'] ?? kPartnerMissionText['az']!;

/// `Mission` of usePartnerMissions.
@immutable
class Mission {
  const Mission({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.points,
    required this.isCompleted,
    required this.category,
    required this.difficulty,
  });
  final String id;
  final String title;
  final String description;
  final AIconData icon;
  final int points;
  final bool isCompleted;
  final MissionCategory category;
  final MissionDifficulty difficulty;
}

/// The day's missions for [stage] in [language] with their completion.
List<Mission> buildDailyMissions(MissionStageInput stage, String language, Set<String> completed, [DateTime? date]) {
  final text = partnerMissionText(language);
  return [
    for (final def in pickDailyMissions(stage, date))
      Mission(
        id: dailyMissionId(def.key, date),
        title: text[def.key]?.elementAtOrNull(0) ?? '',
        description: text[def.key]?.elementAtOrNull(1) ?? '',
        icon: kMissionIcons[def.icon] ?? AIcons.heart,
        points: def.points,
        isCompleted: completed.contains(dailyMissionId(def.key, date)),
        category: def.category,
        difficulty: def.difficulty,
      ),
  ];
}

/// Level from the total points (50 per level).
({int level, int pointsToNextLevel, double levelProgress}) missionLevel(int totalPoints) => (
      level: totalPoints ~/ 50 + 1,
      pointsToNextLevel: 50 - totalPoints % 50,
      levelProgress: (totalPoints % 50) / 50 * 100,
    );

@immutable
class PartnerMissionsState {
  const PartnerMissionsState({this.completedIds = const {}, this.dbPoints = 0, this.loading = true});
  final Set<String> completedIds;
  final int dbPoints;
  final bool loading;

  int get totalPoints => dbPoints;
  int get level => missionLevel(dbPoints).level;
  int get pointsToNextLevel => missionLevel(dbPoints).pointsToNextLevel;
  double get levelProgress => missionLevel(dbPoints).levelProgress;
  int get completedCount => completedIds.length;

  PartnerMissionsState copyWith({Set<String>? completedIds, int? dbPoints, bool? loading}) =>
      PartnerMissionsState(completedIds: completedIds ?? this.completedIds, dbPoints: dbPoints ?? this.dbPoints, loading: loading ?? this.loading);
}

/// The completion half of `usePartnerMissions()`.
final partnerMissionsProvider = NotifierProvider.autoDispose<PartnerMissionsController, PartnerMissionsState>(PartnerMissionsController.new);

class PartnerMissionsController extends Notifier<PartnerMissionsState> {
  String? _userId;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  PartnerMissionsState build() {
    _userId = ref.watch(authUserProvider)?.id;
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchMissionState());
    });
    return const PartnerMissionsState();
  }

  /// `fetchMissionState()` (`refetch`).
  Future<void> fetchMissionState() async {
    final userId = _userId;
    if (userId == null) {
      state = state.copyWith(loading: false);
      return;
    }
    try {
      final rows = await _backend.select('partner_missions', columns: 'mission_id, is_completed, points_earned', eq: {'user_id': userId});
      if (!ref.mounted) return;
      final completed = {for (final m in rows) if (m['is_completed'] == true && m['mission_id'] is String) m['mission_id'] as String};
      final total = rows.fold<int>(0, (sum, m) => sum + (m['points_earned'] is num ? (m['points_earned'] as num).toInt() : 0));
      state = state.copyWith(completedIds: completed, dbPoints: total);
    } catch (error) {
      debugPrint('Error fetching missions: $error');
    } finally {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  /// `toggleMission(missionId, points)`: optimistic, reverted on failure; null on failure / signed out.
  Future<({int pointsEarned, bool completed})?> toggleMission(String missionId, [int? missionPoints]) async {
    final userId = _userId;
    if (userId == null) return null;
    final currentlyCompleted = state.completedIds.contains(missionId);
    final newCompleted = !currentlyCompleted;
    final points = (missionPoints == null || missionPoints == 0) ? 10 : missionPoints;
    Set<String> withId(bool on) => on ? {...state.completedIds, missionId} : ({...state.completedIds}..remove(missionId));
    state = state.copyWith(
      completedIds: withId(newCompleted),
      dbPoints: newCompleted ? state.dbPoints + points : math.max(0, state.dbPoints - points),
    );
    try {
      await _backend.upsert(
          'partner_missions',
          {
            'user_id': userId,
            'mission_id': missionId,
            'is_completed': newCompleted,
            'completed_at': newCompleted ? DateTime.now().toUtc().toIso8601String() : null,
            'points_earned': newCompleted ? points : 0,
          },
          onConflict: 'user_id,mission_id');
      return (pointsEarned: newCompleted ? points : 0, completed: newCompleted);
    } catch (error) {
      debugPrint('Error toggling mission: $error');
      if (ref.mounted) {
        state = state.copyWith(
          completedIds: withId(currentlyCompleted),
          dbPoints: newCompleted ? math.max(0, state.dbPoints - points) : state.dbPoints + points,
        );
      }
      return null;
    }
  }
}

/// `usePartnerMissions(stage)`: the day's missions for the stage + the shared completion state.
@immutable
class PartnerMissionsView {
  const PartnerMissionsView({required this.missions, required this.state});
  final List<Mission> missions;
  final PartnerMissionsState state;
  bool get loading => state.loading;
}

final partnerMissionsViewProvider = Provider.autoDispose.family<PartnerMissionsView, MissionStageInput>((ref, stage) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final state = ref.watch(partnerMissionsProvider);
  final lang = language.isEmpty ? 'az' : language;
  return PartnerMissionsView(missions: buildDailyMissions(stage, lang, state.completedIds), state: state);
});
