// Ported from: src/components/ProfileScreen.tsx (Premium card → `billing` for a Premium user),
//              src/components/BillingScreen.tsx (store reads) — regression for the owner's iPhone report: a Premium
//              user tapping the Premium card in Profile closed the app.
//
// Root cause: "My Subscription" read the store SDK (getCustomerInfo / getProducts) straight away, before the SDK
// was configured. The managed (Google) backend configures RevenueCat only once a paywall binds the signed-in
// account, which a Premium user never opens; the native iOS SDK answers an unconfigured call with fatalError.
// Here the whole app runs with a store SDK that fails the test on any read before configure.
import 'package:anacan/app/anacan_app.dart';
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/billing/billing_screen.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/native/purchases/web_premium_client.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart' show SizedBox;
import 'package:flutter_test/flutter_test.dart';

import '../support/i18n_fakes.dart';
import 'app_test_support.dart';

void main() {
  setUp(() {
    installTestI18n();
    GateHost.brandSplashShown = false;
  });

  testWidgets('Premium user: Profile → Premium card opens My Subscription without an unconfigured store call', (tester) async {
    final sdk = FakePurchasesSdk();
    var configured = false;
    final unconfigured = <String>[];
    sdk.onConfigure = (_, _) => configured = true;
    sdk.onGetCustomerInfo = () {
      if (!configured) unconfigured.add('getCustomerInfo');
      return customerInfoWith();
    };
    sdk.onGetProducts = (_) {
      if (!configured) unconfigured.add('getProducts');
      return const [];
    };
    sdk.onPresentCustomerCenter = () {
      if (!configured) unconfigured.add('presentCustomerCenter');
    };

    await tester.pumpWidget(AnacanApp(
      createContainer: () => testAppContainer(extra: [
        purchasesSdkProvider.overrideWithValue(sdk),
        webPremiumClientProvider.overrideWithValue(WebPremiumClient((_) async => const DbResult<Object?>(data: {'ok': false}))),
        // Production native build on the managed backend: RevenueCat on, bound only to an authenticated UUID.
        revenueCatEnvironmentProvider.overrideWithValue(const RevenueCatEnvironment(
          platform: 'ios',
          isNative: true,
          azurePreview: true,
          azureRevenueCatEnabled: true,
          config: RevenueCatConfig(iosApiKey: 'appl_fixture', androidApiKey: 'goog_fixture', apiKey: 'x'),
        )),
        subscriptionProvider.overrideWithValue(const SubscriptionState(
          isPremium: true,
          ownPremium: true,
          entitlementReady: true,
          subscription: {'plan_type': 'premium', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z', 'expires_at': '2026-12-10T10:00:00Z'},
        )),
      ]),
      runStartup: FakeStartup([fakeReady()]).call,
      prepare: noPrepare,
      watchAdmission: false,
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    final container = tester.state<AnacanAppState>(find.byType(AnacanApp)).container!;
    container.read(shellProvider.notifier).setTab(ShellTab.profile);
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }

    final card = find.text('Anacan Premium ✨');
    expect(card, findsOneWidget);
    await tester.tap(card);
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }

    expect(tester.takeException(), isNull);
    expect(find.byType(BillingScreen), findsOneWidget);
    expect(unconfigured, isEmpty, reason: 'an unconfigured native RevenueCat SDK stops the iOS app');

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
