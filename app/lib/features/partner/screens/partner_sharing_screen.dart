// Ported from: src/components/partner/v2/PartnerSharingScreen.tsx
//
// The mother's single "Partnyor" section: the invitation (when not linked), the partner's week, grouped sharing
// settings (with a preview of what he sees), the shared tools, the partner notifications link and unlinking.
import 'dart:async';

import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../profile/profile_interfaces.dart' show accountActionsProvider, appOriginProvider, premiumPromptProvider, shareServiceProvider, subscriptionIsPremiumProvider;
import '../../settings/privacy_screen.dart' show afterUnlinkProvider, unlinkPartnersProvider;
import '../../settings/ui/settings_ui.dart' show ALoader, ShadButton, cssUpper, ShadButtonVariant, ShadDialogFrame, ShadSwitch, shadDescription, shadTitle, showShadDialog, toasts;
import '../data/partner_data.dart';
import '../data/partner_sharing.dart';
import '../partner_ports.dart';
import '../ui/partner_ui.dart';
import 'screens_copy.dart';
import 'screens_ui.dart';

/// 'flow' | 'bump' | 'mommy'.
typedef SharingStage = String;

/// A sharing group: its keys and the stages it belongs to.
typedef SharingGroup = ({String id, List<String> keys, List<SharingStage> stages});

/// `GROUPS` in display order.
const List<SharingGroup> kSharingGroups = [
  (id: 'mood', keys: ['share_mood', 'share_symptoms'], stages: ['flow', 'bump', 'mommy']),
  (id: 'cycle', keys: ['share_cycle'], stages: ['flow']),
  (id: 'pregnancy', keys: ['share_kicks', 'share_contractions'], stages: ['bump']),
  (id: 'baby', keys: ['share_baby_logs'], stages: ['mommy']),
  (id: 'appointments', keys: ['share_appointments'], stages: ['bump', 'mommy']),
  (id: 'health', keys: ['share_water', 'share_weight'], stages: ['flow', 'bump', 'mommy']),
];

/// The partner's week from the chat: loves and messages he sent her in the last 7 days.
({int loves, int texts}) partnerWeek(List<Map<String, dynamic>> messages, String? userId, [DateTime? now]) {
  final since = (now ?? DateTime.now()).subtract(const Duration(days: 7));
  final fromPartner = messages.where((m) {
    final at = DateTime.tryParse('${m['created_at'] ?? ''}');
    return m['receiver_id'] == userId && at != null && !at.isBefore(since);
  }).toList();
  return (
    loves: fromPartner.where((m) => m['message_type'] == 'love' || (m['message_type'] == 'text' && m['content'] == '❤️')).length,
    texts: fromPartner.where((m) => const ['text', 'image', 'audio', 'video'].contains(m['message_type']) && m['content'] != '❤️').length,
  );
}

/// `toggleGroup`: the keys of [group] whose value differs from [value] (saved one by one).
List<String> groupKeysToSave(SharingGroup group, PartnerSharing settings, bool value) => [for (final k in group.keys) if (settings[k] != value) k];

({AIconData icon, String title, String sub}) _row(String key) => switch (key) {
      'share_mood' => (icon: AIcons.smile, title: tr('partnerv2_sh_ehval', 'Əhval'), sub: tr('partnerv2_sh_ehval_sub', 'Gündəlik əhval-ruhiyyəniz')),
      'share_symptoms' => (icon: AIcons.thermometer, title: tr('partnerv2_sh_simptomlar', 'Simptomlar'), sub: tr('partnerv2_sh_simptomlar_sub', 'Qeyd etdiyiniz simptomlar')),
      'share_water' => (icon: AIcons.droplets, title: tr('partnerv2_sh_su', 'Su qəbulu'), sub: tr('partnerv2_sh_su_sub', 'Günlük su miqdarı və hədəf')),
      'share_kicks' => (icon: AIcons.baby, title: tr('partnerv2_sh_tepikler', 'Təpiklər'), sub: tr('partnerv2_sh_tepikler_sub', 'Təpik sayğacı bildirişləri')),
      'share_contractions' => (icon: AIcons.timer, title: tr('partnerv2_sh_sancilar', 'Sancılar'), sub: tr('partnerv2_sh_sancilar_sub', 'Sancı taymeri və 5-1-1 xəbərdarlığı')),
      'share_weight' => (icon: AIcons.scale, title: tr('partnerv2_sh_ceki', 'Çəki'), sub: tr('partnerv2_sh_ceki_sub', 'Çəki qeydləriniz (standart: bağlı)')),
      'share_appointments' => (icon: AIcons.calendarHeart, title: tr('partnerv2_sh_randevular', 'Randevular'), sub: tr('partnerv2_sh_randevular_sub', 'Həkim vizitləri və xatırlatmalar')),
      'share_baby_logs' => (icon: AIcons.milk, title: tr('partnerv2_sh_korpe', 'Körpə qeydləri'), sub: tr('partnerv2_sh_korpe_sub', 'Yemə, yuxu və bez qeydləri')),
      _ => (icon: AIcons.flower2, title: tr('partnerv2_sh_tsikl', 'Tsikl fazası'), sub: tr('partnerv2_sh_tsikl_sub', 'Faza və növbəti period məlumatı')),
    };

