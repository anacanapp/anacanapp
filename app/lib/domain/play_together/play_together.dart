// Ported from: src/lib/play-together.ts (book catalogue helpers excluded: booksForGame / handsOnSkills /
// booksForAgeGroup depend on src/lib/books/catalog.ts, not ported yet)
//
// Uşaqla oyun: screen-free games for a parent and child. Progress (games played, favourites) stays on the phone,
// per account, bounded; the stored JSON shape is unchanged.

import 'dart:convert';
import 'dart:math' as math;

import '../js_compat.dart';

/// 'craft' | 'move' | 'pretend' | 'kitchen' | 'calm' | 'outdoor' | 'words'
typedef PlayCategory = String;
const List<PlayCategory> playCategories = ['craft', 'move', 'pretend', 'kitchen', 'calm', 'outdoor', 'words'];

class PlayGame {
  const PlayGame({
    required this.id,
    this.emoji = '',
    required this.cat,
    required this.minM,
    required this.maxM,
    required this.minutes,
    this.title = '',
    this.why = '',
    this.materials = const [],
    this.steps = const [],
    this.tip,
    this.safety,
    this.books = const [],
  });
  final String id;
  final String emoji;
  final PlayCategory cat;
  final num minM;
  final num maxM;
  final num minutes;
  final String title;
  final String why;
  final List<String> materials;
  final List<String> steps;
  final String? tip;
  final String? safety;
  final List<String> books;

  factory PlayGame.fromJson(Map<String, Object?> j) => PlayGame(
        id: j['id']! as String,
        emoji: (j['emoji'] ?? '') as String,
        cat: j['cat']! as String,
        minM: j['minM']! as num,
        maxM: j['maxM']! as num,
        minutes: j['minutes']! as num,
        title: (j['title'] ?? '') as String,
        why: (j['why'] ?? '') as String,
        materials: ((j['materials'] ?? const []) as List).cast<String>(),
        steps: ((j['steps'] ?? const []) as List).cast<String>(),
        tip: j['tip'] as String?,
        safety: j['safety'] as String?,
        books: ((j['books'] ?? const []) as List).cast<String>(),
      );
}

/// Manual age bands; value = months used for filtering.
const List<({String id, int months})> playAgeBands = [
  (id: '6m', months: 8),
  (id: '1y', months: 18),
  (id: '2y', months: 30),
  (id: '3y', months: 42),
  (id: '4y', months: 54),
  (id: '5y', months: 66),
  (id: '6y', months: 80),
];

/// '6m' | '1y' … '6y'
typedef PlayAgeBand = String;

PlayAgeBand bandForMonths(num months) {
  if (months < 12) return '6m';
  final years = math.min(6, (months / 12).floor());
  return '${years}y';
}

int monthsForBand(PlayAgeBand band) {
  for (final b in playAgeBands) {
    if (b.id == band) return b.months;
  }
  return 30;
}

const int playMinMonths = 6;
const int playMaxMonths = 108;

List<PlayGame> gamesForAge(List<PlayGame> games, num months) {
  final age = math.max(playMinMonths, math.min(playMaxMonths - 1, months.floor()));
  return games.where((g) => g.minM <= age && age < g.maxM).toList();
}

/// 'none' | 'hour' | 'family' (WHO 2019 under 5, AAP).
String screenGuideFor(num months) => months < 24 ? 'none' : months < 60 ? 'hour' : 'family';

/// Up to [count] games for today, from different categories where possible; games played today go last.
List<PlayGame> todaysPicks(List<PlayGame> games, String seed, Set<String> playedToday, [int count = 3]) {
  final order = jsSorted(games, (PlayGame a, PlayGame b) => fnv1a32('$seed|${a.id}') - fnv1a32('$seed|${b.id}'));
  final fresh = order.where((g) => !playedToday.contains(g.id)).toList();
  final picks = <PlayGame>[];
  final cats = <String>{};
  for (final g in fresh) {
    if (picks.length < count && !cats.contains(g.cat)) {
      picks.add(g);
      cats.add(g.cat);
    }
  }
  for (final g in [...fresh, ...order]) {
    if (picks.length < count && !picks.contains(g)) picks.add(g);
  }
  return picks;
}

