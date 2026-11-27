// Ported from: src/components/qaygicash/QaygiCash.test.tsx
import 'dart:ui' show Tristate;

import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/qaygicash/qaygicash_cards.dart';
import 'package:anacan/features/commerce/qaygicash/qaygicash_premium.dart';
import 'package:anacan/features/commerce/qaygicash/qaygicash_screen.dart';
import 'package:anacan/features/commerce/qaygicash/qc_parts.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show Slider;

import '../support.dart';

class _Env {
  _Env() {
    backend = FakeCommerceBackend(onRpc: (fn, _) => DbResult<Object?>(data: fn == 'qaygicash_wallet_v1' ? wallet : history));
  }
  Object? wallet = walletFixture();
  Object? history = const <Object?>[];
  late final FakeCommerceBackend backend;
  String platform = 'ios';
  int refreshes = 0;

  List<Override> overrides() => commerceOverrides(backend, platform: platform, extra: [qcRefreshProfileProvider.overrideWithValue(() async => refreshes++)]);
}

Future<void> _pump(WidgetTester tester, _Env env, Widget child, {bool scroll = true}) async {
  await pumpApp(tester, child, overrides: env.overrides(), scroll: scroll);
  await tester.pumpAndSettle();
}

class _RedeemHarness extends ConsumerStatefulWidget {
  const _RedeemHarness({required this.channel, required this.goods});
  final String channel;
  final int goods;
  @override
  ConsumerState<_RedeemHarness> createState() => _RedeemHarnessState();
}

class _RedeemHarnessState extends ConsumerState<_RedeemHarness> {
  final QcRedeemController _c = QcRedeemController();

  @override
  void initState() {
    super.initState();
    _c.addListener(() => setState(() {}));
  }

  @override
  Widget build(BuildContext context) {
    final state = qcRedeemState(ref, _c, widget.channel, widget.goods);
    return Column(
      children: [
        QcRedeemRow(state: state),
        Text('${state.amount}', key: const ValueKey('amount')),
      ],
    );
  }
}

String _amount(WidgetTester tester) => tester.widget<Text>(find.byKey(const ValueKey('amount'))).data!;

Map<String, Object?> _premiumOn(Map<String, Object?> plan, Map<String, bool> platforms) => {
  'enabled': true,
  'monthly': {'enabled': false, 'price_minor': 399},
  'yearly': {'enabled': false, 'price_minor': 2699},
  ...plan,
  'platforms': platforms,
};