class PartnerSharingScreen extends ConsumerStatefulWidget {
  const PartnerSharingScreen({super.key, required this.onBack, this.onNavigate});
  final VoidCallback onBack;
  final void Function(String screen)? onNavigate;

  @override
  ConsumerState<PartnerSharingScreen> createState() => _PartnerSharingScreenState();
}

class _PartnerSharingScreenState extends ConsumerState<PartnerSharingScreen> {
  String? _open;
  bool _showOthers = false;
  late String _code = ref.read(authProfileProvider)?.partnerCode ?? '';
  bool _sharing = false;

  Future<void> _save(String key, bool value) async {
    final toast = toasts(context);
    final ok = await ref.read(partnerSharingProvider.notifier).updateSetting(key, value);
    if (!ok) toast.show(title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), description: tr('partnerv2_sh_xeta_sub', 'Yenidən cəhd edin.'), destructive: true);
  }

  Future<void> _toggleGroup(SharingGroup group, bool value) async {
    for (final key in groupKeysToSave(group, ref.read(partnerSharingProvider).settings, value)) {
      await _save(key, value);
    }
  }

  Future<String> _freshCode() async {
    final actions = ref.read(accountActionsProvider);
    final next = await actions.partnerCodeForSharing(_code);
    if (mounted) setState(() => _code = next);
    unawaited(actions.refreshProfile());
    return next;
  }

  void _premium() => unawaited(ref.read(premiumPromptProvider).show(context));

  Future<void> _shareInvite() async {
    if (!ref.read(subscriptionIsPremiumProvider)) return _premium();
    final toast = toasts(context);
    setState(() => _sharing = true);
    try {
      final next = await _freshCode();
      await ref.read(shareServiceProvider).share(
            title: tr('profile_partnyor_kodu', 'Partnyor Kodu'),
            text: '${tr('profile_share_partner_text', 'Anacan tətbiqinə qoşul və hamiləlik səyahətimizdə mənə dəstək ol! Partnyor kodum:')} $next\n\n'
                '${tr('profile_download_app', 'Tətbiqi yüklə:')} ${ref.read(appOriginProvider)}',
          );
    } catch (error) {
      toast.show(title: getPartnerLinkErrorMessage(error), destructive: true);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<void> _copyInvite() async {
    if (!ref.read(subscriptionIsPremiumProvider)) return _premium();
    final toast = toasts(context);
    try {
      final next = await _freshCode();
      await Clipboard.setData(ClipboardData(text: next));
      toast.show(title: feature37Text('ph_invite_copied'));
    } catch (error) {
      toast.show(title: getPartnerLinkErrorMessage(error), destructive: true);
    }
  }

  Future<void> _confirmUnlink() => showShadDialog<void>(context, builder: (_) => const _UnlinkDialog());

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sharing = ref.watch(partnerSharingProvider);
    final settings = sharing.settings;
    final profile = ref.watch(authProfileProvider);
    final userId = ref.watch(authUserProvider)?.id;
    final partnerProfile = ref.watch(partnerDataProvider.select((d) => d.partnerProfile));
    final messages = ref.watch(partnerMessagesFeedProvider).messages;
    final isPremium = ref.watch(subscriptionIsPremiumProvider);
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final stage = lifeStage == 'bump' || lifeStage == 'mommy' ? lifeStage! : 'flow';
    final linked = (profile?.linkedPartnerId ?? '').isNotEmpty && partnerProfile != null;
    final mainGroups = kSharingGroups.where((g) => g.stages.contains(stage)).toList();
    final otherGroups = kSharingGroups.where((g) => !g.stages.contains(stage)).toList();
    final week = partnerWeek(messages, userId);
    final disabled = sharing.loading || !sharing.available;
    final onNavigate = widget.onNavigate;

    BoxDecoration card() => BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow);

    final groupStyles = <String, (AIconData, Color, Color)>{
      'mood': (AIcons.smile, a.yellow1, a.yellowInk),
      'cycle': (AIcons.flower2, a.pink1, a.pinkInk),
      'pregnancy': (AIcons.timer, a.lav1, a.lavInk),
      'baby': (AIcons.milk, a.green1, a.greenInk),
      'appointments': (AIcons.calendarHeart, a.blue1, a.blueInk),
      'health': (AIcons.droplets, a.blue1, a.blueInk),
    };

    Widget group(SharingGroup g) {
      final style = groupStyles[g.id]!;
      final on = g.keys.any((k) => settings[k]);
      final all = g.keys.every((k) => settings[k]);
      final expanded = _open == g.id;
      final title = feature37Text('ph_group_${g.id}');
      return Container(
        key: ValueKey('sh-group-${g.id}'),
        clipBehavior: Clip.antiAlias,
        decoration: card(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(children: [
              Expanded(
                child: Semantics(
                  button: true,
                  expanded: expanded,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _open = expanded ? null : g.id),
                    child: Row(children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: style.$2, borderRadius: BorderRadius.circular(13)),
                        child: AIcon(style.$1, size: 17, color: style.$3),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(title, style: pText(13.5, weight: FontWeight.w800, color: a.ink)),
                          Row(children: [
                            AIcon(on ? AIcons.eye : AIcons.eyeOff, size: 11, color: on ? a.inkSoft : a.inkFaint),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(on ? feature37Text('ph_group_${g.id}_preview') : feature37Text('ph_preview_off'),
                                  maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11, color: on ? a.inkSoft : a.inkFaint)),
                            ),
                          ]),
                        ]),
                      ),
                      if (g.keys.length > 1) ...[
                        const SizedBox(width: 12),
                        AnimatedRotation(
                          turns: expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: AIcon(AIcons.chevronDown, size: 15, color: a.inkFaint),
                        ),
                      ],
                    ]),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ShadSwitch(
                key: ValueKey('sh-switch-${g.id}'),
                checked: all,
                disabled: disabled,
                checkedColor: a.peach2,
                semanticLabel: title,
                onChanged: (v) => unawaited(_toggleGroup(g, v)),
              ),
            ]),
          ),
          if (expanded && g.keys.length > 1)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
              child: Column(children: [
                for (final key in g.keys)
                  () {
                    final r = _row(key);
                    return Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(22, 9, 16, 9),
                      child: Row(children: [
                        AIcon(r.icon, size: 15, color: a.inkSoft),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(r.title, style: pText(12.5, weight: FontWeight.w600, color: a.ink)),
                            Text(r.sub, style: pText(10.5, color: a.inkSoft)),
                          ]),
                        ),
                        const SizedBox(width: 12),
                        ShadSwitch(
                          key: ValueKey('sh-switch-$key'),
                          checked: settings[key],
                          disabled: disabled,
                          checkedColor: a.peach2,
                          semanticLabel: r.title,
                          onChanged: (v) => unawaited(_save(key, v)),
                        ),
                      ]),
                    );
                  }(),
              ]),
            ),
        ]),
      );
    }

    List<Widget> spaced(List<Widget> items, double gap) => [
          for (var i = 0; i < items.length; i++) ...[if (i > 0) SizedBox(height: gap), items[i]],
        ];

    final tools = [
      if (stage == 'bump') (screen: 'birth-plan', icon: AIcons.clipboardList, title: feature37Text('pm_birth_plan'), sub: feature37Text('pm_birth_plan_sub')),
      if (stage == 'mommy') (screen: 'night-shift', icon: AIcons.moon, title: feature37Text('pm_night_shift'), sub: feature37Text('pm_night_shift_sub')),
    ];

    final topCard = linked
        ? PartnerCard(
            key: const ValueKey('sh-linked'),
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.gradBlue, shape: BoxShape.circle),
                  child: const Text('👨', style: TextStyle(fontSize: 24, height: 32 / 24)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(partnerProfile.name.isNotEmpty ? partnerProfile.name : tr('common_partnyor', 'Partnyor'),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(16, weight: FontWeight.w900, color: a.ink)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999)),
                      child: Text('● ${feature37Text('ph_linked')}', style: pText(10.5, weight: FontWeight.w800, color: a.greenInk)),
                    ),
                  ]),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 14, bottom: 6),
                child: Text(cssUpper(feature37Text('ph_week')), style: pText(11, weight: FontWeight.w700, color: a.inkFaint, ls: 0.06)),
              ),
              Row(children: [
                for (final (i, s) in [('❤️', week.loves, feature37Text('ph_loves')), ('💬', week.texts, feature37Text('ph_messages'))].indexed) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                      child: Row(children: [
                        Text(s.$1, style: const TextStyle(fontSize: 18, height: 1.5)),
                        const SizedBox(width: 8),
                        Text('${s.$2}', style: pText(17, weight: FontWeight.w900, color: a.ink)),
                        const SizedBox(width: 8),
                        Flexible(child: Text(s.$3, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11, color: a.inkSoft))),
                      ]),
                    ),
                  ),
                ],
              ]),
            ]),
          )
        : PartnerCard(
            key: const ValueKey('sh-invite'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(feature37Text('ph_invite_title'), style: pText(16, weight: FontWeight.w900, color: a.ink)),
              Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 12),
                child: Text(feature37Text('ph_invite_body'), style: pText(12.5, color: a.bodyText)),
              ),
              if (isPremium) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                  child: Text(_code.isNotEmpty ? _code : 'ANACAN-······',
                      key: const ValueKey('sh-code'),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontFamily: 'monospace', fontSize: 18, height: 28 / 18, fontWeight: FontWeight.w700, letterSpacing: 0.05 * 18, color: a.ink)),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: PartnerPillButton(
                      key: const ValueKey('sh-copy'),
                      expand: true,
                      icon: const AIcon(AIcons.copy, size: 15),
                      label: feature37Text('ph_invite_copy'),
                      onTap: () => unawaited(_copyInvite()),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: PartnerPillButton(
                      key: const ValueKey('sh-share'),
                      expand: true,
                      solid: true,
                      icon: _sharing ? const ALoader(size: 15) : const AIcon(AIcons.share2, size: 15),
                      label: feature37Text('ph_invite_share'),
                      onTap: _sharing ? null : () => unawaited(_shareInvite()),
                    ),
                  ),
                ]),
              ] else
                PartnerTap(
                  key: const ValueKey('sh-premium'),
                  scale: 1,
                  onTap: _premium,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(16)),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      AIcon(AIcons.crown, size: 15, color: a.warnInk),
                      const SizedBox(width: 8),
                      Flexible(child: Text(feature37Text('ph_invite_premium'), style: pText(13, weight: FontWeight.w800, color: a.warnInk))),
                    ]),
                  ),
                ),
            ]),
          );

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: tr('partnerv2_siz_idare_edirsiniz', 'Siz idarə edirsiniz'),
      title: feature37Text('ph_title'),
      children: spaced([
        topCard,
        if (linked && tools.isNotEmpty && onNavigate != null)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: spaced([
              for (final t in tools)
                PartnerTap(
                  key: ValueKey('sh-tool-${t.screen}'),
                  scale: 0.98,
                  onTap: () => onNavigate(t.screen),
                  child: Container(
                    padding: const EdgeInsets.all(13),
                    decoration: card(),
                    child: Row(children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(13)),
                        child: AIcon(t.icon, size: 17, color: a.lavInk),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(t.title, style: pText(13.5, weight: FontWeight.w800, color: a.ink)),
                          Text(t.sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11, color: a.inkSoft)),
                        ]),
                      ),
                    ]),
                  ),
                ),
            ], 10),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(feature37Text('ph_what_sees'), style: pText(15, weight: FontWeight.w900, color: a.ink)),
            Padding(padding: const EdgeInsets.only(top: 2), child: Text(feature37Text('ph_sees_sub'), style: pText(11.5, color: a.inkSoft))),
          ]),
        ),
        if (!sharing.available)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
            decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(14)),
            child: Text(tr('partnerv2_sh_migration_yox', 'Ayarlar bazası hazır deyil — hazırda standart paylaşım aktivdir.'),
                style: pText(11.5, weight: FontWeight.w600, color: a.warnInk)),
          ),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: spaced([for (final g in mainGroups) group(g)], 10)),
        Semantics(
          button: true,
          expanded: _showOthers,
          child: GestureDetector(
            key: const ValueKey('sh-more'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _showOthers = !_showOthers),
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(feature37Text('ph_more_groups'), style: pText(12, weight: FontWeight.w700, color: a.inkSoft)),
                const SizedBox(width: 4),
                Transform.rotate(angle: _showOthers ? 3.14159265 : 0, child: AIcon(AIcons.chevronDown, size: 14, color: a.inkSoft)),
              ]),
            ),
          ),
        ),
        if (_showOthers) Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: spaced([for (final g in otherGroups) group(g)], 10)),
        if (onNavigate != null)
          GestureDetector(
            key: const ValueKey('sh-notifications'),
            behavior: HitTestBehavior.opaque,
            onTap: () => onNavigate('partner-notifications'),
            child: Container(
              padding: const EdgeInsets.all(13),
              decoration: card(),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(13)),
                  child: AIcon(AIcons.bell, size: 17, color: a.blueInk),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(feature37Text('pn_title'), style: pText(13.5, weight: FontWeight.w800, color: a.ink))),
                AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
              ]),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(16)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.shieldCheck, size: 15, color: a.disclaimerStrong)),
            const SizedBox(width: 10),
            Expanded(child: Text(feature37Text('ph_never'), style: pText(11.5, color: a.disclaimerInk))),
          ]),
        ),
        if (linked)
          PartnerTap(
            key: const ValueKey('sh-unlink'),
            scale: 0.98,
            onTap: () => unawaited(_confirmUnlink()),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(13)),
                  child: AIcon(AIcons.unlink, size: 17, color: a.alertInk),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('partnerv2_baglantini_kes', 'Bağlantını kəs'), style: pText(13.5, weight: FontWeight.w700, color: a.alertInk)),
                    Text(tr('partnerv2_baglantini_kes_sub', 'Partnyor bütün girişini itirəcək'), style: pText(11, color: a.alertSoft)),
                  ]),
                ),
              ]),
            ),
          ),
      ], 14),
    );
  }
}

