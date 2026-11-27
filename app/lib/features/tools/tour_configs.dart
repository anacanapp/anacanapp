// Ported from: src/components/onboarding/OnboardingTourHost.tsx (`useToolConfigs(stage)` minus `useDisabledTools`,
//              the `tools` memo inputs)
//
// The real `tourToolConfigsProvider` value: the app root adds
//   tourToolConfigsProvider.overrideWith((ref, stage) => ref.watch(toolsTourConfigsProvider(stage)))
// to featureWiringOverrides() (app/lib/app/app_wiring.dart).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/language_controller.dart' show disabledToolsProvider;
import '../onboarding/onboarding_tour_host.dart' show TourToolConfig;
import 'data/dynamic_tools.dart' show toolConfigsQuery;
import 'data/tool_config.dart';

/// One tour row from a tool config (`display_name || name`, description, premium flag, stage locks).
TourToolConfig tourToolConfigOf(ToolConfig c) => TourToolConfig(
      toolId: c.toolId,
      name: (c.displayName?.isNotEmpty ?? false) ? c.displayName! : c.name,
      description: c.description,
      isPremium: c.isPremium,
      flowLocked: c.flowLocked,
      bumpLocked: c.bumpLocked,
      mommyLocked: c.mommyLocked,
    );

/// Tool configs of [stage] without the disabled tools; null until the query succeeded (`configsReady`).
final toolsTourConfigsProvider = Provider.autoDispose.family<List<TourToolConfig>?, String>((ref, stage) {
  final q = ref.watch(toolConfigsQuery(stage.isEmpty ? null : stage));
  if (!q.isSuccess) return null;
  final disabled = ref.watch(disabledToolsProvider);
  return [
    for (final c in q.data ?? const <ToolConfig>[])
      if (!disabled.contains(c.toolId)) tourToolConfigOf(c),
  ];
}, name: 'toolsTourConfigsProvider');
