// Ported from: src/components/tools/weaning/WeaningEntryCards.tsx, src/styles/care.css (.cx-card, .cx-row, .cx-icon,
//              .cx-sub), src/styles/anacan-design.css (.a-section, .a-tag.on, .a-btn-solid, .a-btn-soft)
//
// Entry points outside the tool: the Ana home card (MommySlot.weaningHome), the feeding-logger link
// (MommySlot.weaningFeedingLink) and the card under an Anacan.AI answer (aiAnswerCardProvider).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../parenting/programme_ports.dart';
import '../parenting/programme_ui.dart';
import 'weaning_copy.dart';
import 'weaning_entry.dart';
import 'weaning_sync.dart';

/// The last 7 days of feeding logs (`baby_logs` select log_type, feed_type, start_time; own rows, the child when
/// known).
typedef WeaningFeedLogsFetcher = Future<List<FeedLog>> Function(String uid, String? childId, String sinceIso);

final weaningFeedLogsFetcherProvider = Provider<WeaningFeedLogsFetcher>((ref) => (uid, childId, since) async {
      final SupabaseClient client = ref.read(supabaseClientProvider);
      var q = client.from('baby_logs').select('log_type, feed_type, start_time').eq('user_id', uid).eq('log_type', 'feeding').gte('start_time', since);
      if (childId != null) q = q.eq('child_id', childId);
      final data = await q;
      return [
        for (final r in data) FeedLog(logType: '${r['log_type']}', feedType: r['feed_type'] as String?, startTime: r['start_time'] as String?),
      ];
    });

/// Shared inputs: account, module, admin switch, selected child and the tool's device state (re-read when the tool
/// writes it — React re-reads on window focus / visibility).
mixin _WeaningEntryInputs<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  late LocalStore _store;
  StreamSubscription<LocalStoreChange>? _sub;
  late WeaningLocal local;
  String? _uid;

  @override
  void initState() {
    super.initState();
    _store = ref.read(localStoreProvider);
    _uid = ref.read(programmeInputsProvider).userId;
    local = readLocal(_store, _uid);
    _sub = _store.changes.listen((c) {
      if (c.key == weaningStorageKey(_uid) && mounted) setState(() => local = readLocal(_store, _uid));
    });
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel());
    super.dispose();
  }

  ProgrammeInputs watchInputs() {
    final inputs = ref.watch(programmeInputsProvider);
    if (inputs.userId != _uid) {
      _uid = inputs.userId;
      local = readLocal(_store, _uid);
    }
    return inputs;
  }

  void openWeaningTool() => ref.read(programmeNavProvider).openTool('weaning');
}

/// `.cx-card.cx-row` button (whileTap 0.98) with the 🌱 icon, a title / sub and a trailing widget.
class _EntryRow extends StatelessWidget {
  const _EntryRow({required this.title, required this.sub, required this.trailing, required this.onTap, this.titleSize = 14, this.iconFont = 20, this.enabled = true, super.key});
  final String title;
  final String sub;
  final Widget trailing;
  final VoidCallback onTap;
  final double titleSize;
  final double iconFont;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      enabled: enabled,
      child: PressScale(
        scale: 0.98,
        enabled: enabled,
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
          child: Row(children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
              child: Text('🌱', style: css(iconFont, height: 1.2)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: css(titleSize, weight: FontWeight.w700, color: a.ink)),
                Text(sub, style: css(13, height: 1.45, color: a.inkSoft)),
              ]),
            ),
            const SizedBox(width: 12),
            trailing,
          ]),
        ),
      ),
    );
  }
}

/// `.a-section` wrapper of the Ana home.
Widget _section(Widget child) => Padding(padding: const EdgeInsets.only(bottom: 12), child: child);

/// Ana home: a one-time, dismissible card at 12+ months, or the running plan's progress.
class WeaningHomeCard extends ConsumerStatefulWidget {
  const WeaningHomeCard({super.key});
  @override
  ConsumerState<WeaningHomeCard> createState() => _WeaningHomeCardState();
}

class _WeaningHomeCardState extends ConsumerState<WeaningHomeCard> with _WeaningEntryInputs {
  bool? _dismissed;
  String? _dismissFor;

