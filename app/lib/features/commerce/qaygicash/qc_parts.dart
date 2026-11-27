// Ported from: src/components/qaygicash/QcParts.tsx, src/components/qaygicash/qaygicash.css (:root / .dark
//              --qc-* variables, .qc-coin, .qc-badge, .qc-inline-bonus, .qc-redeem, .qc-switch, .qc-range,
//              .qc-sum-line, .qc-earn, .qc-success)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show Slider, SliderTheme, SliderThemeData, Material, MaterialType;

import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../shell/shell.dart' show PushNavIntent, shellProvider;
import '../common/commerce_ui.dart';
import 'qaygicash.dart';
import 'qaygicash_copy.dart';
import 'qaygicash_hooks.dart';

/// The `--qc-*` variables of qaygicash.css (feature-local literals, light `:root` and `.dark`).
class QcColors {
  const QcColors._({
    required this.c1,
    required this.c2,
    required this.c3,
    required this.coin,
    required this.coinInk,
    required this.cardShadow,
    required this.mint,
    required this.mintInk,
    required this.amber,
    required this.amberInk,
    required this.sky,
    required this.skyInk,
    required this.chip,
  });
  final Color c1, c2, c3, coin, coinInk, mint, mintInk, amber, amberInk, sky, skyInk, chip;
  final List<BoxShadow> cardShadow;

  static const QcColors light = QcColors._(
    c1: Color(0xFFFF6F61),
    c2: Color(0xFFFF9A6B),
    c3: Color(0xFFFFC58F),
    coin: Color(0xFFFFD27A),
    coinInk: Color(0xFF8A4B00),
    cardShadow: [BoxShadow(offset: Offset(0, 22), blurRadius: 40, spreadRadius: -22, color: Color.fromRGBO(217, 58, 64, 0.75))],
    mint: Color(0xFFE3F4EA),
    mintInk: Color(0xFF1F6B44),
    amber: Color(0xFFFFF2D6),
    amberInk: Color(0xFF8A5A00),
    sky: Color(0xFFE4EFFF),
    skyInk: Color(0xFF1D4F9A),
    chip: Color.fromRGBO(255, 111, 97, 0.14),
  );

  static const QcColors dark = QcColors._(
    c1: Color(0xFFD9434A),
    c2: Color(0xFFE4704E),
    c3: Color(0xFFB8653A),
    coin: Color(0xFFFFCF6E),
    coinInk: Color(0xFF5A3100),
    cardShadow: [BoxShadow(offset: Offset(0, 16), blurRadius: 30, spreadRadius: -18, color: Color.fromRGBO(0, 0, 0, 0.7))],
    mint: Color(0xFF183A2A),
    mintInk: Color(0xFF9FE0B9),
    amber: Color(0xFF3A2E12),
    amberInk: Color(0xFFFFD27A),
    sky: Color(0xFF1B2A44),
    skyInk: Color(0xFFA8C6FF),
    chip: Color.fromRGBO(255, 154, 158, 0.16),
  );

  static QcColors of(BuildContext context) => context.tokens.brightness == Brightness.dark ? dark : light;
}

/// Opens the wallet from any screen (Index switches to the QayğıCash sub-screen).
void openQaygiCash(WidgetRef ref) => ref.read(shellProvider.notifier).dispatchPushEvent(const PushNavIntent(screen: 'qaygicash'));

/// Analytics never blocks or breaks a purchase flow ('qc_wallet_view' | 'qc_redeem_toggle' | 'qc_redeem_commit' |
/// 'qc_premium_redeem').
void qcTrack(WidgetRef ref, String event, [Map<String, Object?> params = const {}]) {
  try {
    ref.read(analyticsSinkProvider).logEvent(event, params);
  } catch (_) {}
}

/// `useQcLanguage()` = `useUserStore((s) => s.language)`.
String qcLanguage(WidgetRef ref) {
  try {
    return currentLanguage();
  } catch (_) {
    return 'az';
  }
}

/// `.qc-coin` (26; `.lg` 40; `.sm` 22).
class QcCoin extends StatelessWidget {
  const QcCoin({super.key, this.size, this.text = '₼'});

