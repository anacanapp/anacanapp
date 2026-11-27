// Ported from: src/components/paywall/PaywallCore.offers.test.tsx, PaywallCore.recovery.test.tsx,
// src/components/premium/AdFreePremiumOffer.test.tsx, src/components/premium/PremiumToolBoundary.test.tsx
import 'package:anacan/features/onboarding/onboarding_i18n.dart';
import 'package:anacan/features/premium/ad_free_premium_offer.dart';
import 'package:anacan/features/premium/paywall_core.dart';
import 'package:anacan/features/premium/premium_gates.dart';
import 'package:anacan/features/premium/premium_modal.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../onboarding/support.dart';

Future<void> pumpFor(WidgetTester tester, [int ms = 600]) async {
  for (var i = 0; i < ms ~/ 50; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<void> tapText(WidgetTester tester, String text) async {
  final f = find.text(text).last;
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f, warnIfMissed: false);
  await tester.pump();
}

Semantics? toggled(WidgetTester tester, String plan) => tester.widget<Semantics>(find.byKey(ValueKey('plan-$plan')));

void main() {
  group('PaywallCore', () {
    Future<(OnboardingTestEnv, List<String>)> mount(WidgetTester tester, {double intro = 19.99, int eligibility = 2, bool serverPro = true, void Function(OnboardingTestEnv)? setup}) async {
      final env = OnboardingTestEnv(language: 'en', native: true)
        ..intro = intro
        ..eligibility = eligibility
        ..serverPro = serverPro;
      setup?.call(env);
      addTearDown(env.dispose);
      final done = <String>[];
      await tester.pumpWidget(env.wrap(SingleChildScrollView(child: PaywallCore(onPurchased: done.add))));
      await pumpFor(tester);
      return (env, done);
    }

    testWidgets('shows the 29.99 to 19.99 annual offer and buys the displayed paid intro instead of the base plan', (tester) async {
      final (env, done) = await mount(tester);
      expect(find.text('Mərhələnizə uyğun bütün alətlər bir yerdə'), findsOneWidget);
      expect(find.text('46 000+ yükləmə'), findsOneWidget);
      expect(find.textContaining(RegExp('pulsuz sına|free trial', caseSensitive: false)), findsNothing);
      expect(find.text(r'$29.99'), findsOneWidget); // struck renewal price
      expect(find.text('33% QƏNAƏT'), findsOneWidget);
      await tapText(tester, 'Get Premium');
      await pumpFor(tester);
      expect(done, ['yearly']);
      expect(env.sdk.count('purchasePackage'), 1);
      expect(env.sdk.count('checkTrialOrIntroductoryPriceEligibility'), greaterThanOrEqualTo(2), reason: 'eligibility rechecked right before the purchase');
    });

    testWidgets('blocks an automatic free trial while leaving the paid monthly option usable', (tester) async {
      final (env, done) = await mount(tester, intro: 0);
      expect(toggled(tester, 'monthly')!.properties.toggled, isTrue);
      expect(toggled(tester, 'yearly')!.properties.toggled, isFalse);
      await tapText(tester, 'Get Premium');
      await pumpFor(tester);
      expect(done, ['monthly']);
      final bought = env.sdk.callsOf('purchasePackage').single.args.single as Map;
      expect((bought['product'] as Map)['identifier'], 'com.atlasoon.anacan.premium.monthly');
    });

    testWidgets('offers a visible retry when offerings could not be loaded', (tester) async {
      final (env, _) = await mount(tester, setup: (env) => env.sdk.onGetOfferings = () => {'all': <String, Object?>{}, 'current': null});
      expect(find.text('Qiymətləri yükləmək alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.'), findsOneWidget);
      final before = env.sdk.count('getOfferings');
      await tapText(tester, 'Yenidən cəhd et');
      await pumpFor(tester);
      expect(env.sdk.count('getOfferings'), before + 1);
    });

    testWidgets('offers "refresh status" while the server confirmation is pending and keeps the CTA closed', (tester) async {
      final (env, done) = await mount(tester, serverPro: false);
      await tapText(tester, 'Get Premium');
      await pumpFor(tester, 12000);
      expect(done, isEmpty);
      final cta = tester.widget<Semantics>(find.byWidgetPredicate((w) => w is Semantics && w.properties.label == 'Get Premium'));
      expect(cta.properties.enabled, isFalse);
      env.serverPro = true;
      await tapText(tester, onboardingText('en', 'refresh_status'));
      await pumpFor(tester, 1000);
      expect(done, ['restore']);
      expect(env.sdk.count('purchasePackage'), 1, reason: 'a pending payment is never charged twice');
    });

    testWidgets('keeps the yearly plan buyable with both prices when intro eligibility is unknown', (tester) async {
      final (env, done) = await mount(tester, eligibility: 0);
      expect(find.textContaining(r'İlk il $19.99; bu təklifə uyğun deyilsinizsə $29.99'), findsWidgets);
      expect(toggled(tester, 'yearly')!.properties.toggled, isTrue);
      await tapText(tester, 'Get Premium');
      await pumpFor(tester);
      expect(done, ['yearly']);
      expect(env.sdk.count('purchasePackage'), 1);
    });

    testWidgets('shows the monthly renewal disclosure and passes the Premium source to the purchase', (tester) async {
      final (env, done) = await mount(tester, setup: (env) => env.setEntitlement(const PremiumEntitlement(householdPremium: true, ready: true)));
      await tester.tap(find.byKey(const ValueKey('plan-monthly')));
      await tester.pump();
      expect(find.textContaining(onboardingText('en', 'renewal_month', {'price': r'$3.99'})), findsOneWidget);
      await tapText(tester, 'Get Premium');
      await pumpFor(tester);
      expect(done, isEmpty);
      expect(env.sdk.count('purchasePackage'), 0, reason: 'household Premium is never charged again in the store');
      expect(find.text(purchaseErrorMessage('PREMIUM_SOURCE_HOUSEHOLD')), findsOneWidget);
    });

    testWidgets('formats the per-month equivalent with Intl in the store currency', (tester) async {
      await mount(tester, eligibility: 1);
      expect(find.textContaining(r'$2.50/ay'), findsOneWidget);
    });
  });

  group('AdFreePremiumOffer', () {
    Widget dashboard() => const Column(children: [AdFreePremiumOffer(position: 'top'), Text('Dashboard content'), AdFreePremiumOffer(position: 'bottom')]);
    OnboardingTestEnv envFor(String language) {
      final env = OnboardingTestEnv(language: language);
      env.container.read(userStoreProvider.notifier).setLanguage(language);
      return env;
    }

    for (final language in onboardingLanguages) {
      testWidgets('$language offers ad-free Premium with translated copy', (tester) async {
        final env = envFor(language);
        addTearDown(env.dispose);
        await tester.pumpWidget(env.wrap(dashboard()));
        await tester.pump();
        expect(find.text(onboardingText(language, 'remove_ads_premium')), findsOneWidget);
        await tester.tap(find.text(onboardingText(language, 'premium_cta')));
        await pumpFor(tester, 400);
        expect(find.byType(PremiumModalView), findsOneWidget);
        expect(tester.widget<PremiumModalView>(find.byType(PremiumModalView)).feature, 'ad_free');
      });
    }

    testWidgets('hides the offer for active or household Premium and while entitlement is unknown', (tester) async {
      final env = envFor('az');
      addTearDown(env.dispose);
      env.setSubscription(const SubscriptionState(loading: true));
      await tester.pumpWidget(env.wrap(dashboard()));
      expect(find.byKey(const ValueKey('ad-free-premium-offer')), findsNothing);
      env.setSubscription(const SubscriptionState(isPremium: true, householdPremium: true));
      await tester.pump();
      expect(find.byKey(const ValueKey('ad-free-premium-offer')), findsNothing);
      env.setSubscription(const SubscriptionState());
      await tester.pump();
      expect(find.byKey(const ValueKey('ad-free-premium-offer')), findsOneWidget);
    });

    testWidgets('keeps the first visible card at the top for that visit, then permanently uses the bottom on return', (tester) async {
      final env = envFor('az');
      addTearDown(env.dispose);
      Finder card() => find.byKey(const ValueKey('ad-free-premium-offer'));
      double cardY() => tester.getTopLeft(card()).dy;
      double contentY() => tester.getTopLeft(find.text('Dashboard content')).dy;
      await tester.pumpWidget(env.wrap(dashboard()));
      await tester.pump();
      expect(card(), findsOneWidget);
      expect(cardY() < contentY(), isTrue, reason: 'top');
      await tester.pump();
      expect(cardY() < contentY(), isTrue, reason: 'still top for this visit');
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(env.wrap(KeyedSubtree(key: UniqueKey(), child: dashboard())));
      await tester.pump();
      expect(card(), findsOneWidget);
      expect(cardY() > contentY(), isTrue, reason: 'bottom on return');
      expect(env.container.read(localStoreProvider).getItem(adFreeOfferScope(backend, actor)), '1');
    });

    testWidgets('does not consume the top introduction until the card is actually visible', (tester) async {
      final env = OnboardingTestEnv(extra: [
        adFreeOfferVisibilityProvider.overrideWithValue(({required key, required child, required onHalfVisible}) => KeyedSubtree(key: key, child: child)),
      ]);
      addTearDown(env.dispose);
      await tester.pumpWidget(env.wrap(dashboard()));
      await tester.pump();
      expect(env.container.read(localStoreProvider).getItem(adFreeOfferScope(backend, actor)), isNull);
    });
  });

  group('PremiumToolBoundary', () {
    testWidgets('never mounts a paid tool for a free or expired account', (tester) async {
      final env = OnboardingTestEnv();
      addTearDown(env.dispose);
      await tester.pumpWidget(env.wrap(PremiumToolBoundary(onClose: () {}, child: const Text('Paid tool'))));
      await pumpFor(tester, 400);
      expect(find.text('Paid tool'), findsNothing);
      expect(find.byType(PremiumModalView), findsOneWidget);
    });
    testWidgets('unmounts ongoing paid activity and opens the standard paywall on revocation', (tester) async {
      final env = OnboardingTestEnv();
      addTearDown(env.dispose);
      env.setSubscription(const SubscriptionState(isPremium: true, ownPremium: true));
      await tester.pumpWidget(env.wrap(PremiumToolBoundary(onClose: () {}, child: const Text('Paid tool'))));
      expect(find.text('Paid tool'), findsOneWidget);
      env.setSubscription(const SubscriptionState(entitlementReady: true));
      await pumpFor(tester, 400);
      expect(find.text('Paid tool'), findsNothing);
      expect(find.byType(PremiumModalView), findsOneWidget);
    });
    testWidgets('keeps the user in the tool after a purchase from its paywall (closes only the paywall)', (tester) async {
      final env = OnboardingTestEnv(native: true);
      addTearDown(env.dispose);
      var closed = 0;
      await tester.pumpWidget(env.wrap(PremiumToolBoundary(onClose: () => closed++, child: const Text('Paid tool'))));
      await pumpFor(tester);
      await tapText(tester, onboardingText('az', 'premium_cta'));
      await pumpFor(tester);
      expect(find.text('Paid tool'), findsOneWidget);
      expect(closed, 0);
    });
  });

  group('PremiumGate / PremiumBlurGate', () {
    testWidgets('Premium sees the content; free users get the locked card that opens the paywall', (tester) async {
      final env = OnboardingTestEnv();
      addTearDown(env.dispose);
      await tester.pumpWidget(env.wrap(const Column(children: [
        PremiumGate(title: 'Həftəlik statistika', feature: 'weekly_stats', child: Text('secret stats')),
        PremiumBlurGate(feature: 'parenting_quiz', child: Text('secret quiz')),
      ])));
      await pumpFor(tester, 400);
      expect(find.text('secret stats'), findsNothing);
      expect(find.text('secret quiz'), findsNothing, reason: 'the teaser is a skeleton, never the real content');
      expect(find.text('Həftəlik statistika'), findsOneWidget);
      expect(find.text('PREMIUM'), findsOneWidget);
      env.setSubscription(const SubscriptionState(isPremium: true));
      await tester.pump();
      expect(find.text('secret stats'), findsOneWidget);
      expect(find.text('secret quiz'), findsOneWidget);
    });
  });
}
