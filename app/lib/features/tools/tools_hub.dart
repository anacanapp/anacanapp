// Ported from: src/components/ToolsHub.tsx, src/styles/anacan-design.css (.a-scope, .a-shell, .a-search,
//              .a-section, .a-section-head, .a-section-title, .a-section-link, .a-tool-grid(.compact), .a-tool-tile
//              (.is-locked), .a-tool-icon, .a-tool-title, .a-crown-chip, .dark .a-tool-icon, .a-card, .a-list-title,
//              .a-list-sub, .a-btn-soft), src/lib/analytics.ts (logToolOpened, logToolSession, logToolUsed)
//
// The Tools tab: search, Free / Premium sections of compact tiles, paywall routing, stage / week gates, merged host
// sections and the open tool (looked up in the shell registry). Index renders it keyed by `toolsResetKey` with
// `initialTool = activeTool` and `onBack = handleToolBack`.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/cache/cache.dart' show FetchStatus;
import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../domain/billing/freemium.dart' show ToolAccess;
import '../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../native/purchases/purchase_analytics.dart' show AnalyticsSink;
import '../../shell/shell.dart';
import '../onboarding/glass_tour.dart' show TourTargets;
import '../premium/premium_gates.dart' show PremiumToolBoundary;
import 'data/tool_config.dart';
import 'hub/fold_text.dart';
import 'hub/hub_inputs.dart';
import 'hub/hub_model.dart';
import 'kit/tool_kit.dart';

/// Clock of the session timer (tests override it).
final toolsHubClockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

/// `analytics.logToolOpened(toolId)`.
void logToolOpened(AnalyticsSink sink, String toolId) => sink.logEvent('tool_opened', {'tool_id': toolId});

/// `analytics.logToolSession(toolId, seconds)`: duration rounded and capped at one hour.
void logToolSession(AnalyticsSink sink, String toolId, double seconds) =>
    sink.logEvent('tool_used', {'tool_id': toolId, 'action': 'session', 'duration_s': math.min(3600, math.max(0, seconds.round()))});

/// `analytics.logToolUsed(toolId, action, itemId)`.
void logToolUsed(AnalyticsSink sink, String toolId, String action, [String? itemId]) =>
    sink.logEvent('tool_used', {'tool_id': toolId, 'action': action, 'item_id': ?itemId});

/// Scroll memory key of the tool list.
const String kToolsHubScrollKey = 'toolshub';

class ToolsHub extends ConsumerStatefulWidget {
  const ToolsHub({super.key, this.initialTool, this.onBack});

  /// Index `activeTool` (Dashboard shortcuts, deep links, pushes). Read on mount; later values only steer back.
  final String? initialTool;

  /// Index `handleToolBack`.
  final VoidCallback? onBack;

  @override
  ConsumerState<ToolsHub> createState() => _ToolsHubState();
}

class _ToolsHubState extends ConsumerState<ToolsHub> {
  final TextEditingController _search = TextEditingController();
  String _query = '';
  String? _activeTool;
  String? _toolSection;
  String? _prevTool;
  ({String id, DateTime start})? _session;
  VoidCallback? _releaseBack;
  String? _backFor;

  bool _showPaywall = false;
  bool _paywallPresented = false;
  String? _paywallTool;

  late final AnalyticsSink _analytics;
  late final ScrollMemory _memory;
  late final BackDispatcher _back;
  late final DateTime Function() _clock;

  HubContext get _c => ref.read(toolsHubContextProvider);
  String? _stageArg(HubContext c) => c.isAdmin ? null : (c.lifeStage == null || c.lifeStage!.isEmpty ? null : c.lifeStage);
  List<ToolConfig> get _configs => ref.read(toolsHubConfigsProvider(_stageArg(_c))).data;

  ToolAccess _accessFor(String toolId) => hubAccessFor(toolId, _configs, _c.lifeStage);
  bool _allowed(String toolId) => _c.isPremium || _accessFor(toolId) != 'premium';

