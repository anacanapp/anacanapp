// Ported from: src/components/tools/parenting/ParentingTool.tsx, src/components/tools/parenting/useParentingContent.ts,
//              src/styles/anacan-design.css (.a-par-skel, .a-par-kid)
//
// Tərbiyə — evidence-based positive parenting for children 0–12 (Ana module; the linked partner sees the same tool
// through [ParentingToolView] with `partner: true`). Content is loaded per app language (bundled JSON + published
// editor overrides). Free: age-band overviews, the daily tip, a free set of articles and SOS cards, quizzes' short
// results, the first programme days and every safety signal. Premium: the full library, all SOS cards, full
// programmes, detailed quiz results and programme reminders.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/offline/connectivity.dart' show connectivitySourceProvider;
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/parenting/parenting.dart' show ageBandFor, ageInMonths, dailyTipIndex, isoDay, milestoneAge, parentingChildren, pickParentingChild;
import '../../../shell/shell.dart' show ParentingTarget, scrollMemoryProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../kit/kit.dart';
import 'parenting_content.dart';
import 'parenting_copy.dart';
import 'parenting_intro.dart';
import 'parenting_reminders.dart';
import 'parenting_screens.dart';
import 'parenting_state.dart';
import 'parenting_store.dart';
import 'parenting_sync.dart' show parentingRemoteProvider;
import 'programme_ports.dart';
import 'programme_ui.dart';

/// Mother (Ana module): her children, starting on the app's selected child when it is under 13.
class ParentingTool extends ConsumerWidget {
  const ParentingTool({super.key, required this.onBack, this.now});
  final VoidCallback onBack;

  /// Test hook: fixed "now".
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(programmeInputsProvider);
    return ParentingToolView(onBack: onBack, now: now, child: inputs.child, kids: inputs.children);
  }
}

class ParentingToolView extends ConsumerStatefulWidget {
  const ParentingToolView({super.key, required this.onBack, this.now, required this.child, this.kids = const [], this.partner = false});
  final VoidCallback onBack;
  final DateTime? now;

  /// The preferred child (the app's selected child / her current child).
  final ProgrammeChild? child;

  /// Every child the parent can switch between (only those under 13 or without a birth date are offered).
  final List<ProgrammeChild> kids;
  final bool partner;

  @override
  ConsumerState<ParentingToolView> createState() => _ParentingToolViewState();
}

class _ParentingToolViewState extends ConsumerState<ParentingToolView> {
  ParentingStateController? _state;
  String? _pickedId;
  late List<ParRoute> _stack;
  bool _intro = false;
  String _query = '';
  VoidCallback? _releaseBack;
  OverlayEntry? _introEntry;
  String? _normalizedFor;
  int _attempt = 0;

  void _track(String action, [String? itemId]) => ref.read(programmeTrackProvider)('parenting', action, itemId);

  @override
  void initState() {
    super.initState();
    final targets = ref.read(programmeParentingTargetProvider);
    final t = targets.peek();
    _pickedId = t?.child;
    _stack = t == null ? [] : [ParRoute(t.kind, id: t.id)];
    final uid = ref.read(programmeInputsProvider).userId;
    final st = _controller(uid);
    // Opened on one item (Anacan.AI card, reminder tap, home "Continue"): count it like any other open.
    if (t != null) _track('open_${t.kind}', t.id);
    // A reminder tap names only the programme: open it for the child it runs for.
    if (t != null && t.kind == 'programme' && t.child == null) {
      final owner = childForProgramme(st.state, t.id);
      if (owner != null) _pickedId = owner;
    }
    // First-run intro (once per device + account), only for a parent who has not used the tool.
    final store = ref.read(localStoreProvider);
    _intro = !introSeen(store, uid) && t == null && !hasParentingActivity(st.state);
    targets.clear();
    _syncBack();
  }

  @override
  void dispose() {
    _releaseBack?.call();
    _introEntry?.remove();
    _introEntry = null;
    _state?.dispose();
    super.dispose();
  }

  ParentingStateController _controller(String? uid) {
    final cur = _state;
    if (cur != null && cur.uid == uid) return cur;
    cur?.dispose();
    final next = ParentingStateController(
      store: ref.read(localStoreProvider),
      remote: ref.read(parentingRemoteProvider),
      uid: uid,
      connectivity: ref.read(connectivitySourceProvider),
    )..addListener(() {
        if (mounted) setState(() {});
      });
    _state = next;
    return next;
  }

