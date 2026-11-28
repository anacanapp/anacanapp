// Ported from: src/components/pregnancy-loss/PartnerLossSupportScreen.tsx, src/components/pregnancy-loss/PartnerLossCard.tsx
//
// The partner's guide after a pregnancy loss: what she goes through now (four two-week phases), what to say and
// avoid with one-tap messages, "today I take care of" tasks sent to her, his own grief, and a warning-sign check.
// A low-mood note appears when she shares her mood. Also the partner home's entry card. The text, the loss
// palette / kit and the signs checker come from the pregnancy-loss port (features/health_screens/loss/).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../health_screens/common/feature_text.dart' show FeatureText;
import '../../health_screens/loss/loss_signs_checker.dart';
import '../../health_screens/loss/loss_ui.dart';
import '../../health_screens/loss/pregnancy_loss.dart' show lossPhase, lossRecoveryWeeks, lossWeek, pregnancyLossText;
import '../../settings/ui/settings_ui.dart' show FadeRise, toasts;
import '../data/partner_data.dart';
import '../data/partner_family.dart';
import '../partner_ports.dart';
import '../ui/partner_ui.dart';
import 'support_ui.dart';

FeatureText _text(String language) => pregnancyLossText(language.isEmpty ? 'az' : language);

/// `usePregnancyLossText(language)` for the partner home slot (`text.ui.p_hero_label`, `text.chips`).
PartnerLossText partnerLossTextFor(String language) {
  final text = _text(language);
  return PartnerLossText(heroLabel: text.sub('ui').s('p_hero_label'), chips: text.list('chips'));
}

/// `--loss-hero` (pregnancy-loss.css:4 / :17).
Gradient _lossHero(BuildContext context) => context.tokens.isDark
    ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2C2540), Color(0xFF3A2D58)])
    : const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFF3ECFF), Color(0xFFE3D4FB)]);

/// Partner home: the entry to the loss support guide, shown only when she chose to share it.
class PartnerLossCard extends ConsumerWidget {
  const PartnerLossCard({super.key, required this.lossDate, required this.onOpen});
  final String? lossDate;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = LossTokens.of(context);
    final t = _text(ref.watch(userStoreProvider.select((s) => s.language))).sub('ui');
    final week = lossWeek(lossDate);
    return FadeRise(
      dy: 12,
      child: PartnerTap(
        key: const ValueKey('partner-loss-card'),
        scale: 0.99,
        onTap: onOpen,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: _lossHero(context),
            borderRadius: BorderRadius.circular(context.a.radiusMd),
            // 0 14px 30px -18px rgba(120, 90, 170, 0.45) (PartnerLossCard.tsx:16)
            boxShadow: const [BoxShadow(color: Color(0x73785AAA), offset: Offset(0, 14), blurRadius: 30, spreadRadius: -18)],
          ),
          child: Row(children: [
            Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xB3FFFFFF), borderRadius: BorderRadius.circular(16)),
              child: const ExcludeSemantics(child: Text('🤍', style: TextStyle(fontSize: 22, height: 1.5))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.s('p_card_title'), style: pText(15, weight: FontWeight.w900, color: l.accentInk)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Opacity(
                    opacity: 0.85,
                    child: Text(week != null ? t.s('p_card_sub').replaceFirst('{n}', '$week') : t.s('p_sub'), style: pText(12, color: l.accentInk)),
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 12),
            AIcon(AIcons.chevronRight, size: 18, color: l.accentInk, mirrorInRtl: true),
          ]),
        ),
      ),
    );
  }
}

/// `<Card icon title>`: a `.loss-card` with the 30px `.loss-row-icon` and a 14px title.
class _Card extends StatelessWidget {
  const _Card({required this.icon, required this.title, required this.children});
  final AIconData icon;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LossCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              LossRowIcon(icon: icon, size: 30, radius: 10),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: pText(14, weight: FontWeight.w900, color: context.a.ink))),
            ]),
          ),
          ...children,
        ]),
      );
}

class PartnerLossSupportScreen extends ConsumerStatefulWidget {
  const PartnerLossSupportScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnerLossSupportScreen> createState() => _PartnerLossSupportScreenState();
}

class _PartnerLossSupportScreenState extends ConsumerState<PartnerLossSupportScreen> {
  int? _phase;
  String _tab = 'now';
  String? _sent;
  List<String> _tasks = const [];
  bool _sending = false;

