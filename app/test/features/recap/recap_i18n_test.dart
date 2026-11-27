// Ported from: src/lib/recap/recap-i18n.test.ts
//
// The dictionaries are the bundled app/assets/i18n/<lang>.json (generated from src/locales + scripts/i18n seeds).
import 'dart:convert';
import 'dart:io';

import 'package:anacan/domain/common/app_languages.dart';
import 'package:anacan/domain/recap/data/recap_data.g.dart';
import 'package:flutter_test/flutter_test.dart';

List<String> placeholders(String text) => RegExp(r'\{\w+\}').allMatches(text).map((m) => m[0]!).toList()..sort();

void main() {
  group('Anacan Recap copy in every app language', () {
    test('covers all 25 app languages', () {
      expect(appLanguageCodes, hasLength(25));
    });

    test('uses only known copy keys in the sources (computed persona keys included)', () {
      final sources = [
        'lib/domain/recap/recap_model.dart',
        'lib/features/recap/recap_screen.dart',
        'lib/features/recap/use_recap.dart',
        'lib/features/home/dashboard/recap_home_card.dart',
      ].map((p) => File(p).readAsStringSync()).join('\n');
      final used = RegExp(r"'(recap_[a-z0-9_]+)'")
          .allMatches(sources)
          .map((m) => m[1]!)
          .where((k) => !const ['recap_opened', 'recap_completed', 'recap_exported', 'recap_shared'].contains(k))
          .toList();
      expect(used, isNotEmpty);
      expect(used.where((k) => !recapCopy.containsKey(k)).toList(), isEmpty);
      // Every persona in the table has a title and all its alternative "why" lines.
      for (final p in recapPersonaTable) {
        expect(recapCopy.containsKey('recap_persona_${p['id']}'), isTrue, reason: '${p['id']}');
        for (var i = 1; i <= (p['lines']! as num); i++) {
          expect(recapCopy.containsKey('recap_persona_${p['id']}_why_$i'), isTrue, reason: '${p['id']} why $i');
        }
      }
    });

    for (final lang in appLanguageCodes) {
      test('$lang has every string, the same placeholders and the untranslated brand', () {
        final dict = (jsonDecode(File('assets/i18n/$lang.json').readAsStringSync()) as Map).cast<String, Object?>();
        final missing = <String>[];
        for (final MapEntry(key: key, value: az) in recapCopy.entries) {
          final value = dict[key];
          if (value is! String || value.trim().isEmpty) {
            missing.add(key);
            continue;
          }
          expect(placeholders(value), placeholders(az), reason: '$lang:$key');
          if (az.contains('Anacan')) expect(value, contains('Anacan'), reason: '$lang:$key');
          if (lang != 'az' && key != 'recap_growth_gain' && !const ['recap_share', 'recap_pause'].contains(key)) {
            // Translated, not copied from Azerbaijani (short brand-only strings excepted).
            if (RegExp('[əğış]', caseSensitive: false).hasMatch(az) && lang != 'tr') expect(value, isNot(az), reason: '$lang:$key');
          }
        }
        expect(missing, isEmpty);
        if (lang == 'az') {
          for (final MapEntry(key: key, value: az) in recapCopy.entries) {
            expect(dict[key], az, reason: key);
          }
        }
      });
    }
  });
}