  void _go(ParRoute r) {
    setState(() => _stack = [..._stack, r]);
    ref.read(scrollMemoryProvider).scrollToTop();
    if (r.s == 'article' || r.s == 'sos' || r.s == 'programme') _track('open_${r.s}', r.id);
    _syncBack();
  }

  void _back() {
    if (_stack.isNotEmpty) {
      setState(() => _stack = _stack.sublist(0, _stack.length - 1));
      ref.read(scrollMemoryProvider).scrollToTop();
      _syncBack();
    } else {
      widget.onBack();
    }
  }

  /// Android back: inner screens first, then the tool closes (ToolsHub's / Index's own handler).
  void _syncBack() {
    if (_stack.isEmpty) {
      _releaseBack?.call();
      _releaseBack = null;
    } else {
      _releaseBack ??= ref.read(programmeBackProvider)(() {
        if (_stack.isEmpty) return false;
        _back();
        return true;
      });
    }
  }

  void _finishIntro(String? picked, String? childId, String? childBand) {
    final uid = ref.read(programmeInputsProvider).userId;
    markIntroSeen(ref.read(localStoreProvider), uid);
    setState(() => _intro = false);
    if (picked != null) _state!.update((s) => writeSlot(s, childId, (slot) => setSlotBand(slot, picked, childBand)));
    _track(picked != null ? 'intro_band' : 'intro_done');
  }

  void _showIntro(bool show, {required bool askBand, required String? childId, required String? childBand}) {
    if (!show) {
      _introEntry?.remove();
      _introEntry = null;
      return;
    }
    if (_introEntry != null) return;
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return;
    _introEntry = OverlayEntry(builder: (_) => ParentingIntro(askBand: askBand, onDone: (b) => _finishIntro(b, childId, childBand)));
    overlay.insert(_introEntry!);
  }

  String? _ageLabel(int? months, String? band) {
    if (months == null || band == null) return null;
    if (months < 12) return pf('par_age_months', {'n': months});
    if (months % 12 == 0 || months >= 72) return pf('par_age_years', {'n': months ~/ 12});
    return pf('par_age_ym', {'y': months ~/ 12, 'm': months % 12});
  }

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(programmeInputsProvider);
    final emergency = ref.watch(emergencyNumberProvider);
    final language = inputs.language;
    // Content of the app language; a deep link in a language without content falls back to Azerbaijani.
    final lang = hasParentingContent(language) ? language : 'az';
    final contentAsync = ref.watch(parentingContentProvider(lang));
    final sources = ref.watch(parentingSourcesProvider).value ?? const <String, PSource>{};
    final st = _controller(inputs.userId);
    final state = st.state;
    final setting = inputs.parentingSetting;
    final isPremium = inputs.isPremium;

    // Reminders: switch on for everyone (free users get the free programme days); Premium for every day.
    final allowed = setting == null ? null : setting == 'on';
    final content = contentAsync.value;
    keepParentingReminders(
      store: ref.read(localStoreProvider),
      scheduler: ref.read(programmeNotificationsProvider),
      state: state,
      programmes: content?.programmes,
      allowed: allowed,
      isPremium: inputs.premiumLoading ? null : isPremium,
      partner: widget.partner,
      now: widget.now,
    );

    final now = widget.now ?? DomainClock.now();
    final today = isoDay(now);
    final kidList = widget.kids.isNotEmpty ? widget.kids : [?widget.child];
    final eligible = parentingChildren<ProgrammeChild>(kidList, (k) => k.birthDate, now);
    final child = pickParentingChild<ProgrammeChild>(kidList, idOf: (k) => k.id, birthDateOf: (k) => k.birthDate, picked: _pickedId, preferred: widget.child?.id, now: now);
    final childId = child?.id;
    final ageMonths = ageInMonths(child?.birthDate, now);
    final childBand = ageBandFor(ageMonths);
    final milestone = milestoneAge(child?.birthDate, child?.dueDate, now);
    final slot = readSlot(state, childId);
    final band = slotBand(slot, childBand) ?? '1-3';

