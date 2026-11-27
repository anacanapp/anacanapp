// Ported from: src/components/qaygicash/QaygiCashProfileCard.tsx, src/components/qaygicash/QaygiCashHomeCard.tsx,
//              src/components/qaygicash/qaygicash.css (.qc-card-profile, .qc-card-hint, .qc-home),
//              src/components/ProfileScreen.tsx (the QayğıCash profile row: label QC_BRAND, badge formatQc(available),
//              sub qf('qc_profile_sub'))
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../profile/profile_interfaces.dart' show ProfileRowData;
import '../common/commerce_ui.dart';
import 'qaygicash.dart';
import 'qaygicash_copy.dart';
import 'qaygicash_hooks.dart';
import 'qaygicash_screen.dart' show QcBalanceCard;
import 'qc_parts.dart';

/// Profile entry (after Anacan Premium): compact wallet card with a one-line explanation. Hidden when the
/// programme is off. [onOpen] defaults to `openQaygiCash`.
class QaygiCashProfileCard extends ConsumerWidget {
  const QaygiCashProfileCard({super.key, this.onOpen});
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(qcWalletProvider).wallet;
    if (wallet == null) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Semantics(
        button: true,
        child: PressScale.css(
          key: const ValueKey('qc-profile-card'),
          scale: 0.985,
          onTap: onOpen ?? () => openQaygiCash(ref),
          child: QcBalanceCard(
            wallet: wallet,
            language: language,
            compact: true,
            children: [
              const SizedBox(height: 8),
              Opacity(
                opacity: 0.9,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(qt('qc_profile_hint'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.35)),
                    ),
                    const SizedBox(width: 4),
                    const AIcon(AIcons.chevronRight, size: 15, color: Color(0xFFFFFFFF), mirrorInRtl: true),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `useQaygiCashWallet().wallet` → the profile list row.
final qaygiCashProfileRowProvider = Provider.autoDispose<ProfileRowData?>((ref) {
  final wallet = ref.watch(qcWalletProvider).wallet;
  if (wallet == null) return null;
  return ProfileRowData(
    id: 'qaygicash',
    label: qcBrand,
    badge: formatQc(wallet.availableMinor),
    sub: qf('qc_profile_sub', {'amount': formatQc(wallet.availableMinor)}),
  );
});

/// Dashboard entry: the balance card once there is bonus activity, otherwise a one-time, dismissible intro
/// (remembered per account on this device). Nothing when the programme is off. (Not mounted by any React
/// screen today; ported with its tests.)
class QaygiCashHomeCard extends ConsumerStatefulWidget {
  const QaygiCashHomeCard({super.key, this.onOpen});
  final VoidCallback? onOpen;

  @override
  ConsumerState<QaygiCashHomeCard> createState() => _QaygiCashHomeCardState();
}

class _QaygiCashHomeCardState extends ConsumerState<QaygiCashHomeCard> {
  bool? _dismissed;
  String? _uid;

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authUserProvider.select((u) => u?.id));
    if (_dismissed == null || uid != _uid) {
      _uid = uid;
      _dismissed = readIntroDismissed(ref.read(localStoreProvider), uid);
    }
    final wallet = ref.watch(qcWalletProvider).wallet;
    if (wallet == null) return const SizedBox.shrink();
    final language = qcLanguage(ref);
    final a = context.a;
    final qc = QcColors.of(context);
    void open() => widget.onOpen != null ? widget.onOpen!() : openQaygiCash(ref);
    const white = Color(0xFFFFFFFF);

    if (hasQcActivity(wallet)) {
      return Padding(
        key: const ValueKey('qc-home-card'),
        padding: const EdgeInsets.only(top: 22),
        child: Semantics(
          button: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: open,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                boxShadow: qc.cardShadow,
                gradient: LinearGradient(colors: [qc.c1, qc.c2]),
              ),
              child: DefaultTextStyle.merge(
                style: const TextStyle(color: white),
                child: Row(
                  children: [
                    const QcCoin(size: 'lg'),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Opacity(
                            opacity: 0.92,
                            child: Text(qt('qc_home_balance'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          ),
                          Text(
                            formatQc(wallet.availableMinor, language),
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, fontFeatures: tabularFigures),
                          ),
                        ],
                      ),
                    ),
                    if (wallet.pendingMinor > 0)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Opacity(
                            opacity: 0.92,
                            child: Text(qt('qc_home_pending'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          ),
                          Text(
                            '+${formatQc(wallet.pendingMinor, language)}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, fontFeatures: tabularFigures),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    if (_dismissed == true) return const SizedBox.shrink();
    void dismiss() {
      writeIntroDismissed(ref.read(localStoreProvider), uid);
      setState(() => _dismissed = true);
    }

    return Padding(
      key: const ValueKey('qc-home-intro'),
      padding: const EdgeInsets.only(top: 22),
      child: A3Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const QcCoin(),
                      const SizedBox(width: 6),
                      Text(
                        qcBrand,
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: a.ink),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: qc.chip, borderRadius: BorderRadius.circular(999)),
                        child: Text(
                          qt('qc_intro_badge'),
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: a.coralText),
                        ),
                      ),
                    ],
                  ),
                ),
                Semantics(
                  button: true,
                  label: qt('qc_close'),
                  child: GestureDetector(
                    key: const ValueKey('qc-home-intro-close'),
                    onTap: dismiss,
                    child: Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                      child: AIcon(AIcons.x, size: 14, color: a.inkSoft),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              qt('qc_intro_title'),
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, height: 1.3, color: a.ink),
            ),
            const SizedBox(height: 8),
            Text(qt('qc_intro_text'), style: context.aText.a3Meta.copyWith(fontSize: 13, height: 1.45)),
            const SizedBox(height: 8),
            APillButton(
              label: qt('qc_intro_cta'),
              solid: true,
              minHeight: 40,
              onTap: () {
                dismiss();
                open();
              },
            ),
          ],
        ),
      ),
    );
  }
}
