// Ported from: (no React suite) — the commerce registration and wiring overrides.
import 'package:anacan/features/commerce/register.dart';
import 'package:anacan/features/home_mommy/mommy_home_slots.dart' show MommySlot;
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the commerce screens, the cakes tab and tool, the payment pages and the promo redeemer', () {
    final r = FeatureRegistry()..registerAll([registerCommerceFeature]);
    expect(r.screen(ScreenId.qaygicash), isNotNull);
    expect(r.screen(ScreenId.aptek), isNotNull);
    expect(r.screen(ScreenId.partners), isNotNull);
    expect(r.tool(ToolId.cakes), isNotNull);
    expect(r.routePage(OuterRouteId.paymentSuccess), isNotNull);
    expect(r.routePage(OuterRouteId.paymentError), isNotNull);
    // screen.referral belongs to the profile feature.
    expect(r.screen(ScreenId.referral), isNull);
    expect(() => registerCommerceFeature(r), throwsStateError);
  });

  test('exposes the wiring overrides and the slot builders', () {
    expect(commerceWiringOverrides(), hasLength(3));
    expect(commerceMommySlots.keys, containsAll([MommySlot.aptekHome, MommySlot.partnerHome]));
    expect(commercePaywallExtensions.epointOption, isNotNull);
    expect(commercePaywallExtensions.qaygiCashOption, isNotNull);
    expect(commercePaywallExtensions.qaygiCashEarnLine, isNotNull);
    expect(commercePaywallExtensions.sponsorEntry, isNotNull);
  });
}
