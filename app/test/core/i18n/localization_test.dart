// Ported from: src/lib/localization.test.ts
import 'dart:convert';

import 'package:anacan/core/content_packs/content_packs.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

import '../content_packs/pack_builder.dart';

void main() {
  group('twenty-one-language selection', () {
    test('keeps bundled choices offline and recognizes inactive legacy-list rows without losing tool restrictions', () {
      expect(kAppLanguageCodes, hasLength(25));
      expect(kAppLanguageCodes.toSet().length, 25);
      expect(kAppLanguageCodes.sublist(21), ['ky', 'et', 'tk', 'uk']);
      expect(resolveAppLanguages().map((item) => item.code).toList(), kAppLanguageCodes);
      final result = resolveAppLanguages(const [
        RemoteAppLanguage(code: 'en', name: 'English', nativeName: 'English', disabledTools: ['cakes']),
        RemoteAppLanguage(code: 'tr', name: 'Turkish', nativeName: 'Türkçe', isActive: false),
        RemoteAppLanguage(code: 'ru', name: 'Russian', nativeName: 'Русский', isActive: false),
        RemoteAppLanguage(code: 'pt', name: 'Portuguese', nativeName: 'Português', isActive: false),
        RemoteAppLanguage(code: 'unsupported', name: 'Unsupported', nativeName: 'Unsupported'),
      ]);
      expect(result.any((item) => item.code == 'tr'), isTrue);
      expect(result.any((item) => item.code == 'ru'), isTrue);
      expect(result.any((item) => item.code == 'pt'), isTrue);
      expect(result.firstWhere((item) => item.code == 'pt').isActive, isTrue);
      expect(result.any((item) => item.code == 'unsupported'), isFalse);
      expect(result.firstWhere((item) => item.code == 'fr').disabledTools, ['cakes']);
      expect(result.firstWhere((item) => item.code == 'ky').disabledTools, ['cakes']);
    });

    const normalizations = [
      ['zh-CN', 'zh'], ['zh_Hans', 'zh'], ['id-ID', 'id'], ['fr-FR', 'fr'], ['es-ES', 'es'], ['pt-PT', 'pt'], //
      ['vi-VN', 'vi'], ['hi-IN', 'hi'], ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['pl-PL', 'pl'], ['nl-NL', 'nl'], ['sv-SE', 'sv'],
      ['ky-KG', 'ky'], ['et-EE', 'et'], ['tk-TM', 'tk'], ['uk-UA', 'uk'],
    ];
    for (final [input, expected] in normalizations) {
      test('normalizes $input without assigning an account country', () {
        final snapshot = jsonEncode({'state': {'language': input, 'countryCode': 'AZ'}});
        expect(normalizeAppLanguage(input), expected);
        expect(languageFromWebStorage(userStoreJson: snapshot), expected);
        expect((jsonDecode(snapshot) as Map)['state']['countryCode'], 'AZ');
      });
    }

    test('recovers a separate language preference when its UI snapshot is damaged', () {
      expect(languageFromWebStorage(userStoreJson: '{bad', languageKey: 'fr-FR'), 'fr');
      expect(appLanguageLocale('pt'), 'pt-PT');
      expect(appLanguageLocale('zh'), 'zh-CN');
      expect(languageFromWebStorage(), 'az');
    });

    for (final language in kPackLanguageCodes) {
      test('has complete SDK-free language and retry text for $language', () {
        for (final key in ['selectLanguage', 'selectCountry', 'searchPlaceholder', 'noneFound', 'continue', 'languageHint', 'back', 'updateRequired', 'connectionPending', 'retry']) {
          expect(startupText(language, key, 'MISSING'), isNot('MISSING'), reason: key);
        }
        expect(appLanguage(language).nativeName, isNotEmpty);
      });
    }
  });

  group('community language inference', () {
    const cases = [
      ['宝宝今天睡得很好', 'zh'], ['Saya sedang hamil dan bayi saya sehat', 'id'],
      ['Bonjour les mamans, comment va votre bébé ?', 'fr'], ['Hola, estoy embarazada y mi bebé está bien', 'es'],
      ['Olá, estou grávida e o meu bebé está bem', 'pt'], ['Ça va bien avec votre bébé ?', 'fr'],
      ['Mən hamiləyəm və çox xoşbəxtəm', 'az'], ['Bebeğim çok iyi uyuyor ve ben mutluyum', 'tr'],
      ['Tôi đang mang thai và em bé của tôi khỏe mạnh', 'vi'], ['मेरा बच्चा आज अच्छी तरह सोया है', 'hi'],
      ['赤ちゃんは今日よく眠っています', 'ja'], ['아기가 오늘 잘 자고 있어요', 'ko'],
      ['Jestem w ciąży i moje dziecko ma się dobrze', 'pl'], ['Mijn baby slaapt goed en ik ben blij', 'nl'],
      ['Jag är gravid och mitt barn mår bra', 'sv'],
    ];
    for (final [text, expected] in cases) {
      test('infers $text as $expected', () => expect(detectLang(text, 'az'), expected));
    }
    test('preserves uncertain text and prioritizes without filtering other languages', () {
      expect(detectLang('❤️', 'fr'), 'fr');
      expect(detectLang('妊娠初期', 'ja'), 'ja');
      expect(defaultFeedLanguages('PT', 'id'), ['id']);
      expect(defaultFeedLanguages('AZ', 'zh'), ['zh']);
    });
  });

  group('new-language count grammar', () {
    test('uses Polish, Dutch and Swedish singular/plural unit forms', () {
      expect(formatCountUnit('pl', '{count} days', {'count': 1}), '1 dzień');
      expect(formatCountUnit('pl', '{count} days', {'count': 2}), '2 dni');
      expect(formatCountUnit('pl', '{count} days', {'count': 5}), '5 dni');
      expect(formatCountUnit('nl', '{count} gün', {'count': 1}), '1 dag');
      expect(formatCountUnit('nl', '{count} gün', {'count': 2}), '2 dagen');
      expect(formatCountUnit('sv', '{count} days', {'count': 1}), '1 dygn');
      expect(formatCountUnit('sv', '{count} days', {'count': 2}), '2 dygn');
      expect(formatCountUnit('sv', '{count} hours', {'count': 1}), '1 timme');
      expect(formatCountUnit('sv', '{count} hours', {'count': 2}), '2 timmar');
    });
    test('does not reinterpret prices, arbitrary sentences or existing-language labels', () {
      expect(formatCountUnit('pl', r'${price}', {'price': 19.99}), isNull);
      expect(formatCountUnit('pl', 'Wait {count} days', {'count': 2}), isNull);
      expect(formatCountUnit('en', '{count} days', {'count': 1}), isNull);
      expect(getOrdinal(1, 'sv'), '1:a');
      expect(getOrdinal(12, 'sv'), '12:e');
      expect(getOrdinal(21, 'sv'), '21:a');
      expect(getOrdinal(3, 'pl'), '3.');
    });
  });

  group('source-bound public content packs', () {
    final row = <String, dynamic>{'id': 'public-fixture', 'description': 'Source text: 3 mg', 'description_en': 'Source text: 3 mg'};
    final key = contentTranslationKey(row, 'description')!;
    final files = buildLanguagePacks({
      'schema': 'anacan-content-translations-v1',
      'language': 'fr',
      'sourceHash': 'a' * 64,
      'values': {key: 'Texte source : 3 mg'},
    }).files;
    (List<String>, ContentPackLoader) loader() {
      final calls = <String>[];
      return (
        calls,
        ContentPackLoader(
          baseUrl: '',
          languages: kPackLanguageCodes,
          fetchPack: (url, {required fresh, required timeout}) async {
            calls.add(url);
            for (final file in files) {
              if (url.endsWith('/content-packs/${file.path}')) return file.text;
            }
            throw StateError('404');
          },
          store: MemoryPackStore(),
        )
      );
    }

    test('coalesces loads, translates exact public rows and refuses an edited source', () async {
      final (calls, cache) = loader();
      await Future.wait([cache.prepare('fr'), cache.prepare('fr')]);
      cache.lookup(row, 'description', 'fr');
      cache.lookup(row, 'description', 'fr');
      await cache.settled('fr');
      expect(calls, hasLength(2)); // manifest + one shard
      expect(cache.lookup(row, 'description', 'fr'), 'Texte source : 3 mg');
      expect(cache.lookup({...row, 'description': 'Source text: 30 mg'}, 'description', 'fr'), isNull);
      expect(cache.lookup({...row, 'id': 'another-row'}, 'description', 'fr'), isNull);
      expect(cache.lookup({...row, 'description_en': 'Edited'}, 'description', 'fr'), isNull);
      expect(row['description'], 'Source text: 3 mg');
    });

    test('ignores languages without packs and missing languages on the server', () async {
      final (_, cache) = loader();
      await cache.prepare('az');
      await cache.prepare('zh');
      expect(cache.lookup(row, 'description', 'zh'), isNull);
    });
  });
}
