// Ported from: (test harness for the Tools hub / tool kit ports — no React counterpart)
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/hub/hub_inputs.dart';
import 'package:anacan/features/tools/hub/hub_model.dart';
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/tools_hub.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

import '../../../support/i18n_fakes.dart';

/// A `tool_configs` row as the vitest `cfg()` helper builds it.
Map<String, dynamic> cfg(String toolId, String name, [Map<String, dynamic> extra = const {}]) => {
      'tool_id': toolId,
      'name': name,
      'description': '',
      'icon': 'Wrench',
      'color': 'pink',
      'bg_color': 'pink',
      'life_stages': ['mommy'],
      'is_premium': true,
      'premium_type': 'none',
      'premium_limit': 0,
      ...extra,
    };

List<ToolConfig> configs(List<Map<String, dynamic>> rows) => rows.map(ToolConfig.fromRow).toList();

/// Records every source read; answers by table.
class FakeToolsSource implements ToolsDataSource {
  FakeToolsSource([Map<String, List<Map<String, dynamic>>>? tables]) : tables = tables ?? {};
  final Map<String, List<Map<String, dynamic>>> tables;
  final List<TableQuery> calls = [];
  Object? error;

  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async {
    calls.add(query);
    final e = error;
    if (e != null) throw e;
    return [for (final r in tables[query.table] ?? const <Map<String, dynamic>>[]) Map<String, dynamic>.of(r)];
  }
}

/// A registered tool body: a ToolHeader with the shell back + its raw id.
class FakeTool extends StatelessWidget {
  const FakeTool(this.args, {super.key});
  final ShellToolArgs args;
  @override
  Widget build(BuildContext context) => ToolPage(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ToolHeader(title: 'Tool ${args.rawId}', onBack: args.onBack),
          Text('tool:${args.rawId}'),
        ]),
      );
}

FeatureRegistry fakeRegistry(Iterable<ToolId> ids) {
  final r = FeatureRegistry();
  for (final id in ids) {
    r.registerTool(id, (context, args) => FakeTool(args));
  }
  return r;
}

class HubHarness {
  HubHarness({
    this.context = const HubContext(lifeStage: 'mommy', language: 'az', countryCode: 'AZ', disabledTools: ['cakes', 'mini-games']),
    List<Map<String, dynamic>>? rows,
    this.view,
    FeatureRegistry? registry,
    this.subscription = const SubscriptionState(),
  })  : rows = rows ?? const [],
        registry = registry ?? FeatureRegistry();

  final HubContext context;
  final List<Map<String, dynamic>> rows;
  final ToolConfigsView? view;
  final FeatureRegistry registry;
  final SubscriptionState subscription;

  final List<String> paywalls = [];
  final RecordingAnalyticsSink analytics = RecordingAnalyticsSink();
  final BackDispatcher back = BackDispatcher();
  DateTime now = DateTime.utc(2026, 11, 27, 10);
  int refetches = 0;
  int backs = 0;

  List<Override> get overrides => [
        toolsHubContextProvider.overrideWithValue(context),
        toolsHubConfigsProvider.overrideWith(
            (ref, stage) => view ?? ToolConfigsView(data: configs(rows), isPending: false, refetch: () => refetches++)),
        toolsHubPaywallProvider.overrideWithValue((ctx, source) async => paywalls.add(source)),
        analyticsSinkProvider.overrideWithValue(analytics),
        featureRegistryProvider.overrideWithValue(registry),
        subscriptionProvider.overrideWithValue(subscription),
        backDispatcherProvider.overrideWithValue(back),
        toolsHubClockProvider.overrideWithValue(() => now),
        queryClientProvider.overrideWithValue(QueryClient()),
      ];

  /// Analytics events as `name {params}` strings.
  List<String> get events => [for (final e in analytics.events) '${e.$1} ${e.$2.isEmpty ? {} : e.$2.first}'];

  Future<void> pump(WidgetTester tester, {String? initialTool, bool withOnBack = true, bool dark = false}) async {
    installTestI18n();
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(data: const MediaQueryData(size: Size(390, 1600), disableAnimations: true), child: nav!),
        home: AToastHost(
          child: SingleChildScrollView(
            child: ToolsHub(initialTool: initialTool, onBack: withOnBack ? () => backs++ : null),
          ),
        ),
      ),
    ));
    await tester.pump();
  }
}

/// Unmounts and flushes timers (toasts, delayed scroll retries).
Future<void> tearDownTree(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 10));
}
