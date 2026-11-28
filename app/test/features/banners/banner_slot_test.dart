// Ported from: src/components/banners/BannerSlot.v3.test.tsx
import 'package:anacan/features/banners/data/banners_repository.dart';
import 'package:anacan/features/banners/ui/banner_slot.dart';
import 'package:anacan/features/banners/ui/lead_form_sheet.dart';
import 'package:flutter/widgets.dart' hide Banner;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

class FakeSource implements BannersSource {
  FakeSource(this.rows);
  final List<Map<String, dynamic>> rows;
  final List<String> impressionsFired = [];
  final List<String> clicks = [];
  @override
  Future<List<Map<String, dynamic>>> rpc(String name, Map<String, Object?> args) async => rows;
  @override
  Future<List<Map<String, dynamic>>> table({String? placement, String? lifeStage, required String language, String? countryCode}) async => rows;
  @override
  Future<List<Map<String, dynamic>>> impressions(String userId, List<String> bannerIds) async => const [];
  @override
  Future<void> incrementClick(String id) async => clicks.add(id);
  @override
  Future<void> incrementImpression(String id) async => impressionsFired.add(id);
}

class FakeLeadSource implements LeadFormSource {
  final List<String> opened = [];
  @override
  Future<Object?> fetchForm(String bannerId, String language) async {
    opened.add(bannerId);
    return null;
  }

  @override
  Future<Map<String, dynamic>?> submit({required String bannerId, String? deliveryId, required Map<String, String> answers, required String language, required String request}) async =>
      null;
}

Map<String, dynamic> base(Map<String, dynamic> patch) => {
      'id': 'b',
      'title': 'Brand title',
      'placement': 'home_top',
      'banner_type': 'native',
      'link_type': 'external',
      'link_url': 'https://brand.example',
      'is_premium_only': false,
      'branded': true,
      'sponsor_name': 'Brand',
      ...patch,
    };

Map<String, dynamic> own(Map<String, dynamic> patch) => base({'branded': false, 'sponsor_name': null, ...patch});

class Slot {
  Slot(this.rows, {this.premium = false});
  final List<Map<String, dynamic>> rows;
  final bool premium;
  late final FakeSource source = FakeSource(rows);
  final lead = FakeLeadSource();
  final launched = <String>[];

  List<Override> get overrides => [
        ...baseOverrides(signedIn: false),
        bannersSourceProvider.overrideWithValue(source),
        bannersInputsProvider.overrideWithValue((backend: 'http://backend', language: 'az', lifeStage: null, countryCode: 'AZ', userId: null)),
        bannerPremiumProvider.overrideWithValue(premium),
        bannerPlatformProvider.overrideWithValue('web'),
        leadFormSourceProvider.overrideWithValue(lead),
        bannerExternalLauncherProvider.overrideWithValue((url) async => launched.add(url)),
      ];

  Future<void> pump(WidgetTester tester) async {
    await pumpApp(tester, const BannerSlot(placement: 'home_top'), overrides: overrides);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }
}

void main() {
  group('BannerSlot with anacan-brand-ads-v3 creatives', () {
    screenTest('shows a brand ad to Premium members only when the brand targets the Premium tier', (tester) async {
      await Slot([
        base({'id': 'both', 'title': 'Both tiers', 'measurement_version': 3, 'audience_tiers': ['free', 'premium'], 'native_template': 'spotlight'}),
        base({'id': 'free', 'title': 'Free only', 'measurement_version': 3, 'audience_tiers': ['free']}),
        base({'id': 'legacy', 'title': 'Legacy v2', 'measurement_version': 2}),
      ], premium: true)
          .pump(tester);
      expect(find.text('Both tiers'), findsOneWidget);
      expect(find.text('Free only'), findsNothing);
      expect(find.text('Legacy v2'), findsNothing);
    });

    screenTest('keeps legacy free-user behaviour and renders the chosen v3 template', (tester) async {
      await Slot([
        base({'id': 'tpl', 'title': 'Offer', 'measurement_version': 3, 'audience_tiers': ['free'], 'native_template': 'offer', 'creative_options': {'offer_code': 'ANA10'}}),
        base({'id': 'premium-only', 'title': 'Premium only', 'measurement_version': 3, 'audience_tiers': ['premium']}),
        base({'id': 'legacy', 'title': 'Legacy v2', 'measurement_version': 2}),
      ]).pump(tester);
      expect(find.byKey(const ValueKey<String>('native-ad-offer')), findsOneWidget);
      expect(find.text('ANA10'), findsOneWidget);
      expect(find.text('Premium only'), findsNothing);
      expect(find.text('Legacy v2'), findsOneWidget);
    });

    screenTest('opens the in-app lead form instead of navigating for lead-form creatives', (tester) async {
      final slot = Slot([
        base({'id': 'lead', 'title': 'Get a sample', 'link_type': 'lead_form', 'link_url': null, 'lead_form': true, 'measurement_version': 3, 'audience_tiers': ['free'], 'native_template': 'minimal'}),
      ]);
      await slot.pump(tester);
      expect(find.byKey(const ValueKey<String>('brand-lead-sheet')), findsNothing);
      await tester.tap(find.text('Get a sample'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byKey(const ValueKey<String>('brand-lead-sheet')), findsOneWidget);
      expect(slot.lead.opened, ['lead']);
      expect(slot.launched, isEmpty);
    });

    screenTest('ignores lead-form links that the server did not mark as live', (tester) async {
      final slot = Slot([
        base({'id': 'lead', 'title': 'Not live', 'link_type': 'lead_form', 'link_url': null, 'lead_form': false, 'measurement_version': 3, 'audience_tiers': ['free']}),
      ]);
      await slot.pump(tester);
      await tester.tap(find.text('Not live'));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byKey(const ValueKey<String>('brand-lead-sheet')), findsNothing);
    });

    screenTest('hides own free-tier upsell banners from Premium members', (tester) async {
      final rows = [
        own({'id': 'upsell', 'title': 'Go Premium', 'audience_tiers': ['free']}),
        own({'id': 'all', 'title': 'For everyone'}),
      ];
      await Slot(rows, premium: true).pump(tester);
      expect(find.text('Go Premium'), findsNothing);
      expect(find.text('For everyone'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await Slot(rows).pump(tester);
      expect(find.text('Go Premium'), findsOneWidget);
    });

    screenTest('shows platform-targeted banners only on that platform', (tester) async {
      final slot = Slot([
        own({'id': 'ios', 'title': 'iOS only', 'target_platforms': ['ios']}),
        own({'id': 'web', 'title': 'Web and Android', 'target_platforms': ['web', 'android']}),
      ]);
      await slot.pump(tester);
      expect(find.text('iOS only'), findsNothing);
      expect(find.text('Web and Android'), findsOneWidget);
      expect(slot.source.impressionsFired, ['web']);
    });
  });
}
