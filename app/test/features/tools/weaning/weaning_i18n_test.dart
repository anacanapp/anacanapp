// Ported from: src/lib/weaning-i18n.test.ts
// The dictionaries are the app's bundled ones (assets/i18n/<lang>.json, exported from src/locales and
// scripts/i18n/<lang>.seed.json); the source scan reads the Dart port of the tool.
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart' show kAppLanguageCodes;
import 'package:anacan/core/i18n/sources.dart' show decodeDictionary;
import 'package:anacan/features/tools/weaning/weaning_copy.dart';
import 'package:flutter_test/flutter_test.dart';

List<String> placeholders(String text) => RegExp(r'\{\w+\}').allMatches(text).map((m) => m[0]!).toList()..sort();

void main() {
  group('weaning tool copy in every app language', () {
    test('covers all 25 app languages', () {
      expect(kAppLanguageCodes, hasLength(25));
    });

    test('uses only the shared copy keys in the tool source', () {
      final sources = [
        for (final f in Directory('lib/features/tools/weaning').listSync().whereType<File>())
          // The sync module names tables (weaning_plans, weaning_checkins), not copy (React scans the UI files only).
          if (!f.path.endsWith('.g.dart') && !f.path.endsWith('weaning_sync.dart')) f.readAsStringSync(),
        File('lib/features/tools/programme_tools.dart').readAsStringSync(),
      ].join('\n');
      final used = RegExp(r"'(weaning_[a-z0-9_]+)'").allMatches(sources).map((m) => m[1]!).where((k) => !k.endsWith('_'));
      final unknown = used.where((k) => !kWeaningCopy.containsKey(k) && k != 'weaning_plan' && k != 'weaning_tool').toList();
      expect(unknown, isEmpty);
    });

    for (final lang in kAppLanguageCodes) {
      test('$lang has every weaning string with the same placeholders', () {
        final dict = decodeDictionary(File('assets/i18n/$lang.json').readAsBytesSync());
        final missing = <String>[];
        for (final e in kWeaningCopy.entries) {
          final value = dict[e.key];
          if (value == null || value.trim().isEmpty) {
            missing.add(e.key);
            continue;
          }
          expect(placeholders(value), placeholders(e.value), reason: '$lang:${e.key}');
          // Emergency numbers come from the country helper, never from the copy.
          expect(RegExp(r'(^|[^\d])(103|112|911|999)(?!\d)').hasMatch(value), false, reason: '$lang:${e.key}');
        }
        expect(missing, isEmpty);
        if (lang == 'az') {
          for (final e in kWeaningCopy.entries) {
            expect(dict[e.key], e.value, reason: e.key);
          }
        }
      });
    }
  });
}
