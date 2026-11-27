import 'package:anacan/design/design.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'harness.dart';
void main() {
  testWidgets('ri', (tester) async {
    await tester.pumpWidget(const Directionality(textDirection: TextDirection.ltr, child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: [AIcon(AIcons.riApps2AiLine, color: Color(0xFF000000)), AIcon(AIcons.heart, color: Color(0xFF000000)), AIcon(AIcons.sonnerSuccess, color: Color(0xFF000000))]))));
    await settleSvgs(tester);
    await expectLater(find.byType(Row), matchesGoldenFile('tmp.png'));
  });
}
