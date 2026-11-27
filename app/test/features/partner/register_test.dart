// Ported from: src/pages/Index.tsx (partner tabs, the partner-notifications screen, AlertReceiver)
import 'package:anacan/features/partner/partner_wiring.dart';
import 'package:anacan/features/partner/register.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the partner tabs, the notifications screen and the alert receiver', () {
    final r = FeatureRegistry()..registerAll([registerPartnerFeature]);
    expect(r.registeredIds, {'tab:home:partner', 'tab:together:partner', 'screen:partner-notifications', 'frame:partner-alert-receiver'});
    expect(r.tab(ShellTab.home, partner: true), isNotNull);
    expect(r.tab(ShellTab.home, partner: false), isNull);
    expect(r.screen(ScreenId.partnerNotifications), isNotNull);
  });

  test('wiring overrides one value per phase-6 seam', () {
    expect(partnerWiringOverrides(), hasLength(7));
  });
}
