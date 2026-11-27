// Ported from: src/components/qaygicash/QaygiCashPremium.tsx, src/components/qaygicash/qaygicash.css
//              (.qc-prem-line, .qc-prem-opt, .qc-sheet-wrap, .qc-sheet)
//
// Premium with bonus stays off until the owner enables it: the option renders only when the server's
// premium_redeem switches (programme, plan, platform) are all on.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../design/design.dart';
import '../../../native/purchases/purchases_providers.dart' show currentStorePlatform;
import '../../settings/ui/settings_ui.dart' show ALoader, toasts;
import '../commerce_backend.dart';
import '../common/commerce_ui.dart';
import 'qaygicash.dart';
import 'qaygicash_copy.dart';
import 'qaygicash_hooks.dart';
import 'qc_parts.dart';

/// `getPlatform()` of revenuecat.ts ('ios' | 'android' | 'web'); tests override it.
final commercePlatformProvider = Provider<String>((ref) => currentStorePlatform());

/// `useAuth().refreshProfile` (tests override it).
final qcRefreshProfileProvider = Provider<Future<void> Function()>(
  (ref) =>
      () => ref.read(authControllerProvider.notifier).refreshProfile(),
);

/// Same roots the store purchase sync refreshes (useInAppPurchase.syncWithDatabase).
const Set<String> premiumQueryRoots = {
  'premium-access-v1', 'subscription', 'household-premium', 'community-feed', 'group-posts', 'post-comments', 'single-post', //
  'user-posts', 'community-connections', 'public-profile', 'community-profile', 'community-profile-card', 'chat-authors-v2',
};

/// "+1,34 ₼ QayğıCash" under a paywall plan (earned on the fixed base: yearly 26,99, monthly 3,99).
class QcPremiumEarnLine extends ConsumerWidget {
  const QcPremiumEarnLine({super.key, required this.plan});
  final QcPremiumPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    final amount = premiumEarnMinor(wallet, plan);
    if (wallet == null || amount <= 0) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final qc = QcColors.of(context);
    final text = plan == 'yearly'
        ? qf('qc_prem_earn', {'amount': formatQc(amount, language)})
        : qf('qc_prem_earn_renewal', {'amount': formatQc(amount, language)});
    return Container(
      key: ValueKey('qc-prem-earn-$plan'),
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: qc.mint, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          const QcCoin(size: 'sm'),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: qc.mintInk, fontFeatures: tabularFigures),
            ),
          ),
        ],
      ),
    );
  }
}

/// Result of the `qaygicash-premium` function.
class QcPremiumResult {
  const QcPremiumResult.ok(this.expiresAt) : ok = true, code = null;
  const QcPremiumResult.failed(this.code) : ok = false, expiresAt = null;
  final bool ok;
  final String? expiresAt;
  final String? code;
}

Future<QcPremiumResult> invokeQcPremium(CommerceBackend backend, QcPremiumPlan plan, String platform) async {
  try {
    final res = await backend.invoke('qaygicash-premium', {'plan': plan, 'platform': platform});
    final data = res.data;
    if (res.error == null && data is Map && data['ok'] == true) {
      return QcPremiumResult.ok(data['expires_at'] is String ? data['expires_at'] as String : null);
    }
    final body = functionErrorBody(res.error) ?? data;
    return QcPremiumResult.failed(qcErrorCode(body) ?? qcErrorCode(res.error));
  } catch (e) {
    return QcPremiumResult.failed(qcErrorCode(e));
  }
}

/// "Pay with QayğıCash (X ₼)" for one Premium plan. Hidden unless the server enables Premium with bonus,
/// this plan and this platform (all off by default). Confirms in an in-page sheet before spending.
class QaygiCashPremiumOption extends ConsumerStatefulWidget {
  const QaygiCashPremiumOption({super.key, required this.plan, this.onDone, this.marginTop = 0});
  final QcPremiumPlan plan;
  final VoidCallback? onDone;
  final double marginTop;

  @override
  ConsumerState<QaygiCashPremiumOption> createState() => _QaygiCashPremiumOptionState();
}

class _QaygiCashPremiumOptionState extends ConsumerState<QaygiCashPremiumOption> {
  bool _busy = false;