  @override
  Widget build(BuildContext context) {
    final inputs = watchInputs();
    final child = inputs.child;
    final scope = '${inputs.userId}|${child?.id}';
    if (_dismissFor != scope) {
      _dismissFor = scope;
      _dismissed = readHomeDismissed(_store, inputs.userId, child?.id);
    }
    final state = homeCardState(
      lifeStage: inputs.lifeStage,
      birthDate: child?.birthDate,
      setting: inputs.weaningSetting,
      plan: local.plan,
      continueBF: local.continueBF,
      dismissed: _dismissed ?? false,
    );
    if (state.kind == 'hidden') return const SizedBox.shrink();
    final a = context.a;

    if (state.kind == 'active') {
      final sub = state.paused
          ? wt('weaning_home_active_paused')
          : state.step != null
              ? wf('weaning_home_active_step', {'step': stepLabel(state.step!)})
              : wt('weaning_home_active_done');
      return _section(KeyedSubtree(
        key: const ValueKey('weaning-home-active'),
        child: _EntryRow(
          key: const ValueKey('weaning-home-active-button'),
          title: wf('weaning_home_active_title', {'done': state.done, 'total': state.total}),
          sub: sub,
          titleSize: 14.5,
          iconFont: 22,
          onTap: openWeaningTool,
          trailing: AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
        ),
      ));
    }

    void keepBreastfeeding() {
      final next = readLocal(_store, inputs.userId).copyWith(continueBF: true);
      writeLocal(_store, inputs.userId, next);
      setState(() => local = next);
    }

    void dismiss() {
      writeHomeDismissed(_store, inputs.userId, child?.id);
      setState(() => _dismissed = true);
    }

    Widget pill(String label, bool solid, VoidCallback onTap, Key key) => Tap(
          key: key,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 40),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: solid ? a.peach2 : a.peach1, borderRadius: BorderRadius.circular(999)),
            child: Text(label, style: css(12, weight: FontWeight.w700, color: solid ? const Color(0xFFFFFFFF) : a.accentInk)),
          ),
        );

    return _section(Container(
      key: const ValueKey('weaning-home-intro'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
      child: Gap(gap: 8, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          // `.a-tag.on`
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
            child: Text('🌱 ${wt('weaning_home_badge')}', style: css(11.5, weight: FontWeight.w700, color: a.accentInk)),
          ),
          Tap(
            key: const ValueKey('weaning-home-dismiss'),
            label: wt('weaning_home_dismiss'),
            onTap: dismiss,
            excludeSemantics: true,
            child: Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
              child: AIcon(AIcons.x, size: 14, color: a.inkSoft),
            ),
          ),
        ]),
        Text(wt('weaning_home_title'), style: css(15, weight: FontWeight.w700, height: 1.3, color: a.ink)),
        Text(wt('weaning_home_text'), style: css(13, height: 1.45, color: a.inkSoft)),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: WrapRow(gap: 8, children: [
            pill(wt('weaning_home_open'), true, openWeaningTool, const ValueKey('weaning-home-open')),
            pill(wt('weaning_home_continue'), false, keepBreastfeeding, const ValueKey('weaning-home-continue')),
          ]),
        ),
      ]),
    ));
  }
}

/// Feeding logger: "thinking about weaning?" — prefills the plan builder from the last 7 days of breastfeeds.
class WeaningFeedingLink extends ConsumerStatefulWidget {
  const WeaningFeedingLink({super.key});
  @override
  ConsumerState<WeaningFeedingLink> createState() => _WeaningFeedingLinkState();
}

class _WeaningFeedingLinkState extends ConsumerState<WeaningFeedingLink> with _WeaningEntryInputs {
  bool _busy = false;

  Future<void> _open(ProgrammeInputs inputs) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final uid = inputs.userId;
      if (uid != null) {
        final since = jsToIsoString(DateTime.fromMillisecondsSinceEpoch(DomainClock.nowMs() - 7 * 86400000));
        final logs = await ref.read(weaningFeedLogsFetcherProvider)(uid, inputs.child?.id, since);
        final current = readLocal(_store, uid);
        final feeds = feedsFromLogs(logs, current.feeds);
        if (feeds != null && current.plan == null) writeLocal(_store, uid, current.copyWith(feeds: feeds));
      }
    } catch (_) {
      // Offline: the builder keeps its defaults.
    } finally {
      if (mounted) setState(() => _busy = false);
      openWeaningTool();
    }
  }

  @override
  Widget build(BuildContext context) {
    final inputs = watchInputs();
    final visible = feedingLinkVisible(
      lifeStage: inputs.lifeStage,
      birthDate: inputs.child?.birthDate,
      setting: inputs.weaningSetting,
      plan: local.plan,
      continueBF: local.continueBF,
    );
    if (!visible) return const SizedBox.shrink();
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _EntryRow(
        key: const ValueKey('weaning-feeding-link'),
        title: wt('weaning_feed_link_title'),
        sub: wt('weaning_feed_link_text'),
        enabled: !_busy,
        onTap: () => unawaited(_open(inputs)),
        trailing: Text(wt('weaning_feed_link_cta'), style: css(12.5, weight: FontWeight.w700, color: a.coralText)),
      ),
    );
  }
}

/// Anacan.AI: shown under the answer to a weaning question (mother persona only).
class WeaningAiCard extends ConsumerStatefulWidget {
  const WeaningAiCard({super.key});
  @override
  ConsumerState<WeaningAiCard> createState() => _WeaningAiCardState();
}

class _WeaningAiCardState extends ConsumerState<WeaningAiCard> with _WeaningEntryInputs {
  @override
  Widget build(BuildContext context) {
    final inputs = watchInputs();
    if (!weaningOfferable(lifeStage: inputs.lifeStage, birthDate: inputs.child?.birthDate, setting: inputs.weaningSetting)) {
      return const SizedBox.shrink();
    }
    final plan = local.plan;
    final running = plan != null && (plan.status == 'active' || plan.status == 'paused');
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 34, bottom: 14),
      child: Transform.translate(
        offset: const Offset(0, -4),
        child: _EntryRow(
          key: const ValueKey('weaning-ai-card'),
          title: wt(running ? 'weaning_ai_title_active' : 'weaning_ai_title'),
          sub: wt('weaning_ai_text'),
          onTap: openWeaningTool,
          trailing: AIcon(AIcons.chevronRight, size: 18, color: context.a.inkFaint, mirrorInRtl: true),
        ),
      ),
    );
  }
}
