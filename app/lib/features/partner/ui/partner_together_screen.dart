// Ported from: src/components/partner/v2/PartnerTogetherScreen.tsx
//
// "Birlikdə" hub — every shared tool in one place, grouped as prepare / daily / us.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/parenting/parenting.dart' show isParentingPartnerVisible, partnerParentingChild;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show ASky, cssUpper;
import '../../tools/parenting/parenting_copy.dart' show pt;
import '../../tools/shopping/shopping_data.dart' show shoppingItemsProvider;
import '../data/daily_summary.dart';
import '../data/partner_content.dart';
import '../data/partner_data.dart';
import '../data/partner_hospital_bag.dart';
import '../data/partner_progress.dart';
import '../partner_copy.dart';
import 'partner_ui.dart';

const List<String> _moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];

/// One tile of the hub.
@immutable
class TogetherFeature {
  const TogetherFeature({
    required this.id,
    required this.group,
    required this.screen,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.bg,
    required this.ink,
    this.badge,
    this.progress,
    required this.visible,
  });
  final String id;

  /// 'prepare' | 'daily' | 'us'.
  final String group;
  final String screen;
  final String title;
  final String subtitle;
  final AIconData icon;
  final Color bg;
  final Color ink;
  final String? badge;
  final double? progress;
  final bool visible;
}

class PartnerTogetherScreen extends ConsumerWidget {
  const PartnerTogetherScreen({super.key, required this.onNavigate});
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final data = ref.watch(partnerDataProvider);
    final partner = data.partnerProfile;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final parentingSetting = ref.watch(appSettingProvider('parenting_tool'));
    final children = data.partnerChildren;
    // Tərbiyə: same switch and content rules as the mother's tile; the child is hers (as far as she shares it).
    final parentingChild = partnerParentingChild(
      [for (final c in children) (name: c.name, birthDate: c.birthDate, isCurrent: c.isCurrent)],
      partner == null ? null : (babyName: partner.babyName, babyBirthDate: partner.babyBirthDate),
    );
    final showParenting = isParentingPartnerVisible(
      womanLifeStage: partner?.lifeStage,
      language: language,
      setting: parentingSetting,
      birthDate: parentingChild?.birthDate,
      birthDates: [for (final c in children) c.birthDate],
    );
    final babyAgeDays = data.getBabyAgeDays();
    final postpartum = postpartumPartnerText(language.isEmpty ? 'az' : language);
    final bag = ref.watch(partnerHospitalBagProvider);
    final todaySummary = ref.watch(dailySummaryProvider.select((s) => s.todaySummary));
    final surprises = ref.watch(surprisesProvider);
    final shopping = ref.watch(shoppingItemsProvider);

    final lifeStage = partner?.lifeStage ?? 'bump';
    final uncheckedShopping = shopping.uncheckedCount;
    final planned = surprises.plannedSurprises.length;
    final surprisePoints = surprises.totalPoints;
    final summarySent = todaySummary?.isSent ?? false;
    final summaryMood = todaySummary?.mood;

