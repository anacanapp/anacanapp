// Ported from: src/components/games/iki-dost/model.ts, src/components/games/iki-dost/engine.ts,
// src/components/games/iki-dost/levels.ts, src/components/games/iki-dost/friends.worker.ts, src/components/games/iki-dost/hints.ts
library;

import 'dart:convert';

import '../../common/engine/js.dart';

const String twoFriendsId = 'iki-dost';
const String twoFriendsRevision = 'friends-202610-v1';
const int twoFriendsLevels = 40;
const List<String> friendNames = ['Ritm', 'Tumurcuq'];
const List<String> friendDirections = ['up', 'right', 'down', 'left'];

/// 'same' | 'mirror-x' | 'opposite' | 'mirror-y'
typedef FriendControl = String;

class FriendWorld {
  const FriendWorld(this.rows, this.start, this.home);
  final List<String> rows;
  final int start;
  final int home;
  int get width => rows[0].length;
  Map<String, Object?> toJson() => {'rows': rows, 'start': start, 'home': home};
  static FriendWorld fromJson(Map<String, Object?> json) =>
      FriendWorld((json['rows'] as List).cast<String>(), (json['start'] as num).toInt(), (json['home'] as num).toInt());
}

class FriendsLevel {
  FriendsLevel({
    required this.revision,
    required this.level,
    required this.chapter,
    required this.worlds,
    required this.control,
    required this.plateCounts,
    required this.par,
    required this.solution,
  });
  final String revision;
  final int level;
  final int chapter;
  final List<FriendWorld> worlds;
  final FriendControl control;
  final List<int> plateCounts;
  final int par;
  final List<String> solution;

  Map<String, Object?> toJson() => {
        'schema': 'anacan-two-friends-level-v1', 'revision': revision, 'level': level, 'chapter': chapter,
        'worlds': [for (final world in worlds) world.toJson()], 'control': control, 'plateCounts': plateCounts, 'par': par, 'solution': solution,
      };

  static FriendsLevel fromJson(Map<String, Object?> json) => FriendsLevel(
        revision: json['revision'] as String,
        level: (json['level'] as num).toInt(),
        chapter: (json['chapter'] as num).toInt(),
        worlds: [for (final world in json['worlds'] as List) FriendWorld.fromJson((world as Map).cast())],
        control: json['control'] as String,
        plateCounts: [for (final count in json['plateCounts'] as List) (count as num).toInt()],
        par: (json['par'] as num).toInt(),
        solution: (json['solution'] as List).cast<String>(),
      );
}

/// The published catalog (`catalog.json`, asset `assets/games/iki_dost/catalog.json`).
class FriendsCatalog {
  FriendsCatalog(this.revision, this.levels);
  final String revision;
  final List<FriendsLevel> levels;
  static FriendsCatalog parse(String text) {
    final json = (jsonDecode(text) as Map).cast<String, Object?>();
    return FriendsCatalog(json['revision'] as String, [for (final level in json['levels'] as List) FriendsLevel.fromJson((level as Map).cast())]);
  }

  /// `friendsLevel(level)`.
  FriendsLevel level(int level) {
    if (level < 1 || level > twoFriendsLevels || revision != twoFriendsRevision) throw const GameError('TWO_FRIENDS_LEVEL_INVALID');
    return levels[level - 1];
  }
}

class FriendsState {
  const FriendsState(this.positions, this.keys);
  final List<int> positions;
  final int keys;
  Map<String, Object?> toJson() => {'positions': positions, 'keys': keys};
  static FriendsState fromJson(Map<String, Object?> json) =>
      FriendsState([for (final p in json['positions'] as List) (p as num).toInt()], (json['keys'] as num).toInt());
}

class FriendsMove {
  const FriendsMove(this.state, this.moved, this.changed, this.lost, this.won, this.collectedKeys, this.openedDoors);
  final FriendsState state;
  final List<bool> moved;
  final bool changed;
  final bool lost;
  final bool won;
  final int collectedKeys;
  final int openedDoors;
  Map<String, Object?> toJson() => {
        'state': state.toJson(), 'moved': moved, 'changed': changed, 'lost': lost, 'won': won, 'collectedKeys': collectedKeys,
        'openedDoors': openedDoors,
      };
}

String? friendCell(FriendWorld world, int position) {
  final width = world.width;
  final row = position ~/ width;
  if (position < 0 || row >= world.rows.length) return null;
  final text = world.rows[row];
  final column = position % width;
  return column < text.length ? text[column] : null;
}

({int row, int column}) friendPosition(FriendWorld world, int position) => (row: position ~/ world.width, column: position % world.width);

const Map<String, List<int>> _deltas = {'up': [-1, 0], 'right': [0, 1], 'down': [1, 0], 'left': [0, -1]};

String friendDirection(String direction, FriendControl control) {
  if (control == 'opposite') return friendDirections[(friendDirections.indexOf(direction) + 2) % 4];
  if (control == 'mirror-x' && (direction == 'left' || direction == 'right')) return direction == 'left' ? 'right' : 'left';
  if (control == 'mirror-y' && (direction == 'up' || direction == 'down')) return direction == 'up' ? 'down' : 'up';
  return direction;
}

FriendsState initialFriendsState(FriendsLevel level) => FriendsState([level.worlds[0].start, level.worlds[1].start], 0);
List<bool> friendsAtHome(FriendsLevel level, FriendsState state) =>
    [state.positions[0] == level.worlds[0].home, state.positions[1] == level.worlds[1].home];
bool friendsSolved(FriendsLevel level, FriendsState state) => friendsAtHome(level, state).every((home) => home);

