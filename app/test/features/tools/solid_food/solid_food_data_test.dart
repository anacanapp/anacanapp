// Ported from: src/components/tools/SolidFoodGuide.test.ts, src/data/solid-food-guide/solid-food-guide.test.ts,
//              src/lib/solid-food-guide-entry.test.ts
//
// The guide texts are read from the bundled copies (app/assets/i18n/solid-food-guide.<lang>.json) and compared
// with the React sources so the copies cannot drift.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/features/baby/models/baby_rules.dart';
import 'package:anacan/features/tools/solid_food/solid_food_data.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> read(String lang) =>
    jsonDecode(File('assets/i18n/solid-food-guide.$lang.json').readAsStringSync()) as Map<String, dynamic>;

Object? shape(Object? value) {
  if (value is List) return value.map(shape).toList();
  if (value is Map) {
    final keys = value.keys.map((k) => '$k').toList()..sort();
    return {for (final k in keys) k: shape(value[k])};
  }
  return value is String ? 'string' : value is num ? 'number' : value is bool ? 'boolean' : '$value';
}

List<String> placeholders(Object? value, [String path = '']) {
  if (value is String) return [for (final _ in RegExp(r'\{n\}').allMatches(value)) path];
  if (value is Map) return [for (final e in value.entries) ...placeholders(e.value, '$path.${e.key}')];
  if (value is List) return [for (var i = 0; i < value.length; i++) ...placeholders(value[i], '$path.$i')];
  return const [];
}

void main() {
  test('reads the starting age from recipe titles', () {
    expect(recipeMinMonths('Armud və Gavalı püresi\n(6 ay+)'), 6);
    expect(recipeMinMonths('Sağlam Naqets(1 yaş+)'), 12);
    expect(recipeMinMonths('Gold Mac & Cheese (2 yaş+)'), 24);
    expect(recipeMinMonths('Iron Bowl - Qarabaşaq və Ət'), isNull);
  });

  test('shows the guide from about five months up to four years', () {
    expect(solidFoodGuideRelevant(4), isFalse);
    expect(solidFoodGuideRelevant(5), isTrue);
    expect(solidFoodGuideRelevant(47), isTrue);
    expect(solidFoodGuideRelevant(48), isFalse);
    expect(solidFoodGuideRelevant(null), isFalse);
  });

  group('solid food guide texts', () {
    final az = read('az');
    test('lines up with the structure module', () {
      expect([for (final s in az['stages'] as List) s['id']], stages.map((s) => s.id).toList());
      expect(az['nutrients'], hasLength(nutrientTags.length));
      expect(az['plate'], hasLength(plate.length));
      expect(az['foods'], hasLength(foods.length));
      expect(((az['foodGroups'] as Map).keys.toList()..sort()), [...foodGroups]..sort());
      for (final e in dishTags.entries) {
        expect((az['dishes'] as Map)[e.key], hasLength(e.value.length));
      }
    });

    final files = Directory('assets/i18n')
        .listSync()
        .map((f) => f.uri.pathSegments.last)
        .where((n) => n.startsWith('solid-food-guide.') && n.endsWith('.json'))
        .map((n) => n.substring('solid-food-guide.'.length, n.length - '.json'.length))
        .toList();
    test('has a file for every app language', () {
      expect([...files]..sort(), [...kAppLanguageCodes]..sort());
    });

    test('the bundled copies equal the React sources', () {
      for (final lang in files) {
        final source = jsonDecode(File('../src/data/solid-food-guide/$lang.json').readAsStringSync());
        expect(read(lang), source, reason: lang);
      }
    });

    for (final lang in files.where((l) => l != 'az')) {
      test('$lang has the same shape, ids and placeholders as az', () {
        final text = read(lang);
        expect(shape(text), shape(az));
        expect([for (final s in text['stages'] as List) s['id']], [for (final s in az['stages'] as List) s['id']]);
        expect(placeholders(text), placeholders(az));
      });
    }
  });
}