  /// 'sm' | 'lg' | null
  final String? size;
  final String text;

  @override
  Widget build(BuildContext context) {
    final qc = QcColors.of(context);
    final (double d, double f) = switch (size) {
      'lg' => (40.0, 18.0),
      'sm' => (22.0, 11.0),
      _ => (26.0, 13.0),
    };
    return ExcludeSemantics(
      child: Container(
        width: d,
        height: d,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: qc.coin,
          shape: BoxShape.circle,
          // inset 0 -2px 0 rgba(0,0,0,.15)
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [1 - 2 / d, 1 - 2 / d],
            colors: [qc.coin, Color.alphaBlend(const Color(0x26000000), qc.coin)],
          ),
        ),
        child: Text(
          text,
          style: TextStyle(fontSize: f, fontWeight: FontWeight.w900, height: 1, color: qc.coinInk),
        ),
      ),
    );
  }
}

/// "+0,60 ₼ · 5% QayğıCash" on a product card or detail. Renders nothing when the programme is off,
/// the channel earns 0 %, or (Aptek) the product is a partner product.
class QcProductBadge extends ConsumerWidget {
  const QcProductBadge({super.key, required this.channel, required this.priceMinor, this.own = true, this.fontSize = 10.5});
  final QcEarnChannel channel;
  final int priceMinor;
  final bool own;
  final double fontSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    final language = qcLanguage(ref);
    final rate = own ? rateOf(wallet, channel) : 0;
    final amount = earnPreview(priceMinor, rate);
    if (wallet == null || rate == 0 || amount <= 0) return const SizedBox.shrink();
    final a = context.a;
    final qc = QcColors.of(context);
    return Container(
      key: const ValueKey('qc-badge'),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: qc.chip, borderRadius: BorderRadius.circular(999)),
      child: Text(
        qf('qc_badge', {'amount': formatQc(amount, language), 'pct': formatRate(rate, language)}),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w800, color: a.coralText, fontFeatures: tabularFigures, height: 1.4),
      ),
    );
  }
}

/// Cart line note: "+1,06 ₼ bonus" for an earning line, "bonus yoxdur" for a partner product.
class QcLineBonus extends ConsumerWidget {
  const QcLineBonus({super.key, required this.channel, required this.amountMinor, this.own = true});
  final QcEarnChannel channel;
  final int amountMinor;
  final bool own;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    final language = qcLanguage(ref);
    final rate = rateOf(wallet, channel);
    if (wallet == null || rate == 0) return const SizedBox.shrink();
    final a = context.a;
    final amount = own ? earnPreview(amountMinor, rate) : 0;
    if (amount > 0) {
      return Text(
        qf('qc_line_bonus', {'amount': formatQc(amount, language)}),
        style: TextStyle(color: a.coralText, fontWeight: FontWeight.w700, fontSize: 13, fontFeatures: tabularFigures),
      );
    }
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
        child: Text(
          qt('qc_no_bonus'),
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: a.inkSoft),
        ),
      ),
    );
  }
}

/// Switch + slider state of `useQcRedeem`: on by default, at the maximum, following the cart until the person
/// moves the slider. Owned by the checkout widget.
class QcRedeemController extends ChangeNotifier {
  bool _on = true;
  int? _chosen;

  bool get on => _on;
  int? get chosen => _chosen;

  void setOn(bool value) {
    _on = value;
    notifyListeners();
  }

  void setAmount(int minor) {
    _chosen = minor;
    notifyListeners();
  }
}

/// `QcRedeemState`.
class QcRedeemState {
  QcRedeemState({
    required this.wallet,
    required this.limits,
    required this.channel,
    required this.on,
    required this.amount,
    required this.toggle,
    required this.setAmount,
  });
  final QcWallet? wallet;
  final RedeemLimits limits;
  final QcRedeemChannel channel;
  final bool on;

  /// Bonus applied to this order, in minor units (0 when off or not allowed).
  final int amount;
  final VoidCallback toggle;
  final void Function(int minor) setAmount;
}

