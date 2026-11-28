// Ported from: src/components/tools/parenting/ParentingHomeCard.tsx, src/components/tools/parenting/useParentingTips.ts,
//              src/styles/anacan-design.css (.a-section, .a-card, .a-fade-in, .a-par-home*)
//
// Ana home teaser for Tərbiyə (MommySlot.parentingHome): today's tip for the active child's age band (the same tip
// the tool's home shows) and a way into the tool; a "Continue" line for a running programme. Visible under the same
// rules as the Tools tile plus the per-language tool switch, Premium only (2026-11-09). It also keeps the programme
// reminders in line (cancelled once the switch is gone or for free users).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../core/offline/connectivity.dart' show connectivitySourceProvider;
import '../../../design/design.dart';
import '../../../domain/parenting/parenting.dart' show homeTipFor, isParentingHomeCardVisible, pickParentingChild;
import '../../../shell/shell.dart' show ParentingTarget;
import '../../../state/persisted_store.dart' show localStoreProvider;
import 'parenting_content.dart';
import 'parenting_copy.dart';
import 'parenting_reminders.dart';
import 'parenting_state.dart';
import 'parenting_store.dart';
import 'parenting_sync.dart' show parentingRemoteProvider;
import 'programme_ports.dart';
import 'programme_ui.dart';

class ParentingHomeCard extends ConsumerStatefulWidget {
  const ParentingHomeCard({super.key, required this.onOpen, this.now});
  final VoidCallback onOpen;
  final DateTime? now;
  @override
  ConsumerState<ParentingHomeCard> createState() => _ParentingHomeCardState();
}

class _ParentingHomeCardState extends ConsumerState<ParentingHomeCard> {
  ParentingStateController? _state;

  @override
  void dispose() {
    _state?.dispose();
    super.dispose();
  }

  ParentingStateController _controller(String? uid) {
    final cur = _state;
    if (cur != null && cur.uid == uid) return cur;
    cur?.dispose();
    return _state = ParentingStateController(
      store: ref.read(localStoreProvider),
      remote: ref.read(parentingRemoteProvider),
      uid: uid,
      doSync: false,
      connectivity: ref.read(connectivitySourceProvider),
    )..addListener(() {
        if (mounted) setState(() {});
      });
  }

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(programmeInputsProvider);
    final kids = inputs.children;
    final selected = inputs.selectedChild;
    // The selected child when under 13, else the first younger sibling: a 13+ child does not hide the card.
    final child = pickParentingChild<ProgrammeChild>(kids, idOf: (k) => k.id, birthDateOf: (k) => k.birthDate, preferred: selected?.id, now: widget.now) ??
        selected ??
        (kids.isEmpty ? null : kids.first);
    final state = _controller(inputs.userId).state;
    final setting = inputs.parentingSetting;
    final visible = isParentingHomeCardVisible(
      lifeStage: inputs.lifeStage,
      language: inputs.language,
      setting: setting,
      birthDate: child?.birthDate,
      birthDates: [for (final c in kids) c.birthDate],
      toolDisabled: inputs.isToolDisabled('parenting'),
      now: widget.now,
    );
    final content = visible ? ref.watch(parentingTipsProvider(inputs.language)).value : null;
    final known = setting != null;
    // 2026-11-09: Tərbiyə is Premium-only: no home card and no reminders for free users.
    keepParentingReminders(
      store: ref.read(localStoreProvider),
      scheduler: ref.read(programmeNotificationsProvider),
      state: state,
      programmes: content?.programmes,
      allowed: known && !inputs.premiumLoading ? visible && inputs.isPremium : null,
      isPremium: inputs.premiumLoading ? null : inputs.isPremium,
      now: widget.now,
    );

    if (!visible || content == null || !inputs.isPremium) return const SizedBox.shrink();
    final slot = readSlot(state, child?.id);
    final today = homeTipFor<Tip>(content.tips, birthDate: child?.birthDate, slot: slot.choice, now: widget.now);
    if (today == null) return const SizedBox.shrink();

    // A running programme: a "Continue: <programme> · Day n/total" line that opens it directly.
    final running = activeProgramme(state, content.programmes);
    void track(String action, [String? itemId]) => ref.read(programmeTrackProvider)('parenting', action, itemId);
    void openTip() {
      track('home_card_open');
      widget.onOpen();
    }

    void openProgramme() {
      if (running == null) return;
      ref.read(programmeParentingTargetProvider).set(ParentingTarget('programme', running.programme.id, child: running.childId));
      track('home_continue', running.programme.id);
      widget.onOpen();
    }

    final a = context.a;
    BoxDecoration card() => BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow);
    Widget icon(String emoji) => Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(10)),
          child: Text(emoji, style: css(16, height: 1.2)),
        );
    return Padding(
      key: const ValueKey('parenting-home-card'),
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (running != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Semantics(
              button: true,
              child: PressScale(
                key: const ValueKey('parenting-home-continue'),
                scale: 0.98,
                onTap: openProgramme,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: card(),
                  child: Row(children: [
                    icon(running.programme.emoji),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Gap(gap: 1, crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(pf('par_home_continue', {'title': running.programme.title}), style: css(13.5, weight: FontWeight.w800, height: 1.3, color: a.ink)),
                        Text(
                          pf('par_home_day', {
                            'n': (running.progress.done.length + 1).clamp(0, running.programme.days.length),
                            'total': running.programme.days.length,
                          }),
                          style: css(12, weight: FontWeight.w700, color: a.coralText),
                        ),
                      ]),
                    ),
                    const SizedBox(width: 10),
                    AIcon(AIcons.chevronRight, size: 16, color: a.inkSoft, mirrorInRtl: true),
                  ]),
                ),
              ),
            ),
          ),
        Semantics(
          button: true,
          child: PressScale(
            key: const ValueKey('parenting-home-open'),
            scale: 0.98,
            onTap: openTip,
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: card(),
              child: Stack(children: [
                // `.a-par-home::after`
                PositionedDirectional(
                  end: -36,
                  top: -36,
                  child: Opacity(opacity: 0.7, child: Container(width: 108, height: 108, decoration: BoxDecoration(color: a.coralSoft, shape: BoxShape.circle))),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 13),
                  child: Gap(gap: 6, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      icon('🤝'),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(tr('dash_parenting_eyebrow', 'Tərbiyə · Günün məsləhəti').toUpperCase(),
                            style: css(11.5, weight: FontWeight.w800, height: 1.25, em: 0.03, color: a.coralText)),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line)),
                        child: Text(pt(bandKey(today.band)), style: css(10.5, weight: FontWeight.w800, color: a.inkSoft)),
                      ),
                    ]),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(today.tip.title, style: css(15, weight: FontWeight.w800, height: 1.3, em: -0.01, color: a.ink)),
                    ),
                    Text(today.tip.text, maxLines: 2, overflow: TextOverflow.ellipsis, style: css(12.5, height: 1.45, color: a.inkSoft)),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(pt('par_see_all'), style: css(12.5, weight: FontWeight.w800, color: a.coralText)),
                        const SizedBox(width: 2),
                        AIcon(AIcons.chevronRight, size: 14, color: a.coralText, mirrorInRtl: true),
                      ]),
                    ),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
