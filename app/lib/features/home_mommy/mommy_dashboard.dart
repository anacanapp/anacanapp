// Ported from: src/components/Dashboard.tsx (MommyDashboard, getBabyFunFacts / getBabyDailyFunFact are unused there)
//
// The mommy stage body of the shared home (inside `.a-shell`, below stories / banners / recap). Order of the
// blocks, conditions and spacing follow the TSX one to one; blocks owned by other features come from
// [MommyHomeSlots]. Navigation defaults to the shell (`openScreen` / `openToolId`).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/i18n/language_controller.dart';
import '../../core/i18n/tr.dart';
import '../../core/offline/outbox_copy.dart';
import '../../design/design.dart';
import '../../shell/nav/ids.dart' show isCakesAvailable;
import '../../shell/nav/shell_controller.dart';
import '../../state/persisted_store.dart';
import '../baby/data/baby_repository.dart';
import '../baby/hooks/baby_services.dart';
import '../baby/hooks/use_baby_insight.dart';
import '../baby/hooks/use_baby_logs.dart';
import '../baby/hooks/use_baby_records.dart';
import '../baby/hooks/use_children.dart';
import '../baby/hooks/use_content_queries.dart';
import '../recovery/recovery_home_card.dart';
import 'mommy_home_slots.dart';
import 'period/mommy_period_banner.dart';
import 'widgets/baby_crisis_widget.dart';
import 'widgets/care_trackers.dart';
import 'widgets/development_tips_widget.dart';
import 'widgets/growth_tracker_widget.dart';
import 'widgets/mommy_ui.dart';
import 'widgets/prematurity_backfill_card.dart';
import 'widgets/quick_stats_widget.dart';
import 'widgets/teething_widget.dart';

/// Account facts the mommy home reads (`useAuth().isAdmin`, `profile.country_code`); tests override it.
class MommyHomeEnv {
  const MommyHomeEnv({this.isAdmin = false, this.countryCode});
  final bool isAdmin;
  final String? countryCode;
}

final mommyHomeEnvProvider = Provider<MommyHomeEnv>(
  (ref) => MommyHomeEnv(isAdmin: ref.watch(isAdminProvider), countryCode: ref.watch(authProfileProvider)?.countryCode),
);

/// `useDisabledTools().isToolDisabled` (disabled tools of the app language).
final mommyDisabledToolsProvider = Provider<List<String>>((ref) => ref.watch(disabledToolsProvider));

/// Backend url for the AI insight scope (`getBackendConfig().url`); '' while unknown.
final babyInsightBackendProvider = Provider<String>((ref) {
  try {
    return ref.watch(premiumEntitlementInputsProvider).backend;
  } catch (_) {
    return '';
  }
});

/// Formula ml of a log: `amount_ml`, else the `<n> ml` in its notes.
num formulaMlOf(BabyLog l) {
  if (l.amountMl != null) return l.amountMl!;
  final m = RegExp(r'(\d+)\s*ml', caseSensitive: false).firstMatch(l.notes ?? '');
  return int.tryParse(m?.group(1) ?? '0') ?? 0;
}

/// `aiInsightStats` from today's stats.
BabyInsightStats insightStatsOf(TodayStats s) => BabyInsightStats(
      sleepMinutes: s.sleepMinutes != 0 ? s.sleepMinutes : (s.sleepHours * 60).round(),
      sleepCount: s.sleepLogs.length,
      feedingCount: s.feedingCount,
      breastCount: s.breastFeedingCount,
      formulaCount: s.formulaCount,
      formulaMl: s.feedingLogs.where((l) => l.feedType == 'formula').fold<num>(0, (sum, l) => sum + formulaMlOf(l)),
      solidCount: s.solidCount,
      diaperCount: s.diaperCount,
      wetCount: s.wetCount,
      dirtyCount: s.dirtyCount,
      mixedCount: s.bothCount,
    );

class MommyDashboard extends ConsumerStatefulWidget {
  const MommyDashboard({super.key, this.onNavigate, this.onNavigateToTool});