// ── Local progress ─────────────────────────────────────────────────────────────────────────────
class PlayLogEntry {
  const PlayLogEntry({required this.id, required this.day, required this.minutes});
  final String id;
  final String day;
  final num minutes;

  Map<String, Object?> toJson() => {'id': id, 'day': day, 'minutes': minutes};
}

class PlayState {
  const PlayState({this.log = const [], this.favs = const [], this.band});
  final List<PlayLogEntry> log;
  final List<String> favs;
  final PlayAgeBand? band;

  PlayState copyWith({List<PlayLogEntry>? log, List<String>? favs}) => PlayState(log: log ?? this.log, favs: favs ?? this.favs, band: band);

  Map<String, Object?> toJson() => {'log': [for (final e in log) e.toJson()], 'favs': favs, 'band': band};
}

const int _maxLog = 300;
const int _maxFavs = 60;

String playStateKey(String? userId) => 'anacan.play-together.v1.${userId == null || userId.isEmpty ? 'anon' : userId}';
PlayState emptyPlayState() => const PlayState();

String dayKey(DateTime date) => '${date.year}-${pad2(date.month)}-${pad2(date.day)}';

bool _isBand(Object? v) => playAgeBands.any((b) => b.id == v);

/// Parses stored state, dropping anything malformed and keeping the bounds.
PlayState sanitizePlayState(Object? raw) {
  if (raw is! Map) return emptyPlayState();
  final rawLog = raw['log'];
  final log = <PlayLogEntry>[];
  if (rawLog is List) {
    for (final e in rawLog) {
      if (e is! Map) continue;
      final id = e['id'], day = e['day'], minutes = e['minutes'];
      if (id is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(day is num ? jsNumberToString(day) : '$day')) continue;
      if (minutes is! num || !minutes.isFinite || minutes <= 0 || minutes > 240) continue;
      log.add(PlayLogEntry(id: id, day: day as String, minutes: minutes));
    }
  }
  final rawFavs = raw['favs'];
  final favs = rawFavs is List ? rawFavs.whereType<String>().toSet().take(_maxFavs).toList() : <String>[];
  return PlayState(log: log.skip(math.max(0, log.length - _maxLog)).toList(), favs: favs, band: _isBand(raw['band']) ? raw['band'] as String : null);
}

/// readPlayState on the stored text.
PlayState parsePlayState(String? stored) {
  try {
    return sanitizePlayState(jsonDecode(stored == null || stored.isEmpty ? 'null' : stored));
  } catch (_) {
    return emptyPlayState();
  }
}

/// writePlayState payload.
String serializePlayState(PlayState state) => jsonEncode(sanitizePlayState(state.toJson()).toJson());

PlayState logPlayed(PlayState state, ({String id, num minutes}) game, DateTime now) {
  final day = dayKey(now);
  if (state.log.any((e) => e.id == game.id && e.day == day)) return state;
  final log = [...state.log, PlayLogEntry(id: game.id, day: day, minutes: game.minutes)];
  return state.copyWith(log: log.skip(math.max(0, log.length - _maxLog)).toList());
}

PlayState unlogPlayed(PlayState state, String gameId, DateTime now) {
  final day = dayKey(now);
  return state.copyWith(log: state.log.where((e) => !(e.id == gameId && e.day == day)).toList());
}

PlayState toggleFav(PlayState state, String gameId) => state.copyWith(
      favs: state.favs.contains(gameId) ? state.favs.where((f) => f != gameId).toList() : [gameId, ...state.favs].take(_maxFavs).toList(),
    );

Set<String> playedOn(PlayState state, String day) => {for (final e in state.log) if (e.day == day) e.id};
num minutesOn(PlayState state, String day) => state.log.where((e) => e.day == day).fold<num>(0, (s, e) => s + e.minutes);

/// The last 7 days (oldest first) with the minutes played together each day.
List<({String day, num minutes, bool today})> weekStrip(PlayState state, DateTime now) => [
      for (var i = 6; i >= 0; i--)
        () {
          final day = dayKey(DateTime(now.year, now.month, now.day - i));
          return (day: day, minutes: minutesOn(state, day), today: i == 0);
        }(),
    ];

bool isPlayTileVisible({String? lifeStage, required bool hasContent, bool disabled = false, bool isAdmin = false}) =>
    !disabled && hasContent && (lifeStage == 'mommy' || isAdmin);