  Future<void> _pay(QcWallet wallet, int price, String planLabel, String platform, VoidCallback close) async {
    if (_busy) return;
    setState(() => _busy = true);
    final toast = toasts(context);
    final language = qcLanguage(ref);
    final client = ref.read(queryClientProvider);
    final result = await invokeQcPremium(ref.read(commerceBackendProvider), widget.plan, platform);
    if (mounted) setState(() => _busy = false);
    close();
    unawaited(invalidateQaygiCash(client));
    if (result.ok) {
      qcTrack(ref, 'qc_premium_redeem', {'plan': widget.plan, 'platform': platform, 'amount_minor': price, 'ok': true});
      try {
        await ref.read(qcRefreshProfileProvider)();
      } catch (_) {
        // the entitlement query below still refreshes
      }
      unawaited(client.invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && premiumQueryRoots.contains('${q.queryKey.first}')));
      toast.success(result.expiresAt != null ? qf('qc_prem_success', {'date': formatQcDate(result.expiresAt!, language)}) : planLabel);
      widget.onDone?.call();
    } else {
      qcTrack(ref, 'qc_premium_redeem', {'plan': widget.plan, 'platform': platform, 'ok': false, 'error': result.code ?? 'unknown'});
      toast.error(qk(qcErrorKey(result.code)));
    }
  }

  void _confirm(QcWallet wallet, int price, String priceText, String planLabel, String platform) {
    final busy = ValueNotifier<bool>(false);
    unawaited(
      showGeneralDialog<void>(
        context: context,
        barrierDismissible: false,
        barrierLabel: qt('qc_cancel'),
        barrierColor: const Color.fromRGBO(0, 0, 0, 0.42), // .qc-sheet-wrap
        transitionDuration: Duration.zero,
        pageBuilder: (dialogContext, _, _) {
          void close() {
            if (Navigator.of(dialogContext).canPop()) Navigator.of(dialogContext).pop();
          }

          return _QcConfirmSheet(
            priceText: priceText,
            planLabel: planLabel,
            busy: busy,
            onCancel: () {
              if (!busy.value) close();
            },
            onConfirm: () async {
              busy.value = true;
              await _pay(wallet, price, planLabel, platform, close);
            },
          );
        },
      ).whenComplete(busy.dispose),
    );
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    final platform = ref.watch(commercePlatformProvider);
    final option = premiumRedeemOption(wallet, widget.plan, platform);
    if (wallet == null || option == null) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final a = context.a;
    final price = formatQc(option.price, language);
    final planLabel = qt(widget.plan == 'yearly' ? 'qc_prem_plan_yearly' : 'qc_prem_plan_monthly');
    final enabled = option.affordable && !_busy;
    return Padding(
      padding: EdgeInsets.only(top: widget.marginTop),
      child: Semantics(
        button: true,
        enabled: enabled,
        child: GestureDetector(
          key: ValueKey('qc-prem-pay-${widget.plan}'),
          behavior: HitTestBehavior.opaque,
          onTap: enabled ? () => _confirm(wallet, option.price, price, planLabel, platform) : null,
          child: Opacity(
            opacity: enabled ? 1 : 0.6,
            child: CustomPaint(
              foregroundPainter: _DashedBorder(color: a.lineStrong, radius: 18),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18)),
                child: Row(
                  children: [
                    const QcCoin(),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            qf('qc_prem_pay', {'amount': price}),
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink),
                          ),
                          Text(
                            option.affordable
                                ? '$planLabel · $qcBrand ${formatQc(wallet.availableMinor, language)}'
                                : qf('qc_prem_pay_need', {'amount': price}),
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, fontFeatures: tabularFigures),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QcConfirmSheet extends StatelessWidget {
  const _QcConfirmSheet({required this.priceText, required this.planLabel, required this.busy, required this.onCancel, required this.onConfirm});
  final String priceText;
  final String planLabel;
  final ValueNotifier<bool> busy;
  final VoidCallback onCancel;
  final Future<void> Function() onConfirm;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AScope(
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onCancel),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Semantics(
                scopesRoute: true,
                explicitChildNodes: true,
                namesRoute: true,
                label: qt('qc_prem_confirm_title'),
                child: Container(
                  key: const ValueKey('qc-prem-sheet'),
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(18, 22, 18, 18 + bottom),
                  decoration: BoxDecoration(
                    color: a.surface,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                  ),
                  child: ValueListenableBuilder<bool>(
                    valueListenable: busy,
                    builder: (context, isBusy, _) => Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const QcCoin(size: 'lg'),
                        const SizedBox(height: 12),
                        Text(
                          qt('qc_prem_confirm_title'),
                          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: a.ink),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          qf('qc_prem_confirm_text', {'amount': priceText, 'plan': planLabel}),
                          style: TextStyle(fontSize: 13.5, height: 1.5, color: a.inkSoft),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: APillButton(label: qt('qc_cancel'), onTap: isBusy ? null : onCancel, minHeight: 48),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: PressScale.css(
                                key: const ValueKey('qc-prem-confirm'),
                                onTap: isBusy ? null : () => unawaited(onConfirm()),
                                child: Container(
                                  constraints: const BoxConstraints(minHeight: 48),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                                  child: isBusy
                                      ? const ALoader(size: 16, color: Color(0xFFFFFFFF))
                                      : Text(qt('qc_prem_confirm'), style: context.aText.aPillBtn.copyWith(color: const Color(0xFFFFFFFF))),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// `border: 2px dashed` of `.qc-prem-opt`.
class _DashedBorder extends CustomPainter {
  _DashedBorder({required this.color, required this.radius});
  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(1));
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 6), paint);
        d += 12;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius;
}