  /// `onNavigate(screen)`; default: the shell opens the screen.
  final void Function(String screen)? onNavigate;

  /// `onNavigateToTool(tool)`; default: the shell opens the tool from the dashboard.
  final void Function(String tool)? onNavigateToTool;

  @override
  ConsumerState<MommyDashboard> createState() => _MommyDashboardState();
}

class _MommyDashboardState extends ConsumerState<MommyDashboard> {
  BabyInsightController? _insight;
  Timer? _minuteTick;
  int _milestonePage = 0;
  bool _milestonePageInit = false;
  final _rail = ScrollController();
  bool _railPositioned = false;

  @override
  void initState() {
    super.initState();
    // Minute refresh for relative texts (the per-second timer text lives in ElapsedTime).
    _minuteTick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _minuteTick?.cancel();
    _insight?.dispose();
    _rail.dispose();
    super.dispose();
  }

  void _navigate(String screen) =>
      widget.onNavigate != null ? widget.onNavigate!(screen) : ref.read(shellProvider.notifier).openScreen(screen);
  void _navigateTool(String tool) =>
      widget.onNavigateToTool != null ? widget.onNavigateToTool!(tool) : ref.read(shellProvider.notifier).openToolId(tool);

  BabyInsightController _insightController() => _insight ??= BabyInsightController(
        store: ref.read(localStoreProvider),
        repository: ref.read(babyRepositoryProvider),
        peekRemainingDaily: (f) => ref.read(babyCareServicesProvider).peekRemainingDaily(f),
      );

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final children = ref.watch(childrenProvider);
    final slots = ref.watch(mommyHomeSlotsProvider);
    final env = ref.watch(mommyHomeEnvProvider);
    final disabled = ref.watch(mommyDisabledToolsProvider);
    final t = context.a;
    final x = context.aText;
    final selected = children.selectedChild;
    final age = selected == null ? null : getChildAge(selected);

    final contentDay = age == null ? 0 : (age.correctionApplied ? age.correctedDayNumber : age.dayNumber);
    final dailyInfo = ref.watch(babyDailyInfoQuery(contentDay > 0 ? contentDay : null)).data;
    final mommyMessage = ref.watch(mommyDailyMessageQuery(contentDay > 0 ? contentDay : null)).data;
    final logs = ref.watch(babyLogsProvider);

    // AI insight props (re-render).
    final insight = _insightController();
    insight.update(
      selected != null && age != null ? insightStatsOf(logs.todayStats) : null,
      selected != null && age != null ? BabyInsightChild(id: selected.id, ageMonths: age.months, ageDays: age.days, gender: selected.gender) : null,
      BabyInsightScope(backend: ref.watch(babyInsightBackendProvider), userId: ref.watch(authUserProvider)?.id, language: language),
    );

