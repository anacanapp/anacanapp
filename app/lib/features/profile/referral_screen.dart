// Ported from: src/components/ReferralScreen.tsx
//
// "Dostunu dəvət et": own code (copy / share), statistics trio, invited list with status chips, how-it-works
// steps, redeem box (only while the account has not redeemed a code), terms.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart';
import 'data/referral.dart';
import 'profile_interfaces.dart';
import 'profile_screen.dart' show DashedTopBorder, profileAvatarBuilderProvider;

class ReferralScreen extends ConsumerStatefulWidget {
  const ReferralScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends ConsumerState<ReferralScreen> {
  bool _copied = false;
  Timer? _copiedTimer;
  final TextEditingController _redeem = TextEditingController();

  @override
  void dispose() {
    _copiedTimer?.cancel();
    _redeem.dispose();
    super.dispose();
  }

  Future<void> _copy(String code) async {
    try {
      await Clipboard.setData(ClipboardData(text: code));
      setState(() => _copied = true);
      _copiedTimer?.cancel();
      _copiedTimer = Timer(const Duration(milliseconds: 1600), () {
        if (mounted) setState(() => _copied = false);
      });
    } catch (_) {}
  }

  Future<void> _share(String code) async {
    final text = tr('ref_share_text_v3', 'Anacan — hamiləlik, analıq və tsikl bələdçisi! Qeydiyyatda dəvət kodumu daxil et: {code} 💛').replaceAll('{code}', code);
    await ref.read(shareServiceProvider).share(text: text);
  }

  Future<void> _handleRedeem() async {
    final c = _redeem.text.trim().toUpperCase();
    if (c.length < 4) return;
    final toast = toasts(context);
    try {
      final res = await ref.read(redeemReferralMutation.notifier).mutateAsync(c);
      if (res.success) {
        toast.show(
          title: tr('ref_redeem_success', 'Təbriklər! 🎉'),
          description: tr('ref_redeem_success_desc_v2', 'Dəvət kodu tətbiq olundu — dəvət edən dostunuz sizə görə mükafat qazanacaq'),
        );
        _redeem.clear();
        if (mounted) setState(() {});
      } else {
        final msg = res.error == 'own_code'
            ? tr('ref_err_own', 'Öz kodunuzu istifadə edə bilməzsiniz')
            : res.error == 'already_redeemed'
                ? tr('ref_err_already', 'Artıq bir dəvət kodu istifadə etmisiniz')
                : tr('ref_err_invalid', 'Kod tapılmadı — yoxlayıb yenidən yazın');
        toast.show(title: tr('ref_redeem_failed', 'Alınmadı'), description: msg, destructive: true);
      }
    } catch (_) {
      toast.show(title: tr('ref_redeem_failed', 'Alınmadı'), description: tr('ref_err_generic', 'Xəta baş verdi — yenidən cəhd edin'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final codeQ = ref.watch(referralCodeQuery);
    final details = ref.watch(referralDetailsQuery).data;
    final redeeming = ref.watch(redeemReferralMutation).isPending;
    final referred = details?.referred ?? const <ReferredUser>[];
    final stats = referralStats(referred, redeemedAlready: details?.redeemedAlready ?? false);
    final code = codeQ.data;
    final avatar = ref.watch(profileAvatarBuilderProvider);
    final steps = <(String, String)>[
      ('📤', tr('ref_step1', 'Kodunu dostlarına göndər')),
      ('📲', tr('ref_step2_v3', 'Dostun tətbiqi yükləyib kodunu daxil edir')),
      ('👑', tr('ref_step3_v3', 'Dostun ödənişli Premium alanda sən +7 gün Premium qazanırsan')),
    ];
    Widget trio(AIconData icon, Gradient bg, Color ink, Object value, String label) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
            decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
            child: Column(children: <Widget>[
              Container(
                width: 38,
                height: 38,
                margin: const EdgeInsets.only(bottom: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: bg, borderRadius: BorderRadius.circular(12)),
                child: AIcon(icon, size: 17, color: ink),
              ),
              Padding(padding: const EdgeInsets.only(top: 3), child: Text('$value', style: px(17, weight: FontWeight.w800, color: a.ink))),
              Text(label, textAlign: TextAlign.center, style: px(11, weight: FontWeight.w700, color: a.inkSoft)),
            ]),
          ),
        );
    final canRedeem = !redeeming && _redeem.text.trim().length >= 4;

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: <Widget>[
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 96),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Row(children: <Widget>[
                        AIconBtn(size: 44, onTap: widget.onBack, semanticLabel: tr('common_geri', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text(cssUpper(tr('ref_eyebrow', 'Referral proqramı')), style: todayInfoEyebrow(context)),
                            Text(tr('ref_title', 'Dostunu dəvət et'), style: px(20, weight: FontWeight.w700, color: a.ink, ls: -0.02)),
                          ]),
                        ),
                      ]),
                    ),
                    FadeRise(
                      dy: 16,
                      child: Container(
                        clipBehavior: Clip.antiAlias,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
                        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.peach2, width: 2), boxShadow: a.cardShadow),
                        child: Stack(clipBehavior: Clip.none, children: <Widget>[
                          PositionedDirectional(
                            top: -24 - 110 * 0.35,
                            start: -18 - 110 * 0.35,
                            child: Opacity(opacity: 0.5, child: Container(width: 110, height: 110, decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle))),
                          ),
                          Column(children: <Widget>[
                            Container(
                              width: 56,
                              height: 56,
                              margin: const EdgeInsets.only(bottom: 12),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(18)),
                              child: AIcon(AIcons.gift, size: 24, color: a.accentInk),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Text(tr('ref_code_sub_v2', 'Sənin dəvət kodun. Paylaş, Premium günləri qazan'), textAlign: TextAlign.center, style: x.aListSub),
                            ),
                            if (codeQ.isLoading)
                              ALoader(size: 22, color: a.peach2)
                            else if (code != null)
                              GestureDetector(
                                key: const ValueKey<String>('referral-copy'),
                                onTap: () => _copy(code),
                                child: CustomPaint(
                                  painter: DashedTopBorder(a.peach2, width: 2, all: true, radius: 16),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                                      Text(code, style: px(26, weight: FontWeight.w900, color: a.ink, ls: 0.22)),
                                      const SizedBox(width: 10),
                                      _copied
                                          ? AIcon(AIcons.check, size: 18, strokeWidth: 2.6, color: a.greenInk)
                                          : AIcon(AIcons.copy, size: 16, strokeWidth: 2.2, color: a.inkSoft),
                                    ]),
                                  ),
                                ),
                              )
                            else
                              Text(tr('ref_code_unavailable', 'Kod hazırlanır — bir azdan yenidən baxın'), textAlign: TextAlign.center, style: x.aListSub),
                            const SizedBox(height: 16),
                            Opacity(
                              opacity: code == null ? 0.6 : 1,
                              child: GestureDetector(
                                key: const ValueKey<String>('referral-share'),
                                onTap: code == null ? null : () => _share(code),
                                child: Container(
                                  height: 50,
                                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                                    const AIcon(AIcons.share2, size: 16, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                                    const SizedBox(width: 6),
                                    Text(tr('ref_share_btn', 'Kodu paylaş'), style: x.aCtaBtn),
                                  ]),
                                ),
                              ),
                            ),
                          ]),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(children: <Widget>[
                      trio(AIcons.users, a.gradBlue, a.blueInk, stats.invitedCount, tr('ref_invited', 'Dəvət edilən')),
                      const SizedBox(width: 10),
                      trio(AIcons.crown, a.gradYellow, a.warnInk, stats.premiumCount, tr('ref_premium_count', 'Premium olan')),
                      const SizedBox(width: 10),
                      trio(AIcons.calendarPlus, a.gradGreen, a.greenInk, stats.earnedDays, tr('ref_earned_days', 'Qazanılan gün')),
                    ]),
                    if (referred.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: <Widget>[
                          Expanded(child: Text(tr('ref_list_title', 'Dəvətlərin'), style: x.aSectionTitle)),
                          Text('${referred.length}', style: x.aSectionLink.copyWith(color: a.accentInk)),
                        ]),
                      ),
                      ACard(
                        variant: ACardVariant.list,
                        child: Column(children: <Widget>[
                          for (var i = 0; i < referred.length; i++)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                              child: Row(children: <Widget>[
                                Container(
                                  width: 36,
                                  height: 36,
                                  clipBehavior: Clip.antiAlias,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
                                  child: referred[i].avatarUrl != null
                                      ? SizedBox.expand(child: avatar(referred[i].avatarUrl!))
                                      : Text(cssUpper(referred[i].name.isEmpty ? '' : referred[i].name.characters.first), style: px(12, weight: FontWeight.w800, color: a.accentInk)),
                                ),
                                const SizedBox(width: 13),
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                    Text(referred[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        '${formatDateAz(referred[i].createdAt ?? '')}${referred[i].status == 'converted' && referred[i].convertedAt != null ? ' · ${tr('ref_converted_on', 'Premium:')} ${formatDateAz(referred[i].convertedAt!)}' : ''}',
                                        style: x.aListSub,
                                      ),
                                    ),
                                  ]),
                                ),
                                const SizedBox(width: 13),
                                Column(crossAxisAlignment: CrossAxisAlignment.end, children: <Widget>[
                                  _StatusChip(referred[i]),
                                  const SizedBox(height: 3),
                                  referred[i].rewarded
                                      ? Text('+${referred[i].rewardDays} ${tr('ref_days_short', 'gün')} ✓', style: px(9.5, weight: FontWeight.w800, color: a.greenInk))
                                      : Text(tr('ref_pending', 'gözlənilir'), style: px(9.5, weight: FontWeight.w600, color: a.inkFaint)),
                                ]),
                              ]),
                            ),
                        ]),
                      ),
                    ],
                    const SizedBox(height: 12),
                    ACard(
                      variant: ACardVariant.list,
                      child: Column(children: <Widget>[
                        for (var i = 0; i < steps.length; i++)
                          AListRow(
                            first: i == 0,
                            title: steps[i].$2,
                            leading: AListIcon(background: a.surfaceSoft, child: Text(steps[i].$1, style: const TextStyle(fontSize: 17))),
                          ),
                      ]),
                    ),
                    if (!stats.redeemedAlready) ...<Widget>[
                      const SizedBox(height: 12),
                      FadeRise(
                        dy: 16,
                        delay: const Duration(milliseconds: 100),
                        child: ACard(
                          padding: const EdgeInsets.all(16),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(children: <Widget>[
                                AIcon(AIcons.ticket, size: 12, color: a.inkSoft),
                                const SizedBox(width: 6),
                                Text(cssUpper(tr('ref_have_code', 'Dəvət kodun var?')), style: todayInfoEyebrow(context)),
                              ]),
                            ),
                            Row(children: <Widget>[
                              Expanded(
                                child: AInput(
                                  fieldKey: const ValueKey<String>('referral-input'),
                                  controller: _redeem,
                                  placeholder: trInline('ReferralScreen.tsx', 'ABC123'),
                                  height: 48,
                                  style: px(16, weight: FontWeight.w800, ls: 0.15),
                                  inputFormatters: <TextInputFormatter>[
                                    LengthLimitingTextInputFormatter(8),
                                    TextInputFormatter.withFunction((o, n) => n.copyWith(text: n.text.toUpperCase())),
                                  ],
                                  onChanged: (_) => setState(() {}),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Opacity(
                                opacity: canRedeem ? 1 : 0.6,
                                child: GestureDetector(
                                  key: const ValueKey<String>('referral-redeem'),
                                  onTap: canRedeem ? _handleRedeem : null,
                                  child: Container(
                                    height: 48,
                                    constraints: const BoxConstraints(minWidth: 104),
                                    padding: const EdgeInsets.symmetric(horizontal: 18),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                                    child: redeeming ? const ALoader(size: 15, color: Color(0xFFFFFFFF)) : Text(tr('ref_redeem_btn', 'Tətbiq et'), style: x.aCtaBtn),
                                  ),
                                ),
                              ),
                            ]),
                          ]),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    CustomPaint(
                      painter: DashedTopBorder(a.lineStrong),
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: Text(
                          tr('ref_terms_v3', 'Hər hesab yalnız 1 dəvət kodu istifadə edə bilər. +7 gün dostunun ilk ödənişi təsdiqlənəndə avtomatik verilir və mövcud müddətinin üstünə əlavə olunur.'),
                          textAlign: TextAlign.center,
                          style: px(12, color: a.inkSoft, height: 1.55),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.r);
  final ReferredUser r;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Color bg, Color ink, AIconData? icon, String text) = switch (r.status) {
      'converted' => (a.green1, a.greenInk, AIcons.crown, tr('ref_st_premium', 'Premium')),
      'trial' => (a.yellow1, a.warnInk, AIcons.hourglass, tr('ref_st_pending_v2', 'Ödəniş gözlənilir')),
      _ => (a.surfaceSoft, a.inkSoft, null, tr('ref_st_registered', 'Qeydiyyat')),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
        if (icon != null) ...<Widget>[AIcon(icon, size: 10, strokeWidth: 2.4, color: ink), const SizedBox(width: 4)],
        Text(text, style: px(10.5, weight: FontWeight.w800, color: ink)),
      ]),
    );
  }
}
