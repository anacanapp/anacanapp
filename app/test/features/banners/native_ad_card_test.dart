// Ported from: src/components/banners/NativeAdCard.test.tsx
import 'dart:io';

import 'package:anacan/features/banners/brand_targeting.dart';
import 'package:anacan/features/banners/ui/native_ad_card.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

const ad = NativeAdContent(
  title: 'Pulsuz nümunə',
  description: 'Körpəniz üçün',
  buttonText: 'Sifariş et',
  imageUrl: 'https://cdn.example/a.webp',
  backgroundColor: '#1B3A5C',
  textColor: '#1B3A5C',
  linkType: 'external',
  creativeOptions: {'offer_code': 'ANA10', 'expert_name': 'Dr. Leyla', 'expert_role': 'Pediatr'},
);

NativeAdContent withTemplate(String? template, {String? imageUrl}) => NativeAdContent(
      title: ad.title,
      description: ad.description,
      buttonText: ad.buttonText,
      imageUrl: imageUrl ?? ad.imageUrl,
      backgroundColor: ad.backgroundColor,
      textColor: ad.textColor,
      linkType: ad.linkType,
      creativeOptions: ad.creativeOptions,
      nativeTemplate: template,
    );

void main() {
  group('native ad templates', () {
    screenTest('renders every template as one accessible button with the brand copy', (tester) async {
      for (final template in kNativeTemplates) {
        var taps = 0;
        await pumpApp(tester, NativeAdCard(ad: withTemplate(template), sponsorLabel: 'Sponsorlu · Brand', codeLabel: 'Kod', onTap: () => taps++));
        expect(find.byKey(ValueKey<String>('native-ad-$template')), findsOneWidget);
        expect(find.text('Pulsuz nümunə'), findsOneWidget);
        expect(find.text('Sponsorlu · Brand'), findsOneWidget);
        await tester.tap(find.byKey(ValueKey<String>('native-ad-$template')));
        expect(taps, 1);
      }
    });

    screenTest('shows template-specific content and only safe https images', (tester) async {
      await pumpApp(tester, NativeAdCard(ad: withTemplate('offer'), codeLabel: 'Kod'));
      expect(find.text('ANA10'), findsOneWidget);
      await pumpApp(tester, NativeAdCard(ad: withTemplate('expert')));
      expect(find.text('Dr. Leyla'), findsOneWidget);
      expect(find.text('Pediatr'), findsOneWidget);
      await pumpApp(tester, NativeAdCard(ad: withTemplate('spotlight', imageUrl: 'javascript:alert(1)')));
      expect(find.byKey(const ValueKey<String>('creative-image')), findsNothing);
    });

    screenTest('falls back to classic for unknown templates with a legible brand-coloured surface', (tester) async {
      expect(nativeTemplate('carousel'), 'classic');
      expect(nativeTemplate(null), 'classic');
      await pumpApp(tester, NativeAdCard(ad: withTemplate('carousel')));
      expect(find.byKey(const ValueKey<String>('native-ad-classic')), findsOneWidget);
      expect(readableOn(ad.backgroundColor!, ad.textColor), '#FFFFFF');
    });

    test('keeps brand text legible on the brand colour in light and dark themes', () {
      expect(readableOn('#1B3A5C', '#1B3A5C'), '#FFFFFF');
      expect(readableOn('#FFE680', '#FFFFFF'), '#1A1A1A');
      expect(readableOn('#F48155', '#FFFFFF'), '#1A1A1A');
      expect(readableOn('#0B3D2E', '#F5F5F5'), '#F5F5F5');
      expect(contrastRatio('#000000', '#FFFFFF'), closeTo(21, 0.5));
    });

    test('holds no literal UI copy, so it can be shared with the web-only brand portal', () {
      final card = File('lib/features/banners/ui/native_ad_card.dart').readAsStringSync();
      final sheet = File('lib/features/banners/ui/lead_form_sheet.dart').readAsStringSync();
      for (final source in [card, sheet]) {
        expect(source, isNot(contains('core/i18n')));
        expect(source, isNot(contains(RegExp(r'\btr\('))));
      }
      expect(card, isNot(matches(RegExp(r'supabase|core/data|BackdropFilter|repeat\('))));
    });
  });
}
