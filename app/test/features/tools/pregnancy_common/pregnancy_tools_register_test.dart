// Ported from: src/components/ToolsHub.tsx (renderToolById cases of the pregnancy tools)
import 'package:anacan/features/tools/pregnancy_tools.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the ten pregnancy tools (aliases resolve through ToolId)', () {
    final r = FeatureRegistry();
    registerPregnancyTools(r);
    for (final id in const [
      ToolId.safety,
      ToolId.kick,
      ToolId.contraction,
      ToolId.weight,
      ToolId.hospital,
      ToolId.names,
      ToolId.maternityCalculator,
      ToolId.fetalGrowth,
      ToolId.dangerSigns,
      ToolId.pregnancyAlbum,
    ]) {
      expect(r.tool(id), isNotNull, reason: id.id);
    }
    expect(ToolId.tryParse('baby-names'), ToolId.names);
    expect(ToolId.tryParse('maternity'), ToolId.maternityCalculator);
    expect(() => registerPregnancyTools(r), throwsA(anything)); // registering twice throws
  });
}
