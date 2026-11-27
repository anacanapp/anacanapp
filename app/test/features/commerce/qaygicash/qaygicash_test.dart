// Ported from: src/lib/qaygicash.test.ts
import 'dart:convert';

import 'package:anacan/features/commerce/qaygicash/qaygicash.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

QcWallet wallet([Map<String, Object?> patch = const {}]) => parseWallet(walletFixture(patch)) as QcWallet;

void main() {
  group('parseWallet', () {
    test('hides the programme unless the server says enabled', () {
      expect(parseWallet({'enabled': false}), qcDisabled);
      expect(parseWallet(null), qcDisabled);
      expect(parseWallet('garbage'), qcDisabled);
      expect(parseWallet({'enabled': false}).enabled, false);
    });
    test('normalises the wallet (also JSON-encoded) and keeps only known spend channels', () {
      final w = parseWallet(
        jsonEncode(
          walletFixture({
            'redeem_channels': ['aptek', 'premium', 'cake'],
            'available_minor': '659',
          }),
        ),
      ) as QcWallet;
      expect(w.enabled, true);
      expect(w.availableMinor, 659);
      expect(w.redeemChannels, ['aptek', 'cake']);
      expect(w.rates['own_shop'], 500);
      expect(w.premiumRedeem.yearly, const QcPlanRedeem(enabled: false, priceMinor: 2699));
    });
    test('treats an unknown status as live and a paused one as paused', () {
      expect(wallet({'status': 'paused'}).status, 'paused');
      expect(wallet({'status': 'whatever'}).status, 'live');
    });
  });

  group('formatting', () {
    test('shows minor units with comma decimals in Azerbaijani', () {
      expect(formatQc(134, 'az'), '1,34\u00a0₼');
      expect(formatQc(0, 'az'), '0,00\u00a0₼');
      expect(formatQc(2699, 'az'), '26,99\u00a0₼');
      expect(formatQc(134, 'en'), '1.34\u00a0₼');
      expect(formatQcSigned(-150, 'az'), '−1,50\u00a0₼');
      expect(formatQcSigned(108, 'az'), '+1,08\u00a0₼');
    });
    test('formats basis points as a percentage', () {
      expect(formatRate(500, 'en'), '5%');
      expect(formatRate(250, 'en'), '2.5%');
    });
    test('converts between AZN and minor units without float drift', () {
      expect(toMinor(2.3), 230);
      expect(toMinor(0.1 + 0.2), 30);
      expect(toAzn(659), 6.59);
    });
  });

  group('earning', () {
    test('floors amount × rate (never more than the rate)', () {
      expect(earnPreview(2699, 500), 134);
      expect(earnPreview(399, 300), 11);
      expect(earnPreview(1999, 500), 99);
      expect(earnPreview(1000, 0), 0);
      expect(earnPreview(-5, 500), 0);
      expect(earnPreview(1000, null), 0);
    });
    test('previews Premium on the fixed base', () {
      expect(premiumEarnMinor(wallet(), 'yearly'), 134);
      expect(premiumEarnMinor(wallet(), 'monthly'), 11);
      expect(premiumEarnMinor(qcDisabled, 'yearly'), 0);
    });
    test('earns on Aptek only for own lines, on their share of what is paid', () {
      const lines = [AptekEarnLine(priceMinor: 1200, quantity: 2, own: true), AptekEarnLine(priceMinor: 3290, quantity: 1, own: false)];
      // Nothing used: 2400 own of 5690 paid → 5% of 2400.
      expect(aptekEarnMinor(lines, 0, 0, 500), 120);
      // 6,59 ₼ bonus spread over all lines: own share = floor(2400 × 5031 / 5690) = 2122 → 106.
      expect(aptekEarnMinor(lines, 0, 659, 500), 106);
      expect(aptekEarnMinor(const [AptekEarnLine(priceMinor: 3290, quantity: 1, own: false)], 0, 0, 500), 0);
      expect(aptekEarnMinor(lines, 0, 0, 0), 0);
    });
    test('dates the bonus by the hold days', () {
      final now = DateTime.parse('2026-11-06T10:00:00Z');
      expect(availableFrom(14, now).toUtc().toIso8601String(), '2026-11-20T10:00:00.000Z');
    });
  });

  group('spending limits', () {
    test('caps at max % of goods and the available balance', () {
      expect(maxRedeemMinor(5690, wallet()), 659); // 30 % = 1707, balance 659
      expect(maxRedeemMinor(1000, wallet()), 300);
      expect(maxRedeemMinor(1999, wallet()), 599); // floor(599.7)
      expect(maxRedeemMinor(1000, qcDisabled), 0);
    });
    test('hides the switch when off, paused, closed or under the minimum balance', () {
      expect(redeemLimits(qcDisabled, 'aptek', 5000).show, false);
      expect(
        redeemLimits(wallet({'status': 'paused'}), 'aptek', 5000),
        isA<RedeemLimits>().having((l) => l.show, 'show', false).having((l) => l.block, 'block', 'paused'),
      );
      expect(
        redeemLimits(
          wallet({
            'redeem_channels': ['cake'],
          }),
          'aptek',
          5000,
        ),
        isA<RedeemLimits>().having((l) => l.show, 'show', false).having((l) => l.block, 'block', 'channel'),
      );
      expect(
        redeemLimits(wallet({'available_minor': 99}), 'aptek', 5000),
        isA<RedeemLimits>().having((l) => l.show, 'show', false).having((l) => l.block, 'block', 'balance'),
      );
    });
    test('marks a too-small order and gives the range otherwise', () {
      final small = redeemLimits(wallet(), 'book', 300); // 30 % of 3 ₼ = 0,90 < 1 ₼
      expect((small.show, small.block, small.max), (true, 'order', 0));
      expect(redeemLimits(wallet(), 'book', 400), const RedeemLimits(show: true, block: null, min: 100, max: 120));
    });
    test('snaps to the 0,10 ₼ grid but always allows the exact max', () {
      expect(clampRedeem(659, 100, 659), 659);
      expect(clampRedeem(5000, 100, 659), 659);
      expect(clampRedeem(10, 100, 659), 100);
      expect(clampRedeem(234, 100, 659), 230);
      expect(clampRedeem(300, 100, 50), 0);
    });
  });

  group('premium with bonus', () {
    test('is hidden by default', () {
      expect(premiumRedeemOption(wallet(), 'yearly', 'ios'), isNull);
    });
    test('needs the programme switch, the plan switch and the platform', () {
      QcWallet on(Map<String, bool> platforms, [bool yearly = true]) => wallet({
        'premium_redeem': {
          'enabled': true,
          'monthly': {'enabled': false, 'price_minor': 399},
          'yearly': {'enabled': yearly, 'price_minor': 2699},
          'platforms': platforms,
        },
      });
      expect(premiumRedeemOption(on({'ios': true}), 'yearly', 'ios'), (price: 2699, affordable: false));
      expect(premiumRedeemOption(on({'ios': true}), 'yearly', 'android'), isNull);
      expect(premiumRedeemOption(on({'ios': true}), 'monthly', 'ios'), isNull);
      expect(premiumRedeemOption(on({'ios': true}, false), 'yearly', 'ios'), isNull);
      expect(premiumRedeemOption(on({'web': true}).copyWith(availableMinor: 3000), 'yearly', 'web'), (price: 2699, affordable: true));
      expect(premiumRedeemOption(on({'web': true}).copyWith(status: 'paused'), 'yearly', 'web'), isNull);
    });
  });

  group('errors and history', () {
    test('maps server codes to copy keys', () {
      expect(qcErrorCode({'message': 'QC_ABOVE_MAX'}), 'QC_ABOVE_MAX');
      expect(qcErrorCode({'error': 'premium_store_subscription_active'}), 'premium_store_subscription_active');
      expect(qcErrorCode({'message': 'APTEK_BAD_PHONE'}), isNull);
      expect(qcErrorKey('QC_INSUFFICIENT'), 'qc_err_insufficient');
      expect(qcErrorKey('QC_ORDER_NOT_ELIGIBLE'), 'qc_err_order_not_eligible');
      expect(qcErrorKey('premium_store_subscription_active'), 'qc_err_store_subscription');
      expect(qcErrorKey('grant_failed'), 'qc_err_generic');
      expect(qcErrorKey(null), 'qc_err_generic');
    });
    test('colours rows by status', () {
      expect(historyTone(type: 'earn', status: 'pending'), 'pending');
      expect(historyTone(type: 'earn', status: 'available'), 'available');
      expect(historyTone(type: 'earn', status: 'expired'), 'gone');
      expect(historyTone(type: 'earn', status: 'reversed'), 'gone');
      expect(historyTone(type: 'redeem', status: 'committed'), 'used');
      expect(historyTone(type: 'redeem', status: 'reserved'), 'used');
      expect(historyTone(type: 'redeem', status: 'released'), 'gone');
      expect(historyStatusKey(type: 'redeem', status: 'released'), 'qc_status_returned');
      expect(historyStatusKey(type: 'earn', status: 'pending'), 'qc_status_pending');
      expect(historyTitleKey(type: 'earn', channel: 'own_shop'), 'qc_hist_earn_own_shop');
      expect(historyTitleKey(type: 'earn', channel: 'cake', sourceType: 'adjust'), 'qc_hist_earn_adjust');
      expect(historyTitleKey(type: 'redeem', channel: 'premium'), 'qc_hist_use_premium');
      expect(historyTitleKey(type: 'redeem', channel: 'mystery'), 'qc_hist_use_other');
    });
    test('parses the history and drops malformed rows', () {
      final rows = parseHistory([
        {
          'id': 'l1',
          'type': 'earn',
          'channel': 'cake',
          'amount_minor': 108,
          'status': 'pending',
          'at': '2026-11-01T00:00:00Z',
          'available_at': '2026-11-15T00:00:00Z',
        },
        {'type': 'other', 'at': 'x'},
        {'id': 'r1', 'type': 'redeem', 'channel': 'aptek', 'amount_minor': '150', 'status': 'committed', 'at': '2026-10-17T00:00:00Z'},
      ]);
      expect(rows.map((r) => r.id).toList(), ['l1', 'r1']);
      expect(rows[1].amountMinor, 150);
    });
    test('knows whether there was any bonus activity', () {
      expect(hasQcActivity(wallet()), true);
      expect(hasQcActivity(wallet({'available_minor': 0, 'pending_minor': 0})), false);
      expect(hasQcActivity(qcDisabled), false);
    });
  });
}
