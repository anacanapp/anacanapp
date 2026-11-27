// Ported from: src/components/HomeWidgetSync.tsx, src/hooks/useHomeWidgetSync.ts (journey part: pregnancy week or
//              the baby's age; 5-minute refresh), src/lib/home-widgets.ts (WidgetJourney), src/lib/feature-text.ts (fill)
//
// Data computation only. The snapshot goes to [homeWidgetBridgeProvider] (native AnacanWidgets push, default no-op).
// The Premium "care" section (last feed, next nap, today's counters) and widget settings belong to the widgets
// feature (screen.widgets) and are not computed here.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../domain/pregnancy/pregnancy_utils.dart';
import '../../state/user_store.dart';
import 'data/pregnancy_content.dart';
import 'data/widget_text.g.dart';
import 'home_inputs.dart';
import 'home_slots.dart';

/// `fill(template, values)`.
String fillWidgetText(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m.group(1)) ? '${values[m.group(1)]}' : m.group(0)!);

String _jsNum(num n) => n.isNaN ? 'NaN' : (n == n.roundToDouble() ? n.toInt().toString() : n.toString());

/// The journey of the widget for the current user, or null (`journey` in useHomeWidgetSync).
HomeWidgetJourney? computeWidgetJourney({
  required String? lifeStage,
  required String language,
  required Map<String, dynamic>? profile,
  required Map<String, dynamic>? selectedChild,
  required FruitData Function(int week) fruitForWeek,
  required DateTime now,
}) {
  final t = widgetJourneyText[language] ?? widgetJourneyText['az']!;
  final lmp = profile?['last_period_date'];
  if (lifeStage == 'bump' && lmp is String && lmp.isNotEmpty) {
    final week = getPregnancyWeek(lmp);
    if (week.isNaN || week <= 0) return null;
    final w = week.toInt();
    final fruit = fruitForWeek(w.clamp(1, 42));
    final day = getDayInWeek(lmp);
    return HomeWidgetJourney(
      eyebrow: fillWidgetText(t['trimester']!, {'n': getTrimester(w)}),
      title: day != 0 ? fillWidgetText(t['pregnancy_week']!, {'w': w, 'd': _jsNum(day)}) : fillWidgetText(t['pregnancy_week_only']!, {'w': w}),
      subtitle: fillWidgetText(t['baby_size']!, {'fruit': fruit.fruit}),
      badge: fillWidgetText(t['days_left']!, {'n': _jsNum(getDaysUntilDue(lmp, profile?['due_date']))}),
      progress: (getPregnancyProgress(lmp) / 100).clamp(0, 1).toDouble(),
      emoji: fruit.emoji.isEmpty ? '🤰' : fruit.emoji,
    );
  }
  return null;
}

/// Renders nothing; keeps the native home-screen widgets in sync while the app runs.
class HomeWidgetSync extends ConsumerStatefulWidget {
  const HomeWidgetSync({super.key});

  @override
  ConsumerState<HomeWidgetSync> createState() => _HomeWidgetSyncState();
}

class _HomeWidgetSyncState extends ConsumerState<HomeWidgetSync> {
  Timer? _tick;
  HomeWidgetJourney? _last;
  bool _pushed = false;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(minutes: 5), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final native = ref.watch(homeIsNativeProvider);
    final user = ref.watch(homeUserIdProvider);
    if (native && user != null) {
      final journey = computeWidgetJourney(
        lifeStage: ref.watch(userStoreProvider.select((s) => s.lifeStage)),
        language: ref.watch(userStoreProvider.select((s) => s.language)),
        profile: ref.watch(homeProfileRowProvider),
        selectedChild: ref.watch(homeSelectedChildProvider),
        fruitForWeek: (w) => fruitDataForWeek(ref.watch(fruitImagesQuery).data ?? const [], w),
        now: DateTime.now(),
      );
      if (!_pushed || journey != _last) {
        _pushed = true;
        _last = journey;
        unawaited(ref.read(homeWidgetBridgeProvider).pushJourney(journey));
      }
    }
    return const SizedBox.shrink();
  }
}
