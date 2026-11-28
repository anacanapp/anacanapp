// Ported from: src/lib/date-utils.ts (getCurrentDateLocale + date-fns `format`)
// Golden: app/test/core/i18n/fixtures/date_fns_golden.json from app/tool/i18n/date_fns_golden.mjs (date-fns 3.6 with
// the React locales, incl. the custom ky / tk ones), for every pattern the Flutter code passes to formatDatePattern.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final golden = jsonDecode(File('test/core/i18n/fixtures/date_fns_golden.json').readAsStringSync()) as Map<String, dynamic>;
  final dates = [
    for (final d in golden['dates'] as List) DateTime((d as List)[0] as int, d[1] as int, d[2] as int, d[3] as int, d[4] as int),
  ];

  setUpAll(ensureDateLocales);

  test('the golden covers all 25 app languages', () {
    expect((golden['cases'] as Map).keys.toSet(), kAppLanguageCodes.toSet());
  });

  for (final lang in kAppLanguageCodes) {
    test('formatDatePattern matches date-fns in $lang', () {
      final mismatches = <String>[];
      for (final item in (golden['cases'] as Map<String, dynamic>)[lang] as List) {
        final pattern = (item as List)[0] as String;
        final expected = (item[1] as List).cast<String>();
        for (var i = 0; i < dates.length; i++) {
          final actual = formatDatePattern(dates[i], pattern, language: lang);
          if (actual != expected[i]) mismatches.add('$pattern ${dates[i].toIso8601String()}: "$actual" != "${expected[i]}"');
        }
      }
      expect(mismatches, isEmpty, reason: mismatches.join('\n'));
    });
  }
}
