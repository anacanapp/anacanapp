// Ported from: src/lib/tr.ts (mapRowTranslation fallback chains)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/content_packs/content_packs.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final fixture = jsonDecode(File('test/core/content_packs/fixtures/content_samples.json').readAsStringSync()) as Map<String, dynamic>;
  final samples = (fixture['rows'] as List).cast<Map<String, dynamic>>();
  final recipe = samples.firstWhere((sample) => sample['table'] == 'admin_recipes');
  final recipeRow = Map<String, dynamic>.from(recipe['row'] as Map);

  // A pack lookup backed by the real pack values of the fixture (keys computed by the Dart port).
  Object? packLookup(Map<String, dynamic> row, String field, String language) {
    final key = contentTranslationKey(row, field);
    for (final sample in samples) {
      final translations = sample['translations'][language] as Map?;
      if (translations == null) continue;
      for (final f in (sample['fields'] as List).cast<String>()) {
        if (sample['keys'][f] == key) return translations[f];
      }
    }
    return null;
  }

  Object? notReady(Map<String, dynamic> row, String field, String language) => null;

  test('pack languages use the source-bound pack translation (real rows)', () {
    for (final language in ['fr', 'ja', 'tk', 'ky', 'uk']) {
      final mapped = mapRowTranslation(recipeRow, language, ['title', 'ingredients'], lookup: packLookup)!;
      expect(mapped['title'], recipe['translations'][language]['title'], reason: language);
      expect(mapped['ingredients'], recipe['translations'][language]['ingredients'], reason: language);
      // idempotent projection into field_<lang>
      expect(mapped['title_$language'], mapped['title']);
    }
  });

  test('until a shard is ready ky/tk fall back to ru, other pack languages to en', () {
    final row = {'id': 'x', 'title': 'Başlıq', 'title_en': 'Title', 'title_ru': 'Заголовок'};
    expect(mapRowTranslation(row, 'tk', ['title'], lookup: notReady)!['title'], 'Заголовок');
    expect(mapRowTranslation(row, 'ky', ['title'], lookup: notReady)!['title'], 'Заголовок');
    expect(mapRowTranslation(row, 'ja', ['title'], lookup: notReady)!['title'], 'Title');
    expect(mapRowTranslation(row, 'uk', ['title'], lookup: notReady)!['title'], 'Title');
    expect(mapRowTranslation({'id': 'x', 'title': 'Başlıq'}, 'fr', ['title'], lookup: notReady)!['title'], 'Başlıq');
    // a server column wins over the pack
    expect(mapRowTranslation({...row, 'title_ja': 'タイトル'}, 'ja', ['title'], lookup: (_, _, _) => 'pack')!['title'], 'タイトル');
  });

  test('legacy languages keep their bridges', () {
    final row = {'id': 'x', 'title': 'Base', 'title_az': 'Az', 'title_en': 'En', 'title_ru': 'Ru'};
    expect(mapRowTranslation(row, 'az', ['title'])!['title'], 'Az');
    expect(mapRowTranslation({'title': 'Base'}, 'az', ['title'])!['title'], 'Base');
    for (final language in ['kk', 'uz', 'ka']) {
      expect(mapRowTranslation(row, language, ['title'])!['title'], 'Ru');
    }
    for (final language in ['de', 'ar']) {
      expect(mapRowTranslation(row, language, ['title'])!['title'], 'En');
    }
    expect(mapRowTranslation(row, 'en', ['title'])!['title'], 'En');
    expect(mapRowTranslation(row, 'tr', ['title'])!['title'], 'Base');
    expect(mapRowTranslation({'title_az': 'Az'}, 'ru', ['title'])!['title'], 'Az');
  });

  test('array fields parse JSON strings, split lines, or keep the base array', () {
    final row = {'id': 'x', 'tags': ['a'], 'tags_en': '["x","y"]', 'tags_ru': 'one\n two \n\n', 'tags_de': 'plain'};
    expect(mapRowTranslation(row, 'en', ['tags'])!['tags'], ['x', 'y']);
    expect(mapRowTranslation(row, 'ru', ['tags'])!['tags'], ['one', 'two']);
    expect(mapRowTranslation(row, 'de', ['tags'])!['tags'], ['a']);
    expect(mapRowTranslation(null, 'en', ['tags']), isNull);
    expect(mapRowsTranslation(null, 'en', ['tags']), isEmpty);
    expect(row['tags'], ['a']); // input untouched
  });
}
