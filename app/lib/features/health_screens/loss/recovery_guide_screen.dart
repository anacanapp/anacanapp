// Ported from: src/components/pregnancy-loss/RecoveryGuideScreen.tsx
//
// The mother's 8-week recovery guide: what her body and feelings go through each week, a small self-care checklist
// (kept on the device), a body check with warning signs, and honest answers to common questions.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/ui/settings_ui.dart' show px;
import 'loss_signs_checker.dart';
import 'loss_ui.dart';
import 'pregnancy_loss.dart';

/// 'week' | 'signs' | 'faq'.
typedef LossGuideTab = String;

class RecoveryGuideScreen extends ConsumerStatefulWidget {
  const RecoveryGuideScreen({super.key, required this.onBack, this.initialTab = 'week'});
  final VoidCallback onBack;
  final LossGuideTab initialTab;
  @override
  ConsumerState<RecoveryGuideScreen> createState() => _RecoveryGuideScreenState();
}

class _RecoveryGuideScreenState extends ConsumerState<RecoveryGuideScreen> {
  int? _picked;
  late LossGuideTab _tab = widget.initialTab;
  int? _open = 0;
  String? _todosUser;
  Map<String, bool> _todos = {};

  @override
  Widget build(BuildContext context) {
    final text = ref.watch(pregnancyLossTextProvider);
    final t = text.sub('ui');
    final userId = ref.watch(authUserProvider)?.id ?? 'local';
    final store = ref.watch(localStoreProvider);
    if (_todosUser != userId) {
      _todosUser = userId;
      _todos = loadLossTodos(store, userId);
    }
    final current = lossWeek(ref.watch(authProfileProvider)?.pregnancyLossDate) ?? lossRecoveryWeeks;
    final week = _picked ?? current;
    final w = text.items('weeks')[week - 1];
    final a = context.a;
    final l = LossTokens.of(context);
    const white = Color(0xFFFFFFFF);

    void toggleTodo(int i) {
      final key = '$week:$i';
      final next = {..._todos, key: !(_todos[key] ?? false)};
      setState(() => _todos = next);
      saveLossTodos(store, userId, next);
    }

    Widget section(AIconData icon, String title, Widget child) => LossCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(children: [
                LossRowIcon(icon: icon, size: 30, radius: 10),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: px(14, weight: FontWeight.w900, color: a.ink))),
              ]),
            ),
            child,
          ]),
        );

    final tabs = <(LossGuideTab, String)>[('week', t.s('tab_week')), ('signs', t.s('tab_signs')), ('faq', t.s('tab_faq'))];
    final children = <Widget>[
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (var i = 0; i < tabs.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              LossChip(label: tabs[i].$2, selected: _tab == tabs[i].$1, onTap: () => setState(() => _tab = tabs[i].$1)),
            ],
          ]),
        ),
      ),
    ];

    if (_tab == 'week') {
      final todo = w.list('todo');
      children.add(lossStack([
        Row(children: [
          for (var n = 1; n <= lossRecoveryWeeks; n++) ...[
            if (n > 1) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                button: true,
                selected: week == n,
                label: t.s('week').replaceFirst('{n}', '$n'),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _picked = n),
                  child: Container(
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: week == n ? l.accent : (n < current ? l.soft : a.surface),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: ExcludeSemantics(
                      child: Text('$n',
                          style: px(13, weight: FontWeight.w900, color: week == n ? white : (n < current ? l.accentInk : a.inkSoft), height: 1)),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t.s('week').replaceFirst('{n}', '$week'), style: lossTag(context)),
            Text(w.s('title'), style: px(19, weight: FontWeight.w900, color: a.ink, ls: -0.01)),
          ]),
        ),
        section(AIcons.heartPulse, t.s('your_body'), Text(w.s('body'), style: lossBody(context))),
        section(AIcons.brain, t.s('your_mind'), Text(w.s('mind'), style: lossBody(context))),
        section(
          AIcons.listChecks,
          t.s('for_you'),
          lossStack(gap: 6, [
            for (var i = 0; i < todo.length; i++)
              () {
                final done = _todos['$week:$i'] ?? false;
                return Semantics(
                  checked: done,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => toggleTodo(i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: done ? l.accent : null,
                            border: done ? null : Border.all(color: a.lineStrong, width: 1.5),
                          ),
                          child: done ? const AIcon(AIcons.check, size: 13, color: white, strokeWidth: 3) : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Opacity(
                            opacity: done ? 0.6 : 1,
                            child: Text(todo[i], style: lossBody(context).copyWith(decoration: done ? TextDecoration.lineThrough : null)),
                          ),
                        ),
                      ]),
                    ),
                  ),
                );
              }(),
          ]),
        ),
        LossAlert(title: t.s('warn_title'), body: t.s('warn_body')),
      ]));
    } else if (_tab == 'signs') {
      children.add(LossSignsChecker(text: text));
    } else {
      final faq = text.items('faq');
      children.add(lossStack(gap: 8, [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 4), child: Text(t.s('faq_title'), style: px(18, weight: FontWeight.w900, color: a.ink))),
        for (var i = 0; i < faq.length; i++)
          LossCard(
            padding: EdgeInsets.zero,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Semantics(
                button: true,
                expanded: _open == i,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _open = _open == i ? null : i),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(children: [
                      Expanded(child: Text(faq[i].s('q'), style: px(14, weight: FontWeight.w800, color: a.ink))),
                      const SizedBox(width: 12),
                      AnimatedRotation(turns: _open == i ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: AIcon(AIcons.chevronDown, size: 16, color: a.inkFaint)),
                    ]),
                  ),
                ),
              ),
              if (_open == i) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: Text(faq[i].s('a'), style: lossBody(context))),
            ]),
          ),
      ]));
    }
    children.add(Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      child: Text(t.s('disclaimer'), textAlign: TextAlign.center, style: px(11, color: a.inkFaint)),
    ));
    return LossPage(onBack: widget.onBack, backLabel: t.s('back'), eyebrow: t.s('guide_sub'), title: '${t.s('guide_title')} 🌿', children: children);
  }
}
