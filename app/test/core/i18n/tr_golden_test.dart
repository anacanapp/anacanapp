// Golden values: app/tool/i18n/export.mjs resolves tr/copyText/startupText from the React sources
// (src/locales/*.json, scripts/i18n/*.seed.json, scripts/i18n/copy/*.json, src/lib/startup-i18n.ts);
// the Dart runtime must return the same strings from the exported assets.
// Ported from: src/lib/tr.ts, src/lib/ui-copy.ts, src/lib/startup-i18n.ts, scripts/i18n/inline-localization.mjs
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final golden = jsonDecode(File('test/core/i18n/fixtures/golden.json').readAsStringSync()) as Map<String, dynamic>;
  final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')));
  setUpAll(() => I18nRuntime.instance = runtime);

  for (final lang in ['az', 'en', 'ru', 'ar', 'tk', 'ja']) {
    test('tr matches the React resolution in $lang', () async {
      await runtime.ensureLanguageReady(lang);
      runtime.setLanguageInMemory(lang);
      final cases = (golden['trCases'] as List).cast<Map<String, dynamic>>().where((item) => item['lang'] == lang).toList();
      expect(cases.length, greaterThan(80));
      for (final item in cases) {
        expect(tr(item['key'] as String, item['azDefault'] as String), item['expected'], reason: '$lang ${item['key']}');
        if (item['file'] != null) {
          // the key a Flutter author derives from the React file + Azerbaijani text
          expect(inlineKey(item['file'] as String, item['azDefault'] as String), item['key']);
          expect(trInline(item['file'] as String, item['azDefault'] as String), item['expected']);
        }
      }
    });
  }

  test('copyText matches ui-copy.ts in all 25 languages', () async {
    for (final lang in kAppLanguageCodes) {
      await runtime.ensureLanguageReady(lang);
    }
    for (final item in (golden['copyCases'] as List).cast<Map<String, dynamic>>()) {
      expect(copyText(item['section'] as String, item['key'] as String, language: item['lang'] as String), item['expected'],
          reason: '${item['lang']} ${item['section']}.${item['key']}');
    }
    runtime.setLanguageInMemory('en');
    expect(copyText('redesign', 'no_such_key'), 'no_such_key');
  });

  test('startupText is available before any dictionary', () {
    for (final item in (golden['startupCases'] as List).cast<Map<String, dynamic>>()) {
      expect(startupText(item['lang'] as String, item['key'] as String, 'FALLBACK'), item['expected']);
    }
  });

  test('every inline key in the index derives from its file and Azerbaijani text', () {
    final index = jsonDecode(File('assets/i18n/_inline_index.json').readAsStringSync()) as Map<String, dynamic>;
    expect(index.length, greaterThan(2000));
    index.forEach((key, entry) {
      expect(inlineKey(entry['file'] as String, entry['azText'] as String), key);
    });
  });

  test('manifest counts match the assets', () {
    final manifest = jsonDecode(File('assets/i18n/_manifest.json').readAsStringSync()) as Map<String, dynamic>;
    final languages = manifest['languages'] as Map<String, dynamic>;
    expect(languages.keys.toSet(), kAppLanguageCodes.toSet());
    final az = (jsonDecode(File('assets/i18n/az.json').readAsStringSync()) as Map).keys.toSet();
    for (final lang in kAppLanguageCodes) {
      final keys = (jsonDecode(File('assets/i18n/$lang.json').readAsStringSync()) as Map).keys.toSet();
      expect(keys.length, languages[lang]['keys']);
      expect(az.difference(keys).length, languages[lang]['missingVsAz']);
    }
  });

  test('formatTr substitutes known placeholders and keeps unknown ones', () async {
    await runtime.ensureLanguageReady('en');
    runtime.setLanguageInMemory('en');
    expect(formatTr('__missing__', 'Salam {name}, {other} {n}', {'name': 'Aysel', 'n': 2.0}), 'Salam Aysel, {other} 2');
    expect(formatTrInline('X.tsx', '{inline_0} gün', [3]), '3 gün');
    runtime.setLanguageInMemory('pl');
    await runtime.ensureLanguageReady('pl');
    expect(formatTr('__missing__', '{count} gün', {'count': 2}), '2 dni');
  });

  test('useTranslation().t returns the default for az and for empty values', () async {
    runtime.setLanguageInMemory('az');
    expect(t('month_january', 'DEFAULT'), 'DEFAULT');
    expect(tr('month_january', 'DEFAULT'), isNot('DEFAULT')); // tr consults az.json
    runtime.setLanguageInMemory('en');
    runtime.store.debugMerge('en', {'__empty__': ''});
    expect(t('__empty__', 'fallback'), 'fallback');
    expect(tr('__empty__', 'fallback'), '');
  });
}