int friendsPlateMask(FriendsLevel level, FriendsState state) {
  var mask = 0;
  for (var channel = 0; channel < 2; channel++) {
    final tile = channel == 0 ? 'a' : 'b';
    var held = 0;
    for (var side = 0; side < state.positions.length; side++) {
      if (friendCell(level.worlds[side], state.positions[side]) == tile) held++;
    }
    if (level.plateCounts[channel] > 0 && held >= level.plateCounts[channel]) mask |= 1 << channel;
  }
  return mask;
}

bool friendsDoorOpen(String? tile, FriendsState state, int plates) {
  if (tile == 'K' || tile == 'L') return state.keys & (tile == 'K' ? 1 : 2) != 0;
  if (tile == 'A' || tile == 'B') return plates & (tile == 'A' ? 1 : 2) != 0;
  return true;
}

FriendsMove moveFriends(FriendsLevel level, FriendsState state, String direction) {
  if (!friendDirections.contains(direction)) throw const GameError('TWO_FRIENDS_DIRECTION_INVALID');
  final plates = friendsPlateMask(level, state);
  final positions = <int>[
    for (var side = 0; side < state.positions.length; side++)
      () {
        final position = state.positions[side];
        final world = level.worlds[side];
        final at = friendPosition(world, position);
        final delta = _deltas[side == 0 ? direction : friendDirection(direction, level.control)]!;
        final r = at.row + delta[0], c = at.column + delta[1];
        if (r < 0 || r >= world.rows.length || c < 0 || c >= world.width) return position;
        final target = r * world.width + c, tile = friendCell(world, target);
        return tile == '#' || !friendsDoorOpen(tile, state, plates) ? position : target;
      }(),
  ];
  final moved = [for (var side = 0; side < positions.length; side++) positions[side] != state.positions[side]];
  final lost = [for (var side = 0; side < positions.length; side++) friendCell(level.worlds[side], positions[side]) == '!'].any((x) => x);
  var keys = state.keys;
  if (!lost) {
    for (var side = 0; side < positions.length; side++) {
      final tile = friendCell(level.worlds[side], positions[side]);
      keys |= tile == 'k' ? 1 : tile == 'l' ? 2 : 0;
    }
  }
  final next = FriendsState(positions, keys);
  final newPlates = friendsPlateMask(level, next);
  return FriendsMove(next, moved, moved.any((x) => x), lost, !lost && friendsSolved(level, next), keys & ~state.keys,
      (newPlates & ~plates) | (keys & ~state.keys));
}

final RegExp _worldRow = RegExp(r'^[#.SH!klKLabAB]+$');

FriendWorld readFriendWorld(List<String> rows) {
  if (rows.length < 3 || rows.length > 7 || rows[0].length < 3 || rows[0].length > 7 ||
      rows.any((row) => row.length != rows[0].length || !_worldRow.hasMatch(row))) {
    throw const GameError('TWO_FRIENDS_WORLD_INVALID');
  }
  final tiles = rows.join(), start = tiles.indexOf('S'), home = tiles.indexOf('H');
  if (start < 0 || home < 0 || start == home || start != tiles.lastIndexOf('S') || home != tiles.lastIndexOf('H')) {
    throw const GameError('TWO_FRIENDS_WORLD_ENDPOINTS_REQUIRED');
  }
  return FriendWorld(rows, start, home);
}

String friendsStateKey(FriendsState state) => '${state.positions[0]}:${state.positions[1]}:${state.keys}';

({FriendsState state, bool lost}) replayFriends(FriendsLevel level, List<Object?> path) {
  var state = initialFriendsState(level);
  var lost = false;
  for (final direction in path) {
    if (direction is! String) throw const GameError('TWO_FRIENDS_DIRECTION_INVALID');
    final move = moveFriends(level, state, direction);
    if (!move.changed || lost) throw const GameError('TWO_FRIENDS_SAVED_PATH_INVALID');
    state = move.state;
    lost = move.lost;
  }
  return (state: state, lost: lost);
}

class FriendsSolution {
  const FriendsSolution(this.path, this.visited, this.exhausted);
  final List<String>? path;
  final int visited;
  final bool exhausted;
  Map<String, Object?> toJson() => {'path': path, 'visited': visited, 'exhausted': exhausted};
}

FriendsSolution solveFriends(FriendsLevel level, [FriendsState? start, int budget = 12000]) {
  start ??= initialFriendsState(level);
  if (friendsSolved(level, start)) return const FriendsSolution([], 1, false);
  final queue = [start];
  final records = <String, ({String? previous, String? direction})>{friendsStateKey(start): (previous: null, direction: null)};
  for (var head = 0; head < queue.length; head++) {
    final state = queue[head], key = friendsStateKey(state);
    for (final direction in friendDirections) {
      final move = moveFriends(level, state, direction), nextKey = friendsStateKey(move.state);
      if (!move.changed || move.lost || records.containsKey(nextKey)) continue;
      records[nextKey] = (previous: key, direction: direction);
      if (move.won) {
        final path = <String>[];
        var current = nextKey;
        while (records[current]?.previous != null) {
          final record = records[current]!;
          path.add(record.direction!);
          current = record.previous!;
        }
        return FriendsSolution(path.reversed.toList(), records.length, false);
      }
      if (records.length >= budget) return FriendsSolution(null, records.length, true);
      queue.add(move.state);
    }
  }
  return FriendsSolution(null, records.length, false);
}

/// Hint worker entry point (`friends.worker.ts`) for `Isolate.run`: the next direction or null.
String? friendsHintJob(({Map<String, Object?> level, Map<String, Object?> state}) request) {
  final path = solveFriends(FriendsLevel.fromJson(request.level), FriendsState.fromJson(request.state)).path;
  return path == null || path.isEmpty ? null : path.first;
}
