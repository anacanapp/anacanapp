// Ported from: src/components/partner/v2/PartnerHomeScreen.tsx
//
// Partner "Bu gün" — the partner home tab: her day (hero, stats, mood, symptoms), birth mode, postpartum and loss
// entries, unread messages, the week / cycle / baby cards, daily missions, the next appointment, quick love
// messages, the activity feed and the daily tip. The first visit shows the onboarding tour.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' as pu;
import '../../../state/local_store.dart' show LocalStore;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart' show userStoreProvider;
import '../../home/data/pregnancy_content.dart';
import '../../home_flow/partner_flow_status_card.dart';
import '../../home_mommy/widgets/baby_crisis_widget.dart';
import '../../settings/ui/settings_ui.dart' show ASky, FadeRise, cssUpper, toasts;
import '../data/partner_content.dart';
import '../data/partner_data.dart';
import '../partner_copy.dart';
import '../partner_ports.dart';
import 'home_cards.dart';
import 'partner_link_form.dart';
import 'partner_onboarding_tour.dart';
import 'partner_ui.dart';
import 'sos.dart';

const List<String> _moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];

/// The hero stats of the woman's stage (`heroStats`).
List<({String emoji, String value, String label})> partnerHeroStats({
  required PartnerData data,
  required String lifeStage,
  required bool inLoss,
  required String? fruitEmoji,
}) {
  if (inLoss) return const [];
  final sharing = data.sharing;
  final water = data.partnerDailyLog?.waterIntake;
  final waterValue = water == null || water == 0 ? '0' : '$water';
  if (lifeStage == 'bump') {
    return [
      (emoji: fruitEmoji ?? '🍎', value: '${data.getPregnancyWeek()}', label: tr('partnerv2_hefte', 'həftə')),
      (emoji: '⏳', value: '${data.getDaysUntilDue()}', label: tr('partnerv2_gun_qaldi', 'gün qaldı')),
      if (sharing.shareWater) (emoji: '💧', value: waterValue, label: 'ml'),
    ];
  }
  if (lifeStage == 'mommy') {
    final babyAgeDays = data.getBabyAgeDays();
    final months = babyAgeDays ~/ 30;
    final p = data.partnerProfile;
    final babyName = p?.babyName;
    return [
      (emoji: p?.babyGender == 'boy' ? '👦' : '👧', value: babyName != null && babyName.isNotEmpty ? babyName : tr('partnerv2_korpe', 'Körpə'), label: ''),
      (emoji: '🎂', value: months > 0 ? '$months' : '$babyAgeDays', label: months > 0 ? tr('common_ay', 'ay') : tr('common_gun', 'gün')),
      if (sharing.shareWater) (emoji: '💧', value: waterValue, label: 'ml'),
    ];
  }
  // flow
  if (!sharing.shareCycle) return const [];
  final phaseMeta = {
    'menstrual': ('🩸', tr('partnerv2_faza_menstrual', 'Menstruasiya')),
    'follicular': ('🌱', tr('partnerv2_faza_follikulyar', 'Follikulyar')),
    'ovulation': ('✨', tr('partnerv2_faza_ovulyasiya', 'Ovulyasiya')),
    'luteal': ('🌙', tr('partnerv2_faza_luteal', 'Luteal')),
  };
  final phase = data.getCyclePhaseInfo();
  final pm = phase == null ? null : phaseMeta[phase.phase];
  return [
    (emoji: pm?.$1 ?? '🌸', value: pm?.$2 ?? '—', label: tr('partnerv2_faza', 'faza')),
    (emoji: '📅', value: '${data.getDaysUntilNextPeriod()}', label: tr('partnerv2_gun_novbetiye', 'gün növbətiyə')),
  ];
}