class _UnlinkDialog extends ConsumerStatefulWidget {
  const _UnlinkDialog();
  @override
  ConsumerState<_UnlinkDialog> createState() => _UnlinkDialogState();
}

class _UnlinkDialogState extends ConsumerState<_UnlinkDialog> {
  bool _busy = false;

  Future<void> _unlink() async {
    final toast = toasts(context);
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(unlinkPartnersProvider)();
      toast.show(title: tr('partnerv2_baglanti_kesildi', 'Bağlantı kəsildi'), description: tr('partnerv2_baglanti_kesildi_sub', 'Partnyor artıq məlumatlarınızı görmür.'));
      nav.maybePop();
      unawaited(ref.read(afterUnlinkProvider)());
    } catch (error) {
      debugPrint('unlink_partners: $error');
      toast.show(title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), destructive: true);
      if (mounted) setState(() => _busy = false);
      nav.maybePop();
    }
  }

  @override
  Widget build(BuildContext context) => ShadDialogFrame(radius: 22, inset: 16, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${tr('partnerv2_baglantini_kes', 'Bağlantını kəs')}?', style: shadTitle(context).copyWith(color: context.a.alertInk)),
          const SizedBox(height: 6),
          Text(
            tr('partnerv2_unlink_tesdiq_izah',
                'Partnyorunuz artıq heç bir məlumatınızı görməyəcək və partnyor paneli bağlanacaq. Yenidən bağlanmaq üçün kodu təkrar paylaşmalısınız.'),
            style: shadDescription(context),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(children: [
            Expanded(
              child: ShadButton(
                pill: true,
                expand: true,
                variant: ShadButtonVariant.outline,
                onPressed: () => Navigator.of(context).maybePop(),
                child: Text(tr('common_legv_et', 'Ləğv et')),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ShadButton(
                key: const ValueKey('sh-unlink-confirm'),
                pill: true,
                expand: true,
                variant: ShadButtonVariant.destructive,
                onPressed: _busy ? null : () => unawaited(_unlink()),
                child: _busy ? ALoader(size: 16, color: context.tokens.shadcn.destructiveForeground) : Text(tr('partnerv2_beli_kes', 'Bəli, kəs')),
              ),
            ),
          ]),
        ),
      ]);
}
