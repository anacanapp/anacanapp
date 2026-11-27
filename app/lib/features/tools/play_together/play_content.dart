// Ported from: src/data/play-together/index.ts (PLAY_LANGUAGE_LOADERS, mergePlayLocale, loadPlayContent),
//              src/data/play-together/types.ts, src/lib/books/catalog.ts (Book, BOOKS, findBook, bookCover),
//              src/lib/play-together.ts (booksForGame, handsOnSkills, booksForAgeGroup)
//
// Uşaqla oyun content per language: assets/play_together/az.json is the source (game structure, ages, book links
// and text) with the Azerbaijani UI strings; every other language file carries the UI strings and the text of every
// game by id; the structure stays the Azerbaijani one. Books (the PDF store) are Azerbaijani only, so book links
// show only for az. The book catalogue is assets/books/catalog.json (src/data/books/catalog.json) with covers in
// assets/books/covers/<id>.webp. All files come from gen_play_content.mjs.
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/js_compat.dart' show jsSorted;
import '../../../domain/play_together/play_together.dart';
import '../hub/hub_copy.dart' show hasPlayContent;
import '../hub/hub_copy.g.dart' show kPlayContentLanguages;

// ── lib/books/catalog.ts ──

/// `Book` of the PDF book catalogue.
class Book {
  const Book({required this.id, required this.age, required this.topic, required this.title, required this.subtitle, required this.about, required this.skills, required this.pages});
  final String id;

  /// '6m' | '1y' … '6y'.
  final String age;
  final String topic;
  final String title;
  final String subtitle;
  final String about;
  final List<String> skills;
  final num pages;

  factory Book.fromJson(Map<String, Object?> j) => Book(
        id: '${j['id']}',
        age: '${j['age']}',
        topic: '${j['topic']}',
        title: '${j['title'] ?? ''}',
        subtitle: '${j['subtitle'] ?? ''}',
        about: '${j['about'] ?? ''}',
        skills: [for (final s in (j['skills'] as List? ?? const [])) '$s'],
        pages: j['pages'] as num? ?? 0,
      );
}

/// `BOOKS` with `findBook(id)`.
class BookCatalog {
  BookCatalog(this.books) : _byId = {for (final b in books) b.id: b};
  final List<Book> books;
  final Map<String, Book> _byId;

  Book? findBook(String id) => _byId[id];

  /// `booksForGame(game)`: the game's own links, only books that exist in the catalogue.
  List<Book> booksForGame(PlayGame game) => [for (final id in game.books) ?_byId[id]];

  /// `booksForAgeGroup(months)`: books of the child's age group, hands-on first (stable order).
  List<Book> booksForAgeGroup(num months) {
    final band = bandForMonths(months < playMinMonths ? playMinMonths : months);
    final list = books.where((b) => b.age == band).toList();
    return jsSorted(list, (Book a, Book b) => handsOnSkills(b).length - handsOnSkills(a).length);
  }
}

/// `bookCover(id)` (`/books/covers/<id>.webp`) as a bundled asset.
String bookCoverAsset(String id) => 'assets/books/covers/$id.webp';

/// Book page activities a parent can expect, from the catalogue skills (cut/paste, colouring, mazes...).
final RegExp _handsOn = RegExp('kəs|yapış|rəngləmə|boya|labirint|izlə|yaz|birləşdir', caseSensitive: false, unicode: true);

/// `handsOnSkills(book)`.
List<String> handsOnSkills(Book book) => book.skills.where(_handsOn.hasMatch).toList();

// ── data/play-together ──

/// `PlayContent`: the merged games and the UI strings (`PlayUiText`, nested maps kept as JSON).
class PlayContent {
  const PlayContent({required this.language, required this.ui, required this.games});
  final String language;
  final Map<String, Object?> ui;
  final List<PlayGame> games;
}

/// `PLAY_LANGUAGE_LOADERS` keys.
const List<String> kPlayLanguageLoaders = kPlayContentLanguages;

Map<String, Object?> _map(Object? v) => v is Map ? v.cast<String, Object?>() : const {};

/// `mergePlayLocale(language, locale)` over the Azerbaijani structure ([azGames]); a missing game text keeps the
/// source.
PlayContent mergePlayLocale(String language, List<PlayGame> azGames, Map<String, Object?> locale) {
  final texts = _map(locale['games']);
  final games = [
    for (final g in azGames)
      () {
        final t = texts[g.id];
        if (t is! Map) return g;
        final m = t.cast<String, Object?>();
        return PlayGame(
          id: g.id,
          emoji: g.emoji,
          cat: g.cat,
          minM: g.minM,
          maxM: g.maxM,
          minutes: g.minutes,
          title: '${m['title'] ?? ''}',
          why: '${m['why'] ?? ''}',
          materials: [for (final s in (m['materials'] as List? ?? const [])) '$s'],
          steps: [for (final s in (m['steps'] as List? ?? const [])) '$s'],
          tip: m['tip'] as String?,
          safety: m['safety'] as String?,
          books: g.books,
        );
      }(),
  ];
  return PlayContent(language: language, ui: _map(locale['ui']), games: games);
}

/// Reads one bundled file (tests read the files from disk).
typedef PlayAssetLoader = Future<String> Function(String assetPath);

final playAssetLoaderProvider = Provider<PlayAssetLoader>((ref) => rootBundle.loadString, name: 'playAssetLoaderProvider');

/// `{ ui: PLAY_UI_AZ, games: PLAY_GAMES_AZ }`.
final playSourceProvider = FutureProvider<({Map<String, Object?> ui, List<PlayGame> games})>((ref) async {
  final raw = _map(jsonDecode(await ref.watch(playAssetLoaderProvider)('assets/play_together/az.json')));
  return (
    ui: _map(raw['ui']),
    games: [for (final g in (raw['games'] as List? ?? const [])) PlayGame.fromJson(_map(g))],
  );
}, name: 'playSourceProvider');

/// `loadPlayContent(language)`: an unknown language loads Azerbaijani; a failed load falls back to Azerbaijani.
final playContentProvider = FutureProvider.family<PlayContent, String>((ref, language) async {
  final src = await ref.watch(playSourceProvider.future);
  final lang = hasPlayContent(language) ? language : 'az';
  final az = mergePlayLocale('az', src.games, {'ui': src.ui, 'games': const <String, Object?>{}});
  if (lang == 'az') return az;
  try {
    final loc = _map(jsonDecode(await ref.read(playAssetLoaderProvider)('assets/play_together/$lang.json')));
    return mergePlayLocale(lang, src.games, loc);
  } catch (_) {
    return az;
  }
}, name: 'playContentProvider');

/// `BOOKS` (`src/data/books/catalog.json`).
final bookCatalogProvider = FutureProvider<BookCatalog>((ref) async {
  final raw = jsonDecode(await ref.watch(playAssetLoaderProvider)('assets/books/catalog.json'));
  return BookCatalog([for (final b in (raw as List)) Book.fromJson(_map(b))]);
}, name: 'bookCatalogProvider');