/// The quick-message chips (`lossShared && lossText ? lossText.chips : …`).
List<String> partnerQuickChips(String lifeStage, {List<String>? lossChips}) =>
    lossChips ??
    [
      tr('partnerdashboard_seni_sevirem_d85d3c', '❤️ Səni sevirəm!'),
      tr('partnerv2_nece_hiss_edirsen', '🤗 Necə hiss edirsən?'),
      ...(lifeStage == 'mommy'
          ? [feature37Text('pm_chip_night'), feature37Text('pm_chip_rest'), feature37Text('pm_chip_buy')]
          : lifeStage == 'flow'
              ? [feature37Text('pm_chip_tea'), feature37Text('pm_chip_rest'), feature37Text('pm_chip_buy')]
              : [feature37Text('pm_chip_on_way'), feature37Text('pm_chip_tea'), feature37Text('pm_chip_buy')]),
      tr('partnerdashboard_guclusen_673231', '💪 Güclüsən!'),
    ];

/// Whether the tour has not been seen yet (`!localStorage.getItem(PARTNER_TOUR_KEY)`).
bool partnerTourPending(LocalStore store) {
  try {
    final v = store.getItem(kPartnerTourKey);
    return v == null || v.isEmpty;
  } catch (_) {
    return false;
  }
}

class PartnerHomeScreen extends ConsumerStatefulWidget {
  const PartnerHomeScreen({super.key, required this.onNavigate, required this.onOpenChat});
  final ValueChanged<String> onNavigate;
  final VoidCallback onOpenChat;

  @override
  ConsumerState<PartnerHomeScreen> createState() => _PartnerHomeScreenState();
}

class _PartnerHomeScreenState extends ConsumerState<PartnerHomeScreen> {
  final TextEditingController _love = TextEditingController();
  final OverlayPortalController _tourPortal = OverlayPortalController();
  late bool _showTour;

