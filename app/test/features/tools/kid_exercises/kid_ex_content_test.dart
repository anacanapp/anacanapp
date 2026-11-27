// Ported from: src/data/kid-exercises/kid-exercises-i18n.test.ts, src/lib/kid-exercises.test.ts (the content case
//              that reads the merged Azerbaijani content and the image files; the logic cases live in
//              test/domain/kid_exercises)
//
// Reads the bundled copies (app/assets/kid_exercises, app/assets/exercises) and checks they equal the React sources.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/tools/hub/hub_copy.g.dart' show kKidExContentLanguages, kKidExTileText;
import 'package:anacan/features/tools/kid_exercises/kid_ex_content.dart';
import 'package:anacan/features/tools/kid_exercises/kid_ex_ui_az.g.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> readJson(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final az = readJson('assets/kid_exercises/az.json');
  final groups = {for (final e in az['exercises'] as List) (e as Map)['group'] as String}.toList();
  final localeFiles = kKidExContentLanguages.where((l) => l != 'az').toList();

  group('Uşaq məşqləri languages', () {
    test('registry, tile text and locale files list the same languages', () {
      expect([...kKidExLanguageLoaders]..sort(), [...kKidExContentLanguages]..sort());
      expect(kKidExTileText.keys.toList()..sort(), [...kKidExContentLanguages]..sort());
      final files = Directory('assets/kid_exercises')
          .listSync()
          .map((f) => f.uri.pathSegments.last)
          .where((n) => RegExp(r'^[a-z]{2}\.json$').hasMatch(n))
          .map((n) => n.substring(0, 2))
          .toList();
      for (final l in kKidExContentLanguages) {
        expect(files, contains(l));
      }
    });

    for (final lang in localeFiles) {
      test('$lang covers every UI key, set, group and exercise', () {
        final loc = readJson('assets/kid_exercises/$lang.json');
        final ui = (loc['ui'] as Map).cast<String, Object?>();
        expect(ui.keys.toList()..sort(), kKidExUiAz.keys.toList()..sort());
        expect(ui['count'], contains('{n}'));
        expect(ui['doneCount'], contains('{n}'));
        expect(ui['ageFor'], contains('{name}'));
        expect(kKidExTileText[lang], (name: ui['tileName'], description: ui['tileDesc']));
        for (final s in az['sets'] as List) {
          expect(((loc['sets'] as Map)[(s as Map)['id']] as Map?)?['rules'], hasLength((s['rules'] as List).length));
        }
        for (final g in groups) {
          expect(((loc['groups'] as Map)[g] as String?)?.length, greaterThan(0));
        }
        for (final e in az['exercises'] as List) {
          final id = (e as Map)['id'];
          final t = (loc['exercises'] as Map)[id] as Map?;
          expect(t, isNotNull, reason: '$id');
          final caution = t!['caution'];
          expect(caution is String && caution.isNotEmpty, e['caution'] is String && (e['caution'] as String).isNotEmpty, reason: '$id');
        }
        expect(jsonEncode(loc), isNot(contains('—')));
      });
    }

    test('loads Azerbaijani with the source text', () async {
      final container = ProviderContainer(overrides: [kidExAssetLoaderProvider.overrideWithValue((p) => File(p).readAsString())]);
      addTearDown(container.dispose);
      final c = await container.read(kidExContentProvider('az').future);
      expect(c.exercises, hasLength(141));
      expect(c.exercises[0].title, 'Qarın üstə uzanma');
    });
  });

  group('kid exercises content', () {
    test('has 141 exercises in 5 age groups, each with an image and text', () {
      final content = mergeKidExLocale('az', az, kKidExAzLocale);
      expect(content.sets.map((s) => s.id), ['0-1', '1-2', '2-3', '3-4', '4-5']);
      expect(content.exercises, hasLength(141));
      expect(content.exercises.map((e) => e.id).toSet(), hasLength(141));
      for (final e in content.exercises) {
        expect(e.id.startsWith('${e.set}/'), true);
        expect(File(exerciseImageAsset(e.id)).existsSync(), true, reason: e.id);
        for (final v in [e.title, e.age, e.how, e.duration, e.benefit]) {
          expect(v.length, greaterThan(2), reason: e.id);
        }
      }
    });
  });

  group('bundled copies', () {
    test('equal the React sources (run gen_kid_ex_content.mjs when this fails)', () {
      for (final lang in kKidExContentLanguages) {
        expect(File('assets/kid_exercises/$lang.json').readAsBytesSync(), File('../src/data/kid-exercises/$lang.json').readAsBytesSync(), reason: lang);
      }
      for (final dir in Directory('../public/exercises').listSync().whereType<Directory>()) {
        for (final f in dir.listSync().whereType<File>()) {
          final rel = '${dir.uri.pathSegments[dir.uri.pathSegments.length - 2]}/${f.uri.pathSegments.last}';
          expect(File('assets/exercises/$rel').readAsBytesSync(), f.readAsBytesSync(), reason: rel);
        }
      }
    });

    test('merges a locale over the Azerbaijani structure (missing text keeps the source)', () {
      final en = mergeKidExLocale('en', az, readJson('assets/kid_exercises/en.json'));
      final src = mergeKidExLocale('az', az, kKidExAzLocale);
      expect(en.exercises.map((e) => e.id), src.exercises.map((e) => e.id));
      expect(en.exercises.map((e) => e.groupKey), src.exercises.map((e) => e.groupKey));
      expect(en.exercises.first.title, isNot(src.exercises.first.title));
      expect(en.u('title'), isNot(src.u('title')));
      final partial = mergeKidExLocale('xx', az, {'ui': {'title': 'T'}, 'sets': {}, 'groups': {}, 'exercises': {}});
      expect(partial.u('title'), 'T');
      expect(partial.u('done'), kKidExUiAz['done']);
      expect(partial.exercises.first.title, src.exercises.first.title);
    });
  });
}