    // Account-level data from before multi-child support becomes this child's; an outgrown manual band is dropped.
    final normKey = '$childId|$childBand';
    if (_normalizedFor != normKey || !identical(normalizeForChild(state, childId, childBand), state)) {
      _normalizedFor = normKey;
      final stamp = jsToIsoString(now);
      if (!identical(normalizeForChild(state, childId, childBand, stamp), state)) {
        scheduleMicrotask(() {
          if (mounted) st.update((s) => normalizeForChild(s, childId, childBand, stamp));
        });
      }
    }
    // A parent who already used the tool (before this intro existed) never sees it.
    if (!_intro && !introSeen(ref.read(localStoreProvider), inputs.userId) && hasParentingActivity(state)) markIntroSeen(ref.read(localStoreProvider), inputs.userId);

    final route = _stack.isNotEmpty ? _stack.last : const ParRoute('home');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showIntro(_intro && route.s == 'home' && content != null, askBand: childBand == null && slot.band == null, childId: childId, childBand: childBand);
    });

    if (content == null) {
      final loading = contentAsync.isLoading;
      final a = context.a;
      Widget skel(double h, double r) => Container(height: h, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(r)));
      return ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(title: pt('par_tool_name'), onBack: widget.onBack),
          Semantics(
            liveRegion: true,
            child: Gap(gap: 12, children: loading
                ? [skel(128, 24), skel(64, 18), skel(64, 18), Text(pt('par_loading'), style: css(11.5, height: 1.45, color: a.inkSoft))]
                : [
                    Text(pt('par_load_failed'), style: css(14.5, weight: FontWeight.w600, height: 1.55, color: a.ink)),
                    ParBtn(
                      key: const ValueKey('par-retry'),
                      label: pt('par_retry'),
                      onTap: () {
                        setState(() => _attempt++);
                        ref.invalidate(parentingContentProvider(lang));
                      },
                    ),
                  ]),
          ),
        ]),
      );
    }

    final childName = child?.name != null && child!.name!.isNotEmpty ? child.name! : pt('par_child_fallback');
    final childAgeLabel = _ageLabel(ageMonths, childBand);
    final shareActor = !widget.partner && inputs.userId != null && inputs.profileUserId == inputs.userId && (inputs.linkedPartnerId ?? '').isNotEmpty
        ? (userId: inputs.userId!, partnerProfileId: inputs.linkedPartnerId!)
        : null;
    final ctx = ParentingCtx(
      content: content,
      band: band,
      childBand: childBand,
      childName: childName,
      childAgeLabel: childAgeLabel,
      ageMonths: ageMonths,
      isPremium: isPremium,
      emergency: emergency,
      today: today,
      locale: language,
      local: state,
      slot: slot,
      updateSlot: (fn) => st.update((s) => writeSlot(s, childId, fn)),
      update: st.update,
      updateLocal: st.updateLocal,
      go: _go,
      track: _track,
      query: _query,
      setQuery: (q) => setState(() => _query = q),
      reminderAllowed: setting != 'off',
      milestoneMonths: milestone.months,
      milestoneKnown: true,
      milestoneCorrected: milestone.corrected,
      partner: widget.partner,
      userId: inputs.userId,
      shareActor: shareActor,
      sources: sources,
    );

    final ref0 = savedRef(route);
    final isSaved = ref0 != null && state.saved.contains(ref0);
    final a = context.a;
    final actions = <Widget>[];
    if (route.s == 'home') {
      if (eligible.length > 1) {
        actions.add(_ChildSwitch(kids: eligible, value: childId, onChanged: (id) {
          setState(() => _pickedId = id);
          _track('child_switch');
        }));
      }
      actions.add(ToolIconButton(
        key: const ValueKey('par-saved-open'),
        semanticLabel: pt('par_saved_title'),
        icon: const AIcon(AIcons.bookmark, size: 16),
        onTap: () => _go(const ParRoute('saved')),
      ));
    } else if (ref0 != null) {
      actions.add(Semantics(
        toggled: isSaved,
        child: ToolIconButton(
          key: const ValueKey('par-save'),
          semanticLabel: pt(isSaved ? 'par_unsave' : 'par_save'),
          icon: isSaved ? AIcon(AIcons.bookmarkCheck, size: 16, color: a.coral) : const AIcon(AIcons.bookmark, size: 16),
          onTap: () => st.update((s) => toggleSavedState(s, ref0)),
        ),
      ));
    }

    var title = pt('par_tool_name');
    String? eyebrow;
    Widget body;
    switch (route.s) {
      case 'band':
        eyebrow = pt('par_tool_name');
        title = pt('par_band_open');
        body = BandScreen(ctx: ctx, id: route.id!, focus: route.focus);
      case 'topics':
        eyebrow = pt('par_tool_name');
        title = pt('par_topics_title');
        body = TopicsScreen(ctx: ctx, area: route.area);
      case 'article':
        eyebrow = pt('par_tool_name');
        title = pt('par_sec_topics');
        body = ArticleScreen(ctx: ctx, id: route.id!);
      case 'sosList':
        eyebrow = pt('par_tool_name');
        title = pt('par_sos_title');
        body = SosListScreen(ctx: ctx);
      case 'sos':
        SosCard? c;
        for (final x in content.sos) {
          if (x.id == route.id) c = x;
        }
        eyebrow = pt('par_sos_title');
        title = c != null ? '${c.emoji} ${c.title}' : pt('par_sos_title');
        body = SosScreen(key: ValueKey('sos-${route.id}'), ctx: ctx, id: route.id!);
      case 'programmes':
        eyebrow = pt('par_tool_name');
        title = pt('par_programmes_title');
        body = ProgrammesScreen(ctx: ctx);
      case 'programme':
        Programme? p;
        for (final x in content.programmes) {
          if (x.id == route.id) p = x;
        }
        eyebrow = pt('par_programmes_title');
        title = p?.title ?? pt('par_programmes_title');
        body = ProgrammeScreen(key: ValueKey('programme-${route.id}'), ctx: ctx, id: route.id!);
      case 'quiz':
        eyebrow = pt('par_tool_name');
        title = pt('par_quizzes_title');
        body = QuizScreen(key: ValueKey('quiz-${route.id}'), ctx: ctx, id: route.id!);
      case 'saved':
        eyebrow = pt('par_tool_name');
        title = pt('par_saved_title');
        body = SavedScreen(ctx: ctx);
      default:
        eyebrow = childAgeLabel != null ? '$childName · $childAgeLabel' : pt(bandKey(band));
        body = ParHomeScreen(ctx: ctx, tipIndex: dailyTipIndex(today, content.tips[band]?.length ?? 0));
    }

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(title: title, eyebrow: eyebrow, onBack: _back, actions: actions),
        if (st.pending && !st.online)
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Semantics(liveRegion: true, child: Text(pt('par_offline'), style: css(11.5, height: 1.45, color: a.inkSoft)))),
        KeyedSubtree(key: ValueKey('par-route-${_stack.length}-${route.s}-${route.id}-$_attempt'), child: body),
      ]),
    );
  }
}

