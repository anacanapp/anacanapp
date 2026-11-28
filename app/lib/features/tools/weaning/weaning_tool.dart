// Ported from: src/components/tools/weaning/WeaningTool.tsx
//
// Süddən ayırma — gradual weaning for children 12+ months (Ana module, tile from 9 months).
// Free: intro, readiness, check-in + red flags, all guides. Premium: the personal plan calendar and reminders.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/offline/connectivity.dart' show connectivitySourceProvider;
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/weaning/weaning.dart';
import '../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../kit/kit.dart';
import '../parenting/programme_ports.dart';
import '../parenting/programme_ui.dart';
import 'weaning_copy.dart';
import 'weaning_reminders.dart';
import 'weaning_screens.dart';
import 'weaning_state.dart';
import 'weaning_sync.dart' show weaningRemoteProvider;

const Map<String, (String, String)> _headers = {
  'intro': ('weaning_intro_eyebrow', 'weaning_tool_name'),
  'ready': ('weaning_ready_eyebrow', 'weaning_ready_title'),
  'builder': ('weaning_builder_eyebrow', 'weaning_builder_title'),
  'checkin': ('weaning_checkin_eyebrow', 'weaning_checkin_title'),
  'result': ('weaning_result_eyebrow', 'weaning_result_title'),
  'nutrition': ('weaning_guide_eyebrow', 'weaning_nut_title'),
  'mother': ('weaning_guide_eyebrow', 'weaning_mother_title'),
  'myths': ('weaning_guide_eyebrow', 'weaning_myths_title'),
  'night': ('weaning_night_eyebrow', 'weaning_night_module_title'),
  'finish': ('weaning_finish_eyebrow', 'weaning_finish_title'),
};

class WeaningTool extends ConsumerStatefulWidget {
  const WeaningTool({super.key, required this.onBack, this.now});
  final VoidCallback onBack;

  /// Test hook: fixed "now".
  final DateTime? now;

  @override
  ConsumerState<WeaningTool> createState() => _WeaningToolState();
}

class _WeaningToolState extends ConsumerState<WeaningTool> {
  WeaningStateController? _state;
  List<WeaningScreen> _stack = [];
  String? _stepId;
  VoidCallback? _releaseBack;
  String? _reminderKey;

  @override
  void dispose() {
    _releaseBack?.call();
    _state?.dispose();
    super.dispose();
  }

  WeaningStateController _controller(String? uid, String? childId) {
    final cur = _state;
    if (cur != null && cur.uid == uid && cur.childId == childId) return cur;
    cur?.dispose();
    final next = WeaningStateController(
      store: ref.read(localStoreProvider),
      remote: ref.read(weaningRemoteProvider),
      uid: uid,
      childId: childId,
      connectivity: ref.read(connectivitySourceProvider),
    )..addListener(() {
        if (mounted) setState(() {});
      });
    _state = next;
    return next;
  }

  void _go(WeaningScreen to, {String? stepId, bool reset = false}) {
    setState(() {
      if (stepId != null) _stepId = stepId;
      _stack = reset ? (to == 'hub' || to == 'intro' ? [] : [to]) : [..._stack, to];
    });
    ref.read(scrollMemoryProvider).scrollToTop();
    _syncBack();
  }

  void _back() {
    if (_stack.isNotEmpty) {
      setState(() => _stack = _stack.sublist(0, _stack.length - 1));
      _syncBack();
    } else {
      widget.onBack();
    }
  }

  /// Android back: inner screens first, then the tool closes (ToolsHub's own handler).
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

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(programmeInputsProvider);
    final child = inputs.child;
    final childId = child?.id;
    final st = _controller(inputs.userId, childId);
    final state = st.state;
    final emergency = ref.watch(emergencyNumberProvider);
    final now = widget.now ?? DomainClock.now();
    final today = isoDay(now);
    final ageMonths = ageInMonths(child?.birthDate, now);
    final p = state.plan;
    final plan = p != null && p.childId == childId && p.status != 'cancelled' ? p : null;
    final root = plan != null ? 'hub' : 'intro';
    final screen = _stack.isNotEmpty ? _stack.last : root;
    final isPremium = inputs.isPremium;
    final language = inputs.language;

