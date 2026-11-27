// Ported from: src/lib/in-app-epoint.test.ts
//
// Not ported: the comparison with supabase/functions/_shared/web-premium-subscription.ts (server code, not in the
// app; the expected client answers of the same cases are asserted instead) and "server redirects" (server only).
import 'dart:convert';

import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/epoint/in_app_epoint.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;
import 'package:url_launcher/url_launcher.dart' show LaunchMode;

import '../support.dart';

const Map<String, Object?> seed = {
  'enabled': true,
  'countries': ['AZ'],
  'platforms': {'android': true, 'ios': false, 'web': true},
};
const InAppEpointSetting seedSetting = InAppEpointSetting(enabled: true, countries: ['AZ'], platforms: {'android': true, 'ios': false, 'web': true});

void main() {
  group('in_app_epoint setting', () {
    test('reads the object, the JSON string the admin writer stores and garbage (off)', () {
      expect(parseInAppEpointSetting(seed), seedSetting);
      expect(parseInAppEpointSetting(jsonEncode(seed)), seedSetting);
      expect(parseInAppEpointSetting(jsonEncode(jsonEncode(seed))), seedSetting);
      expect(
        parseInAppEpointSetting({
          'enabled': 'yes',
          'countries': ['az', 'xx1', 'AZ', 7],
        }),
        const InAppEpointSetting(enabled: false, countries: ['AZ'], platforms: {'android': false, 'ios': false, 'web': false}),
      );
      expect(parseInAppEpointSetting(null).enabled, false);
      expect(parseInAppEpointSetting('{broken').enabled, false);
    });

    test('matches the server parser and check for every case', () {
      final cases = <(Object?, String?, String, bool)>[
        (seed, 'AZ', 'android', true), (seed, 'az', 'web', true), (seed, 'AZ', 'ios', false), (seed, 'TR', 'android', false), //
        (seed, null, 'android', false), ({...seed, 'enabled': false}, 'AZ', 'android', false),
        (
          jsonEncode({
            ...seed,
            'platforms': {'ios': true},
          }),
          'AZ',
          'ios',
          true,
        ),
      ];
      for (final (raw, country, platform, expected) in cases) {
        expect(isInAppEpointEligible(parseInAppEpointSetting(raw), country, platform), expected, reason: '$raw $country $platform');
      }
      expect(isInAppEpointEligible(parseInAppEpointSetting(seed), 'AZ', 'android'), true);
      expect(isInAppEpointEligible(parseInAppEpointSetting(seed), 'AZ', 'ios'), false);
      expect(isInAppEpointEligible(parseInAppEpointSetting(seed), 'AZ', 'desktop'), false);
    });

    test('takes the profile country first, else the device locale region', () {
      expect(resolveCountry('az', 'en-US'), 'AZ');
      expect(resolveCountry(null, 'az-AZ'), 'AZ');
      expect(resolveCountry('', 'az-Latn-AZ'), 'AZ');
      expect(resolveCountry(null, 'az'), isNull);
      expect(localeRegion('ru_RU'), 'RU');
    });
  });

  group('server answers', () {
    test('parses web-premium status into server prices and the current Premium', () {
      final offer = parseEpointStatus({
        'ok': true,
        'payments_ready': true,
        'offer': {
          'active': true,
          'kind': 'campaign',
          'plans': {
            'monthly': {'price': 2.99, 'was': 4.99, 'pct': 40},
            'yearly': {'price': 24.99, 'was': 50.98, 'pct': 51, 'per_month': 2.08},
          },
        },
        'premium': {'active': false, 'source': null},
      })!;
      expect(offer.paymentsReady, true);
      expect(offer.kind, 'campaign');
      expect(offer.rate, isNull);
      expect((offer.premiumActive, offer.premiumSource), (false, null));
      expect(offer.plans['monthly'], const EpointPlanPrice(price: 2.99, was: 4.99, pct: 40));
      expect(offer.plans['yearly'], const EpointPlanPrice(price: 24.99, was: 50.98, pct: 51, perMonth: 2.08));
      final app = parseEpointStatus({
        'ok': true,
        'payments_ready': true,
        'offer': {
          'active': true,
          'kind': 'app',
          'plans': {
            'monthly': {'price': 6.99, 'was': null},
            'yearly': {'price': 50.99, 'was': null, 'per_month': 4.24},
          },
          'usd': {'monthly': 3.99, 'yearly': 29.99},
          'rate': 1.7,
          'rate_date': '2026-11-25',
          'rate_source': 'cbar',
        },
        'premium': {'active': false, 'source': null},
      });
      expect(app?.kind, 'app');
      expect(app?.rate, const EpointRate(value: 1.7, date: '2026-11-25', source: 'cbar'));
      expect(app?.plans['yearly'], const EpointPlanPrice(price: 50.99, perMonth: 4.24, usd: 29.99));
      final inactive = parseEpointStatus({
        'ok': true,
        'offer': {'active': false},
        'premium': {'active': true, 'source': 'store'},
      })!;
      expect((inactive.plans['monthly'], inactive.plans['yearly']), (null, null));
      expect(parseEpointStatus({'ok': false}), isNull);
    });

    test('maps error codes to messages; store Premium gets its own', () {
      expect(epointErrorKey('premium_active', 'store'), 'iep_err_premium_store');
      expect(epointErrorKey('premium_active', 'web_subscription'), 'iep_err_premium_active');
      expect(epointErrorKey('payments_unavailable'), 'iep_err_payments_unavailable');
      expect(epointErrorKey('too_many_attempts'), 'iep_err_too_many_attempts');
      expect(epointErrorKey('checkout_unavailable'), 'iep_err_checkout_unavailable');
      expect(epointErrorKey('app_checkout_disabled'), 'iep_err_checkout_unavailable');
      expect(epointErrorKey('database_unavailable'), 'iep_err_generic');
    });

    test('formats AZN with two decimals', () {
      expect(formatAzn(4.9, 'en'), '4.90 ₼');
      expect(formatAzn(24.99, 'az'), '24,99 ₼');
    });
  });

  group('checkout', () {
    test('asks web-premium for an app checkout with the consent the card shows', () async {
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) => const DbResult<Object?>(data: {'ok': true, 'redirect_url': 'https://ecomm.pashabank.az/pay?x=1'}),
      );
      expect(await requestEpointCheckout(backend, 'yearly', 'android', 'ru'), const CheckoutStart.ok('https://ecomm.pashabank.az/pay?x=1'));
      expect(backend.invokeCalls.single.$1, 'web-premium');
      expect(backend.invokeCalls.single.$2, {
        'action': 'subscribe', 'plan': 'yearly', 'page': 'app', 'consent': 'premium-autorenew-v1', 'platform': 'android', 'language': 'ru', //
      });
    });

    test('returns the refusal (200 ok:false) and the non-2xx body', () async {
      final answers = <Object>[
        const DbResult<Object?>(
          data: {
            'ok': false,
            'error': 'premium_active',
            'premium': {'active': true, 'source': 'store'},
          },
        ),
        const DbResult<Object?>(error: FunctionException(status: 403, details: {'error': 'origin_not_allowed'}), status: 403),
        Exception('offline'),
        const DbResult<Object?>(data: {'ok': true, 'redirect_url': 'javascript:alert(1)'}),
      ];
      final backend = FakeCommerceBackend(
        onInvoke: (_, _) {
          final next = answers.removeAt(0);
          if (next is Exception) throw next;
          return next as DbResult<Object?>;
        },
      );
      expect(await requestEpointCheckout(backend, 'monthly', 'web', 'az'), const CheckoutStart.failed('premium_active', 'store'));
      expect(await requestEpointCheckout(backend, 'monthly', 'web', 'az'), const CheckoutStart.failed('origin_not_allowed', null));
      expect(await requestEpointCheckout(backend, 'monthly', 'web', 'az'), const CheckoutStart.failed('unavailable', null));
      expect((await requestEpointCheckout(backend, 'monthly', 'web', 'az')).ok, false);
    });

    test('reads own Premium from get_premium_access_v1', () async {
      final answers = <Object?>[
        {
          'protocol': 'anacan-premium-access-v1',
          'userId': 'u1',
          'own': {'active': true},
        },
        {
          'protocol': 'anacan-premium-access-v1',
          'userId': 'u2',
          'own': {'active': true},
        },
      ];
      final backend = FakeCommerceBackend(onRpc: (_, _) => DbResult<Object?>(data: answers.removeAt(0)));
      expect(await hasOwnPremium(backend, 'u1'), true);
      expect(backend.rpcCalls.first.$1, 'get_premium_access_v1');
      expect(backend.rpcCalls.first.$2, {'p_user_id': 'u1'});
      expect(await hasOwnPremium(backend, 'u1'), false);
    });

    test('opens the in-app browser when the native plugin exists, else the system browser', () {
      // Android: Custom Tabs (url_launcher inAppBrowserView); iOS: Safari, whose return is an app resume.
      expect(checkoutLaunchMode(TargetPlatform.android, web: false), LaunchMode.inAppBrowserView);
      expect(checkoutLaunchMode(TargetPlatform.iOS, web: false), LaunchMode.externalApplication);
      expect(checkoutLaunchMode(TargetPlatform.android, web: true), LaunchMode.externalApplication);
    });

    test('polls until Premium shows up or the time is up', () async {
      var t = 0;
      Future<void> sleep(int ms) async => t += ms;
      final answers = [false, false, true];
      expect(await pollUntil(() async => answers.removeAt(0), now: () => t, sleep: sleep, intervalMs: 3000, timeoutMs: 60000), true);
      expect(t, 6000);
      t = 0;
      var calls = 0;
      expect(
        await pollUntil(
          () async {
            calls++;
            return false;
          },
          now: () => t,
          sleep: sleep,
          intervalMs: 3000,
          timeoutMs: 60000,
        ),
        false,
      );
      expect(calls, 21);
      expect(await pollUntil(() async => throw Exception('x'), now: () => t, sleep: sleep, timeoutMs: 0), false);
    });

    test('remembers a checkout that left the app for 30 minutes, per user', () {
      final store = LocalStore.memory({
        kEpointPendingKey: jsonEncode({'userId': 'u1', 'at': 1000}),
      });
      expect(pendingCheckout(store, 'u1', 1000 + 60000), true);
      expect(pendingCheckout(store, 'u2', 1000 + 60000), false);
      expect(pendingCheckout(store, 'u1', 1000 + 31 * 60000), false);
      clearEpointPending(store);
      expect(pendingCheckout(store, 'u1', 1000 + 60000), false);
    });
  });
}
