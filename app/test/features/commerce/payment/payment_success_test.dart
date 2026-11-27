// Ported from: src/components/payment/PaymentSuccess.test.tsx
import 'package:anacan/features/commerce/payment/payment_result.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

void main() {
  screenTest('does not treat an Azure return URL or forged query flag as proof of payment', (tester) async {
    await pumpApp(tester, const PaymentSuccessPage(), overrides: [...baseOverrides(), paymentAzureBackendProvider.overrideWithValue(true)], scroll: false);
    expect(find.text('Ödənişin təsdiqi gözlənilir'), findsOneWidget);
    expect(find.text('Ödəniş Uğurlu! 🎉'), findsNothing);
  });

  screenTest('keeps the current source-build return screen', (tester) async {
    await pumpApp(tester, const PaymentSuccessPage(), overrides: [...baseOverrides(), paymentAzureBackendProvider.overrideWithValue(false)], scroll: false);
    expect(find.textContaining('Ödəniş Uğurlu!'), findsOneWidget);
  });

  screenTest('payment error page offers retry and home', (tester) async {
    await pumpApp(tester, const PaymentErrorPage(), overrides: baseOverrides(), scroll: false);
    expect(find.text('Ödəniş Uğursuz'), findsOneWidget);
    expect(find.text('Yenidən cəhd et'), findsOneWidget);
    expect(find.text('Ana Səhifəyə Qayıt'), findsOneWidget);
  });
}
