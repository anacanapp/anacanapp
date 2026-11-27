// Ported from: src/components/payment/PaymentSuccess.tsx, src/components/payment/PaymentError.tsx
//
// Outer routes /payment/success and /payment/error. A return URL is not a payment receipt: on the Azure backend
// the success page says the confirmation is pending (provider certification / order-bound return verification).
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/net/backend_client.dart' show BootstrapOpened;
import '../../../core/net/backend_providers.dart' show backendBootstrapProvider;
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ASky;

/// `isAzureBackend()` of the opened backend (a backend that is not open yet counts as not Azure).
final paymentAzureBackendProvider = Provider<bool>((ref) {
  try {
    final result = ref.watch(backendBootstrapProvider).value;
    return result is BootstrapOpened && result.backend.azure;
  } catch (_) {
    return false;
  }
});

void _goHome(BuildContext context) {
  try {
    GoRouter.of(context).go('/');
  } catch (_) {
    Navigator.of(context).maybePop();
  }
}

void _goBack(BuildContext context) {
  try {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
    } else {
      router.go('/');
    }
  } catch (_) {
    Navigator.of(context).maybePop();
  }
}

class _ResultFrame extends StatelessWidget {
  const _ResultFrame({required this.iconBg, required this.icon, required this.title, required this.text, required this.buttons});
  final BoxDecoration iconBg;
  final Widget icon;
  final String title;
  final String text;
  final List<Widget> buttons;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(
          children: [
            const Positioned(top: 0, left: 0, right: 0, child: ASky()),
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 80, height: 80, alignment: Alignment.center, decoration: iconBg, child: icon),
                        const SizedBox(height: 24),
                        Semantics(
                          header: true,
                          child: Text(
                            title,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.44, color: a.ink),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          text,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13.5, color: a.inkSoft),
                        ),
                        const SizedBox(height: 32),
                        for (var i = 0; i < buttons.length; i++) ...[if (i > 0) const SizedBox(height: 12), buttons[i]],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _button(
  BuildContext context, {
  required Key key,
  required String label,
  required AIconData icon,
  required VoidCallback onTap,
  bool outline = false,
  bool mirror = false,
}) {
  final a = context.a;
  final fg = outline ? a.ink : const Color(0xFFFFFFFF);
  return PressScale.css(
    key: key,
    onTap: onTap,
    child: Container(
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: outline ? a.surface : a.peach2,
        borderRadius: BorderRadius.circular(999),
        border: outline ? Border.all(color: a.lineStrong) : null,
        // 0 14px 28px -12px rgba(217, 108, 74, 0.55) (PaymentSuccess/PaymentError literal)
        boxShadow: outline ? null : const [BoxShadow(offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12, color: Color.fromRGBO(217, 108, 74, 0.55))],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AIcon(icon, size: 16, color: fg, mirrorInRtl: mirror),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: fg),
          ),
        ],
      ),
    ),
  );
}

class PaymentSuccessPage extends ConsumerWidget {
  const PaymentSuccessPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final awaiting = ref.watch(paymentAzureBackendProvider);
    return _ResultFrame(
      iconBg: BoxDecoration(color: a.green1, shape: BoxShape.circle),
      icon: AIcon(awaiting ? AIcons.clock : AIcons.circleCheck, size: 38, color: awaiting ? a.blueInk : a.greenInk),
      title: awaiting ? tr('payment_confirmation_pending', 'Ödənişin təsdiqi gözlənilir') : tr('paymentsuccess_odenis_ugurlu_3d14c3', 'Ödəniş Uğurlu! 🎉'),
      text: awaiting
          ? tr('payment_status_needs_review', 'Ödənişin nəticəsi təsdiqlənmədi. Yenidən ödəməzdən əvvəl sifarişin vəziyyətini dəstək xidməti ilə yoxlayın.')
          : tr('paymentsuccess_odenisiniz_muveffeqiyyetle_hey_b90350', 'Ödənişiniz müvəffəqiyyətlə həyata keçirildi. Sifarişiniz emal olunacaq.'),
      buttons: [
        _button(
          context,
          key: const ValueKey('payment-home'),
          label: tr('paymentsuccess_ana_sehifeye_qayit_2458e3', 'Ana Səhifəyə Qayıt'),
          icon: AIcons.arrowLeft,
          mirror: true,
          onTap: () => _goHome(context),
        ),
      ],
    );
  }
}

class PaymentErrorPage extends StatelessWidget {
  const PaymentErrorPage({super.key});

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return _ResultFrame(
      iconBg: BoxDecoration(gradient: a.alertBg, shape: BoxShape.circle),
      icon: AIcon(AIcons.circleX, size: 38, color: a.alertInk),
      title: tr('paymenterror_odenis_ugursuz_585482', 'Ödəniş Uğursuz'),
      text: tr(
        'paymenterror_odenisiniz_heyata_kecirile_bil_31b720',
        'Ödənişiniz həyata keçirilə bilmədi. Zəhmət olmasa yenidən cəhd edin və ya digər ödəniş üsulundan istifadə edin.',
      ),
      buttons: [
        _button(
          context,
          key: const ValueKey('payment-retry'),
          label: tr('paymenterror_yeniden_cehd_et_d273ac', 'Yenidən cəhd et'),
          icon: AIcons.refreshCw,
          onTap: () => _goBack(context),
        ),
        _button(
          context,
          key: const ValueKey('payment-home'),
          label: tr('paymenterror_ana_sehifeye_qayit_2458e3', 'Ana Səhifəyə Qayıt'),
          icon: AIcons.arrowLeft,
          outline: true,
          mirror: true,
          onTap: () => _goHome(context),
        ),
      ],
    );
  }
}