    if (selected == null && children.loadError) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 200),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(outboxCopy('children_load_failed_title'), textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: AnacanTokens.of(context).shadcn.foreground)),
            const SizedBox(height: 12),
            Text(outboxCopy('children_load_failed_desc'), textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, height: 1.33, color: AnacanTokens.of(context).shadcn.mutedForeground)),
            const SizedBox(height: 12),
            GestureDetector(
              key: const ValueKey('children-retry'),
              onTap: () => ref.read(childrenActionsProvider).refetch(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: AnacanTokens.of(context).shadcn.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(outboxCopy('children_load_retry'),
                    style: TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: AnacanTokens.of(context).shadcn.primary)),
              ),
            ),
          ]),
        ),
      );
    }
    if (selected == null || age == null) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 200),
        child: Center(
          child: APulseBox(
            child: Text(tr('dashboard_yuklenir_5557de', 'Yüklənir...'),
                style: TextStyle(fontSize: 14, height: 1.43, color: AnacanTokens.of(context).shadcn.mutedForeground)),
          ),
        ),
      );
    }

    final months = age.months;
    final remainingDays = age.remainingDays;
    final slotArgs = MommySlotArgs(
      onNavigate: _navigate,
      onNavigateToTool: _navigateTool,
      childMonths: age.months,
      babyMonths: months,
      babyName: selected.name,
    );

    // Milestones (all on the rail; a 5-per-page index drives the achievement checks like React).
    final ms = ref.watch(babyMilestonesProvider);
    final all = ms.definitions;
    final achieved = [for (final m in all) ms.isMilestoneAchieved(m.id)];
    final totalPages = (all.length / 5).ceil();
    if (!_milestonePageInit && all.isNotEmpty) {
      _milestonePageInit = true;
      for (var p = 0; p < totalPages; p++) {
        if (achieved.skip(p * 5).take(5).any((a) => !a)) {
          _milestonePage = p;
          break;
        }
      }
    }
    final pageAchieved = achieved.skip(_milestonePage * 5).take(5).toList();
    if (pageAchieved.isNotEmpty && pageAchieved.every((a) => a) && _milestonePage < totalPages - 1) _milestonePage++;
    if (!_railPositioned && all.isNotEmpty) {
      _railPositioned = true;
      final first = achieved.indexOf(false);
      if (first > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_rail.hasClients) _rail.jumpTo((first * 70.0).clamp(0, _rail.position.maxScrollExtent));
        });
      }
    }

    Future<void> onMilestone(String id) async {
      final toast = AToastHost.of(context);
      await ref.read(babyCareServicesProvider).hapticMedium();
      await ref.read(babyMilestonesActionsProvider).toggleMilestone(
            id,
            toast: ({String? title, String? description, bool destructive = false}) =>
                toast.show(title: title, description: description, destructive: destructive),
          );
      final page = all.skip(_milestonePage * 5).take(5);
      final count = page.where((m) => ms.isMilestoneAchieved(m.id)).length;
      final services = ref.read(babyCareServicesProvider);
      if (count == 0) {
        unawaited(services.unlockAchievement('milestone_first', 'mommy'));
      } else if (count >= 4) {
        unawaited(services.unlockAchievement('milestone_5', 'mommy'));
      }
    }

    final headline = tr('mommy_hero_headline', '{days} gündür {name} həyatınızdadır').replaceFirst('{days}', '${age.dayNumber}');
    final nameAt = headline.indexOf('{name}');
    final heroBefore = nameAt < 0 ? headline : headline.substring(0, nameAt);
    final heroAfter = nameAt < 0 ? '' : headline.substring(nameAt + 6);
    final eyebrow = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: em(0.1, 11), color: t.onBgSoft, height: 1.5);
    final eyebrowStrong = eyebrow.copyWith(color: t.onBg);

    Widget section(Widget child) => Padding(padding: const EdgeInsets.only(top: 22), child: child);
    Widget gate(String feature, String title, String subtitle, Widget child, {String? blur}) =>
        slots.gate(context, PremiumGateArgs(feature: feature, title: title, subtitle: subtitle, blur: blur, child: child));

    final weeks = (age.days / 7).floor();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // Editorial hero
      AFadeIn(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(2, 18, 2, 6),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(upper(tr('mommy_hero_day_label', 'Gün')), style: eyebrow),
                const SizedBox(width: 6),
                Text('${age.dayNumber}', style: eyebrowStrong),
                const SizedBox(width: 6),
                Flexible(child: Text(upper('· ${selected.name}'), style: eyebrow, overflow: TextOverflow.ellipsis)),
              ]),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text.rich(
                key: const ValueKey('mommy-hero-headline'),
                TextSpan(children: [
                  TextSpan(text: heroBefore),
                  // `.a-hero-headline em { font-style: italic; color: #e8734a }` (anacan-design.css:357)
                  TextSpan(text: selected.name, style: const TextStyle(fontStyle: FontStyle.italic, color: Color(0xFFE8734A))),
                  TextSpan(text: heroAfter),
                ]),
                textAlign: TextAlign.center,
                style: x.heading(TextStyle(fontSize: 26, height: 1.22, color: t.onBg)),
              ),
            ),
            if (age.correctionApplied)
              Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 10),
                child: Opacity(
                  opacity: 0.85,
                  child: Wrap(alignment: WrapAlignment.center, spacing: 6, children: [
                    Text(upper('${tr('preemie_corrected_label', 'Korreksiya olunmuş yaş')}:'), style: eyebrow),
                    Text(upper(age.correctedDisplayText), style: eyebrowStrong),
                    if (age.gestationalWeeksAtBirth != null)
                      Text(
                        upper('· ${age.gestationalWeeksAtBirth}${(age.gestationalExtraDays ?? 0) != 0 ? '+${age.gestationalExtraDays}' : ''} '
                            '${tr('preemie_weeks_born', 'həftəlik doğulub')}'),
                        style: eyebrow,
                      ),
                  ]),
                ),
              ),
          ]),
        ),
      ),

      slots.slot(context, MommySlot.illnessActive, slotArgs),
      PrematurityBackfillCard(child: selected, onSaved: () => ref.read(childrenActionsProvider).refetch()),
      slots.slot(context, MommySlot.weaningHome, slotArgs),

      if (!disabled.contains('preemie-hub') && age.isPremature && months < 36)
        section(PressScale(
          scale: 0.98,
          onTap: () => _navigateTool('preemie-hub'),
          child: AFadeIn(
            child: ACard(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                ARankAvatar(background: t.peach1, fontSize: 20, child: const Text('💛')),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('preemie_dash_entry_title', 'Preemie Bələdçisi'), style: ARankText.title(t)),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(tr('preemie_dash_entry_sub', 'NICU, kenquru qayğısı, qidalanma və korreksiya olunmuş yaş'), style: ARankText.sub(t)),
                    ),
                  ]),
                ),
                const SizedBox(width: 12),
                AIcon(AIcons.chevronRight, size: 16, color: t.inkFaint, mirrorInRtl: true),
              ]),
            ),
          ),
        )),

      if (dailyInfo != null) section(_TodayInfo(info: dailyInfo, contentDay: contentDay, age: age, months: months, remainingDays: remainingDays)),
      if (mommyMessage != null) section(_MommyMessage(message: '${mommyMessage['message'] ?? ''}', contentDay: contentDay)),

      MommyPeriodBanner(onOpen: () => _navigate('mommy-period')),
      slots.slot(context, MommySlot.upcomingAppointments, slotArgs),
      RecoveryHomeCard(onOpen: () => _navigate('recovery')),
      slots.slot(context, MommySlot.illnessEntry, slotArgs),
      slots.slot(context, MommySlot.parentingHome, slotArgs),
      if (env.isAdmin || language == 'az') slots.slot(context, MommySlot.booksCarousel, slotArgs),

      section(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ASectionHead(
          title: tr('mommy_log_today_title', 'Bu günü qeyd et'),
          link: ASectionLinkText(tr('mommy_log_today_hint', 'Toxun və əlavə et')),
        ),
        slots.slot(context, MommySlot.waterWidget, slotArgs),
      ])),

      gate(
        'baby_care_tracking',
        tr('premiumgate_babycare_title', 'Qulluq izləmə alətləri'),
        tr('premiumgate_babycare_sub', 'Yuxu, qidalanma və bez dəyişmə qeydləri Premium-da'),
        MommyCareTrackers(
          baby: CareBaby(ageInMonths: months),
          insight: insight,
          slotArgs: slotArgs,
          onNavigate: _navigate,
          onNavigateToTool: _navigateTool,
        ),
      ),

      gate(
        'weekly_stats',
        tr('premiumgate_weekly_title', 'Həftəlik inkişaf icmalı'),
        tr('premiumgate_weekly_sub', 'Yuxu, qidalanma və bez statistikası — körpənizin həftəlik analizi Premium-da'),
        const QuickStatsWidget(),
      ),

      section(gate(
        'teething',
        tr('premiumgate_teething_title', 'Diş çıxarma izləyicisi'),
        tr('premiumgate_teething_sub', 'Hər dişin vaxtı, simptomlar və rahatlatma bələdçisi Premium-da'),
        TeethingWidget(onOpen: () => _navigateTool('teething')),
        blur: 'sm',
      )),

      section(gate(
        'growth',
        tr('premiumgate_growth_title', 'Boy-çəki artım əyriləri'),
        tr('premiumgate_growth_sub', 'ÜST standartları ilə müqayisəli inkişaf qrafikləri Premium-da'),
        const GrowthTrackerWidget(),
      )),

      slots.slot(context, MommySlot.aptekHome, slotArgs),
      slots.slot(context, MommySlot.partnerHome, slotArgs),

      if (!disabled.contains('cakes') && isCakesAvailable(env.countryCode, language) && months < 12)
        section(PressScale(
          scale: 0.98,
          onTap: () => _navigateTool('cakes'),
          child: AFadeIn(
            child: ACard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Row(children: [
                ARankAvatar(background: t.peach1, fontSize: 20, child: const Text('🎂')),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('dashboard_xususi_tortlar_ba1400', 'Xüsusi Tortlar'), style: ARankText.title(t)),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        months > 0
                            ? tr('dashboard_order_monthly_cake', '{n}-ci aylıq tortunu sifariş ver!').replaceFirst('{n}', '${months + 1}')
                            : tr('dashboard_korpeniz_ucun_milestone_tortla_3bcbc1', 'Körpəniz üçün milestone tortları'),
                        style: ARankText.sub(t),
                      ),
                    ),
                  ]),
                ),
                AIcon(AIcons.chevronRight, size: 18, color: t.inkFaint, mirrorInRtl: true),
              ]),
            ),
          ),
        )),

      // Development: milestones rail + one tip
      section(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ASectionHead(
          title: tr('dashboard_inkisaf_merheleleri_d6d887', 'İnkişaf mərhələləri'),
          link: ASectionLinkText('${achieved.where((a) => a).length}/${all.length}'),
        ),
        AFadeIn(
          child: ACard(
            padding: const EdgeInsets.only(top: 14, bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SingleChildScrollView(
                key: const ValueKey('milestone-rail'),
                controller: _rail,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 2),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (var i = 0; i < all.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    _MilestoneChip(
                      key: ValueKey('milestone-${all[i].id}'),
                      emoji: all[i].emoji,
                      label: all[i].label,
                      on: achieved[i],
                      onTap: () => onMilestone(all[i].id),
                    ),
                  ],
                ]),
              ),
              const DevelopmentTipsWidget(embedded: true),
            ]),
          ),
        ),
      ])),

      // Baby crisis calendar: hidden after week 75 (last crisis ends)
      if (weeks <= 75) section(BabyCrisisWidget(babyAgeWeeks: weeks, babyName: selected.name)),
    ]);
  }
}

