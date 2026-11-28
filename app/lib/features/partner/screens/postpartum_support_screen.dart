// Ported from: src/components/partner/v2/PostpartumSupportScreen.tsx
//
// "İlk 8 həftə": the partner's guide for the weeks after the birth — what she goes through, what to do and say,
// baby blues vs postnatal depression, a warning-sign check and one-tap support messages.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper, toasts;
import '../data/partner_content.dart';
import '../data/partner_data.dart';
import '../data/partner_family.dart';
import '../partner_ports.dart';
import '../ui/partner_ui.dart';
import 'screens_ui.dart';
import 'support_ui.dart';

/// The local emergency number of the translated `signs_urgent` text (112, 119, 120, ...).
String postpartumEmergencyNumber(String signsUrgent) => RegExp(r'\b\d{3}\b').firstMatch(signsUrgent)?.group(0) ?? '112';

class PostpartumSupportScreen extends ConsumerStatefulWidget {
  const PostpartumSupportScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PostpartumSupportScreen> createState() => _PostpartumSupportScreenState();
}

class _PostpartumSupportScreenState extends ConsumerState<PostpartumSupportScreen> {
  int? _picked;
  String _tab = 'week';
  String? _sent;
  List<String> _tasks = const [];
  List<String> _signs = const [];
  bool _sending = false;

