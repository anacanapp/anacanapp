// Ported from: src/components/ToolsHub.tsx (the registrations of the remaining phase 4 tools; no vitest suite)
import 'package:anacan/features/tools/more_tools.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers market, mom-friendly places, smart play, play together, kid exercises and affiliate', () {
    final r = FeatureRegistry();
    registerMoreTools(r);
    for (final id in [ToolId.secondhandMarket, ToolId.momFriendlyMap, ToolId.smartPlayBox, ToolId.playTogether, ToolId.kidExercises, ToolId.affiliate]) {
      expect(r.tool(id), isNotNull, reason: id.name);
    }
    // The aliases open the same tools.
    expect(ToolId.tryParse('second-hand-market'), ToolId.secondhandMarket);
    expect(ToolId.tryParse('affiliate-products'), ToolId.affiliate);
  });
}
