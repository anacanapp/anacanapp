// Ported from: src/components/games/iki-dost/state.ts (pure parts; storage in ../persistence/storage.dart)
library;

import 'dart:math' as math;

import '../../common/engine/json_object.dart';
import 'engine.dart';

const int friendsPathLimit = 320;
const int friendsHintLimit = 3;

extension type FriendsProfile(JsonMap json) {
  JsonMap get progress => asMap(json['progress']);
  int get unlocked => (progress['unlocked'] as num).toInt();
  num get totalRescues => progress['totalRescues'] as num;
  num get bestScore => progress['bestScore'] as num;
  JsonMap get levels => asMap(progress['levels']);
  FriendsRound? get round => json['round'] is Map ? FriendsRound(asMap(json['round'])) : null;
  FriendsProfile withRound(FriendsRound? round) => FriendsProfile({...json, 'round': round?.json});
}

extension type FriendsRound(JsonMap json) {
  int get level => (json['level'] as num).toInt();
  List<String> get path => (json['path'] as List).cast<String>();
  int get moves => (json['moves'] as num).toInt();
  int get hints => (json['hints'] as num).toInt();
  int get undos => (json['undos'] as num).toInt();
  bool get awarded => json['awarded'] == true;
  FriendsRound copyWith(JsonMap changes) => FriendsRound({...json, ...changes});
}

FriendsProfile createFriendsProfile() => FriendsProfile({
      'schema': 'anacan-two-friends-profile-v1',
      'revision': twoFriendsRevision,
      'progress': {'unlocked': 1, 'totalRescues': 0, 'bestScore': 0, 'levels': <String, Object?>{}},
      'round': null,
    });

FriendsRound createFriendsRound(int level) =>
    FriendsRound({'level': level, 'path': <Object?>[], 'moves': 0, 'hints': 0, 'undos': 0, 'awarded': false});

({int stars, int score}) friendsResult(FriendsLevel level, FriendsRound round) {
  final stars = round.hints == 0 && round.moves <= level.par
      ? 3
      : round.hints <= 1 && round.moves <= level.par + 8
          ? 2
          : 1;
  return (
    stars: stars,
    score: math.max(100, 500 + stars * 150 + level.chapter * 100 - math.max(0, round.moves - level.par) * 10 - round.hints * 30),
  );
}

/// Returns the same instance when nothing is awarded (React StrictMode-safe, like the TS).
FriendsProfile completeFriendsLevel(FriendsProfile profile, FriendsLevel level) {
  final round = profile.round;
  if (round == null || round.level != level.level || round.awarded || !friendsSolved(level, replayFriends(level, round.path).state)) {
    return profile;
  }
  final result = friendsResult(level, round);
  final previous = profile.levels['${level.level}'] as Map?;
  final firstWin = previous == null;
  return FriendsProfile({
    ...profile.json,
    'round': round.copyWith({'awarded': true}).json,
    'progress': {
      ...profile.progress,
      'unlocked': math.max(profile.unlocked, math.min(twoFriendsLevels, level.level + 1)),
      'totalRescues': profile.totalRescues + (firstWin ? 2 : 0),
      'bestScore': math.max(profile.bestScore, result.score),
      'levels': {
        ...profile.levels,
        '${level.level}': {
          'stars': math.max((previous?['stars'] as num?) ?? 0, result.stars),
          'score': math.max((previous?['score'] as num?) ?? 0, result.score),
        },
      },
    },
  });
}