    // Premium reminders on this phone: 09:00 on each upcoming step's first day.
    final reminderKey = '${plan != null ? '${plan.id}:${plan.updatedAt}:${plan.status}' : 'none'}|$isPremium';
    if (reminderKey != _reminderKey) {
      _reminderKey = reminderKey;
      unawaited(syncWeaningReminders(ref.read(programmeNotificationsProvider), plan, isPremium, (
        title: wt('weaning_reminder_title'),
        body: (step) => wf('weaning_reminder_body', {'label': stepLabel(step)}),
      )));
    }

    String fmt(String day) {
      try {
        return localeDayMonth(parseDay(day), language);
      } catch (_) {
        return day;
      }
    }

    final childName = child?.name != null && child!.name!.isNotEmpty ? child.name! : wt('weaning_child_fallback');
    final ctx = WeaningCtx(
      today: today,
      isPremium: isPremium,
      childName: childName,
      childGender: child?.gender,
      childId: childId,
      ageMonths: ageMonths,
      emergency: emergency,
      local: state,
      plan: plan,
      stepId: _stepId,
      go: _go,
      update: st.update,
      setPlan: st.setPlan,
      openTool: (id) => ref.read(programmeNavProvider).openTool(id),
      share: (title, text) => unawaited(ref.read(programmeShareProvider)(title: title, text: text)),
      fmt: fmt,
      toast: (message, {success = false}) {
        if (!mounted) return;
        final host = AToastHost.of(context);
        success ? host.success(message) : host.message(message);
      },
      confirm: (message) => ref.read(programmeConfirmProvider)(context, message),
      call: weaningCall(ref),
    );

    String eyebrow;
    String title;
    if (screen == 'hub') {
      eyebrow = ageMonths == null ? childName : '$childName · ${wf('weaning_age_months', {'n': ageMonths})}';
      title = wt('weaning_tool_name');
    } else if (screen == 'step') {
      var idx = plan == null ? 0 : plan.steps.indexWhere((s) => s.id == _stepId);
      if (idx < 0) idx = 0;
      eyebrow = plan != null ? wf('weaning_step_of', {'n': idx + 1, 'total': plan.steps.length}) : '';
      title = plan != null ? stepLabel(plan.steps[idx]) : wt('weaning_tool_name');
    } else {
      final h = _headers[screen]!;
      eyebrow = wt(h.$1);
      title = wt(h.$2);
    }

    final Widget body = switch (screen) {
      'intro' => IntroScreen(ctx: ctx),
      'ready' => ReadyScreen(ctx: ctx),
      'builder' => BuilderScreen(ctx: ctx),
      'hub' => HubScreen(ctx: ctx),
      'step' => StepScreen(ctx: ctx),
      'checkin' => CheckinScreen(ctx: ctx),
      'result' => ResultScreen(ctx: ctx),
      'nutrition' => NutritionScreen(ctx: ctx),
      'mother' => MotherScreen(ctx: ctx),
      'myths' => MythsScreen(ctx: ctx),
      'night' => NightScreen(ctx: ctx),
      'finish' => FinishScreen(ctx: ctx),
      _ => const SizedBox.shrink(),
    };

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(title: title, eyebrow: eyebrow, onBack: _back),
        if (st.pending && !st.online)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Semantics(liveRegion: true, child: Text(wt('weaning_offline'), style: css(11.5, height: 1.45, color: context.a.inkSoft))),
          ),
        KeyedSubtree(key: ValueKey('weaning-screen-$screen'), child: body),
      ]),
    );
  }
}
