// Ported from: src/components/Dashboard.tsx (BumpDashboard: hero, trimester tips, daily content cards, upcoming
//              appointments, development trio, weekly tip, water + quick logs, store cards, "I gave birth"),
//              src/styles/anacan-design.css (.a-hero-min, .a-hero-compact, .a-hero-eyebrow, .a-egg-wrap, .a-egg-heart,
//              .a-hero-headline, .a-pbar*, .a-list-compact, .a-today-info-*, .a-cta*)
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/data/row.dart' hide Row;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/pregnancy/fetal_size.dart';
import '../../../state/user_store.dart';
import '../appointments/upcoming_appointments.dart';
import '../dashboard/red_flag_banner.dart';
import '../data/daily_logs.dart';
import '../data/pregnancy_content.dart';
import '../home_inputs.dart';
import '../home_slots.dart';
import '../widgets/home_widgets.dart';
import 'fetus_hero_image.dart';

/// `getMoodEmoji(mood)`.
String moodEmoji(num mood) {
  if (mood >= 4) return '😊';
  if (mood >= 3) return '🙂';
  if (mood >= 2) return '😐';
  if (mood >= 1) return '😔';
  return '❓';
}

/// `getTrimesterInfo(trimester)`.
({String title, String emoji}) trimesterInfo(int trimester) => switch (trimester) {
      1 => (title: tr('dashboard_1_ci_trimester_tovsiyeleri_0a4c84', '1-ci Trimester Tövsiyələri'), emoji: '🌱'),
      2 => (title: tr('dashboard_2_ci_trimester_tovsiyeleri_16e100', '2-ci Trimester Tövsiyələri'), emoji: '🌸'),
      _ => (title: tr('dashboard_3_cu_trimester_tovsiyeleri_93f711', '3-cü Trimester Tövsiyələri'), emoji: '🍼'),
    };

String trimesterLabel(int trimester) => switch (trimester) {
      1 => tr('dashboard_1_trimester', '1-ci Trimester'),
      2 => tr('dashboard_2_trimester', '2-ci Trimester'),
      _ => tr('dashboard_3_trimester', '3-cü Trimester'),
    };

/// `num` → JS `String(n)` for the hero chips (`30`, `35.6`).
String _jsNum(num n) => n == n.roundToDouble() ? n.toInt().toString() : n.toString();

