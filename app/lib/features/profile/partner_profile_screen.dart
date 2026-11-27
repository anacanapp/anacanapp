// Ported from: src/components/PartnerProfileScreen.tsx, src/hooks/usePartnerConfig.ts (FALLBACK_ACHIEVEMENTS,
//              FALLBACK_MENU_ITEMS)
//
// Partner profile tab: level card, link state, stat tiles, achievements strip, menu, logout.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../shell/nav/shell_controller.dart';
import '../../state/state.dart';
import '../settings/copy/feature_copy.dart';
import '../settings/ui/settings_ui.dart';
import 'profile_interfaces.dart';
import 'profile_screen.dart' show profileAvatarBuilderProvider;

const Map<String, (String, String)> _achievementNameTr = {
  'first_love': ('usepartnerconfig_ilk_sevgi', 'İlk Sevgi'),
  'supporter': ('usepartnerconfig_destekci_829677', 'Dəstəkçi'),
  'caring': ('usepartnerconfig_qaygikes_c791ee', 'Qayğıkeş'),
  'super_partner': ('partnerprofilescreen_super_partner', 'Super Partner'),
  'family_hero': ('usepartnerconfig_aile_qehremani_62b00e', 'Ailə Qəhrəmanı'),
  'messenger': ('usepartnerconfig_sevgi_elcisi', 'Sevgi Elçisi'),
  'weekly_hero': ('usepartnerconfig_heftelik_qehreman', 'Həftəlik Qəhrəman'),
};
const Map<String, (String, String)> _menuLabelTr = {
  'notifications': ('usepartnerconfig_bildirisler_54eb88', 'Bildirişlər'),
  'partner-privacy': ('usepartnerconfig_gizlilik', 'Gizlilik'),
  'help': ('usepartnerconfig_yardim_da857a', 'Yardım'),
};

List<Map<String, dynamic>> fallbackAchievements() => [
      {'achievement_key': 'first_love', 'name_az': tr('usepartnerconfig_ilk_sevgi', 'İlk Sevgi'), 'emoji': '💕', 'unlock_condition': 'always_unlocked', 'unlock_threshold': 0},
      {'achievement_key': 'supporter', 'name_az': tr('usepartnerconfig_destekci_829677', 'Dəstəkçi'), 'emoji': '🤝', 'unlock_condition': 'always_unlocked', 'unlock_threshold': 0},
      {'achievement_key': 'caring', 'name_az': tr('usepartnerconfig_qaygikes_c791ee', 'Qayğıkeş'), 'emoji': '🌟', 'unlock_condition': 'completed_surprises', 'unlock_threshold': 3},
      {'achievement_key': 'super_partner', 'name_az': tr('partnerprofilescreen_super_partner', 'Super Partnyor'), 'emoji': '🏆', 'unlock_condition': 'completed_surprises', 'unlock_threshold': 10},
      {'achievement_key': 'family_hero', 'name_az': tr('usepartnerconfig_aile_qehremani_62b00e', 'Ailə Qəhrəmanı'), 'emoji': '👑', 'unlock_condition': 'surprise_points', 'unlock_threshold': 500},
      {'achievement_key': 'messenger', 'name_az': tr('usepartnerconfig_sevgi_elcisi', 'Sevgi Elçisi'), 'emoji': '💌', 'unlock_condition': 'messages_sent', 'unlock_threshold': 10},
      {'achievement_key': 'weekly_hero', 'name_az': tr('usepartnerconfig_heftelik_qehreman', 'Həftəlik Qəhrəman'), 'emoji': '📅', 'unlock_condition': 'missions_completed', 'unlock_threshold': 7},
    ];

List<Map<String, dynamic>> fallbackMenuItems() => [
      {'menu_key': 'notifications', 'label_az': tr('usepartnerconfig_bildirisler_54eb88', 'Bildirişlər'), 'icon_name': 'Bell', 'route': 'notifications'},
      {'menu_key': 'partner-privacy', 'label_az': tr('usepartnerconfig_gizlilik', 'Gizlilik'), 'icon_name': 'Shield', 'route': 'partner-privacy'},
      {'menu_key': 'help', 'label_az': tr('usepartnerconfig_yardim_da857a', 'Yardım'), 'icon_name': 'HelpCircle', 'route': 'help'},
    ];

const Map<String, AIconData> _menuIcons = {
  'Bell': AIcons.bell,
  'Shield': AIcons.shield,
  'HelpCircle': AIcons.circleHelp,
  'Settings': AIcons.settings,
  'User': AIcons.user,
};

/// Achievement unlock rule of the screen.
bool achievementUnlocked(Map<String, dynamic> a, PartnerProfileData d) {
  final t = (a['unlock_threshold'] as num?) ?? 0;
  return switch (a['unlock_condition']) {
    'always_unlocked' => true,
    'completed_surprises' => d.completedSurprises >= t,
    'surprise_points' => d.surprisePoints >= t,
    'messages_sent' => d.lovesSent + d.messagesSent >= t,
    'missions_completed' => d.completedMissions >= t,
    _ => false,
  };
}

