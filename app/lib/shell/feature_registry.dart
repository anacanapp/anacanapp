// Ported from: src/pages/Index.tsx (lazy screen imports and the tab / sub-screen / overlay switch),
//              src/components/ToolsHub.tsx (renderToolById), src/App.tsx (outer route elements)
//
// Feature ports plug their widgets into the shell here instead of the shell importing them. Each feature
// exposes ONE function `void registerX(FeatureRegistry r)` (e.g. `registerKickCounter`, `registerCommunity`)
// that calls the `register*` methods below; the app root builds the registry from the list of those
// functions and overrides [featureRegistryProvider]. Anything not registered renders [ShellPlaceholder].
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/theme.dart';
import 'gates/gate_sequence.dart';
import 'nav/ids.dart';
import 'nav/shell_state.dart';

/// Arguments of a tab body.
class ShellTabArgs {
  const ShellTabArgs({required this.tab, required this.partner, required this.state});
  final ShellTab tab;

  /// Partner variant (`role === 'partner'` and the tab is not `community`).
  final bool partner;
  final ShellState state;
}

/// Arguments of a sub-screen (`activeScreen`).
class ShellScreenArgs {
  const ShellScreenArgs({required this.screen, required this.onBack});
  final ShellScreen screen;

  /// `setActiveScreen(null)`, except `ad-preferences`, whose back returns to `settings` (as in Index).
  final VoidCallback onBack;
}

/// Arguments of a tool body (rendered by the Tools hub).
class ShellToolArgs {
  const ShellToolArgs({required this.tool, required this.rawId, required this.onBack});
  final ToolId tool;

  /// The id as opened (an alias stays an alias).
  final String rawId;
  final VoidCallback onBack;
}

/// Full-screen layers Index renders instead of (or above) the tab frame.
enum ShellOverlayId {
  /// `showMotherChat` → MessagesScreen.
  motherChat,

  /// `viewingUserId` → UserProfileScreen (inside the sub-screen frame).
  userProfile,

  /// BlogLinkHost article reader (over everything).
  blogArticle,
}

class ShellOverlayArgs {
  const ShellOverlayArgs({required this.onClose, this.userId, this.slug});
  final VoidCallback onClose;

  /// [ShellOverlayId.userProfile].
  final String? userId;

  /// [ShellOverlayId.blogArticle].
  final String? slug;
}

/// Arguments of a gate screen.
class GateArgs {
  const GateArgs({required this.decision, required this.inputs, this.onIntroComplete, this.onCountryDone});
  final GateDecision decision;
  final GateInputs inputs;

  /// AppIntroduction `onComplete`.
  final VoidCallback? onIntroComplete;

  /// CountryGate `onDone`.
  final VoidCallback? onCountryDone;
}

/// go_router pages outside the Index shell (see router.dart).
enum OuterRouteId { resetPassword, legal, paymentSuccess, paymentError, miniGames, notFound }

class OuterRouteArgs {
  const OuterRouteArgs({required this.uri, this.params = const {}});
  final Uri uri;
  final Map<String, String> params;
}

typedef ShellTabBuilder = Widget Function(BuildContext context, ShellTabArgs args);
typedef ShellScreenBuilder = Widget Function(BuildContext context, ShellScreenArgs args);
typedef ShellToolBuilder = Widget Function(BuildContext context, ShellToolArgs args);
typedef ShellOverlayBuilder = Widget Function(BuildContext context, ShellOverlayArgs args);
typedef GateBuilder = Widget Function(BuildContext context, GateArgs args);
typedef OuterRouteBuilder = Widget Function(BuildContext context, OuterRouteArgs args);

/// A sliver tab body: [sliver] goes straight into the shell's scroll view (lists inside it are built lazily),
/// [background] is painted behind the scroll view at the top of the content and scrolls with it (the page-top
/// `position: absolute` decorations of the web pages, e.g. the home sky).
class ShellSliverBody {
  const ShellSliverBody({required this.sliver, this.background});
  final Widget sliver;
  final Widget? background;
}

typedef ShellTabSliversBuilder = ShellSliverBody Function(BuildContext context, ShellTabArgs args);

class TabRegistration {
  const TabRegistration(this.builder, {this.fillsViewport = false, this.slivers});
  final ShellTabBuilder builder;

  /// `className="h-full"` tabs (AI chat, partner chat): sized to the scroll viewport minus `pb-nav`
  /// and expected to scroll internally.
  final bool fillsViewport;

  /// Sliver body ([FeatureRegistry.registerTabSlivers]); the shell prefers it over [builder].
  final ShellTabSliversBuilder? slivers;
}

/// Box rendering of a sliver body (previews, tests): a shrink-wrapped, non-scrolling CustomScrollView.
Widget _sliverBodyAsBox(ShellTabSliversBuilder slivers, BuildContext context, ShellTabArgs args) {
  final body = slivers(context, args);
  return Stack(children: [
    if (body.background != null) Positioned(top: 0, left: 0, right: 0, child: body.background!),
    CustomScrollView(shrinkWrap: true, primary: false, physics: const NeverScrollableScrollPhysics(), slivers: [body.sliver]),
  ]);
}

