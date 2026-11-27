// Ported from: src/components/BlockedScreen.tsx
//
// Full block (`block_type = 'full'`): nothing but the reason, the expiry (or "permanent") and sign-out.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';

/// `new Date(expires_at).toLocaleDateString(getLocaleTag(), {day, month: 'long', year, hour, minute})`.
String? blockExpiryText(String? expiresAt) {
  if (expiresAt == null || expiresAt.isEmpty) return null;
  final at = DateTime.tryParse(expiresAt);
  if (at == null) return null;
  return formatDateTimeAz(at.toLocal(), includeYear: true);
}

class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key, required this.block});
  final ActiveBlock block;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final s = t.shadcn;
    final dark = t.isDark;
    final pad = MediaQuery.paddingOf(context);
    final expiry = blockExpiryText(block.expiresAt);
    final sm = css(14, FontWeight.w400, height: 20 / 14, color: s.mutedForeground);
    // red-50 / dark:red-950/40, red-200 / dark:red-900, red-50/60 / dark:red-950/20, red-600 / dark:red-400
    const red950 = TwColors.red950;
    return Material(
      type: MaterialType.transparency,
      child: ColoredBox(
        color: s.background,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, pad.top, 24, pad.bottom),
          child: Center(
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 80,
                  height: 80,
                  margin: const EdgeInsets.only(bottom: 20),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: dark ? red950.withValues(alpha: 0.4) : TwColors.red50,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const AIcon(AIcons.ban, size: 40, color: TwColors.red500),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(tr('blocked_title', 'Hesabınız bloklanıb'),
                      textAlign: TextAlign.center, style: css(20, FontWeight.w900, height: 28 / 20, color: s.foreground)),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 384),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 24),
                    child: Text(
                      tr('blocked_subtitle',
                          'Anacan qaydalarının pozulmasına görə hesabınız tətbiqdən müvəqqəti və ya daimi olaraq kənarlaşdırılıb.'),
                      textAlign: TextAlign.center,
                      style: sm,
                    ),
                  ),
                ),
                Container(
                  constraints: const BoxConstraints(maxWidth: 384),
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: dark ? red950.withValues(alpha: 0.2) : TwColors.red50.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: dark ? TwColors.red900 : TwColors.red200),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        const AIcon(AIcons.shieldAlert, size: 16, color: TwColors.red500),
                        const SizedBox(width: 8),
                        Text(cssUppercase(tr('blocked_reason_label', 'Bloklanma səbəbi'), currentLanguage()),
                            style: css(12, FontWeight.w700, height: 16 / 12, lsEm: 0.025, color: dark ? TwColors.red400 : TwColors.red600)),
                      ]),
                    ),
                    Text(
                      (block.reason != null && block.reason!.isNotEmpty) ? block.reason! : tr('blocked_reason_default', 'Qaydaların pozulması'),
                      style: css(14, FontWeight.w400, height: 1.625, color: s.foreground),
                    ),
                  ]),
                ),
                Container(
                  constraints: const BoxConstraints(maxWidth: 384),
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 32),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: s.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: s.border),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.clock, size: 16, color: s.mutedForeground)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text.rich(
                          expiry != null
                              ? TextSpan(children: [
                                  TextSpan(text: '${tr('blocked_until', 'Blokun bitmə tarixi:')} '),
                                  TextSpan(text: expiry, style: TextStyle(fontWeight: FontWeight.w600, color: s.foreground)),
                                ])
                              : TextSpan(text: tr('blocked_permanent', 'Bu blok daimidir.')),
                          style: sm,
                        ),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    Text(tr('blocked_appeal', 'Bunun səhv olduğunu düşünürsünüzsə, support@anacan.az ünvanına yazın.'),
                        style: css(11, FontWeight.w400, color: s.mutedForeground)),
                  ]),
                ),
                GestureDetector(
                  key: const ValueKey('blocked-signout'),
                  onTap: () => ref.read(entryAuthActionsProvider).signOut(),
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AIcon(AIcons.logOut, size: 16, color: s.foreground),
                      const SizedBox(width: 8),
                      Text(tr('blocked_signout', 'Hesabdan çıx'), style: css(14, FontWeight.w700, height: 20 / 14, color: s.foreground)),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