  @override
  void initState() {
    super.initState();
    _showTour = partnerTourPending(ref.read(localStoreProvider));
    _love.addListener(() => setState(() {}));
    if (_showTour) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _tourPortal.show();
      });
    }
  }

  @override
  void dispose() {
    _love.dispose();
    super.dispose();
  }

  void _closeTour() {
    setState(() => _showTour = false);
    _tourPortal.hide();
    try {
      ref.read(localStoreProvider).setItem(kPartnerTourKey, '${DateTime.now().millisecondsSinceEpoch}');
    } catch (_) {}
  }

  String _womanName(PartnerWomanData? p) => p != null && p.name.isNotEmpty ? p.name : tr('partnerdashboard_heyat_yoldasin_fc543b', 'Həyat yoldaşın');

  Future<void> _sendLove(PartnerWomanData? partner) async {
    final toast = toasts(context);
    await quietly(ref.read(partnerHapticsProvider).heavy);
    final profile = ref.read(authProfileProvider);
    if (profile == null || partner == null) return;
    try {
      await ref.read(partnerChatSenderProvider)(profile.userId, partner.userId, '❤️');
      toast.show(
        title: tr('partnerdashboard_sevgi_gonderildi_4284b1', '💕 Sevgi göndərildi!'),
        description: '${_womanName(partner)} ${tr('partner_will_receive_notification', 'bildiriş alacaq')}',
      );
    } catch (error) {
      debugPrint('Error sending love: $error');
    }
  }

  Future<void> _sendQuick(PartnerWomanData? partner, [String? text]) async {
    final content = (text ?? _love.text).trim();
    final profile = ref.read(authProfileProvider);
    if (content.isEmpty || profile == null || partner == null) return;
    final toast = toasts(context);
    await quietly(ref.read(partnerHapticsProvider).medium);
    try {
      await ref.read(partnerChatSenderProvider)(profile.userId, partner.userId, content);
      toast.show(title: tr('partnerdashboard_mesaj_gonderildi_dca65e', '💌 Mesaj göndərildi!'), description: content);
      if (text == null) _love.clear();
    } catch (error) {
      debugPrint('Error sending message: $error');
    }
  }

  @override
  Widget build(BuildContext context) => OverlayPortal(
        controller: _tourPortal,
        // Only on the linked home (React renders the tour after the loading / not-linked returns).
        overlayChildBuilder: (context) => Consumer(builder: (context, ref, _) {
          final d = ref.watch(partnerDataProvider);
          return _showTour && !d.loading && d.partnerProfile != null
              ? Positioned.fill(child: PartnerOnboardingTour(onClose: _closeTour))
              : const SizedBox.shrink();
        }),
        child: _body(context),
      );

  Widget _body(BuildContext context) {
    final a = context.a;
    final data = ref.watch(partnerDataProvider);
    final store = ref.watch(userStoreProvider);
    final language = store.language.isEmpty ? 'az' : store.language;
    final slots = ref.watch(partnerHomeSlotsProvider);
    final partner = data.partnerProfile;
    final lifeStage = partner?.lifeStage ?? 'bump';
    final currentWeek = data.getPregnancyWeek();
    final daysUntilDue = data.getDaysUntilDue();
    final babyAgeDays = data.getBabyAgeDays();
    final pdRaw = partner?.lastPeriodDate != null ? pu.getPregnancyDay(partner!.lastPeriodDate) : 0;
    final pregnancyDay = pdRaw.isNaN ? 0 : pdRaw.toInt();
    // Pregnancy loss recovery: no fertility, missions or tips. The guide only when she chose to share it.
    final inLoss = lifeStage == 'flow' && (partner?.lossRecoveryActive ?? false);
    final lossShared = inLoss && (partner?.lossSharePartner ?? false);
    final lossText = slots.lossText?.call(language);

    final dayContent = ref.watch(pregnancyContentByDayQuery(pregnancyDay > 0 ? pregnancyDay : null)).data;
    final fruitImages = ref.watch(fruitImagesQuery).data ?? const [];
    final tip = ref.watch(partnerDailyTipProvider((lifeStage, currentWeek)));
    final weekData = currentWeek > 0 ? getDynamicFruitData(fruitImages, pregnancyDay, currentWeek, dayContent) : null;
    // Weekly partner guide (pregnancy_daily_content.partner_tip — with the language suffix).
    final partnerTip = localizedContent(dayContent, 'partner_tip', language);
    final unread = ref.watch(partnerMessagesFeedProvider).unreadCount;

    final log = data.partnerDailyLog;
    final mood = log?.mood;
    final sharing = data.sharing;
    final needsSupport = sharing.shareMood && mood != null && mood <= 2;

    if (data.loading) {
      return AScope(
        child: Container(
          color: a.bg,
          constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.6),
          alignment: Alignment.center,
          child: Stack(alignment: Alignment.center, children: [
            _Spinner(color: a.blue2),
          ]),
        ),
      );
    }

    // Not linked.
    if (partner == null) {
      return AScope(
        child: ColoredBox(
          color: a.bg,
          child: Stack(children: [
            const Positioned(top: 0, left: 0, right: 0, child: ASky()),
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(children: [
                const SizedBox(height: 24),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: animationsDisabled(context) ? 1 : 0, end: 1),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.elasticOut,
                  builder: (context, v, child) => Transform.scale(scale: v, child: child),
                  child: Container(
                    width: 112,
                    height: 112,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: a.gradBlue,
                      shape: BoxShape.circle,
                      // 0 24px 48px -16px rgba(99, 172, 223, 0.6)
                      boxShadow: const [BoxShadow(color: Color(0x9963ACDF), offset: Offset(0, 24), blurRadius: 48, spreadRadius: -16)],
                    ),
                    child: PartnerLucide(AIcons.heart, size: 52, color: a.blueInk, fill: const Color(0x66FFFFFF)),
                  ),
                ),
                const SizedBox(height: 24),
                Text(tr('partnerdashboard_hele_baglanmamisiniz_bc4f93', 'Hələ bağlanmamısınız'),
                    textAlign: TextAlign.center, style: pText(23, weight: FontWeight.w900, color: a.ink, ls: -0.02)),
                const SizedBox(height: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 384),
                  child: Text(
                      tr('partnerdashboard_heyat_yoldasinizin_anacan_tetb_9b4f56',
                          'Həyat yoldaşınızın Anacan tətbiqindəki partnyor kodunu daxil edib bağlanın — bütün məlumatlar real vaxtda sinxronlaşacaq.'),
                      textAlign: TextAlign.center,
                      style: pText(13.5, color: a.bodyText)),
                ),
                const SizedBox(height: 24),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 384),
                  child: PartnerCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('partnerdashboard_nece_baglanmali_8234cb', '📲 Necə bağlanmalı?'), style: pText(13.5, weight: FontWeight.w700, color: a.ink)),
                      const SizedBox(height: 8),
                      for (final (i, step) in [
                        tr('partnerdashboard_heyat_yoldasinizdan_onun_profilindeki_pa_c8a86f', 'Həyat yoldaşınızdan onun profilindəki partnyor kodunu istəyin'),
                        feature37Text('partner_link_step2'),
                        tr('partnerdashboard_bir_nece_saniye_icinde_baglanti_yaranaca_99fbd5', 'Bir neçə saniyə içində bağlantı yaranacaq'),
                      ].indexed) ...[
                        if (i > 0) const SizedBox(height: 6),
                        Text('${i + 1}. $step', style: pText(12, color: a.inkSoft)),
                      ],
                    ]),
                  ),
                ),
                const SizedBox(height: 14),
                const Center(child: PartnerLinkForm()),
              ]),
            ),
          ]),
        ),
      );
    }

    final heroStats = partnerHeroStats(data: data, lifeStage: lifeStage, inLoss: inLoss, fruitEmoji: weekData?.emoji);
    final children = <Widget>[
      if (lossShared && slots.lossCard != null) slots.lossCard!(context, partner.pregnancyLossDate, () => widget.onNavigate('partner-loss-support')),
      // Birth mode: week 36+.
      if (lifeStage == 'bump' && currentWeek >= 36) BirthModeCard(daysUntilDue: daysUntilDue, onNavigate: widget.onNavigate),
      // First 8 weeks after birth.
      if (lifeStage == 'mommy' && postpartumWeek(babyAgeDays) != null)
        PostpartumCard(week: postpartumWeek(babyAgeDays)!, shareMood: sharing.shareMood, onOpen: () => widget.onNavigate('postpartum-support')),
      // A sick baby: the family's illness log.
      if (lifeStage == 'mommy' && slots.illnessHomeCard != null) slots.illnessHomeCard!(context, 'active', () => widget.onNavigate('illness')),
      _hero(context, data, partner, lifeStage: lifeStage, inLoss: inLoss, lossShared: lossShared, lossText: lossText, heroStats: heroStats, needsSupport: needsSupport),
      if (unread > 0) _unreadBanner(context, unread),
      if (lifeStage == 'bump')
        PartnerWeekInfoCard(
          currentWeek: currentWeek,
          weekData: weekData,
          dayContent: dayContent,
          language: language,
          isMultiple: partner.multiplesType != null && partner.multiplesType!.isNotEmpty && partner.multiplesType != 'single',
        ),
      if (lifeStage == 'flow' && !inLoss && sharing.shareCycle) const PartnerFlowStatusCard(),
      if (lifeStage == 'mommy' && sharing.shareBabyLogs)
        PartnerBabyTodayCard(
          motherUserId: partner.userId,
          babyName: partner.babyName?.isNotEmpty == true ? partner.babyName! : tr('partnerv2_korpe', 'Körpə'),
          onOpen: () => widget.onNavigate('partner-baby-day'),
        ),
      if (lifeStage == 'mommy' && babyAgeDays > 0)
        BabyCrisisWidget(babyAgeWeeks: babyAgeDays ~/ 7, babyName: partner.babyName?.isNotEmpty == true ? partner.babyName! : tr('partnerv2_korpe', 'Körpə')),
      if (slots.adInlineAnchor != null) slots.adInlineAnchor!(context, 'home_banner'),
      if (!inLoss) DailyMissionsCard(stage: (lifeStage: lifeStage, pregnancyWeek: currentWeek, babyAgeDays: babyAgeDays)),
      if (sharing.shareAppointments) NextAppointmentCard(motherUserId: partner.userId, onOpen: () => widget.onNavigate('partner-appointments')),
      if (lifeStage == 'mommy' && slots.illnessHomeCard != null) slots.illnessHomeCard!(context, 'entry', () => widget.onNavigate('illness')),
      _quickMessages(context, partner, lifeStage, lossShared ? lossText?.chips : null),
      const PartnerActivityFeed(),
      if (!inLoss && (partnerTip != null || tip.tipText.isNotEmpty)) _tipCard(context, partnerTip, tip, currentWeek),
    ];

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: [
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _topBar(context, store.name),
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 16), children[i]],
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _topBar(BuildContext context, String? name) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FadeRise(dy: 0, dx: -20, child: Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(cssUpper(tr('partnerv2_birlikde_eyebrow', 'BİRLİKDƏ')), style: pText(11, weight: FontWeight.w700, color: context.a.onBgSoft, ls: 0.1)),
              )),
              FadeRise(
                dy: 0,
                dx: -20,
                delay: const Duration(milliseconds: 50),
                child: Text('${tr('partnerv2_salam', 'Salam')}, ${name != null && name.isNotEmpty ? name : trInline('PartnerHomeScreen.tsx', 'Partner')}! 👋',
                    style: pText(19, weight: FontWeight.w700, color: context.a.onBg, ls: -0.01, height: 1.35)),
              ),
            ]),
          ),
          const SizedBox(width: 12),
          const SosButton(variant: SosButtonVariant.compact),
        ]),
      ),
    );
  }

  Widget _hero(
    BuildContext context,
    PartnerData data,
    PartnerWomanData partner, {
    required String lifeStage,
    required bool inLoss,
    required bool lossShared,
    required PartnerLossText? lossText,
    required List<({String emoji, String value, String label})> heroStats,
    required bool needsSupport,
  }) {
    final a = context.a;
    final sharing = data.sharing;
    final log = data.partnerDailyLog;
    final mood = log?.mood;
    final womanName = _womanName(partner);
    final symptoms = sharing.shareSymptoms ? (log?.symptoms ?? const <String>[]) : const <String>[];
    final avatar = partner.avatarUrl;
    return FadeRise(
      dy: 16,
      child: PartnerCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 48,
              height: 48,
              clipBehavior: Clip.antiAlias,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: a.gradBlue, shape: BoxShape.circle),
              child: avatar != null && avatar.isNotEmpty
                  ? Image.network(avatar, width: 48, height: 48, fit: BoxFit.cover, semanticLabel: womanName, errorBuilder: (_, _, _) => const SizedBox.shrink())
                  : Text(lossShared ? '🤍' : lifeStage == 'bump' ? '🤰' : lifeStage == 'mommy' ? '👩‍🍼' : '🌸', style: const TextStyle(fontSize: 24)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(womanName, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(17, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
                Text(
                  lossShared && lossText != null
                      ? lossText.heroLabel
                      : lifeStage == 'bump'
                          ? tr('partnerv2_hamilelik_yolculugu', 'Hamiləlik yolçuluğu')
                          : lifeStage == 'mommy'
                              ? tr('partnerv2_analiq_dovru', 'Analıq dövrü')
                              : tr('partnerv2_tsikl_izleme', 'Tsikl izləmə'),
                  style: pText(11.5, color: a.inkSoft),
                ),
              ]),
            ),
            if (sharing.shareMood && mood != null) ...[
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                child: Column(children: [
                  Text(mood >= 1 && mood <= 5 ? _moodEmojis[mood - 1] : '', style: const TextStyle(fontSize: 20)),
                  Text(cssUpper(tr('partnerv2_ehval', 'əhval')), style: pText(8.5, weight: FontWeight.w700, color: a.inkSoft, ls: 0.05)),
                ]),
              ),
            ],
            const SizedBox(width: 12),
            PartnerTap(
              key: const ValueKey('partner-send-love'),
              scale: 0.85,
              semanticLabel: '❤️',
              onTap: () => unawaited(_sendLove(partner)),
              child: Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
                child: PartnerLucide(AIcons.heart, size: 19, color: a.pinkInk, fill: a.pinkInk),
              ),
            ),
          ]),
          if (heroStats.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(children: [
              for (var i = 0; i < heroStats.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                    child: Column(children: [
                      Text(heroStats[i].emoji, style: const TextStyle(fontSize: 18)),
                      const SizedBox(height: 2),
                      Text(heroStats[i].value, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(14.5, weight: FontWeight.w800, color: a.ink)),
                      if (heroStats[i].label.isNotEmpty) Text(heroStats[i].label, style: pText(9.5, weight: FontWeight.w600, color: a.inkSoft)),
                    ]),
                  ),
                ),
              ],
            ]),
          ],
          // All of her active children (mommy) when there is more than one.
          if (lifeStage == 'mommy' && !inLoss && data.partnerChildren.length > 1) ...[
            const SizedBox(height: 10),
            Semantics(
              label: tr('profilescreen_usaqlarim_d988f7', 'Uşaqlarım'),
              child: Wrap(spacing: 6, runSpacing: 6, children: [
                for (final child in data.partnerChildren)
                  () {
                    final days = child.birthDate != null ? pu.getRealCalendarAge(child.birthDate).totalDays : 0;
                    final months = days ~/ 30, years = months ~/ 12;
                    final age = years >= 2
                        ? '$years ${tr('time_years_old', 'yaş')}'
                        : months > 0
                            ? '$months ${tr('common_ay', 'ay')}'
                            : '$days ${tr('common_gun', 'gün')}';
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: child.isCurrent ? a.peach1 : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                      child: Text.rich(TextSpan(children: [
                        TextSpan(text: '${child.avatarEmoji?.isNotEmpty == true ? child.avatarEmoji : (child.gender == 'boy' ? '👦' : '👧')} ${child.name} '),
                        TextSpan(text: '· ${child.birthDate != null ? age : '—'}', style: pText(11.5, weight: FontWeight.w600, color: a.inkSoft)),
                      ]), style: pText(11.5, weight: FontWeight.w700, color: a.ink)),
                    );
                  }(),
              ]),
            ),
          ],
          if (lifeStage == 'flow' && !inLoss && !sharing.shareCycle)
            Text(feature37Text('pm_cycle_hidden'), style: pText(12, color: a.inkSoft)),
          if (symptoms.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final s in symptoms.take(4))
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0x00000000))),
                  child: Text(s, style: pText(10.5, weight: FontWeight.w600, color: a.inkSoft)),
                ),
            ]),
          ],
          if (needsSupport) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
              decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                AIcon(AIcons.heart, size: 15, color: a.pinkInk),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(tr('partnerv2_destek_banner', 'Bu gün əhvalı yaxşı deyil — ona xüsusi diqqət göstər 💗'),
                      style: pText(12, weight: FontWeight.w600, color: a.alertInk)),
                ),
              ]),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _unreadBanner(BuildContext context, int unread) {
    final a = context.a;
    return FadeRise(
      dy: -10,
      child: PartnerTap(
        key: const ValueKey('partner-unread-banner'),
        scale: 0.99,
        onTap: widget.onOpenChat,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: a.blue1,
            borderRadius: BorderRadius.circular(18),
            // 1.5px solid rgba(99, 172, 223, 0.5)
            border: Border.all(color: const Color(0x8063ACDF), width: 1.5),
          ),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.chipOverlay, shape: BoxShape.circle),
              child: AIcon(AIcons.messageCircle, size: 18, color: a.blueInk),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('partnerdashboard_yeni_mesajiniz_var_0ef93a', 'Yeni mesajınız var!'), style: pText(13.5, weight: FontWeight.w800, color: a.blueInk)),
                Text('$unread ${tr('partnerdashboard_oxunmamis_mesaj_4cf5d8', 'oxunmamış mesaj')}', style: pText(11.5, color: a.blueInk)),
              ]),
            ),
            const SizedBox(width: 12),
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.blue2, shape: BoxShape.circle),
              child: Text('$unread', style: pText(13, weight: FontWeight.w900, color: const Color(0xFFFFFFFF))),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _quickMessages(BuildContext context, PartnerWomanData partner, String lifeStage, List<String>? lossChips) {
    final a = context.a;
    final empty = _love.text.trim().isEmpty;
    final style = pText(13, color: a.ink);
    return FadeRise(
      dy: 16,
      child: PartnerCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(
              child: Material(
                type: MaterialType.transparency,
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: AlignmentDirectional.centerStart,
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                  child: TextField(
                    key: const ValueKey('partner-love-input'),
                    controller: _love,
                    onSubmitted: (_) => unawaited(_sendQuick(partner)),
                    style: style,
                    cursorColor: a.blue2,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: tr('partnerdashboard_sevgi_mesaji_yaz_54b43a', 'Sevgi mesajı yaz...'),
                      hintStyle: style.copyWith(color: a.inkFaint),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            PartnerTap(
              key: const ValueKey('partner-love-send'),
              semanticLabel: tr('helpscreen_gonder_3f11bd', 'Göndər'),
              onTap: empty ? null : () => unawaited(_sendQuick(partner)),
              child: Opacity(
                opacity: empty ? 0.5 : 1,
                child: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.blue2, shape: BoxShape.circle),
                  child: const AIcon(AIcons.send, size: 16, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final msg in partnerQuickChips(lifeStage, lossChips: lossChips))
              PartnerTap(
                key: ValueKey('partner-chip-$msg'),
                onTap: () => unawaited(_sendQuick(partner, msg)),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
                  child: Text(msg, style: pText(11, weight: FontWeight.w600, color: a.blueInk)),
                ),
              ),
          ]),
        ]),
      ),
    );
  }

  Widget _tipCard(BuildContext context, String? partnerTip, ({String tipText, String tipEmoji, bool isLoading}) tip, int currentWeek) {
    final a = context.a;
    return FadeRise(
      dy: 16,
      child: PartnerCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(12)),
              child: AIcon(partnerTip != null ? AIcons.bookOpen : AIcons.sparkles, size: 16, color: a.yellowInk),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                partnerTip != null ? '$currentWeek. ${tr('partnerv2_hefte_beledci', 'həftə — partnyor bələdçisi')}' : tr('partnerdashboard_gunun_tovsiyesi_b3a563', 'Günün Tövsiyəsi'),
                style: pText(14, weight: FontWeight.w800, color: a.ink),
              ),
            ),
            if (partnerTip == null) Text(tip.tipEmoji, style: const TextStyle(fontSize: 24)),
          ]),
          const SizedBox(height: 10),
          Text(partnerTip ?? tip.tipText, style: pText(13, color: a.bodyText, height: 1.625)),
        ]),
      ),
    );
  }
}

/// The `w-14 h-14` ring spinner (4px `--a-blue-2`, transparent top), 1 s linear.
class _Spinner extends StatefulWidget {
  const _Spinner({required this.color});
  final Color color;
  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(size: const Size.square(56), painter: _RingPainter(widget.color)),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final r = (Offset.zero & size).deflate(2);
    canvas.drawArc(r, -0.25 * 3.14159265, 1.5 * 3.14159265, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color;
}