/// Maps of tab / screen / tool / overlay / gate / route ids → builders.
class FeatureRegistry {
  final Map<(ShellTab, bool), TabRegistration> _tabs = {};
  final Map<ScreenId, ShellScreenBuilder> _screens = {};
  final Map<ToolId, ShellToolBuilder> _tools = {};
  final Map<ShellOverlayId, ShellOverlayBuilder> _overlays = {};
  final Map<GateId, GateBuilder> _gates = {};
  final Map<OuterRouteId, OuterRouteBuilder> _routes = {};
  final List<(String, WidgetBuilder)> _frameOverlays = [];

  void _put<K, V>(Map<K, V> map, K key, V value, String what) {
    if (map.containsKey(key)) throw StateError('$what $key is registered twice');
    map[key] = value;
  }

  /// Runs feature registration functions: `registry.registerAll([registerHome, registerTools, …])`.
  void registerAll(Iterable<void Function(FeatureRegistry r)> registrations) {
    for (final r in registrations) {
      r(this);
    }
  }

  /// A tab body. [partner] registers the partner-role variant (partner tabs other than `community`).
  void registerTab(ShellTab tab, ShellTabBuilder builder, {bool partner = false, bool fillsViewport = false}) =>
      _put(_tabs, (tab, partner), TabRegistration(builder, fillsViewport: fillsViewport), 'tab');

  /// A tab body built from slivers (lazy vertical lists). The shell places [ShellSliverBody.sliver] directly in
  /// its single scroll container; scroll memory, scroll-to-top and the `pb-nav` clearance work as for box tabs.
  void registerTabSlivers(ShellTab tab, ShellTabSliversBuilder builder, {bool partner = false}) => _put(
      _tabs,
      (tab, partner),
      TabRegistration((context, args) => _sliverBodyAsBox(builder, context, args), slivers: builder),
      'tab');

  void registerScreen(ScreenId id, ShellScreenBuilder builder) => _put(_screens, id, builder, 'screen');

  /// A tool body; the Tools hub feature looks tools up with [tool].
  void registerTool(ToolId id, ShellToolBuilder builder) => _put(_tools, id, builder, 'tool');

  void registerOverlay(ShellOverlayId id, ShellOverlayBuilder builder) => _put(_overlays, id, builder, 'overlay');
  void registerGate(GateId id, GateBuilder builder) => _put(_gates, id, builder, 'gate');
  void registerRoutePage(OuterRouteId id, OuterRouteBuilder builder) => _put(_routes, id, builder, 'route');

  /// Widgets layered over the tab frame in registration order (rating prompt, update sheet, AlertReceiver,
  /// floating timer, feedback / lock sheets, onboarding tour host …). They sit below the bottom nav.
  void registerFrameOverlay(String id, WidgetBuilder builder) {
    if (_frameOverlays.any((e) => e.$1 == id)) throw StateError('frame overlay $id is registered twice');
    _frameOverlays.add((id, builder));
  }

  TabRegistration? tab(ShellTab tab, {required bool partner}) => _tabs[(tab, partner)];
  ShellScreenBuilder? screen(ScreenId id) => _screens[id];
  ShellToolBuilder? tool(ToolId id) => _tools[id];
  ShellOverlayBuilder? overlay(ShellOverlayId id) => _overlays[id];
  GateBuilder? gate(GateId id) => _gates[id];
  OuterRouteBuilder? routePage(OuterRouteId id) => _routes[id];
  List<WidgetBuilder> get frameOverlays => [for (final e in _frameOverlays) e.$2];

  /// Every registered key (debug, tests).
  Set<String> get registeredIds => {
        for (final k in _tabs.keys) 'tab:${k.$1.id}${k.$2 ? ':partner' : ''}',
        for (final k in _screens.keys) 'screen:${k.id}',
        for (final k in _tools.keys) 'tool:${k.id}',
        for (final k in _overlays.keys) 'overlay:${k.name}',
        for (final k in _gates.keys) 'gate:${k.name}',
        for (final k in _routes.keys) 'route:${k.name}',
        for (final e in _frameOverlays) 'frame:${e.$1}',
      };
}

/// The app root overrides this with the registry built from every feature's `registerX`.
final featureRegistryProvider = Provider<FeatureRegistry>((ref) => FeatureRegistry());

/// Neutral stand-in for an unregistered entry (debug aid): shows `<kind>:<id>`.
class ShellPlaceholder extends StatelessWidget {
  const ShellPlaceholder({super.key, required this.kind, required this.id, this.onBack, this.fill = true});
  final String kind;
  final String id;
  final VoidCallback? onBack;
  final bool fill;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final label = Semantics(
      label: '$kind:$id',
      child: Text('$kind:$id', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: t.inkSoft)),
    );
    final body = Container(
      key: ValueKey('placeholder-$kind:$id'),
      constraints: const BoxConstraints(minHeight: 120),
      color: t.bg,
      padding: const EdgeInsets.all(16),
      alignment: Alignment.center,
      child: onBack == null
          ? label
          : Column(mainAxisSize: MainAxisSize.min, children: [
              label,
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onBack,
                child: Text('←', style: TextStyle(fontSize: 20, color: t.ink)),
              ),
            ]),
    );
    return fill ? SizedBox.expand(child: body) : body;
  }
}
