// Ported from: src/components/InitialLanguageScreen.geo.test.tsx (case names kept) + language persistence,
//              country step and goldens.
import 'dart:async';

import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/features/entry/language/initial_language_screen.dart';
import 'package:anacan/state/user_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';
import 'support.dart';

List<String> selectedLangs(WidgetTester tester) => [
      for (final e in find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.startsWith('lang-selected-')).evaluate())
        '${(e.widget.key as ValueKey).value}'.substring('lang-selected-'.length),
    ];

Finder langTile(String code) => find.byKey(ValueKey('lang-tile-$code'));

void main() {
  setUpAll(loadAnacanFonts);

  group('InitialLanguageScreen IP preselect', () {
    late Completer<String?> geo;
    Future<void> pump(WidgetTester tester) async {
      final store = entryTestSetup();
      geo = Completer<String?>();
      await pumpEntry(tester, const InitialLanguageScreen(), overrides: baseOverrides(store, geo: () => geo.future));
    }

    testWidgets('preselects the language of the IP country', (tester) async {
      await pump(tester);
      expect(selectedLangs(tester), ['az']);
      geo.complete('TR');
      await flushAsync(tester);
      expect(selectedLangs(tester), ['tr']);
    });

    testWidgets('uses English when the country has no app language', (tester) async {
      await pump(tester);
      geo.complete('IT');
      await flushAsync(tester);
      expect(selectedLangs(tester), ['en']);
    });

    testWidgets('never overrides a language the user already tapped', (tester) async {
      await pump(tester);
      await tester.ensureVisible(langTile('de'));
      await tester.tap(langTile('de'));
      await tester.pump();
      geo.complete('RU');
      await flushAsync(tester);
      expect(selectedLangs(tester), ['de']);
    });

    testWidgets('keeps the old default when the country is unavailable', (tester) async {
      await pump(tester);
      geo.complete(null);
      await flushAsync(tester);
      expect(selectedLangs(tester), ['az']);
    });
  });

  group('language selection persistence', () {
    testWidgets('Continue persists the language, then the country step stores country + hasSelectedLanguage', (tester) async {
      final store = entryTestSetup();
      final platform = FakeUserStorePlatform();
      final c = await pumpEntry(tester, const InitialLanguageScreen(), overrides: baseOverrides(store, platform: platform));
      await tester.ensureVisible(langTile('ru'));
      await tester.tap(langTile('ru'));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('language-continue')));
      await flushAsync(tester);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(c.read(userStoreProvider).language, 'ru');
      expect(platform.languages, ['ru']);
      expect(store.getItem('language'), 'ru');
      // Step 2 in Russian (startup copy for legacy languages comes from the inline map).
      expect(find.text('Выберите страну'), findsOneWidget);
      expect(c.read(userStoreProvider).hasSelectedLanguage, isFalse);
      await tester.tap(find.byKey(const ValueKey('country-AZ')));
      await tester.pump();
      expect(c.read(userStoreProvider).countryCode, 'AZ');
      expect(c.read(userStoreProvider).hasSelectedLanguage, isTrue);
      expect(platform.prefs['anacan_has_selected_language'], 'true');
    });

    testWidgets('a failed dictionary load shows the connectionPending message and stays on step 1', (tester) async {
      final store = entryTestSetup();
      I18nRuntime.instance = I18nRuntime(store: TranslationStore(assets: _FailingAssets()));
      final c = await pumpEntry(tester, const InitialLanguageScreen(), overrides: baseOverrides(store));
      await tester.ensureVisible(langTile('fr'));
      await tester.tap(langTile('fr'));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('language-continue')));
      await flushAsync(tester);
      expect(find.text('Connexion en cours de préparation. Veuillez réessayer dans un instant.'), findsOneWidget);
      expect(c.read(userStoreProvider).language, 'az');
    });
  });

  group('country step', () {
    test('guessCountryFromLocales uses the region, or the likely region of a bare language', () {
      expect(guessCountryFromLocales(const [Locale('ru', 'RU')]), 'RU');
      expect(guessCountryFromLocales(const [Locale('de')]), 'DE');
      expect(guessCountryFromLocales(const [Locale('xx')]), isNull);
    });

    test('search matches English and localized names; the guess goes first without a query', () {
      expect(filterCountries('', 'TR', 'az').first.$1, 'TR');
      expect(filterCountries('almaniya', null, 'az').map((c) => c.$1), ['DE']);
      expect(filterCountries('germany', null, 'az').map((c) => c.$1), ['DE']);
      expect(filterCountries('zzzz', null, 'az'), isEmpty);
      expect(localizedCountryName('DE', 'ru'), 'Германия');
    });
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      testWidgets('language ${dark ? 'dark' : 'light'}', (tester) async {
        final store = entryTestSetup();
        await pumpEntry(tester, const InitialLanguageScreen(), overrides: baseOverrides(store), dark: dark);
        await expectGolden(tester, 'language_${dark ? 'dark' : 'light'}');
      });
    }
    testWidgets('language country step light', (tester) async {
      final store = entryTestSetup();
      await pumpEntry(tester, const InitialLanguageScreen(), overrides: baseOverrides(store));
      await tester.tap(find.byKey(const ValueKey('language-continue')));
      await flushAsync(tester);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      await expectGolden(tester, 'language_country_light');
    });
    testWidgets('language rtl', (tester) async {
      final store = entryTestSetup();
      await pumpEntry(tester, const InitialLanguageScreen(),
          overrides: baseOverrides(store, geo: () async => 'SA'), rtl: true);
      await flushAsync(tester);
      await expectGolden(tester, 'language_rtl');
    });
  });
}

class _FailingAssets implements I18nAssetSource {
  @override
  Future<Map<String, String>> load(String lang) async => throw StateError('offline');
}