class _TodayInfo extends StatelessWidget {
  const _TodayInfo({required this.info, required this.contentDay, required this.age, required this.months, required this.remainingDays});
  final Map<String, dynamic> info;
  final int contentDay;
  final ChildAge age;
  final int months;
  final int remainingDays;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final lines = '${info['info'] ?? ''}'.split('\n').where((l) => l.trim().isNotEmpty).map((l) => l.trim()).toList();
    final meta = StringBuffer('${tr('mommy_hero_day_label', 'Gün')} $contentDay');
    if (age.correctionApplied) meta.write(' (${tr('preemie_corrected_short', 'korreksiya')})');
    meta.write(' · ');
    meta.write(age.days == 0
        ? tr('pregnancy_utils_first_day', '1-ci gün')
        : '$months ${tr('mommy_meta_months', 'ay')}, $remainingDays ${tr('mommy_meta_days', 'gün')}');
    return AFadeIn(
      child: Container(
        key: const ValueKey('today-info'),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(t.radiusLg),
          border: Border.all(color: t.line),
          boxShadow: t.cardShadow,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(gradient: t.gradPeach, borderRadius: BorderRadius.circular(15)),
                child: Center(child: AIcon(AIcons.lightbulb, size: 19, color: t.accentInk)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(upper(tr('dashboard_todays_info', 'Bu günün məlumatları')), style: aTodayInfoEyebrow(t)),
                  ),
                  Text(meta.toString(), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: t.ink, height: 1.5)),
                ]),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: t.surfaceSoft, border: Border.all(color: t.line), borderRadius: BorderRadius.circular(999)),
                child: Text(upper(tr('dashboard_daily_badge', 'Gündəlik')),
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: em(0.05, 10), color: t.inkSoft, height: 1.5)),
              ),
            ]),
          ),
          for (var i = 0; i < lines.length; i++)
            Padding(
              padding: EdgeInsets.only(bottom: i == lines.length - 1 ? 0 : 8),
              child: Text(lines[i], style: TextStyle(fontSize: 13, height: 1.75, color: t.bodyText)),
            ),
        ]),
      ),
    );
  }
}