class BumpDashboard extends ConsumerWidget {
  const BumpDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userStoreProvider);
    final preg = user.getPregnancyData();
    final nav = ref.watch(homeNavigationProvider);
    final slots = ref.watch(homeSlotsProvider);
    final profile = ref.watch(homeProfileRowProvider);
    final isAdmin = ref.watch(homeIsAdminProvider);
    final language = user.language;
    final booksLanguageOk = language == 'az';
    final multiples = profile?['multiples_type'];
    final isMultiple = multiples is String && multiples.isNotEmpty && multiples != 'single';

    final navState = PregnancyDayNavigation.of(preg?.lastPeriodDate);
    final pregnancyDay = navState.selectedDay;
    final selectedWeek = navState.selectedWeek;
    final selectedTrimester = navState.selectedTrimester;

    final weeklyTips = ref.watch(weeklyTipsQuery((selectedWeek, 'bump'))).data ?? const [];
    final dayContent = ref.watch(pregnancyContentByDayQuery(pregnancyDay)).data;
    final tips = ref.watch(trimesterTipsQuery(selectedTrimester)).data ?? const [];
    final fruitImages = ref.watch(fruitImagesQuery).data ?? const [];
    final illustrations = ref.watch(fetusIllustrationsQuery).data ?? const [];
    ref.watch(dailyLogsProvider);
    final logs = ref.read(dailyLogsProvider.notifier);

    // Hooks run before the early return (React "Rendered more hooks" fix).
    final fetusMonth = math.min((selectedWeek / 4.4).ceil(), 9);
    final fetusRemote = fetusIllustrationForMonth(illustrations, fetusMonth);
    final fetusPrev = fetusIllustrationForMonth(illustrations, fetusMonth - 1 < 1 ? 1 : fetusMonth - 1);
    final fetusNext = fetusIllustrationForMonth(illustrations, fetusMonth + 1 > 9 ? 9 : fetusMonth + 1);

    if (preg == null) return const SizedBox.shrink();

    final weekData = getDynamicFruitData(fruitImages, pregnancyDay, selectedWeek, dayContent);
    final daysLeft = navState.daysUntilDueFromSelected;
    final progressPercent = pregnancyDay / 280 * 100;
    final waterCount = logs.waterToday();
    final currentMood = logs.visibleTodayLog()?.number('mood') ?? 0;
    final showBirthButton = preg.currentWeek >= 27;
    final weeklyDev = (eyes: selectedWeek >= 8, ears: selectedWeek >= 16, fingers: selectedWeek >= 10, kicks: selectedWeek >= 18, hair: selectedWeek >= 22);
    final currentWeekTip = weeklyTips.isEmpty ? null : weeklyTips.first;
    final t = context.a;
    final x = context.aText;

    Future<void> addWater() async {
      await HapticFeedback.lightImpact();
      await logs.updateWaterIntake(1);
      if (!context.mounted) return;
      _toast(context)?.show(
        title: tr('dashboard_su_elave_edildi_7b894d', 'Su əlavə edildi! 💧'),
        description: '${waterCount + 1}/8 ${tr('dashboard_glasses', 'stəkan')}',
      );
    }

    final children = <Widget>[
      // Red flag: today's BP ≥140/90 → automatic warning.
      RedFlagBanner(onOpenTool: nav.openTool),
      _Hero(
        week: selectedWeek,
        dayInWeek: navState.selectedDayInWeek,
        trimester: selectedTrimester,
        pregnancyDay: pregnancyDay,
        daysLeft: daysLeft,
        fruit: weekData.fruit,
        lengthCm: weekData.lengthCm,
        weightG: weekData.weightG,
        progressPercent: progressPercent,
        isMultiple: isMultiple,
        language: language,
        fetusMonth: fetusMonth,
        fetusRemote: fetusRemote,
        preload: [fetusNext, fetusPrev],
      ),
      if (tips.isNotEmpty) _TrimesterTips(trimester: selectedTrimester, tips: tips),
      if (dayContent != null) ...[
        homeSlot(context, slots.babyChatCard),
        if (_s(dayContent['body_changes']) case final text?)
          AHomeSection(child: AHomeTextCard(title: '🤰 ${tr('dashboard_bedendeki_deyisiklikler_7a5c81', 'Bədəndəki Dəyişikliklər')}', text: text)),
        if (_s(dayContent['baby_development']) case final text?)
          AHomeSection(child: AHomeTextCard(title: '🌱 ${tr('dashboard_korpenin_inkisafi_485a30', 'Körpənin İnkişafı')}', text: text)),
        if (isMultiple && _s(dayContent['multiples_tip']) != null)
          AHomeSection(
            child: AHomeTextCard(
              title: '👶👶 ${tr('dashboard_ekiz_hameleliyiniz_ucun', 'Əkiz Hamiləliyiniz üçün')}',
              text: _s(dayContent['multiples_tip'])!,
              color: t.blue1,
            ),
          ),
        if (_s(dayContent['daily_tip']) case final text?)
          AHomeSection(child: AHomeTextCard(title: '💡 ${tr('dashboard_gunun_tovsiyesi_b3a563', 'Günün Tövsiyəsi')}', text: text)),
      ],
      // Calendar after the daily messages (bump).
      const UpcomingAppointments(),
      if ((isAdmin || booksLanguageOk) && slots.booksHomeCard != null) slots.booksHomeCard!(context, preg.currentWeek),
      AHomeSection(
        title: tr('dashboard_korpenin_inkisafi_269d83', 'Körpənin inkişafı'),
        child: _DevelopmentTrio(items: [
          ('👀', tr('dashboard_goz_fbc05e', 'Göz'), weeklyDev.eyes),
          ('👂', tr('dashboard_qulaq_93ab', 'Qulaq'), weeklyDev.ears),
          ('✋', tr('dashboard_barmaq_18bc', 'Barmaq'), weeklyDev.fingers),
          ('🦶', tr('dashboard_tepik_9a873a', 'Təpik'), weeklyDev.kicks),
          ('💇', tr('dashboard_sac_a09eaa', 'Saç'), weeklyDev.hair),
        ]),
      ),
      if (currentWeekTip != null)
        AHomeSection(
          child: AFadeIn(
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    AGradIcon(size: 38, radius: 12, gradient: t.gradPeach, foreground: t.accentInk, child: const AIcon(AIcons.lightbulb, size: 17)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text(
                          cssUppercase('${tr('dashboard_hefte_3aa886', 'Həftə')} $selectedWeek ${tr('dashboard_tovsiyesi_6412b4', 'Tövsiyəsi')}', language),
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.05, color: t.inkSoft, height: 1.5),
                        ),
                        const SizedBox(height: 3),
                        Text(currentWeekTip.str('title') ?? '', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: t.ink, height: 1.5)),
                      ]),
                    ),
                  ]),
                ),
                Text(currentWeekTip.str('content') ?? '', style: TextStyle(fontSize: 12.5, height: 1.65, color: t.inkSoft)),
              ]),
            ),
          ),
        ),
      // Water + quick logs.
      AHomeSection(
        child: AFadeIn(
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 16),
                child: Row(children: [
                  AGradIcon(gradient: t.gradBlue, foreground: t.blueInk, child: const AIcon(AIcons.droplets, size: 17)),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(tr('common_su_water', 'Su'), style: x.aListTitle),
                      const SizedBox(height: 2),
                      Text(
                        '$waterCount / 10 ${tr('waterwidget_glass_unit', 'stəkan')} · ${tr('dashboard_today_label', 'Bu gün')}',
                        key: const ValueKey('bump-water-count'),
                        style: x.aListSub,
                      ),
                    ]),
                  ),
                  const SizedBox(width: 13),
                  Semantics(
                    button: true,
                    label: tr('dashboard_su_elave_edildi_7b894d', 'Su əlavə edildi! 💧'),
                    child: GestureDetector(
                      key: const ValueKey('bump-water-add'),
                      behavior: HitTestBehavior.opaque,
                      onTap: addWater,
                      child: Container(
                        width: 34,
                        height: 34,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: t.ink, shape: BoxShape.circle),
                        child: AIcon(AIcons.plus, size: 16, strokeWidth: 2.6, color: t.bg),
                      ),
                    ),
                  ),
                ]),
              ),
              Row(children: [
                Expanded(
                  child: ATrioItem(
                    key: const ValueKey('quick-vitamin'),
                    shadow: false,
                    color: t.surfaceSoft,
                    onTap: () => nav.openTool('vitamin-tracker'),
                    icon: ATrioIcon(gradient: t.gradPink, foreground: t.berryInk, child: const AIcon(AIcons.pill, size: 17)),
                    label: tr('dashboard_vitamin_8331ee', 'Vitamin'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ATrioItem(
                    key: const ValueKey('quick-exercise'),
                    shadow: false,
                    color: t.surfaceSoft,
                    onTap: () => nav.openTool('safety'),
                    icon: ATrioIcon(gradient: t.gradGreen, foreground: t.greenInk, child: const AIcon(AIcons.activity, size: 17)),
                    label: tr('dashboard_mesq_046a80', 'Məşq'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ATrioItem(
                    key: const ValueKey('quick-mood'),
                    shadow: false,
                    color: t.surfaceSoft,
                    onTap: () => nav.openTool('mood-diary'),
                    icon: ATrioIcon(
                      gradient: t.gradYellow,
                      foreground: t.warnInk,
                      child: currentMood != 0 ? AEmoji(moodEmoji(currentMood), size: 17) : const AIcon(AIcons.heart, size: 17),
                    ),
                    label: tr('dashboard_ehval_0457f9', 'Əhval'),
                  ),
                ),
              ]),
            ]),
          ),
        ),
      ),
      if (slots.aptekHomeCard != null) slots.aptekHomeCard!(context, 'bump'),
      if (slots.partnerHomeCard != null) slots.partnerHomeCard!(context, preg.currentWeek),
      if (showBirthButton) _BirthCta(week: selectedWeek, onTap: () => slots.showBirthOnboarding?.call(context)),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children);
  }
}

