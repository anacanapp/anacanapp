// Ported from: src/lib/qaygicash-i18n.test.ts
//
// The React test reads src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json; the app ships the same
// dictionaries as app/assets/i18n/<lang>.json, which is what `tr` reads here.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart' show kAppLanguageCodes;
import 'package:anacan/features/commerce/qaygicash/qaygicash_copy.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _dict(String lang) => jsonDecode(File('assets/i18n/$lang.json').readAsStringSync()) as Map<String, dynamic>;
List<String> _placeholders(String text) => RegExp(r'\{\w+\}').allMatches(text).map((m) => m[0]!).toList()..sort();

void main() {
  group('QayğıCash copy in every app language', () {
    test('covers all 25 app languages', () {
      expect(kAppLanguageCodes, hasLength(25));
    });

    test('uses only known copy keys in the sources', () {
      final sources = Directory('lib/features/commerce')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))
          .map((f) => f.readAsStringSync())
          .join('\n');
      final used = RegExp(r"'(qc_[a-z0-9_]+)'")
          .allMatches(sources)
          .map((m) => m[1]!)
          .where((k) => !k.endsWith('_') && !const ['qc_wallet_view', 'qc_redeem_toggle', 'qc_redeem_commit', 'qc_premium_redeem'].contains(k))
          .toList();
      expect(used.where((k) => !kQcCopy.containsKey(k)).toList(), isEmpty);
      // Computed keys (history titles, rate labels) must exist too.
      for (final channel in ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'adjust']) {
        expect(kQcCopy.containsKey('qc_hist_earn_$channel'), true);
      }
      for (final channel in ['aptek', 'cake', 'book', 'premium', 'other']) {
        expect(kQcCopy.containsKey('qc_hist_use_$channel'), true);
      }
      for (final channel in ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'partner']) {
        expect(kQcCopy.containsKey('qc_rate_$channel'), true);
      }
    });

    for (final lang in kAppLanguageCodes) {
      test('$lang has every string, the same placeholders and the untranslated brand', () {
        final dict = _dict(lang);
        final missing = <String>[];
        for (final e in kQcCopy.entries) {
          final value = dict[e.key];
          if (value is! String || value.trim().isEmpty) {
            missing.add(e.key);
            continue;
          }
          expect(_placeholders(value), _placeholders(e.value), reason: '$lang:${e.key}');
          if (e.value.contains('QayğıCash')) expect(value, contains('QayğıCash'), reason: '$lang:${e.key}');
        }
        expect(missing, isEmpty);
        if (lang == 'az') {
          for (final e in kQcCopy.entries) {
            expect(dict[e.key], e.value, reason: e.key);
          }
        }
      });
    }
  });
}
