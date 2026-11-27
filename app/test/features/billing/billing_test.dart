// Ported from: (no vitest suite for BillingScreen / CancellationReasonDialog / web-premium-client) â€” cases follow
//              the branches of src/components/BillingScreen.tsx, src/components/CancellationReasonDialog.tsx and
//              src/lib/web-premium-client.ts
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/data/data.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/billing/billing_model.dart';
import 'package:anacan/features/billing/billing_screen.dart';
import 'package:anacan/features/billing/billing_store.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/native/purchases/web_premium_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException, User;

import 'package:anacan/features/settings/ui/settings_ui.dart' show cssUpper;

import '../onboarding/support.dart';

const String pro = 'Anacan LLC Pro';

Map<String, Object?> info({
  String? original,
  Map<String, String?> purchases = const {},
  Map<String, Object?>? entitlement,
}) =>
    {
      'originalPurchaseDate': original,
      'allPurchaseDates': purchases,
      'entitlements': {
        'active': {pro: ?entitlement},
      },
    };

class FakeStore implements BillingStoreReader {
  FakeStore(this.info, {this.price});
  Map<String, Object?>? info;
  String? price;
  int reads = 0;
  @override
  Future<Map<String, Object?>?> customerInfo() async {
    reads++;
    return info;
  }

  @override
  Future<String?> priceString(String productId) async => price;
}

class FakeSubscriptionBackend implements SubscriptionBackend {
  final List<Map<String, dynamic>> cancellations = [];
  bool fail = false;
  @override
  Future<void> insertCancellation(Map<String, dynamic> row) async {
    if (fail) throw StateError('insert failed');
    cancellations.add(row);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

User user() => User(id: 'user-1', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

void main() {
  setUpAll(loadAnacanFonts);

  group('paymentHistoryFrom', () {
    test('original purchase, renewals (not the original twice) and the scheduled renewal first', () {
      final h = paymentHistoryFrom(
        info(
          original: '2026-01-10T10:00:00Z',
          purchases: {
            'com.atlasoon.anacan.premium.monthly': '2026-01-10T10:00:00.000Z',
            'com.atlasoon.anacan.premium.yearly': '2026-06-01T08:00:00Z',
            'empty': null,
          },
          entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'com.atlasoon.anacan.premium.yearly', 'expirationDate': '2027-06-01T08:00:00Z', 'willRenew': true},
        ),
        entitlementId: pro,
      );
      expect(h.entries.map((e) => e.type), ['next', 'renewal', 'original']);
      expect(h.entries.first.date, '2027-06-01T08:00:00Z');
      expect(h.entries.first.isYearly, isTrue);
      expect(h.entries.last.productId, 'original');
      expect(h.activeStore, 'PLAY_STORE');
      expect(h.activeProductId, 'com.atlasoon.anacan.premium.yearly');
    });

    test('no active entitlement: no store, no product, no scheduled renewal', () {
      final h = paymentHistoryFrom(info(original: '2025-01-01T00:00:00Z'), entitlementId: pro);
      expect(h.activeStore, isNull);
      expect(h.activeProductId, isNull);
      expect(h.entries.single.type, 'original');
    });

    test('a renewal that will not renew is not scheduled', () {
      final h = paymentHistoryFrom(info(entitlement: {'store': 'APP_STORE', 'expirationDate': '2027-01-01T00:00:00Z', 'willRenew': false}), entitlementId: pro);
      expect(h.entries, isEmpty);
      expect(h.activeStore, 'APP_STORE');
    });
  });

  group('BillingState', () {
    BillingState st({
      Map<String, dynamic>? sub = const {'plan_type': 'premium', 'status': 'active'},
      bool premium = true,
      bool own = true,
      bool household = false,
      bool cancelled = false,
      bool loading = false,
      String platform = 'android',
      WebPremiumState? web,
      bool storeRead = true,
      String? store,
      String? price,
    }) =>
        BillingState(
          subscription: sub,
          isPremium: premium,
          ownPremium: own,
          householdPremium: household,
          rowCancelled: cancelled,
          loading: loading,
          platform: platform,
          webState: web,
          storeRead: storeRead,
          activeStore: store,
          realPriceString: price,
        );

    test('anacan.az subscription: cancelled once it no longer renews; cancel goes to the web flow', () {
      final s = st(web: const WebPremiumState(active: true, source: 'web_subscription', renews: false));
      expect(s.isWebSubscription, isTrue);
      expect(s.isCancelled, isTrue);
      expect(s.upgradeBlock(), 'PREMIUM_SOURCE_NON_STORE');
    });

    test('promotional / web pass: nothing renews (no cancel button)', () {
      expect(st(store: 'PROMOTIONAL').nothingRenews, isTrue);
      expect(st(web: const WebPremiumState(active: true, source: 'web_pass')).nothingRenews, isTrue);
      expect(st(store: 'PLAY_STORE').nothingRenews, isFalse);
      expect(st(storeRead: false, store: 'PROMOTIONAL').nothingRenews, isFalse);
    });

    test('store kind follows the billing store, then the device for cancel', () {
      expect(st(store: 'APP_STORE').storeKind, 'ios');
      expect(st(store: 'MAC_APP_STORE').storeKind, 'ios');
      expect(st(store: 'PLAY_STORE').storeKind, 'android');
      expect(st(store: 'PROMOTIONAL').storeKind, isNull);
      expect(st(store: null, platform: 'ios').cancelStore, 'ios');
      expect(st(store: null, platform: 'web').cancelStore, isNull);
    });

    test('price only from the store, never for free or household-only accounts', () {
      expect(st(price: 'â‚¼6.99').planPrice, 'â‚¼6.99');
      expect(st(price: null).planPrice, '');
      expect(st(premium: false, sub: null, price: 'â‚¼6.99').planPrice, '');
      expect(st(own: false, household: true, price: 'â‚¼6.99').planPrice, '');
    });

    test('Free is shown only once the entitlement finished loading', () {
      expect(st(premium: false, sub: null, loading: true).isFreeUser, isFalse);
      expect(st(premium: false, sub: null, loading: true).statusLoading, isTrue);
      expect(st(premium: false, sub: null).isFreeUser, isTrue);
    });

    test('upgrade is blocked when Premium is billed elsewhere', () {
      expect(st(store: 'APP_STORE', platform: 'android').upgradeBlock(), 'PREMIUM_MANAGED_ELSEWHERE');
      expect(st(store: 'PLAY_STORE', platform: 'android').upgradeBlock(), isNull);
      expect(st(store: null, own: true).upgradeBlock(), 'PREMIUM_SOURCE_NON_STORE');
      expect(st(own: false, household: true, store: null).upgradeBlock(), 'PREMIUM_SOURCE_HOUSEHOLD');
      // Store not read yet: unknown store, own Premium still counts as non-store.
      expect(st(storeRead: false).upgradeBlock(), 'PREMIUM_SOURCE_NON_STORE');
    });
  });

  group('WebPremiumClient', () {
    test('status: parsed only from an ok answer with a boolean active', () async {
      final ok = WebPremiumClient((_) async => const DbResult<Object?>(data: {
            'ok': true,
            'premium': {'active': true, 'source': 'web_subscription', 'renews': true, 'expires_at': '2027-01-01', 'plan': 'yearly'},
          }));
      final s = await ok.fetchState();
      expect(s!.active, isTrue);
      expect(s.source, 'web_subscription');
      expect(s.renews, isTrue);
      expect(s.plan, 'yearly');
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(data: {'ok': false})).fetchState(), isNull);
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(data: {'ok': true, 'premium': {'active': 'yes'}})).fetchState(), isNull);
      expect(await WebPremiumClient((_) => Future<DbResult<Object?>>.error(StateError('x'))).fetchState(), isNull);
    });

