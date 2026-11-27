// Ported from: src/lib/count-plural.test.ts, src/lib/count-format.ts, src/lib/date-utils.ts
// Golden values (dates, units, plural categories, numbers, weekdays) come from Node's Intl via
// app/tool/i18n/export.mjs, i.e. what the React app renders.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

void main() {
  final golden = jsonDecode(File('test/core/i18n/fixtures/golden.json').readAsStringSync()) as Map<String, dynamic>;
  final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')));
  Future<void> use(String lang) async {
    await runtime.ensureLanguageReady(lang);
    runtime.setLanguageInMemory(lang);
  }

  setUpAll(() => I18nRuntime.instance = runtime);

  group('counted nouns', () {
    test('pluralizes Russian correctly (no "93 статей", no truncated "запис.")', () async {
      await use('ru');
      expect(formatCount(CountNoun.articles, 93), '93 статьи');
      expect(formatCount(CountNoun.articles, 1), '1 статья');
      expect(formatCount(CountNoun.articles, 11), '11 статей');
      expect(formatCount(CountNoun.articles, 25), '25 статей');
      expect(formatCount(CountNoun.records, 1), '1 запись');
      expect(formatCount(CountNoun.records, 3), '3 записи');
      expect(formatCount(CountNoun.records, 12), '12 записей');
    });
    test("uses the other inflecting languages' forms", () async {
      Future<String> inLang(String lang, CountNoun noun, int n) async {
        await use(lang);
        return formatCount(noun, n);
      }

      expect(await inLang('en', CountNoun.articles, 1), '1 article');
      expect(await inLang('en', CountNoun.articles, 2), '2 articles');
      expect(await inLang('pl', CountNoun.records, 22), '22 wpisy');
      expect(await inLang('pl', CountNoun.records, 25), '25 wpisów');
      expect(await inLang('uk', CountNoun.articles, 21), '21 стаття');
      expect(await inLang('fr', CountNoun.articles, 0), '0 article');
      expect(await inLang('az', CountNoun.records, 5), '5 qeyd');
    });
  });

  group('ordinals', () {
    test('reads naturally per language', () async {
      await use('ru');
      expect(weekOrdinal(19), '19-я неделя');
      expect(trimesterOrdinal(2), '2-й триместр');
      await use('en');
      expect(weekOrdinal(19), 'Week 19');
      await use('az');
      expect(weekOrdinal(19), '19. həftə');
    });
    test('Turkmen and Kyrgyz ordinal suffixes follow vowel harmony', () {
      expect([1, 6, 9, 10, 20, 100].map((n) => getOrdinal(n, 'tk')).toList(), ['1-nji', '6-njy', '9-njy', '10-njy', '20-nji', '100-nji']);
      expect([1, 3, 6, 9, 100].map((n) => getOrdinal(n, 'ky')).toList(), ['1-чи', '3-чү', '6-чы', '9-чу', '100-чү']);
      expect([1, 2, 3, 11, 21].map((n) => getOrdinal(n, 'en')).toList(), ['1st', '2nd', '3rd', '11th', '21st']);
      expect([1, 3, 6, 9, 10, 40, 20, 100].map((n) => getOrdinal(n, 'az')).toList(),
          ['1-ci', '3-cü', '6-cı', '9-cu', '10-cu', '40-cı', '20-ci', '100-cü']);
    });
  });

  group('Intl parity (Node ICU goldens)', () {
    test('CLDR plural categories of the expansion languages', () {
      (golden['plurals'] as Map<String, dynamic>).forEach((lang, cases) {
        for (final item in cases as List) {
          expect(cldrPluralCategory(lang, item[0] as num), item[1], reason: '$lang ${item[0]}');
        }
      });
    });
    test('formatCountUnit renders Intl unit text', () {
      for (final item in golden['units'] as List) {
        final [lang as String, template as String, value as num, expected as String] = item as List;
        final placeholder = RegExp(r'\{(\w+)\}').firstMatch(template)![1]!;
        expect(formatCountUnit(lang, template, {placeholder: value}), expected, reason: '$lang $template $value');
      }
    });
    test('number symbols', () {
      (golden['numbers'] as Map<String, dynamic>).forEach((lang, cases) {
        for (final item in cases as List) {
          expect(formatIntlNumber(lang, item[0] as num, maximumFractionDigits: 2), item[1], reason: '$lang ${item[0]}');
        }
      });
    });
    test('weekday labels (Sunday first)', () {
      (golden['weekdays'] as Map<String, dynamic>).forEach((lang, labels) => expect(weekdayLabels(lang), labels, reason: lang));
    });
    test('pack-language date templates', () {
      (golden['dates'] as Map<String, dynamic>).forEach((lang, variants) {
        (variants as Map<String, dynamic>).forEach((variant, cases) {
          for (final item in cases as List) {
            final date = DateTime.parse(item[0] as String);
            expect(formatIntlDateTemplate(lang, variant, date), item[1], reason: '$lang $variant ${item[0]}');
          }
        });
      });
    });
  });

  group('date-utils', () {
    test('formatDateAz uses tr month names for the nine legacy languages and Intl for pack languages', () async {
      await use('az');
      expect(formatDateAz('2025-02-18'), '18 Fevral');
      expect(formatDateAz('2025-02-18', includeYear: true), '18 Fevral 2025');
      expect(formatDateAz('not a date'), '');
      await use('ru');
      expect(formatDateAz(DateTime(2025, 2, 18), includeYear: true), '18 ${tr('month_february', 'Fevral')} 2025');
      await use('fr');
      expect(formatDateAz('2025-02-18'), '18 février');
      await use('tk');
      expect(formatDateAz('2025-02-18', includeYear: true), formatIntlDateTemplate('tk', 'dmy', DateTime.utc(2025, 2, 18)));
    });
    test('formatDateTimeAz, formatTimeAz, formatRelativeDateAz', () async {
      await use('az');
      final date = DateTime(2025, 2, 18, 14, 30);
      expect(formatDateTimeAz(date), '18 Fevral, 14:30');
      expect(formatDateTimeAz(date, includeYear: true), '18 Fevral 2025, 14:30');
      expect(formatTimeAz(date), '14:30');
      expect(formatRelativeDateAz(date, now: DateTime(2025, 2, 18, 20)), 'Bu gün, 14:30');
      expect(formatRelativeDateAz(date, now: DateTime(2025, 2, 19, 8)), 'Dünən, 14:30');
      expect(formatRelativeDateAz(date, now: DateTime(2025, 3, 1)), '18 Fevral, 14:30');
      await use('en');
      expect(formatRelativeDateAz(date, now: DateTime(2025, 2, 18, 20)), '${tr('dateutils_today', 'Bu gün')}, 14:30');
    });
    test('translateSymptom', () async {
      await use('az');
      expect(translateSymptom('Headache'), 'Başağrısı');
      expect(translateSymptom('BLOATING'), 'Şişkinlik');
      expect(translateSymptom('unknown'), 'unknown');
    });
    test('intl date locales include a Turkmen locale built like the custom date-fns one', () async {
      await ensureDateLocales();
      expect(formatDatePattern(DateTime(2025, 6, 3), 'd MMMM y', language: 'tk'), '3 iýun 2025');
      expect(DateFormat('LLLL', 'tk').format(DateTime(2025, 6, 3)), 'İýun');
      expect(formatDatePattern(DateTime(2025, 6, 3), 'EEEE', language: 'tk'), 'sişenbe');
      expect(formatDatePattern(DateTime(2025, 6, 3), 'd MMMM', language: 'ar'), contains('3'));
      expect(formatDatePattern(DateTime(2025, 6, 3, 9, 5), 'HH:mm', language: 'ky'), '09:05');
    });
  });

  group('registry, RTL and locales', () {
    test('Arabic is the only RTL language', () {
      expect(kAppLanguageCodes.where(isRtlLang).toList(), ['ar']);
      expect(appLanguage('ar').textDirection.name, 'rtl');
      expect(rtlX(20, true), -20);
      expect(rtlXString('20%', true), '-20%');
      expect(rtlXString('-12px', true), '12px');
      expect(rtlXString('auto', true), 'auto');
    });
    test('locale tags and Flutter locales', () {
      expect(appLanguage('az').locale.toLanguageTag(), 'az-AZ');
      expect(appLanguage('ar').locale.toLanguageTag(), 'ar');
      expect(appLanguage('zh').intlLocale, 'zh_CN');
      expect(materialLocaleFor('tk').languageCode, 'ru');
      expect(normalizeAppLanguage('xx'), 'az');
      expect(isWebsiteLanguage('tk'), isFalse);
      expect(isWebsiteLanguage('fr'), isTrue);
    });
  });
}
