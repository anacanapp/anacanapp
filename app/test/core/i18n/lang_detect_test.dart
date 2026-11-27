// Ported from: src/lib/langDetect.test.ts, src/lib/geoLanguage.test.ts
import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Community post visibility language regression', () {
    const cases = [
      ['Salam qizlar bir sualim var, nece edim?', 'az', 'az'],
      ['Salam bir sualim var', 'az', 'az'],
      ['Qizlar cox narahatam, bilmirem nece edim', 'en', 'az'],
      ['Oğlumun yuxusu normaldır?', 'az', 'az'],
      ['Usagim 2 ayliqdi, i herfini yazdim', 'az', 'az'],
      ['Merhaba kızlar, bebeğim nasıl uyuyabilir?', 'az', 'tr'],
      ['Merhaba, ben bir anne olarak cok mutluyum', 'az', 'tr'],
      ['Salom, mening bolam uchun nima yaxshi?', 'az', 'uz'],
      ['What do you do when your baby cannot sleep?', 'az', 'en'],
      ['Как помочь малышу заснуть вечером?', 'az', 'ru'],
      ['Салем кыздар, калай болады?', 'ru', 'kk'],
      ['Салом, менинг болам учун нима яхши?', 'ru', 'uz'],
      ['https://example.invalid/nece-qizlar #cox ❤️', 'tr', 'tr'],
      ['bir bu var', 'uz', 'uz'],
    ];
    for (final [text, fallback, expected] in cases) {
      test('keeps $text in its content language', () => expect(detectLang(text, fallback), expected));
    }

    test('repairs only evidenced legacy labels, keeping other languages and ambiguous choices', () {
      expect(legacyPostLanguage('Salam qizlar bir sualim var, nece edim?', 'tr', 'az'), 'az');
      expect(legacyPostLanguage('Salam, usagim ucun nece edim?', 'en', 'az'), 'az');
      expect(legacyPostLanguage('Salom, mening bolam uchun nima yaxshi?', 'az', 'uz'), 'uz');
      expect(legacyPostLanguage('Merhaba, ben bir anne olarak cok mutluyum', 'tr', 'az'), 'tr');
      expect(legacyPostLanguage('bir bu var', 'tr', 'az'), 'tr');
      expect(legacyPostLanguage('Как помочь малышу заснуть?', 'ru', 'az'), 'ru');
      expect(legacyPostLanguage('Салем кыздар, калай болады?', 'ru', 'kk'), 'kk');
      expect(legacyPostLanguage('Привет девочки, мой ребенок хорошо спит', 'ru', 'kk'), 'ru');
      expect(legacyPostLanguage('https://example.invalid/qizlar/nece', 'tr', 'az'), 'tr');
      expect(legacyPostLanguage('Salam qizlar nece edim?', 'tr', null), 'tr');
    });
  });

  group('expanded scripts (25 languages)', () {
    test('Ukrainian, Kyrgyz, Turkmen, Estonian and Georgian/Arabic scripts', () {
      expect(detectLang('Привіт, моя дитина добре спить', 'az'), 'uk');
      expect(detectLang('Що робити, як дитина не спить? Дуже треба', 'az'), 'uk');
      // Kazakh vocabulary evidence wins here, exactly as in the React detector.
      expect(detectLang('Менин балам түнү жакшы уктабайт, эмне кылсам болот', 'az'), 'kk');
      expect(detectLang('Бүгүн түнү уктабайт, эмне кылам', 'az'), 'ky');
      expect(detectLang('Meniň çagam gaty gowy ýatýar', 'az'), 'tk');
      expect(detectLang('Kuidas sa täna oled? Laps magab hästi, õnneks', 'az'), 'et');
      expect(detectLang('ჩემი ბავშვი კარგად სძინავს', 'az'), 'ka');
      expect(detectLang('طفلي ينام جيدا الليلة', 'az'), 'ar');
    });

    test('decomposed input is composed like String.normalize("NFC")', () {
      expect(composeNfc('Açık'), 'Açık');
      expect(composeNfc('ế'), 'ế');
      expect(composeNfc('й'), 'й');
      expect(detectLang('Bebeğim çok iyi uyuyor ve ben mutluyum', 'az'), 'tr');
    });

    test('sanitizes feed language lists', () {
      expect(sanitizeFeedLangs(['ru', 'xx', 'ru', 'tk'], ['az']), ['ru', 'tk']);
      expect(sanitizeFeedLangs('nope', ['az']), ['az']);
      expect(isFeedLang('uk'), isTrue);
    });
  });

  group('languageForCountry', () {
    final all = kAppLanguageCodes;
    test('maps a country to its language', () {
      expect(languageForCountry('AZ', all), 'az');
      expect(languageForCountry('TR', all), 'tr');
      expect(languageForCountry('RU', all), 'ru');
      expect(languageForCountry('KZ', all), 'kk');
      expect(languageForCountry('KG', all), 'ky');
      expect(languageForCountry('EE', all), 'et');
      expect(languageForCountry('TM', all), 'tk');
      expect(languageForCountry('UA', all), 'uk');
      expect(languageForCountry('BR', all), 'pt');
      expect(languageForCountry('MX', all), 'es');
      expect(languageForCountry('AT', all), 'de');
      expect(languageForCountry('SA', all), 'ar');
      expect(languageForCountry('jp', all), 'ja');
    });
    test('falls back to English for countries without an app language', () {
      for (final country in ['GB', 'US', 'IT', 'IL', 'AM', 'GR']) {
        expect(languageForCountry(country, all), 'en');
      }
    });
    test('falls back to English when unknown or missing', () {
      expect(languageForCountry(null, all), 'en');
      expect(languageForCountry('', all), 'en');
    });
    test('only picks languages that are currently offered', () {
      expect(languageForCountry('KG', all.where((code) => code != 'ky').toList()), 'en');
    });
    test('every mapped language is an app language', () {
      const countries = ['AZ', 'TR', 'RU', 'BY', 'TJ', 'TM', 'KZ', 'KG', 'UZ', 'GE', 'EE', 'UA', 'DE', 'FR', 'NL', 'ES', 'PT', 'PL', 'SE', 'JP', 'KR', 'CN', 'VN', 'ID', 'IN', 'SA'];
      for (final country in countries) {
        expect(all.contains(languageForCountry(country, all)), isTrue);
      }
    });
    test('fetchGeoCountry accepts only ISO-2 and never throws', () async {
      expect(await fetchGeoCountry(() async => 'US'), 'US');
      expect(await fetchGeoCountry(() async => 'usa'), isNull);
      expect(await fetchGeoCountry(() async => null), isNull);
      expect(await fetchGeoCountry(() async => throw StateError('offline')), isNull);
      expect(await fetchGeoCountry(() => Future.delayed(const Duration(seconds: 1), () => 'AZ'), timeout: const Duration(milliseconds: 10)), isNull);
    });
  });
}