/// `<select class="a-par-kid">`: the children under 13 (a compact pill opening a picker).
class _ChildSwitch extends StatelessWidget {
  const _ChildSwitch({required this.kids, required this.value, required this.onChanged});
  final List<ProgrammeChild> kids;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    ProgrammeChild? current;
    for (final k in kids) {
      if (k.id == value) current = k;
    }
    String name(ProgrammeChild? k) => k?.name != null && k!.name!.isNotEmpty ? k.name! : pt('par_child_fallback');
    return Semantics(
      label: pt('par_child_switch'),
      button: true,
      child: GestureDetector(
        key: const ValueKey('parenting-child-switch'),
        behavior: HitTestBehavior.opaque,
        onTap: () => unawaited(showASheet<void>(
          context,
          full: false,
          title: Text(pt('par_child_switch')),
          builder: (sheet) => [
            for (final k in kids)
              Tap(
                key: ValueKey('parenting-child-${k.id}'),
                label: name(k),
                pressed: k.id == value,
                onTap: () {
                  Navigator.of(sheet).pop();
                  onChanged(k.id);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(name(k), style: css(15, weight: k.id == value ? FontWeight.w800 : FontWeight.w600, color: sheet.a.ink)),
                ),
              ),
          ],
        )),
        child: Container(
          constraints: const BoxConstraints(minHeight: 36, maxWidth: 132),
          padding: const EdgeInsetsDirectional.fromSTEB(12, 6, 10, 6),
          decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(999), boxShadow: a.cardShadow),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Flexible(child: Text(name(current), maxLines: 1, overflow: TextOverflow.ellipsis, style: css(13, weight: FontWeight.w800, color: a.ink))),
            const SizedBox(width: 6),
            AIcon(AIcons.chevronDown, size: 10, strokeWidth: 1.6, color: a.inkFaint),
          ]),
        ),
      ),
    );
  }
}

/// The pending Tərbiyə target as React's `peekParentingTarget()` (tests / partner screen).
ParentingTarget? peekParentingTarget(WidgetRef ref) => ref.read(programmeParentingTargetProvider).peek();
