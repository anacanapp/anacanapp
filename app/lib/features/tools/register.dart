// Ported from: src/pages/Index.tsx (tools tab: `<ToolsHub key={toolsResetKey} initialTool={activeTool}
//              onBack={handleToolBack} />`)
//
// The Tools tab is a box tab (one SliverToBoxAdapter in the shell's scroll view, like the React page inside the
// scroll container): the tile list and every tool scroll with the shell, so scroll memory (`toolshub`) and
// scroll-to-top work on the shared container. It is not `fillsViewport` (tools are normal-flow pages). The shell keys
// the content by `toolsResetKey`. Tool bodies are registered by the tool features with `r.registerTool(ToolId.x, …)`.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../../shell/shell.dart';
import 'tools_hub.dart';

void registerToolsFeature(FeatureRegistry r) {
  r.registerTab(ShellTab.tools, (context, args) => _ToolsTab(initialTool: args.state.activeTool));
}

class _ToolsTab extends ConsumerWidget {
  const _ToolsTab({required this.initialTool});
  final String? initialTool;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      ToolsHub(initialTool: initialTool, onBack: () => ref.read(shellProvider.notifier).toolBack());
}