  Future<bool> _send(String content, String errorTitle) async {
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
      toast.show(title: errorTitle, destructive: true);
      return false;
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final l = LossTokens.of(context);
    final text = _text(ref.watch(userStoreProvider.select((s) => s.language)));
    final data = ref.watch(partnerDataProvider);
    final shareMood = data.sharing.shareMood;
    final lowDays = ref.watch(partnerRecentMoodsProvider((7, shareMood))).lowDays;
    final week = lossWeek(data.partnerProfile?.pregnancyLossDate) ?? lossRecoveryWeeks;
    final shownPhase = _phase ?? lossPhase(week);
    final t = text.sub('ui');
    final p = text.sub('partner');
    final phases = p.items('phases');
    final ph = phases[shownPhase.clamp(0, phases.length - 1)];
    final body = lossBody(context);

    Widget bullets(List<String> items) => SupportBullets(items: items, style: body, dotColor: l.accent);

    Widget chip(String label, bool on, VoidCallback onTap, Key key, {EdgeInsets? padding, Color? offColor}) => Semantics(
          button: true,
          toggled: on,
          child: GestureDetector(
            key: key,
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: Container(
              padding: padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              alignment: padding == null ? null : Alignment.center,
              decoration: BoxDecoration(color: on ? l.accent : (offColor ?? a.surface), borderRadius: BorderRadius.circular(999)),
              child: Text(label, textAlign: TextAlign.center, style: pText(12, weight: FontWeight.w800, color: on ? const Color(0xFFFFFFFF) : a.ink)),
            ),
          ),
        );

    Future<void> sendTasks() async {
      final toast = toasts(context);
      if (await _send(t.s('p_tasks_message').replaceFirst('{list}', _tasks.join(', ')), t.s('sheet_error'))) {
        if (mounted) setState(() => _tasks = const []);
        toast.show(title: t.s('p_sent'));
      }
    }

    Future<void> sendLine(String line) async {
      final toast = toasts(context);
      if (await _send(line, t.s('sheet_error'))) {
        if (mounted) setState(() => _sent = line);
        toast.show(title: t.s('p_sent'));
      }
    }

    final List<Widget> content = switch (_tab) {
      'now' => [
          lossStack([
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(gradient: _lossHero(context), borderRadius: BorderRadius.circular(a.radiusMd)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(t.s('p_intro_title'), style: pText(16, weight: FontWeight.w900, color: l.accentInk))),
                Text(t.s('p_intro_body'), style: body),
              ]),
            ),
            Row(children: [
              for (var i = 0; i < phases.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: chip(
                    t.s('p_phase').replaceFirst('{a}', '${i * 2 + 1}').replaceFirst('{b}', '${i * 2 + 2}'),
                    shownPhase == i,
                    () => setState(() => _phase = i),
                    ValueKey('loss-phase-$i'),
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  ),
                ),
              ],
            ]),
            _Card(icon: AIcons.heartHandshake, title: ph.s('title'), children: [Text(ph.s('body'), style: body)]),
            _Card(icon: AIcons.listChecks, title: t.s('p_what_do'), children: [bullets(ph.list('do'))]),
            _Card(icon: AIcons.listChecks, title: t.s('p_tasks_title'), children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t.s('p_tasks_sub'), style: lossRowSub(context))),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final (i, task) in p.list('tasks').indexed)
                  chip(
                    task,
                    _tasks.contains(task),
                    () => setState(() => _tasks = _tasks.contains(task) ? _tasks.where((x) => x != task).toList() : [..._tasks, task]),
                    ValueKey('loss-task-$i'),
                    offColor: l.soft,
                  ),
              ]),
              const SizedBox(height: 12),
              LossButton(
                key: const ValueKey('loss-tasks-send'),
                label: t.s('p_tasks_send'),
                padding: 11,
                fontSize: 13.5,
                onTap: _tasks.isEmpty || _sending ? null : () => unawaited(sendTasks()),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(t.s('p_hidden_note'), textAlign: TextAlign.center, style: lossRowSub(context)),
            ),
          ]),
        ],
      'say' => [
          lossStack([
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    AIcon(AIcons.thumbsUp, size: 14, color: a.greenInk),
                    const SizedBox(width: 6),
                    Expanded(child: Text(t.s('p_say_title'), style: pText(13.5, weight: FontWeight.w900, color: a.greenInk))),
                  ]),
                ),
                for (final (i, s) in p.list('say').indexed) ...[
                  if (i > 0) const SizedBox(height: 4),
                  Text('“$s”', style: pText(13, color: a.greenInk, height: 1.45)),
                ],
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    AIcon(AIcons.thumbsDown, size: 14, color: a.alertInk),
                    const SizedBox(width: 6),
                    Expanded(child: Text(t.s('p_avoid_title'), style: pText(13.5, weight: FontWeight.w900, color: a.alertInk))),
                  ]),
                ),
                for (final (i, s) in p.list('avoid').indexed) ...[
                  if (i > 0) const SizedBox(height: 4),
                  Text(s, style: pText(13, color: a.alertInk, height: 1.45)),
                ],
              ]),
            ),
            _Card(icon: AIcons.messageCircleHeart, title: t.s('p_phrases_title'), children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t.s('p_phrases_sub'), style: lossRowSub(context))),
              for (final (i, line) in p.list('phrases').indexed) ...[
                if (i > 0) const SizedBox(height: 8),
                SupportPhraseRow(
                  key: ValueKey('loss-phrase-$i'),
                  text: line,
                  sent: _sent == line,
                  disabled: _sending,
                  sendLabel: t.s('p_send'),
                  background: l.soft,
                  onSend: () => unawaited(sendLine(line)),
                ),
              ],
            ]),
          ]),
        ],
      'you' => [
          _Card(icon: AIcons.user, title: p.s('you_title'), children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(p.s('you_body'), style: body)),
            bullets(p.list('you_tips')),
          ]),
        ],
      _ => [LossSignsChecker(text: text, forPartner: true)],
    };

    final tabs = [('now', t.s('p_tab_now')), ('say', t.s('p_tab_say')), ('you', t.s('p_tab_you')), ('signs', t.s('p_tab_signs'))];

    return LossPage(
      onBack: widget.onBack,
      backLabel: t.s('back'),
      eyebrow: t.s('p_sub'),
      title: '${t.s('p_title')} 🤍',
      children: [
        if (shareMood && lowDays >= 3) ...[
          SupportLowMoodNote(title: t.s('p_mood_low_title'), body: '${t.s('p_mood_low_body').replaceFirst('{n}', '$lowDays')} ${t.s('p_mood_low_long')}'),
          const SizedBox(height: 12),
        ],
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final (i, tab) in tabs.indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              LossChip(key: ValueKey('loss-tab-${tab.$1}'), label: tab.$2, selected: _tab == tab.$1, onTap: () => setState(() => _tab = tab.$1)),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        ...content,
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
          child: Text(t.s('disclaimer'), textAlign: TextAlign.center, style: pText(11, color: a.inkFaint)),
        ),
      ],
    );
  }
}