class PartnerProfileScreen extends ConsumerWidget {
  const PartnerProfileScreen({super.key, this.onNavigate});
  final ValueChanged<String>? onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final profile = ref.watch(authProfileProvider);
    final d = ref.watch(partnerProfileDataProvider);
    final slots = ref.watch(profileSlotsProvider);
    final avatar = ref.watch(profileAvatarBuilderProvider);
    void nav(String id) => onNavigate != null ? onNavigate!(id) : ref.read(shellProvider.notifier).openScreen(id);
    final isLinked = profile?.linkedPartnerId != null;
    final name = (store.name?.isNotEmpty ?? false) ? store.name! : 'Partner';

    final achievements = (d.achievementRows.isNotEmpty ? d.achievementRows : fallbackAchievements()).map((r) {
      final key = '${r['achievement_key']}';
      final t = _achievementNameTr[key];
      return (
        id: key,
        name: t != null ? tr(t.$1, t.$2) : '${r['name_az'] ?? r['name'] ?? key}',
        emoji: '${r['emoji'] ?? ''}',
        unlocked: achievementUnlocked(r, d),
      );
    }).toList();
    final menuItems = (d.menuRows.isNotEmpty ? d.menuRows : fallbackMenuItems()).map((m) {
      final key = '${m['menu_key']}';
      final t = _menuLabelTr[key];
      return (
        id: '${m['route'] ?? key}',
        icon: _menuIcons['${m['icon_name'] ?? 'Settings'}'] ?? AIcons.settings,
        label: t != null ? tr(t.$1, t.$2) : '${m['label_az'] ?? m['label'] ?? key}',
      );
    }).toList();
    final menu = [
      (id: 'partner-notifications', icon: AIcons.bell, label: feature37Text('pn_title')),
      ...menuItems,
      (id: 'settings', icon: AIcons.settings, label: feature37Text('pp_settings')),
    ];

    final stage = d.partnerStage;
    final stageLine = stage == 'bump'
        ? '${tr('partnerprofilescreen_hamilelik_dovru_57af7a', 'Hamiləlik dövrü')}${d.pregnancyWeek != 0 ? ' · ${feature37Text('pp_week').replaceAll('{n}', '${d.pregnancyWeek}')}' : ''}'
        : stage == 'mommy'
            ? (d.babyAgeDays >= 60
                ? feature37Text('pp_baby_age_months').replaceAll('{n}', '${d.babyAgeDays ~/ 30}')
                : feature37Text('pp_baby_age_days').replaceAll('{n}', '${d.babyAgeDays}'))
            : tr('partnerprofilescreen_menstruasiya_dovru_a5852d', 'Menstruasiya dövrü');

