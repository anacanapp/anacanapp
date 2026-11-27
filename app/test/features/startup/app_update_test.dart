// Ported from: src/components/appUpdate/AppUpdate.test.tsx (update frequency, update texts, screens),
//              src/hooks/useAppUpdate.ts (isDecision), src/hooks/useForceUpdate.ts (config parsing)
import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/features/startup/startup.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';

const _base = <String, Object?>{
  'protocol': 'anacan-app-update-v1',
  'rule_id': 'r1',
  'mode': 'soft',
  'frequency': 'daily',
  'target_version': '51.0',
  'store_version': '51.0',
  'title': 'Yeni versiya hazırdır',
  'body': null,
  'whats_new': ['Yeni rəy bölməsi', 'Daha sürətli açılış'],
  'button': null,
  'later': null,
  'store_url': 'https://apps.apple.com/app/id6758301924',
};

AppUpdateDecision decision([Map<String, Object?> patch = const {}]) => AppUpdateDecision.tryParse({..._base, ...patch})!;

void main() {
  setUp(appUpdateShownThisLaunch.clear);

  group('update frequency', () {
    final now = DateTime.utc(2026, 11, 11, 12).millisecondsSinceEpoch;
    const h = 3600000;
    test('daily: shows again 24h after Later, not before', () {
      expect(softSheetAllowed(decision(), null, now), isTrue);
      expect(softSheetAllowed(decision(), now - 3 * h, now), isFalse);
      expect(softSheetAllowed(decision(), now - 25 * h, now), isTrue);
    });
    test('once: never again after Later', () {
      expect(softSheetAllowed(decision({'frequency': 'once'}), now - 40 * 86400000, now), isFalse);
    });
    test('banner and force rules never open the sheet', () {
      expect(softSheetAllowed(decision({'mode': 'banner'}), null, now), isFalse);
      expect(softSheetAllowed(decision({'mode': 'force'}), null, now), isFalse);
    });
    test('every_launch: once per process', () {
      final d = decision({'frequency': 'every_launch'});
      expect(softSheetAllowed(d, now, now), isTrue);
      appUpdateShownThisLaunch.add('r1');
      expect(softSheetAllowed(d, null, now), isFalse);
    });
  });

  group('update texts', () {
    test('has fixed labels in all 25 app languages', () {
      expect([...appUpdateTextLanguages]..sort(), [...kAppLanguageCodes]..sort());
      expect(updateText(AppUpdateText.later, 'ru'), 'Позже');
      expect(updateText(AppUpdateText.update, 'xx'), 'Yenilə'); // unknown codes normalise to the app default (az)
    });
  });

  group('decision parsing (isDecision)', () {
    test('valid decision', () {
      final d = decision();
      expect(d.mode, 'soft');
      expect(d.whatsNew, hasLength(2));
      expect(d.raw['rule_id'], 'r1');
    });
    test('rejects other protocols, modes and missing store urls', () {
      expect(AppUpdateDecision.tryParse({..._base, 'protocol': 'x'}), isNull);
      expect(AppUpdateDecision.tryParse({..._base, 'mode': 'nag'}), isNull);
      expect(AppUpdateDecision.tryParse({..._base, 'store_url': null}), isNull);
      expect(AppUpdateDecision.tryParse('nope'), isNull);
    });
    test('legacy force_update config', () {
      final c = ForceUpdateConfig.fromJson({'enabled': true, 'min_version': '50.0', 'title': 'T', 'android_url': 'a', 'ios_url': 'i'})!;
      expect(c.enabled, isTrue);
      expect(c.minVersion, '50.0');
      expect(c.message, isNull);
      expect(ForceUpdateConfig.fromJson(null), isNull);
    });
  });

  group('screens', () {
    setUpAll(loadAnacanFonts);

    Widget frame(Widget child, {bool dark = false}) => MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: GalleryFrame(dark: dark, child: child),
        );

    testWidgets('soft sheet lists what is new and calls Update / Later', (tester) async {
      var updates = 0;
      var laters = 0;
      await tester.pumpWidget(frame(AppUpdateSheet(
        decision: decision(),
        currentVersion: '49.0',
        isIos: true,
        language: 'az',
        onUpdate: () => updates++,
        onLater: () => laters++,
      )));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Yeni versiya hazırdır'), findsOneWidget);
      expect(find.text('49.0 → 51.0 · App Store'), findsOneWidget);
      expect(find.text('Daha sürətli açılış'), findsOneWidget);
      await tester.tap(find.text('Yenilə'));
      await tester.tap(find.text('Sonra'));
      expect(updates, 1);
      expect(laters, 1);
    });

    testWidgets('banner can be closed for this session', (tester) async {
      await tester.pumpWidget(frame(AppUpdateBanner(decision: decision({'mode': 'banner'}), language: 'az', onUpdate: () {})));
      expect(find.text('Yeni versiya hazırdır'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Sonra'));
      await tester.pump();
      expect(find.text('Yeni versiya hazırdır'), findsNothing);
    });

    testWidgets('force screen: rule texts, store by platform, version footer', (tester) async {
      final opened = <String>[];
      await tester.pumpWidget(frame(ForceUpdateScreen(
        title: null,
        message: '',
        androidUrl: 'https://play.google.com/x',
        iosUrl: 'https://apps.apple.com/x',
        currentVersion: '49.0',
        language: 'en',
        isIos: false,
        onOpenStore: opened.add,
      )));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Update required'), findsOneWidget);
      expect(find.text('This version of Anacan is no longer supported. Update the app to continue. Your data stays safe.'), findsOneWidget);
      expect(find.text('Google Play · Your version: 49.0'), findsOneWidget);
      await tester.tap(find.text('Update'));
      expect(opened, ['https://play.google.com/x']);
      await tester.pumpWidget(const SizedBox());
    });
  });
}