/// `useQcRedeem(channel, goodsMinor)` over a [QcRedeemController].
QcRedeemState qcRedeemState(WidgetRef ref, QcRedeemController controller, QcRedeemChannel channel, int goodsMinor) {
  final wallet = ref.watch(qcWalletProvider).wallet;
  final limits = redeemLimits(wallet, channel, goodsMinor);
  final usable = limits.show && limits.block == null;
  final chosen = controller.chosen;
  final amount = usable && controller.on ? (chosen == null ? limits.max : clampRedeem(chosen, limits.min, limits.max)) : 0;
  return QcRedeemState(
    wallet: wallet,
    limits: limits,
    channel: channel,
    on: usable && controller.on,
    amount: amount,
    toggle: () {
      final next = !controller.on;
      controller.setOn(next);
      qcTrack(ref, 'qc_redeem_toggle', {'channel': channel, 'on': next});
    },
    setAmount: controller.setAmount,
  );
}

/// "Use QayğıCash" switch and slider. Hidden unless the programme is live, the channel is open and the balance
/// reaches the minimum.
class QcRedeemRow extends ConsumerWidget {
  const QcRedeemRow({super.key, required this.state, this.bordered = false});
  final QcRedeemState state;

  /// `.books .qc-redeem` / `.bk-sheet .qc-redeem`: no shadow, 1px line border.
  final bool bordered;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = state.wallet;
    final limits = state.limits;
    if (wallet == null || !limits.show) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final a = context.a;
    final blocked = limits.block == 'order';
    final steps = blocked ? 0 : ((limits.max - limits.min) / qcStepMinor).ceil();
    final on = state.on;
    final amount = state.amount;
    final index = on ? (((amount - limits.min) / qcStepMinor).round()).clamp(-1 << 30, steps) : 0;
    int fromIndex(int i) => i >= steps ? limits.max : limits.min + i * qcStepMinor;
    final labels = TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: a.inkSoft, fontFeatures: tabularFigures);
    return Container(
      key: const ValueKey('qc-redeem'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(22),
        boxShadow: bordered ? null : a.cardShadow,
        border: bordered ? Border.all(color: a.line) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            toggled: on,
            enabled: !blocked,
            button: true,
            child: GestureDetector(
              key: const ValueKey('qc-redeem-switch'),
              behavior: HitTestBehavior.opaque,
              onTap: blocked ? null : state.toggle,
              child: Row(
                children: [
                  const QcCoin(),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          qt('qc_use'),
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink),
                        ),
                        Text(
                          blocked
                              ? qf('qc_order_too_small', {'min': formatQc(limits.min, language)})
                              : qf('qc_use_sub', {'balance': formatQc(wallet.availableMinor, language), 'max': formatQc(limits.max, language)}),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.inkSoft, fontFeatures: tabularFigures),
                        ),
                      ],
                    ),
                  ),
                  if (!blocked) ...[const SizedBox(width: 10), _QcSwitch(on: on)],
                ],
              ),
            ),
          ),
          if (on && steps > 0) ...[
            const SizedBox(height: 12),
            Material(
              type: MaterialType.transparency,
              child: SliderTheme(
                data: SliderThemeData(activeTrackColor: a.coral, thumbColor: a.coral, inactiveTrackColor: a.line),
                child: Semantics(
                  label: qt('qc_amount_label'),
                  value: formatQc(amount, language),
                  child: Slider(
                    key: const ValueKey('qc-range'),
                    min: 0,
                    max: steps.toDouble(),
                    divisions: steps,
                    value: index.toDouble().clamp(0, steps.toDouble()),
                    onChanged: (v) => state.setAmount(fromIndex(v.round())),
                  ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(formatQc(limits.min, language), style: labels),
                Text(
                  formatQc(amount, language),
                  key: const ValueKey('qc-redeem-amount'),
                  style: labels.copyWith(color: a.coralText),
                ),
                Text(formatQc(limits.max, language), style: labels),
              ],
            ),
          ],
          if (on && steps == 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    formatQc(amount, language),
                    key: const ValueKey('qc-redeem-amount'),
                    style: labels.copyWith(color: a.coralText),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// `.qc-switch` (46×28 pill, 22 knob, 200 ms).
class _QcSwitch extends StatelessWidget {
  const _QcSwitch({required this.on});
  final bool on;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final instant = animationsDisabled(context);
    return AnimatedContainer(
      duration: instant ? Duration.zero : const Duration(milliseconds: 200),
      width: 46,
      height: 28,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: on ? a.coral : a.lineStrong, borderRadius: BorderRadius.circular(999)),
      child: AnimatedAlign(
        duration: instant ? Duration.zero : const Duration(milliseconds: 200),
        alignment: on ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(
            color: Color(0xFFFFFFFF),
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(offset: Offset(0, 1), blurRadius: 3, color: Color(0x33000000))],
          ),
        ),
      ),
    );
  }
}