class _MommyMessage extends StatelessWidget {
  const _MommyMessage({required this.message, required this.contentDay});
  final String message;
  final int contentDay;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final t = tokens.a;
    final lines = message.split('\n').where((l) => l.trim().isNotEmpty).map((l) => l.trim()).toList();
    return AFadeIn(
      child: ACard(
        key: const ValueKey('mommy-message'),
        variant: ACardVariant.cta,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: t.peach1, borderRadius: BorderRadius.circular(999)),
                child: Text('${tr('mommy_hero_day_label', 'Gün')} $contentDay · ${tr('dashboard_message_for_mom', 'Anaya Mesaj')}',
                    style: context.aText.aCtaBadge),
              ),
            ),
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(color: t.peach1, borderRadius: BorderRadius.circular(14)),
              // `.a-cta-deco { color: #d96c2b }`, `.dark .a-cta-deco { color: rgba(255,255,255,.4) }` (anacan-design.css:766/1423)
              child: Center(child: AIcon(AIcons.heart, size: 18, color: tokens.isDark ? const Color(0x66FFFFFF) : const Color(0xFFD96C2B))),
            ),
          ]),
          for (var i = 0; i < lines.length; i++)
            Padding(padding: EdgeInsets.only(top: i == 0 ? 0 : 8), child: Text(lines[i], style: context.aText.aCtaText)),
        ]),
      ),
    );
  }
}