    test('renewal: ok, refused on 403, failed otherwise', () async {
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(data: {'ok': true})).setRenewal('cancel'), 'ok');
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(error: FunctionException(status: 403), status: 403)).setRenewal('cancel'), 'refused');
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(data: {'ok': false, 'error': 'origin_not_allowed'})).setRenewal('resume'), 'refused');
      expect(await WebPremiumClient((_) async => const DbResult<Object?>(error: FunctionException(status: 500), status: 500)).setRenewal('cancel'), 'failed');
    });
  });

  group('BillingScreen', () {
    late OnboardingTestEnv env;
    late FakeStore store;
    late FakeSubscriptionBackend backend;
    late List<Uri> opened;
    late List<String> webActions;
    var refetches = 0;

    Future<void> mount(
      WidgetTester tester, {
      required SubscriptionState sub,
      Map<String, Object?>? customerInfo,
      String? price,
      String platform = 'android',
      Map<String, Object?>? webStatus,
      List<Map<String, dynamic>>? features,
      Size size = const Size(390, 1400),
    }) async {
      store = FakeStore(customerInfo, price: price);
      backend = FakeSubscriptionBackend();
      opened = [];
      webActions = [];
      refetches = 0;
      env = OnboardingTestEnv(language: 'az', native: true, platform: platform, extra: [
        billingStoreReaderProvider.overrideWithValue(store),
        billingPlatformProvider.overrideWithValue(platform),
        billingRefetchSubscriptionProvider.overrideWithValue((_) async => refetches++),
        billingLinkOpenerProvider.overrideWithValue((uri) async => opened.add(uri)),
        subscriptionBackendProvider.overrideWithValue(backend),
        authUserProvider.overrideWithValue(user()),
        premiumConfigProvider.overrideWithValue(PremiumCatalog(features: features ?? const [
          {'title': 'Limitsiz AI', 'icon': 'âœ¨', 'is_included_premium': true},
          {'title': 'Gizli', 'icon': 'x', 'is_included_premium': false},
        ], loading: false)),
        webPremiumClientProvider.overrideWithValue(WebPremiumClient((action) async {
          webActions.add(action);
          if (action == 'status') return DbResult<Object?>(data: webStatus == null ? {'ok': false} : {'ok': true, 'premium': webStatus});
          return const DbResult<Object?>(data: {'ok': true});
        }, openExternal: (uri) async => opened.add(uri))),
      ]);
      env.setSubscription(sub);
      addTearDown(env.dispose);
      // Unmount and let toast / cache timers run out before the binding checks for pending timers.
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(days: 8));
      });
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: env.container,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
          // AppChrome: Material(transparency) + AToastHost above the router.
          builder: (context, nav) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: Material(type: MaterialType.transparency, child: AToastHost(child: nav!)),
          ),
          home: BillingScreen(onBack: () {}),
        ),
      ));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    Future<void> settle(WidgetTester tester) async {
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    testWidgets('free account: Free status, upgrade button, locked feature list', (tester) async {
      await mount(tester, sub: const SubscriptionState(entitlementReady: true));
      expect(find.text('Pulsuz Plan'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-upgrade-free')), findsOneWidget);
      expect(find.text('Limitsiz AI'), findsOneWidget);
      expect(find.text('Gizli'), findsNothing);
      expect(find.byKey(const ValueKey('billing-actions')), findsNothing);
      expect(find.byKey(const ValueKey('billing-price')), findsNothing);
    });

    testWidgets('loading entitlement: spinner instead of "Free"', (tester) async {
      await mount(tester, sub: const SubscriptionState(loading: true));
      expect(find.byKey(const ValueKey('billing-status-loading')), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-upgrade-free')), findsNothing);
    });

    testWidgets('Play subscription: store price, dates, history; cancel asks why, records it, then opens Play', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(
          isPremium: true,
          ownPremium: true,
          entitlementReady: true,
          subscription: {'plan_type': 'premium', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z', 'expires_at': '2026-12-10T10:00:00Z', 'is_trial': false},
        ),
        customerInfo: info(
          original: '2026-01-10T10:00:00Z',
          entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'com.atlasoon.anacan.premium.monthly', 'expirationDate': '2026-12-10T10:00:00Z', 'willRenew': true},
        ),
        price: 'â‚¼6.99',
      );
      expect(find.text('Premium AylÄ±q'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-active-badge')), findsOneWidget);
      expect(find.text('â‚¼6.99'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-start')), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-end')), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-history')), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-open-store')), findsNothing, reason: 'Android has no "View in App Store" button');
      expect(webActions, ['status']);

      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      expect(find.byKey(const ValueKey('cancel-reason-dialog')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-too_expensive')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('cancel-reason-submit')));
      await settle(tester);
      expect(backend.cancellations.single, {
        'user_id': 'user-1',
        'reason_code': 'too_expensive',
        'reason_text': null,
        'plan_type': 'premium',
        'was_trial': false,
        'cancel_flow': 'in_app',
      });
      expect(env.analytics.events.map((e) => e.$1), contains('premium_cancelled'));
      expect(opened.single.toString(),
          'https://play.google.com/store/account/subscriptions?sku=com.atlasoon.anacan.premium.monthly&package=com.atlasoon.anacan');
    });

    testWidgets('cancel reason: "other" text is sent trimmed; a failed insert still continues; closing does not', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(isPremium: true, ownPremium: true, subscription: {'plan_type': 'premium_plus', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z'}),
        customerInfo: info(entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'yearly'}),
      );
      expect(find.text('Premium Ä°llik'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-end')), findsNothing);

      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-close')));
      await settle(tester);
      expect(find.byKey(const ValueKey('cancel-reason-dialog')), findsNothing);
      expect(opened, isEmpty);

      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-other')));
      await tester.pump();
      await tester.enterText(find.byKey(const ValueKey('cancel-reason-other')).last, '  Ã§ox bahadÄ±r  ');
      backend.fail = true;
      await tester.tap(find.byKey(const ValueKey('cancel-reason-submit')));
      await settle(tester);
      expect(backend.cancellations, isEmpty);
      expect(opened, hasLength(1), reason: 'the cancel flow continues even when the reason could not be saved');

      backend.fail = false;
      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-other')));
      await tester.pump();
      await tester.enterText(find.byKey(const ValueKey('cancel-reason-other')).last, '  Ã§ox bahadÄ±r  ');
      await tester.tap(find.byKey(const ValueKey('cancel-reason-submit')));
      await settle(tester);
      expect(backend.cancellations.single['reason_text'], 'Ã§ox bahadÄ±r');
      expect(backend.cancellations.single['plan_type'], 'premium_plus');
    });

    testWidgets('cancel reason: "Skip" continues without recording', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(isPremium: true, ownPremium: true, subscription: {'plan_type': 'premium', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z'}),
        customerInfo: info(entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'm'}),
      );
      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      expect(tester.widget<Semantics>(find.ancestor(of: find.byKey(const ValueKey('cancel-reason-submit')), matching: find.byType(Semantics)).first).properties.enabled, isFalse);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-skip')));
      await settle(tester);
      expect(backend.cancellations, isEmpty);
      expect(opened, hasLength(1));
    });

    testWidgets('cancelled store subscription: "manage in store" opens the store and hints at it', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(isPremium: true, ownPremium: true, subscription: {'plan_type': 'premium', 'status': 'cancelled', 'started_at': '2026-01-10T10:00:00Z', 'expires_at': '2026-12-10T10:00:00Z'}),
        customerInfo: info(entitlement: {'store': 'PLAY_STORE', 'productIdentifier': 'm'}),
      );
      expect(find.byKey(const ValueKey('billing-cancelled-badge')), findsOneWidget);
      expect(find.text(cssUpper('Premium bitir', 'az')), findsOneWidget);
      expect(find.text('MaÄŸazada idarÉ™ et'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('billing-restore')));
      await settle(tester);
      expect(opened.single.host, 'play.google.com');
      expect(find.text('Avtomatik yenilÉ™nmÉ™ni maÄŸazanÄ±n abunÉ™lik sÉ™hifÉ™sindÉ™ yenidÉ™n aktiv edin.'), findsOneWidget);
    });

    testWidgets('anacan.az subscription: cancel stops renewal on the server after confirming', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(isPremium: true, ownPremium: true, subscription: {'plan_type': 'premium', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z'}),
        customerInfo: info(),
        webStatus: {'active': true, 'source': 'web_subscription', 'renews': true},
      );
      await tester.tap(find.byKey(const ValueKey('billing-cancel')));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('cancel-reason-skip')));
      await settle(tester);
      expect(find.byKey(const ValueKey('billing-confirm-ok')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('billing-confirm-ok')));
      await settle(tester);
      expect(webActions, containsAllInOrder(['status', 'cancel', 'status']));
      expect(refetches, 1);
      expect(opened, isEmpty);
    });

    testWidgets('promotional Premium: no cancel button, upgrade is blocked with a message', (tester) async {
      await mount(
        tester,
        sub: const SubscriptionState(isPremium: true, ownPremium: true, subscription: {'plan_type': 'premium', 'status': 'active', 'started_at': '2026-01-10T10:00:00Z'}),
        customerInfo: info(entitlement: {'store': 'PROMOTIONAL', 'productIdentifier': 'rc_promo'}),
      );
      expect(find.byKey(const ValueKey('billing-cancel')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('billing-upgrade')));
      await settle(tester);
      expect(find.text(purchaseErrorMessage('PREMIUM_SOURCE_NON_STORE')), findsOneWidget);
    });

    testWidgets('golden: own Premium, no store (reference shot bump.screen.billing, 390Ã—844 light az)', (tester) async {
      await mount(
        tester,
        platform: 'web',
        sub: const SubscriptionState(
          isPremium: true,
          ownPremium: true,
          entitlementReady: true,
          subscription: {'plan_type': 'yearly', 'status': 'active', 'started_at': '2026-06-08T10:00:00Z', 'expires_at': '2027-06-08T10:00:00Z'},
        ),
        features: const [],
        size: const Size(390, 844),
      );
      await expectLater(find.byType(BillingScreen), matchesGoldenFile('goldens/billing_premium_light.png'));
    });

    testWidgets('household-only Premium: family plan name, no price, no own-subscription block', (tester) async {
      await mount(tester, sub: const SubscriptionState(isPremium: true, householdPremium: true, subscription: {'plan_type': 'premium'}), price: 'â‚¼6.99');
      expect(find.text('AilÉ™ Premium-u (partnyorunuzun abunÉ™liyi)'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-price')), findsNothing);
      expect(find.byKey(const ValueKey('billing-actions')), findsNothing);
      expect(webActions, isEmpty, reason: 'the web state is read only for own Premium');
    });
  });
}