    final tiles = [
      (icon: AIcons.trophy, value: d.totalPoints + d.surprisePoints, label: feature37Text('pp_points'), bg: a.yellow1, ink: a.yellowInk),
      (icon: AIcons.target, value: d.completedMissions, label: feature37Text('pp_missions'), bg: a.blue1, ink: a.blueInk),
      (icon: AIcons.gift, value: d.completedSurprises, label: feature37Text('pp_surprises'), bg: a.pink1, ink: a.pinkInk),
      (icon: AIcons.messageCircle, value: d.messagesSent, label: feature37Text('pp_messages'), bg: a.green1, ink: a.greenInk),
    ];
    BoxDecoration card() => BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow);

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: <Widget>[
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
              ATopbar(
                eyebrow: feature37Text('pp_profile'),
                title: name,
                titleSize: 19,
                actions: <Widget>[
                  AIconBtn(size: 44, semanticLabel: tr('usepartnerconfig_gizlilik', 'Gizlilik'), onTap: () => nav('partner-privacy'), icon: const AIcon(AIcons.shield, size: 16)),
                ],
              ),
              VGap(gap: 14, children: <Widget>[
                FadeRise(
                  dy: 12,
                  child: ACard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                      Row(children: <Widget>[
                        Container(
                          width: 56,
                          height: 56,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: a.gradBlue, shape: BoxShape.circle),
                          child: const Text('👨', style: TextStyle(fontSize: 30, height: 36 / 30)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(17, weight: FontWeight.w900, color: a.ink)),
                            if (store.email?.isNotEmpty ?? false) Text(store.email!, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12, color: a.inkSoft)),
                          ]),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                          decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                            AIcon(AIcons.zap, size: 12, color: a.blueInk),
                            const SizedBox(width: 4),
                            Text(feature37Text('pp_level').replaceAll('{n}', '${d.level}'), style: px(11.5, weight: FontWeight.w800, color: a.blueInk)),
                          ]),
                        ),
                      ]),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          height: 8,
                          color: a.surfaceSoft,
                          alignment: AlignmentDirectional.centerStart,
                          child: TweenAnimationBuilder<double>(
                            tween: Tween<double>(begin: 0, end: d.levelProgress.clamp(0, 100) / 100),
                            duration: const Duration(milliseconds: 300),
                            curve: ACurves.framerDefault,
                            builder: (context, v, _) => FractionallySizedBox(
                              widthFactor: v,
                              child: DecoratedBox(decoration: BoxDecoration(gradient: a.gradBlue, borderRadius: BorderRadius.circular(999))),
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(feature37Text('pp_to_next').replaceAll('{n}', '${d.pointsToNextLevel}'), textAlign: TextAlign.end, style: px(10.5, color: a.inkFaint)),
                      ),
                    ]),
                  ),
                ),
                if (isLinked && d.partnerName != null)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: card(),
                    child: Row(children: <Widget>[
                      Container(
                        width: 48,
                        height: 48,
                        clipBehavior: Clip.antiAlias,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
                        child: (d.partnerAvatarUrl?.isNotEmpty ?? false)
                            ? SizedBox.expand(child: avatar(d.partnerAvatarUrl!))
                            : Text(stage == 'bump' ? '🤰' : stage == 'mommy' ? '👩‍🍼' : '🌸', style: const TextStyle(fontSize: 24)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Text(cssUpper(feature37Text('pp_connected_with')), style: px(10.5, weight: FontWeight.w800, color: a.inkFaint, ls: 0.06)),
                          Text(d.partnerName!, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(15, weight: FontWeight.w900, color: a.ink)),
                          Text(stageLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(11.5, color: a.inkSoft)),
                        ]),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999)),
                        child: Text('● ${feature37Text('ph_linked')}', style: px(10.5, weight: FontWeight.w800, color: a.greenInk)),
                      ),
                    ]),
                  )
                else
                  Center(child: slots.partnerLinkForm?.call(context) ?? const SizedBox.shrink()),
                Row(children: <Widget>[
                  for (var i = 0; i < tiles.length; i++) ...<Widget>[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                        decoration: card(),
                        child: Column(children: <Widget>[
                          Container(
                            width: 32,
                            height: 32,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: tiles[i].bg, borderRadius: BorderRadius.circular(10)),
                            child: AIcon(tiles[i].icon, size: 15, color: tiles[i].ink),
                          ),
                          const SizedBox(height: 6),
                          Text(d.statsLoading ? '·' : '${tiles[i].value}', style: px(17, weight: FontWeight.w900, color: a.ink)),
                          Text(tiles[i].label, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: px(10, color: a.inkSoft)),
                        ]),
                      ),
                    ),
                  ],
                ]),
                Container(
                  padding: const EdgeInsets.fromLTRB(0, 14, 0, 12),
                  decoration: card(),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: Text(feature37Text('pp_achievements'), style: px(14, weight: FontWeight.w900, color: a.ink))),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                        for (var i = 0; i < achievements.length; i++) ...<Widget>[
                          if (i > 0) const SizedBox(width: 12),
                          Opacity(
                            opacity: achievements[i].unlocked ? 1 : 0.4,
                            child: SizedBox(
                              width: 68,
                              child: Column(children: <Widget>[
                                Container(
                                  width: 56,
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: achievements[i].unlocked ? a.blue1 : a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
                                  child: Text(achievements[i].emoji, style: const TextStyle(fontSize: 24)),
                                ),
                                const SizedBox(height: 5),
                                Text(achievements[i].name, textAlign: TextAlign.center, style: px(10, weight: FontWeight.w600, color: a.inkSoft, height: 1.25)),
                              ]),
                            ),
                          ),
                        ],
                      ]),
                    ),
                  ]),
                ),
                Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: card(),
                  child: Column(children: <Widget>[
                    for (var i = 0; i < menu.length; i++)
                      GestureDetector(
                        key: ValueKey<String>('partner-menu-${menu[i].id}'),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => nav(menu[i].id),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                          decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                          child: Row(children: <Widget>[
                            Container(
                              width: 36,
                              height: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                              child: AIcon(menu[i].icon, size: 16, color: a.inkSoft),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(menu[i].label, style: px(13.5, weight: FontWeight.w700, color: a.ink))),
                            AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                          ]),
                        ),
                      ),
                  ]),
                ),
                PressScale(
                  key: const ValueKey<String>('partner-logout'),
                  scale: 0.98,
                  onTap: () async {
                    await ref.read(accountActionsProvider).signOut();
                    ref.read(userStoreProvider.notifier).logout();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                      AIcon(AIcons.logOut, size: 17, color: a.alertInk),
                      const SizedBox(width: 8),
                      Text(feature37Text('pp_logout'), style: px(14, weight: FontWeight.w800, color: a.alertInk)),
                    ]),
                  ),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}