String? _s(Object? v) => v is String && v.isNotEmpty ? v : null;

AToastController? _toast(BuildContext context) {
  try {
    return AToastHost.of(context);
  } catch (_) {
    return null;
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.week,
    required this.dayInWeek,
    required this.trimester,
    required this.pregnancyDay,
    required this.daysLeft,
    required this.fruit,
    required this.lengthCm,
    required this.weightG,
    required this.progressPercent,
    required this.isMultiple,
    required this.language,
    required this.fetusMonth,
    required this.fetusRemote,
    required this.preload,
  });

  final int week, dayInWeek, trimester, pregnancyDay, daysLeft, fetusMonth;
  final String fruit, language;
  final num lengthCm, weightG;
  final double progressPercent;
  final bool isMultiple;
  final String? fetusRemote;
  final List<String?> preload;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final x = context.aText;
    final eyebrowStyle = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: t.onBgSoft, height: 1.5);
    final tpl = isMultiple
        ? tr('dashboard_hero_fruit_tpl_multiple', 'Körpələriniz təxminən {fruit} boydadır')
        : tr('dashboard_hero_fruit_tpl', 'Anacan, hazırda {fruit} boydayam');
    final parts = tpl.split('{fruit}');
    final headlineStyle = x.heading(TextStyle(fontSize: 23, height: 1.22, color: t.onBg, leadingDistribution: TextLeadingDistribution.even));
    final note = fetalLengthNote(language);

    return AFadeIn(
      child: Padding(
        key: const ValueKey('bump-hero'),
        padding: const EdgeInsets.fromLTRB(2, 10, 2, 6),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Wrap(alignment: WrapAlignment.center, spacing: 6, children: [
              Text(cssUppercase('$week${tr('dashboard_hefte_5af01f', '. həftə,')}', language), style: eyebrowStyle),
              Text(cssUppercase('$dayInWeek${tr('dashboard_gun_a4ba4e', '. gün •')}', language), style: eyebrowStyle.copyWith(color: t.onBg)),
              Text(cssUppercase(trimesterLabel(trimester), language), style: eyebrowStyle),
            ]),
          ),
          // Fetus illustration with heart badge (.a-egg-wrap: width 128, margin 4 auto 8).
          Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 8),
              child: SizedBox(
                width: 128,
                child: Stack(clipBehavior: Clip.none, alignment: Alignment.topCenter, children: [
                  AFloat(
                    child: FetusHeroImage(
                      remoteSrc: fetusRemote,
                      fallbackAsset: fetusAsset(fetusMonth < 1 ? 1 : fetusMonth),
                      preloadSrcs: preload,
                      alt: '$week ${tr('dashboard_week_baby', 'həftəlik körpə')}',
                    ),
                  ),
                  Positioned(
                    top: -12,
                    child: Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        gradient: t.gradPink,
                        shape: BoxShape.circle,
                        boxShadow: const [BoxShadow(offset: Offset(0, 8), blurRadius: 16, spreadRadius: -8, color: Color(0xA6FF8AA4))],
                      ),
                      child: const AEmoji('💗', size: 13),
                    ),
                  ),
                ]),
              ),
            ),
          ),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: parts.first),
                  TextSpan(text: fruit, style: const TextStyle(fontStyle: FontStyle.italic, color: Color(0xFFE8734A))), // .a-hero-headline em
                  if (parts.length > 1) TextSpan(text: parts[1]),
                ]),
                key: const ValueKey('bump-hero-headline'),
                textAlign: TextAlign.center,
                style: headlineStyle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [
              ATag('$pregnancyDay${tr('dashboard_gun_d96b5d', '. gün')}'),
              Tooltip(message: note, child: ATag('${_jsNum(lengthCm)} ${tr('dashboard_sm', 'sm')}')),
              ATag('${formatFetalWeight(weightG)} ${tr('dashboard_qr', 'qr')}'),
              ATag('$daysLeft ${tr('dashboard_gun_qaldi_993281', 'gün qaldı')}'),
            ]),
          ),
          // Length is crown-rump until week 20 and crown-heel after: explains the jump.
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Opacity(
              opacity: 0.75,
              child: Text(note, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, height: 1.35, color: t.ink)),
            ),
          ),
          Padding(padding: const EdgeInsets.only(top: 16), child: _ProgressBar(percent: progressPercent)),
        ]),
      ),
    );
  }
}