/// Summary row "QayğıCash −X ₼".
class QcSummaryLine extends ConsumerWidget {
  const QcSummaryLine({super.key, required this.amount, this.fontSize = 14.5});
  final int amount;
  final double fontSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (amount <= 0) return const SizedBox.shrink();
    final style = TextStyle(fontSize: fontSize, color: context.a.coralText, fontWeight: FontWeight.w700, fontFeatures: tabularFigures);
    return Row(
      key: const ValueKey('qc-summary'),
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(qcBrand, style: style),
        Text('−${formatQc(amount, qcLanguage(ref))}', style: style),
      ],
    );
  }
}

/// Green "You'll earn +Y ₼" box.
class QcEarnBox extends ConsumerWidget {
  const QcEarnBox({super.key, required this.amount, this.digital = false});
  final int amount;
  final bool digital;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    if (wallet == null || amount <= 0) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final qc = QcColors.of(context);
    final when = digital ? qf('qc_earn_when_digital', {'n': wallet.holdDaysDigital}) : qf('qc_earn_when_physical', {'n': wallet.holdDaysPhysical});
    return Container(
      key: const ValueKey('qc-earn'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: qc.mint, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          const QcCoin(size: 'sm', text: '+'),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${qf('qc_earn_box', {'amount': formatQc(amount, language)})} $when',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, height: 1.4, color: qc.mintInk),
            ),
          ),
        ],
      ),
    );
  }
}

/// `QcOrderNote`.
class QcOrderNote {
  const QcOrderNote({required this.earnMinor, required this.usedMinor, required this.digital});
  final int earnMinor;
  final int usedMinor;
  final bool digital;
}

/// Earned-bonus note on an order success screen, with the date it becomes spendable.
class QcSuccessNote extends ConsumerWidget {
  const QcSuccessNote({super.key, required this.note});
  final QcOrderNote? note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    final n = note;
    if (wallet == null || n == null || (n.earnMinor <= 0 && n.usedMinor <= 0)) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final qc = QcColors.of(context);
    final date = formatQcDate(availableFrom(n.digital ? wallet.holdDaysDigital : wallet.holdDaysPhysical), language);
    final small = TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, height: 1.4, color: qc.mintInk);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Container(
        key: const ValueKey('qc-success'),
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: qc.mint, borderRadius: BorderRadius.circular(20)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (n.earnMinor > 0) ...[
              const QcCoin(size: 'lg'),
              const SizedBox(height: 4),
              Text(
                qf('qc_success_earn', {'amount': '+${formatQc(n.earnMinor, language)}'}),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: qc.mintInk, fontFeatures: tabularFigures),
              ),
              const SizedBox(height: 4),
              Text(qf('qc_success_date', {'date': date}), textAlign: TextAlign.center, style: small),
            ],
            if (n.usedMinor > 0) ...[
              const SizedBox(height: 4),
              Text(qf('qc_success_used', {'amount': formatQc(n.usedMinor, language)}), textAlign: TextAlign.center, style: small),
            ],
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => openQaygiCash(ref),
              child: Text(
                qt('qc_view_balance'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: qc.mintInk,
                  decoration: TextDecoration.underline,
                  decorationColor: qc.mintInk,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Fires [unawaited] invalidation (used after orders).
void refreshQaygiCash(WidgetRef ref) => unawaited(invalidateQaygiCash(ref.read(queryClientProvider)));
