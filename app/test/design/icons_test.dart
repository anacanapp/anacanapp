// Ported from: src/lib/dynamicIcon.ts, app/tool/design/gen_icons.mjs outputs
import 'dart:io';

import 'package:anacan/design/design.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('every icon constant points at an exported SVG with currentColor', () {
    final all = <AIconData>{...AIcons.byImportName.values, AIcons.riApps2AiLine, AIcons.sonnerSuccess, AIcons.sonnerError, AIcons.sonnerInfo, AIcons.sonnerWarning};
    for (final i in all) {
      final f = File(i.asset);
      expect(f.existsSync(), isTrue, reason: i.asset);
      expect(f.readAsStringSync(), contains('currentColor'), reason: i.asset);
    }
    expect(AIcons.byImportName.length, greaterThan(250));
  });

  test('lucide aliases resolve to the canonical file', () {
    expect(AIcons.byImportName['Heart'], AIcons.heart);
    expect(AIcons.heart.asset, 'assets/icons/lucide/heart.svg');
  });

  test('getDynamicIcon: known name, unknown name, null', () {
    expect(AIcons.dynamic('Baby'), AIcons.baby);
    expect(AIcons.dynamic('NoSuchIcon'), AIcons.sparkles);
    expect(AIcons.dynamic(null), AIcons.sparkles);
    expect(AIcons.dynamic('', fallback: AIcons.heart), AIcons.heart);
    expect(AIcons.dynamicMap.length, 34);
  });
}