  @override
  void initState() {
    super.initState();
    _analytics = ref.read(analyticsSinkProvider);
    _memory = ref.read(scrollMemoryProvider);
    _back = ref.read(backDispatcherProvider);
    _clock = ref.read(toolsHubClockProvider);
    ref.read(toolsHubSlotsProvider).prefetchFirstAid?.call(ref);
    _search.addListener(() {
      if (_search.text != _query) setState(() => _query = _search.text);
    });
    // useState(initialTool) + the [activeTool] effects of the first render.
    _activeTool = widget.initialTool;
    _afterToolChange(null);
    // Set initial tool from props on mount: a premium tool for a free user opens the paywall instead.
    final initial = widget.initialTool;
    if (initial != null && !_c.isPremium && _accessFor(initial) == 'premium') {
      _paywallTool = initial;
      _showPaywall = true;
    }
  }

  @override
  void dispose() {
    _releaseBack?.call();
    final s = _session;
    if (s != null) {
      final seconds = _clock().difference(s.start).inMilliseconds / 1000;
      if (seconds >= 5) logToolSession(_analytics, s.id, seconds);
    }
    _search.dispose();
    super.dispose();
  }

  // ── activeTool transitions (React effects on [activeTool]) ──

  void _setActiveTool(String? tool) {
    if (tool == _activeTool) return;
    final before = _activeTool;
    setState(() {
      _activeTool = tool;
      _toolSection = null;
    });
    _afterToolChange(before);
  }

  void _afterToolChange(String? before) {
    final tool = _activeTool;
    // useScrollToTop([activeTool]): the tool (or the list) starts at the top…
    _memory.scrollToTop();
    // …tool session: flush the previous visit (5 s or more), start a new one for a tool the user may open.
    final s = _session;
    _session = null;
    if (s != null) {
      final seconds = _clock().difference(s.start).inMilliseconds / 1000;
      if (seconds >= 5) logToolSession(_analytics, s.id, seconds);
    }
    if (tool != null && _allowed(tool)) _session = (id: tool, start: _clock());
    // …back on the list: the previous list position wins over the reset. One tool_opened per real open.
    if (_prevTool != null && tool == null) _memory.restore(kToolsHubScrollKey);
    if (tool != null && tool != _prevTool && _allowed(tool)) logToolOpened(_analytics, tool);
    _prevTool = tool;
    _syncBackHandler();
  }

  /// Android back: an open tool → the list (or back to the Dashboard when opened from there).
  void _syncBackHandler() {
    if (_backFor == _activeTool && (_releaseBack != null) == (_activeTool != null)) return;
    _releaseBack?.call();
    _releaseBack = null;
    _backFor = _activeTool;
    if (_activeTool == null) return;
    _releaseBack = _back.push(() {
      if (widget.onBack != null && widget.initialTool != null) {
        widget.onBack!();
      } else {
        _setActiveTool(null);
      }
      return true;
    }, BackLayer.screen);
  }

  void _openTool(String toolId) {
    _memory.save(kToolsHubScrollKey);
    _setActiveTool(toolId);
  }

  void _requestPaywall(String toolId) {
    setState(() {
      _paywallTool = toolId;
      _showPaywall = true;
    });
  }

  /// Freemium gate for direct opens (banners, mini games).
  void _gatedOpenTool(String toolId) {
    if (!_c.isPremium && _accessFor(toolId) == 'premium') {
      _requestPaywall(toolId);
      return;
    }
    _openTool(toolId);
  }

  void _handleBack() {
    if (_activeTool != null) {
      if (widget.onBack != null && widget.initialTool != null) {
        widget.onBack!();
      } else {
        _setActiveTool(null);
      }
    } else {
      widget.onBack?.call();
    }
  }

  void _handleToolClick(HubTool tool, HubContext c) {
    if (!isHubToolAvailable(tool, c)) {
      // Neutral info (not an error): the tile is already shown as disabled, this only says why.
      final toasts = AToastHost.of(context);
      if (tool.stages != null && !tool.stages!.contains(c.lifeStage ?? '')) {
        toasts.show(title: tool.name, description: tr('toolshub_not_for_stage', 'Bu alət hazırkı mərhələ üçün nəzərdə tutulmayıb'));
      } else if (tool.minWeek != null && c.lifeStage == 'bump') {
        toasts.show(title: tool.name, description: formatTr('toolshub_tool_opens_from_week', 'Bu alət {week}. həftədən açılacaq', {'week': tool.minWeek}));
      }
      return;
    }
    if (tool.preview && !tool.isLocked) return _openTool(tool.id);
    if (tool.isLocked && !c.isPremium) return _requestPaywall(tool.id);
    if (tool.isPremium && !c.isPremium) return _requestPaywall(tool.id);
    _openTool(tool.id);
  }