/// `.a-pbar` with the floating percentage label (fill width 0 → % over 1 s after 0.3 s).
class _ProgressBar extends StatefulWidget {
  const _ProgressBar({required this.percent});
  final double percent;

  @override
  State<_ProgressBar> createState() => _ProgressBarState();
}

class _ProgressBarState extends State<_ProgressBar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else {
      Future<void>.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final pct = widget.percent;
    final labelAt = pct.clamp(6, 94) / 100;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth;
        return SizedBox(
          height: 8,
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: t.lineStrong, borderRadius: BorderRadius.circular(999)))),
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final fw = w * pct / 100 * ACurves.cssEaseInOut.transform(_c.value);
                return PositionedDirectional(
                  start: 0,
                  top: 0,
                  bottom: 0,
                  width: fw,
                  child: DecoratedBox(decoration: BoxDecoration(gradient: t.gradYellow, borderRadius: BorderRadius.circular(999))),
                );
              },
            ),
            // `inset-inline-start: x%` + `transform: translateX(-50%)` (physical, also in RTL).
            Positioned(
              top: -26,
              left: rtl ? w - w * labelAt : w * labelAt,
              child: FractionalTranslation(
                translation: const Offset(-0.5, 0),
                child: Container(
                  key: const ValueKey('bump-progress-pct'),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: t.surface,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: const [BoxShadow(offset: Offset(0, 4), blurRadius: 10, spreadRadius: -4, color: Color(0x4017150F))],
                  ),
                  child: Text('${pct.round()}%', softWrap: false, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: t.ink, height: 1.5)),
                ),
              ),
            ),
          ]),
        );
      }),
      const SizedBox(height: 9),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(tr('dashboard_baslangic_e9d2d5', 'Başlanğıc'), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.onBgSoft, height: 1.5)),
        Text(tr('dashboard_dogus_6b7bfd', 'Doğuş'), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.onBgSoft, height: 1.5)),
      ]),
    ]);
  }
}

