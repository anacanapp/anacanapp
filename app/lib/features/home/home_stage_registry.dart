// Ported from: src/components/Dashboard.tsx (the `lifeStage` switch that picks FlowDashboard /
//              BumpDashboard / MommyDashboard inside the shared home frame)
//
// Stage-specific home bodies. The shared dashboard frame (header, stories, ask bar, shared blocks) lives in
// features/home; each stage port registers the body React renders for its stage:
//
//   registerHomeStageBody(LifeStages.flow, (context) => const FlowDashboard());
//   registerHomeStageBody(LifeStages.mommy, (context) => const MommyDashboard());
//
// `bump` is registered by features/home itself (BumpDashboard). Unregistered stages render nothing.
// The body is placed inside the home's single CustomScrollView as one sliver (SliverToBoxAdapter), so a
// stage body must NOT contain its own vertical scroll view; long lists inside it should be short/bounded.
// A stage that needs lazily built lists can register slivers instead with [registerHomeStageSlivers].
import 'package:flutter/widgets.dart';

import '../../state/user_store.dart' show LifeStages;

typedef HomeStageSliversBuilder = List<Widget> Function(BuildContext context);

final Map<String, WidgetBuilder> _bodies = {};
final Map<String, HomeStageSliversBuilder> _slivers = {};

/// Registers the home body for [lifeStage] (`'flow' | 'bump' | 'mommy'`). Re-registering replaces it
/// (hot reload / tests).
void registerHomeStageBody(String lifeStage, WidgetBuilder builder) {
  _bodies[lifeStage] = builder;
}

/// Sliver variant of [registerHomeStageBody]; when both exist the slivers win.
void registerHomeStageSlivers(String lifeStage, HomeStageSliversBuilder builder) {
  _slivers[lifeStage] = builder;
}

/// Removes registrations (tests).
void clearHomeStageBodies() {
  _bodies.clear();
  _slivers.clear();
}

bool hasHomeStageBody(String lifeStage) => _bodies.containsKey(lifeStage) || _slivers.containsKey(lifeStage);

/// The slivers the home scroll view inserts for [lifeStage]. Default: nothing.
List<Widget> buildHomeStageSlivers(BuildContext context, String lifeStage) {
  final s = _slivers[lifeStage];
  if (s != null) return s(context);
  final b = _bodies[lifeStage];
  if (b == null) return const [];
  return [SliverToBoxAdapter(child: Builder(builder: b))];
}

/// Known stages with a home body.
const homeStages = [LifeStages.flow, LifeStages.bump, LifeStages.mommy];
