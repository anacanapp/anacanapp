// Ported from: src/data/play-together/play-i18n.test.ts, src/lib/play-together.test.ts (the content cases that read
//              the game text and the book catalogue: steps, materials, no long dashes, real book ids, books of the
//              age group; the logic cases live in test/domain/play_together)
//
// Reads the bundled copies (app/assets/play_together, app/assets/books) and checks them against the React sources.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/domain/play_together/play_together.dart';
import 'package:anacan/features/tools/hub/hub_copy.g.dart' show kPlayContentLanguages, kPlayTileText;
import 'package:anacan/features/tools/play_together/play_content.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> readJson(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

List<String> flat(Object? v) => v is String
    ? [v]
    : v is List
        ? [for (final x in v) ...flat(x)]
        : v is Map
            ? [for (final x in v.values) ...flat(x)]
            : const [];

String holes(String s) => (RegExp(r'\{[a-z]+\}').allMatches(s).map((m) => m[0]!).toList()..sort()).join(',');

void main() {
  final az = readJson('assets/play_together/az.json');
  final azUi = (az['ui'] as Map).cast<String, Object?>();
  final azGames = [for (final g in az['games'] as List) PlayGame.fromJson((g as Map).cast<String, Object?>())];
  final catalog = BookCatalog([for (final b in jsonDecode(File('assets/books/catalog.json').readAsStringSync()) as List) Book.fromJson((b as Map).cast<String, Object?>())]);

  group('play-together content', () {
    test('has unique ids, valid ages, steps and only real book ids', () {
      final ids = <String>{};
      for (final g in azGames) {
        expect(ids.add(g.id), true, reason: g.id);
        expect(g.minM, lessThan(g.maxM));
        expect(playCategories, contains(g.cat));
        expect(g.steps.length, greaterThanOrEqualTo(3));
        expect(g.materials, isNotEmpty);
        for (final b in g.books) {
          expect(catalog.findBook(b), isNotNull, reason: '${g.id} -> $b');
        }
        // House rule: no long dashes in user-facing text.
        expect(jsonEncode((az['games'] as List).firstWhere((x) => x['id'] == g.id)), isNot(contains('—')));
      }
    });
  });

  group('play-together logic', () {
    test('recommends books of the age group with hands-on pages first', () {
      final books = catalog.booksForAgeGroup(42);
      expect(books, isNotEmpty);
      expect(books.every((b) => b.age == '3y'), true);
      for (var i = 1; i < books.length; i++) {
        expect(handsOnSkills(books[i - 1]).length, greaterThanOrEqualTo(handsOnSkills(books[i]).length));
      }
    });
  });

  group('Uşaqla oyun translations', () {
    final langs = Directory('assets/play_together')
        .listSync()
        .map((f) => f.uri.pathSegments.last)
        .where((n) => RegExp(r'^[a-z]{2}\.json$').hasMatch(n))
        .map((n) => n.substring(0, 2))
        .where((l) => l != 'az')
        .toList()
      ..sort();

    test('tile language list matches the loaders', () {
      expect([...kPlayContentLanguages]..sort(), [...kPlayLanguageLoaders]..sort());
    });

    test('every registered language has a file', () {
      for (final lang in kPlayLanguageLoaders) {
        if (lang != 'az') expect(langs, contains(lang), reason: lang);
      }
    });

    for (final lang in langs) {
      group(lang, () {
        final loc = readJson('assets/play_together/$lang.json');
        test('has every UI string with the same placeholders', () {
          void walk(Object? src, Object? dst, String path) {
            if (src is String) {
              expect(dst, isA<String>(), reason: path);
              expect((dst! as String).trim(), isNotEmpty, reason: path);
              expect(holes(dst as String), holes(src), reason: path);
              return;
            }
            final map = src! as Map;
            for (final k in map.keys) {
              walk(map[k], dst is Map ? dst[k] : null, '$path.$k');
            }
          }

          walk(azUi, loc['ui'], 'ui');
          final ui = loc['ui'] as Map;
          expect(kPlayTileText[lang], (name: ui['tileName'], description: ui['tileDesc']), reason: 'tile.ts');
        });

        test('translates every game with the same shape', () {
          final games = loc['games'] as Map;
          expect(games.keys.toList()..sort(), azGames.map((g) => g.id).toList()..sort());
          for (final g in azGames) {
            final t = games[g.id] as Map;
            expect((t['materials'] as List).length, g.materials.length, reason: '${g.id}.materials');
            expect((t['steps'] as List).length, g.steps.length, reason: '${g.id}.steps');
            expect(t['tip'] != null && t['tip'] != '', g.tip != null && g.tip!.isNotEmpty, reason: '${g.id}.tip');
            expect(t['safety'] != null && t['safety'] != '', g.safety != null && g.safety!.isNotEmpty, reason: '${g.id}.safety');
            for (final s in flat(t)) {
              expect(s.trim(), isNotEmpty, reason: g.id);
            }
          }
        });

        test('has no long dashes and no Azerbaijani leftovers', () {
          // ə exists only in Azerbaijani (Kazakh/Kyrgyz Cyrillic use ә, a different letter): a leftover source string.
          final azOnly = RegExp('[əƏ]', unicode: true);
          for (final s in flat(loc)) {
            expect(s, isNot(contains('—')), reason: lang);
            expect(azOnly.hasMatch(s), false, reason: '$lang: $s');
          }
        });
      });
    }
  });

  group('bundled copies', () {
    test('the catalogue and covers equal the React sources (run gen_play_content.mjs when this fails)', () {
      expect(File('assets/books/catalog.json').readAsBytesSync(), File('../src/data/books/catalog.json').readAsBytesSync());
      for (final f in Directory('../public/books/covers').listSync().whereType<File>().where((f) => f.path.endsWith('.webp'))) {
        final name = f.uri.pathSegments.last;
        expect(File('assets/books/covers/$name').readAsBytesSync(), f.readAsBytesSync(), reason: name);
      }
      for (final b in catalog.books) {
        expect(File(bookCoverAsset(b.id)).existsSync(), true, reason: b.id);
      }
    });

    test('merges a locale over the Azerbaijani structure (a missing game keeps the source)', () {
      final en = mergePlayLocale('en', azGames, readJson('assets/play_together/en.json'));
      expect(en.games.map((g) => g.id), azGames.map((g) => g.id));
      expect(en.games.map((g) => g.books), azGames.map((g) => g.books));
      expect(en.games.first.title, isNot(azGames.first.title));
      final partial = mergePlayLocale('xx', azGames, {'ui': azUi, 'games': <String, Object?>{}});
      expect(partial.games.first.title, azGames.first.title);
    });
  });
}
