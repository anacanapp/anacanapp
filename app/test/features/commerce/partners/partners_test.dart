// Ported from: (no React suite) src/components/partners/PartnersScreen.tsx, RedemptionQRSheet.tsx and
// src/hooks/usePartnerVenues.ts behaviour: country targeting, search, Premium gate, QR creation and its errors.
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/partners/partner_venues.dart';
import 'package:anacan/features/commerce/partners/partners_screen.dart';
import 'package:anacan/features/commerce/partners/qr_code.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import '../support.dart';

Map<String, dynamic> venue(String id, String name, {List<String>? countries, String? address}) => {
  'id': id, 'name': name, 'category_key': 'spa', 'description': 'Rahat spa', 'logo_url': null, 'cover_url': null, 'address': address, //
  'discount_label': '-20%', 'discount_terms': null, 'is_featured': false, 'countries': countries, 'latitude': null, 'longitude': null,
};

List<Override> _overrides(FakeCommerceBackend backend, {required bool premium, List<String>? paywall, List<String>? qr}) => commerceOverrides(
  backend,
  extra: [
    partnersIsPremiumProvider.overrideWithValue(premium),
    partnersPaywallProvider.overrideWithValue((context) async => paywall?.add('open')),
    qrCodeBuilderProvider.overrideWithValue((context, value, size) {
      qr?.add(value);
      return SizedBox(width: size, height: size, key: const ValueKey('qr'));
    }),
  ],
);

void main() {
  test('localizes category labels with the English and Azerbaijani fallbacks', () {
    final c = PartnerCategory({'key': 'spa', 'label_az': 'Spa', 'label_en': 'Spa EN', 'label_ru': 'Спа'});
    expect(localizeCategoryLabel(c, 'az'), 'Spa');
    expect(localizeCategoryLabel(c, 'ru'), 'Спа');
    expect(localizeCategoryLabel(c, 'de'), 'Spa EN');
    expect(localizeCategoryLabel(PartnerCategory({'key': 'x', 'label_az': 'Yalnız az'}), 'de'), 'Yalnız az');
  });

  screenTest('lists venues of the user country, filters by search and gates the QR behind Premium', (tester) async {
    final backend = FakeCommerceBackend()
      ..venues = [
        venue('v1', 'Lotus Spa', address: 'Nizami küç.'),
        venue('v2', 'Tbilisi Spa', countries: ['GE']),
        venue('v3', 'Fit Mama', countries: ['AZ']),
      ];
    final paywall = <String>[];
    await pumpApp(
      tester,
      PartnersScreen(onBack: () {}),
      overrides: _overrides(backend, premium: false, paywall: paywall),
      scroll: false,
    );
    await tester.pumpAndSettle();
    expect(find.text('Lotus Spa'), findsOneWidget);
    expect(find.text('Fit Mama'), findsOneWidget);
    expect(find.text('Tbilisi Spa'), findsNothing);
    await tester.enterText(find.byKey(const ValueKey('partners-search')), 'nizami');
    await tester.pump();
    expect(find.text('Lotus Spa'), findsOneWidget);
    expect(find.text('Fit Mama'), findsNothing);
    await tester.tap(find.text('Lotus Spa'));
    await tester.pumpAndSettle();
    expect(find.text('Premium ilə endirim al'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('venue-redeem')));
    await tester.pumpAndSettle();
    expect(paywall, ['open']);
  });

  screenTest('Premium members get a redemption QR with a countdown', (tester) async {
    final backend = FakeCommerceBackend(
      onInvoke: (_, _) => DbResult<Object?>(
        data: {
          'token': 't1', 'verify_url': 'https://app.anacan.az/p/v/t1', 'ttl_seconds': 300, 'venue_name': 'Lotus Spa', 'discount_label': '-20%', //
          'expires_at': DateTime.now().add(const Duration(minutes: 5)).toUtc().toIso8601String(),
        },
      ),
    )..venues = [venue('v1', 'Lotus Spa')];
    final qr = <String>[];
    await pumpApp(
      tester,
      PartnersScreen(onBack: () {}),
      overrides: _overrides(backend, premium: true, qr: qr),
      scroll: false,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lotus Spa'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('venue-redeem')));
    await tester.pump();
    await tester.pump();
    expect(backend.invokeCalls.single.$1, 'partner-create-redemption');
    expect(backend.invokeCalls.single.$2, {'venue_id': 'v1'});
    expect(qr.last, 'https://app.anacan.az/p/v/t1');
    expect(find.textContaining('Qalan vaxt: 4:5'), findsOneWidget);
  });

  screenTest('maps a server refusal to its message', (tester) async {
    final backend = FakeCommerceBackend(
      onInvoke: (_, _) => const DbResult<Object?>(error: FunctionException(status: 429, details: {'error': 'cooldown'}), status: 429),
    );
    await pumpApp(
      tester,
      Builder(
        builder: (context) => const RedemptionQrSheet(venueId: 'v1', venueName: 'Lotus Spa'),
      ),
      overrides: _overrides(backend, premium: true),
      scroll: false,
    );
    await tester.pumpAndSettle();
    expect(find.text('Bu məkanda hələ endirim istifadə etmisiniz. Bir az gözləyin.'), findsOneWidget);
  });
}
