// Ported from: src/components/tools/DoctorsHospitals.test.tsx, src/components/tools/ToolIconButtons.a11y.test.tsx
//              (ProviderReviews case)
import 'dart:ui' show Tristate;

import 'package:anacan/features/tools/doctors/doctors_hospitals.dart';
import 'package:anacan/features/tools/doctors/provider_reviews.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> provider([Map<String, dynamic> over = const {}]) => {
      'id': 'p1', 'name': 'Dr. A', 'name_az': 'Dr. A', 'provider_type': 'doctor', 'specialty': 'Endo', 'specialty_az': 'Endo',
      'description': 'Experience: 16 years\nLanguages: Azerbaijani\nEducation: Medical University\nCertificate: ESC\n\nLong bio.',
      'description_az': 'Təcrübə: 16 il', 'address': 'Nizami 1', 'address_az': 'Nizami 1', 'city': 'Baku', 'country_code': 'AZ',
      'phone': '+994 12 000 00 00', 'email': null, 'website': null, 'working_hours': null, 'services': null, 'image_url': null,
      'rating': 0, 'review_count': 0, 'latitude': null, 'longitude': null, 'is_featured': false, 'accepts_reservations': true, 'is_active': true,
      ...over,
    };

void main() {
  HealthHarness harness(List<Map<String, dynamic>> rows) => HealthHarness(user: {'language': 'en'}, tables: {'healthcare_providers': rows});

  toolTest('shows a translated profile as structured fields and replaces the disabled booking with call and directions', (tester) async {
    final h = harness([
      provider({'description_en': 'Experience: 16 years\nLanguages: Azerbaijani\nEducation: Medical University\nCertificate: ESC\n\nLong bio.'}),
    ]);
    await h.pump(tester, DoctorsHospitals(onBack: () {}));
    await tester.tap(find.text('Dr. A'));
    await settle(tester);
    expect(find.text('16 years'), findsOneWidget);
    expect(find.text('Azerbaijani'), findsOneWidget);
    final fields = find.byKey(const ValueKey('provider-profile-fields'));
    expect(find.descendant(of: fields, matching: find.text('Certificate')), findsOneWidget);
    expect(find.descendant(of: fields, matching: find.text('ESC')), findsOneWidget);
    expect(find.text('Long bio.'), findsOneWidget);
    expect(find.textContaining('Rezervasiya'), findsNothing);
    final actions = find.byKey(const ValueKey('provider-actions'));
    await tester.tap(find.descendant(of: actions, matching: find.byKey(const ValueKey('provider-call'))));
    await tester.tap(find.descendant(of: actions, matching: find.byKey(const ValueKey('provider-directions'))));
    expect(h.launched.first, Uri(scheme: 'tel', path: '+994 12 000 00 00'));
    expect(h.launched.last.toString(), startsWith('https://www.google.com/maps/dir/'));
  });

  toolTest('shows no action row when there is neither a phone nor an address', (tester) async {
    final h = harness([provider({'phone': null, 'address': null, 'address_az': null})]);
    await h.pump(tester, DoctorsHospitals(onBack: () {}));
    await tester.tap(find.text('Dr. A'));
    await settle(tester);
    expect(find.byKey(const ValueKey('provider-actions')), findsNothing);
    expect(find.textContaining('Rezervasiya'), findsNothing);
  });

  toolTest('lists only the providers of the account country, with the country name', (tester) async {
    final h = harness([provider(), provider({'id': 'p2', 'name': 'Dr. B', 'country_code': 'TR'})]);
    await h.pump(tester, DoctorsHospitals(onBack: () {}));
    expect(find.text('Dr. A'), findsOneWidget);
    expect(find.text('Dr. B'), findsNothing);
    expect(find.byKey(const ValueKey('healthcare-country')), findsOneWidget);
  });

  group('tool icon buttons have accessible names', () {
    toolTest('ProviderReviews: each rating star is a named, pressed-state button', (tester) async {
      final h = HealthHarness();
      await h.pump(tester, const ProviderReviews(providerId: 'p1', providerName: 'Klinika'));
      await tester.tap(find.text('Rəy yaz'));
      await settle(tester);
      for (var n = 1; n <= 5; n++) {
        expect(find.bySemanticsLabel('Qiymət: $n/5'), findsOneWidget);
      }
      await tester.tap(find.bySemanticsLabel('Qiymət: 4/5'));
      await settle(tester);
      expect(tester.getSemantics(find.bySemanticsLabel('Qiymət: 4/5')).flagsCollection.isToggled, Tristate.isTrue);
      expect(tester.getSemantics(find.bySemanticsLabel('Qiymət: 2/5')).flagsCollection.isToggled, Tristate.isFalse);
    });
  });
}
