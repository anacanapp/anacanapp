// Ported from: src/components/paywall/EpointPayOption.test.tsx
//
// The React test mocks the `useInAppEpoint` hook; here the card is rendered from a [UseInAppEpoint] value
// directly ([EpointPayOptionView]), which is what EpointPayOption builds from its hook state.
import 'package:anacan/features/commerce/epoint/epoint_pay_option.dart';
import 'package:anacan/features/commerce/epoint/in_app_epoint.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

class _Hook {
  final List<String> started = [];
  int checks = 0;

  UseInAppEpoint value({bool available = true, String status = 'idle', String? messageKey}) => UseInAppEpoint(
    available: available,
    eligible: true,
    status: status,
    messageKey: messageKey,
    startCheckout: (plan) async => started.add(plan),
    checkAgain: () => checks++,
    offer: const EpointOffer(
      paymentsReady: true,
      kind: 'campaign',
      premiumActive: false,
      plans: {'monthly': EpointPlanPrice(price: 2.99, was: 4.99, pct: 40), 'yearly': EpointPlanPrice(price: 50.99, perMonth: 4.24, usd: 29.99)},
    ),
  );
}

Future<void> _pump(WidgetTester tester, Widget child) => pumpApp(tester, child, overrides: baseOverrides());

void main() {
  group('EpointPayOption', () {
    screenTest('shows the server price of the selected plan, consent and legal note, and starts the checkout', (tester) async {
      final hook = _Hook();
      await _pump(tester, EpointPayOptionView(plan: 'monthly', epoint: hook.value()));
      expect(find.text('Azərbaycan kartı ilə ödə (Epoint)'), findsOneWidget);
      expect(find.text('2,99 ₼ / ay'), findsOneWidget);
      expect(find.text('4,99 ₼'), findsOneWidget);
      expect(find.text('Kampaniya qiyməti'), findsOneWidget);
      expect(find.textContaining('hər ay avtomatik yenilənməsinə'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('epoint-pay-monthly')));
      expect(hook.started, ['monthly']);
    });

    screenTest('shows the AZN price with the USD reference for the in-app offer', (tester) async {
      await _pump(tester, EpointPayOptionView(plan: 'yearly', epoint: _Hook().value()));
      expect(find.text('50,99 ₼ / il'), findsOneWidget);
      expect(find.text('≈ \$29.99'), findsOneWidget);
    });

    screenTest('renders nothing when unavailable or for lifetime', (tester) async {
      await _pump(tester, EpointPayOptionView(plan: 'yearly', epoint: _Hook().value(available: false)));
      expect(find.byKey(const ValueKey('epoint-pay-option')), findsNothing);
      await _pump(tester, EpointPayOptionView(plan: 'lifetime', epoint: _Hook().value()));
      expect(find.byKey(const ValueKey('epoint-pay-option')), findsNothing);
    });

    screenTest('shows the error message and the timeout retry, and reports success once', (tester) async {
      final hook = _Hook();
      var premium = 0;
      final holder = ValueNotifier<UseInAppEpoint>(hook.value(available: false, status: 'error', messageKey: 'iep_err_premium_store'));
      await _pump(
        tester,
        ValueListenableBuilder<UseInAppEpoint>(
          valueListenable: holder,
          builder: (context, value, _) => EpointPayOptionView(plan: 'yearly', epoint: value, onPremium: () => premium++),
        ),
      );
      expect(find.byKey(const ValueKey('epoint-alert')), findsOneWidget);
      expect(find.textContaining('App Store'), findsOneWidget);
      holder.value = hook.value(status: 'timeout', messageKey: 'iep_timeout');
      await tester.pump();
      await tester.tap(find.text('Yenidən yoxla'));
      expect(hook.checks, 1);
      holder.value = hook.value(status: 'success');
      await tester.pump();
      holder.value = hook.value(status: 'success');
      await tester.pump();
      expect(premium, 1);
      expect(find.byKey(const ValueKey('epoint-status')), findsOneWidget);
      expect(find.textContaining('Premium aktivləşdi'), findsOneWidget);
    });
  });
}
