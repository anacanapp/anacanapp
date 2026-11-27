// Ported from: src/lib/app-languages.ts (APP_LANGUAGES, 25 locale tags) — no vitest file; checks that every app
// language gets framework localizations (fallback tables where flutter_localizations has none).
import 'package:anacan/app/localization.dart';
import 'package:anacan/core/i18n/app_languages.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  test('the 25 app languages are the supported locales, bundle order', () {
    expect(kAppSupportedLocales, hasLength(25));
    expect(kAppSupportedLocales.map((l) => l.languageCode).toList(), kAppLanguageCodes);
    expect(kAppSupportedLocales.first, const Locale('az', 'AZ'));
  });

  test('fallback locale: tk → ru, anything else unsupported → en', () {
    expect(fallbackLocaleFor(const Locale('tk', 'TM')).languageCode, 'ru');
    expect(fallbackLocaleFor(const Locale('xx')).languageCode, 'en');
  });

  test('only languages without a framework table use the fallback', () {
    final material = GlobalMaterialLocalizations.delegate;
    final missing = kAppLanguages.where((l) => !material.isSupported(l.locale)).map((l) => l.code).toList();
    // flutter_localizations has no Turkmen tables.
    expect(missing, ['tk']);
  });

  for (final language in kAppLanguages) {
    testWidgets('${language.code}: Material + Cupertino + Widgets localizations load without throwing', (tester) async {
      late BuildContext captured;
      await tester.pumpWidget(MaterialApp(
        locale: language.locale,
        supportedLocales: kAppSupportedLocales,
        localizationsDelegates: kAppLocalizationsDelegates,
        home: Builder(builder: (context) {
          captured = context;
          return Directionality(textDirection: appDirectionFor(language.code), child: const SizedBox());
        }),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(Localizations.localeOf(captured), language.locale);
      final m = MaterialLocalizations.of(captured);
      expect(m.okButtonLabel, isNotEmpty);
      expect(m.formatShortDate(DateTime(2026, 3, 8)), isNotEmpty);
      expect(Directionality.of(captured), language.code == 'ar' ? TextDirection.rtl : TextDirection.ltr);
      if (language.code == 'tk') {
        // Russian table (the same bridge as the content fallback), not the English default.
        final ru = await GlobalMaterialLocalizations.delegate.load(const Locale('ru', 'RU'));
        expect(m.cancelButtonLabel, ru.cancelButtonLabel);
      }
    });
  }

  test('direction: only Arabic is RTL', () {
    for (final code in kAppLanguageCodes) {
      expect(appDirectionFor(code), code == 'ar' ? TextDirection.rtl : TextDirection.ltr, reason: code);
    }
  });
}
