// Ported from: src/components/pregnancy-loss/RecoveryHome.tsx
//
// Home during pregnancy loss recovery: no pregnancy, fertility or shopping content. A gentle week card, a mood
// check-in (saved to the daily log, so the partner can see it when she shares her mood), the "see a doctor now"
// signs, and quiet links to the guide, a body check, AI, mood tests and memories.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../../tools/health_common/health_common.dart' show dailyLogActionsProvider, dailyLogsViewProvider;
import '../../tools/pregnancy_common/pregnancy_ports.dart' show pregnancyHapticsProvider;
import 'loss_ui.dart';
import 'pregnancy_loss.dart';
import 'ready_choices.dart';

const List<String> _moodEmoji = ['😣', '😔', '😶', '😌', '🙂'];

class RecoveryHome extends ConsumerWidget {
  const RecoveryHome({super.key, this.onNavigate, this.onNavigateToTool, this.onOpenAssistant});
  final void Function(String screen)? onNavigate;
  final void Function(String tool)? onNavigateToTool;
  final VoidCallback? onOpenAssistant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = ref.watch(pregnancyLossTextProvider);
    final t = text.sub('ui');
    final profile = ref.watch(authProfileProvider);
    final todayLog = ref.watch(dailyLogsViewProvider).todayLog;
    final week = lossWeek(profile?.pregnancyLossDate);
    final weeks = text.items('weeks');
    final w = weeks[(week ?? lossRecoveryWeeks) - 1];
    final moodRaw = todayLog?['mood'];
    final mood = moodRaw is num ? moodRaw.toInt() : null;
    final a = context.a;
    final l = LossTokens.of(context);

    Future<void> pickMood(int value) async {
      await ref.read(pregnancyHapticsProvider).light();
      await ref.read(dailyLogActionsProvider).updateMood(value);
    }

    Widget link(AIconData icon, String title, String sub, VoidCallback onTap) => LossCard(
          tapScale: 0.98,
          onTap: onTap,
          child: Row(children: [
            LossRowIcon(icon: icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: lossRowTitle(context)),
                Text(sub, style: lossRowSub(context)),
              ]),
            ),
            const SizedBox(width: 12),
            AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
          ]),
        );

    final moods = t.list('moods');
    final replies = t.list('mood_reply');
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: lossStack([
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 2, 4, 4),
          child: Text('${t.s('home_title')} 🤍', style: px(22, weight: FontWeight.w900, color: a.ink, height: 1.25, ls: -0.01)),
        ),
        LossCard(
          tapScale: 0.99,
          onTap: () => onNavigate?.call('loss-guide'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(week != null ? t.s('home_week').replaceFirst('{n}', '$week') : t.s('home_done'), style: lossTag(context)),
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 5, 0, 9),
              child: Text(week != null ? w.s('title') : t.s('home_done'), style: px(16, weight: FontWeight.w900, color: a.ink)),
            ),
            LossBar(fraction: (week ?? lossRecoveryWeeks) / lossRecoveryWeeks),
            Padding(padding: const EdgeInsets.only(top: 9), child: Text(week != null ? w.s('body') : t.s('home_done_body'), style: lossBody(context))),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(t.s('home_open_week'), style: px(13, weight: FontWeight.w800, color: l.accentInk)),
                const SizedBox(width: 4),
                AIcon(AIcons.chevronRight, size: 14, color: l.accentInk, mirrorInRtl: true),
              ]),
            ),
          ]),
        ),
        LossCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Semantics(header: true, child: Text(t.s('mood_title'), style: px(15, weight: FontWeight.w900, color: a.ink))),
            ),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < moods.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: mood == i + 1,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => unawaited(pickMood(i + 1)),
                      child: Column(children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 46,
                          height: 46,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: mood == i + 1 ? l.accent : l.soft, borderRadius: BorderRadius.circular(15)),
                          child: Text(i < _moodEmoji.length ? _moodEmoji[i] : '', style: const TextStyle(fontSize: 22, height: 1.2)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          moods[i],
                          textAlign: TextAlign.center,
                          style: px(10.5, weight: mood == i + 1 ? FontWeight.w800 : FontWeight.w600, color: a.inkSoft, height: 1.2),
                        ),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
            if (mood != null && replies.isNotEmpty)
              Container(
                key: ValueKey('mood:$mood'),
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(14)),
                child: Text(replies[(mood - 1).clamp(0, 4)], style: lossBody(context)),
              ),
          ]),
        ),
        Semantics(container: true, child: LossAlert(title: t.s('warn_title'), body: t.s('warn_body'))),
        link(AIcons.clipboardCheck, t.s('check_title'), t.s('check_sub'), () => onNavigate?.call('loss-guide/signs')),
        if (onOpenAssistant != null) link(AIcons.messageCircleHeart, t.s('talk_title'), t.s('talk_sub'), onOpenAssistant!),
        link(AIcons.stethoscope, t.s('epds_title'), t.s('epds_sub'), () => onNavigateToTool?.call('mental-health')),
        link(AIcons.notebookPen, t.s('diary_title'), t.s('diary_sub'), () => onNavigateToTool?.call('mood-diary')),
        link(AIcons.folderHeart, t.s('memories_title'), t.s('memories_sub'), () => onNavigate?.call('loss-memories')),
        if (week == null) ReadyChoices(text: text, onNavigate: onNavigate),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Text(t.s('disclaimer'), textAlign: TextAlign.center, style: px(11, color: a.inkFaint)),
        ),
      ]),
    );
  }
}
