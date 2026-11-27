// Ported from: src/components/Dashboard.tsx (Dashboard: `.a-scope.a-dash` frame for mommy / bump / flow — sky,
//              top bar with greeting, name and chat button (or ChildSelector for mommy), stories, banner slots,
//              Premium offers, Recap card, stage body, partner care card, recent blog posts, medical disclaimer;
//              the pregnancy-loss recovery home for flow), src/styles/anacan-design.css (.a-dash, .a-shell,
//              .a-topbar, .a-eyebrow, .a-wordmark, .a-topbar-actions), src/styles/startup.css (.a-topbar)
//
// The home is one scroll container: the shell's (tab `home`, scroll-memory key `tab:home`). The body is built
// from slivers (stage bodies may register slivers, see home_stage_registry.dart); inside the shell's
// SingleChildScrollView they lay out through a shrink-wrapped CustomScrollView. Horizontal rails (stories,
// blog cards) are lazily built ListViews.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../domain/js_compat.dart' show DomainClock;

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../state/user_store.dart';
import '../stories/dashboard_stories.dart';
import 'bump/bump_dashboard.dart';
import 'dashboard/medical_disclaimer.dart';
import 'dashboard/recap_home_card.dart';
import 'dashboard/recent_blog_posts.dart';
import 'home_inputs.dart';
import 'home_slots.dart';
import 'home_stage_registry.dart';
import 'widgets/home_widgets.dart';

/// `getGreeting()` by the local hour.
String dashboardGreeting(DateTime now) {
  final hour = now.hour;
  if (hour < 12) return tr('dashboard_good_morning_xeyir', 'Sabahınız xeyir');
  if (hour < 18) return tr('dashboard_good_afternoon_xeyir', 'Günortanız xeyir');
  return tr('dashboard_good_evening_xeyir', 'Axşamınız xeyir');
}

/// Registers the `bump` body (BumpDashboard). Called by `registerHomeFeature`.
void registerBumpHomeBody() => registerHomeStageBody(LifeStages.bump, (context) => const BumpDashboard());

class Dashboard extends ConsumerWidget {
  const Dashboard({super.key, this.now});
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final name = ref.watch(userStoreProvider.select((s) => s.name));
    if (lifeStage != 'mommy' && lifeStage != 'bump' && lifeStage != 'flow') return const SizedBox.shrink();
    final profile = ref.watch(homeProfileRowProvider);
    final slots = ref.watch(homeSlotsProvider);
    final nav = ref.watch(homeNavigationProvider);
    final linkedPartner = profile?['linked_partner_id'];
    final hasPartner = linkedPartner is String && linkedPartner.isNotEmpty;
    // Pregnancy loss recovery: a calm home without pregnancy, fertility, ads or shop content.
    final recovering = lifeStage == 'flow' && profile?['loss_recovery_active'] == true;

    Widget box(Widget w) => SliverToBoxAdapter(child: w);
    final slivers = <Widget>[
      box(_TopBar(lifeStage: lifeStage!, name: name, recovering: recovering, now: now)),
      if (recovering)
        box(homeSlot(context, slots.recoveryHome))
      else ...[
        // Story row (az; app_settings.dashboard_stories off / admin / on).
        box(DashboardStories(stage: lifeStage)),
        if (slots.bannerSlot != null) box(Padding(padding: const EdgeInsets.only(bottom: 8), child: slots.bannerSlot!(context, 'home_top'))),
        if (slots.adFreeOffer != null) box(slots.adFreeOffer!(context, 'top')),
        // Anacan Recap 2026: only while anacan_recap_v1 says available.
        box(RecapHomeCard(onOpen: () => nav.navigate('recap'))),
        ...buildHomeStageSlivers(context, lifeStage),
        if (slots.adInlineAnchor != null) box(slots.adInlineAnchor!(context, 'home_banner')),
      ],
      // Daily summary auto-syncs to the partner in the background.
      if (lifeStage == 'bump' && hasPartner && slots.dailySummaryAutoSync != null) box(slots.dailySummaryAutoSync!(context)),
      if (hasPartner && slots.partnerCareCard != null)
        box(Padding(padding: const EdgeInsets.only(top: 14), child: slots.partnerCareCard!(context, lifeStage))),
      if (!recovering) ...[
        box(RecentBlogPosts(onNavigate: nav.navigate, lifeStage: lifeStage)),
        if (slots.bannerSlot != null) box(Padding(padding: const EdgeInsets.only(top: 8), child: slots.bannerSlot!(context, 'home_bottom'))),
        // Small medical disclaimer (Google Play Health Content policy).
        box(const MedicalDisclaimer()),
        if (slots.adFreeOffer != null) box(slots.adFreeOffer!(context, 'bottom')),
      ],
      // `.a-dash pb-6`.
      box(const SizedBox(height: 24)),
    ];

    return AScope(
      child: Stack(
        key: const ValueKey('dashboard'),
        children: [
          // Watercolor sky behind top bar + hero.
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          ClipRect(
            child: Padding(
              // `.a-shell { padding-inline: 20px }`
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: CustomScrollView(
                key: const ValueKey('dashboard-slivers'),
                shrinkWrap: true,
                primary: false,
                clipBehavior: Clip.none,
                physics: const NeverScrollableScrollPhysics(),
                slivers: slivers,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// `.a-topbar` (startup.css: min-height 64, padding 12 0, gap 12) with greeting + name and the chat button.
class _TopBar extends ConsumerWidget {
  const _TopBar({required this.lifeStage, required this.name, required this.recovering, this.now});
  final String lifeStage;
  final String? name;
  final bool recovering;
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final unread = ref.watch(homeTotalUnreadProvider);
    final slots = ref.watch(homeSlotsProvider);
    final nav = ref.watch(homeNavigationProvider);
    final greeting = dashboardGreeting((now ?? DomainClock.now)());
    final display = (name == null || name!.isEmpty) ? tr('dashboard_xanim_39ff6a', 'Xanım') : name!;
    return FramerEnter(
      y: -20,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          key: const ValueKey('dashboard-topbar'),
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        cssUppercase(greeting, language),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: t.onBgSoft, height: 1.5),
                      ),
                    ),
                    Text(
                      '$display ${recovering ? '🤍' : '👋'}',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: -0.15, color: t.onBg, height: 1.35),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              if (lifeStage == 'mommy')
                homeSlot(context, slots.childSelectorCompact)
              else
                AIconBtn(
                  key: const ValueKey('dashboard-chat'),
                  semanticLabel: tr('bottomnav_mesajlar', 'Mesajlar'),
                  onTap: nav.openChat,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      const SizedBox(width: 42, height: 42),
                      const AIcon(AIcons.messageCircle, size: 16),
                      if (unread > 0) PositionedDirectional(top: -4, end: -4, child: AUnreadBadge(unread)),
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