/// `.a-dev-ms` (64px column: 38px circle + 2-line label; `.on`: grad-peach + green check).
class _MilestoneChip extends StatelessWidget {
  const _MilestoneChip({super.key, required this.emoji, required this.label, required this.on, required this.onTap});
  final String emoji;
  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Semantics(
      button: true,
      toggled: on,
      child: PressScale.css(
        scale: 0.9,
        duration: const Duration(milliseconds: 150),
        onTap: onTap,
        child: SizedBox(
          width: 64,
          child: Column(children: [
            Stack(clipBehavior: Clip.none, children: [
              Opacity(
                opacity: on ? 1 : 0.65,
                child: Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: on ? null : t.surfaceSoft, gradient: on ? t.gradPeach : null),
                  child: Text(emoji, style: const TextStyle(fontSize: 17)),
                ),
              ),
              if (on)
                PositionedDirectional(
                  end: -2,
                  bottom: -2,
                  child: Container(
                    width: 15,
                    height: 15,
                    decoration: BoxDecoration(color: t.green2, shape: BoxShape.circle),
                    child: const Center(child: AIcon(AIcons.check, size: 10, color: Color(0xFFFFFFFF))),
                  ),
                ),
            ]),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10, height: 1.2, fontWeight: on ? FontWeight.w700 : FontWeight.w500, color: on ? t.ink : t.inkSoft),
            ),
          ]),
        ),
      ),
    );
  }
}
