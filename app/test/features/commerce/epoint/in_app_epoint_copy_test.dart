// Ported from: src/lib/in-app-epoint-copy.test.ts
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart' show kAppLanguageCodes;
import 'package:anacan/features/commerce/epoint/in_app_epoint_copy.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _dict(String lang) => jsonDecode(File('assets/i18n/$lang.json').readAsStringSync()) as Map<String, dynamic>;
List<String> _placeholders(String text) => RegExp(r'\{\w+\}').allMatches(text).map((m) => m[0]!).toList()..sort();
const List<String> _names = ['Epoint', 'Premium', 'App Store', 'Google Play', 'anacan.az'];

void main() {
  group('in-app Epoint copy in every app language', () {
    test('covers all 25 app languages', () => expect(kAppLanguageCodes, hasLength(25)));

    test('uses only known keys in the sources', () {
      final sources = [
        'lib/features/commerce/epoint/in_app_epoint.dart',
        'lib/features/commerce/epoint/epoint_pay_option.dart',
      ].map((p) => File(p).readAsStringSync()).join('\n');
      final used = RegExp(r"'(iep_[a-z_]+)'").allMatches(sources).map((m) => m[1]!).toList();
      expect(used.length, greaterThan(10));
      expect(used.where((k) => !kIepCopy.containsKey(k)).toList(), isEmpty);
    });

    for (final lang in kAppLanguageCodes) {
      test('$lang has every string, the same placeholders, the untranslated names and no long dashes', () {
        final dict = _dict(lang);
        final missing = <String>[];
        for (final e in kIepCopy.entries) {
          final value = dict[e.key];
          if (value is! String || value.trim().isEmpty) {
            missing.add(e.key);
            continue;
          }
          expect(_placeholders(value), _placeholders(e.value), reason: '$lang:${e.key}');
          for (final name in _names) {
            if (e.value.contains(name)) expect(value, contains(name), reason: '$lang:${e.key}');
          }
          expect(RegExp('[—–]').hasMatch(value), false, reason: '$lang:${e.key}');
          // Same text as Azerbaijani only where the languages genuinely agree (Turkish "{price} / ay").
          if (lang != 'az' && value == e.value) expect(['tr:iep_price_monthly'], contains('$lang:${e.key}'), reason: 'untranslated');
        }
        expect(missing, isEmpty);
        if (lang == 'az') {
          for (final e in kIepCopy.entries) {
            expect(dict[e.key], e.value, reason: e.key);
          }
        }
      });
    }
  });
}