    final features = <TogetherFeature>[
      TogetherFeature(
        id: 'shopping',
        group: 'daily',
        screen: 'partner-shopping',
        title: tr('partnerv2_alisveris', 'Alışveriş'),
        subtitle: uncheckedShopping > 0 ? '$uncheckedShopping ${tr('partnerv2_gozleyen_mehsul', 'gözləyən məhsul')}' : tr('partnerv2_siyahi_hazir', 'Siyahı hazırdır'),
        icon: AIcons.shoppingCart,
        bg: a.green1,
        ink: a.greenInk,
        badge: uncheckedShopping > 0 ? '$uncheckedShopping' : null,
        visible: true,
      ),
      TogetherFeature(
        id: 'hospital-bag',
        group: 'prepare',
        screen: 'partner-hospital-bag',
        title: tr('syncedfeaturesgrid_xestexana_cantasi_045078', 'Xəstəxana Çantası'),
        subtitle: '${bag.checkedCount}/${bag.totalCount} ${tr('partner_ready', 'hazır')}',
        icon: AIcons.package,
        bg: a.peach1,
        ink: a.accentInk,
        progress: bag.progress,
        visible: lifeStage == 'bump',
      ),
      TogetherFeature(
        id: 'name-voting',
        group: 'prepare',
        screen: 'name-voting',
        title: tr('syncedfeaturesgrid_ad_secimi_465d2a', 'Ad Seçimi'),
        subtitle: tr('partnerv2_birlikde_secin', 'Birlikdə seçin'),
        icon: AIcons.vote,
        bg: a.pink1,
        ink: a.pinkInk,
        visible: lifeStage == 'bump',
      ),
      TogetherFeature(
        id: 'birth-plan',
        group: 'prepare',
        screen: 'birth-plan',
        title: feature37Text('pm_birth_plan'),
        subtitle: feature37Text('pm_birth_plan_sub'),
        icon: AIcons.clipboardList,
        bg: a.lav1,
        ink: a.lavInk,
        visible: lifeStage == 'bump',
      ),
      TogetherFeature(
        id: 'postpartum',
        group: 'daily',
        screen: 'postpartum-support',
        title: postpartum.ui('title'),
        subtitle: postpartum.ui('subtitle'),
        icon: AIcons.heartHandshake,
        bg: a.peach1,
        ink: a.accentInk,
        visible: lifeStage == 'mommy' && babyAgeDays < 84,
      ),
      TogetherFeature(
        id: 'parenting',
        group: 'daily',
        screen: 'partner-parenting',
        title: pt('par_tool_name'),
        subtitle: pt('par_partner_sub'),
        icon: AIcons.smile,
        bg: a.green1,
        ink: a.greenInk,
        visible: showParenting,
      ),
      TogetherFeature(
        id: 'night-shift',
        group: 'daily',
        screen: 'night-shift',
        title: feature37Text('pm_night_shift'),
        subtitle: feature37Text('pm_night_shift_sub'),
        icon: AIcons.moon,
        bg: a.lav1,
        ink: a.lavInk,
        visible: lifeStage == 'mommy',
      ),
      TogetherFeature(
        id: 'daily-summary',
        group: 'daily',
        screen: 'daily-summary',
        title: tr('syncedfeaturesgrid_gundelik_xulase_3d07a5', 'Gündəlik Xülasə'),
        // `is_sent` (the silent sync always fills today's row; only a real send counts).
        subtitle: summarySent ? tr('syncedfeaturesgrid_bugun_gonderildi_1fb520', 'Bugün göndərildi') : tr('syncedfeaturesgrid_gozleyir_7c7f65', 'Gözləyir...'),
        icon: AIcons.fileText,
        bg: a.lav1,
        ink: a.lavInk,
        badge: summarySent ? _moodEmojis[((summaryMood == null || summaryMood == 0 ? 3 : summaryMood) - 1).clamp(0, 4)] : null,
        visible: true,
      ),
      TogetherFeature(
        id: 'appointments',
        group: 'prepare',
        screen: 'partner-appointments',
        title: tr('partnerv2_randevular', 'Randevular'),
        subtitle: tr('partnerv2_hekim_vizitleri', 'Həkim vizitləri'),
        icon: AIcons.calendarHeart,
        bg: a.blue1,
        ink: a.blueInk,
        visible: data.sharing.shareAppointments,
      ),
      TogetherFeature(
        id: 'baby-day',
        group: 'daily',
        screen: 'partner-baby-day',
        title: tr('partnerv2_korpe_gunu', 'Körpə Günü'),
        subtitle: tr('partnerv2_yeme_yuxu_bez', 'Yemə · yuxu · bez'),
        icon: AIcons.baby,
        bg: a.pink1,
        ink: a.pinkInk,
        visible: lifeStage == 'mommy' && data.sharing.shareBabyLogs,
      ),
      TogetherFeature(
        id: 'weekly-stats',
        group: 'us',
        screen: 'partner-weekly-stats',
        title: tr('syncedfeaturesgrid_heftelik_statistika_292953', 'Həftəlik Statistika'),
        subtitle: tr('syncedfeaturesgrid_ehval_aktivlik_a0a105', 'Əhval & aktivlik'),
        icon: AIcons.chartColumn,
        bg: a.blue1,
        ink: a.blueInk,
        visible: true,
      ),
      TogetherFeature(
        id: 'surprises',
        group: 'us',
        screen: 'partner-surprises',
        title: tr('syncedfeaturesgrid_surpriz_planla_d495ce', 'Sürpriz Planla'),
        subtitle: planned > 0 ? '$planned ${tr('partnerv2_planlanib', 'planlanıb')}' : tr('syncedfeaturesgrid_planlasdir_933684', 'Planlaşdır'),
        icon: AIcons.gift,
        bg: a.yellow1,
        ink: a.yellowInk,
        badge: surprisePoints > 0 ? '$surprisePoints ${tr('partnerv2_xal', 'xal')}' : null,
        visible: true,
      ),
    ];