void main() {
  group('QaygiCashHomeCard', () {
    screenTest('renders nothing when the programme is off for this account', (tester) async {
      final env = _Env()..wallet = {'enabled': false};
      await _pump(tester, env, const QaygiCashHomeCard());
      expect(env.backend.rpcCalls.map((c) => c.$1), contains('qaygicash_wallet_v1'));
      expect(find.byKey(const ValueKey('qc-home-card')), findsNothing);
      expect(find.byKey(const ValueKey('qc-home-intro')), findsNothing);
    });

    screenTest('shows the balance once there is bonus activity', (tester) async {
      final env = _Env();
      var opened = 0;
      await _pump(tester, env, QaygiCashHomeCard(onOpen: () => opened++));
      expect(find.byKey(const ValueKey('qc-home-card')), findsOneWidget);
      expect(find.text('6,59\u00a0₼'), findsOneWidget);
      expect(find.text('+1,08\u00a0₼'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('qc-home-card')));
      expect(opened, 1);
    });

    screenTest('shows a one-time intro without activity and remembers the dismissal', (tester) async {
      final env = _Env()..wallet = walletFixture({'available_minor': 0, 'pending_minor': 0});
      final overrides = env.overrides();
      await pumpApp(tester, const QaygiCashHomeCard(), overrides: overrides);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('qc-home-intro')), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Bağla'));
      await tester.pump();
      expect(find.byKey(const ValueKey('qc-home-intro')), findsNothing);
      // Same LocalStore, new mount.
      await pumpApp(tester, const SizedBox(), overrides: overrides);
      await pumpApp(tester, const QaygiCashHomeCard(key: ValueKey('again')), overrides: overrides);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('qc-home-intro')), findsNothing);
    });
  });

  group('checkout row', () {
    screenTest('starts on, at the max (30 % of goods, capped by the balance)', (tester) async {
      await _pump(tester, _Env(), const _RedeemHarness(channel: 'aptek', goods: 5690));
      expect(find.byKey(const ValueKey('qc-redeem')), findsOneWidget);
      expect(_amount(tester), '659');
      expect(tester.getSemantics(find.byKey(const ValueKey('qc-redeem-switch'))).flagsCollection.isToggled, Tristate.isTrue);
      expect(find.text('Balans 6,59\u00a0₼ · bu sifarişdə maks. 6,59\u00a0₼'), findsOneWidget);
    });

    screenTest('caps by the order share and lets the slider go down to the minimum, then off', (tester) async {
      await _pump(tester, _Env(), const _RedeemHarness(channel: 'cake', goods: 1000));
      expect(_amount(tester), '300');
      final slider = tester.widget<Slider>(find.byType(Slider));
      expect(slider.max, 20); // (3,00 − 1,00) / 0,10
      slider.onChanged!(0);
      await tester.pump();
      expect(_amount(tester), '100');
      tester.widget<Slider>(find.byType(Slider)).onChanged!(7);
      await tester.pump();
      expect(_amount(tester), '170');
      await tester.tap(find.byKey(const ValueKey('qc-redeem-switch')));
      await tester.pump();
      expect(_amount(tester), '0');
      expect(find.byType(Slider), findsNothing);
    });

    screenTest('tells when the order is too small for the minimum and applies nothing', (tester) async {
      await _pump(tester, _Env(), const _RedeemHarness(channel: 'book', goods: 300));
      expect(find.byKey(const ValueKey('qc-redeem')), findsOneWidget);
      expect(tester.getSemantics(find.byKey(const ValueKey('qc-redeem-switch'))).flagsCollection.isEnabled, Tristate.isFalse);
      expect(_amount(tester), '0');
    });

    for (final (label, patch) in <(String, Map<String, Object?>)>[
      ('balance under the minimum', {'available_minor': 99}),
      ('spending paused', {'status': 'paused'}),
      (
        'channel closed',
        {
          'redeem_channels': ['cake'],
        },
      ),
      ('programme off', {'enabled': false}),
    ]) {
      screenTest('is hidden when $label', (tester) async {
        final env = _Env()..wallet = walletFixture(patch);
        await _pump(tester, env, const _RedeemHarness(channel: 'aptek', goods: 5690));
        expect(_amount(tester), '0');
        expect(find.byKey(const ValueKey('qc-redeem')), findsNothing);
      });
    }

    screenTest('previews earnings and product badges only with a rate', (tester) async {
      await _pump(
        tester,
        _Env(),
        const Column(
          children: [
            QcEarnBox(amount: 106),
            QcProductBadge(channel: 'own_shop', priceMinor: 1200),
            QcProductBadge(channel: 'partner', priceMinor: 1200),
          ],
        ),
      );
      expect(find.text('Bu sifarişdən 1,06\u00a0₼ QayğıCash qazanacaqsan. Çatdırılmadan 14 gün sonra hazır olur.'), findsOneWidget);
      expect(find.byKey(const ValueKey('qc-badge')), findsOneWidget);
      expect(find.text('+0,60\u00a0₼ · 5% QayğıCash'), findsOneWidget);
    });
  });

  group('Premium with bonus', () {
    screenTest('shows the earn line but keeps the pay option hidden by default', (tester) async {
      await _pump(
        tester,
        _Env(),
        const Column(
          children: [
            QcPremiumEarnLine(plan: 'yearly'),
            QcPremiumEarnLine(plan: 'monthly'),
            QaygiCashPremiumOption(plan: 'yearly'),
            QaygiCashPremiumOption(plan: 'monthly'),
          ],
        ),
      );
      expect(find.text('+1,34\u00a0₼ QayğıCash'), findsOneWidget);
      expect(find.byKey(const ValueKey('qc-prem-earn-yearly')), findsOneWidget);
      expect(find.text('Hər yenilənmədə +0,11\u00a0₼ QayğıCash'), findsOneWidget);
      expect(find.byKey(const ValueKey('qc-prem-pay-yearly')), findsNothing);
      expect(find.byKey(const ValueKey('qc-prem-pay-monthly')), findsNothing);
    });

    screenTest('stays hidden on a platform the server has not enabled', (tester) async {
      final env = _Env()
        ..wallet = walletFixture({
          'available_minor': 3000,
          'premium_redeem': _premiumOn(
            {
              'yearly': {'enabled': true, 'price_minor': 2699},
            },
            {'ios': true},
          ),
        })
        ..platform = 'android';
      await _pump(
        tester,
        env,
        const Column(
          children: [
            QcPremiumEarnLine(plan: 'yearly'),
            QaygiCashPremiumOption(plan: 'yearly'),
          ],
        ),
      );
      expect(find.byKey(const ValueKey('qc-prem-earn-yearly')), findsOneWidget);
      expect(find.byKey(const ValueKey('qc-prem-pay-yearly')), findsNothing);
    });

    screenTest('confirms in-page, calls the edge function and refreshes Premium', (tester) async {
      final env = _Env()
        ..wallet = walletFixture({
          'available_minor': 3000,
          'premium_redeem': _premiumOn(
            {
              'yearly': {'enabled': true, 'price_minor': 2699},
            },
            {'ios': true},
          ),
        });
      env.backend.onInvoke = (_, _) => const DbResult<Object?>(data: {'ok': true, 'plan': 'yearly', 'expires_at': '2027-11-06T00:00:00Z'});
      var done = 0;
      await _pump(tester, env, QaygiCashPremiumOption(plan: 'yearly', onDone: () => done++));
      await tester.tap(find.byKey(const ValueKey('qc-prem-pay-yearly')));
      await tester.pumpAndSettle();
      expect(env.backend.invokeCalls, isEmpty);
      expect(find.byKey(const ValueKey('qc-prem-sheet')), findsOneWidget);
      expect(find.textContaining('Balansından 26,99\u00a0₼ çıxılacaq və 1 il Premium aktivləşəcək.'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('qc-prem-confirm')));
      await tester.pumpAndSettle();
      expect(done, 1);
      expect(env.backend.invokeCalls.single.$1, 'qaygicash-premium');
      expect(env.backend.invokeCalls.single.$2, {'plan': 'yearly', 'platform': 'ios'});
      expect(env.refreshes, 1);
    });

    screenTest('is disabled when the balance does not cover the price', (tester) async {
      final env = _Env()
        ..wallet = walletFixture({
          'available_minor': 200,
          'premium_redeem': _premiumOn(
            {
              'monthly': {'enabled': true, 'price_minor': 399},
            },
            {'web': true},
          ),
        })
        ..platform = 'web';
      await _pump(tester, env, const QaygiCashPremiumOption(plan: 'monthly'));
      expect(find.byKey(const ValueKey('qc-prem-pay-monthly')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('qc-prem-pay-monthly')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('qc-prem-sheet')), findsNothing);
    });
  });

  group('QaygiCashScreen', () {
    screenTest('shows balance, rates with rate > 0, history tones and the rules', (tester) async {
      final env = _Env()
        ..history = [
          {
            'id': 'l1',
            'type': 'earn',
            'channel': 'cake',
            'amount_minor': 108,
            'rate_bp': 300,
            'status': 'pending',
            'at': '2026-11-01T00:00:00Z',
            'available_at': '2026-11-15T00:00:00Z',
          },
          {'id': 'r1', 'type': 'redeem', 'channel': 'aptek', 'amount_minor': 150, 'status': 'committed', 'at': '2026-10-17T00:00:00Z'},
          {'id': 'r2', 'type': 'redeem', 'channel': 'cake', 'amount_minor': 120, 'status': 'released', 'at': '2026-10-10T00:00:00Z'},
        ]
        ..wallet = walletFixture({
          'rates': {'premium_yearly': 500, 'premium_monthly': 0, 'book': 500, 'cake': 300, 'own_shop': 500, 'partner': 0, 'affiliate': 0},
        });
      await _pump(tester, env, QaygiCashScreen(onBack: () {}), scroll: false);
      expect(tester.widget<Text>(find.byKey(const ValueKey('qc-available'))).data, '6,59\u00a0₼');
      final rates = find.byKey(const ValueKey('qc-rates'));
      expect(find.descendant(of: rates, matching: find.text('Premium illik')), findsOneWidget);
      expect(find.descendant(of: rates, matching: find.text('Premium aylıq')), findsNothing);
      expect(find.descendant(of: rates, matching: find.text('Tərəfdaş məhsulları')), findsOneWidget);
      final tones = tester
          .widgetList<KeyedSubtree>(
            find.byWidgetPredicate((w) => w is KeyedSubtree && w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('qc-tx:')),
          )
          .map((w) => (w.key! as ValueKey<String>).value.substring(6))
          .toList();
      expect(tones, ['pending', 'used', 'gone']);
      expect(find.text('Balansa qaytarıldı'), findsOneWidget);
      final faq = find.byKey(const ValueKey('qc-faq'));
      expect(find.descendant(of: faq, matching: find.byType(Offstage, skipOffstage: false), skipOffstage: false), findsNWidgets(8));
      expect(
        find.descendant(of: faq, matching: find.textContaining('Sifarişin 30%-inə qədər, minimum 1,00\u00a0₼.', skipOffstage: false), skipOffstage: false),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('qc-paused')), findsNothing);
    });

    screenTest('notes a pause and a debt', (tester) async {
      final env = _Env()..wallet = walletFixture({'status': 'paused', 'debt_minor': 250});
      await _pump(tester, env, QaygiCashScreen(onBack: () {}), scroll: false);
      expect(find.byKey(const ValueKey('qc-paused')), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('qc-debt')), matching: find.textContaining('2,50\u00a0₼')), findsOneWidget);
      expect(find.text('Xərclə'), findsNothing);
    });

    screenTest('shows no wallet when the programme is off', (tester) async {
      final env = _Env()..wallet = {'enabled': false};
      await _pump(tester, env, QaygiCashScreen(onBack: () {}), scroll: false);
      expect(env.backend.rpcCalls.map((c) => c.$1), contains('qaygicash_wallet_v1'));
      expect(find.byKey(const ValueKey('qc-wallet-card')), findsNothing);
      expect(find.byKey(const ValueKey('qc-faq')), findsNothing);
    });
  });
}