  Future<bool> _send(String content) async {
    final profile = ref.read(authProfileProvider);
    final her = ref.read(partnerDataProvider).partnerProfile;
    if (profile == null || her == null || _sending) return false;
    final toast = toasts(context);
    setState(() => _sending = true);
    try {
      await ref.read(partnerHapticsProvider).medium();
      await ref.read(partnerChatSenderProvider)(profile.userId, her.userId, content);
      return true;
    } catch (_) {
      toast.show(title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), destructive: true);
      return false;
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendLine(String line, String sentTitle) async {
    final toast = toasts(context);
    if (await _send(line)) {
      if (mounted) setState(() => _sent = line);
      toast.show(title: sentTitle);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final text = postpartumPartnerText(language.isEmpty ? 'az' : language);
    final data = ref.watch(partnerDataProvider);
    final lowDays = ref.watch(partnerRecentMoodsProvider((7, data.sharing.shareMood))).lowDays;
    final current = postpartumWeek(data.getBabyAgeDays()) ?? kPostpartumWeeks;
    final week = _picked ?? current;
    String t(String key) => text.ui(key);
    final weeks = text.weeks;
    final w = weeks[(week - 1).clamp(0, weeks.length - 1)];
    final blues = text.blues;
    List<String> list(String key) => [for (final s in (blues[key] as List? ?? const [])) '$s'];
    String b(String key) => '${blues[key] ?? ''}';
    final urgentSigns = list('urgent_signs');
    final ppdSigns = list('ppd_signs');
    final urgentPicked = _signs.any(urgentSigns.contains);
    final emergency = postpartumEmergencyNumber(t('signs_urgent'));

    BoxDecoration card([Gradient? gradient, Color? color]) =>
        BoxDecoration(color: gradient == null ? (color ?? a.surface) : null, gradient: gradient, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow);
    final body = pText(13.5, color: a.bodyText, height: 1.55);

    Widget sectionCard(AIconData icon, Color tintBg, Color tintInk, String title, List<Widget> children) => Container(
          padding: const EdgeInsets.all(16),
          decoration: card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: tintBg, borderRadius: BorderRadius.circular(10)),
                  child: AIcon(icon, size: 15, color: tintInk),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: pText(14, weight: FontWeight.w900, color: a.ink))),
              ]),
            ),
            ...children,
          ]),
        );

    Widget bullets(List<String> items) => SupportBullets(items: items, style: body, dotColor: a.inkFaint);

    List<Widget> spaced(List<Widget> items) => [
          for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(height: 12), items[i]],
        ];

    final tabs = [('week', t('tab_week')), ('blues', t('tab_blues')), ('signs', t('tab_signs')), ('support', t('tab_support'))];

    final List<Widget> content = switch (_tab) {
      'week' => spaced([
          Row(children: [
            for (var n = 1; n <= kPostpartumWeeks; n++) ...[
              if (n > 1) const SizedBox(width: 4),
              Expanded(
                child: Semantics(
                  button: true,
                  toggled: week == n,
                  label: t('week').replaceFirst('{n}', '$n'),
                  excludeSemantics: true,
                  child: GestureDetector(
                    key: ValueKey('pp-week-$n'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _picked = n),
                    child: Container(
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: week == n ? a.peach2 : (n == current ? a.peach1 : a.surface), borderRadius: BorderRadius.circular(12)),
                      child: Text('$n', style: pText(13, weight: FontWeight.w900, color: week == n ? const Color(0xFFFFFFFF) : a.ink)),
                    ),
                  ),
                ),
              ),
            ],
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(cssUpper(t('week').replaceFirst('{n}', '$week')), style: pText(11, weight: FontWeight.w800, color: a.inkFaint, ls: 0.06)),
              Text(w.title, style: pText(19, weight: FontWeight.w900, color: a.ink, ls: -0.01)),
            ]),
          ),
          sectionCard(AIcons.heart, a.pink1, a.pinkInk, t('her_body'), [Text(w.body, style: body)]),
          sectionCard(AIcons.brain, a.lav1, a.lavInk, t('her_mind'), [Text(w.mind, style: body)]),
          sectionCard(AIcons.listChecks, a.green1, a.greenInk, t('you_do'), [bullets(w.doList)]),
          sectionCard(AIcons.messageCircleHeart, a.blue1, a.blueInk, t('you_say'), [
            for (final (i, line) in w.say.indexed) ...[
              if (i > 0) const SizedBox(height: 8),
              SupportPhraseRow(
                key: ValueKey('pp-say-$i'),
                text: '“$line”',
                sent: _sent == line,
                disabled: _sending,
                sendLabel: t('send'),
                onSend: () => unawaited(_sendLine(line, t('sent'))),
              ),
            ],
          ]),
          sectionCard(AIcons.ban, a.yellow1, a.yellowInk, t('avoid'), [Text(w.avoid, style: body)]),
        ]),
      'blues' => spaced([
          sectionCard(AIcons.heart, a.pink1, a.pinkInk, b('title'), [Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(b('intro'), style: body)), bullets(list('facts'))]),
          sectionCard(AIcons.listChecks, a.green1, a.greenInk, b('help_title'), [bullets(list('help'))]),
          sectionCard(AIcons.brain, a.lav1, a.lavInk, b('ppd_title'), [
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(b('ppd_intro'), style: body)),
            bullets(ppdSigns),
            Padding(padding: const EdgeInsets.only(top: 8), child: Text(b('ppd_action'), style: body.copyWith(fontWeight: FontWeight.w700, color: a.ink))),
          ]),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: card(a.alertBg),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  AIcon(AIcons.triangleAlert, size: 17, color: a.alertInk),
                  const SizedBox(width: 8),
                  Expanded(child: Text(b('urgent_title'), style: pText(14, weight: FontWeight.w900, color: a.alertInk))),
                ]),
              ),
              bullets(urgentSigns),
              Padding(padding: const EdgeInsets.only(top: 8), child: Text(b('urgent_action'), style: pText(13, weight: FontWeight.w800, color: a.alertInk))),
            ]),
          ),
          sectionCard(AIcons.heartHandshake, a.blue1, a.blueInk, b('self_title'), [bullets(list('self'))]),
        ]),
      'signs' => spaced([
          Container(
            padding: const EdgeInsets.all(16),
            decoration: card(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(t('signs_title'), style: pText(14, weight: FontWeight.w900, color: a.ink)),
              Padding(padding: const EdgeInsets.only(top: 2, bottom: 10), child: Text(t('signs_sub'), style: pText(12, color: a.inkSoft))),
              for (final (i, sign) in [...ppdSigns, ...urgentSigns].indexed) ...[
                if (i > 0) const SizedBox(height: 6),
                () {
                  final on = _signs.contains(sign);
                  final urgent = urgentSigns.contains(sign);
                  return Semantics(
                    button: true,
                    toggled: on,
                    child: GestureDetector(
                      key: ValueKey('pp-sign-$i'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _signs = on ? _signs.where((s) => s != sign).toList() : [..._signs, sign]),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: on ? (urgent ? null : a.lav1) : a.surfaceSoft,
                          gradient: on && urgent ? a.alertBg : null,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(children: [
                          Container(
                            width: 20,
                            height: 20,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: on ? a.ink : const Color(0x00000000),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: a.lineStrong, width: 1.5),
                            ),
                            child: on ? AIcon(AIcons.check, size: 12, color: a.surface) : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(sign, style: pText(13, weight: FontWeight.w600, color: urgent ? a.alertInk : a.ink))),
                        ]),
                      ),
                    ),
                  );
                }(),
              ],
            ]),
          ),
          Semantics(
            liveRegion: true,
            child: Container(
              key: const ValueKey('pp-signs-result'),
              padding: const EdgeInsets.all(16),
              decoration: urgentPicked ? card(a.alertBg) : card(null, _signs.isNotEmpty ? a.yellow1 : a.green1),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(
                  urgentPicked ? t('signs_urgent') : (_signs.isNotEmpty ? t('signs_some') : t('signs_none')),
                  style: pText(13.5, weight: FontWeight.w800, color: urgentPicked ? a.alertInk : (_signs.isNotEmpty ? a.warnInk : a.greenInk)),
                ),
                if (urgentPicked) ...[
                  const SizedBox(height: 10),
                  SupportCallButton(key: const ValueKey('pp-call'), number: emergency, label: emergency),
                ],
              ]),
            ),
          ),
        ]),
      _ => spaced([
          Container(
            padding: const EdgeInsets.all(16),
            decoration: card(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(t('tasks_title'), style: pText(14, weight: FontWeight.w900, color: a.ink)),
              Padding(padding: const EdgeInsets.only(top: 2, bottom: 10), child: Text(t('tasks_sub'), style: pText(12, color: a.inkSoft))),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final (i, task) in text.tasks.indexed)
                  () {
                    final on = _tasks.contains(task);
                    return PartnerTap(
                      key: ValueKey('pp-task-$i'),
                      scale: 1,
                      onTap: () => setState(() => _tasks = on ? _tasks.where((x) => x != task).toList() : [..._tasks, task]),
                      child: Semantics(
                        toggled: on,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(color: on ? a.greenInk : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            if (on) ...[AIcon(AIcons.check, size: 13, color: a.surface), const SizedBox(width: 4)],
                            Flexible(child: Text(task, style: pText(12.5, weight: FontWeight.w700, color: on ? a.surface : a.ink))),
                          ]),
                        ),
                      ),
                    );
                  }(),
              ]),
              const SizedBox(height: 12),
              PartnerPillButton(
                key: const ValueKey('pp-tasks-send'),
                solid: true,
                expand: true,
                icon: const AIcon(AIcons.send, size: 15),
                label: t('tasks_send'),
                onTap: _tasks.isEmpty || _sending
                    ? null
                    : () async {
                        final toast = toasts(context);
                        if (await _send(t('tasks_message').replaceFirst('{list}', _tasks.join(', ')))) {
                          if (mounted) setState(() => _tasks = const []);
                          toast.show(title: t('sent'));
                        }
                      },
              ),
            ]),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: card(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(t('phrases_title'), style: pText(14, weight: FontWeight.w900, color: a.ink)),
              Padding(padding: const EdgeInsets.only(top: 2, bottom: 10), child: Text(t('phrases_sub'), style: pText(12, color: a.inkSoft))),
              for (final (i, line) in text.phrases.indexed) ...[
                if (i > 0) const SizedBox(height: 8),
                Semantics(
                  button: true,
                  enabled: !_sending,
                  child: GestureDetector(
                    key: ValueKey('pp-phrase-$i'),
                    behavior: HitTestBehavior.opaque,
                    onTap: _sending ? null : () => unawaited(_sendLine(line, t('sent'))),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                      child: Row(children: [
                        Expanded(child: Text(line, style: pText(13, weight: FontWeight.w600, color: a.ink))),
                        const SizedBox(width: 8),
                        _sent == line ? AIcon(AIcons.check, size: 15, color: a.greenInk) : AIcon(AIcons.send, size: 14, color: a.inkFaint),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
          ),
        ]),
    };

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: t('subtitle'),
      title: '${t('title')} 💛',
      children: [
        if (lowDays >= 3) ...[
          SupportLowMoodNote(
            title: t('mood_low_title'),
            body: '${t('mood_low_body').replaceFirst('{n}', '$lowDays')} ${t('mood_low_long')}',
          ),
          const SizedBox(height: 12),
        ],
        SupportTabs(
          selected: _tab,
          onChanged: (id) => setState(() => _tab = id),
          tabs: tabs,
          keyPrefix: 'pp-tab',
          style: SupportTabStyle.ink,
        ),
        const SizedBox(height: 12),
        ...content,
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Text(t('disclaimer'), textAlign: TextAlign.center, style: pText(11, color: a.inkFaint)),
        ),
      ],
    );
  }
}
