// Ported from: src/components/shop/CouponInput.tsx
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart' show ALoader, FadeRise, Tw, px;
import 'coupons.dart';

class CouponInput extends StatefulWidget {
  const CouponInput({super.key, required this.couponCode, required this.onCodeChange, required this.onApply, required this.onRemove, required this.appliedCoupon, required this.validating});
  final String couponCode;
  final ValueChanged<String> onCodeChange;
  final VoidCallback onApply;
  final VoidCallback onRemove;
  final AppliedCoupon? appliedCoupon;
  final bool validating;

  @override
  State<CouponInput> createState() => _CouponInputState();
}

class _CouponInputState extends State<CouponInput> {
  late final TextEditingController _c = TextEditingController(text: widget.couponCode);

  @override
  void didUpdateWidget(CouponInput old) {
    super.didUpdateWidget(old);
    if (widget.couponCode != _c.text) _c.value = TextEditingValue(text: widget.couponCode, selection: TextSelection.collapsed(offset: widget.couponCode.length));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final dark = context.tokens.isDark;
    final applied = widget.appliedCoupon;
    if (applied != null) {
      final ink = dark ? TwColors.green500 : TwColors.green600;
      return FadeRise(
        dy: -5,
        child: Container(
          key: const ValueKey('coupon-applied'),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: dark ? TwColors.green950.withValues(alpha: 0.3) : TwColors.green50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: dark ? TwColors.green800 : TwColors.green200),
          ),
          child: Row(children: [
            const AIcon(AIcons.check, size: 16, color: TwColors.green600),
            const SizedBox(width: 8),
            Expanded(
              child: Text.rich(TextSpan(children: [
                TextSpan(text: applied.coupon.code, style: px(12, weight: FontWeight.w700, color: dark ? TwColors.green400 : TwColors.green700)),
                TextSpan(text: '  -${applied.discountAmount.toStringAsFixed(2)}₼', style: px(10, color: ink)),
              ])),
            ),
            GestureDetector(
              key: const ValueKey('coupon-remove'),
              onTap: widget.onRemove,
              child: const Padding(padding: EdgeInsets.all(4), child: AIcon(AIcons.x, size: 14, color: TwColors.green600)),
            ),
          ]),
        ),
      );
    }
    final canApply = widget.couponCode.trim().isNotEmpty && !widget.validating;
    return Row(children: [
      Expanded(
        child: Container(
          height: 36,
          padding: const EdgeInsetsDirectional.only(start: 12, end: 12),
          decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(8), border: Border.all(color: s.border)),
          child: Row(children: [
            AIcon(AIcons.tag, size: 14, color: s.mutedForeground),
            const SizedBox(width: 10),
            Expanded(
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                  key: const ValueKey('coupon-code'),
                  controller: _c,
                  onChanged: (v) => widget.onCodeChange(v.toUpperCase()),
                  // text-sm loses to keyboard.css on phones (16px, line-height stays 20px).
                  style: phoneInputStyle(context, Tw.sm.copyWith(color: s.foreground), lineHeightPx: 20),
                  cursorColor: s.primary,
                  decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: tr('untranslated_kupon_kodu_xiawxh', 'Kupon kodu'), hintStyle: phoneInputStyle(context, Tw.sm.copyWith(color: s.mutedForeground), lineHeightPx: 20)),
                ),
              ),
            ),
          ]),
        ),
      ),
      const SizedBox(width: 8),
      Semantics(
        button: true,
        enabled: canApply,
        child: GestureDetector(
          key: const ValueKey('coupon-apply'),
          onTap: canApply ? widget.onApply : null,
          child: Opacity(
            opacity: canApply ? 1 : 0.5,
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(8)),
              child: widget.validating
                  ? ALoader(size: 14, color: s.primaryForeground)
                  : Text(tr('couponinput_tetbiq_et_e5077b', 'Tətbiq et'), style: px(12, weight: FontWeight.w700, color: s.primaryForeground)),
            ),
          ),
        ),
      ),
    ]);
  }
}