class _TrimesterTips extends StatelessWidget {
  const _TrimesterTips({required this.trimester, required this.tips});
  final int trimester;
  final Rows tips;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final info = trimesterInfo(trimester);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return AHomeSection(
      key: const ValueKey('trimester-tips'),
      title: '${info.emoji} ${info.title} ${info.emoji}',
      centerTitle: true,
      child: AFadeIn(
        child: ACard(
          variant: ACardVariant.list,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < tips.length; i++)
              FramerEnter(
                x: rtl ? 20 : -20,
                delay: Duration(milliseconds: 150 + i * 50),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: t.line))),
                  child: Row(children: [
                    AGradIcon(size: 32, color: t.surfaceSoft, child: AEmoji(tips[i].str('icon') ?? '', size: 15)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(tips[i].str('tip_text') ?? '',
                          style: TextStyle(fontSize: 12.5, height: 1.4, fontWeight: FontWeight.w600, color: t.ink, leadingDistribution: TextLeadingDistribution.even)),
                    ),
                  ]),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

class _DevelopmentTrio extends StatelessWidget {
  const _DevelopmentTrio({required this.items});
  final List<(String, String, bool)> items;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (var i = 0; i < items.length; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Expanded(
          child: FramerEnter(
            scale: 0,
            fade: false,
            delay: Duration(milliseconds: 300 + i * 80),
            child: Opacity(
              opacity: items[i].$3 ? 1 : 0.65,
              child: ATrioItem(
                key: ValueKey('dev-$i-${items[i].$3 ? 'on' : 'off'}'),
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
                icon: ATrioIcon(width: 32, height: 36, color: items[i].$3 ? t.peach1 : t.surfaceSoft, child: AEmoji(items[i].$1, size: 22)),
                label: items[i].$2,
                labelColor: items[i].$3 ? t.ink : null,
              ),
            ),
          ),
        ),
      ],
    ]);
  }
}

class _BirthCta extends StatelessWidget {
  const _BirthCta({required this.week, required this.onTap});
  final int week;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final t = tokens.a;
    final x = context.aText;
    final label = tr('dashboard_dogum_etdim_e3eca9', 'Doğum etdim! 🎉');
    return AHomeSection(
      child: AFadeIn(
        child: GestureDetector(
          key: const ValueKey('birth-cta'),
          onTap: onTap,
          child: ACard(
            variant: ACardVariant.cta,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(color: t.pink1, borderRadius: BorderRadius.circular(999)),
                  child: Text('${tr('dashboard_hefte_3aa886', 'Həftə')} $week 🎉', style: x.aCtaBadge.copyWith(color: t.berryInk)),
                ),
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: t.pink1, borderRadius: BorderRadius.circular(14)),
                  child: AIcon(AIcons.partyPopper, size: 18, color: tokens.isDark ? const Color(0x66FFFFFF) : t.berryInk),
                ),
              ]),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 260),
                child: Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text(label, style: x.aCtaTitle)),
              ),
              Text(tr('dashboard_analiq_seyahetinize_baslayin_b03582', 'Analıq səyahətinizə başlayın'), style: x.aCtaText),
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                  decoration: BoxDecoration(color: t.pink2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(label.replaceAll(' 🎉', ''), style: x.aCtaBtn),
                    const SizedBox(width: 6),
                    const AIcon(AIcons.chevronRight, size: 14, color: Color(0xFFFFFFFF), mirrorInRtl: true),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