    final visible = features.where((f) => f.visible).toList();
    final groups = [
      ('prepare', feature37Text('pm_biz_prepare')),
      ('daily', feature37Text('pm_biz_daily')),
      ('us', feature37Text('pm_biz_us')),
    ];

    final sections = <Widget>[
      for (final (id, label) in groups)
        if (visible.any((f) => f.group == id))
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(cssUpper(label), style: pText(13, weight: FontWeight.w800, color: a.inkSoft, ls: 0.06)),
            ),
            _Grid(children: [
              for (final (i, f) in visible.where((f) => f.group == id).indexed) _Tile(feature: f, index: i, onTap: () => onNavigate(f.screen)),
            ]),
          ]),
    ];

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: [
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 64),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(cssUpper(tr('partnerv2_sinxron_eyebrow', 'SİNXRON')), style: pText(11, weight: FontWeight.w700, color: a.onBgSoft, ls: 0.1)),
                    ),
                    Text(tr('partnerv2_birlikde', 'Birlikdə'), style: pText(19, weight: FontWeight.w700, color: a.onBg, ls: -0.01, height: 1.35)),
                  ]),
                ),
              ),
              for (var i = 0; i < sections.length; i++) ...[if (i > 0) const SizedBox(height: 20), sections[i]],
            ]),
          ),
        ]),
      ),
    );
  }
}

/// `grid grid-cols-2 gap-2.5`.
class _Grid extends StatelessWidget {
  const _Grid({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: children[i]),
          const SizedBox(width: 10),
          Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox.shrink()),
        ]),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var i = 0; i < rows.length; i++) ...[if (i > 0) const SizedBox(height: 10), rows[i]],
    ]);
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.feature, required this.index, required this.onTap});
  final TogetherFeature feature;
  final int index;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final f = feature;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: animationsDisabled(context) ? 1 : 0, end: 1),
      duration: Duration(milliseconds: 300 + index * 40),
      curve: Interval(index * 40 / (300 + index * 40), 1, curve: ACurves.framerDefault),
      builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 16 * (1 - v)), child: child)),
      child: PartnerTap(
        key: ValueKey('together-${f.id}'),
        scale: 0.97,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
          child: Stack(clipBehavior: Clip.none, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: f.bg, borderRadius: BorderRadius.circular(14)),
                child: AIcon(f.icon, size: 19, color: f.ink),
              ),
              const SizedBox(height: 10),
              Text(f.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(13.5, weight: FontWeight.w800, color: a.ink)),
              const SizedBox(height: 1),
              Text(f.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11, color: a.inkSoft)),
              if (f.progress != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      height: 6,
                      color: a.surfaceSoft,
                      alignment: AlignmentDirectional.centerStart,
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: (f.progress! / 100).clamp(0, 1)),
                        duration: const Duration(milliseconds: 800),
                        curve: ACurves.cssEaseOut,
                        builder: (context, v, _) => FractionallySizedBox(
                          widthFactor: v,
                          child: DecoratedBox(decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(999))),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
            if (f.badge != null)
              PositionedDirectional(
                top: -3,
                end: -3,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: f.bg, borderRadius: BorderRadius.circular(999)),
                  child: Text(f.badge!, style: pText(10, weight: FontWeight.w800, color: f.ink)),
                ),
              ),
            if (f.badge == null && f.progress == null)
              PositionedDirectional(bottom: 1, end: -1, child: AIcon(AIcons.chevronRight, size: 14, color: a.inkFaint, mirrorInRtl: true)),
          ]),
        ),
      ),
    );
  }
}
