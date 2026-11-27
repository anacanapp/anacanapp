// Ported from: src/components/ToolsHub.tsx (renderToolById for the baby tools) — every baby ToolId is registered.
import 'package:anacan/features/tools/baby_tools.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the seven baby tools', () {
    final r = FeatureRegistry();
    registerBabyTools(r);
    for (final id in [
      ToolId.babyTracker, ToolId.babyGrowth, ToolId.teething, ToolId.vaccineCalendar,
      ToolId.solidFoodGuide, ToolId.preemieHub, ToolId.babyAlbum,
    ]) {
      expect(r.tool(id), isNotNull, reason: id.id);
    }
    // Aliases resolve to the same registrations.
    expect(ToolId.tryParse('growth-tracker'), ToolId.babyGrowth);
    expect(ToolId.tryParse('vaccines-calendar'), ToolId.vaccineCalendar);
  });
}