  /// The paywall is part of the list view (as the PremiumModal is in React): it shows while the list renders.
  void _presentPaywallIfNeeded() {
    if (!_showPaywall || _paywallPresented) return;
    _paywallPresented = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await ref.read(toolsHubPaywallProvider)(context, _paywallTool ?? 'tool');
      if (!mounted) return;
      setState(() {
        _showPaywall = false;
        _paywallPresented = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = ref.watch(toolsHubContextProvider);
    final view = ref.watch(toolsHubConfigsProvider(_stageArg(c)));
    final configs = view.data;
    final tools = buildHubTools(configs, c);

    final active = _activeTool;
    if (active != null) {
      final toolView = _buildTool(context, active, c, configs, tools);
      if (toolView != null) return toolView;
    }

    _presentPaywallIfNeeded();
    final configsMissing = configs.isEmpty;
    final loadFailed = configsMissing && (view.isError || (view.isPending && view.fetchStatus == FetchStatus.paused));
    final loading = configsMissing && !loadFailed && (view.isPending || view.fetchStatus == FetchStatus.fetching);
    return _buildList(context, c, configs, tools, loading: loading, loadFailed: loadFailed, refetch: view.refetch);
  }

  // ── open tool ──

  Widget? _buildTool(BuildContext context, String active, HubContext c, List<ToolConfig> configs, List<HubTool> tools) {
    bool toolAvailable(String id) => c.isAdmin || tools.any((t) => canonicalToolId(t.id) == id);
    HubTool? toolMeta(String id) {
      for (final t in tools) {
        if (canonicalToolId(t.id) == id) return t;
      }
      return null;
    }

    final target = resolveToolTarget(active, toolAvailable);
    final hostSections = (kHostSections[target.host] ?? [target.host]).where((id) => id == target.host || toolAvailable(id)).toList();
    final shownTool = _toolSection != null && hostSections.contains(_toolSection) ? _toolSection! : target.section;
    final toolId = ToolId.tryParse(shownTool);
    if (toolId == null) return null; // renderToolById → null: the list shows
    final builder = ref.watch(featureRegistryProvider).tool(toolId);

    final companion = kToolCompanion[shownTool];
    final companionOk = companion != null && toolAvailable(companion);
    ToolAccess access(String id) => hubAccessFor(id, configs, c.lifeStage);
    final introText = companionOk ? toolMeta(shownTool)?.description : null;
    final sections = ToolSectionsValue(
      sections: hostSections.length > 1
          ? [
              for (final id in hostSections)
                ToolSection(id: id, label: toolMeta(id)?.name ?? codeSectionLabel(id) ?? id, locked: !c.isPremium && access(id) == 'premium'),
            ]
          : null,
      active: shownTool,
      onSelect: (id) {
        setState(() => _toolSection = id);
        logToolUsed(_analytics, target.host, 'section', id);
      },
      intro: introText == null || introText.isEmpty ? null : introText,
      link: companionOk ? (label: toolMeta(companion)?.name ?? companion, onOpen: () => _openTool(companion)) : null,
    );

    Widget tool = KeyedSubtree(
      key: ValueKey('tool:$shownTool'),
      child: builder != null
          ? builder(context, ShellToolArgs(tool: toolId, rawId: shownTool, onBack: _handleBack))
          : ShellPlaceholder(kind: 'tool', id: shownTool, onBack: _handleBack, fill: false),
    );
    // Free and limited tools render directly (limited ones enforce their own free limit inside). A Premium section of
    // a free host shows the paywall and returns to the host when closed.
    if (access(shownTool) == 'premium') {
      final closeGate = shownTool != target.host ? () => setState(() => _toolSection = target.host) : _handleBack;
      tool = PremiumToolBoundary(onClose: closeGate, child: tool);
    }
    return ToolSections(value: sections, child: tool);
  }

  // ── list ──

  static String _stageEmoji(String? stage) => switch (stage) {
        'flow' => '🌸',
        'bump' => '🤰',
        'mommy' => '👶',
        _ => '✨',
      };

  Widget _buildList(BuildContext context, HubContext c, List<ToolConfig> configs, List<HubTool> tools,
      {required bool loading, required bool loadFailed, VoidCallback? refetch}) {
    final a = context.a;
    final slots = ref.watch(toolsHubSlotsProvider);
    final lists = hubLists(tools, configs, _query);
    final searching = _query.trim().isNotEmpty;
    final groups = searching
        ? [(key: 'results', title: '${lists.displayed.length} ${tr('toolshub_netice', 'nəticə')}', list: lists.displayed, premium: false)]
        : [
            (key: 'free', title: tr('toolshub_free_tools', 'Ödənişsiz alətlər'), list: lists.free, premium: false),
            (key: 'premium', title: tr('toolshub_premium_tools', 'Premium alətlər'), list: lists.premium, premium: true),
          ];

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (slots.adSurface != null) slots.adSurface!(context, 'tools_banner'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(padding: const EdgeInsets.only(top: 14), child: _searchBox(context, c)),
                    if (slots.bannerSlot != null) Padding(padding: const EdgeInsets.only(top: 12), child: slots.bannerSlot!(context, 'tools_top', _gatedOpenTool)),
                    if (searching && slots.aptekSearchResults != null)
                      slots.aptekSearchResults!(context, foldQuery(_query), () => _search.clear(), (screen) => _openAptek(screen)),
                    if (slots.adInlineAnchor != null) slots.adInlineAnchor!(context, 'tools_banner'),
                    if (loading) const _HubSkeleton(),
                    if (loadFailed) _offlineCard(context, refetch),
                    if (!loading)
                      for (final g in groups)
                        if (g.list.isNotEmpty) _section(context, c, g.key, g.title, g.list, premiumSection: g.premium),
                    if (lists.displayed.isEmpty && !loading && !loadFailed) _emptyState(context),
                    if (slots.bannerSlot != null) Padding(padding: const EdgeInsets.only(top: 24), child: slots.bannerSlot!(context, 'tools_bottom', _gatedOpenTool)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// `openAptek(screen)`: the push-nav event `{ screen }`.
  void _openAptek(String screen) => ref.read(shellProvider.notifier).dispatchPushEvent(PushNavIntent(screen: screen));

  Widget _searchBox(BuildContext context, HubContext c) {
    final a = context.a;
    final placeholder = tr('toolshub_alet_axtarin_fad58b', 'Alət axtarın...');
    // Preflight: inputs inherit the .a-scope font. keyboard.css lifts text inputs to `max(16px, 1em)` on phones
    // (max-width 767px, iOS zoom guard), over `.a-search input { font-size: 13px }`.
    final fontSize = MediaQuery.sizeOf(context).width <= 767 ? 16.0 : 13.0;
    final style = DefaultTextStyle.of(context).style.merge(TextStyle(fontSize: fontSize, color: a.ink, height: 1.5));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: a.line),
        boxShadow: a.cardShadow,
      ),
      child: Row(children: [
        Text(_stageEmoji(c.lifeStage), style: const TextStyle(fontSize: 15, height: 1.5)),
        const SizedBox(width: 10),
        Expanded(
          child: Material(
            type: MaterialType.transparency,
            child: Semantics(
              label: placeholder,
              textField: true,
              child: TextField(
                key: const ValueKey('toolshub-search'),
                controller: _search,
                style: style,
                cursorColor: a.ink,
                decoration: InputDecoration.collapsed(hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
              ),
            ),
          ),
        ),
        if (_query.isEmpty) ...[const SizedBox(width: 10), AIcon(AIcons.search, size: 15, color: a.inkFaint)],
      ]),
    );
  }

  Widget _section(BuildContext context, HubContext c, String key, String title, List<HubTool> list, {required bool premiumSection}) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      key: TourTargets.key('tools-$key'),
      padding: const EdgeInsets.only(top: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Flexible(
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (premiumSection) ...[AIcon(AIcons.crown, size: 15, strokeWidth: 2.4, color: a.yellow2), const SizedBox(width: 6)],
                    Flexible(child: Text(title, style: x.aSectionTitle)),
                  ]),
                ),
                Text(
                  premiumSection && c.isPremium ? tr('toolshub_premium_open', 'Sizdə açıqdır') : '${list.length} ${tr('toolshub_alet_9a099a', 'alət')}',
                  style: x.aSectionLink,
                ),
              ],
            ),
          ),
          _grid([for (final (i, t) in list.indexed) _tile(context, c, t, i)]),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, HubContext c, HubTool tool, int index) {
    final available = isHubToolAvailable(tool, c);
    final needsPremium = (tool.isLocked || tool.isPremium) && !c.isPremium;
    final limitedHint = tool.limited && !needsPremium && !c.isPremium;
    final label = !available
        ? '${tool.name} · ${unavailableHint(tool, c.lifeStage)}'
        : needsPremium
            ? '${tool.name} · Premium'
            : limitedHint
                ? '${tool.name} · ${tr('hub_tools_free_limited', 'Pulsuz · limitli')}'
                : tool.name;
    return _HubTile(
      key: TourTargets.key('tool-${tool.id}'),
      tool: tool,
      index: index,
      available: available,
      locked: needsPremium && available,
      hint: !available ? unavailableHint(tool, c.lifeStage) : null,
      limitedHint: limitedHint && available,
      semanticLabel: label,
      onTap: () => tool.id == 'cakes'
          ? _openTool('cakes')
          : tool.id == 'mini-games'
              ? _gatedOpenTool('mini-games')
              : _handleToolClick(tool, c),
    );
  }

  /// `.a-tool-grid.compact`: 3 equal columns, 8px gaps; a row is as tall as its tallest tile (grid stretch).
  static Widget _grid(List<Widget> tiles) {
    final rows = <Widget>[];
    for (var i = 0; i < tiles.length; i += 3) {
      if (i > 0) rows.add(const SizedBox(height: 8));
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var j = i; j < i + 3; j++) ...[
            if (j > i) const SizedBox(width: 8),
            Expanded(child: j < tiles.length ? tiles[j] : const SizedBox.shrink()),
          ],
        ]),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }

  Widget _offlineCard(BuildContext context, VoidCallback? refetch) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Semantics(
        liveRegion: true,
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: AIcon(AIcons.wifiOff, size: 32, color: a.inkFaint)),
            Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(tr('hub_tools_offline_title', 'Alətlər yüklənmədi'), textAlign: TextAlign.center, style: x.aListTitle)),
            Text(tr('hub_tools_offline_sub', 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.'), textAlign: TextAlign.center, style: x.aListSub),
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: () => refetch?.call(),
                leading: const AIcon(AIcons.refreshCw, size: 14),
                child: Text(tr('hub_tools_retry', 'Yenidən cəhd edin')),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _emptyState(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: _FadeIn(
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 36),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: AIcon(AIcons.search, size: 36, color: a.inkFaint)),
            Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(tr('toolshub_alet_tapilmadi_f358cb', 'Alət tapılmadı'), textAlign: TextAlign.center, style: x.aListTitle)),
            Text(
              _query.isNotEmpty
                  ? '"$_query" ${tr('toolshub_no_matching_tools', 'ilə uyğun alət yoxdur')}'
                  : tr('toolshub_bu_kateqoriyada_alet_yoxdur_6c04fc', 'Bu kateqoriyada alət yoxdur'),
              textAlign: TextAlign.center,
              style: x.aListSub,
            ),
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: PressScale(
                scale: 0.95,
                child: AButton(
                  variant: AButtonVariant.pillSoft,
                  onPressed: () => _search.clear(),
                  child: Text(tr('toolshub_hamisini_goster_b13d82', 'Hamısını göstər')),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── tiles ──

/// CSS `filter: saturate(s)` / `grayscale(1)` colour matrices (Filter Effects spec).
ColorFilter _saturate(double s) => ColorFilter.matrix(<double>[
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0, //
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0, //
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0, //
      0, 0, 0, 1, 0,
    ]);
const ColorFilter _grayscale = ColorFilter.matrix(<double>[
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0, 0, 0, 1, 0,
]);

/// `.a-tool-tile` in `.a-tool-grid.compact` (+ `.is-locked`, `.a-crown-chip`, the hints) with the framer entrance
/// `initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: available ? 1 : 0.45, scale: 1 }}` delayed
/// `min(index × 12 ms, 150 ms)`.
class _HubTile extends StatefulWidget {
  const _HubTile({
    super.key,
    required this.tool,
    required this.index,
    required this.available,
    required this.locked,
    required this.hint,
    required this.limitedHint,
    required this.semanticLabel,
    required this.onTap,
  });

  final HubTool tool;
  final int index;
  final bool available;
  final bool locked;
  final String? hint;
  final bool limitedHint;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  State<_HubTile> createState() => _HubTileState();
}

class _HubTileState extends State<_HubTile> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  Timer? _delay;
  double _fromOpacity = 0;
  double _toOpacity = 1;
  static final SpringSimulation _scale = SpringSimulation(ASprings.tapScale, 0.96, 1, 0);

  @override
  void initState() {
    super.initState();
    _toOpacity = widget.available ? 1 : 0.45;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_delay != null || _c.isAnimating || _c.value > 0) return;
    if (animationsDisabled(context)) {
      _c.value = 1;
      _fromOpacity = _toOpacity;
      return;
    }
    final ms = math.min(widget.index * 12, 150);
    _delay = Timer(Duration(milliseconds: ms), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(_HubTile old) {
    super.didUpdateWidget(old);
    final target = widget.available ? 1.0 : 0.45;
    if (target != _toOpacity) {
      _fromOpacity = _currentOpacity;
      _toOpacity = target;
      if (animationsDisabled(context)) {
        _fromOpacity = target;
      } else {
        _c.forward(from: 0);
      }
    }
  }

  double get _t => _c.value * _c.duration!.inMilliseconds;
  double get _currentOpacity {
    // framer's default tween for opacity: 300 ms [0.25, 0.1, 0.35, 1].
    final p = (_t / 300).clamp(0.0, 1.0);
    return _fromOpacity + (_toOpacity - _fromOpacity) * ACurves.framerDefault.transform(p);
  }

  @override
  void dispose() {
    _delay?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tile = _tileBody(context);
    return AnimatedBuilder(
      animation: _c,
      child: tile,
      builder: (context, child) {
        final scale = _c.value >= 1 ? 1.0 : _scale.x(_t / 1000);
        return Opacity(opacity: _currentOpacity.clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child));
      },
    );
  }

  Widget _tileBody(BuildContext context) {
    final tokens = context.tokens;
    final a = tokens.a;
    final tool = widget.tool;
    final gradients = [a.gradPeach, a.gradPink, a.gradLav, a.gradBlue, a.gradGreen, a.gradYellow];
    final inks = [a.accentInk, a.berryInk, a.lavInk, a.blueInk, a.greenInk, a.warnInk];
    final i = widget.index % gradients.length;
    // `.dark .a-tool-icon { background: #ffffff !important; color: var(--a-peach-2) !important }`
    final iconBox = Container(
      width: 38,
      height: 38,
      margin: const EdgeInsets.only(bottom: 8),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: tokens.isDark ? null : gradients[i],
        color: tokens.isDark ? const Color(0xFFFFFFFF) : null,
      ),
      child: AIcon(tool.icon, size: 17, color: tokens.isDark ? a.peach2 : inks[i]),
    );
    final hintStyle = TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, height: 1.2, leadingDistribution: TextLeadingDistribution.even);
    Widget body = Container(
      constraints: const BoxConstraints(minHeight: 92),
      decoration: BoxDecoration(
        color: a.surface,
        border: Border.all(color: a.line),
        borderRadius: BorderRadius.circular(a.radiusMd),
        boxShadow: a.cardShadow,
      ),
      // `.a-tool-grid.compact .a-tool-tile`: flex column, align-items center (one-line titles stay centred).
      child: Stack(alignment: AlignmentDirectional.topCenter, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(6, 12, 6, 11),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            widget.locked ? Opacity(opacity: 0.75, child: ColorFiltered(colorFilter: _saturate(0.55), child: iconBox)) : iconBox,
            Text(
              tool.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                height: 1.25,
                leadingDistribution: TextLeadingDistribution.even,
                color: widget.locked ? a.inkSoft : a.ink,
              ),
            ),
            if (widget.hint != null)
              Padding(padding: const EdgeInsets.only(top: 3), child: Text(widget.hint!, textAlign: TextAlign.center, style: hintStyle.copyWith(color: a.inkSoft))),
            if (widget.limitedHint)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(tr('hub_tools_free_limited', 'Pulsuz · limitli'), textAlign: TextAlign.center, style: hintStyle.copyWith(color: a.greenInk)),
              ),
          ]),
        ),
        if (widget.locked)
          PositionedDirectional(
            top: 6,
            end: 6,
            child: Container(
              width: 18,
              height: 18,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: a.gradPeach,
                // 0 4px 10px -4px rgba(255, 138, 76, 0.8)
                boxShadow: [BoxShadow(color: const Color(0xCCFF8A4C), offset: const Offset(0, 4), blurRadius: (10 / 2 - 0.5) / 0.57735, spreadRadius: -4)],
              ),
              child: const AIcon(AIcons.lock, size: 9, strokeWidth: 2.8, color: Color(0xFFFFFFFF)),
            ),
          ),
      ]),
    );
    if (!widget.available) body = ColorFiltered(colorFilter: _grayscale, child: body);
    return Semantics(
      button: true,
      enabled: widget.available,
      label: widget.semanticLabel,
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: widget.onTap, child: body),
    );
  }
}

/// Loading skeleton: `.a-section` (aria-busy) with a 120×16 bar and nine pulsing tiles (`animate-pulse`: opacity
/// 1 → .5 → 1 every 2 s, `cubic-bezier(.4, 0, .6, 1)`; held still under reduced motion).
class _HubSkeleton extends StatefulWidget {
  const _HubSkeleton();
  @override
  State<_HubSkeleton> createState() => _HubSkeletonState();
}

class _HubSkeletonState extends State<_HubSkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));
  static const Cubic _curve = Cubic(0.4, 0, 0.6, 1);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _opacity(double t) => t < 0.5 ? 1 - 0.5 * _curve.transform(t * 2) : 0.5 + 0.5 * _curve.transform((t - 0.5) * 2);

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget pulse(Widget child) => AnimatedBuilder(animation: _c, child: child, builder: (_, c) => Opacity(opacity: _opacity(_c.value), child: c));
    final tile = Container(
      constraints: const BoxConstraints(minHeight: 92),
      padding: const EdgeInsets.fromLTRB(6, 12, 6, 11),
      decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 38, height: 38, margin: const EdgeInsets.only(bottom: 8), decoration: BoxDecoration(color: a.line, borderRadius: BorderRadius.circular(12))),
        FractionallySizedBox(
          widthFactor: 0.7,
          child: Container(height: 10, decoration: BoxDecoration(color: a.line, borderRadius: BorderRadius.circular(5))),
        ),
      ]),
    );
    return Semantics(
      label: tr('hub_tools_loading', 'Alətlər yüklənir'),
      container: true,
      child: Padding(
        padding: const EdgeInsets.only(top: 22),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: pulse(Container(width: 120, height: 16, decoration: BoxDecoration(color: a.line, borderRadius: BorderRadius.circular(8)))),
            ),
          ),
          ExcludeSemantics(child: _ToolsHubState._grid([for (var i = 0; i < 9; i++) pulse(tile)])),
        ]),
      ),
    );
  }
}

/// framer `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` (300 ms default tween).
class _FadeIn extends StatefulWidget {
  const _FadeIn({required this.child});
  final Widget child;
  @override
  State<_FadeIn> createState() => _FadeInState();
}

class _FadeInState extends State<_FadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && !_c.isAnimating) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(opacity: CurvedAnimation(parent: _c, curve: ACurves.framerDefault), child: widget.child);
}
